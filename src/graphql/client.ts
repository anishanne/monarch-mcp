import { log, getSeverity } from "../logger.js";

const GRAPHQL_ENDPOINT = "https://api.monarch.com/graphql";

export interface GraphQLClient {
  query<T = any>(query: string, variables?: Record<string, any>): Promise<T>;
}

function extractOperationName(query: string): string {
  const match = query.match(/(?:query|mutation)\s+(\w+)/);
  return match?.[1] ?? "unknown";
}

export function createGraphQLClient(token: string): GraphQLClient {
  return {
    async query<T = any>(
      query: string,
      variables?: Record<string, any>
    ): Promise<T> {
      const operation = extractOperationName(query);
      const start = Date.now();

      try {
        const res = await fetch(GRAPHQL_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Token ${token}`,
            "Content-Type": "application/json",
            "Client-Platform": "web",
          },
          body: JSON.stringify({ query, variables }),
        });

        const durationMs = Date.now() - start;

        if (res.status === 401) {
          log({
            type: "graphql",
            severity: "critical",
            method: operation,
            summary: `GraphQL ${operation}: 401 Unauthorized`,
            details: { operation, variables, status: 401 },
            durationMs,
          });
          throw new Error(
            "Monarch Money token is invalid or expired. Re-run the get-token script to obtain a new token."
          );
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
        if (!err.message?.includes("GraphQL") && !err.message?.includes("Monarch")) {
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
