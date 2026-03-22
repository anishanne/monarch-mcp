import type { GraphQLClient } from "../graphql/client.js";
import { GET_SUBSCRIPTION } from "../graphql/queries.js";

export function createSubscriptionSDK(client: GraphQLClient) {
  return {
    async get() {
      return client.query(GET_SUBSCRIPTION);
    },
  };
}
