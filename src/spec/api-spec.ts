export interface MethodSpec {
  name: string;
  category: string;
  description: string;
  parameters: string;
  returns: string;
  example: string;
}

export const API_SPEC: MethodSpec[] = [
  // ── accounts ──
  {
    name: "api.accounts.list",
    category: "accounts",
    description: "List all financial accounts with balances, types, institutions, and sync status",
    parameters: "()",
    returns: "{ accounts: Account[], householdPreferences: { accountGroupOrder: string[] } }",
    example: "const data = await api.accounts.list(); return data.accounts;",
  },
  {
    name: "api.accounts.get",
    category: "accounts",
    description: "Get detailed account info including recent transactions and balance snapshots",
    parameters: "(id: string)",
    returns: "{ account: Account, transactions: { totalCount: number, results: Transaction[] }, snapshots: { date: string, signedBalance: number }[] }",
    example: 'const data = await api.accounts.get("account-uuid"); return data;',
  },
  {
    name: "api.accounts.getTypeOptions",
    category: "accounts",
    description: "Get available account types and subtypes for creating manual accounts",
    parameters: "()",
    returns: "{ accountTypeOptions: { type: { name, display, group, possibleSubtypes }, subtype }[] }",
    example: "const data = await api.accounts.getTypeOptions(); return data;",
  },
  {
    name: "api.accounts.getRecentBalances",
    category: "accounts",
    description: "Get daily balance history for all accounts starting from a date (default: 31 days ago)",
    parameters: "(startDate?: string)",
    returns: "{ accounts: { id: string, recentBalances: number[] }[] }",
    example: 'const data = await api.accounts.getRecentBalances("2024-01-01"); return data;',
  },
  {
    name: "api.accounts.create",
    category: "accounts",
    description: "Create a new manual account",
    parameters: "(input: { type: string, subtype: string, name: string, balance?: number, includeInNetWorth?: boolean })",
    returns: "{ createManualAccount: { account: { id: string } } }",
    example: 'const data = await api.accounts.create({ type: "other_asset", subtype: "savings", name: "My Savings", balance: 1000 }); return data;',
  },
  {
    name: "api.accounts.update",
    category: "accounts",
    description: "Update account details (name, balance, type, visibility, etc.)",
    parameters: "(id: string, input: { name?, balance?, type?, subtype?, includeInNetWorth?, hideFromList?, hideTransactionsFromReports? })",
    returns: "{ updateAccount: { account: Account } }",
    example: 'const data = await api.accounts.update("account-uuid", { name: "Renamed Account" }); return data;',
  },
  {
    name: "api.accounts.delete",
    category: "accounts",
    description: "Delete an account",
    parameters: "(id: string)",
    returns: "{ deleteAccount: { deleted: boolean } }",
    example: 'const data = await api.accounts.delete("account-uuid"); return data;',
  },
  {
    name: "api.accounts.refresh",
    category: "accounts",
    description: "Request Monarch to refresh account balances and transactions from institutions",
    parameters: "(accountIds?: string[])",
    returns: "{ forceRefreshAccounts: { success: boolean } }",
    example: "const data = await api.accounts.refresh(); return data;",
  },

  // ── transactions ──
  {
    name: "api.transactions.list",
    category: "transactions",
    description: "List transactions with filters for date range, categories, accounts, tags, search text, and pagination",
    parameters: "(options?: { limit?: number, offset?: number, startDate?: string, endDate?: string, search?: string, categoryIds?: string[], accountIds?: string[], tagIds?: string[], hasAttachments?: boolean, hasNotes?: boolean, hideFromReports?: boolean, isSplit?: boolean, isRecurring?: boolean })",
    returns: "{ allTransactions: { totalCount: number, results: Transaction[] } }",
    example: 'const data = await api.transactions.list({ startDate: "2024-01-01", endDate: "2024-01-31", limit: 50 }); return data.allTransactions;',
  },
  {
    name: "api.transactions.get",
    category: "transactions",
    description: "Get full details of a single transaction including splits, attachments, merchant info",
    parameters: "(id: string)",
    returns: "{ getTransaction: TransactionDetail, myHousehold: { users: { id, name }[] } }",
    example: 'const data = await api.transactions.get("txn-uuid"); return data.getTransaction;',
  },
  {
    name: "api.transactions.getSummary",
    category: "transactions",
    description: "Get aggregate summary stats (count, sum, avg, max, income, expense) for transactions matching filters",
    parameters: "(filters?: { startDate?, endDate?, search?, categoryIds?, accountIds?, tagIds? })",
    returns: "{ aggregates: { summary: TransactionsSummary } }",
    example: 'const data = await api.transactions.getSummary({ startDate: "2024-01-01", endDate: "2024-12-31" }); return data.aggregates.summary;',
  },
  {
    name: "api.transactions.getSplits",
    category: "transactions",
    description: "Get split transaction details for a transaction",
    parameters: "(id: string)",
    returns: "{ getTransaction: { id, amount, category, merchant, splitTransactions: { id, amount, merchant, category, notes }[] } }",
    example: 'const data = await api.transactions.getSplits("txn-uuid"); return data.getTransaction.splitTransactions;',
  },
  {
    name: "api.transactions.create",
    category: "transactions",
    description: "Create a new manual transaction",
    parameters: "(input: { date: string, accountId: string, amount: number, merchantName: string, categoryId: string, notes?: string, updateBalance?: boolean })",
    returns: "{ createTransaction: { transaction: { id: string } } }",
    example: 'const data = await api.transactions.create({ date: "2024-03-15", accountId: "acct-uuid", amount: -29.99, merchantName: "Coffee Shop", categoryId: "cat-uuid" }); return data;',
  },
  {
    name: "api.transactions.update",
    category: "transactions",
    description: "Update an existing transaction (category, merchant name, amount, date, notes, etc.)",
    parameters: "(id: string, input: { categoryId?, merchantName?, amount?, date?, hideFromReports?, needsReview?, notes?, goalId? })",
    returns: "{ updateTransaction: { transaction: Transaction } }",
    example: 'const data = await api.transactions.update("txn-uuid", { notes: "Updated note", categoryId: "new-cat-uuid" }); return data;',
  },
  {
    name: "api.transactions.delete",
    category: "transactions",
    description: "Request transaction deletion (requires admin approval). Hides the transaction immediately and submits a deletion request.",
    parameters: "(id: string)",
    returns: "{ deleteTransaction: { deleted: boolean, pendingApproval: boolean, message: string } }",
    example: 'const data = await api.transactions.delete("txn-uuid"); return data;',
  },
  {
    name: "api.transactions.split",
    category: "transactions",
    description: "Split a transaction into multiple parts. Sum of split amounts must equal original amount.",
    parameters: "(id: string, splitData: Array<{ merchantName?: string, categoryId?: string, amount: number, notes?: string }>)",
    returns: "{ updateTransactionSplit: { transaction: { splitTransactions: [...] } } }",
    example: 'const data = await api.transactions.split("txn-uuid", [{ amount: -15, categoryId: "cat1" }, { amount: -10, categoryId: "cat2" }]); return data;',
  },

  // ── budgets ──
  {
    name: "api.budgets.get",
    category: "budgets",
    description: "Get budget data including planned vs actual amounts by category, category group, and monthly totals",
    parameters: "(startDate: string, endDate: string)",
    returns: "BudgetData (budgetData, categoryGroups, goalsV2)",
    example: 'const data = await api.budgets.get("2024-01-01", "2024-03-31"); return data;',
  },
  {
    name: "api.budgets.updateItem",
    category: "budgets",
    description: "Set or update a budget amount for a category or category group",
    parameters: "(input: { amount: number, categoryId?: string, categoryGroupId?: string, startDate?: string, timeframe?: string, applyToFuture?: boolean })",
    returns: "{ updateOrCreateBudgetItem: { budgetItem: { id, budgetAmount } } }",
    example: 'const data = await api.budgets.updateItem({ amount: 500, categoryId: "cat-uuid", applyToFuture: true }); return data;',
  },

  // ── cashflow ──
  {
    name: "api.cashflow.get",
    category: "cashflow",
    description: "Get cash flow analysis: income vs expenses broken down by category, category group, and merchant",
    parameters: "(startDate: string, endDate: string, filters?: { search?, categoryIds?, accountIds?, tagIds? })",
    returns: "CashFlowData (byCategory, byCategoryGroup, byMerchant, summary with sumIncome/sumExpense/savings/savingsRate)",
    example: 'const data = await api.cashflow.get("2024-01-01", "2024-03-31"); return data.summary;',
  },

  // ── holdings ──
  {
    name: "api.holdings.get",
    category: "holdings",
    description: "Get investment holdings for a brokerage account with security details and price changes",
    parameters: "(accountId: string, startDate?: string, endDate?: string)",
    returns: "{ portfolio: { aggregateHoldings: { edges: { node: Holding }[] } } }",
    example: 'const data = await api.holdings.get("acct-uuid"); return data.portfolio.aggregateHoldings.edges.map(e => e.node);',
  },

  // ── categories ──
  {
    name: "api.categories.list",
    category: "categories",
    description: "List all transaction categories with their groups",
    parameters: "()",
    returns: "{ categories: Category[] }",
    example: "const data = await api.categories.list(); return data.categories;",
  },
  {
    name: "api.categories.getGroups",
    category: "categories",
    description: "List all category groups (income, expense, transfer)",
    parameters: "()",
    returns: "{ categoryGroups: CategoryGroup[] }",
    example: "const data = await api.categories.getGroups(); return data.categoryGroups;",
  },
  {
    name: "api.categories.create",
    category: "categories",
    description: "Create a new transaction category in a group",
    parameters: "(input: { groupId: string, name: string, icon?: string, rolloverEnabled?: boolean, rolloverType?: string, rolloverStartMonth?: string })",
    returns: "{ createCategory: { category: Category } }",
    example: 'const data = await api.categories.create({ groupId: "group-uuid", name: "Subscriptions" }); return data;',
  },
  {
    name: "api.categories.delete",
    category: "categories",
    description: "Delete a category, optionally moving transactions to another category",
    parameters: "(id: string, moveToCategoryId?: string)",
    returns: "{ deleteCategory: { deleted: boolean } }",
    example: 'const data = await api.categories.delete("cat-uuid"); return data;',
  },

  // ── tags ──
  {
    name: "api.tags.list",
    category: "tags",
    description: "List all transaction tags, optionally filtered by search term",
    parameters: "(search?: string, limit?: number)",
    returns: "{ householdTransactionTags: Tag[] }",
    example: "const data = await api.tags.list(); return data.householdTransactionTags;",
  },
  {
    name: "api.tags.create",
    category: "tags",
    description: "Create a new transaction tag with a name and hex color",
    parameters: '(name: string, color?: string)',
    returns: "{ createTransactionTag: { tag: Tag } }",
    example: 'const data = await api.tags.create("Important", "#FF5733"); return data;',
  },
  {
    name: "api.tags.setOnTransaction",
    category: "tags",
    description: "Set tags on a transaction (overwrites existing tags; empty array removes all)",
    parameters: "(transactionId: string, tagIds: string[])",
    returns: "{ setTransactionTags: { transaction: { id, tags } } }",
    example: 'const data = await api.tags.setOnTransaction("txn-uuid", ["tag-uuid-1", "tag-uuid-2"]); return data;',
  },

  // ── recurring ──
  {
    name: "api.recurring.getUpcoming",
    category: "recurring",
    description: "Get upcoming recurring transactions for a date range with merchant and frequency info",
    parameters: "(startDate: string, endDate: string)",
    returns: "{ recurringTransactionItems: RecurringTransactionItem[] }",
    example: 'const data = await api.recurring.getUpcoming("2024-03-01", "2024-03-31"); return data.recurringTransactionItems;',
  },

  // ── snapshots ──
  {
    name: "api.snapshots.getByAccountType",
    category: "snapshots",
    description: "Get historical balance snapshots grouped by account type (monthly or yearly granularity)",
    parameters: '(startDate: string, timeframe: "month" | "year")',
    returns: "{ snapshotsByAccountType: SnapshotByType[], accountTypes: { name, group }[] }",
    example: 'const data = await api.snapshots.getByAccountType("2023-01-01", "month"); return data.snapshotsByAccountType;',
  },
  {
    name: "api.snapshots.getAggregate",
    category: "snapshots",
    description: "Get daily aggregate net worth snapshots over time (for net worth chart)",
    parameters: "(filters?: { startDate?: string, endDate?: string, accountType?: string })",
    returns: "{ aggregateSnapshots: Snapshot[] }",
    example: 'const data = await api.snapshots.getAggregate({ startDate: "2024-01-01" }); return data.aggregateSnapshots;',
  },

  // ── subscription ──
  {
    name: "api.subscription.get",
    category: "subscription",
    description: "Get Monarch Money subscription details (plan, trial status, entitlements)",
    parameters: "()",
    returns: "{ subscription: Subscription }",
    example: "const data = await api.subscription.get(); return data.subscription;",
  },

  // ── institutions ──
  {
    name: "api.institutions.getSettings",
    category: "institutions",
    description: "Get institution/credential connection settings, sync status, and linked accounts",
    parameters: "()",
    returns: "{ credentials: Credential[], accounts: Account[], subscription: { isOnFreeTrial, hasPremiumEntitlement } }",
    example: "const data = await api.institutions.getSettings(); return data;",
  },
];

import { DISABLED_METHODS } from "../config.js";

export function searchSpec(query: string): MethodSpec[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return API_SPEC.filter((method) => {
    if (DISABLED_METHODS.has(method.name.replace("api.", ""))) return false;
    const searchable =
      `${method.name} ${method.category} ${method.description} ${method.parameters} ${method.returns}`.toLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
}

export function getEnabledSpec(): MethodSpec[] {
  return API_SPEC.filter(
    (m) => !DISABLED_METHODS.has(m.name.replace("api.", ""))
  );
}
