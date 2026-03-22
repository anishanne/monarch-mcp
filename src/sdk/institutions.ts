import type { GraphQLClient } from "../graphql/client.js";
import { GET_INSTITUTION_SETTINGS } from "../graphql/queries.js";

export function createInstitutionsSDK(client: GraphQLClient) {
  return {
    async getSettings() {
      return client.query(GET_INSTITUTION_SETTINGS);
    },
  };
}
