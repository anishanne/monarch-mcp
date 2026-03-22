import { log, getSeverity } from "../logger.js";
import {
  getToken,
  getAllTokenCandidates,
  refreshToken,
  clearCachedToken,
  saveToken,
} from "../token-manager.js";

const GRAPHQL_ENDPOINT = "https://api.monarch.com/graphql";

export interface GraphQLClient {
  query<T = any>(query: string, variables?: Record<string, any>): Promise<T>;
}

function extractOperationName(query: string): string {
  const match = query.match(/(?:query|mutation)\s+(\w+)/);
  return match?.[1] ?? "unknown";
}

async function doFetch(
  query: string,
  variables: Record<string, any> | undefined,
  token: string
): Promise<Response> {
  return fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
      "Client-Platform": "web",
    },
    body: JSON.stringify({ query, variables }),
  });
}

async function resolveToken(
  operation: string,
  initialToken: string,
  query: string,
  variables: Record<string, any> | undefined,
  initialRes: Response,
  startTime: number
): Promise<{ res: Response; token: string }> {
  // Step 1: Token expired
  log({
    type: "token",
    severity: "warning",
    method: "expired",
    summary: `Token expired during ${operation}`,
    details: { operation, tokenPrefix: initialToken.slice(0, 8) + "..." },
    durationMs: Date.now() - startTime,
  });

  clearCachedToken();
  const candidates = await getAllTokenCandidates();
  let candidatesTried = 0;

  // Step 2: Try alternate tokens
  for (const candidate of candidates) {
    if (candidate === initialToken) continue;
    candidatesTried++;
    const source =
      candidate === process.env.MONARCH_TOKEN ? "env var" : "database";

    log({
      type: "token",
      severity: "info",
      method: "retry",
      summary: `Trying alternate token from ${source}`,
      details: { operation, source, tokenPrefix: candidate.slice(0, 8) + "..." },
    });

    const res = await doFetch(query, variables, candidate);
    if (res.status !== 401) {
      await saveToken(candidate);
      log({
        type: "token",
        severity: "info",
        method: "retry",
        summary: `Alternate token from ${source} worked`,
        durationMs: Date.now() - startTime,
      });
      return { res, token: candidate };
    }
  }

  // Step 3: All tokens failed — login refresh
  log({
    type: "token",
    severity: "warning",
    method: "refresh",
    summary: `All ${candidatesTried + 1} tokens rejected — logging in to Monarch`,
    details: { operation, candidatesTried: candidatesTried + 1 },
    durationMs: Date.now() - startTime,
  });

  let newToken: string;
  try {
    newToken = await refreshToken();
  } catch (err: any) {
    log({
      type: "token",
      severity: "critical",
      method: "refresh",
      summary: `Login failed: ${err.message}`,
      details: { operation, error: err.message },
      durationMs: Date.now() - startTime,
    });
    throw new Error(
      `Monarch token expired and auto-refresh failed: ${err.message}`
    );
  }

  const res = await doFetch(query, variables, newToken);

  if (res.status === 401) {
    log({
      type: "token",
      severity: "critical",
      method: "refresh",
      summary: "Fresh token from login also rejected (401)",
      details: { operation },
      durationMs: Date.now() - startTime,
    });
    throw new Error("All Monarch tokens rejected and fresh login also failed.");
  }

  log({
    type: "token",
    severity: "info",
    method: "refresh",
    summary: "Login succeeded — new token saved to database",
    durationMs: Date.now() - startTime,
  });

  return { res, token: newToken };
}

export function createGraphQLClient(): GraphQLClient {
  return {
    async query<T = any>(
      query: string,
      variables?: Record<string, any>
    ): Promise<T> {
      const operation = extractOperationName(query);
      const start = Date.now();

      try {
        let token = await getToken();
        let res = await doFetch(query, variables, token);

        // Auto-resolve on 401
        if (res.status === 401) {
          const resolved = await resolveToken(
            operation,
            token,
            query,
            variables,
            res,
            start
          );
          res = resolved.res;
          token = resolved.token;
        }

        const durationMs = Date.now() - start;

        if (!res.ok) {
          log({
            type: "graphql",
            severity: "critical",
            method: operation,
            summary: `${operation} → ${res.status} ${res.statusText} (${durationMs}ms)`,
            details: { variables, status: res.status },
            durationMs,
          });
          throw new Error(
            `Monarch API error: ${res.status} ${res.statusText}`
          );
        }

        const json: any = await res.json();

        if (json.errors?.length) {
          const errMsg = json.errors.map((e: any) => e.message).join(", ");
          log({
            type: "graphql",
            severity: "critical",
            method: operation,
            summary: `${operation} → GraphQL error: ${errMsg} (${durationMs}ms)`,
            details: { variables, errors: json.errors },
            durationMs,
          });
          throw new Error(`GraphQL error: ${errMsg}`);
        }

        const responseSize = JSON.stringify(json.data).length;
        log({
          type: "graphql",
          severity: getSeverity(operation),
          method: operation,
          summary: `${operation} → OK (${(responseSize / 1024).toFixed(1)}KB, ${durationMs}ms)`,
          details: { variables, responseSize },
          durationMs,
        });

        return json.data as T;
      } catch (err: any) {
        if (
          !err.message?.includes("GraphQL") &&
          !err.message?.includes("Monarch") &&
          !err.message?.includes("token")
        ) {
          log({
            type: "error",
            severity: "critical",
            method: operation,
            summary: `${operation} → ${err.message}`,
            details: { variables, error: err.message },
            durationMs: Date.now() - start,
          });
        }
        throw err;
      }
    },
  };
}
