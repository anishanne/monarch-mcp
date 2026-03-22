import type { GraphQLClient } from "../graphql/client.js";
import { GET_RECURRING_TRANSACTIONS } from "../graphql/queries.js";

export function createRecurringSDK(client: GraphQLClient) {
  return {
    async getUpcoming(startDate: string, endDate: string) {
      return client.query(GET_RECURRING_TRANSACTIONS, {
        startDate,
        endDate,
      });
    },
  };
}
