import type { GraphQLClient } from "../graphql/client.js";
import { GET_HOLDINGS } from "../graphql/queries.js";

export function createHoldingsSDK(client: GraphQLClient) {
  return {
    async get(accountId: string, startDate?: string, endDate?: string) {
      const today = new Date().toISOString().split("T")[0];
      return client.query(GET_HOLDINGS, {
        input: {
          accountIds: [accountId],
          startDate: startDate ?? today,
          endDate: endDate ?? today,
          includeHiddenHoldings: true,
        },
      });
    },
  };
}
