"use client";

import Link from "next/link";
import { ArrowUpRight, RefreshCcw, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import toast from "react-hot-toast";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  useConnectedUserQuery,
  useSyncAllInvoiceStatusesMutation,
} from "@/lib/hooks/use-tradedge-actions";
import { formatConnectedUserStatus, isConnectedUserActive } from "@/lib/tradedge/onboarding";
import { formatCurrency, formatDateTime } from "@/lib/tradedge/format";
import { isReceivableSettled } from "@/lib/tradedge/invoices";
import { useTradEdgeStore } from "@/lib/store/tradedge-store";

function matchesFilter(
  filter: string,
  invoice: { payoutStatus?: string | null; receivableStatus?: string | null },
) {
  const receivableStatus = (invoice.receivableStatus || "").toLowerCase();
  const payoutStatus = (invoice.payoutStatus || "").toLowerCase();

  if (filter === "receivable_pending") {
    return !isReceivableSettled(invoice.receivableStatus);
  }

  if (filter === "paid") {
    return isReceivableSettled(invoice.receivableStatus);
  }

  if (filter === "payout_open") {
    return Boolean(invoice.payoutStatus) && !["settled", "failed", "cancelled"].includes(payoutStatus);
  }

  if (filter === "payout_settled") {
    return payoutStatus === "settled" || receivableStatus === "completed";
  }

  return true;
}

export function InvoiceListScreen({
  basePath = "/invoices",
  variant = "invoice",
}: {
  basePath?: string;
  variant?: "invoice" | "receivable";
}) {
  const exporter = useTradEdgeStore((state) => state.exporter);
  const connectedUserQuery = useConnectedUserQuery(exporter?.accountId);
  const invoices = useTradEdgeStore((state) => state.invoices);
  const syncAll = useSyncAllInvoiceStatusesMutation();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const deferredSearch = useDeferredValue(search);
  const isReceivableMode = variant === "receivable";

  if (!exporter) {
    return (
      <EmptyState
        title="No exporter context available"
        description="This ledger is built on top of the connected-user account id. Complete onboarding first, then use receivable flows once the account is active."
        actionHref="/onboarding"
        actionLabel="Start Onboarding"
      />
    );
  }

  const accountStatus = connectedUserQuery.data?.account.status ?? exporter.status;
  const transactionsEnabled = isConnectedUserActive(accountStatus);

  const filteredInvoices = invoices.filter((invoice) => {
    const query = deferredSearch.trim().toLowerCase();
    const matchesSearch =
      !query ||
      invoice.referenceId.toLowerCase().includes(query) ||
      invoice.buyerName.toLowerCase().includes(query) ||
      (invoice.receivableStatus || "").toLowerCase().includes(query) ||
      (invoice.payoutStatus || "").toLowerCase().includes(query);

    return matchesSearch && matchesFilter(filter, invoice);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={isReceivableMode ? "Receivables" : "Invoices"}
        title={isReceivableMode ? "Receivables ledger" : "Receivable ledger"}
        description="Every invoice row is stored locally and linked to Xflow object ids for the connected exporter. Use the detail page for buyer instructions, simulation, and payout actions."
        actions={
          <>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await syncAll.mutateAsync();
                  toast.success("Statuses refreshed.");
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
            <Link href={`${basePath}/new`}>
              <Button>{isReceivableMode ? "New receivable" : "New receivable"}</Button>
            </Link>
          </>
        }
      />

      <SectionCard>
        {!transactionsEnabled ? (
          <div className="mb-6 rounded-[24px] bg-[rgba(255,167,38,0.12)] px-5 py-4 text-sm text-[rgb(170,97,23)]">
            Connected user status is {formatConnectedUserStatus(accountStatus)}. Invoice creation stays blocked until the account becomes Active.
          </div>
        ) : null}

        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
            <Input
              className="pl-11"
              placeholder="Search by buyer, reference, or status"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select value={filter} onChange={(event) => setFilter(event.target.value)} className="lg:w-64">
            <option value="all">All invoices</option>
            <option value="receivable_pending">Receivable pending</option>
            <option value="paid">Receivable paid</option>
            <option value="payout_open">Payout in flight</option>
            <option value="payout_settled">Payout settled</option>
          </Select>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="mt-6 rounded-[24px] bg-black/[0.03] px-5 py-6 text-sm leading-7 text-foreground/65">
            No invoices match the current filter.
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-[28px] border border-black/8 bg-white/74">
            <div className="hidden grid-cols-[1.3fr_0.9fr_0.8fr_0.9fr_0.9fr] gap-4 border-b border-black/8 px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-foreground/45 md:grid">
              <span>Invoice</span>
              <span>Amount</span>
              <span>Receivable</span>
              <span>Payout</span>
              <span>Updated</span>
            </div>

            {filteredInvoices.map((invoice) => (
              <Link
                key={invoice.id}
                href={`${basePath}/${invoice.id}`}
                className="grid gap-4 border-t border-black/6 px-6 py-5 transition first:border-t-0 hover:bg-black/[0.02] md:grid-cols-[1.3fr_0.9fr_0.8fr_0.9fr_0.9fr]"
              >
                <div>
                  <p className="text-base font-semibold text-foreground">{invoice.referenceId}</p>
                  <p className="mt-1 text-sm text-foreground/64">
                    {invoice.buyerName} · {invoice.buyerCountry}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.12em] text-foreground/38">
                    /pay/{invoice.id}
                  </p>
                </div>
                <div className="text-sm text-foreground/72">{formatCurrency(invoice.amountUsd, "USD")}</div>
                <div>
                  <StatusBadge status={invoice.receivableStatus} />
                </div>
                <div>
                  {invoice.payoutStatus ? (
                    <StatusBadge status={invoice.payoutStatus} />
                  ) : (
                    <span className="text-sm text-foreground/48">Not started</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 text-sm text-foreground/58 md:justify-start">
                  <span>{formatDateTime(invoice.updatedAt)}</span>
                  <ArrowUpRight className="h-4 w-4" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
