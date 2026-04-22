"use client";

import { Users } from "lucide-react";
import { useMemo } from "react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { useTradEdgeStore } from "@/lib/store/tradedge-store";

export function PartnerListScreen() {
  const invoices = useTradEdgeStore((state) => state.invoices);

  const partners = useMemo(() => {
    const partnerMap = new Map();
    invoices.forEach((invoice) => {
      if (invoice.partnerSnapshot && !partnerMap.has(invoice.partnerSnapshot.id)) {
        partnerMap.set(invoice.partnerSnapshot.id, invoice.partnerSnapshot);
      }
    });
    return Array.from(partnerMap.values());
  }, [invoices]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Partner Network"
        title="Partners"
        description="View partners that have been created through your invoice transactions. Manual partner creation is not currently available in this Xflow environment."
      />

      {partners.length === 0 ? (
        <EmptyState
          title="No partners yet"
          description="Partners are created automatically when you issue invoices. Create your first invoice to see partners appear here."
          actionHref="/invoices/new"
          actionLabel="Create Invoice"
        />
      ) : (
        <SectionCard>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Your Partner Network ({partners.length})
            </h3>
            <div className="grid gap-4">
              {partners.map((partner) => (
                <div key={partner.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{partner.nickname}</h4>
                    <p className="text-sm text-muted-foreground">
                      {partner.business_details?.legal_name || "No legal name"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {partner.business_details?.email || "No email"}
                    </p>
                  </div>
                  <StatusBadge status={partner.status || "unknown"} />
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard>
        <div className="text-center py-8">
          <h3 className="text-lg font-semibold mb-2">Manual Partner Creation</h3>
          <p className="text-muted-foreground mb-4">
            The ability to manually create partner accounts is not currently enabled in your Xflow environment.
            Partners are automatically created when issuing invoices to new buyers.
          </p>
          <p className="text-sm text-muted-foreground">
            If you need to create partners manually, please contact Xflow support to enable this feature.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}