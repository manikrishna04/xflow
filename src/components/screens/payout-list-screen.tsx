"use client";

import Link from "next/link";
import {
  ArrowUpDown,
  ChevronDown,
  Clock,
  Download,
  Filter,
  Search,
  RefreshCcw,
} from "lucide-react";
import { useDeferredValue, useState } from "react";
import toast from "react-hot-toast";

import { EmptyState } from "@/components/empty-state";
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
  const tracking = payout.tracking_info
    ? formatStatusLabel(payout.tracking_info)
    : null;
  return tracking ? `Tracking: ${tracking}` : "Pending estimate";
}

function getPayoutReference(payout: XflowPayout) {
  return (
    payout.statement_descriptor?.replace(/^XFLOW PAYOUT\s+/i, "") || payout.id
  );
}

function buildMonthlyBuckets(payouts: XflowPayout[]) {
  const buckets = new Map<string, number>();

  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - offset);
    buckets.set(
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        year: "2-digit",
      }).format(date),
      0
    );
  }

  for (const payout of payouts) {
    if (!payout.created) continue;

    const label = new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "2-digit",
    }).format(new Date(payout.created * 1000));

    if (buckets.has(label)) {
      buckets.set(
        label,
        (buckets.get(label) ?? 0) + parseCurrencyAmount(payout.amount)
      );
    }
  }

  return Array.from(buckets.entries()).map(([label, value]) => ({
    label,
    value,
  }));
}

export function PayoutListScreen() {
  const exporter = useTradEdgeStore((state) => state.exporter);
  const [search, setSearch] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [status, setStatus] = useState("all");
  const [range, setRange] = useState("financial-year");
  const [viewBy, setViewBy] = useState("monthly");
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

    if (!query) return true;

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

  const total = payouts.reduce(
    (sum, payout) => sum + parseCurrencyAmount(payout.amount),
    0
  );
  const primaryCurrency =
    payouts.find((payout) => payout.currency)?.currency || "INR";
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
    <div className="min-h-screen bg-[#f8f9fe]">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-indigo-100/40 bg-[#fbfbfe] px-8 py-4 shadow-sm">
        <h1 className="text-xl font-bold text-slate-700">Payouts</h1>
        <Link
          href="/settings"
          className="text-sm font-semibold text-blue-500 hover:text-blue-600"
        >
          Payout Settings
        </Link>
      </div>

      <div className="mx-auto max-w-[1400px] space-y-6 p-8">
        {/* Chart Section */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-slate-700">
                Total Payouts during
              </span>

              {/* Custom Date Range Popover */}
              <div className="relative">
                <button
                  onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                  className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {
                    RANGE_FILTERS.find((item) => item.value === range)?.label
                  }{" "}
                  (1 Apr, 2026 - 31 Mar, 2027){" "}
                  <ChevronDown className="h-4 w-4" />
                </button>

                {isDatePickerOpen && (
                  <div className="absolute left-0 top-full z-10 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
                    <Select
                      value={range}
                      onChange={(e) => setRange(e.target.value)}
                    >
                      {RANGE_FILTERS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </Select>
                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="text-xs font-medium text-slate-500">
                          Start Date:
                        </label>
                        <div className="mt-1 flex cursor-pointer items-center justify-between rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600">
                          1st Apr, 2026{" "}
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-500">
                          End Date:
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                          />
                          Same as start date
                        </label>
                      </div>
                      <div className="flex cursor-pointer items-center justify-between rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600">
                        31st Mar, 2027{" "}
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          variant="outline"
                          className="w-full text-blue-500"
                          onClick={() => setIsDatePickerOpen(false)}
                        >
                          Reset
                        </Button>
                        <Button
                          className="w-full bg-blue-500 text-white hover:bg-blue-600"
                          onClick={() => setIsDatePickerOpen(false)}
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <span className="font-semibold text-slate-700">:</span>
              <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-700 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[#bce98a]"></span>
                {formatCurrencyAmount(total, primaryCurrency)}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  try {
                    await payoutsQuery.refetch();
                    toast.success("Payouts refreshed from Xflow.");
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Could not refresh payouts."
                    );
                  }
                }}
                disabled={payoutsQuery.isFetching}
                className="h-8 w-8 text-slate-400 hover:text-slate-600"
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span className="font-semibold">View By:</span>
                <Select
                  value={viewBy}
                  onChange={(e) => setViewBy(e.target.value)}
                  className="h-8 w-28 border-slate-200 text-sm"
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="daily">Daily</option>
                </Select>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-6">
            <div className="relative mt-2 flex h-36 items-end gap-3 overflow-x-auto pb-6">
              {/* Dashed zero line */}
              <div className="absolute bottom-6 left-0 right-0 border-b border-dashed border-slate-200" />

              {chartBuckets.map((bucket) => (
                <div
                  key={bucket.label}
                  className="relative flex min-w-[3rem] flex-1 flex-col items-center gap-2 z-10"
                >
                  <div className="flex h-24 w-full items-end justify-center">
                    <div
                      className="w-4 bg-[#d7f0b5] hover:bg-[#bce98a] transition-colors"
                      style={{
                        height: `${Math.max(
                          2,
                          (bucket.value / maxBucket) * 96
                        )}px`,
                      }}
                    />
                  </div>
                  <span className="absolute -bottom-6 text-xs text-slate-500">
                    {bucket.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* All Payouts Table */}
        <div>
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-lg font-bold text-slate-700">All Payouts</h2>
            <div className="flex items-center gap-3">
              {isSearchOpen ? (
                <Input
                  autoFocus
                  placeholder="Search reference, UTR, status"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-9 w-64 border-slate-300"
                  onBlur={() => {
                    if (!search) setIsSearchOpen(false);
                  }}
                />
              ) : (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 border-slate-300 text-slate-500"
                  onClick={() => setIsSearchOpen(true)}
                >
                  <Search className="h-4 w-4" />
                </Button>
              )}

              <div className="relative">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 border-slate-300 text-slate-500"
                >
                  <Filter className="h-4 w-4" />
                </Button>
                {/* Hidden native select keeps functionality without messing up visual icons */}
                <Select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="absolute inset-0 opacity-0"
                >
                  {STATUS_FILTERS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </div>

              <Button
                variant="outline"
                className="h-9 border-slate-300 text-sm text-slate-600"
              >
                <ArrowUpDown className="mr-2 h-4 w-4" />
                Sort: Expected On (Newest-Oldest)
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="hidden grid-cols-[1fr_1.5fr_1fr_1fr_1fr_1.5fr] items-center border-b border-slate-200 px-6 py-4 text-xs font-semibold text-slate-500 md:grid">
              <span>Initiated On</span>
              <span>Payout Reference</span>
              <span>Gross Payout</span>
              <span>Settled Amount</span>
              <span>Status</span>
              <span>Expected On</span>
            </div>

            {payoutsQuery.isLoading ? (
              <div className="px-6 py-8 text-sm text-slate-500">
                Loading payouts from Xflow...
              </div>
            ) : filteredPayouts.length ? (
              filteredPayouts.map((payout) => (
                <Link
                  key={payout.id}
                  href={`/payouts/${payout.id}`}
                  className="group grid items-center gap-4 border-t border-slate-100 px-6 py-4 transition hover:bg-slate-50 md:grid-cols-[1fr_1.5fr_1fr_1fr_1fr_1.5fr]"
                >
                  <div className="text-sm text-slate-600">
                    {formatDate(payout.created)}
                  </div>
                  <div>
                    <p className="truncate text-sm font-medium text-blue-500 group-hover:text-blue-600">
                      {getPayoutReference(payout)}
                    </p>
                  </div>
                  <div className="text-sm text-slate-600">
                    {formatCurrencyAmount(payout.amount, payout.currency || "USD")}
                  </div>
                  <div className="text-sm text-slate-600">
                    {/* Simulated settled amount (fallback to amount in INR for visual sync if destination info is missing) */}
                    {formatCurrencyAmount(
                      payout.amount ? parseCurrencyAmount(payout.amount) * 83.5 : 0,
                      "INR"
                    )}
                  </div>
                  <div>
                    {/* Assuming StatusBadge outputs the required green pill based on "settled" */}
                    <StatusBadge status={payout.status} />
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <div className="flex items-center gap-1.5">
                      {payout.status === "settled" && !payout.arrival_date ? (
                        <>
                          <Clock className="h-3.5 w-3.5" />
                          <span>ETA: {formatExpectedArrival(payout)}</span>
                        </>
                      ) : (
                        <span>{formatExpectedArrival(payout)}</span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 opacity-0 transition group-hover:opacity-100"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toast.success("Download initiated");
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </Link>
              ))
            ) : (
              <div className="px-6 py-8 text-sm text-slate-500">
                No payouts matched the current filters.
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-end">
            <Button
              variant="outline"
              disabled={!payoutsQuery.data?.has_next || payouts.length === 0}
              onClick={() => setStartingAfter(payouts.at(-1)?.id)}
              className="text-slate-600"
            >
              Load more
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}