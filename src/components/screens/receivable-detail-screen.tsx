"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  ClipboardList,
  FileText,
  Landmark,
  X,
  RefreshCcw,
  Send,
} from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatCurrency, formatDate, formatDateTime, parseCurrencyAmount } from "@/lib/tradedge/format";
import { getPartnerCountry, getPartnerLegalName } from "@/lib/tradedge/partners";
import { useConnectedUserQuery, useSyncInvoiceStatusMutation } from "@/lib/hooks/use-tradedge-actions";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useTradEdgeStore } from "@/lib/store/tradedge-store";
import type { XflowAddress } from "@/types/xflow";

function getReceivableTotalAmount(amount?: string | null) {
  return parseCurrencyAmount(amount);
}

function getReceivableReconciledAmount(amount?: string | null) {
  return parseCurrencyAmount(amount);
}

function getReceivablePendingAmount(snapshot?: { amount_reconcilable?: string | null; amount_maximum_reconcilable?: string | null; amount_reconciled?: string | null } | null) {
  const explicitPending = parseCurrencyAmount(snapshot?.amount_reconcilable);

  if (explicitPending > 0) {
    return explicitPending;
  }

  const total = parseCurrencyAmount(snapshot?.amount_maximum_reconcilable);
  const reconciled = parseCurrencyAmount(snapshot?.amount_reconciled);

  return Math.max(0, total - reconciled);
}

function buildSummaryMetrics(invoice: NonNullable<ReturnType<typeof useTradEdgeStore.getState>["invoices"][number]>) {
  const total = getReceivableTotalAmount(
    invoice.receivableSnapshot?.amount_maximum_reconcilable || invoice.receivableSnapshot?.invoice?.amount,
  );
  const reconciled = getReceivableReconciledAmount(
    invoice.receivableSnapshot?.amount_reconciled,
  );
  const pending = getReceivablePendingAmount(invoice.receivableSnapshot);

  return {
    pending,
    progress: total > 0 ? Math.min(100, (reconciled / total) * 100) : 0,
    reconciled,
    total,
  };
}

function metadataEntries(metadata?: Record<string, string> | null) {
  return Object.entries(metadata ?? {}).filter(([, value]) => value);
}

function chooseBestPayoutAddress(addresses: XflowAddress[], currency?: string | null) {
  if (addresses.length === 0) {
    return null;
  }

  const normalizedCurrency = (currency || "").toUpperCase();
  const currencyMatch = normalizedCurrency
    ? addresses.find((address) => (address.currency || "").toUpperCase() === normalizedCurrency)
    : undefined;

  return currencyMatch ?? addresses[0] ?? null;
}

function formatCountryName(code?: string | null) {
  const normalized = (code || "").toUpperCase();
  switch (normalized) {
    case "US":
      return "United States of America";
    case "IN":
      return "India";
    case "GB":
      return "United Kingdom";
    case "AE":
      return "United Arab Emirates";
    case "SG":
      return "Singapore";
    default:
      return normalized || "N/A";
  }
}

function formatAddressLine(details?: {
  city?: string | null;
  country?: string | null;
  line1?: string | null;
  line2?: string | null;
  postal_code?: string | null;
  state?: string | null;
} | null) {
  if (!details) {
    return null;
  }

  const parts = [
    details.line1,
    details.line2,
    details.city,
    details.state,
    details.postal_code,
    details.country ? formatCountryName(details.country) : null,
  ].filter((value) => Boolean(value && String(value).trim().length > 0));

  return parts.length > 0 ? parts.join(", ") : null;
}

function getAvailableBalanceDisplay(balance: unknown, currency: string) {
  if (!balance || typeof balance !== "object") {
    return null;
  }

  const candidate = (balance as { available?: Array<{ amount?: string | null; currency?: string | null }> | null })
    .available;
  if (!candidate || candidate.length === 0) {
    return null;
  }

  const normalized = currency.toUpperCase();
  const match = candidate.find((item) => (item.currency || "").toUpperCase() === normalized) ?? candidate[0];
  const amount = Number(match?.amount ?? "");
  if (!Number.isFinite(amount)) {
    return null;
  }

  return `${normalized} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type BankMethodSection = {
  key: "ach" | "fedwire" | "swift";
  label: string;
  rows: Array<{ label: string; value: string }>;
};

function buildBankMethodSections(params: {
  payoutAddress: XflowAddress | null;
  beneficiary?: string | null;
  receivingCurrency: string;
  paymentReference?: string | null;
}): { local: BankMethodSection[]; swift: BankMethodSection[] } {
  const payoutAddress = params.payoutAddress;
  if (!payoutAddress) {
    return { local: [], swift: [] };
  }

  const bank = payoutAddress.bank_account ?? null;
  const bankAddress = formatAddressLine(payoutAddress.billing_details ?? null);

  const baseRows: Array<{ label: string; value: string }> = [];
  if (params.beneficiary) {
    baseRows.push({ label: "Beneficiary", value: params.beneficiary });
  }
  baseRows.push({ label: "Receiving Currency", value: params.receivingCurrency });

  const accountNumber = bank?.number || bank?.last4 ? bank.number || `•••• ${bank.last4}` : null;
  const accountType = bank?.entity_type || bank?.type || null;
  const bankName = bank?.bank_name || null;

  const local: BankMethodSection[] = [];
  const swift: BankMethodSection[] = [];

  // ACH: domestic rails (often the "local" route).
  if (bank?.domestic_debit || bank?.domestic_credit || accountNumber || bankName) {
    const rows = [...baseRows];
    if (accountNumber) rows.push({ label: "Account Number", value: accountNumber });
    if (bank?.domestic_debit || bank?.domestic_credit) {
      rows.push({
        label: "Routing Number",
        value: String(bank.domestic_debit || bank.domestic_credit),
      });
    }
    if (accountType) rows.push({ label: "Account Type", value: String(accountType) });
    if (bankName) rows.push({ label: "Bank", value: String(bankName) });
    if (bankAddress) rows.push({ label: "Bank Address", value: bankAddress });
    if (params.paymentReference) rows.push({ label: "Payment Reference", value: params.paymentReference });

    local.push({ key: "ach", label: "ACH", rows });
  }

  // Fedwire: domestic wire.
  if (bank?.domestic_wire || accountNumber || bankName) {
    const rows = [...baseRows];
    if (accountNumber) rows.push({ label: "Account Number", value: accountNumber });
    if (bank?.domestic_wire) {
      rows.push({ label: "ABA Code / Routing Number", value: String(bank.domestic_wire) });
    }
    if (accountType) rows.push({ label: "Account Type", value: String(accountType) });
    if (bankName) rows.push({ label: "Bank", value: String(bankName) });
    if (bankAddress) rows.push({ label: "Bank Address", value: bankAddress });
    if (params.paymentReference) rows.push({ label: "Payment Reference", value: params.paymentReference });

    local.push({ key: "fedwire", label: "Fedwire", rows });
  }

  // SWIFT / global wire / IBAN.
  if (bank?.global_wire || bank?.iban) {
    const rows = [...baseRows];
    if (accountNumber) rows.push({ label: "Account Number", value: accountNumber });
    if (bank?.iban) rows.push({ label: "IBAN", value: String(bank.iban) });
    if (bank?.global_wire) rows.push({ label: "SWIFT / Global Wire", value: String(bank.global_wire) });
    if (accountType) rows.push({ label: "Account Type", value: String(accountType) });
    if (bankName) rows.push({ label: "Bank", value: String(bankName) });
    if (bankAddress) rows.push({ label: "Bank Address", value: bankAddress });
    if (params.paymentReference) rows.push({ label: "Payment Reference", value: params.paymentReference });

    swift.push({ key: "swift", label: "SWIFT", rows });
  }

  return { local, swift };
}

export function ReceivableDetailScreen({ invoiceId }: { invoiceId: string }) {
  const hydrated = useHydrated();
  const invoice = useTradEdgeStore(
    (state) => state.invoices.find((item) => item.id === invoiceId) ?? null,
  );
  const syncStatus = useSyncInvoiceStatusMutation();
  const [activeTab, setActiveTab] = useState<"transactions" | "payouts">("transactions");
  const [bankDetailsOpen, setBankDetailsOpen] = useState(false);
  const [bankTab, setBankTab] = useState<"local" | "swift">("local");
  const [selectedCurrency, setSelectedCurrency] = useState<string>("USD");
  const [senderCountry, setSenderCountry] = useState<string>("US");
  const [selectedSections, setSelectedSections] = useState<Record<string, boolean>>({});

  const summary = useMemo(() => (invoice ? buildSummaryMetrics(invoice) : null), [invoice]);
  const receivableCurrency = invoice?.receivableSnapshot?.currency || "USD";

  const connectedUser = useConnectedUserQuery(
    bankDetailsOpen && invoice ? invoice.exporterAccountId : null,
  );
  const payoutAddress = useMemo(
    () => chooseBestPayoutAddress(connectedUser.data?.payoutAddresses ?? [], receivableCurrency),
    [connectedUser.data?.payoutAddresses, receivableCurrency],
  );
  const bankSections = useMemo(() => {
    const paymentReference = invoice?.receivableSnapshot?.reference_id ||
      invoice?.receivableSnapshot?.invoice?.reference_number ||
      invoice?.referenceId ||
      null;

    return buildBankMethodSections({
      payoutAddress,
      beneficiary: connectedUser.data?.account?.business_details?.legal_name ?? connectedUser.data?.account?.nickname ?? null,
      receivingCurrency: selectedCurrency || receivableCurrency,
      paymentReference,
    });
  }, [connectedUser.data?.account?.business_details?.legal_name, connectedUser.data?.account?.nickname, invoice, payoutAddress, receivableCurrency, selectedCurrency]);

  const visibleSections = bankTab === "local" ? bankSections.local : bankSections.swift;

  if (hydrated && !invoice) {
    return (
      <EmptyState
        title="Receivable not found in local storage"
        description="This workspace keeps receivable records in the browser. Re-open it from the same session or create the receivable again."
        actionHref="/receivables"
        actionLabel="Back to receivables"
      />
    );
  }

  if (!invoice || !summary) {
    return null;
  }

  const receivable = invoice.receivableSnapshot;
  const partner = invoice.partnerSnapshot;
  const metadata = metadataEntries(receivable?.metadata);

  const transactionRows = invoice.receivableReconciliationSnapshot
    ? [
        {
          amount: `${receivableCurrency} ${invoice.receivableReconciliationSnapshot.amount || "0.00"}`,
          created: formatDateTime(invoice.receivableReconciliationSnapshot.created),
          id: invoice.receivableReconciliationSnapshot.id || "Reconciliation",
          status: invoice.receivableReconciliationSnapshot.status || "processing",
        },
      ]
    : [];
  const payoutRows = invoice.payoutSnapshot
    ? [
        {
          amount: `${invoice.payoutSnapshot.currency || "INR"} ${invoice.payoutSnapshot.amount || "0.00"}`,
          created: formatDateTime(invoice.payoutSnapshot.created),
          id: invoice.payoutSnapshot.id,
          status: invoice.payoutSnapshot.status || "initialized",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Receivables"
        title={receivable?.invoice?.reference_number || invoice.referenceId}
        description="Continue the Xflow-style receivable flow here: review the invoice, check the receivable summary, then continue into reconciliation and FX handling."
        actions={
          <>
            <Link href="/receivables">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await syncStatus.mutateAsync(invoice);
                  toast.success("Receivable status refreshed.");
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Could not refresh the receivable.",
                  );
                }
              }}
              disabled={syncStatus.isPending}
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-0 overflow-hidden rounded-[28px] border border-black/8 bg-white/80 shadow-[0_20px_55px_rgba(19,33,68,0.07)]">
          <div className="flex aspect-[0.95] items-center justify-center bg-[linear-gradient(180deg,rgba(19,33,68,0.76),rgba(19,33,68,0.62))] p-8">
            <div className="flex h-full w-full flex-col rounded-[26px] bg-[linear-gradient(180deg,#ffffff,#f5f7ff)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <div className="flex items-center justify-between">
                <StatusBadge status={invoice.receivableStatus} />
                <FileText className="h-5 w-5 text-foreground/45" />
              </div>
              <div className="mt-8 space-y-4">
                <div className="rounded-[20px] bg-[rgba(105,126,255,0.08)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/45">
                    Invoice Number
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-foreground">
                    {receivable?.invoice?.reference_number || invoice.referenceId}
                  </p>
                </div>
                <div className="grid gap-3">
                  <div className="rounded-[20px] border border-black/8 bg-white px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/42">
                      Partner
                    </p>
                    <p className="mt-2 text-base font-semibold text-primary">
                      {getPartnerLegalName(partner)}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-black/8 bg-white px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/42">
                      Invoice Amount
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">
                      {formatCurrency(summary.total || invoice.amountUsd, receivableCurrency)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-auto rounded-[20px] border border-dashed border-black/10 px-4 py-4 text-sm text-foreground/58">
                {receivable?.invoice?.document
                  ? `Invoice document attached: ${receivable.invoice.document}`
                  : "No invoice file URL is exposed in this demo, so the document tile stays as a summary preview."}
              </div>
            </div>
          </div>

          <div className="space-y-6 bg-white px-6 py-7">
            <div>
              <p className="text-sm font-semibold text-foreground/48">Invoice Number</p>
              <p className="mt-2 text-[2rem] font-semibold text-foreground">
                {receivable?.invoice?.reference_number || invoice.referenceId}
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground/48">Partner</p>
              <p className="mt-2 text-[1.65rem] font-semibold text-primary">
                {getPartnerLegalName(partner)}
              </p>
              <p className="mt-1 text-sm text-foreground/58">{getPartnerCountry(partner)}</p>
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground/48">Total Amount</p>
              <p className="mt-2 text-xl font-semibold text-foreground">
                {formatCurrency(summary.total || invoice.amountUsd, receivableCurrency)}
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground/48">Due on</p>
              <p className="mt-2 text-xl font-semibold text-foreground">
                {formatDate(receivable?.invoice?.due_date)}
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground/48">Invoice Date</p>
              <p className="mt-2 text-xl font-semibold text-foreground">
                {formatDate(receivable?.invoice?.creation_date || invoice.createdAt)}
              </p>
            </div>
          </div>

          <div className="space-y-5 rounded-b-[28px] bg-[rgba(105,126,255,0.07)] px-6 py-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/42">
                Receivable ID
              </p>
              <p className="mt-2 break-all text-sm text-foreground/72">{invoice.receivableId}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/42">
                Purpose Code
              </p>
              <p className="mt-2 text-sm text-foreground/72">{receivable?.purpose_code || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/42">
                Description
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground/72">
                {receivable?.description || "No description provided."}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <SectionCard className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-semibold text-foreground">Receivable Summary</h2>
              </div>
              <button
                type="button"
                className="text-sm font-semibold text-primary transition hover:opacity-80"
                onClick={() => setActiveTab("transactions")}
              >
                View Detailed Breakdown
              </button>
            </div>

            <div className="grid gap-0 overflow-hidden rounded-[24px] border border-black/8 bg-white/78 md:grid-cols-3">
              {[
                {
                  label: "Amount Pending",
                  value: formatCurrency(summary.pending, receivableCurrency),
                },
                {
                  label: "Reconciled",
                  value: formatCurrency(summary.reconciled, receivableCurrency),
                },
                {
                  label: "Receivable Amount",
                  value: formatCurrency(summary.total || invoice.amountUsd, receivableCurrency),
                },
              ].map((item) => (
                <div key={item.label} className="border-b border-black/8 px-6 py-5 md:border-b-0 md:border-r md:last:border-r-0">
                  <p className="text-sm font-semibold text-foreground/52">{item.label}</p>
                  <p className="mt-2 text-[1.9rem] font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-[rgba(34,139,92,0.14)]">
              <div
                className="h-full rounded-full bg-[rgb(132,182,79)] transition-all"
                style={{ width: `${Math.max(summary.progress, summary.reconciled > 0 ? 8 : 0)}%` }}
              />
            </div>
          </SectionCard>

          <SectionCard className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Reconcile Associated Receivable</h2>
            <div className="rounded-[24px] bg-[rgba(105,126,255,0.08)] p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="flex min-h-12 items-center rounded-[18px] border border-black/8 bg-white px-5 text-lg font-semibold text-foreground">
                  Common Balance&nbsp;
                  <span className="text-[rgb(112,148,29)]">
                    {formatCurrency(summary.pending, receivableCurrency)}
                  </span>
                </div>
                <Link href={`/receivables/${invoice.id}/reconcile`}>
                  <Button size="lg">Reconcile</Button>
                </Link>
              </div>
            </div>
          </SectionCard>

          <SectionCard className="space-y-4">
            <div className="flex items-center gap-3">
              <Send className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-semibold text-foreground">Share Payment Options With Partner</h2>
            </div>
            <div className="rounded-[24px] bg-[rgba(105,126,255,0.08)] p-5">
              <div className="flex flex-wrap gap-4">
                <Link href={`/pay/${invoice.id}`}>
                  <Button variant="outline" className="rounded-[16px]">
                    Share Payment Link
                  </Button>
                </Link>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-[16px]"
                  onClick={() => setBankDetailsOpen(true)}
                >
                  Share Bank Transfer Details
                </Button>
              </div>
            </div>
          </SectionCard>

          {bankDetailsOpen ? (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 py-6 md:items-center"
              role="dialog"
              aria-modal="true"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setBankDetailsOpen(false);
                }
              }}
            >
              <div className="flex max-h-[80vh] w-full max-w-[1040px] flex-col overflow-hidden rounded-[18px] border border-black/10 bg-white shadow-xl">
                <div className="flex items-center justify-between gap-4 border-b border-black/8 px-6 py-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    Connected User Balance : Bank Transfer Details
                  </h3>
                  <button
                    type="button"
                    className="rounded-[12px] p-2 text-foreground/60 transition hover:bg-black/5 hover:text-foreground"
                    onClick={() => setBankDetailsOpen(false)}
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid flex-1 min-h-0 grid-cols-1 overflow-auto md:grid-cols-[360px_1fr] md:overflow-hidden">
                  <div className="border-b border-black/8 px-6 py-5 md:border-b-0 md:border-r">
                    <p className="text-sm text-foreground/65">Receiving funds in</p>
                    <p className="mt-2 text-xl font-semibold text-foreground">Connected User Balance</p>

                    <div className="mt-6">
                      <p className="text-sm font-semibold text-foreground/70">Currency</p>
                      <div className="mt-3">
                        <Select
                          value={selectedCurrency || receivableCurrency}
                          onChange={(event) => setSelectedCurrency(event.target.value)}
                        >
                          {Array.from(
                            new Set([
                              (receivableCurrency || "USD").toUpperCase(),
                              ...(connectedUser.data?.balance?.available ?? []).map((item) =>
                                (item.currency || "").toUpperCase(),
                              ),
                            ].filter(Boolean)),
                          ).map((code) => (
                            <option key={code} value={code}>
                              {code}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <p className="mt-3 text-sm text-foreground/65">
                        Available Balance:{" "}
                        <span className="font-semibold text-foreground">
                          {getAvailableBalanceDisplay(
                            connectedUser.data?.balance ?? null,
                            selectedCurrency || receivableCurrency,
                          ) ?? "N/A"}
                        </span>
                      </p>
                    </div>

                    <div className="mt-6">
                      <p className="text-sm font-semibold text-foreground/70">Sender Country</p>
                      <div className="mt-3">
                        <Select value={senderCountry} onChange={(event) => setSenderCountry(event.target.value)}>
                          {Array.from(
                            new Set([
                              (getPartnerCountry(partner) || "US").toUpperCase(),
                              "US",
                              "IN",
                              "GB",
                              "AE",
                              "SG",
                            ].filter(Boolean)),
                          ).map((code) => (
                            <option key={code} value={code}>
                              {formatCountryName(code)}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>

                    {senderCountry.toUpperCase() === "US" ? (
                      <div className="mt-6 rounded-[16px] bg-[rgba(105,126,255,0.12)] px-4 py-4 text-sm text-foreground/70">
                        For US based clients, we recommend that you share both ACH and Fedwire details. Some partners
                        may not have access to Fedwire.
                      </div>
                    ) : null}
                  </div>

                  <div className="px-6 py-5 md:flex md:min-h-0 md:flex-col">
                    <p className="text-sm font-semibold text-foreground/70">Recommended Payment Methods</p>

                    <div className="mt-3 inline-flex overflow-hidden rounded-[12px] border border-black/10 bg-white">
                      {[
                        { key: "local" as const, label: "Local" },
                        { key: "swift" as const, label: "SWIFT" },
                      ].map((tab) => {
                        const active = bankTab === tab.key;
                        return (
                          <button
                            key={tab.key}
                            type="button"
                            className={`px-4 py-2 text-sm font-semibold transition ${
                              active ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-black/5"
                            }`}
                            onClick={() => setBankTab(tab.key)}
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-5 space-y-4 md:min-h-0 md:flex-1 md:overflow-auto md:pr-2">
                      {connectedUser.isLoading ? (
                        <p className="text-sm text-foreground/60">Loading bank details…</p>
                      ) : connectedUser.isError ? (
                        <p className="text-sm text-foreground/60">
                          Could not load bank details. Make sure the connected user has a payout address set.
                        </p>
                      ) : visibleSections.length === 0 ? (
                        <p className="text-sm text-foreground/60">No bank transfer details available.</p>
                      ) : (
                        visibleSections.map((section) => (
                          <div
                            key={section.key}
                            className="overflow-hidden rounded-[16px] border border-black/10 bg-white"
                          >
                            <div className="flex items-center justify-between gap-4 border-b border-black/8 px-5 py-4">
                              <div className="flex items-center gap-3">
                                <p className="text-base font-semibold text-foreground">{section.label}</p>
                              </div>
                              <label className="flex items-center gap-2 text-sm text-foreground/70">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-primary"
                                  checked={Boolean(selectedSections[section.key])}
                                  onChange={(event) =>
                                    setSelectedSections((current) => ({
                                      ...current,
                                      [section.key]: event.target.checked,
                                    }))
                                  }
                                />
                                Select
                              </label>
                            </div>
                            <div className="divide-y divide-black/8">
                              {section.rows.map((row) => (
                                <div
                                  key={`${section.key}-${row.label}`}
                                  className="grid grid-cols-[1fr_1.2fr] gap-4 px-5 py-3 text-sm"
                                >
                                  <p className="text-foreground/70">{row.label}</p>
                                  <p className="break-all font-semibold text-foreground">{row.value}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-black/8 bg-white px-6 py-4 md:flex-row md:items-center md:justify-between">
                  <Button type="button" variant="outline" className="rounded-[14px]">
                    Get Letter of Authorisation
                  </Button>

                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-[14px]"
                      onClick={() => {
                        const chosenKeys = Object.entries(selectedSections)
                          .filter(([, value]) => value)
                          .map(([key]) => key);

                        const chosen = chosenKeys.length
                          ? visibleSections.filter((section) => chosenKeys.includes(section.key))
                          : visibleSections;

                        const text = chosen
                          .map((section) => {
                            const rows = section.rows.map((row) => `${row.label}: ${row.value}`).join("\n");
                            return `${section.label}\n${rows}`;
                          })
                          .join("\n\n");

                        try {
                          const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
                          const url = URL.createObjectURL(blob);
                          const anchor = document.createElement("a");
                          anchor.href = url;
                          anchor.download = `bank-transfer-details-${invoice.id}.txt`;
                          document.body.appendChild(anchor);
                          anchor.click();
                          anchor.remove();
                          URL.revokeObjectURL(url);
                        } catch {
                          toast.error("Download failed");
                        }
                      }}
                      disabled={visibleSections.length === 0}
                    >
                      Download Selected
                    </Button>
                    <Button
                      type="button"
                      className="rounded-[14px]"
                      onClick={async () => {
                        const chosenKeys = Object.entries(selectedSections)
                          .filter(([, value]) => value)
                          .map(([key]) => key);

                        const chosen = chosenKeys.length
                          ? visibleSections.filter((section) => chosenKeys.includes(section.key))
                          : visibleSections;

                        const text = chosen
                          .map((section) => {
                            const rows = section.rows.map((row) => `${row.label}: ${row.value}`).join("\n");
                            return `${section.label}\n${rows}`;
                          })
                          .join("\n\n");

                        try {
                          await navigator.clipboard.writeText(text);
                          toast.success("Copied");
                        } catch {
                          toast.error("Copy failed");
                        }
                      }}
                      disabled={visibleSections.length === 0}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <SectionCard className="space-y-5">
            <div className="flex items-center gap-6 border-b border-black/8 pb-3">
              {[
                { key: "transactions", label: "Transactions" },
                { key: "payouts", label: "Associated Payouts" },
              ].map((tab) => {
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    className={`border-b-2 pb-2 text-lg font-semibold transition ${
                      active ? "border-primary text-primary" : "border-transparent text-foreground/60"
                    }`}
                    onClick={() => setActiveTab(tab.key as "transactions" | "payouts")}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="overflow-hidden rounded-[24px] border border-black/8 bg-white/78">
              <div className="hidden grid-cols-[1.2fr_1fr_0.9fr_0.8fr] gap-4 border-b border-black/8 px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-foreground/45 md:grid">
                <span>Reference</span>
                <span>Created</span>
                <span>Amount</span>
                <span>Status</span>
              </div>

              {(activeTab === "transactions" ? transactionRows : payoutRows).length > 0 ? (
                (activeTab === "transactions" ? transactionRows : payoutRows).map((row) => (
                  <div
                    key={row.id}
                    className="grid gap-3 border-t border-black/6 px-6 py-4 first:border-t-0 md:grid-cols-[1.2fr_1fr_0.9fr_0.8fr]"
                  >
                    <div className="text-sm font-semibold text-primary">{row.id}</div>
                    <div className="text-sm text-foreground/68">{row.created}</div>
                    <div className="text-sm text-foreground/72">{row.amount}</div>
                    <div>
                      <StatusBadge status={row.status} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex min-h-56 flex-col items-center justify-center px-6 py-12 text-center">
                  <ClipboardList className="h-12 w-12 text-foreground/24" />
                  <p className="mt-4 text-lg font-semibold text-foreground/62">Nothing to see here</p>
                  <p className="mt-2 max-w-md text-sm text-foreground/48">
                    {activeTab === "transactions"
                      ? "Once a reconciliation is submitted, it will appear here."
                      : "Associated payout records show up here after settlement and payout creation."}
                  </p>
                </div>
              )}
            </div>
          </SectionCard>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <SectionCard id="payment-instructions" className="space-y-4">
              <div className="flex items-center gap-3">
                <Landmark className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-semibold text-foreground">Payment Instructions</h2>
              </div>
              <div className="grid gap-3">
                {[
                  {
                    label: "Receivable ID",
                    value: invoice.receivableId,
                  },
                  {
                    label: "Reference",
                    value: receivable?.reference_id || receivable?.invoice?.reference_number || invoice.referenceId,
                  },
                  {
                    label: "Currency",
                    value: receivableCurrency,
                  },
                  {
                    label: "Partner",
                    value: getPartnerLegalName(partner),
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-[20px] bg-black/[0.03] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/42">
                      {item.label}
                    </p>
                    <p className="mt-2 break-all text-sm leading-6 text-foreground/74">{item.value}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard className="space-y-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-semibold text-foreground">Metadata</h2>
              </div>
              {metadata.length > 0 ? (
                <div className="space-y-3">
                  {metadata.map(([key, value]) => (
                    <div key={key} className="flex items-start justify-between gap-4 rounded-[20px] bg-black/[0.03] px-4 py-4">
                      <p className="text-sm font-semibold text-foreground">{key}</p>
                      <p className="max-w-[60%] break-all text-right text-sm text-foreground/68">{value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-foreground/56">No metadata added yet.</p>
              )}

              <div className="rounded-[22px] border border-black/8 bg-white/78 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/42">
                  Last Synced
                </p>
                <p className="mt-2 text-sm text-foreground/72">{formatDateTime(invoice.lastSyncedAt)}</p>
              </div>

              <Link href={`/pay/${invoice.id}`}>
                <Button variant="outline" className="w-full">
                  Open Buyer Payment Page
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
