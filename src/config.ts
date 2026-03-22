/**
 * Methods disabled by server configuration.
 * Disabled methods throw an error at runtime and are hidden from search results.
 * Format: "category.method" (e.g., "accounts.delete", "transactions.delete")
 */
export const DISABLED_METHODS: Set<string> = new Set([
  "accounts.update",
  "accounts.delete",
  "categories.delete",
  // transactions.delete is rerouted to deletion-request flow, not blocked
]);
