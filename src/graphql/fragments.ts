export const ACCOUNT_FIELDS = `
fragment AccountFields on Account {
  id
  displayName
  syncDisabled
  deactivatedAt
  isHidden
  isAsset
  mask
  createdAt
  updatedAt
  displayLastUpdatedAt
  currentBalance
  displayBalance
  includeInNetWorth
  hideFromList
  hideTransactionsFromReports
  includeBalanceInNetWorth
  includeInGoalBalance
  dataProvider
  dataProviderAccountId
  isManual
  transactionsCount
  holdingsCount
  manualInvestmentsTrackingMethod
  order
  logoUrl
  type {
    name
    display
    group
    __typename
  }
  subtype {
    name
    display
    __typename
  }
  credential {
    id
    updateRequired
    disconnectedFromDataProviderAt
    dataProvider
    institution {
      id
      plaidInstitutionId
      name
      status
      __typename
    }
    __typename
  }
  institution {
    id
    name
    primaryColor
    url
    __typename
  }
  __typename
}`;

export const TRANSACTION_OVERVIEW_FIELDS = `
fragment TransactionOverviewFields on Transaction {
  id
  amount
  pending
  date
  hideFromReports
  plaidName
  notes
  isRecurring
  reviewStatus
  needsReview
  dataProviderDescription
  attachments {
    id
    extension
    filename
    originalAssetUrl
    publicId
    sizeBytes
    __typename
  }
  isSplitTransaction
  createdAt
  updatedAt
  category {
    id
    name
    group {
      id
      type
      __typename
    }
    __typename
  }
  merchant {
    name
    id
    transactionsCount
    __typename
  }
  account {
    id
    displayName
    __typename
  }
  tags {
    id
    name
    color
    order
    __typename
  }
  __typename
}`;

export const PAYLOAD_ERROR_FIELDS = `
fragment PayloadErrorFields on PayloadError {
  fieldErrors {
    field
    messages
    __typename
  }
  message
  code
  __typename
}`;
