"use client";

import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency, formatDateTime } from "@/lib/tradedge/format";
import { extractInstructionItems } from "@/lib/tradedge/invoices";
import { useTradEdgeStore } from "@/lib/store/tradedge-store";
import { useInvoiceStatusQuery } from "@/lib/hooks/use-tradedge-actions";

export function BuyerInvoiceScreen({ invoiceId }: { invoiceId: string }) {
  const invoice = useTradEdgeStore(
    (state) => state.invoices.find((item) => item.id === invoiceId) ?? null,
  );

  useInvoiceStatusQuery(invoice);

  if (!invoice) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-8">
        <SectionCard className="w-full max-w-2xl rounded-[36px] px-8 py-10">
          <p className="data-kicker">Buyer Page</p>
          <h1 className="mt-3 text-4xl font-semibold">Invoice not available</h1>
          <p className="mt-4 text-sm leading-7 text-foreground/68">
            This buyer route is public, but this project intentionally has no backend
            or database. The invoice needs to exist in the same browser local storage
            to render here.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex text-sm font-semibold text-primary"
          >
            Back to TradEdge
          </Link>
        </SectionCard>
      </main>
    );
  }

  const instructionItems = extractInstructionItems(invoice.receivableSnapshot);

  return (
    <main className="min-h-screen px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <SectionCard className="rounded-[36px] px-8 py-8">
          <PageHeader
            eyebrow="Buyer Payment View"
            title={invoice.referenceId}
            description={`Pay ${invoice.exporterLegalName || "the exporter"} for the receivable linked to ${invoice.buyerName}. Status updates on this page are read from the locally stored invoice and refreshed via server-side Xflow proxy routes.`}
          />

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] bg-black/[0.03] p-5">
              <p className="data-kicker">Amount Due</p>
              <p className="mt-3 text-3xl font-semibold">
                {formatCurrency(invoice.amountUsd, "USD")}
              </p>
            </div>
            <div className="rounded-[24px] bg-black/[0.03] p-5">
              <p className="data-kicker">Receivable Status</p>
              <div className="mt-3">
                <StatusBadge status={invoice.receivableStatus} />
              </div>
            </div>
            <div className="rounded-[24px] bg-black/[0.03] p-5">
              <p className="data-kicker">Last Synced</p>
              <p className="mt-3 text-lg font-semibold">{formatDateTime(invoice.lastSyncedAt)}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard className="rounded-[36px] px-8 py-8">
          <p className="data-kicker">Payment Instructions</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {instructionItems.map((item) => (
              <div key={`${item.label}-${item.value}`} className="rounded-[24px] bg-black/[0.03] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/42">
                  {item.label}
                </p>
                <p className="mt-2 text-sm leading-7 text-foreground/72">{item.value}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </main>
  );
}
