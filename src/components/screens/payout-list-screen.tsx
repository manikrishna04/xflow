"use client";

import Link from "next/link";
import { ArrowUpDown, BarChart3, RefreshCcw, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import toast from "react-hot-toast";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { usePayoutsQuery } from "@/lib/hooks/use-tradedge-actions";
import {
  formatCurrencyAmount,
  formatDate,
  formatStatusLabel,
  parseCurrencyAmount,
} from "@/lib/tradedge/format";
import { useTradEdgeStore } from "@/lib/store/tradedge-store";
import type { XflowPayout } from "@/types/xflow";

const STATUS_FILTERS = [
  { label: "All statuses", value: "all" },
  { label: "Initialized", value: "initialized" },
  { label: "Processing", value: "processing" },
  { label: "Settled", value: "settled" },
  { label: "Failed", value: "failed" },
  { label: "Hold", value: "hold" },
  { label: "Cancelled", value: "cancelled" },
] as const;

const RANGE_FILTERS = [
  { label: "This financial year", months: 12, value: "financial-year" },
  { label: "Last 30 days", months: 1, value: "30-days" },
  { label: "Last 90 days", months: 3, value: "90-days" },
  { label: "All time", months: null, value: "all-time" },
] as const;

function getCreatedAfter(range: string) {
  const selected = RANGE_FILTERS.find((item) => item.value === range);

  if (!selected?.months) {
    return undefined;
  }

  const date = new Date();
  date.setMonth(date.getMonth() - selected.months);
  return Math.floor(date.getTime() / 1000);
}

function formatExpectedArrival(payout: XflowPayout) {
  if (payout.arrival_date) {
    return formatDate(payout.arrival_date);
  }

  const tracking = payout.tracking_info ? formatStatusLabel(payout.tracking_info) : null;
  return tracking ? `Tracking: ${tracking}` : "Pending estimate";
}

function getPayoutReference(payout: XflowPayout) {
  return payout.statement_descriptor?.replace(/^XFLOW PAYOUT\s+/i, "") || payout.id;
}

function buildMonthlyBuckets(payouts: XflowPayout[]) {
  const buckets = new Map<string, number>();

  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - offset);
    buckets.set(
      new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(date),
      0,
    );
  }

  for (const payout of payouts) {
    if (!payout.created) {
      continue;
    }

    const label = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(
      new Date(payout.created * 1000),
    );

    if (buckets.has(label)) {
      buckets.set(label, (buckets.get(label) ?? 0) + parseCurrencyAmount(payout.amount));
    }
  }

  return Array.from(buckets.entries()).map(([label, value]) => ({ label, value }));
}

export function PayoutListScreen() {
  const exporter = useTradEdgeStore((state) => state.exporter);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [range, setRange] = useState("financial-year");
  const [startingAfter, setStartingAfter] = useState<string | undefined>();
  const deferredSearch = useDeferredValue(search);
  const payoutsQuery = usePayoutsQuery({
    accountId: exporter?.accountId,
    createdGt: getCreatedAfter(range),
    limit: 10,
    startingAfter,
    status,
  });

  const payouts = payoutsQuery.data?.data ?? [];
  const filteredPayouts = payouts.filter((payout) => {
    const query = deferredSearch.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return [
      payout.id,
      payout.statement_descriptor,
      payout.status,
      payout.tracking_info,
      payout.unique_transaction_reference,
      payout.payment_method,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const total = payouts.reduce((sum, payout) => sum + parseCurrencyAmount(payout.amount), 0);
  const primaryCurrency = payouts.find((payout) => payout.currency)?.currency || "INR";
  const chartBuckets = buildMonthlyBuckets(payouts);
  const maxBucket = Math.max(...chartBuckets.map((bucket) => bucket.value), 1);

  if (!exporter) {
    return (
      <EmptyState
        title="Create a connected user before viewing payouts"
        description="Payouts belong to an Xflow connected-user account. Complete onboarding first, then Xflow-created payout activity will appear here dynamically."
        actionHref="/onboarding"
        actionLabel="Open Onboarding"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Payouts"
        title="Payouts"
        description="Track money moving out of the connected-user Xflow balance into the configured bank account. Payouts are created automatically by Xflow and refreshed from the live API."
        actions={
          <>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await payoutsQuery.refetch();
                  toast.success("Payouts refreshed from Xflow.");
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Could not refresh payouts.",
                  );
                }
              }}
              disabled={payoutsQuery.isFetching}
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            <Link href="/settings">
              <Button variant="secondary">Payout Settings</Button>
            </Link>
          </>
        }
      />

      <SectionCard className="overflow-hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="data-kicker">Total Payouts</p>
            <h2 className="mt-3 text-3xl font-semibold">
              {formatCurrencyAmount(total, primaryCurrency)}
            </h2>
            <p className="mt-2 text-sm text-foreground/62">
              For {RANGE_FILTERS.find((item) => item.value === range)?.label.toLowerCase()}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select value={range} onChange={(event) => setRange(event.target.value)}>
              {RANGE_FILTERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              {STATUS_FILTERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-6 rounded-[28px] bg-[linear-gradient(135deg,rgba(16,150,136,0.1),rgba(255,167,38,0.14))] p-5">
          <div className="rounded-[24px] bg-white/78 px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground/62">
              <BarChart3 className="h-4 w-4" />
              Monthly payout volume
            </div>
            <div className="mt-5 flex h-32 items-end gap-3 overflow-x-auto pb-2">
              {chartBuckets.map((bucket) => (
                <div key={bucket.label} className="flex min-w-20 flex-1 flex-col items-center gap-2">
                  <div className="flex h-24 w-full items-end justify-center border-b border-dashed border-black/10">
                    <div
                      className="w-5 rounded-t-full bg-[linear-gradient(180deg,#bce98a,#0f9688)]"
                      style={{
                        height: `${Math.max(8, (bucket.value / maxBucket) * 96)}px`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-foreground/54">{bucket.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="data-kicker">All Payouts</p>
            <h2 className="mt-2 text-2xl font-semibold">Payout history and tracking</h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
              <Input
                className="min-w-72 pl-11"
                placeholder="Search reference, UTR, status"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Button variant="outline" disabled>
              <ArrowUpDown className="h-4 w-4" />
              Expected On
            </Button>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-[28px] border border-black/8 bg-white/76">
          <div className="hidden grid-cols-[0.9fr_1.45fr_0.9fr_1fr_0.9fr_1fr] gap-4 border-b border-black/8 px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-foreground/45 md:grid">
            <span>Initiated On</span>
            <span>Payout Reference</span>
            <span>Amount</span>
            <span>Destination</span>
            <span>Status</span>
            <span>Expected On</span>
          </div>

          {payoutsQuery.isLoading ? (
            <div className="px-6 py-8 text-sm text-foreground/62">Loading payouts from Xflow...</div>
          ) : filteredPayouts.length ? (
            filteredPayouts.map((payout) => (
              <Link
                key={payout.id}
                href={`/payouts/${payout.id}`}
                className="grid gap-4 border-t border-black/6 px-6 py-5 transition first:border-t-0 hover:bg-black/[0.025] md:grid-cols-[0.9fr_1.45fr_0.9fr_1fr_0.9fr_1fr] md:items-center"
              >
                <div className="text-sm text-foreground/68">{formatDate(payout.created)}</div>
                <div>
                  <p className="break-all text-sm font-semibold text-primary">
                    {getPayoutReference(payout)}
                  </p>
                  <p className="mt-1 break-all text-xs text-foreground/42">{payout.id}</p>
                </div>
                <div className="text-sm font-semibold text-foreground/72">
                  {formatCurrencyAmount(payout.amount, payout.currency)}
                </div>
                <div className="text-sm text-foreground/62">
                  {payout.to?.address_id || "Bank account"}
                </div>
                <div>
                  <StatusBadge status={payout.status} />
                </div>
                <div className="text-sm text-foreground/68">{formatExpectedArrival(payout)}</div>
              </Link>
            ))
          ) : (
            <div className="px-6 py-8 text-sm text-foreground/62">
              No payouts matched the current filters.
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground/56">
            Xflow supports cursor pagination with `starting_after` and a maximum limit of 10.
          </p>
          <Button
            variant="outline"
            disabled={!payoutsQuery.data?.has_next || payouts.length === 0}
            onClick={() => setStartingAfter(payouts.at(-1)?.id)}
          >
            Load more
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
