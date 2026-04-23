"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, RefreshCcw, ShieldAlert, ShieldCheck, Wallet } from "lucide-react";
import toast from "react-hot-toast";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useConnectedUserQuery,
  useSyncAllInvoiceStatusesMutation,
  useTopUpConnectedUserBalanceMutation,
} from "@/lib/hooks/use-tradedge-actions";
import {
  canResumeActivation,
  formatConnectedUserStatus,
  formatOnboardingSectionLabel,
  isConnectedUserActive,
} from "@/lib/tradedge/onboarding";
import {
  formatCurrency,
  formatCurrencyAmount,
  formatDateTime,
  parseCurrencyAmount,
} from "@/lib/tradedge/format";
import { isReceivableSettled } from "@/lib/tradedge/invoices";
import { useTradEdgeStore } from "@/lib/store/tradedge-store";
import type { XflowMoneyAmount } from "@/types/xflow";

function getBalanceAmountForCurrency(
  amounts: XflowMoneyAmount[] | null | undefined,
  currency: string,
) {
  const normalizedCurrency = currency.trim().toUpperCase();
  const match = amounts?.find((item) => item.currency?.toUpperCase() === normalizedCurrency);

  return parseCurrencyAmount(match?.amount);
}

function formatBalanceBucket(amounts: XflowMoneyAmount[] | null | undefined) {
  if (!amounts?.length) {
    return "No funds";
  }

  const meaningfulAmounts = amounts.filter((item) => parseCurrencyAmount(item.amount) > 0);
  const source = meaningfulAmounts.length > 0 ? meaningfulAmounts : amounts.slice(0, 3);

  return source
    .map((item) => formatCurrencyAmount(item.amount, item.currency))
    .join(" • ");
}

export function DashboardScreen() {
  const exporter = useTradEdgeStore((state) => state.exporter);
  const invoices = useTradEdgeStore((state) => state.invoices);
  const syncAll = useSyncAllInvoiceStatusesMutation();
  const connectedUserQuery = useConnectedUserQuery(exporter?.accountId);
  const topUpBalance = useTopUpConnectedUserBalanceMutation(exporter?.accountId);
  const snapshot = connectedUserQuery.data;
  const [topUpAmount, setTopUpAmount] = useState("100.00");
  const [topUpCurrency, setTopUpCurrency] = useState("USD");
  const [topUpDescription, setTopUpDescription] = useState("");

  const totalReceived = invoices
    .filter((invoice) => isReceivableSettled(invoice.receivableStatus))
    .reduce((sum, invoice) => sum + invoice.amountUsd, 0);

  const pendingReceivables = invoices.filter(
    (invoice) => !isReceivableSettled(invoice.receivableStatus),
  ).length;

  const paidInvoices = invoices.filter((invoice) =>
    isReceivableSettled(invoice.receivableStatus),
  ).length;

  if (!exporter) {
    return (
      <EmptyState
        title="Start connected-user onboarding"
        description="Create and submit the connected user from the onboarding flow. Once the account exists, this dashboard can show review status, completion, and transaction readiness."
        actionHref="/onboarding"
        actionLabel="Start Onboarding"
      />
    );
  }

  const accountStatus = snapshot?.account.status ?? exporter.status ?? "draft";
  const readyForTransactions = isConnectedUserActive(accountStatus);
  const missingItems = snapshot?.requiredItems ?? [];
  const availableUsdBalance = getBalanceAmountForCurrency(snapshot?.balance?.available, "USD");
  const treasuryUnavailable = Boolean(snapshot?.treasuryWarning);
  const topUpDisabled = !snapshot?.topUpSourceAccountId || topUpBalance.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title="Connected user lifecycle"
        description="Track connected-user onboarding, Xflow review status, and when the account becomes ready for transaction flows."
        actions={
          <>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await Promise.all([
                    connectedUserQuery.refetch(),
                    invoices.length ? syncAll.mutateAsync() : Promise.resolve(),
                  ]);
                  toast.success("Connected user and invoice statuses refreshed.");
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Could not refresh dashboard.",
                  );
                }
              }}
              disabled={connectedUserQuery.isFetching || syncAll.isPending}
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh statuses
            </Button>
            <Link href={readyForTransactions ? "/invoices/new" : "/onboarding"}>
              <Button>{readyForTransactions ? "Issue invoice" : "Open onboarding"}</Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Account Status"
          value={formatConnectedUserStatus(accountStatus)}
          hint="Live account lifecycle pulled from Xflow."
        />
        <StatCard
          label="KYC Progress"
          value={`${snapshot?.progress.percent ?? 0}%`}
          hint={`${snapshot?.progress.completed ?? 0} of ${snapshot?.progress.total ?? 25} onboarding checkpoints completed.`}
        />
        <StatCard
          label="Pending Receivables"
          value={String(pendingReceivables)}
          hint="Receivables waiting for buyer payment or settlement."
        />
        <StatCard
          label="Total Received"
          value={formatCurrency(totalReceived, "USD")}
          hint="Completed receivables stored in this workspace."
        />
        <StatCard
          label="Available Balance"
          value={formatCurrency(availableUsdBalance, "USD")}
          hint="Current USD balance available within Xflow for this connected user."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="data-kicker">Account Health</p>
              <h2 className="mt-3 text-3xl font-semibold">Status and required information</h2>
            </div>
            <StatusBadge status={accountStatus} label={formatConnectedUserStatus(accountStatus)} />
          </div>

          <div className="mt-6 rounded-[24px] bg-black/[0.03] p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">
                {readyForTransactions ? "Transactions enabled" : "Transactions blocked"}
              </p>
              {readyForTransactions ? (
                <ShieldCheck className="h-5 w-5 text-[rgb(34,139,92)]" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-[rgb(170,97,23)]" />
              )}
            </div>
            <p className="mt-2 text-sm leading-7 text-foreground/66">
              {readyForTransactions
                ? "The connected user is active, so partner, receivable, and payout flows are available."
                : "Incomplete or reviewing accounts cannot create receivables or payouts yet."}
            </p>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-foreground/45">
              <span>Completion</span>
              <span>{snapshot?.progress.percent ?? 0}%</span>
            </div>
            <div className="mt-3 h-3 rounded-full bg-black/[0.06]">
              <div
                className="h-3 rounded-full bg-[linear-gradient(90deg,#0f9688_0%,#ffa726_100%)]"
                style={{ width: `${snapshot?.progress.percent ?? 0}%` }}
              />
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {missingItems.length > 0 ? (
              missingItems.map((item) => (
                <div
                  key={item.field}
                  className="flex items-center justify-between gap-3 rounded-[22px] border border-black/8 bg-white/75 px-4 py-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.12em] text-foreground/42">
                      {formatOnboardingSectionLabel(item.section)}
                    </p>
                  </div>
                  <StatusBadge status="input_required" label="Required" />
                </div>
              ))
            ) : (
              <div className="rounded-[22px] bg-[rgba(34,139,92,0.08)] px-4 py-4 text-sm text-[rgb(34,139,92)]">
                No missing onboarding fields detected in the currently modeled flow.
              </div>
            )}
          </div>

          {canResumeActivation(accountStatus) ? (
            <Link href="/onboarding" className="mt-6 inline-flex">
              <Button>Complete onboarding</Button>
            </Link>
          ) : null}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="data-kicker">Balance & Top-Ups</p>
                <h2 className="mt-3 text-3xl font-semibold">Connected-user treasury</h2>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(16,150,136,0.09)] px-4 py-2 text-sm font-semibold text-primary">
                <Wallet className="h-4 w-4" />
                {snapshot?.topUpSourceAccountId ? "Platform funded" : "Top-up unavailable"}
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <div className="rounded-[22px] bg-black/[0.03] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/45">
                  Available
                </p>
                <p className="mt-3 text-lg font-semibold text-foreground">
                  {formatBalanceBucket(snapshot?.balance?.available)}
                </p>
              </div>
              <div className="rounded-[22px] bg-black/[0.03] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/45">
                  Pending
                </p>
                <p className="mt-3 text-lg font-semibold text-foreground">
                  {formatBalanceBucket(snapshot?.balance?.pending)}
                </p>
              </div>
              <div className="rounded-[22px] bg-black/[0.03] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/45">
                  Processing
                </p>
                <p className="mt-3 text-lg font-semibold text-foreground">
                  {formatBalanceBucket(snapshot?.balance?.processing)}
                </p>
              </div>
              <div className="rounded-[22px] bg-black/[0.03] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/45">
                  Payout Processing
                </p>
                <p className="mt-3 text-lg font-semibold text-foreground">
                  {formatBalanceBucket(snapshot?.balance?.payout_processing)}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-[24px] border border-black/8 bg-white/70 p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Top up this connected user</p>
                  <p className="mt-1 text-sm leading-7 text-foreground/66">
                    Create a `platform_debit` transfer from the configured platform account into
                    this connected user.
                  </p>
                </div>
                {snapshot?.topUpSourceAccountId ? (
                  <p className="text-xs uppercase tracking-[0.14em] text-foreground/45">
                    Source {snapshot.topUpSourceAccountId}
                  </p>
                ) : null}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-[1fr_120px]">
                <Input
                  placeholder="Amount"
                  inputMode="decimal"
                  value={topUpAmount}
                  onChange={(event) => setTopUpAmount(event.target.value)}
                />
                <Input
                  placeholder="USD"
                  maxLength={3}
                  value={topUpCurrency}
                  onChange={(event) => setTopUpCurrency(event.target.value.toUpperCase())}
                />
              </div>

              <div className="mt-3">
                <Input
                  placeholder="Description for the transfer (optional)"
                  value={topUpDescription}
                  onChange={(event) => setTopUpDescription(event.target.value)}
                />
              </div>

              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-foreground/62">
                  {snapshot?.topUpSourceAccountId
                    ? "Use this to credit working balance from the platform account into the connected user."
                    : "Add XFLOW_PARENT_ACCOUNT_ID or XFLOW_PLATFORM_ACCOUNT_ID to enable platform-funded top-ups."}
                </p>
                <Button
                  onClick={async () => {
                    try {
                      const result = await topUpBalance.mutateAsync({
                        amount: topUpAmount.trim(),
                        currency: topUpCurrency.trim().toUpperCase(),
                        description: topUpDescription.trim() || undefined,
                      });

                      setTopUpDescription("");
                      toast.success(
                        `Top-up transfer ${result.transfer.status || "initialized"} for ${formatCurrencyAmount(
                          result.transfer.from?.amount,
                          result.transfer.from?.currency,
                        )}.`,
                      );
                    } catch (error) {
                      toast.error(
                        error instanceof Error ? error.message : "Could not top up the balance.",
                      );
                    }
                  }}
                  disabled={topUpDisabled}
                >
                  {topUpBalance.isPending ? "Processing top-up" : "Top up balance"}
                </Button>
              </div>
            </div>

            {treasuryUnavailable ? (
              <div className="mt-4 rounded-[22px] bg-[rgba(242,153,74,0.14)] px-4 py-4 text-sm text-[rgb(170,97,23)]">
                {snapshot?.treasuryWarning}
              </div>
            ) : null}

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Recent top-ups</p>
                <p className="text-xs uppercase tracking-[0.14em] text-foreground/45">
                  Latest platform debits
                </p>
              </div>
              <div className="mt-4 space-y-3">
                {snapshot?.recentTopups.length ? (
                  snapshot.recentTopups.map((transfer) => (
                    <div
                      key={transfer.id}
                      className="flex flex-col gap-3 rounded-[22px] border border-black/8 bg-white/75 px-4 py-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {formatCurrencyAmount(
                            transfer.from?.amount ?? transfer.to?.amount,
                            transfer.to?.currency ?? transfer.from?.currency,
                          )}
                        </p>
                        <p className="mt-1 text-sm text-foreground/64">
                          {transfer.description || "Platform-funded balance top-up"}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.12em] text-foreground/40">
                          {formatDateTime(transfer.created)}
                        </p>
                      </div>
                      <StatusBadge status={transfer.status} />
                    </div>
                  ))
                ) : (
                  <div className="rounded-[22px] bg-black/[0.03] px-4 py-4 text-sm text-foreground/65">
                    No platform top-ups have been created for this connected user yet.
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard>
            <p className="data-kicker">Connected User</p>
            <h2 className="mt-3 text-3xl font-semibold">{exporter.legalName}</h2>
            <div className="mt-4">
              <StatusBadge status={accountStatus} label={formatConnectedUserStatus(accountStatus)} />
            </div>
            <div className="mt-5 space-y-3 text-sm text-foreground/68">
              <div>
                <span className="font-semibold text-foreground">Account ID:</span>{" "}
                {exporter.accountId}
              </div>
              <div>
                <span className="font-semibold text-foreground">Business email:</span>{" "}
                {snapshot?.account.business_details?.email || exporter.email}
              </div>
              <div>
                <span className="font-semibold text-foreground">Last synced:</span>{" "}
                {formatDateTime(exporter.lastSyncedAt || exporter.createdAt)}
              </div>
            </div>
          </SectionCard>

          <SectionCard>
            <p className="data-kicker">Lifecycle Map</p>
            <h2 className="mt-3 text-3xl font-semibold">Onboard to Review to Transactions</h2>
            <div className="mt-6 space-y-4">
              {[
                "Capture the full connected-user profile from the onboarding route.",
                "Submit the account, required people, bank details, and declarations in one flow.",
                "Let Xflow review the submission and move the account to active.",
                "Only active accounts can create receivables and payouts.",
              ].map((step) => (
                <div
                  key={step}
                  className="rounded-[22px] bg-black/[0.03] px-4 py-3 text-sm text-foreground/68"
                >
                  {step}
                </div>
              ))}
            </div>
            <Link
              href={readyForTransactions ? "/invoices" : "/onboarding"}
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary"
            >
              {readyForTransactions ? "Open invoice ledger" : "Open onboarding"}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </SectionCard>

          <SectionCard>
            <p className="data-kicker">Invoice Snapshot</p>
            <h2 className="mt-3 text-3xl font-semibold">{String(paidInvoices)} paid invoices</h2>
            <p className="mt-3 text-sm leading-7 text-foreground/65">
              Invoice objects remain local in this frontend-only build, while account status
              and transaction readiness are refreshed through server-side Xflow proxy routes.
            </p>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
