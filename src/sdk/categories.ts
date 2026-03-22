import type { GraphQLClient } from "../graphql/client.js";
import { GET_CATEGORIES, GET_CATEGORY_GROUPS } from "../graphql/queries.js";
import { CREATE_CATEGORY, DELETE_CATEGORY } from "../graphql/mutations.js";

export function createCategoriesSDK(client: GraphQLClient) {
  return {
    async list() {
      return client.query(GET_CATEGORIES);
    },

    async getGroups() {
      return client.query(GET_CATEGORY_GROUPS);
    },

    async create(input: {
      groupId: string;
      name: string;
      icon?: string;
      rolloverEnabled?: boolean;
      rolloverType?: string;
      rolloverStartMonth?: string;
    }) {
      const today = new Date();
      return client.query(CREATE_CATEGORY, {
        input: {
          group: input.groupId,
          name: input.name,
          icon: input.icon ?? "\u2753",
          rolloverEnabled: input.rolloverEnabled ?? false,
          rolloverType: input.rolloverType ?? "monthly",
          rolloverStartMonth:
            input.rolloverStartMonth ??
            `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`,
        },
      });
    },

    async delete(id: string, moveToCategoryId?: string) {
      return client.query(DELETE_CATEGORY, { id, moveToCategoryId });
    },
  };
}
