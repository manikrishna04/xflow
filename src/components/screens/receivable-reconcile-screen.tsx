"use client";

import Link from "next/link";
import { ArrowLeft, BadgeIndianRupee, Landmark, Lock, RefreshCcw } from "lucide-react";
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
import { formatCurrency, formatDateTime, parseCurrencyAmount } from "@/lib/tradedge/format";
import { formatConnectedUserStatus, isConnectedUserActive } from "@/lib/tradedge/onboarding";
import { getPartnerLegalName } from "@/lib/tradedge/partners";
import { useTradEdgeStore } from "@/lib/store/tradedge-store";
import type { ReceivableQuoteLockSnapshot } from "@/types/tradedge";
import type { XflowMoneyAmount } from "@/types/xflow";

function getBalanceAmountForCurrency(
  amounts: XflowMoneyAmount[] | null | undefined,
  currency: string,
) {
  const normalizedCurrency = currency.trim().toUpperCase();
  const match = amounts?.find((item) => item.currency?.toUpperCase() === normalizedCurrency);

  return parseCurrencyAmount(match?.amount);
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

export function ReceivableReconcileScreen({ invoiceId }: { invoiceId: string }) {
  const hydrated = useHydrated();
  const router = useRouter();
  const exporter = useTradEdgeStore((state) => state.exporter);
  const invoice = useTradEdgeStore(
    (state) => state.invoices.find((item) => item.id === invoiceId) ?? null,
  );
  const connectedUserQuery = useConnectedUserQuery(exporter?.accountId);
  const createQuoteLock = useCreateQuoteLockMutation(invoice);
  const reconcileReceivable = useReconcileReceivableMutation(invoice);
  const [amount, setAmount] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [selectedQuoteLock, setSelectedQuoteLock] = useState<ReceivableQuoteLockSnapshot | null>(null);
  const [now, setNow] = useState(Date.now());

  const pendingAmount = useMemo(() => (invoice ? getPendingAmount(invoice) : 0), [invoice]);

  useEffect(() => {
    if (!amount && pendingAmount > 0) {
      setAmount(pendingAmount.toFixed(2));
    }
  }, [amount, pendingAmount]);

  useEffect(() => {
    if (!selectedAddressId && connectedUserQuery.data?.payoutAddresses?.[0]?.id) {
      setSelectedAddressId(connectedUserQuery.data.payoutAddresses[0].id);
    }
  }, [connectedUserQuery.data, selectedAddressId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedQuoteLock) {
      return;
    }

    if (selectedQuoteLock.quoteLock.lock_amount?.amount !== amount) {
      setSelectedQuoteLock(null);
    }
  }, [amount, selectedQuoteLock]);

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
  const selectedAddress = payoutAddresses.find((address) => address.id === selectedAddressId) ?? null;
  const commonBalance = getBalanceAmountForCurrency(snapshot?.balance?.available, "USD");
  const effectiveRate = selectedQuoteLock
    ? getRateValue(selectedQuoteLock.quoteLock)
    : getRateValue(quoteQuery.data?.quote);
  const payoutAmountInr = Number((parseCurrencyAmount(amount) * effectiveRate).toFixed(2));
  const expiryMs = selectedQuoteLock
    ? (getExpiryTimestamp(selectedQuoteLock.quoteLock.valid_to) ?? 0) - now
    : (getExpiryTimestamp(quoteQuery.data?.quote.rate?.valid_to) ?? 0) - now;
  const payoutDateLabel = formatDateTime(new Date(now + 24 * 60 * 60 * 1000).toISOString());
  const canSubmit =
    transactionsEnabled &&
    Boolean(selectedAddressId) &&
    parseCurrencyAmount(amount) > 0 &&
    commonBalance >= parseCurrencyAmount(amount) &&
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
                Back to receivable
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => {
                void Promise.all([connectedUserQuery.refetch(), quoteQuery.refetch()]);
              }}
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_340px]">
        <SectionCard className="space-y-8">
          <div className="space-y-4 border-b border-black/8 pb-8">
            <h2 className="text-2xl font-semibold text-foreground">1. Receivable</h2>
            <p className="text-sm text-foreground/62">Select the receivable to reconcile.</p>
            <div>
              <Label htmlFor="receivableId">Select USD receivable</Label>
              <Select id="receivableId" value={invoice.id} disabled>
                <option value={invoice.id}>
                  {invoice.receivableSnapshot?.invoice?.reference_number || invoice.referenceId}
                </option>
              </Select>
              <p className="mt-3 text-sm text-foreground/58">
                Pending amount on invoice: {formatCurrency(pendingAmount, "USD")}
              </p>
            </div>
          </div>

          <div className="space-y-4 border-b border-black/8 pb-8">
            <h2 className="text-2xl font-semibold text-foreground">2. Amount</h2>
            <p className="text-sm text-foreground/62">Enter the amount to reconcile.</p>

            <div className="rounded-[22px] border border-black/8 bg-white px-4 py-4">
              <div className="flex items-center justify-between gap-3 text-sm font-semibold text-foreground/72">
                <span>Common Balance</span>
                <span>{formatCurrency(commonBalance, "USD")}</span>
              </div>
            </div>

            <div>
              <Label htmlFor="amount">Enter the amount to reconcile</Label>
              <div className="flex rounded-[22px] border border-black/10 bg-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                <div className="flex h-12 items-center border-r border-black/8 px-4 text-sm text-foreground/48">
                  USD
                </div>
                <Input
                  id="amount"
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 border-b border-black/8 pb-8">
            <h2 className="text-2xl font-semibold text-foreground">3. Bank Information</h2>
            <p className="text-sm text-foreground/62">Select the bank where you want to receive the funds.</p>
            <div>
              <Label htmlFor="addressId">Payout bank</Label>
              <Select
                id="addressId"
                value={selectedAddressId}
                onChange={(event) => setSelectedAddressId(event.target.value)}
              >
                <option value="">Select...</option>
                {payoutAddresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {`${address.name || "Account"}: **** ${address.bank_account?.last4 || address.bank_account?.number?.slice(-4) || "----"}`}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">4. Payout Information</h2>
            <div className="rounded-[24px] border border-black/8 bg-white/78 p-5">
              <p className="text-lg font-semibold text-foreground">Standard payout terms</p>
              <p className="mt-3 text-sm leading-7 text-foreground/64">
                The indicative FX rate refreshes automatically from Xflow quotes. If you want a guaranteed INR amount, lock the rate before you submit.
              </p>
              <div className="mt-4 space-y-3 border-t border-black/8 pt-4">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-2 text-foreground/72">
                    <BadgeIndianRupee className="h-4 w-4 text-primary" />
                    <span>
                      FX rate {selectedQuoteLock ? "locked" : "refreshes"} in {formatCountdown(expiryMs)}
                    </span>
                  </div>
                  <span className="font-semibold text-primary">
                    {effectiveRate > 0 ? `INR ${effectiveRate.toFixed(5)}` : "Waiting for rate"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-2 text-foreground/72">
                    <Landmark className="h-4 w-4 text-primary" />
                    <span>Indicative payout ETA</span>
                  </div>
                  <span className="font-semibold text-foreground">{payoutDateLabel}</span>
                </div>
              </div>

              <div className="mt-6 border-t border-black/8 pt-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-foreground">
                      Get guaranteed INR by locking the FX rate
                    </p>
                    <p className="mt-1 text-sm text-foreground/58">
                      Locking uses Xflow `POST /v1/quote_locks` for 120 seconds.
                    </p>
                  </div>
                  {selectedQuoteLock ? (
                    <button
                      type="button"
                      className="text-sm font-semibold text-[rgb(190,51,51)]"
                      onClick={() => setSelectedQuoteLock(null)}
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="text-sm font-semibold text-primary"
                      onClick={async () => {
                        try {
                          if (!invoice.exporterAccountId) {
                            throw new Error("Exporter account id is missing.");
                          }

                          const quoteLock = await createQuoteLock.mutateAsync({
                            amount,
                            buyCurrency: "INR",
                            exporterAccountId: invoice.exporterAccountId,
                            sellCurrency: "USD",
                          });
                          setSelectedQuoteLock(quoteLock);
                          toast.success("FX rate locked.");
                        } catch (error) {
                          toast.error(
                            error instanceof Error ? error.message : "Could not lock the FX rate.",
                          );
                        }
                      }}
                      disabled={createQuoteLock.isPending || !amount || parseCurrencyAmount(amount) <= 0}
                    >
                      Add
                    </button>
                  )}
                </div>

                <div className="mt-4 rounded-[20px] border border-black/10 bg-[rgba(105,126,255,0.05)] px-4 py-4">
                  <div className="flex items-center gap-2">
                    <Lock className={`h-4 w-4 ${selectedQuoteLock ? "text-primary" : "text-foreground/35"}`} />
                    <p className="text-sm font-semibold text-foreground">
                      {selectedQuoteLock ? "Locked FX rate" : "Current indicative FX rate"}
                    </p>
                    <span className="rounded-full bg-[rgba(105,126,255,0.12)] px-2 py-0.5 text-xs font-semibold text-primary">
                      {formatCountdown(expiryMs)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-foreground/72">
                    {effectiveRate > 0 ? effectiveRate.toFixed(5) : "Waiting for rate"}
                  </p>
                  <p className="mt-1 text-xs text-foreground/48">
                    FX Charges: 0.05% rate lock fee (display-only note for this flow).
                  </p>
                </div>
              </div>
            </div>
          </div>

          {commonBalance < parseCurrencyAmount(amount) ? (
            <p className="rounded-2xl bg-[rgba(218,70,70,0.08)] px-4 py-3 text-sm text-[rgb(190,51,51)]">
              Common balance is lower than the reconciliation amount. Top up the connected user balance before continuing.
            </p>
          ) : null}

          {connectedUserQuery.isError ? (
            <p className="rounded-2xl bg-[rgba(218,70,70,0.08)] px-4 py-3 text-sm text-[rgb(190,51,51)]">
              {connectedUserQuery.error instanceof Error
                ? connectedUserQuery.error.message
                : "Could not load connected user payout details."}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button
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
                  toast.error(
                    error instanceof Error ? error.message : "Could not reconcile the receivable.",
                  );
                }
              }}
            >
              Submit
            </Button>
          </div>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard className="space-y-4">
            <div className="rounded-[20px] border border-black/8 bg-white/80 px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/42">
                    Receivable
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {invoice.receivableSnapshot?.invoice?.reference_number || invoice.referenceId}
                  </p>
                  <p className="mt-1 text-sm text-foreground/58">
                    Due on {formatDateTime(invoice.receivableSnapshot?.invoice?.due_date || null)}
                  </p>
                </div>
                <Link href={`/receivables/${invoice.id}`} className="text-sm font-semibold text-primary">
                  View Receivable
                </Link>
              </div>
            </div>

            <div className="rounded-[20px] border border-black/8 bg-white/80 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/42">
                Partner
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {getPartnerLegalName(invoice.partnerSnapshot)}
              </p>
              <div className="mt-3">
                <StatusBadge status={invoice.receivableStatus} />
              </div>
            </div>
          </SectionCard>

          <SectionCard className="space-y-4">
            <div className="space-y-3 border-b border-dashed border-black/8 pb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground/58">Gross Amount</span>
                <span className="font-semibold text-foreground">{formatCurrency(parseCurrencyAmount(amount), "USD")}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground/58">Payout Fee</span>
                <span className="font-semibold text-[rgb(190,51,51)]">-USD 9.00</span>
              </div>
            </div>

            <div className="space-y-3 border-b border-dashed border-black/8 pb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground/58">Net Amount</span>
                <span className="font-semibold text-foreground">{formatCurrency(parseCurrencyAmount(amount), "USD")}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground/58">Transaction Rate</span>
                <span className="text-right font-semibold text-foreground">
                  {selectedQuoteLock ? `INR ${effectiveRate.toFixed(5)}` : `Refreshing in ${formatCountdown(expiryMs)}`}
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-lg font-semibold text-foreground">Payout Amount</span>
                <span className="text-2xl font-semibold text-foreground">
                  {payoutAmountInr > 0 ? formatCurrency(payoutAmountInr, "INR") : "Waiting"}
                </span>
              </div>
              <p className="mt-3 rounded-[18px] bg-[rgba(105,126,255,0.08)] px-4 py-3 text-sm text-primary">
                {selectedQuoteLock
                  ? "Guaranteed rate selected. Submit before the lock expires."
                  : "Only indicative FX is shown until you lock the rate."}
              </p>
            </div>
          </SectionCard>

          <SectionCard className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/42">
              Payout to
            </p>
            <p className="text-lg font-semibold text-foreground">
              {selectedAddress?.name || "Select a payout bank"}
            </p>
            <p className="text-sm text-foreground/58">
              {selectedAddress
                ? `Payout on: ${payoutDateLabel}`
                : "Choose a payout address from the connected user profile."}
            </p>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
