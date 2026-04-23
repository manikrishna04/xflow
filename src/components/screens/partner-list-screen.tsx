"use client";

import Link from "next/link";
import { ArrowUpRight, Plus, Search, Users } from "lucide-react";
import { useDeferredValue, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/tradedge/format";
import {
  buildPartnerDirectory,
  getPartnerCountry,
  getPartnerEmail,
  getPartnerLegalName,
} from "@/lib/tradedge/partners";
import { useTradEdgeStore } from "@/lib/store/tradedge-store";

export function PartnerListScreen() {
  const invoices = useTradEdgeStore((state) => state.invoices);
  const partners = useTradEdgeStore((state) => state.partners);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const directory = buildPartnerDirectory(partners, invoices);

  const filteredPartners = directory.filter((entry) => {
    const query = deferredSearch.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return [
      getPartnerLegalName(entry.partner),
      entry.partner.nickname || "",
      getPartnerEmail(entry.partner),
      getPartnerCountry(entry.partner),
      entry.partner.status || "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Partners"
        title="Partner directory"
        description="Manage partner records separately, then reuse them while creating new receivables."
        actions={
          <Link href="/partners/new">
            <Button>
              <Plus className="h-4 w-4" />
              Add Partner
            </Button>
          </Link>
        }
      />

      {directory.length === 0 ? (
        <EmptyState
          title="No partners yet"
          description="Create your first partner to start issuing receivables from a separate partner module."
          actionHref="/partners/new"
          actionLabel="Add Partner"
        />
      ) : (
        <SectionCard>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold">Existing partners</h2>
                <p className="mt-1 text-sm text-foreground/65">
                  {directory.length} partner records available for receivable creation.
                </p>
              </div>
            </div>

            <div className="relative w-full lg:w-80">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
              <Input
                className="pl-11"
                placeholder="Search partner, email, country, or status"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-[28px] border border-black/8 bg-white/74">
            <div className="hidden grid-cols-[1.35fr_0.7fr_0.8fr_0.8fr_0.7fr_0.45fr] gap-4 border-b border-black/8 px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-foreground/45 md:grid">
              <span>Partner Information</span>
              <span>Receivables</span>
              <span>Amount Pending</span>
              <span>Partner Balance</span>
              <span>Status</span>
              <span />
            </div>

            {filteredPartners.map((entry) => (
              <div
                key={entry.id}
                className="grid gap-4 border-t border-black/6 px-6 py-5 first:border-t-0 md:grid-cols-[1.35fr_0.7fr_0.8fr_0.8fr_0.7fr_0.45fr]"
              >
                <div>
                  <p className="text-base font-semibold text-foreground">
                    {getPartnerLegalName(entry.partner)}
                  </p>
                  <p className="mt-1 text-sm text-foreground/64">{getPartnerCountry(entry.partner)}</p>
                  <p className="mt-1 text-sm text-foreground/58">{getPartnerEmail(entry.partner)}</p>
                  {entry.activationWarning ? (
                    <p className="mt-2 text-xs text-[rgb(170,97,23)]">{entry.activationWarning}</p>
                  ) : null}
                </div>
                <div className="text-sm font-semibold text-foreground/74">
                  {entry.receivableCount > 0 ? `Total ${entry.receivableCount}` : "Nil"}
                </div>
                <div className="text-sm text-foreground/68">
                  {entry.pendingAmountUsd > 0
                    ? formatCurrency(entry.pendingAmountUsd, "USD")
                    : "Nil"}
                </div>
                <div className="text-sm text-foreground/68">
                  {entry.partnerBalanceUsd > 0
                    ? formatCurrency(entry.partnerBalanceUsd, "USD")
                    : "Nil"}
                </div>
                <div>
                  <StatusBadge status={entry.partner.status} />
                </div>
                <div className="flex items-start justify-end">
                  <Link href="/receivables/new" className="inline-flex">
                    <Button variant="ghost" size="sm">
                      Use
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
