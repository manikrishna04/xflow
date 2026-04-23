import type { InvoiceRecord, RemoteStatusSnapshot } from "@/types/tradedge";
import type { XflowAccount, XflowReceivable } from "@/types/xflow";

export function buildReferenceId() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `TE-${stamp}-${suffix}`;
}

export function deriveBuyerEmail(buyerName: string, referenceId: string) {
  const domain = "@sandbox.tradedge.app";
  const suffix = `-${referenceId.toLowerCase()}`;
  const maxEmailLength = 50;
  const maxSlugLength = Math.max(1, maxEmailLength - domain.length - suffix.length);

  const slug = buyerName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, maxSlugLength);

  return `${slug || "buyer"}${suffix}${domain}`;
}

export function derivePayoutAmountInr(amountUsd: number) {
  return Number((amountUsd * 83.25).toFixed(2));
}

function humanizeKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function flattenInstructionRecord(
  record: Record<string, unknown>,
  prefix = "",
  items: Array<{ label: string; value: string }> = [],
) {
  for (const [key, value] of Object.entries(record)) {
    if (value === null || value === undefined || value === "") {
      continue;
    }

    const label = prefix ? `${prefix} ${humanizeKey(key)}` : humanizeKey(key);

    if (Array.isArray(value)) {
      items.push({ label, value: value.join(", ") });
      continue;
    }

    if (typeof value === "object") {
      flattenInstructionRecord(value as Record<string, unknown>, label, items);
      continue;
    }

    items.push({ label, value: String(value) });
  }

  return items;
}

export function extractInstructionItems(receivable?: XflowReceivable | null) {
  if (!receivable) {
    return [];
  }

  const rawInstructions = receivable.payment_instructions;

  if (rawInstructions && typeof rawInstructions === "object") {
    const flattened = flattenInstructionRecord(rawInstructions);
    if (flattened.length > 0) {
      return flattened;
    }
  }

  const fallback: Array<{ label: string; value: string }> = [];

  if (receivable.id) {
    fallback.push({ label: "Receivable ID", value: receivable.id });
  }

  const reference =
    receivable.reference_id || receivable.invoice?.reference_number || receivable.metadata?.reference_id;
  if (reference) {
    fallback.push({ label: "Reference", value: reference });
  }

  const amount = receivable.amount_maximum_reconcilable || receivable.invoice?.amount;
  if (amount && receivable.currency) {
    fallback.push({ label: "Invoice Amount", value: `${receivable.currency} ${amount}` });
  }

  fallback.push({
    label: "Buyer Note",
    value: "Use the invoice reference when remitting funds to the exporter via Xflow.",
  });

  return fallback;
}

export function applyRemoteStatus(
  invoice: InvoiceRecord,
  status: RemoteStatusSnapshot,
): Partial<InvoiceRecord> {
  const receivable = status.receivable ?? invoice.receivableSnapshot ?? null;
  const payout = status.payout ?? invoice.payoutSnapshot ?? null;

  return {
    lastSyncedAt: status.fetchedAt,
    payoutSnapshot: payout,
    payoutStatus: payout?.status ?? invoice.payoutStatus ?? null,
    receivableSnapshot: receivable,
    receivableStatus: receivable?.status ?? invoice.receivableStatus ?? null,
    updatedAt: new Date().toISOString(),
  };
}

export function buildInvoiceRecord(input: {
  amountUsd: number;
  buyerCountry: string;
  buyerName: string;
  creationWarning?: string | null;
  exporterAccountId: string;
  exporterLegalName?: string;
  id: string;
  partner: XflowAccount;
  receivable: XflowReceivable;
  referenceId: string;
}) {
  return {
    amountUsd: input.amountUsd,
    buyerCountry: input.buyerCountry,
    buyerEmail: deriveBuyerEmail(input.buyerName, input.referenceId),
    buyerName: input.buyerName,
    creationWarning: input.creationWarning ?? null,
    createdAt: new Date().toISOString(),
    exporterAccountId: input.exporterAccountId,
    exporterLegalName: input.exporterLegalName,
    id: input.id,
    lastSyncedAt: new Date().toISOString(),
    partnerId: input.partner.id,
    partnerSnapshot: input.partner,
    payoutAmountInr: derivePayoutAmountInr(input.amountUsd),
    payoutId: null,
    payoutSnapshot: null,
    payoutStatus: null,
    receivableId: input.receivable.id,
    receivableSnapshot: input.receivable,
    receivableStatus: input.receivable.status ?? "pending",
    referenceId: input.referenceId,
    updatedAt: new Date().toISOString(),
  } satisfies InvoiceRecord;
}

export function hasLivePayout(invoice: InvoiceRecord) {
  return Boolean(invoice.payoutId);
}

export function isReceivableSettled(status?: string | null) {
  return ["completed", "paid", "reconciled"].includes((status || "").toLowerCase());
}

export function isPayoutTerminal(status?: string | null) {
  return ["settled", "failed", "cancelled"].includes((status || "").toLowerCase());
}
