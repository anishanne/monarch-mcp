import type { GraphQLClient } from "../graphql/client.js";
import { GET_CASHFLOW } from "../graphql/queries.js";

export function createCashflowSDK(client: GraphQLClient) {
  return {
    async get(
      startDate: string,
      endDate: string,
      filters?: {
        search?: string;
        categoryIds?: string[];
        accountIds?: string[];
        tagIds?: string[];
      }
    ) {
      return client.query(GET_CASHFLOW, {
        filters: {
          startDate,
          endDate,
          search: filters?.search ?? "",
          categories: filters?.categoryIds ?? [],
          accounts: filters?.accountIds ?? [],
          tags: filters?.tagIds ?? [],
        },
      });
    },
  };
}
