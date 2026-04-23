"use client";

import Link from "next/link";
import { Plus, RefreshCcw, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import toast from "react-hot-toast";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/tradedge/format";
import { getReceivablePendingAmount } from "@/lib/tradedge/partners";
import { useSyncAllInvoiceStatusesMutation } from "@/lib/hooks/use-tradedge-actions";
import { useTradEdgeStore } from "@/lib/store/tradedge-store";

const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Completed", value: "completed" },
  { label: "Draft", value: "draft" },
  { label: "Hold", value: "hold" },
  { label: "Input Required", value: "input_required" },
  { label: "Verifying", value: "verifying" },
] as const;

function matchesStatusFilter(status: string | null | undefined, filter: string) {
  if (filter === "all") {
    return true;
  }

  const normalized = (status || "").toLowerCase();

  if (filter === "active") {
    return ["active", "activated"].includes(normalized);
  }

  return normalized === filter;
}

function getInvoiceNumber(invoiceNumber?: string | null, referenceId?: string) {
  return invoiceNumber || referenceId || "Unknown";
}

export function ReceivableListScreen() {
  const invoices = useTradEdgeStore((state) => state.invoices);
  const syncAll = useSyncAllInvoiceStatusesMutation();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const deferredSearch = useDeferredValue(search);

  const counts = STATUS_FILTERS.reduce<Record<string, number>>((result, item) => {
    result[item.value] = invoices.filter((invoice) =>
      matchesStatusFilter(invoice.receivableStatus, item.value),
    ).length;
    return result;
  }, {});
  counts.all = invoices.length;

  const filteredInvoices = invoices.filter((invoice) => {
    const query = deferredSearch.trim().toLowerCase();
    const invoiceNumber = invoice.receivableSnapshot?.invoice?.reference_number;
    const description = invoice.receivableSnapshot?.description || "";
    const partnerName = invoice.partnerSnapshot?.business_details?.legal_name || invoice.buyerName;

    const matchesSearch =
      !query ||
      getInvoiceNumber(invoiceNumber, invoice.referenceId).toLowerCase().includes(query) ||
      description.toLowerCase().includes(query) ||
      partnerName.toLowerCase().includes(query) ||
      (invoice.receivableStatus || "").toLowerCase().includes(query);

    return matchesSearch && matchesStatusFilter(invoice.receivableStatus, filter);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Receivables"
        title="Receivables"
        description="View existing receivable records and open a receivable when you need status, instructions, or payout details."
        actions={
          <>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await syncAll.mutateAsync();
                  toast.success("Receivable statuses refreshed.");
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Could not refresh statuses.",
                  );
                }
              }}
              disabled={syncAll.isPending || invoices.length === 0}
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            <Link href="/receivables/new">
              <Button>
                <Plus className="h-4 w-4" />
                Create Receivable
              </Button>
            </Link>
          </>
        }
      />

      {invoices.length === 0 ? (
        <EmptyState
          title="No receivables yet"
          description="Create your first receivable from the dedicated receivable module."
          actionHref="/receivables/new"
          actionLabel="Create Receivable"
        />
      ) : (
        <SectionCard>
          <div className="flex flex-wrap gap-3">
            {STATUS_FILTERS.map((item) => {
              const active = filter === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    active
                      ? "border-primary/20 bg-primary/10 text-primary"
                      : "border-black/8 bg-white/70 text-foreground/58 hover:bg-black/[0.03]"
                  }`}
                  onClick={() => setFilter(item.value)}
                >
                  {item.label} {counts[item.value] ?? 0}
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex flex-col gap-4 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
              <Input
                className="pl-11"
                placeholder="Search invoice number, partner, description, or status"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-[28px] border border-black/8 bg-white/74">
            <div className="hidden grid-cols-[0.8fr_1.05fr_1.1fr_1.05fr_0.9fr_0.85fr_0.8fr] gap-4 border-b border-black/8 px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-foreground/45 md:grid">
              <span>Created</span>
              <span>Invoice No.</span>
              <span>Partner Name</span>
              <span>Description</span>
              <span>Receivable Amount</span>
              <span>Amount Pending</span>
              <span>Status</span>
            </div>

            {filteredInvoices.map((invoice) => {
              const invoiceNumber = getInvoiceNumber(
                invoice.receivableSnapshot?.invoice?.reference_number,
                invoice.referenceId,
              );
              const description =
                invoice.receivableSnapshot?.description || "No description provided";
              const partnerName =
                invoice.partnerSnapshot?.business_details?.legal_name || invoice.buyerName;
              const pendingAmount = getReceivablePendingAmount(invoice.receivableSnapshot);

              return (
                <Link
                  key={invoice.id}
                  href={`/receivables/${invoice.id}`}
                  className="grid gap-4 border-t border-black/6 px-6 py-5 transition first:border-t-0 hover:bg-black/[0.02] md:grid-cols-[0.8fr_1.05fr_1.1fr_1.05fr_0.9fr_0.85fr_0.8fr]"
                >
                  <div className="text-sm text-foreground/68">{formatDate(invoice.createdAt)}</div>
                  <div className="text-sm font-semibold text-primary">{invoiceNumber}</div>
                  <div className="text-sm text-foreground/72">{partnerName}</div>
                  <div className="text-sm text-foreground/68">{description}</div>
                  <div className="text-sm text-foreground/72">
                    {formatCurrency(invoice.amountUsd, "USD")}
                  </div>
                  <div className="text-sm text-foreground/68">
                    {pendingAmount > 0 ? formatCurrency(pendingAmount, "USD") : "Nil"}
                  </div>
                  <div>
                    <StatusBadge status={invoice.receivableStatus} />
                  </div>
                </Link>
              );
            })}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
