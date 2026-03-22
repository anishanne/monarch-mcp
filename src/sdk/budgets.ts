import type { GraphQLClient } from "../graphql/client.js";
import { GET_BUDGETS } from "../graphql/queries.js";
import { UPDATE_BUDGET_ITEM } from "../graphql/mutations.js";

export function createBudgetsSDK(client: GraphQLClient) {
  return {
    async get(startDate: string, endDate: string) {
      return client.query(GET_BUDGETS, {
        startDate,
        endDate,
        useLegacyGoals: false,
        useV2Goals: true,
      });
    },

    async updateItem(input: {
      amount: number;
      categoryId?: string;
      categoryGroupId?: string;
      startDate?: string;
      timeframe?: string;
      applyToFuture?: boolean;
    }) {
      const today = new Date();
      return client.query(UPDATE_BUDGET_ITEM, {
        input: {
          startDate:
            input.startDate ??
            `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`,
          timeframe: input.timeframe ?? "month",
          categoryId: input.categoryId ?? null,
          categoryGroupId: input.categoryGroupId ?? null,
          amount: input.amount,
          applyToFuture: input.applyToFuture ?? false,
        },
      });
    },
  };
}
