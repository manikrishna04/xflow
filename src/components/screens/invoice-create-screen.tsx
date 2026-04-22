"use client";

import { FilePlus2, Landmark, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useConnectedUserQuery,
  useCreateInvoiceMutation,
} from "@/lib/hooks/use-tradedge-actions";
import { formatConnectedUserStatus, isConnectedUserActive } from "@/lib/tradedge/onboarding";
import { invoiceFormSchema } from "@/lib/tradedge/schemas";
import { useTradEdgeStore } from "@/lib/store/tradedge-store";

export function InvoiceCreateScreen() {
  const router = useRouter();
  const exporter = useTradEdgeStore((state) => state.exporter);
  const connectedUserQuery = useConnectedUserQuery(exporter?.accountId);
  const createInvoice = useCreateInvoiceMutation();
  const [isRouting, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    amountUsd: "1250",
    buyerCountry: "US",
    buyerName: "Northstar Retail LLC",
  });

  if (!exporter) {
    return (
      <EmptyState
        title="Complete connected-user onboarding first"
        description="Receivables belong to the connected user. Finish onboarding and wait for the account to become active before issuing invoices."
        actionHref="/onboarding"
        actionLabel="Open Onboarding"
      />
    );
  }

  const accountStatus = connectedUserQuery.data?.account.status ?? exporter.status;
  const transactionsEnabled = isConnectedUserActive(accountStatus);

  if (!transactionsEnabled) {
    return (
      <EmptyState
        title="Transactions are blocked"
        description={`The connected user is currently ${formatConnectedUserStatus(accountStatus)}. Xflow parity requires the account to be Active before a buyer partner or receivable can be created.`}
        actionHref="/onboarding"
        actionLabel="Open Onboarding"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="New Invoice"
        title="Create a buyer receivable"
        description="TradEdge will create the buyer as a partner under the exporter, then issue a USD receivable and save the result in local storage for the rest of the frontend-only flow."
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FilePlus2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold">Buyer invoice form</h2>
              <p className="mt-1 text-sm text-foreground/65">
                The form stays intentionally lean. Missing sandbox details like buyer email
                are generated automatically on the server route.
              </p>
            </div>
          </div>

          <form
            className="mt-8 space-y-5"
            onSubmit={async (event) => {
              event.preventDefault();
              setError("");

              const parsed = invoiceFormSchema.safeParse({
                amountUsd: Number(form.amountUsd),
                buyerCountry: form.buyerCountry,
                buyerName: form.buyerName,
              });

              if (!parsed.success) {
                setError(parsed.error.issues[0]?.message || "Enter valid invoice details.");
                return;
              }

              try {
                const invoice = await createInvoice.mutateAsync(parsed.data);
                toast.success("Buyer partner and receivable created.");
                startTransition(() => {
                  router.push(`/invoices/${invoice.id}`);
                });
              } catch (mutationError) {
                setError(
                  mutationError instanceof Error
                    ? mutationError.message
                    : "Could not create the invoice flow.",
                );
              }
            }}
          >
            <div>
              <Label htmlFor="buyerName">Buyer legal name</Label>
              <Input
                id="buyerName"
                value={form.buyerName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, buyerName: event.target.value }))
                }
              />
            </div>

            <div>
              <Label htmlFor="buyerCountry">Buyer country code</Label>
              <Input
                id="buyerCountry"
                maxLength={2}
                value={form.buyerCountry}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    buyerCountry: event.target.value.toUpperCase(),
                  }))
                }
              />
            </div>

            <div>
              <Label htmlFor="amountUsd">Amount in USD</Label>
              <Input
                id="amountUsd"
                inputMode="decimal"
                value={form.amountUsd}
                onChange={(event) =>
                  setForm((current) => ({ ...current, amountUsd: event.target.value }))
                }
              />
            </div>

            {error ? (
              <p className="rounded-2xl bg-[rgba(218,70,70,0.08)] px-4 py-3 text-sm text-[rgb(190,51,51)]">
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={createInvoice.isPending || isRouting}
            >
              {createInvoice.isPending ? "Creating buyer and receivable..." : "Create invoice"}
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard>
            <p className="data-kicker">Exporter Context</p>
            <h2 className="mt-3 text-3xl font-semibold">{exporter.legalName}</h2>
            <div className="mt-4 space-y-3 text-sm text-foreground/68">
              <div>
                <span className="font-semibold text-foreground">Account:</span>{" "}
                {exporter.accountId}
              </div>
              <div>
                <span className="font-semibold text-foreground">Country:</span>{" "}
                {exporter.countryCode}
              </div>
              <div>
                <span className="font-semibold text-foreground">Email:</span> {exporter.email}
              </div>
            </div>
          </SectionCard>

          <SectionCard>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(255,167,38,0.14)] text-[rgb(170,97,23)]">
                <Landmark className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold">What happens next</h2>
                <p className="mt-1 text-sm text-foreground/65">
                  The app chains the buyer and receivable steps in sequence.
                </p>
              </div>
            </div>
            <div className="mt-6 space-y-3 text-sm leading-7 text-foreground/68">
              <div>1. Create the buyer as a partner under this exporter.</div>
              <div>2. Create and auto-confirm the receivable in USD.</div>
              <div>3. Save the invoice locally and open the detail page.</div>
              <div>4. Share the buyer pay page or simulate payment in sandbox.</div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
