"use client";

import Link from "next/link";
import { ArrowUpRight, LockKeyhole, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { useTradEdgeStore } from "@/lib/store/tradedge-store";

export function SettingsScreen() {
  const exporter = useTradEdgeStore((state) => state.exporter);
  const invoices = useTradEdgeStore((state) => state.invoices);
  const clearWorkspace = useTradEdgeStore((state) => state.clearWorkspace);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Workspace Settings"
        description="Connected-user creation now happens only through the onboarding flow so the app collects the full Xflow dataset up front and submits it in one sequence."
      />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          {exporter ? (
            <SectionCard>
              <p className="data-kicker">Current Connected User</p>
              <h2 className="mt-3 text-3xl font-semibold">{exporter.legalName}</h2>
              <div className="mt-4 flex flex-wrap gap-3">
                <StatusBadge status={exporter.status} />
                <span className="pill-surface rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-foreground/60">
                  {exporter.countryCode}
                </span>
              </div>
              <div className="mt-6 space-y-3 text-sm text-foreground/68">
                <div>
                  <span className="font-semibold text-foreground">Account ID:</span>{" "}
                  {exporter.accountId}
                </div>
                <div>
                  <span className="font-semibold text-foreground">Email:</span> {exporter.email}
                </div>
                <div>
                  <span className="font-semibold text-foreground">Local invoices:</span>{" "}
                  {invoices.length}
                </div>
              </div>
              <Link href="/onboarding" className="mt-6 inline-flex">
                <Button variant="outline">
                  Review onboarding
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
            </SectionCard>
          ) : (
            <EmptyState
              title="No connected user yet"
              description="Use the onboarding page to create and submit the connected user in one flow."
              actionHref="/onboarding"
              actionLabel="Open Onboarding"
            />
          )}

          <SectionCard>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(19,33,68,0.08)] text-foreground">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold">Security posture</h2>
                <p className="mt-1 text-sm text-foreground/65">
                  Server routes read `XFLOW_SECRET_KEY`, `XFLOW_API_BASE`, and the platform account
                  id for treasury actions. The browser only sees JSON responses.
                </p>
              </div>
            </div>
            <div className="mt-6 space-y-3 text-sm leading-7 text-foreground/68">
              <div>`/api/xflow/*` routes are our own Next.js proxy routes, not direct browser calls to Xflow.</div>
              <div>The connected-user onboarding flow now creates the account, directors, bank details, and activation request from the server side.</div>
              <div>Balance top-ups use a server-side `platform_debit` transfer and require `XFLOW_PARENT_ACCOUNT_ID` or `XFLOW_PLATFORM_ACCOUNT_ID`.</div>
              <div>No database is used. Exporter state and invoices persist in local storage for this demo.</div>
              <div>The buyer pay page is public, but it still depends on the same browser session&apos;s local data.</div>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard>
            <p className="data-kicker">Onboarding Path</p>
            <h2 className="mt-3 text-2xl font-semibold">Single connected-user flow</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-foreground/68">
              <div>1. Collect the full connected-user profile in the onboarding wizard.</div>
              <div>2. Submit the account, personnel, bank, fees, and declarations in one action.</div>
              <div>3. Let Xflow move the account through review to active status.</div>
            </div>
          </SectionCard>

          <SectionCard>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="data-kicker">Reset Demo</p>
                <h2 className="mt-2 text-2xl font-semibold">Clear local workspace</h2>
                <p className="mt-2 text-sm leading-7 text-foreground/65">
                  Removes the mock session, exporter account id, and locally stored invoices.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  clearWorkspace();
                  toast.success("Local TradEdge workspace cleared.");
                }}
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
