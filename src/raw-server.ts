import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DISABLED_METHODS } from "./config.js";
import { log, getSeverity } from "./logger.js";
import { truncateResponse } from "./truncate.js";
import type { MonarchAPI } from "./sdk/index.js";

function result(data: any) {
  return {
    content: [{ type: "text" as const, text: truncateResponse(data) }],
  };
}

function isEnabled(method: string): boolean {
  return !DISABLED_METHODS.has(method);
}

export function createRawServer(api: MonarchAPI): McpServer {
  const server = new McpServer({
    name: "monarch-mcp-raw",
    version: "1.0.0",
  });

  // ── accounts ──

  server.tool(
    "accounts_list",
    "List all financial accounts with balances, types, institutions, and sync status",
    {},
    async () => {
      const data = await api.accounts.list();
      return result(data);
    }
  );

  server.tool(
    "accounts_get",
    "Get detailed account info including recent transactions and balance snapshots",
    { id: z.string().describe("Account ID") },
    async ({ id }) => {
      const data = await api.accounts.get(id);
      return result(data);
    }
  );

  server.tool(
    "accounts_getTypeOptions",
    "Get available account types and subtypes for creating manual accounts",
    {},
    async () => {
      const data = await api.accounts.getTypeOptions();
      return result(data);
    }
  );

  server.tool(
    "accounts_getRecentBalances",
    "Get daily balance history for all accounts starting from a date (default: 31 days ago)",
    { startDate: z.string().optional().describe("Start date YYYY-MM-DD") },
    async ({ startDate }) => {
      const data = await api.accounts.getRecentBalances(startDate);
      return result(data);
    }
  );

  if (isEnabled("accounts.create")) {
    server.tool(
      "accounts_create",
      "Create a new manual account",
      {
        type: z.string().describe("Account type (e.g. other_asset, loan)"),
        subtype: z.string().describe("Account subtype (e.g. savings, checking)"),
        name: z.string().describe("Account name"),
        balance: z.number().optional().describe("Initial balance"),
        includeInNetWorth: z.boolean().optional().describe("Include in net worth calculation"),
      },
      async (input) => {
        const data = await api.accounts.create(input);
        return result(data);
      }
    );
  }

  if (isEnabled("accounts.refresh")) {
    server.tool(
      "accounts_refresh",
      "Request Monarch to refresh account balances and transactions from institutions",
      { accountIds: z.array(z.string()).optional().describe("Account IDs to refresh (all if omitted)") },
      async ({ accountIds }) => {
        const data = await api.accounts.refresh(accountIds);
        return result(data);
      }
    );
  }

  // ── transactions ──

  server.tool(
    "transactions_list",
    "List transactions with filters for date range, categories, accounts, tags, search text, and pagination",
    {
      limit: z.number().optional().describe("Max results (default 100)"),
      offset: z.number().optional().describe("Skip N results"),
      startDate: z.string().optional().describe("Start date YYYY-MM-DD"),
      endDate: z.string().optional().describe("End date YYYY-MM-DD"),
      search: z.string().optional().describe("Search text"),
      categoryIds: z.array(z.string()).optional().describe("Filter by category IDs"),
      accountIds: z.array(z.string()).optional().describe("Filter by account IDs"),
      tagIds: z.array(z.string()).optional().describe("Filter by tag IDs"),
      hasAttachments: z.boolean().optional(),
      hasNotes: z.boolean().optional(),
      hideFromReports: z.boolean().optional(),
      isSplit: z.boolean().optional(),
      isRecurring: z.boolean().optional(),
    },
    async (options) => {
      const data = await api.transactions.list(options);
      return result(data);
    }
  );

  server.tool(
    "transactions_get",
    "Get full details of a single transaction including splits, attachments, merchant info",
    { id: z.string().describe("Transaction ID") },
    async ({ id }) => {
      const data = await api.transactions.get(id);
      return result(data);
    }
  );

  server.tool(
    "transactions_getSummary",
    "Get aggregate summary stats (count, sum, avg, max, income, expense) for transactions",
    {
      startDate: z.string().optional().describe("Start date YYYY-MM-DD"),
      endDate: z.string().optional().describe("End date YYYY-MM-DD"),
      search: z.string().optional(),
      categoryIds: z.array(z.string()).optional(),
      accountIds: z.array(z.string()).optional(),
      tagIds: z.array(z.string()).optional(),
    },
    async (filters) => {
      const data = await api.transactions.getSummary(filters);
      return result(data);
    }
  );

  server.tool(
    "transactions_getSplits",
    "Get split transaction details for a transaction",
    { id: z.string().describe("Transaction ID") },
    async ({ id }) => {
      const data = await api.transactions.getSplits(id);
      return result(data);
    }
  );

  if (isEnabled("transactions.create")) {
    server.tool(
      "transactions_create",
      "Create a new manual transaction",
      {
        date: z.string().describe("Transaction date YYYY-MM-DD"),
        accountId: z.string().describe("Account ID"),
        amount: z.number().describe("Amount (negative for expenses)"),
        merchantName: z.string().describe("Merchant name"),
        categoryId: z.string().describe("Category ID"),
        notes: z.string().optional().describe("Transaction notes"),
        updateBalance: z.boolean().optional().describe("Update account balance"),
      },
      async (input) => {
        const data = await api.transactions.create(input);
        return result(data);
      }
    );
  }

  if (isEnabled("transactions.update")) {
    server.tool(
      "transactions_update",
      "Update an existing transaction (category, merchant, amount, date, notes, etc.)",
      {
        id: z.string().describe("Transaction ID"),
        categoryId: z.string().optional().describe("New category ID"),
        merchantName: z.string().optional().describe("New merchant name"),
        amount: z.number().optional().describe("New amount"),
        date: z.string().optional().describe("New date YYYY-MM-DD"),
        hideFromReports: z.boolean().optional(),
        needsReview: z.boolean().optional(),
        notes: z.string().optional().describe("New notes"),
        goalId: z.string().optional().describe("Goal ID"),
      },
      async ({ id, ...input }) => {
        const data = await api.transactions.update(id, input);
        return result(data);
      }
    );
  }

  if (isEnabled("transactions.split")) {
    server.tool(
      "transactions_split",
      "Split a transaction into multiple parts. Sum of split amounts must equal original.",
      {
        id: z.string().describe("Transaction ID to split"),
        splitData: z.array(z.object({
          merchantName: z.string().optional(),
          categoryId: z.string().optional(),
          amount: z.number().describe("Split amount"),
          notes: z.string().optional(),
        })).describe("Array of split parts"),
      },
      async ({ id, splitData }) => {
        const data = await api.transactions.split(id, splitData);
        return result(data);
      }
    );
  }

  // ── budgets ──

  server.tool(
    "budgets_get",
    "Get budget data with planned vs actual amounts by category, category group, and monthly totals",
    {
      startDate: z.string().describe("Start date YYYY-MM-DD"),
      endDate: z.string().describe("End date YYYY-MM-DD"),
    },
    async ({ startDate, endDate }) => {
      const data = await api.budgets.get(startDate, endDate);
      return result(data);
    }
  );

  if (isEnabled("budgets.updateItem")) {
    server.tool(
      "budgets_updateItem",
      "Set or update a budget amount for a category or category group",
      {
        amount: z.number().describe("Budget amount"),
        categoryId: z.string().optional().describe("Category ID"),
        categoryGroupId: z.string().optional().describe("Category group ID"),
        startDate: z.string().optional().describe("Start date YYYY-MM-DD"),
        timeframe: z.string().optional().describe("Timeframe (default: month)"),
        applyToFuture: z.boolean().optional().describe("Apply to future months"),
      },
      async (input) => {
        const data = await api.budgets.updateItem(input);
        return result(data);
      }
    );
  }

  // ── cashflow ──

  server.tool(
    "cashflow_get",
    "Get cash flow analysis: income vs expenses by category, category group, and merchant",
    {
      startDate: z.string().describe("Start date YYYY-MM-DD"),
      endDate: z.string().describe("End date YYYY-MM-DD"),
      search: z.string().optional(),
      categoryIds: z.array(z.string()).optional(),
      accountIds: z.array(z.string()).optional(),
      tagIds: z.array(z.string()).optional(),
    },
    async ({ startDate, endDate, ...filters }) => {
      const f = Object.keys(filters).length > 0 ? filters : undefined;
      const data = await api.cashflow.get(startDate, endDate, f);
      return result(data);
    }
  );

  // ── holdings ──

  server.tool(
    "holdings_get",
    "Get investment holdings for a brokerage account with security details and price changes",
    {
      accountId: z.string().describe("Account ID"),
      startDate: z.string().optional().describe("Start date YYYY-MM-DD"),
      endDate: z.string().optional().describe("End date YYYY-MM-DD"),
    },
    async ({ accountId, startDate, endDate }) => {
      const data = await api.holdings.get(accountId, startDate, endDate);
      return result(data);
    }
  );

  // ── categories ──

  server.tool(
    "categories_list",
    "List all transaction categories with their groups",
    {},
    async () => {
      const data = await api.categories.list();
      return result(data);
    }
  );

  server.tool(
    "categories_getGroups",
    "List all category groups (income, expense, transfer)",
    {},
    async () => {
      const data = await api.categories.getGroups();
      return result(data);
    }
  );

  if (isEnabled("categories.create")) {
    server.tool(
      "categories_create",
      "Create a new transaction category in a group",
      {
        groupId: z.string().describe("Category group ID"),
        name: z.string().describe("Category name"),
        icon: z.string().optional().describe("Icon (emoji or unicode)"),
        rolloverEnabled: z.boolean().optional(),
        rolloverType: z.string().optional(),
        rolloverStartMonth: z.string().optional(),
      },
      async (input) => {
        const data = await api.categories.create(input);
        return result(data);
      }
    );
  }

  // ── tags ──

  server.tool(
    "tags_list",
    "List all transaction tags, optionally filtered by search term",
    {
      search: z.string().optional().describe("Search filter"),
      limit: z.number().optional().describe("Max results"),
    },
    async ({ search, limit }) => {
      const data = await api.tags.list(search, limit);
      return result(data);
    }
  );

  if (isEnabled("tags.create")) {
    server.tool(
      "tags_create",
      "Create a new transaction tag with a name and hex color",
      {
        name: z.string().describe("Tag name"),
        color: z.string().optional().describe("Hex color (e.g. #FF5733)"),
      },
      async ({ name, color }) => {
        const data = await api.tags.create(name, color);
        return result(data);
      }
    );
  }

  if (isEnabled("tags.setOnTransaction")) {
    server.tool(
      "tags_setOnTransaction",
      "Set tags on a transaction (overwrites existing; empty array removes all)",
      {
        transactionId: z.string().describe("Transaction ID"),
        tagIds: z.array(z.string()).describe("Tag IDs to set"),
      },
      async ({ transactionId, tagIds }) => {
        const data = await api.tags.setOnTransaction(transactionId, tagIds);
        return result(data);
      }
    );
  }

  // ── recurring ──

  server.tool(
    "recurring_getUpcoming",
    "Get upcoming recurring transactions for a date range with merchant and frequency info",
    {
      startDate: z.string().describe("Start date YYYY-MM-DD"),
      endDate: z.string().describe("End date YYYY-MM-DD"),
    },
    async ({ startDate, endDate }) => {
      const data = await api.recurring.getUpcoming(startDate, endDate);
      return result(data);
    }
  );

  // ── snapshots ──

  server.tool(
    "snapshots_getByAccountType",
    "Get historical balance snapshots grouped by account type (monthly or yearly)",
    {
      startDate: z.string().describe("Start date YYYY-MM-DD"),
      timeframe: z.enum(["month", "year"]).describe("Granularity"),
    },
    async ({ startDate, timeframe }) => {
      const data = await api.snapshots.getByAccountType(startDate, timeframe);
      return result(data);
    }
  );

  server.tool(
    "snapshots_getAggregate",
    "Get daily aggregate net worth snapshots over time",
    {
      startDate: z.string().optional().describe("Start date YYYY-MM-DD"),
      endDate: z.string().optional().describe("End date YYYY-MM-DD"),
      accountType: z.string().optional().describe("Filter by account type"),
    },
    async (filters) => {
      const f = Object.keys(filters).length > 0 ? filters : undefined;
      const data = await api.snapshots.getAggregate(f);
      return result(data);
    }
  );

  // ── subscription ──

  server.tool(
    "subscription_get",
    "Get Monarch Money subscription details (plan, trial status, entitlements)",
    {},
    async () => {
      const data = await api.subscription.get();
      return result(data);
    }
  );

  // ── institutions ──

  server.tool(
    "institutions_getSettings",
    "Get institution/credential connection settings, sync status, and linked accounts",
    {},
    async () => {
      const data = await api.institutions.getSettings();
      return result(data);
    }
  );

  return server;
}
