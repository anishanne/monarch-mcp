import { log, getSeverity } from "../logger.js";
import { getToken, getAllTokenCandidates, refreshToken, clearCachedToken, saveToken } from "../token-manager.js";

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
        let durationMs = Date.now() - start;

        // On 401, try all token candidates before falling back to login refresh
        if (res.status === 401) {
          log({
            type: "auth",
            severity: "warning",
            method: "token_retry",
            summary: `GraphQL ${operation}: 401 — trying all token candidates`,
            details: { operation },
            durationMs,
          });

          clearCachedToken();
          const candidates = await getAllTokenCandidates();

          // Try each candidate (skip the one that already failed)
          for (const candidate of candidates) {
            if (candidate === token) continue;
            res = await doFetch(query, variables, candidate);
            durationMs = Date.now() - start;
            if (res.status !== 401) {
              // This token works — promote it
              await saveToken(candidate);
              log({
                type: "auth",
                severity: "info",
                method: "token_retry",
                summary: `Token candidate succeeded for ${operation}`,
                durationMs,
              });
              token = candidate;
              break;
            }
          }

          // If still 401 after all candidates, do a full login refresh
          if (res.status === 401) {
            log({
              type: "auth",
              severity: "warning",
              method: "token_auto_refresh",
              summary: `All token candidates failed — attempting login refresh`,
              details: { operation, candidatesTried: candidates.length },
              durationMs,
            });

            try {
              token = await refreshToken();
            } catch (refreshErr: any) {
              log({
                type: "auth",
                severity: "critical",
                method: "token_auto_refresh",
                summary: `Token refresh failed: ${refreshErr.message}`,
                details: { operation, error: refreshErr.message },
                durationMs: Date.now() - start,
              });
              throw new Error(
                `Monarch token expired and auto-refresh failed: ${refreshErr.message}`
              );
            }

            res = await doFetch(query, variables, token);
            durationMs = Date.now() - start;

            if (res.status === 401) {
              log({
                type: "auth",
                severity: "critical",
                method: "token_auto_refresh",
                summary: "Retry after login refresh still returned 401",
                details: { operation },
                durationMs,
              });
              throw new Error(
                "All Monarch tokens rejected and fresh login also failed."
              );
            }

            log({
              type: "auth",
              severity: "info",
              method: "token_auto_refresh",
              summary: `Login refresh succeeded — retried ${operation}`,
              durationMs,
            });
          }
        }

        if (!res.ok) {
          log({
            type: "graphql",
            severity: "critical",
            method: operation,
            summary: `GraphQL ${operation}: ${res.status} ${res.statusText}`,
            details: { operation, variables, status: res.status },
            durationMs,
          });
          throw new Error(
            `Monarch API error: ${res.status} ${res.statusText}`
          );
        }

        const json: any = await res.json();

        if (json.errors?.length) {
          const errMsg = json.errors
            .map((e: any) => e.message)
            .join(", ");
          log({
            type: "graphql",
            severity: "critical",
            method: operation,
            summary: `GraphQL ${operation}: error — ${errMsg}`,
            details: { operation, variables, errors: json.errors },
            durationMs,
          });
          throw new Error(`GraphQL error: ${errMsg}`);
        }

        const responseSize = JSON.stringify(json.data).length;
        log({
          type: "graphql",
          severity: getSeverity(operation),
          method: operation,
          summary: `GraphQL ${operation}: OK (${responseSize} bytes, ${durationMs}ms)`,
          details: { operation, variables, responseSize },
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
            summary: `GraphQL ${operation}: ${err.message}`,
            details: { operation, variables, error: err.message },
            durationMs: Date.now() - start,
          });
        }
        throw err;
      }
    },
  };
}
