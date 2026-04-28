"use client";

import Link from "next/link";
import { ArrowLeft, BadgeIndianRupee, FileText, Landmark, Lock, RefreshCcw, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  useConnectedUserQuery,
  useCreateQuoteLockMutation,
  useReconcileReceivableMutation,
  useReceivableQuoteQuery,
} from "@/lib/hooks/use-tradedge-actions";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { formatCurrency, parseCurrencyAmount } from "@/lib/tradedge/format";
import { formatConnectedUserStatus, isConnectedUserActive } from "@/lib/tradedge/onboarding";
import { getPartnerLegalName } from "@/lib/tradedge/partners";
import { useTradEdgeStore } from "@/lib/store/tradedge-store";
import type { ReceivableQuoteLockSnapshot } from "@/types/tradedge";
import type { XflowBalance, XflowMoneyAmount } from "@/types/xflow";

function getBalanceAmountForCurrency(
  amounts: XflowMoneyAmount[] | null | undefined,
  currency: string,
) {
  const normalizedCurrency = currency.trim().toUpperCase();
  const match = amounts?.find((item) => item.currency?.toUpperCase() === normalizedCurrency);
  return match ? parseCurrencyAmount(match.amount) : null;
}

function getCommonUsdBalance(balance?: XflowBalance | null) {
  const available = getBalanceAmountForCurrency(balance?.available, "USD");
  const pending = getBalanceAmountForCurrency(balance?.pending, "USD");
  const processing = getBalanceAmountForCurrency(balance?.processing, "USD");

  // Prefer "available" when it's meaningful, otherwise fall back to pending/processing so the
  // reconcile screen matches what the dashboard shows for treasury.
  if (typeof available === "number" && available > 0) {
    return { amount: available, bucket: "available" as const };
  }
  if (typeof pending === "number" && pending > 0) {
    return { amount: pending, bucket: "pending" as const };
  }
  if (typeof processing === "number" && processing > 0) {
    return { amount: processing, bucket: "processing" as const };
  }

  // If we have an explicit USD entry but it's 0, keep it as known=0.
  if (typeof available === "number") {
    return { amount: available, bucket: "available" as const };
  }
  if (typeof pending === "number") {
    return { amount: pending, bucket: "pending" as const };
  }
  if (typeof processing === "number") {
    return { amount: processing, bucket: "processing" as const };
  }

  return null;
}

function getPendingAmount(invoice: NonNullable<ReturnType<typeof useTradEdgeStore.getState>["invoices"][number]>) {
  const explicitPending = parseCurrencyAmount(invoice.receivableSnapshot?.amount_reconcilable);

  if (explicitPending > 0) {
    return explicitPending;
  }

  const total = parseCurrencyAmount(
    invoice.receivableSnapshot?.amount_maximum_reconcilable ||
      invoice.receivableSnapshot?.invoice?.amount,
  );
  const reconciled = parseCurrencyAmount(invoice.receivableSnapshot?.amount_reconciled);

  return Math.max(0, total - reconciled);
}

function getRateValue(input?: {
  rate?: {
    user?: string | null;
    mid_market?: string | null;
    valid_to?: number | string | null;
  } | null;
}) {
  return parseCurrencyAmount(input?.rate?.user || input?.rate?.mid_market);
}

function getExpiryTimestamp(value?: number | string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed * 1000 : null;
}

function formatCountdown(milliseconds: number | null) {
  if (!milliseconds || milliseconds <= 0) {
    return "Expired";
  }

  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatEtaIstLabelFromNow(nowMs: number) {
  // Demo label to match screenshot style: "April 29, 2026, by 9 PM IST"
  const etaDate = new Date(nowMs + 2 * 24 * 60 * 60 * 1000);
  const datePart = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    month: "long",
    day: "2-digit",
    year: "numeric",
  }).format(etaDate);

  return `${datePart}, by 9 PM IST`;
}

function getInvoiceLabel(invoice: NonNullable<ReturnType<typeof useTradEdgeStore.getState>["invoices"][number]>) {
  return invoice.receivableSnapshot?.invoice?.reference_number || invoice.referenceId;
}

function getMaskedBankLabel(last4?: string | null, fallbackNumber?: string | null) {
  const digits = (last4 || fallbackNumber?.slice(-4) || "").trim();
  return digits ? `AC: **** ${digits}` : "AC: **** ----";
}

export function ReceivableReconcileScreen({ invoiceId }: { invoiceId: string }) {
  const hydrated = useHydrated();
  const router = useRouter();
  const exporter = useTradEdgeStore((state) => state.exporter);
  const invoices = useTradEdgeStore((state) => state.invoices);

  const invoice = useMemo(
    () => invoices.find((item) => item.id === invoiceId) ?? null,
    [invoices, invoiceId],
  );
  const usdInvoices = useMemo(
    () =>
      invoices.filter(
        (item) => (item.receivableSnapshot?.currency || "USD").toUpperCase() === "USD",
      ),
    [invoices],
  );

  const pendingAmount = useMemo(() => (invoice ? getPendingAmount(invoice) : 0), [invoice]);

  // Use invoice.exporterAccountId so the balance is consistent with other screens.
  const connectedUserQuery = useConnectedUserQuery(invoice?.exporterAccountId ?? null);
  const createQuoteLock = useCreateQuoteLockMutation(invoice);
  const reconcileReceivable = useReconcileReceivableMutation(invoice);

  const [amountByInvoice, setAmountByInvoice] = useState<Record<string, string>>({});
  const [addressByInvoice, setAddressByInvoice] = useState<Record<string, string>>({});
  const [quoteLockByInvoice, setQuoteLockByInvoice] = useState<
    Record<string, ReceivableQuoteLockSnapshot | null>
  >({});
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const amount = useMemo(() => {
    if (!invoice) {
      return "";
    }

    const existing = amountByInvoice[invoice.id];
    if (typeof existing === "string") {
      return existing;
    }

    return pendingAmount > 0 ? pendingAmount.toFixed(2) : "";
  }, [amountByInvoice, invoice, pendingAmount]);

  const quoteQuery = useReceivableQuoteQuery({
    amount,
    buyCurrency: "INR",
    enabled: Boolean(invoice && amount),
    exporterAccountId: invoice?.exporterAccountId,
    sellCurrency: "USD",
  });

  if (hydrated && !invoice) {
    return (
      <EmptyState
        title="Receivable not found in local storage"
        description="This reconcile flow needs the receivable record from the same browser session."
        actionHref="/receivables"
        actionLabel="Back to receivables"
      />
    );
  }

  if (!invoice) {
    return null;
  }

  const snapshot = connectedUserQuery.data;
  const accountStatus = snapshot?.account.status ?? exporter?.status ?? null;
  const transactionsEnabled = isConnectedUserActive(accountStatus);
  const payoutAddresses = snapshot?.payoutAddresses ?? [];
  const defaultAddressId = payoutAddresses[0]?.id ?? "";
  const selectedAddressId = addressByInvoice[invoice.id] ?? defaultAddressId;
  const selectedAddress = payoutAddresses.find((address) => address.id === selectedAddressId) ?? null;

  const commonBalanceSnapshot = getCommonUsdBalance(snapshot?.balance ?? null);
  const commonBalance = commonBalanceSnapshot?.amount ?? null;
  const balanceKnown = commonBalance !== null;

  const amountValue = parseCurrencyAmount(amount);
  const balanceLow = balanceKnown && commonBalance < amountValue;

  const rawQuoteLock = quoteLockByInvoice[invoice.id] ?? null;
  const selectedQuoteLock =
    rawQuoteLock && rawQuoteLock.quoteLock.lock_amount?.amount === amount ? rawQuoteLock : null;

  const effectiveRate = selectedQuoteLock
    ? getRateValue(selectedQuoteLock.quoteLock as unknown as { rate?: { user?: string | null; mid_market?: string | null } | null })
    : getRateValue(quoteQuery.data?.quote);
  const payoutAmountInr = Number((amountValue * effectiveRate).toFixed(2));
  const expiryMs = selectedQuoteLock
    ? (getExpiryTimestamp(selectedQuoteLock.quoteLock.valid_to) ?? 0) - now
    : (getExpiryTimestamp(quoteQuery.data?.quote.rate?.valid_to) ?? 0) - now;
  const payoutDateLabel = formatEtaIstLabelFromNow(now);

  const canSubmit =
    transactionsEnabled &&
    Boolean(selectedAddressId) &&
    amountValue > 0 &&
    balanceKnown &&
    commonBalance >= amountValue &&
    !reconcileReceivable.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Receivables"
        title="Reconcile USD Funds"
        description="Select the receivable amount, choose the payout bank, and manage the FX rate before submitting the reconciliation."
        actions={
          <>
            <Link href={`/receivables/${invoice.id}`}>
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => void Promise.all([connectedUserQuery.refetch(), quoteQuery.refetch()])}
              disabled={connectedUserQuery.isFetching || quoteQuery.isFetching}
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
          </>
        }
      />

      {!transactionsEnabled ? (
        <SectionCard>
          <p className="data-kicker">Account Gate</p>
          <h2 className="mt-3 text-2xl font-semibold text-foreground">
            Connected user is {formatConnectedUserStatus(accountStatus)}
          </h2>
          <p className="mt-3 text-sm leading-7 text-foreground/65">
            Xflow reconciliation and rate-lock flows require the connected user to be Active.
          </p>
          <Link href="/onboarding" className="mt-5 inline-flex">
            <Button>Open onboarding</Button>
          </Link>
        </SectionCard>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)]">
        <SectionCard className="space-y-8">
          <div className="space-y-4 border-b border-black/10 pb-8">
            <h2 className="text-2xl font-semibold text-foreground">1. Receivable</h2>
            <p className="text-sm text-foreground/62">Select a receivable to reconcile</p>
            <div>
              <Label htmlFor="receivableId">Select USD receivable</Label>
              <Select
                id="receivableId"
                value={invoice.id}
                onChange={(event) => {
                  const nextId = event.target.value;
                  if (nextId && nextId !== invoice.id) {
                    router.push(`/receivables/${nextId}/reconcile`);
                  }
                }}
                disabled={usdInvoices.length <= 1}
              >
                {usdInvoices.map((item) => (
                  <option key={item.id} value={item.id}>
                    {getInvoiceLabel(item)}
                  </option>
                ))}
              </Select>
              <p className="mt-3 text-sm text-foreground/58">
                Pending amount on invoice : {formatCurrency(pendingAmount, "USD")}
              </p>
            </div>
          </div>

          <div className="space-y-4 border-b border-black/10 pb-8">
            <h2 className="text-2xl font-semibold text-foreground">2. Amount</h2>
            <p className="text-sm text-foreground/62">Enter the amount to reconcile</p>

            <div className="rounded-[18px] border border-black/10 bg-white px-5 py-4">
              <div className="flex items-center justify-between gap-3 text-sm font-semibold text-foreground/72">
                <span>Common Balance</span>
                <span>{balanceKnown ? formatCurrency(commonBalance, "USD") : "N/A"}</span>
              </div>
              {commonBalanceSnapshot?.bucket && commonBalanceSnapshot.bucket !== "available" ? (
                <p className="mt-2 text-xs text-foreground/45">
                  Showing {commonBalanceSnapshot.bucket} treasury balance
                </p>
              ) : null}
            </div>

            <div>
              <Label htmlFor="amount">Enter the amount to reconcile</Label>
              <div className="flex overflow-hidden rounded-[18px] border border-black/10 bg-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                <div className="flex h-12 items-center border-r border-black/8 px-4 text-sm text-foreground/48">
                  USD
                </div>
                <Input
                  id="amount"
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) =>
                    setAmountByInvoice((current) => ({
                      ...current,
                      [invoice.id]: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 border-b border-black/10 pb-8">
            <h2 className="text-2xl font-semibold text-foreground">3. Bank Information</h2>
            <p className="text-sm text-foreground/62">Select the bank where you want to receive the funds</p>
            <div>
              <Label htmlFor="addressId">Select bank</Label>
              <Select
                id="addressId"
                value={selectedAddressId}
                onChange={(event) =>
                  setAddressByInvoice((current) => ({
                    ...current,
                    [invoice.id]: event.target.value,
                  }))
                }
              >
                <option value="">Select...</option>
                {payoutAddresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {getMaskedBankLabel(address.bank_account?.last4 || null, address.bank_account?.number || null)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">4. Payout Information</h2>
            <div className="rounded-[18px] border border-black/10 bg-white px-5 py-5">
              <p className="text-base font-semibold text-foreground">Standard payout terms</p>
              <p className="mt-3 text-sm leading-7 text-foreground/64">
                The rate will be booked within the next 60 minutes, subject to processing timelines. The final rate
                reflects market conditions at the time of payout.
              </p>

              <div className="mt-4 space-y-3 border-t border-black/10 pt-4">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-2 text-foreground/72">
                    <BadgeIndianRupee className="h-4 w-4 text-primary" />
                    <span>FX Rate: To be booked in 60 mins</span>
                  </div>
                  <button
                    type="button"
                    className="text-sm font-semibold text-primary"
                    onClick={() => void quoteQuery.refetch()}
                  >
                    View Current Rate
                  </button>
                </div>
                <div className="flex items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-2 text-foreground/72">
                    <Landmark className="h-4 w-4 text-primary" />
                    <span>Funds ETA:</span>
                  </div>
                  <span className="font-semibold text-foreground">{payoutDateLabel}</span>
                </div>
              </div>

              <div className="mt-6 border-t border-black/10 pt-4">
                <p className="text-lg font-semibold text-foreground">
                  Supercharge your payout{" "}
                  <span className="ml-2 text-sm font-semibold text-foreground/55">(Optional)</span>
                </p>

                <div className="mt-4 rounded-[16px] border border-black/10 bg-white px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Get guaranteed INR by locking the FX rate</p>
                      <p className="mt-1 text-xs text-foreground/52">
                        FX Charges: 0.05% rate lock fee (included in the rate)
                      </p>
                    </div>
                    {selectedQuoteLock ? (
                      <button
                        type="button"
                        className="text-sm font-semibold text-[rgb(190,51,51)]"
                        onClick={() =>
                          setQuoteLockByInvoice((current) => ({
                            ...current,
                            [invoice.id]: null,
                          }))
                        }
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="text-sm font-semibold text-primary"
                        onClick={async () => {
                          try {
                            const quoteLock = await createQuoteLock.mutateAsync({
                              amount,
                              buyCurrency: "INR",
                              exporterAccountId: invoice.exporterAccountId,
                              sellCurrency: "USD",
                            });
                            setQuoteLockByInvoice((current) => ({
                              ...current,
                              [invoice.id]: quoteLock,
                            }));
                            toast.success("Rate locked.");
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Could not lock the FX rate.");
                          }
                        }}
                        disabled={createQuoteLock.isPending}
                      >
                        Add
                      </button>
                    )}
                  </div>

                  <div className="mt-4 rounded-[14px] bg-[rgba(105,126,255,0.06)] px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Lock className={`h-4 w-4 ${selectedQuoteLock ? "text-primary" : "text-foreground/35"}`} />
                      <p className="text-sm font-semibold text-foreground">Locked FX Rate</p>
                      <span className="rounded-full bg-[rgba(105,126,255,0.12)] px-2 py-0.5 text-xs font-semibold text-primary">
                        {formatCountdown(expiryMs)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-foreground/72">
                      {effectiveRate > 0 ? effectiveRate.toFixed(5) : "Waiting for rate"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {balanceLow ? (
            <p className="rounded-2xl bg-[rgba(218,70,70,0.08)] px-4 py-3 text-sm text-[rgb(190,51,51)]">
              Common balance is lower than the reconciliation amount. Top up the connected user balance before continuing.
            </p>
          ) : !balanceKnown ? (
            <p className="rounded-2xl bg-[rgba(105,126,255,0.10)] px-4 py-3 text-sm text-primary">
              Common balance is not available yet. Click Refresh once the connected user balance is loaded.
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button
              className="h-12 px-10"
              disabled={!canSubmit}
              onClick={async () => {
                try {
                  await reconcileReceivable.mutateAsync({
                    addressId: selectedAddressId || undefined,
                    amount,
                    liveFx: selectedQuoteLock ? "disabled" : "enabled",
                    quoteLockId: selectedQuoteLock?.quoteLock.id,
                  });
                  toast.success("Receivable reconciled.");
                  router.push(`/receivables/${invoice.id}`);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not reconcile the receivable.");
                }
              }}
            >
              Submit
            </Button>
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard className="space-y-4">
            <div className="overflow-hidden rounded-[16px] border border-black/10 bg-white">
              <div className="flex items-start justify-between gap-4 px-5 py-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[12px] border border-black/10 bg-white">
                    <FileText className="h-6 w-6 text-foreground/70" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground/70">Receivable</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{getInvoiceLabel(invoice)}</p>
                  </div>
                </div>
                <Link href={`/receivables/${invoice.id}`} className="text-sm font-semibold text-primary">
                  View Receivable
                </Link>
              </div>
              <div className="border-t border-black/8 px-5 py-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[12px] border border-black/10 bg-white">
                    <User className="h-6 w-6 text-foreground/70" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground/70">Partner</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {getPartnerLegalName(invoice.partnerSnapshot)}
                    </p>
                    <div className="mt-2">
                      <StatusBadge status={invoice.receivableStatus} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard className="space-y-4">
            <div className="space-y-4 px-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground/60">Gross Amount</span>
                <span className="font-semibold text-foreground">{formatCurrency(amountValue, "USD")}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground/60">Payout Fee</span>
                <span className="font-semibold text-[rgb(190,51,51)]">-USD 9.00</span>
              </div>
              <div className="border-t border-black/10" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground/60">Net Amount</span>
                <span className="font-semibold text-foreground">{formatCurrency(Math.max(0, amountValue - 9), "USD")}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground/60">Transaction Rate</span>
                <span className="text-right font-semibold text-foreground">To be booked in 60 mins</span>
              </div>
              <div className="border-t border-black/10" />

              <div className="flex items-center justify-between gap-3">
                <span className="text-lg font-semibold text-foreground">Gross Payout Amount</span>
                <button type="button" className="text-sm font-semibold text-primary">
                  View indicative
                </button>
              </div>
              <div className="rounded-[14px] bg-[rgba(105,126,255,0.10)] px-4 py-4 text-sm text-primary">
                {selectedQuoteLock ? (
                  <p>
                    Locked FX applied. Indicative payout:{" "}
                    {payoutAmountInr > 0 ? formatCurrency(payoutAmountInr, "INR") : "Waiting"}
                  </p>
                ) : (
                  <>
                    <p>Only indicative FX rate can be shown as the rate has not been locked.</p>
                    <p className="mt-2 font-semibold">Get INR & rate guarantee with Rate Lock.</p>
                  </>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/42">Payout to</p>
            <p className="mt-2 text-lg font-semibold text-foreground">
              {selectedAddress
                ? getMaskedBankLabel(selectedAddress.bank_account?.last4 || null, selectedAddress.bank_account?.number || null)
                : "Select a bank"}
            </p>
            <p className="mt-2 text-sm text-foreground/58">Payout on: {payoutDateLabel}</p>
          </SectionCard>
        </div>
      </div>

      {connectedUserQuery.isError ? (
        <SectionCard>
          <p className="text-sm text-[rgb(190,51,51)]">
            {connectedUserQuery.error instanceof Error
              ? connectedUserQuery.error.message
              : "Could not load connected user payout details."}
          </p>
        </SectionCard>
      ) : null}
    </div>
  );
}
