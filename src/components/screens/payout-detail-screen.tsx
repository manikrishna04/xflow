"use client";

import Link from "next/link";
import { ArrowLeft, Copy, RefreshCcw, Save } from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePayoutQuery, useUpdatePayoutMetadataMutation } from "@/lib/hooks/use-tradedge-actions";
import {
  formatCurrencyAmount,
  formatDate,
  formatDateTime,
  formatStatusLabel,
} from "@/lib/tradedge/format";
import { cn } from "@/lib/utils";
import { useTradEdgeStore } from "@/lib/store/tradedge-store";
import type { XflowPayout } from "@/types/xflow";

const TRACKING_STEPS = [
  {
    description: "Payout request was received by Xflow.",
    key: "payout_submitted_to_xflow",
    label: "Submitted to Xflow",
  },
  {
    description: "Xflow started processing the payout or shared it with a payment partner.",
    key: "payout_picked_for_processing",
    label: "Picked for Processing",
  },
  {
    description: "Payout processing completed and funds are moving through the rail.",
    key: "payout_processing_completed",
    label: "Processing Completed",
  },
  {
    description: "Funds were sent to the beneficiary bank account.",
    key: "payout_sent_to_beneficiary",
    label: "Sent to Beneficiary",
  },
] as const;

function getReference(payout: XflowPayout) {
  return payout.statement_descriptor?.replace(/^XFLOW PAYOUT\s+/i, "") || payout.id;
}

function getTrackerIndex(payout: XflowPayout) {
  const status = (payout.status || "").toLowerCase();

  if (status === "settled") {
    return TRACKING_STEPS.length + 1;
  }

  if (["failed", "hold", "cancelled"].includes(status)) {
    return Math.max(
      1,
      TRACKING_STEPS.findIndex((step) => step.key === payout.tracking_info) + 1,
    );
  }

  const currentIndex = TRACKING_STEPS.findIndex((step) => step.key === payout.tracking_info);
  return currentIndex >= 0 ? currentIndex + 1 : status === "initialized" ? 1 : 0;
}

function getStatusCopy(status?: string | null) {
  const normalized = (status || "").toLowerCase();

  if (normalized === "settled") {
    return "Xflow completed the payout. The beneficiary bank may still take additional time to credit the account.";
  }

  if (normalized === "processing") {
    return "Xflow is processing the payout. Use the tracker below for the latest payout rail checkpoint.";
  }

  if (normalized === "initialized") {
    return "The payout object exists and is waiting to be picked up for processing.";
  }

  if (normalized === "hold") {
    return "This payout is on hold. Contact Xflow Operations if the hold does not clear.";
  }

  if (normalized === "failed") {
    return "This payout failed. Use the payout id and UTR, if present, for support and reconciliation.";
  }

  if (normalized === "cancelled") {
    return "Xflow cancelled this payout.";
  }

  return "Payout status is being tracked from the Xflow API.";
}

function MetadataEditor({
  accountId,
  metadata,
  payoutId,
}: {
  accountId: string;
  metadata: Record<string, string> | null | undefined;
  payoutId: string;
}) {
  const updateMetadata = useUpdatePayoutMetadataMutation(payoutId);
  const [internalReference, setInternalReference] = useState(
    metadata?.internal_reference || metadata?.order_id || "",
  );

  return (
    <SectionCard>
      <p className="data-kicker">Metadata</p>
      <h2 className="mt-3 text-2xl font-semibold">Internal tracking</h2>
      <p className="mt-3 text-sm leading-7 text-foreground/65">
        Xflow only allows payout metadata updates. Amount, status, destination, and cancellation are not editable from this API.
      </p>
      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
        <Input
          placeholder="Internal reference or order id"
          value={internalReference}
          onChange={(event) => setInternalReference(event.target.value)}
        />
        <Button
          disabled={updateMetadata.isPending || !internalReference.trim()}
          onClick={async () => {
            try {
              await updateMetadata.mutateAsync({
                accountId,
                metadata: {
                  ...(metadata ?? {}),
                  internal_reference: internalReference.trim(),
                },
              });
              toast.success("Payout metadata updated.");
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "Could not update payout metadata.",
              );
            }
          }}
        >
          <Save className="h-4 w-4" />
          Save Metadata
        </Button>
      </div>
    </SectionCard>
  );
}

export function PayoutDetailScreen({ payoutId }: { payoutId: string }) {
  const exporter = useTradEdgeStore((state) => state.exporter);
  const payoutQuery = usePayoutQuery(payoutId, exporter?.accountId);
  const payout = payoutQuery.data;
  const trackerIndex = payout ? getTrackerIndex(payout) : 0;
  const timeline = useMemo(() => {
    if (!payout) {
      return TRACKING_STEPS;
    }

    if (payout.status === "settled") {
      return [
        ...TRACKING_STEPS,
        {
          description: getStatusCopy("settled"),
          key: "settled",
          label: "Settled",
        },
      ];
    }

    return TRACKING_STEPS;
  }, [payout]);

  if (!exporter) {
    return (
      <EmptyState
        title="Connected user required"
        description="Payout lookup needs the connected-user account id so the server can pass the correct Xflow-Account header."
        actionHref="/onboarding"
        actionLabel="Open Onboarding"
      />
    );
  }

  if (payoutQuery.isLoading) {
    return (
      <SectionCard>
        <p className="data-kicker">Payout Detail</p>
        <h2 className="mt-3 text-2xl font-semibold">Loading payout from Xflow...</h2>
      </SectionCard>
    );
  }

  if (!payout) {
    return (
      <EmptyState
        title="Payout not found"
        description="Xflow did not return this payout for the current connected user. Check the payout id or refresh the payout list."
        actionHref="/payouts"
        actionLabel="Back to Payouts"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Payout Detail"
        title={getReference(payout)}
        description={getStatusCopy(payout.status)}
        actions={
          <>
            <Link href="/payouts">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await payoutQuery.refetch();
                  toast.success("Payout refreshed from Xflow.");
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Could not refresh payout.",
                  );
                }
              }}
              disabled={payoutQuery.isFetching}
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <SectionCard className="p-5">
          <p className="data-kicker">Amount</p>
          <p className="mt-3 text-3xl font-semibold">
            {formatCurrencyAmount(payout.amount, payout.currency)}
          </p>
          <p className="mt-2 text-sm text-foreground/62">Leaves Xflow balance</p>
        </SectionCard>
        <SectionCard className="p-5">
          <p className="data-kicker">Status</p>
          <div className="mt-3">
            <StatusBadge status={payout.status} />
          </div>
          <p className="mt-3 text-sm text-foreground/62">
            {formatStatusLabel(payout.tracking_info)}
          </p>
        </SectionCard>
        <SectionCard className="p-5">
          <p className="data-kicker">Expected On</p>
          <p className="mt-3 text-2xl font-semibold">{formatDate(payout.arrival_date)}</p>
          <p className="mt-2 text-sm text-foreground/62">Can be null until Xflow estimates it</p>
        </SectionCard>
        <SectionCard className="p-5">
          <p className="data-kicker">Payment Rail</p>
          <p className="mt-3 text-2xl font-semibold">
            {formatStatusLabel(payout.payment_method)}
          </p>
          <p className="mt-2 text-sm text-foreground/62">
            Automatic: {payout.automatic === false ? "No" : "Yes"}
          </p>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <SectionCard>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="data-kicker">Bank Transfer</p>
                <h2 className="mt-3 text-3xl font-semibold">
                  {formatCurrencyAmount(payout.amount, payout.currency)}
                </h2>
              </div>
              <StatusBadge status={payout.status} />
            </div>

            <div className="mt-6 divide-y divide-black/8 rounded-[24px] border border-black/8 bg-white/72">
              {[
                ["Payout ID", payout.id],
                ["Payout Reference", getReference(payout)],
                ["Created", formatDateTime(payout.created)],
                ["Statement Descriptor", payout.statement_descriptor || "Not provided"],
                ["UTR", payout.unique_transaction_reference || "Not generated yet"],
                ["Destination Account", payout.to?.account_id || "Not provided"],
                ["Destination Address", payout.to?.address_id || "Not provided"],
              ].map(([label, value]) => (
                <div key={label} className="grid gap-2 px-4 py-4 md:grid-cols-[180px_1fr]">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/42">
                    {label}
                  </p>
                  <p className="break-all text-sm font-medium text-foreground/72">{value}</p>
                </div>
              ))}
            </div>

            <Button
              className="mt-5"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(payout.id);
                  toast.success("Payout id copied.");
                } catch {
                  toast.error("Could not copy payout id.");
                }
              }}
            >
              <Copy className="h-4 w-4" />
              Copy Payout ID
            </Button>
          </SectionCard>

          <MetadataEditor
            accountId={exporter.accountId}
            metadata={payout.metadata}
            payoutId={payout.id}
          />
        </div>

        <div className="space-y-6">
          <SectionCard>
            <p className="data-kicker">Payout Tracker</p>
            <h2 className="mt-3 text-2xl font-semibold">Live progress checkpoints</h2>

            <div className="mt-7 space-y-0">
              {timeline.map((step, index) => {
                const active = index + 1 <= trackerIndex;
                const current =
                  step.key === payout.tracking_info ||
                  (step.key === "settled" && payout.status === "settled");

                return (
                  <div key={step.key} className="relative flex gap-4 pb-8 last:pb-0">
                    {index < timeline.length - 1 ? (
                      <div
                        className={cn(
                          "absolute left-[9px] top-6 h-full w-px",
                          active ? "bg-primary" : "bg-black/10",
                        )}
                      />
                    ) : null}
                    <div
                      className={cn(
                        "relative z-10 mt-1 h-5 w-5 rounded-full border-2 bg-white",
                        active ? "border-primary" : "border-black/18",
                      )}
                    >
                      {active ? (
                        <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-semibold",
                            current
                              ? "border-primary/20 bg-primary/10 text-primary"
                              : "border-black/8 bg-white/72 text-foreground/56",
                          )}
                        >
                          {current ? "Current" : active ? "Done" : "Pending"}
                        </span>
                        <p className="text-sm font-semibold text-foreground">{step.label}</p>
                      </div>
                      <p className="mt-2 text-sm leading-7 text-foreground/62">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard>
            <p className="data-kicker">Related Documents</p>
            <h2 className="mt-3 text-2xl font-semibold">Confirmation files</h2>
            <div className="mt-5 space-y-3">
              <div className="rounded-[22px] border border-black/8 bg-white/72 px-4 py-4">
                <p className="text-sm font-semibold text-foreground">Payout Confirmation</p>
                <p className="mt-2 break-all text-sm text-foreground/62">
                  {payout.payout_confirmation || "Not available yet"}
                </p>
              </div>
              <div className="rounded-[22px] border border-black/8 bg-white/72 px-4 py-4">
                <p className="text-sm font-semibold text-foreground">Payment Method Details</p>
                <p className="mt-2 text-sm text-foreground/62">
                  {payout.payment_method_details?.payout_confirmation ||
                    payout.payment_method_details?.statement_descriptor ||
                    "No additional method details returned by Xflow."}
                </p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
