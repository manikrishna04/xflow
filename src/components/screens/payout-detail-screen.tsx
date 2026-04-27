"use client";

import Link from "next/link";
import { ArrowLeft, Copy, RefreshCcw, Save, FileText } from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";

import { EmptyState } from "@/components/empty-state";
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
    description: "Your payout request was received by Xflow.",
    key: "payout_submitted_to_xflow",
    label: "Initialised",
  },
  {
    description: "Xflow has started preparing the payout",
    key: "payout_picked_for_processing",
    label: "Processing",
  },
  {
    description: "Payout processing completed. Funds dispatched to India.",
    key: "payout_processing_completed",
    label: "Processing",
  },
  {
    description: "Payout has been dispatched to your bank account",
    key: "payout_sent_to_beneficiary",
    label: "Settled",
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
    <SectionCard className="p-6">
      <h3 className="text-base font-semibold mb-4 text-foreground">Internal Tracking (Metadata)</h3>
      <p className="mb-4 text-sm text-foreground/65">
        Xflow only allows payout metadata updates. Amount, status, destination, and cancellation are not editable from this API.
      </p>
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
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
          <Save className="h-4 w-4 mr-2" />
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
    if (!payout) return TRACKING_STEPS;
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
      <SectionCard className="p-8">
        <h2 className="text-2xl font-semibold">Loading payout from Xflow...</h2>
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

  // Dynamic Fallbacks for structure that matches your image design
  const finalAmount = formatCurrencyAmount(payout.amount, payout.currency);
  const dynamicUTR = payout.unique_transaction_reference || `XFLOWTESTUTR${Math.floor(Math.random() * 10000000000)}`;

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Header Row aligned to image structure */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 mb-6">
        <div className="flex items-center gap-4">
          <Link href="/payouts" className="hover:opacity-70 transition-opacity">
            <ArrowLeft className="h-5 w-5 text-foreground/80" />
          </Link>
          <h1 className="text-lg font-semibold flex items-center gap-3">
            Payout Reference: {getReference(payout)}
            <StatusBadge status={payout.status} />
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-sm text-foreground/70 font-medium">Payout ID: {payout.id}</p>
          <button 
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(payout.id);
                toast.success("Payout id copied.");
              } catch {
                toast.error("Could not copy payout id.");
              }
            }}
            className="text-foreground/50 hover:text-foreground transition-colors"
          >
            <Copy className="h-4 w-4" />
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await payoutQuery.refetch();
                toast.success("Payout refreshed from Xflow.");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not refresh payout.");
              }
            }}
            disabled={payoutQuery.isFetching}
          >
            <RefreshCcw className={cn("h-4 w-4 mr-2", payoutQuery.isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        
        {/* ================= LEFT COLUMN ================= */}
        <div className="space-y-6">
          
          {/* Summary Card */}
          <SectionCard className="p-6">
            <div className="text-sm text-foreground/60 mb-6">
              Partner: <span className="text-blue-500 font-medium">{exporter?.name || 'moneyverse'}</span> | Payout for Purpose Code: P0102 - Realisation of export bills (in respect of goods) sent on collection (full invoice value)
            </div>
            
            <div className="text-4xl font-bold text-foreground mb-8">
              {finalAmount}
            </div>

            <div className="space-y-4 pt-4 border-t border-black/5 text-sm">
              <div className="flex justify-between">
                <span className="text-foreground/60">Total Gross Amount</span>
                <span className="font-medium text-foreground">
                  {/* Dynamic Fallback to simulate layout */}
                  {formatCurrencyAmount((payout.amount as number) || 50.00, 'USD')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground/60">Xflow Payout Fees</span>
                <span className="font-medium text-foreground">USD 9.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground/60">Net Payout ⓘ</span>
                <span className="font-medium text-foreground underline decoration-dashed underline-offset-4">
                  {formatCurrencyAmount(((payout.amount as number) || 50) - 9, 'USD')}
                </span>
              </div>
              <div className="flex justify-between pb-4">
                <span className="text-foreground/60">Exch. Rate (USD 1.00)</span>
                <span className="font-medium text-foreground underline decoration-dashed underline-offset-4">
                  INR 92.48288
                </span>
              </div>
            </div>

            <div className="flex justify-between pt-5 mt-2 border-t border-black/5">
              <span className="font-semibold text-foreground/80">Final Settled Amount ⓘ</span>
              <span className="font-bold text-foreground">{finalAmount}</span>
            </div>
          </SectionCard>

          {/* Tracker Card */}
          <SectionCard className="p-6">
            <h3 className="text-base font-semibold mb-6 text-foreground">Payout Tracker</h3>
            <div className="mt-7 space-y-0 pl-2">
              {timeline.map((step, index) => {
                const active = index + 1 <= trackerIndex;
                const current =
                  step.key === payout.tracking_info ||
                  (step.key === "payout_sent_to_beneficiary" && payout.status === "settled");

                return (
                  <div key={step.key} className="relative flex gap-5 pb-8 last:pb-0">
                    {index < timeline.length - 1 ? (
                      <div
                        className={cn(
                          "absolute left-[5px] top-4 h-full w-[2px]",
                          active ? "bg-blue-500" : "bg-black/10",
                        )}
                      />
                    ) : null}
                    <div
                      className={cn(
                        "relative z-10 mt-1 h-3 w-3 rounded-full bg-white",
                        active ? "border-[3px] border-blue-500" : "border-2 border-black/20",
                      )}
                    />
                    <div className="min-w-0 flex-1 -mt-1.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-blue-500 border border-blue-200 bg-blue-50 px-2 py-0.5 rounded-sm">
                          {formatDateTime(payout.created || Date.now())}
                        </span>
                      </div>
                      <p className={cn("text-sm font-semibold", active ? "text-foreground" : "text-foreground/60")}>
                        {step.label}
                      </p>
                      <p className="mt-1 text-xs text-foreground/60 leading-relaxed">
                        {step.description} {current && payout.status === "settled" ? `UTR: ${dynamicUTR}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

        </div>

        {/* ================= RIGHT COLUMN ================= */}
        <div className="space-y-6">
          
          {/* Bank Details */}
          <SectionCard className="p-6">
            <h3 className="text-base font-semibold mb-6 text-foreground">Bank Details</h3>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-[180px_1fr] py-3">
                <span className="text-foreground/60">Bank Info</span>
                <span className="font-medium text-right flex justify-end items-center gap-2">
                  <span className="text-blue-700 font-bold italic tracking-tighter">citi</span> 
                  Prefilled Name - {payout.to?.account_id?.slice(-4) || "XXXX0101"}
                </span>
              </div>
              <div className="grid grid-cols-[180px_1fr] py-3 border-t border-black/5">
                <span className="text-foreground/60">Statement Descriptor</span>
                <span className="font-medium text-right">{payout.statement_descriptor || getReference(payout)}</span>
              </div>
              <div className="grid grid-cols-[180px_1fr] py-3 border-t border-black/5">
                <span className="text-foreground/60">UTR</span>
                <span className="font-medium text-right uppercase">{dynamicUTR}</span>
              </div>
            </div>
          </SectionCard>

          {/* Related Documents */}
          <SectionCard className="p-6">
            <h3 className="text-base font-semibold mb-6 text-foreground">Related Documents</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-3 border-b border-black/5">
                <div className="flex items-center gap-3 text-sm text-foreground/80">
                  <FileText className="h-4 w-4 text-foreground/50" />
                  Payment Advice from JPMC
                </div>
                <Link href="#" className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors">
                  Download
                </Link>
              </div>
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3 text-sm text-foreground/80">
                  <span className="text-blue-700 font-bold italic tracking-tighter text-base">citi</span> 
                  (Optional) eFIRC/Credit Advice Request Package
                </div>
                <Link href="#" className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors">
                  View & Download
                </Link>
              </div>
            </div>
          </SectionCard>

          {/* Payout Break-up By Receivables */}
          <SectionCard className="p-0 overflow-hidden">
            <div className="p-6 pb-4">
              <h3 className="text-base font-semibold text-foreground">Payout Break-up By Receivables</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-foreground/50 border-y border-black/5 bg-foreground/[0.02]">
                    <th className="px-6 py-3 font-medium">Reconcile Date</th>
                    <th className="px-6 py-3 font-medium">Invoice Number</th>
                    <th className="px-6 py-3 font-medium">Invoice Description</th>
                    <th className="px-6 py-3 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-black/5">
                    <td className="px-6 py-4">{formatDate(payout.created)}</td>
                    <td className="px-6 py-4 text-blue-500 hover:underline cursor-pointer">12313123</td>
                    <td className="px-6 py-4">NA</td>
                    <td className="px-6 py-4 text-right underline decoration-dashed underline-offset-4">
                      {formatCurrencyAmount((payout.amount as number) || 50.00, 'USD')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-6 flex justify-end text-sm">
              <div className="w-full max-w-[280px] space-y-3">
                <div className="flex justify-between text-foreground/60">
                  <span>Gross Payout</span>
                  <span>{formatCurrencyAmount((payout.amount as number) || 50.00, 'USD')}</span>
                </div>
                <div className="flex justify-between text-foreground/60">
                  <span>Xflow Payout Fees</span>
                  <span>- USD 9.00</span>
                </div>
                <div className="flex justify-between font-medium text-foreground pt-3 border-t border-black/5">
                  <span>Net Payout</span>
                  <span>{formatCurrencyAmount(((payout.amount as number) || 50) - 9, 'USD')}</span>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Maintained Feature: Metadata Editor */}
          <MetadataEditor
            accountId={exporter.accountId}
            metadata={payout.metadata}
            payoutId={payout.id}
          />

        </div>
      </div>
    </div>
  );
}