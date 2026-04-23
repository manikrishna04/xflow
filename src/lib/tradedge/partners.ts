import type { InvoiceRecord, PartnerRecord } from "@/types/tradedge";
import type { XflowAccount, XflowReceivable } from "@/types/xflow";

function parseAmount(value?: string | null) {
  const amount = Number(value ?? "");
  return Number.isFinite(amount) ? amount : 0;
}

export function isPartnerActive(status?: string | null) {
  return ["active", "activated"].includes((status || "").toLowerCase());
}

export function getPartnerLegalName(partner?: XflowAccount | null) {
  return (
    partner?.business_details?.legal_name ||
    partner?.nickname ||
    partner?.id ||
    "Unknown partner"
  );
}

export function getPartnerEmail(partner?: XflowAccount | null) {
  return partner?.business_details?.email || "No email";
}

export function getPartnerCountry(partner?: XflowAccount | null) {
  return partner?.business_details?.physical_address?.country || "N/A";
}

export function getReceivablePendingAmount(receivable?: XflowReceivable | null) {
  return parseAmount(receivable?.amount_reconciled_not_settled);
}

export function getPartnerBalanceAmount(receivable?: XflowReceivable | null) {
  return parseAmount(receivable?.amount_settled_payouts);
}

export function buildPartnerDirectory(partners: PartnerRecord[], invoices: InvoiceRecord[]) {
  const directory = new Map<
    string,
    {
      activationWarning?: string | null;
      createdAt: string;
      id: string;
      partner: XflowAccount;
      partnerBalanceUsd: number;
      pendingAmountUsd: number;
      receivableCount: number;
      updatedAt: string;
    }
  >();

  for (const partnerRecord of partners) {
    directory.set(partnerRecord.id, {
      activationWarning: partnerRecord.activationWarning,
      createdAt: partnerRecord.createdAt,
      id: partnerRecord.id,
      partner: partnerRecord.snapshot,
      partnerBalanceUsd: 0,
      pendingAmountUsd: 0,
      receivableCount: 0,
      updatedAt: partnerRecord.updatedAt,
    });
  }

  for (const invoice of invoices) {
    const partner = invoice.partnerSnapshot;

    if (!partner?.id) {
      continue;
    }

    const current = directory.get(partner.id);
    const entry =
      current ??
      {
        createdAt: invoice.createdAt,
        id: partner.id,
        partner,
        partnerBalanceUsd: 0,
        pendingAmountUsd: 0,
        receivableCount: 0,
        updatedAt: invoice.updatedAt,
      };

    entry.partner = partner;
    entry.pendingAmountUsd += getReceivablePendingAmount(invoice.receivableSnapshot);
    entry.partnerBalanceUsd += getPartnerBalanceAmount(invoice.receivableSnapshot);
    entry.receivableCount += 1;
    entry.updatedAt =
      new Date(entry.updatedAt).valueOf() > new Date(invoice.updatedAt).valueOf()
        ? entry.updatedAt
        : invoice.updatedAt;

    directory.set(partner.id, entry);
  }

  return Array.from(directory.values()).sort(
    (left, right) => new Date(right.updatedAt).valueOf() - new Date(left.updatedAt).valueOf(),
  );
}
