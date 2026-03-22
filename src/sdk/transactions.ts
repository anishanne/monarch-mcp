import type { GraphQLClient } from "../graphql/client.js";
import {
  GET_TRANSACTIONS_LIST,
  GET_TRANSACTION_DETAILS,
  GET_TRANSACTIONS_SUMMARY,
  GET_TRANSACTION_SPLITS,
} from "../graphql/queries.js";
import {
  CREATE_TRANSACTION,
  DELETE_TRANSACTION,
  UPDATE_TRANSACTION,
  SPLIT_TRANSACTION,
} from "../graphql/mutations.js";

export function createTransactionsSDK(client: GraphQLClient) {
  return {
    async list(options?: {
      limit?: number;
      offset?: number;
      startDate?: string;
      endDate?: string;
      search?: string;
      categoryIds?: string[];
      accountIds?: string[];
      tagIds?: string[];
      hasAttachments?: boolean;
      hasNotes?: boolean;
      hideFromReports?: boolean;
      isSplit?: boolean;
      isRecurring?: boolean;
    }) {
      const filters: Record<string, any> = {
        search: options?.search ?? "",
        categories: options?.categoryIds ?? [],
        accounts: options?.accountIds ?? [],
        tags: options?.tagIds ?? [],
      };
      if (options?.startDate) filters.startDate = options.startDate;
      if (options?.endDate) filters.endDate = options.endDate;
      if (options?.hasAttachments !== undefined)
        filters.hasAttachments = options.hasAttachments;
      if (options?.hasNotes !== undefined) filters.hasNotes = options.hasNotes;
      if (options?.hideFromReports !== undefined)
        filters.hideFromReports = options.hideFromReports;
      if (options?.isSplit !== undefined) filters.isSplit = options.isSplit;
      if (options?.isRecurring !== undefined)
        filters.isRecurring = options.isRecurring;

      return client.query(GET_TRANSACTIONS_LIST, {
        offset: options?.offset ?? 0,
        limit: options?.limit ?? 100,
        orderBy: "date",
        filters,
      });
    },

    async get(id: string) {
      return client.query(GET_TRANSACTION_DETAILS, {
        id,
        redirectPosted: true,
      });
    },

    async getSummary(filters?: {
      startDate?: string;
      endDate?: string;
      search?: string;
      categoryIds?: string[];
      accountIds?: string[];
      tagIds?: string[];
    }) {
      const f: Record<string, any> = {};
      if (filters?.startDate) f.startDate = filters.startDate;
      if (filters?.endDate) f.endDate = filters.endDate;
      if (filters?.search) f.search = filters.search;
      if (filters?.categoryIds) f.categories = filters.categoryIds;
      if (filters?.accountIds) f.accounts = filters.accountIds;
      if (filters?.tagIds) f.tags = filters.tagIds;
      return client.query(GET_TRANSACTIONS_SUMMARY, {
        filters: Object.keys(f).length > 0 ? f : undefined,
      });
    },

    async getSplits(id: string) {
      return client.query(GET_TRANSACTION_SPLITS, { id });
    },

    async create(input: {
      date: string;
      accountId: string;
      amount: number;
      merchantName: string;
      categoryId: string;
      notes?: string;
      updateBalance?: boolean;
    }) {
      return client.query(CREATE_TRANSACTION, {
        input: {
          date: input.date,
          accountId: input.accountId,
          amount: Math.round(input.amount * 100) / 100,
          merchantName: input.merchantName,
          categoryId: input.categoryId,
          notes: input.notes ?? "",
          shouldUpdateBalance: input.updateBalance ?? false,
        },
      });
    },

    async update(
      id: string,
      input: {
        categoryId?: string;
        merchantName?: string;
        amount?: number;
        date?: string;
        hideFromReports?: boolean;
        needsReview?: boolean;
        notes?: string;
        goalId?: string;
      }
    ) {
      const vars: Record<string, any> = { id };
      if (input.categoryId !== undefined) vars.category = input.categoryId;
      if (input.merchantName !== undefined) vars.name = input.merchantName;
      if (input.amount) vars.amount = input.amount;
      if (input.date) vars.date = input.date;
      if (input.hideFromReports !== undefined)
        vars.hideFromReports = input.hideFromReports;
      if (input.needsReview !== undefined)
        vars.needsReview = input.needsReview;
      if (input.notes !== undefined) vars.notes = input.notes;
      if (input.goalId !== undefined) vars.goalId = input.goalId;
      return client.query(UPDATE_TRANSACTION, { input: vars });
    },

    async delete(id: string) {
      return client.query(DELETE_TRANSACTION, {
        input: { transactionId: id },
      });
    },

    async split(
      id: string,
      splitData: Array<{
        merchantName?: string;
        categoryId?: string;
        amount: number;
        notes?: string;
      }>
    ) {
      return client.query(SPLIT_TRANSACTION, {
        input: { transactionId: id, splitData },
      });
    },
  };
}
