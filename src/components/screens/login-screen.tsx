"use client";

import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Wallet } from "lucide-react";
import { useEffect, useEffectEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import { TradEdgeLogo } from "@/components/tradedge-logo";
import { WorkspaceLoader } from "@/components/workspace-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { loginSchema } from "@/lib/tradedge/schemas";
import { useTradEdgeStore } from "@/lib/store/tradedge-store";

const flowSteps = [
  "1. Complete the connected-user onboarding flow on behalf of the exporter.",
  "2. Add the overseas buyer as a partner under that exporter.",
  "3. Issue a USD receivable and surface buyer payment instructions.",
  "4. Simulate settlement in sandbox and watch the payout move to INR.",
];

export function LoginScreen() {
  const router = useRouter();
  const hydrated = useHydrated();
  const isAuthenticated = useTradEdgeStore((state) => state.session.isAuthenticated);
  const signIn = useTradEdgeStore((state) => state.signIn);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    email: "exporter@tradedge.app",
    password: "demopass",
  });

  const redirectToDashboard = useEffectEvent(() => {
    router.replace("/dashboard");
  });

  useEffect(() => {
    if (hydrated && isAuthenticated) {
      redirectToDashboard();
    }
  }, [hydrated, isAuthenticated]);

  if (hydrated && isAuthenticated) {
    return <WorkspaceLoader label="You already have a mock session, so we are taking you to the dashboard." />;
  }

  return (
    <main className="hero-grid min-h-screen px-4 py-4 md:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1450px] gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="panel-surface hero-glow flex flex-col justify-between rounded-[36px] px-8 py-8 md:px-10 md:py-10"
        >
          <div>
            <TradEdgeLogo />
            <p className="data-kicker mt-10">Exporter Flow Workspace</p>
            <h1 className="mt-3 max-w-3xl text-5xl font-semibold leading-tight text-foreground md:text-6xl">
              Run the buyer to receivable to payout flow without ever exposing your Xflow key.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-foreground/72">
              This demo is built for the connected exporter context only. It keeps
              the secret on Next.js server routes, persists invoices locally, and
              gives you a clean sandbox surface for receivables, payment
              instructions, and INR payout tracking. The onboarding flow now
              collects the full connected-user profile up front before the
              transaction journey begins.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="rounded-[28px] bg-[rgba(15,150,136,0.08)] p-5">
              <div className="flex items-center gap-3 text-primary">
                <ShieldCheck className="h-5 w-5" />
                <p className="text-sm font-semibold uppercase tracking-[0.16em]">
                  Server Routed
                </p>
              </div>
              <p className="mt-3 text-sm leading-7 text-foreground/70">
                Every Xflow request is proxied through `app/api/xflow/*`, so no
                secret or admin context leaks into the browser bundle.
              </p>
            </div>
            <div className="rounded-[28px] bg-[rgba(255,167,38,0.12)] p-5">
              <div className="flex items-center gap-3 text-[rgb(170,97,23)]">
                <Wallet className="h-5 w-5" />
                <p className="text-sm font-semibold uppercase tracking-[0.16em]">
                  Connected User Only
                </p>
              </div>
              <p className="mt-3 text-sm leading-7 text-foreground/70">
                No platform dashboard, wallet orchestration, or custom backend.
                Just exporter onboarding, buyer creation, receivable issue, and
                payout tracking.
              </p>
            </div>
          </div>

          <div className="mt-10 rounded-[32px] bg-[rgba(19,33,68,0.94)] px-6 py-6 text-white">
            <p className="text-xs uppercase tracking-[0.22em] text-white/60">
              Flow Checklist
            </p>
            <div className="mt-4 grid gap-3">
              {flowSteps.map((step, index) => (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + index * 0.08 }}
                  className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white/82"
                >
                  {step}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className="panel-surface flex items-center rounded-[36px] px-6 py-8 md:px-8"
        >
          <form
            className="w-full"
            onSubmit={(event) => {
              event.preventDefault();
              setError("");

              const parsed = loginSchema.safeParse(form);
              if (!parsed.success) {
                setError(parsed.error.issues[0]?.message || "Enter valid credentials.");
                return;
              }

              signIn(parsed.data.email);
              toast.success("Mock session ready. Opening the dashboard.");
              startTransition(() => {
                router.replace("/dashboard");
              });
            }}
          >
            <p className="data-kicker">Mock Auth</p>
            <h2 className="mt-3 text-3xl font-semibold text-foreground">
              Sign in to the exporter console
            </h2>
            <p className="mt-3 text-sm leading-7 text-foreground/68">
              This is frontend-only auth. The session lives in local storage so you
              can move through the demo flow without adding a backend.
            </p>

            <div className="mt-8">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              />
            </div>

            <div className="mt-5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({ ...current, password: event.target.value }))
                }
              />
            </div>

            {error ? (
              <p className="mt-4 rounded-2xl bg-[rgba(218,70,70,0.08)] px-4 py-3 text-sm text-[rgb(190,51,51)]">
                {error}
              </p>
            ) : null}

            <Button type="submit" size="lg" className="mt-8 w-full" disabled={isPending}>
              Continue to Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>

            <div className="mt-8 rounded-[28px] bg-[rgba(19,33,68,0.04)] p-5 text-sm leading-7 text-foreground/68">
              Suggested demo sequence:
              <div>Complete connected-user onboarding in Onboarding.</div>
              <div>Create a buyer receivable from Invoices.</div>
              <div>Use the buyer pay page and then simulate payment.</div>
              <div>Trigger the INR payout once the receivable is paid.</div>
            </div>
          </form>
        </motion.section>
      </div>
    </main>
  );
}
