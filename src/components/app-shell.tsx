"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FileText,
  LayoutDashboard,
  LogOut,
  PlusCircle,
  ShieldEllipsis,
} from "lucide-react";
import { useMemo } from "react";

import { TradEdgeLogo } from "@/components/tradedge-logo";
import { WorkspaceLoader } from "@/components/workspace-loader";
import { Button } from "@/components/ui/button";
import { useAuthGuard } from "@/lib/hooks/use-auth-guard";
import { useTradEdgeStore } from "@/lib/store/tradedge-store";
import { cn } from "@/lib/utils";

const navigationItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/onboarding", icon: ShieldEllipsis, label: "Onboarding" },
  { href: "/invoices", icon: FileText, label: "Invoices" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { ready } = useAuthGuard();
  const exporter = useTradEdgeStore((state) => state.exporter);
  const sessionAccountId = useTradEdgeStore((state) => state.session.email);
  const signOut = useTradEdgeStore((state) => state.signOut);

  const pageTitle = useMemo(() => {
    if (pathname.startsWith("/onboarding")) return "Connected-user onboarding";
    if (pathname.startsWith("/invoices/new")) return "Issue a USD receivable";
    if (pathname.startsWith("/invoices/")) return "Invoice control room";
    if (pathname.startsWith("/invoices")) return "Receivables ledger";

    return "Connected exporter workspace";
  }, [pathname]);

  if (!ready) {
    return <WorkspaceLoader label="Checking your connected-user session and restoring local invoice data." />;
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1600px] gap-5 px-4 py-4 md:px-6 lg:px-8">
      <aside className="panel-surface hidden w-80 shrink-0 rounded-[32px] p-6 lg:flex lg:flex-col">
        <TradEdgeLogo />

        <div className="mt-8 rounded-[28px] bg-[linear-gradient(135deg,rgba(15,150,136,0.12),rgba(255,167,38,0.16))] p-5">
          <p className="data-kicker">Workspace Context</p>
          <p className="mt-3 text-xl font-semibold text-foreground">
            {exporter?.legalName || "No exporter connected"}
          </p>
          <p className="mt-2 text-sm leading-7 text-foreground/68">
            {exporter?.accountId || "Complete connected-user onboarding from the Onboarding page."}
          </p>
        </div>

        <nav className="mt-8 space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                  active
                    ? "bg-[rgba(19,33,68,0.94)] text-white shadow-[0_16px_28px_rgba(19,33,68,0.14)]"
                    : "text-foreground/74 hover:bg-black/[0.04]",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Link href="/invoices/new" className="mt-8">
          <Button className="w-full justify-center">
            <PlusCircle className="h-4 w-4" />
            New Invoice
          </Button>
        </Link>

        <div className="mt-auto rounded-[24px] border border-black/8 bg-white/70 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-foreground/45">
            Connected User Session
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground">{sessionAccountId}</p>
          <Button
            variant="ghost"
            className="mt-4 h-10 w-full justify-start px-0 text-foreground/72"
            onClick={() => {
              signOut();
              router.replace("/login");
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <header className="panel-surface rounded-[28px] px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="data-kicker">TradEdge Control</p>
              <h1 className="mt-2 text-2xl font-semibold text-foreground">{pageTitle}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="pill-surface rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/60">
                Secret Key Lives Server-Side
              </div>
              <Link href="/invoices/new" className="lg:hidden">
                <Button size="sm">
                  <PlusCircle className="h-4 w-4" />
                  New Invoice
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:hidden">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition",
                    active
                      ? "bg-[rgba(19,33,68,0.94)] text-white"
                      : "bg-white/78 text-foreground/74",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
