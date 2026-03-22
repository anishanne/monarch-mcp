import type { GraphQLClient } from "../graphql/client.js";
import { DISABLED_METHODS } from "../config.js";
import { createAccountsSDK } from "./accounts.js";
import { createTransactionsSDK } from "./transactions.js";
import { createBudgetsSDK } from "./budgets.js";
import { createCashflowSDK } from "./cashflow.js";
import { createHoldingsSDK } from "./holdings.js";
import { createCategoriesSDK } from "./categories.js";
import { createTagsSDK } from "./tags.js";
import { createRecurringSDK } from "./recurring.js";
import { createSnapshotsSDK } from "./snapshots.js";
import { createSubscriptionSDK } from "./subscription.js";
import { createInstitutionsSDK } from "./institutions.js";

function applyConfig(api: Record<string, Record<string, any>>): void {
  for (const [category, methods] of Object.entries(api)) {
    for (const method of Object.keys(methods)) {
      if (DISABLED_METHODS.has(`${category}.${method}`)) {
        methods[method] = () => {
          throw new Error(
            `${category}.${method} is disabled by server configuration.`
          );
        };
      }
    }
  }
}

export function createAPI(client: GraphQLClient) {
  const api = {
    accounts: createAccountsSDK(client),
    transactions: createTransactionsSDK(client),
    budgets: createBudgetsSDK(client),
    cashflow: createCashflowSDK(client),
    holdings: createHoldingsSDK(client),
    categories: createCategoriesSDK(client),
    tags: createTagsSDK(client),
    recurring: createRecurringSDK(client),
    snapshots: createSnapshotsSDK(client),
    subscription: createSubscriptionSDK(client),
    institutions: createInstitutionsSDK(client),
  };
  applyConfig(api as any);
  return api;
}

export type MonarchAPI = ReturnType<typeof createAPI>;
