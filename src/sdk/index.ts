import type { GraphQLClient } from "../graphql/client.js";
import { DISABLED_METHODS } from "../config.js";
import { log, getSeverity } from "../logger.js";
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

function wrapWithLogging(
  api: Record<string, Record<string, any>>
): void {
  for (const [category, methods] of Object.entries(api)) {
    for (const [method, fn] of Object.entries(methods)) {
      const fullName = `${category}.${method}`;

      if (DISABLED_METHODS.has(fullName)) {
        methods[method] = (...args: any[]) => {
          log({
            type: "disabled",
            severity: "critical",
            method: fullName,
            summary: `BLOCKED: ${fullName} is disabled by server configuration`,
            details: { args: summarizeArgs(args) },
          });
          throw new Error(
            `${fullName} is disabled by server configuration.`
          );
        };
        continue;
      }

      methods[method] = async (...args: any[]) => {
        const start = Date.now();
        try {
          const result = await fn(...args);
          const durationMs = Date.now() - start;
          log({
            type: "sdk_call",
            severity: getSeverity(fullName),
            method: fullName,
            summary: `${fullName}: OK (${durationMs}ms)`,
            details: { args: summarizeArgs(args) },
            durationMs,
          });
          return result;
        } catch (err: any) {
          const durationMs = Date.now() - start;
          log({
            type: "error",
            severity: "critical",
            method: fullName,
            summary: `${fullName}: ERROR — ${err.message}`,
            details: { args: summarizeArgs(args), error: err.message },
            durationMs,
          });
          throw err;
        }
      };
    }
  }
}

function summarizeArgs(args: any[]): any[] {
  return args.map((arg) => {
    if (arg === undefined || arg === null) return arg;
    if (typeof arg === "string" || typeof arg === "number" || typeof arg === "boolean") return arg;
    try {
      const str = JSON.stringify(arg);
      return str.length > 500 ? str.slice(0, 500) + "..." : JSON.parse(str);
    } catch {
      return String(arg);
    }
  });
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
  wrapWithLogging(api as any);
  return api;
}

export type MonarchAPI = ReturnType<typeof createAPI>;
