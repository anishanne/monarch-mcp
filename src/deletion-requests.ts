import { ObjectId } from "mongodb";
import { ensureCollection } from "./db.js";
import { log } from "./logger.js";
import { createGraphQLClient } from "./graphql/client.js";
import { DELETE_TRANSACTION } from "./graphql/mutations.js";
import { GET_TRANSACTION_DETAILS } from "./graphql/queries.js";
import { UPDATE_TRANSACTION } from "./graphql/mutations.js";

export interface DeletionRequest {
  _id?: ObjectId;
  transactionId: string;
  status: "pending" | "approved" | "denied";
  transactionSnapshot: any;
  reason?: string;
  requestedAt: Date;
  resolvedAt?: Date;
}

async function col() {
  return ensureCollection<DeletionRequest>("deletion_requests");
}

/**
 * Request a transaction deletion. Hides it from reports and marks it
 * needs-review, then stores a deletion request for admin approval.
 */
export async function requestDeletion(
  transactionId: string,
  reason?: string
): Promise<DeletionRequest> {
  const client = createGraphQLClient();

  // Fetch transaction details for the snapshot
  let snapshot: any = null;
  try {
    const data = await client.query(GET_TRANSACTION_DETAILS, {
      id: transactionId,
      redirectPosted: true,
    });
    snapshot = data.getTransaction;
  } catch {
    snapshot = { id: transactionId, error: "Could not fetch details" };
  }

  // Hide the transaction as much as possible
  try {
    await client.query(UPDATE_TRANSACTION, {
      input: {
        id: transactionId,
        hideFromReports: true,
        needsReview: true,
        notes: `[PENDING DELETION] ${reason ?? "Deletion requested via MCP"}`,
      },
    });
  } catch (err: any) {
    log({
      type: "error",
      severity: "critical",
      method: "deletion_request",
      summary: `Failed to hide transaction ${transactionId}: ${err.message}`,
    });
  }

  const request: DeletionRequest = {
    transactionId,
    status: "pending",
    transactionSnapshot: snapshot,
    reason,
    requestedAt: new Date(),
  };

  const collection = await col();
  if (collection) {
    await collection.insertOne(request);
  }

  log({
    type: "sdk_call",
    severity: "warning",
    method: "transactions.deleteRequest",
    summary: `Deletion requested for transaction ${transactionId} — pending admin approval`,
    details: {
      transactionId,
      reason,
      merchant: snapshot?.merchant?.name,
      amount: snapshot?.amount,
      date: snapshot?.date,
    },
  });

  return request;
}

export async function getPendingRequests(): Promise<DeletionRequest[]> {
  const collection = await col();
  if (!collection) return [];
  return collection
    .find({ status: "pending" })
    .sort({ requestedAt: -1 })
    .toArray();
}

export async function getAllRequests(): Promise<DeletionRequest[]> {
  const collection = await col();
  if (!collection) return [];
  return collection.find().sort({ requestedAt: -1 }).limit(50).toArray();
}

export async function approveRequest(id: string): Promise<boolean> {
  const collection = await col();
  if (!collection) return false;

  const request = await collection.findOne({ _id: new ObjectId(id) });
  if (!request || request.status !== "pending") return false;

  // Actually delete the transaction via Monarch API
  const client = createGraphQLClient();
  try {
    await client.query(DELETE_TRANSACTION, {
      input: { transactionId: request.transactionId },
    });
  } catch (err: any) {
    log({
      type: "error",
      severity: "critical",
      method: "deletion_approve",
      summary: `Failed to delete transaction ${request.transactionId}: ${err.message}`,
      details: { error: err.message },
    });
    return false;
  }

  await collection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { status: "approved", resolvedAt: new Date() } }
  );

  log({
    type: "sdk_call",
    severity: "critical",
    method: "transactions.delete",
    summary: `Transaction ${request.transactionId} DELETED (admin approved)`,
    details: {
      transactionId: request.transactionId,
      merchant: request.transactionSnapshot?.merchant?.name,
      amount: request.transactionSnapshot?.amount,
    },
  });

  return true;
}

export async function denyRequest(id: string): Promise<boolean> {
  const collection = await col();
  if (!collection) return false;

  const request = await collection.findOne({ _id: new ObjectId(id) });
  if (!request || request.status !== "pending") return false;

  // Unhide the transaction
  const client = createGraphQLClient();
  try {
    await client.query(UPDATE_TRANSACTION, {
      input: {
        id: request.transactionId,
        hideFromReports: false,
        needsReview: false,
        notes: "",
      },
    });
  } catch {}

  await collection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { status: "denied", resolvedAt: new Date() } }
  );

  log({
    type: "sdk_call",
    severity: "info",
    method: "transactions.deleteDenied",
    summary: `Deletion denied for transaction ${request.transactionId} — unhidden`,
    details: { transactionId: request.transactionId },
  });

  return true;
}
