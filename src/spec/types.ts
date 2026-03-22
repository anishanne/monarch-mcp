export const TYPE_DEFINITIONS = `
interface Account {
  id: string;
  displayName: string;
  currentBalance: number;
  displayBalance: number;
  isAsset: boolean;
  isHidden: boolean;
  isManual: boolean;
  includeInNetWorth: boolean;
  syncDisabled: boolean;
  deactivatedAt: string | null;
  mask: string | null;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  transactionsCount: number;
  holdingsCount: number;
  dataProvider: string | null;
  type: { name: string; display: string };
  subtype: { name: string; display: string } | null;
  institution: { id: string; name: string; url: string | null; primaryColor: string | null } | null;
  credential: { id: string; updateRequired: boolean; dataProvider: string; institution: { id: string; name: string; status: string } | null } | null;
}

interface Transaction {
  id: string;
  amount: number;
  date: string;
  pending: boolean;
  notes: string | null;
  plaidName: string | null;
  isRecurring: boolean;
  isSplitTransaction: boolean;
  hideFromReports: boolean;
  needsReview: boolean;
  reviewStatus: string | null;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string } | null;
  merchant: { id: string; name: string; transactionsCount: number } | null;
  account: { id: string; displayName: string } | null;
  tags: Array<{ id: string; name: string; color: string; order: number }>;
  attachments: Array<{ id: string }>;
}

interface TransactionDetail extends Transaction {
  originalDate: string | null;
  hasSplitTransactions: boolean;
  isManual: boolean;
  splitTransactions: Array<{ id: string; amount: number; merchant: { id: string; name: string } | null; category: { id: string; name: string } | null }>;
  goal: { id: string } | null;
}

interface TransactionsSummary {
  avg: number;
  count: number;
  max: number;
  maxExpense: number;
  sum: number;
  sumIncome: number;
  sumExpense: number;
  first: string;
  last: string;
}

interface BudgetData {
  budgetData: {
    monthlyAmountsByCategory: Array<{
      category: { id: string };
      monthlyAmounts: BudgetMonthlyAmount[];
    }>;
    monthlyAmountsByCategoryGroup: Array<{
      categoryGroup: { id: string };
      monthlyAmounts: BudgetMonthlyAmount[];
    }>;
    totalsByMonth: Array<{
      month: string;
      totalIncome: BudgetTotals;
      totalExpenses: BudgetTotals;
      totalFixedExpenses: BudgetTotals;
      totalFlexibleExpenses: BudgetTotals;
    }>;
  };
  categoryGroups: CategoryGroup[];
  goalsV2: Array<{ id: string; name: string; completedAt: string | null }>;
}

interface BudgetMonthlyAmount {
  month: string;
  plannedCashFlowAmount: number;
  actualAmount: number;
  remainingAmount: number;
  previousMonthRolloverAmount: number;
  rolloverType: string | null;
}

interface BudgetTotals {
  plannedAmount: number;
  actualAmount: number;
  remainingAmount: number;
  previousMonthRolloverAmount: number;
}

interface Category {
  id: string;
  name: string;
  order: number;
  isSystemCategory: boolean;
  isDisabled: boolean;
  systemCategory: string | null;
  group: { id: string; name: string; type: string } | null;
}

interface CategoryGroup {
  id: string;
  name: string;
  order: number;
  type: string;
}

interface Tag {
  id: string;
  name: string;
  color: string;
  order: number;
  transactionCount: number;
}

interface Holding {
  id: string;
  quantity: number;
  basis: number;
  totalValue: number;
  securityPriceChangeDollars: number;
  securityPriceChangePercent: number;
  lastSyncedAt: string;
  holdings: Array<{ id: string; name: string; ticker: string | null; closingPrice: number }>;
  security: {
    id: string;
    name: string;
    ticker: string | null;
    type: string;
    currentPrice: number;
    closingPrice: number;
    oneDayChangePercent: number | null;
    oneDayChangeDollars: number | null;
  };
}

interface CashFlowData {
  byCategory: Array<{ groupBy: { category: { id: string; name: string; group: { id: string; type: string } } }; summary: { sum: number } }>;
  byCategoryGroup: Array<{ groupBy: { categoryGroup: { id: string; name: string; type: string } }; summary: { sum: number } }>;
  byMerchant: Array<{ groupBy: { merchant: { id: string; name: string; logoUrl: string | null } }; summary: { sumIncome: number; sumExpense: number } }>;
  summary: { summary: { sumIncome: number; sumExpense: number; savings: number; savingsRate: number } };
}

interface RecurringTransactionItem {
  date: string;
  isPast: boolean;
  transactionId: string | null;
  amount: number;
  amountDiff: number | null;
  stream: { id: string; frequency: string; amount: number; isApproximate: boolean; merchant: { id: string; name: string; logoUrl: string | null } };
  category: { id: string; name: string } | null;
  account: { id: string; displayName: string; logoUrl: string | null } | null;
}

interface Snapshot {
  date: string;
  balance: number;
}

interface SnapshotByType {
  accountType: string;
  month: string;
  balance: number;
}

interface Subscription {
  id: string;
  paymentSource: string;
  referralCode: string;
  isOnFreeTrial: boolean;
  hasPremiumEntitlement: boolean;
}
`;
