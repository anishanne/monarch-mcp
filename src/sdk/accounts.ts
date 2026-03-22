import type { GraphQLClient } from "../graphql/client.js";
import {
  GET_ACCOUNTS,
  GET_ACCOUNT_TYPE_OPTIONS,
  GET_ACCOUNT_RECENT_BALANCES,
  GET_ACCOUNT_DETAILS,
} from "../graphql/queries.js";
import {
  CREATE_MANUAL_ACCOUNT,
  UPDATE_ACCOUNT,
  DELETE_ACCOUNT,
  FORCE_REFRESH_ACCOUNTS,
} from "../graphql/mutations.js";

export function createAccountsSDK(client: GraphQLClient) {
  return {
    async list() {
      return client.query(GET_ACCOUNTS);
    },

    async get(id: string) {
      return client.query(GET_ACCOUNT_DETAILS, {
        id,
        filters: { accounts: [id] },
      });
    },

    async getTypeOptions() {
      return client.query(GET_ACCOUNT_TYPE_OPTIONS);
    },

    async getRecentBalances(startDate?: string) {
      const start =
        startDate ??
        new Date(Date.now() - 31 * 86400000).toISOString().split("T")[0];
      return client.query(GET_ACCOUNT_RECENT_BALANCES, { startDate: start });
    },

    async create(input: {
      type: string;
      subtype: string;
      name: string;
      balance?: number;
      includeInNetWorth?: boolean;
    }) {
      return client.query(CREATE_MANUAL_ACCOUNT, {
        input: {
          type: input.type,
          subtype: input.subtype,
          includeInNetWorth: input.includeInNetWorth ?? true,
          name: input.name,
          displayBalance: input.balance ?? 0,
        },
      });
    },

    async update(
      id: string,
      input: {
        name?: string;
        balance?: number;
        type?: string;
        subtype?: string;
        includeInNetWorth?: boolean;
        hideFromList?: boolean;
        hideTransactionsFromReports?: boolean;
      }
    ) {
      const vars: Record<string, any> = { id };
      if (input.name !== undefined) vars.name = input.name;
      if (input.balance !== undefined) vars.displayBalance = input.balance;
      if (input.type !== undefined) vars.type = input.type;
      if (input.subtype !== undefined) vars.subtype = input.subtype;
      if (input.includeInNetWorth !== undefined)
        vars.includeInNetWorth = input.includeInNetWorth;
      if (input.hideFromList !== undefined)
        vars.hideFromList = input.hideFromList;
      if (input.hideTransactionsFromReports !== undefined)
        vars.hideTransactionsFromReports = input.hideTransactionsFromReports;
      return client.query(UPDATE_ACCOUNT, { input: vars });
    },

    async delete(id: string) {
      return client.query(DELETE_ACCOUNT, { id });
    },

    async refresh(accountIds?: string[]) {
      return client.query(FORCE_REFRESH_ACCOUNTS, {
        input: { accountIds: accountIds ?? [] },
      });
    },
  };
}
