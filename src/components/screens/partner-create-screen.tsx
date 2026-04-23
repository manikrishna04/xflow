"use client";

import Link from "next/link";
import { ArrowLeft, Building2, Plus, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  useConnectedUserQuery,
  useCreatePartnerAccountMutation,
} from "@/lib/hooks/use-tradedge-actions";
import { createPartnerAccountSchema } from "@/lib/tradedge/schemas";
import { formatConnectedUserStatus, isConnectedUserActive } from "@/lib/tradedge/onboarding";
import { useTradEdgeStore } from "@/lib/store/tradedge-store";

const COUNTRY_OPTIONS = [
  { code: "US", label: "United States" },
  { code: "IN", label: "India" },
  { code: "GB", label: "United Kingdom" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "CA", label: "Canada" },
  { code: "SG", label: "Singapore" },
  { code: "AU", label: "Australia" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "NL", label: "Netherlands" },
] as const;

function metadataEntriesToObject(entries: Array<{ key: string; value: string }>) {
  const normalized = entries
    .map((entry) => ({
      key: entry.key.trim(),
      value: entry.value.trim(),
    }))
    .filter((entry) => entry.key.length > 0);

  return normalized.length > 0
    ? Object.fromEntries(normalized.map((entry) => [entry.key, entry.value]))
    : undefined;
}

export function PartnerCreateScreen() {
  const router = useRouter();
  const exporter = useTradEdgeStore((state) => state.exporter);
  const connectedUserQuery = useConnectedUserQuery(exporter?.accountId);
  const createPartner = useCreatePartnerAccountMutation();
  const [isRouting, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [sameAsAbove, setSameAsAbove] = useState(true);
  const [form, setForm] = useState({
    addressCity: "New York",
    addressCountry: "US",
    addressLine1: "123 Trade Street",
    addressLine2: "",
    addressPostalCode: "10001",
    addressState: "NY",
    email: "finance@northstarretail.com",
    legalName: "Northstar Retail LLC",
    metadata: [{ key: "crm_id", value: "partner-001" }],
    nickname: "Northstar Retail LLC",
    partnerType: "company" as "company" | "individual",
  });

  if (!exporter) {
    return (
      <EmptyState
        title="Complete connected-user onboarding first"
        description="Partners belong to the connected user. Finish onboarding and wait for the account to become active before creating partners."
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
        description={`The connected user is currently ${formatConnectedUserStatus(accountStatus)}. Xflow requires the account to be Active before partners can be created.`}
        actionHref="/onboarding"
        actionLabel="Open Onboarding"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Partners"
        title="Add partner"
        description="Create partners as a separate step so receivable creation can reuse approved partner records instead of recreating them each time."
        actions={
          <Link href="/partners">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" />
              Back to partners
            </Button>
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold">Partner information</h2>
              <p className="mt-1 text-sm text-foreground/65">
                Add the buyer once here, then select the same partner from the receivable form.
              </p>
            </div>
          </div>

          <form
            className="mt-8 space-y-8"
            onSubmit={async (event) => {
              event.preventDefault();
              setError("");

              const parsed = createPartnerAccountSchema.safeParse({
                address: {
                  city: form.addressCity,
                  country: form.addressCountry,
                  line1: form.addressLine1,
                  line2: form.addressLine2 || undefined,
                  postalCode: form.addressPostalCode,
                  state: form.addressState,
                },
                country: form.addressCountry,
                email: form.email,
                exporterAccountId: exporter.accountId,
                legalName: form.legalName,
                metadata: metadataEntriesToObject(form.metadata),
                nickname: form.nickname,
                partnerType: form.partnerType,
              });

              if (!parsed.success) {
                setError(parsed.error.issues[0]?.message || "Enter valid partner details.");
                return;
              }

              try {
                const partnerInput = {
                  address: parsed.data.address,
                  country: parsed.data.country,
                  email: parsed.data.email,
                  legalName: parsed.data.legalName,
                  metadata: parsed.data.metadata,
                  nickname: parsed.data.nickname,
                  partnerType: parsed.data.partnerType,
                };
                const response = await createPartner.mutateAsync(partnerInput);

                if (response.activationWarning) {
                  toast.error(response.activationWarning, { duration: 5000 });
                } else {
                  toast.success("Partner created.");
                }

                startTransition(() => {
                  router.push("/partners");
                });
              } catch (mutationError) {
                setError(
                  mutationError instanceof Error
                    ? mutationError.message
                    : "Could not create the partner.",
                );
              }
            }}
          >
            <div className="space-y-5">
              <div>
                <p className="data-kicker">Basic Information</p>
              </div>

              <div className="space-y-5">
                <div>
                  <Label htmlFor="legalName">Legal Name</Label>
                  <Input
                    id="legalName"
                    placeholder="Enter Partner's Legal Name"
                    value={form.legalName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        legalName: event.target.value,
                        nickname: sameAsAbove ? event.target.value : current.nickname,
                      }))
                    }
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <Label htmlFor="nickname">Nickname</Label>
                    <Input
                      id="nickname"
                      placeholder="Enter Partner's Nickname"
                      value={form.nickname}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, nickname: event.target.value }))
                      }
                    />
                  </div>
                  <label className="mt-7 flex items-center gap-2 text-sm text-foreground/70">
                    <input
                      type="checkbox"
                      checked={sameAsAbove}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setSameAsAbove(checked);
                        if (checked) {
                          setForm((current) => ({ ...current, nickname: current.legalName }));
                        }
                      }}
                    />
                    Same as above
                  </label>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Select
                    id="country"
                    value={form.addressCountry}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        addressCountry: event.target.value,
                      }))
                    }
                  >
                    {COUNTRY_OPTIONS.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Add Partner's Email ID"
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="partnerType">Partner Type</Label>
                  <Select
                    id="partnerType"
                    value={form.partnerType}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        partnerType: event.target.value as "company" | "individual",
                      }))
                    }
                  >
                    <option value="company">Company</option>
                    <option value="individual">Individual</option>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-5 border-t border-black/8 pt-8">
              <div>
                <p className="data-kicker">Address</p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <Label htmlFor="line1">Line 1</Label>
                  <Input
                    id="line1"
                    placeholder="Enter Address line 1"
                    value={form.addressLine1}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        addressLine1: event.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="line2">Line 2</Label>
                  <Input
                    id="line2"
                    placeholder="Enter Address line 2"
                    value={form.addressLine2}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        addressLine2: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="Enter City"
                    value={form.addressCity}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, addressCity: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="state">State/Province/Region</Label>
                  <Input
                    id="state"
                    placeholder="Enter State/Province/Region"
                    value={form.addressState}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, addressState: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="postalCode">Zipcode</Label>
                  <Input
                    id="postalCode"
                    placeholder="Enter Zipcode"
                    value={form.addressPostalCode}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        addressPostalCode: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-5 border-t border-black/8 pt-8">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="data-kicker">Metadata</p>
                  <p className="mt-2 text-sm text-foreground/65">Optional</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      metadata: [...current.metadata, { key: "", value: "" }],
                    }))
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add Metadata
                </Button>
              </div>

              <div className="space-y-3">
                {form.metadata.map((entry, index) => (
                  <div key={`${index}-${entry.key}`} className="grid gap-3 md:grid-cols-[0.8fr_1fr_auto]">
                    <Input
                      placeholder="Key"
                      value={entry.key}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          metadata: current.metadata.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, key: event.target.value } : item,
                          ),
                        }))
                      }
                    />
                    <Input
                      placeholder="Value"
                      value={entry.value}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          metadata: current.metadata.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, value: event.target.value } : item,
                          ),
                        }))
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          metadata: current.metadata.filter((_, itemIndex) => itemIndex !== index),
                        }))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {error ? (
              <p className="rounded-2xl bg-[rgba(218,70,70,0.08)] px-4 py-3 text-sm text-[rgb(190,51,51)]">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Link href="/partners">
                <Button type="button" variant="outline" className="w-full sm:w-auto">
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={createPartner.isPending || isRouting}
              >
                {createPartner.isPending || isRouting ? "Creating partner..." : "Create Partner"}
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </SectionCard>

        <SectionCard>
          <p className="data-kicker">How It Works</p>
          <h2 className="mt-3 text-2xl font-semibold">Separate partner module</h2>
          <div className="mt-5 space-y-3 text-sm leading-7 text-foreground/68">
            <div>1. Create the partner once with legal, contact, and address details.</div>
            <div>2. Xflow activation is attempted immediately for the new partner record.</div>
            <div>3. The partner appears in the partner directory and becomes selectable in receivables.</div>
            <div>4. Receivable creation stays focused only on invoice and collection details.</div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
