import type { GraphQLClient } from "../graphql/client.js";
import { GET_TRANSACTION_TAGS } from "../graphql/queries.js";
import {
  CREATE_TRANSACTION_TAG,
  SET_TRANSACTION_TAGS,
} from "../graphql/mutations.js";

export function createTagsSDK(client: GraphQLClient) {
  return {
    async list(search?: string, limit?: number) {
      return client.query(GET_TRANSACTION_TAGS, { search, limit });
    },

    async create(name: string, color?: string) {
      return client.query(CREATE_TRANSACTION_TAG, {
        input: { name, color: color ?? "#000000" },
      });
    },

    async setOnTransaction(transactionId: string, tagIds: string[]) {
      return client.query(SET_TRANSACTION_TAGS, {
        input: { transactionId, tagIds },
      });
    },
  };
}
