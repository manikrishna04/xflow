"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  BadgeIndianRupee,
  ClipboardList,
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useConnectedUserQuery,
  useCreatePayoutMutation,
  useInvoiceStatusQuery,
  useSimulatePaymentMutation,
  useSyncInvoiceStatusMutation,
} from "@/lib/hooks/use-tradedge-actions";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { formatCurrency, formatDateTime } from "@/lib/tradedge/format";
import {
  derivePayoutAmountInr,
  extractInstructionItems,
  isReceivableSettled,
} from "@/lib/tradedge/invoices";
import { formatConnectedUserStatus, isConnectedUserActive } from "@/lib/tradedge/onboarding";
import { useTradEdgeStore } from "@/lib/store/tradedge-store";

function canTriggerPayout(status?: string | null) {
  const normalized = (status || "").toLowerCase();
  return ["completed", "paid", "reconciled", "activated"].includes(normalized);
}

export function InvoiceDetailScreen({
  basePath = "/invoices",
  invoiceId,
  variant = "invoice",
}: {
  basePath?: string;
  invoiceId: string;
  variant?: "invoice" | "receivable";
}) {
  const hydrated = useHydrated();
  const exporter = useTradEdgeStore((state) => state.exporter);
  const invoice = useTradEdgeStore(
    (state) => state.invoices.find((item) => item.id === invoiceId) ?? null,
  );
  const connectedUserQuery = useConnectedUserQuery(exporter?.accountId);
  const syncStatus = useSyncInvoiceStatusMutation();
  const statusQuery = useInvoiceStatusQuery(invoice);
  const simulatePayment = useSimulatePaymentMutation(invoice);
  const createPayout = useCreatePayoutMutation(invoice);
  const [payoutAmount, setPayoutAmount] = useState<string | null>(null);

  if (hydrated && !invoice) {
    return (
      <EmptyState
        title={`${variant === "receivable" ? "Receivable" : "Invoice"} not found in local storage`}
        description="This build is frontend-only, so invoice records live in the browser. Re-open the flow from the same browser session or create the invoice again."
        actionHref={basePath}
        actionLabel={`Back to ${variant === "receivable" ? "receivables" : "invoices"}`}
      />
    );
  }

  if (!invoice) {
    return null;
  }

  const resolvedPayoutAmount =
    payoutAmount ?? String(invoice.payoutAmountInr ?? derivePayoutAmountInr(invoice.amountUsd));
  const instructionItems = extractInstructionItems(invoice.receivableSnapshot);
  const accountStatus = connectedUserQuery.data?.account.status ?? exporter?.status;
  const transactionsEnabled = isConnectedUserActive(accountStatus);
  const recordLabel = variant === "receivable" ? "receivable" : "invoice";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={variant === "receivable" ? "Receivable Detail" : "Invoice Detail"}
        title={invoice.referenceId}
        description={`Buyer ${invoice.buyerName} in ${invoice.buyerCountry}. Use this page to check payment instructions, simulate settlement in sandbox, and trigger the connected exporter's payout for this ${recordLabel}.`}
        actions={
          <>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await syncStatus.mutateAsync(invoice);
                  toast.success(`Live ${recordLabel} status synced from Xflow.`);
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : `Could not sync ${recordLabel} status.`,
                  );
                }
              }}
              disabled={syncStatus.isPending}
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh status
            </Button>
            <Link href={`/pay/${invoice.id}`}>
              <Button variant="secondary">
                Payment page
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </Link>
          </>
        }
      />

      {invoice.creationWarning ? (
        <SectionCard>
          <p className="data-kicker">Creation Warning</p>
          <h2 className="mt-3 text-2xl font-semibold">Receivable needs attention</h2>
          <p className="mt-3 text-sm leading-7 text-[rgb(170,97,23)]">
            {invoice.creationWarning}
          </p>
        </SectionCard>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <SectionCard className="p-5">
          <p className="data-kicker">Amount</p>
          <p className="mt-3 text-3xl font-semibold">{formatCurrency(invoice.amountUsd, "USD")}</p>
          <p className="mt-2 text-sm text-foreground/62">Receivable in buyer currency</p>
        </SectionCard>
        <SectionCard className="p-5">
          <p className="data-kicker">Receivable</p>
          <div className="mt-3">
            <StatusBadge status={invoice.receivableStatus} />
          </div>
          <p className="mt-3 text-sm text-foreground/62">{invoice.receivableId}</p>
        </SectionCard>
        <SectionCard className="p-5">
          <p className="data-kicker">Payout</p>
          <div className="mt-3">
            {invoice.payoutStatus ? (
              <StatusBadge status={invoice.payoutStatus} />
            ) : (
              <span className="text-sm text-foreground/55">Not started</span>
            )}
          </div>
          <p className="mt-3 text-sm text-foreground/62">
            {invoice.payoutId || "No payout created yet"}
          </p>
        </SectionCard>
      </div>

      {!transactionsEnabled ? (
        <SectionCard>
          <p className="data-kicker">Account Gate</p>
          <h2 className="mt-3 text-2xl font-semibold">
            Connected user is {formatConnectedUserStatus(accountStatus)}
          </h2>
          <p className="mt-3 text-sm leading-7 text-foreground/65">
            Sandbox payment and payout actions stay blocked until the connected user reaches Active.
          </p>
          <Link href="/onboarding" className="mt-6 inline-flex">
            <Button>Open Onboarding</Button>
          </Link>
        </SectionCard>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <SectionCard>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold">Payment instructions</h2>
                <p className="mt-1 text-sm text-foreground/65">
                  These are normalized from the receivable response when Xflow sends
                  instruction fields. A safe fallback appears if explicit bank details
                  are absent.
                </p>
              </div>
            </div>

            <dl className="mt-6 grid gap-4 md:grid-cols-2">
              {instructionItems.map((item) => (
                <div key={`${item.label}-${item.value}`} className="rounded-[22px] bg-black/[0.03] px-4 py-4">
                  <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/42">
                    {item.label}
                  </dt>
                  <dd className="mt-2 text-sm leading-7 text-foreground/74">{item.value}</dd>
                </div>
              ))}
            </dl>
          </SectionCard>

          <SectionCard>
            <p className="data-kicker">Status Timeline</p>
            <h2 className="mt-3 text-2xl font-semibold">Flow checkpoints</h2>
            <div className="mt-6 space-y-3">
              {[
                {
                  label: "Connected exporter ready",
                  meta: invoice.exporterAccountId,
                  status: "completed",
                },
                {
                  label: "Buyer partner created",
                  meta: invoice.partnerId,
                  status: invoice.partnerSnapshot?.status || "completed",
                },
                {
                  label: "Receivable issued",
                  meta: invoice.receivableId,
                  status: invoice.receivableStatus || "pending",
                },
                {
                  label: "Payout lifecycle",
                  meta: invoice.payoutId || "Waiting for payout trigger",
                  status: invoice.payoutStatus || "not_started",
                },
              ].map((step) => (
                <div
                  key={step.label}
                  className="flex flex-col gap-3 rounded-[22px] border border-black/8 bg-white/72 px-4 py-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{step.label}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.12em] text-foreground/42">
                      {step.meta}
                    </p>
                  </div>
                  <StatusBadge status={step.status} />
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(255,167,38,0.14)] text-[rgb(170,97,23)]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold">Sandbox payment</h2>
                <p className="mt-1 text-sm text-foreground/65">
                  Use the receivable test endpoint defined in your prompt to simulate an inbound payment.
                </p>
              </div>
            </div>

            <Button
              className="mt-6 w-full"
              disabled={
                simulatePayment.isPending ||
                isReceivableSettled(invoice.receivableStatus) ||
                !transactionsEnabled
              }
              onClick={async () => {
                try {
                  await simulatePayment.mutateAsync();
                  toast.success("Sandbox payment triggered.");
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Could not simulate the payment.",
                  );
                }
              }}
            >
              Simulate Payment
            </Button>
          </SectionCard>

          <SectionCard>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(15,150,136,0.1)] text-primary">
                <BadgeIndianRupee className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold">Trigger payout</h2>
                <p className="mt-1 text-sm text-foreground/65">
                  This issues the INR payout request through the server proxy. The default amount is an indicative FX conversion for the demo.
                </p>
              </div>
            </div>

            <div className="mt-6">
              <Input
                inputMode="decimal"
                value={resolvedPayoutAmount}
                onChange={(event) => setPayoutAmount(event.target.value)}
              />
            </div>

            <Button
              className="mt-4 w-full"
              disabled={
                createPayout.isPending ||
                Boolean(invoice.payoutId) ||
                !canTriggerPayout(invoice.receivableStatus) ||
                !transactionsEnabled
              }
              onClick={async () => {
                try {
                  await createPayout.mutateAsync(Number(resolvedPayoutAmount));
                  toast.success("Payout request created.");
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Could not create payout.",
                  );
                }
              }}
            >
              Trigger Payout
            </Button>

            {!canTriggerPayout(invoice.receivableStatus) ? (
              <p className="mt-3 text-sm text-foreground/58">
                Wait until the receivable is paid or activated before starting the payout.
              </p>
            ) : null}
          </SectionCard>

          <SectionCard>
            <p className="data-kicker">Buyer Link</p>
            <h2 className="mt-3 text-2xl font-semibold">Public payment page</h2>
            <p className="mt-3 text-sm leading-7 text-foreground/65">
              {hydrated && typeof window !== "undefined"
                ? `${window.location.origin}/pay/${invoice.id}`
                : `/pay/${invoice.id}`}
            </p>
            <p className="mt-3 text-sm text-foreground/56">
              Because there is no backend, the buyer page can only load invoice data from the same browser local storage.
            </p>
          </SectionCard>

          <SectionCard>
            <p className="data-kicker">Last Synced</p>
            <h2 className="mt-3 text-2xl font-semibold">{formatDateTime(invoice.lastSyncedAt)}</h2>
            <p className="mt-3 text-sm text-foreground/62">
              {statusQuery.isFetching
                ? "Polling Xflow for updates..."
                : "Idle until the next manual refresh or auto-poll cycle."}
            </p>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
