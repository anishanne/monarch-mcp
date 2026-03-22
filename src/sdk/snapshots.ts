import type { GraphQLClient } from "../graphql/client.js";
import {
  GET_SNAPSHOTS_BY_ACCOUNT_TYPE,
  GET_AGGREGATE_SNAPSHOTS,
} from "../graphql/queries.js";

export function createSnapshotsSDK(client: GraphQLClient) {
  return {
    async getByAccountType(startDate: string, timeframe: "month" | "year") {
      return client.query(GET_SNAPSHOTS_BY_ACCOUNT_TYPE, {
        startDate,
        timeframe,
      });
    },

    async getAggregate(filters?: {
      startDate?: string;
      endDate?: string;
      accountType?: string;
    }) {
      return client.query(GET_AGGREGATE_SNAPSHOTS, {
        filters: filters ?? {},
      });
    },
  };
}
