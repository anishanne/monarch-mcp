import { PAYLOAD_ERROR_FIELDS } from "./fragments.js";

export const CREATE_MANUAL_ACCOUNT = `
mutation Web_CreateManualAccount($input: CreateManualAccountMutationInput!) {
  createManualAccount(input: $input) {
    account {
      id
      __typename
    }
    errors {
      ...PayloadErrorFields
      __typename
    }
    __typename
  }
}
${PAYLOAD_ERROR_FIELDS}
`;

export const UPDATE_ACCOUNT = `
mutation Common_UpdateAccount($input: UpdateAccountMutationInput!) {
  updateAccount(input: $input) {
    account {
      id
      displayName
      currentBalance
      displayBalance
      includeInNetWorth
      hideFromList
      hideTransactionsFromReports
      type { name display __typename }
      subtype { name display __typename }
      __typename
    }
    errors {
      ...PayloadErrorFields
      __typename
    }
    __typename
  }
}
${PAYLOAD_ERROR_FIELDS}
`;

export const DELETE_ACCOUNT = `
mutation Common_DeleteAccount($id: UUID!) {
  deleteAccount(id: $id) {
    deleted
    errors {
      ...PayloadErrorFields
      __typename
    }
    __typename
  }
}
${PAYLOAD_ERROR_FIELDS}
`;

export const FORCE_REFRESH_ACCOUNTS = `
mutation Common_ForceRefreshAccountsMutation($input: ForceRefreshAccountsInput!) {
  forceRefreshAccounts(input: $input) {
    success
    errors {
      ...PayloadErrorFields
      __typename
    }
    __typename
  }
}
${PAYLOAD_ERROR_FIELDS}
`;

export const CREATE_TRANSACTION = `
mutation Common_CreateTransactionMutation($input: CreateTransactionMutationInput!) {
  createTransaction(input: $input) {
    errors {
      ...PayloadErrorFields
      __typename
    }
    transaction {
      id
      __typename
    }
    __typename
  }
}
${PAYLOAD_ERROR_FIELDS}
`;

export const DELETE_TRANSACTION = `
mutation Common_DeleteTransactionMutation($input: DeleteTransactionMutationInput!) {
  deleteTransaction(input: $input) {
    deleted
    errors {
      ...PayloadErrorFields
      __typename
    }
    __typename
  }
}
${PAYLOAD_ERROR_FIELDS}
`;

export const UPDATE_TRANSACTION = `
mutation Web_TransactionDrawerUpdateTransaction($input: UpdateTransactionMutationInput!) {
  updateTransaction(input: $input) {
    transaction {
      id
      amount
      pending
      date
      hideFromReports
      needsReview
      reviewedAt
      reviewedByUser {
        id
        name
        __typename
      }
      plaidName
      notes
      isRecurring
      category {
        id
        __typename
      }
      goal {
        id
        __typename
      }
      merchant {
        id
        name
        __typename
      }
      __typename
    }
    errors {
      ...PayloadErrorFields
      __typename
    }
    __typename
  }
}
${PAYLOAD_ERROR_FIELDS}
`;

export const SPLIT_TRANSACTION = `
mutation Common_SplitTransactionMutation($input: UpdateTransactionSplitMutationInput!) {
  updateTransactionSplit(input: $input) {
    errors {
      ...PayloadErrorFields
      __typename
    }
    transaction {
      id
      hasSplitTransactions
      splitTransactions {
        id
        merchant {
          id
          name
          __typename
        }
        category {
          id
          name
          __typename
        }
        amount
        notes
        __typename
      }
      __typename
    }
    __typename
  }
}
${PAYLOAD_ERROR_FIELDS}
`;

export const SET_TRANSACTION_TAGS = `
mutation Web_SetTransactionTags($input: SetTransactionTagsInput!) {
  setTransactionTags(input: $input) {
    errors {
      ...PayloadErrorFields
      __typename
    }
    transaction {
      id
      tags {
        id
        name
        color
        order
        __typename
      }
      __typename
    }
    __typename
  }
}
${PAYLOAD_ERROR_FIELDS}
`;

export const CREATE_TRANSACTION_TAG = `
mutation Common_CreateTransactionTag($input: CreateTransactionTagInput!) {
  createTransactionTag(input: $input) {
    tag {
      id
      name
      color
      order
      transactionCount
      __typename
    }
    errors {
      message
      __typename
    }
    __typename
  }
}
`;

export const CREATE_CATEGORY = `
mutation Web_CreateCategory($input: CreateCategoryInput!) {
  createCategory(input: $input) {
    errors {
      ...PayloadErrorFields
      __typename
    }
    category {
      id
      order
      name
      systemCategory
      systemCategoryDisplayName
      budgetVariability
      isSystemCategory
      isDisabled
      group {
        id
        type
        groupLevelBudgetingEnabled
        __typename
      }
      rolloverPeriod {
        id
        startMonth
        startingBalance
        __typename
      }
      __typename
    }
    __typename
  }
}
${PAYLOAD_ERROR_FIELDS}
`;

export const DELETE_CATEGORY = `
mutation Web_DeleteCategory($id: UUID!, $moveToCategoryId: UUID) {
  deleteCategory(id: $id, moveToCategoryId: $moveToCategoryId) {
    errors {
      ...PayloadErrorFields
      __typename
    }
    deleted
    __typename
  }
}
${PAYLOAD_ERROR_FIELDS}
`;

export const UPDATE_BUDGET_ITEM = `
mutation Common_UpdateBudgetItem($input: UpdateOrCreateBudgetItemMutationInput!) {
  updateOrCreateBudgetItem(input: $input) {
    budgetItem {
      id
      budgetAmount
      __typename
    }
    __typename
  }
}
`;
