const GRAPHQL_ENDPOINT = "https://api.monarch.com/graphql";

export interface GraphQLClient {
  query<T = any>(query: string, variables?: Record<string, any>): Promise<T>;
}

export function createGraphQLClient(token: string): GraphQLClient {
  return {
    async query<T = any>(
      query: string,
      variables?: Record<string, any>
    ): Promise<T> {
      const res = await fetch(GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Token ${token}`,
          "Content-Type": "application/json",
          "Client-Platform": "web",
        },
        body: JSON.stringify({ query, variables }),
      });

      if (res.status === 401) {
        throw new Error(
          "Monarch Money token is invalid or expired. Re-run the get-token script to obtain a new token."
        );
      }

      if (!res.ok) {
        throw new Error(`Monarch API error: ${res.status} ${res.statusText}`);
      }

      const json: any = await res.json();

      if (json.errors?.length) {
        throw new Error(
          `GraphQL error: ${json.errors.map((e: any) => e.message).join(", ")}`
        );
      }

      return json.data as T;
    },
  };
}
