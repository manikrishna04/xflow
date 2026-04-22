"use client";

import { EmptyState } from "@/components/empty-state";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useCreatePartnerAccountMutation, useConnectedUserQuery } from "@/lib/hooks/use-tradedge-actions";
import { formatConnectedUserStatus, isConnectedUserActive } from "@/lib/tradedge/onboarding";
import { useTradEdgeStore } from "@/lib/store/tradedge-store";

export function PartnerCreateScreen() {
  const router = useRouter();
  const exporter = useTradEdgeStore((state) => state.exporter);
  const connectedUserQuery = useConnectedUserQuery(exporter?.accountId);
  const createPartner = useCreatePartnerAccountMutation();
  const [isRouting, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    nickname: "",
    business_details: {
      email: "",
      legal_name: "",
      physical_address: {
        city: "",
        country: "",
        line1: "",
        postal_code: "",
        state: "",
      },
      type: "company" as "company" | "individual",
    },
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
        description={`The connected user is currently ${formatConnectedUserStatus(accountStatus)}. Xflow parity requires the account to be Active before partners can be created.`}
        actionHref="/onboarding"
        actionLabel="Open Onboarding"
      />
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      await createPartner.mutateAsync({
        ...form,
        type: "partner",
      });

      toast.success("Partner account created successfully!");
      startTransition(() => {
        router.push("/partners");
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create partner account");
    }
  };

  const updateForm = (field: string, value: string) => {
    setForm((prev) => {
      const keys = field.split(".");
      const newForm = JSON.parse(JSON.stringify(prev)); // Deep clone
      let current = newForm as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newForm;
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Partner Account"
        title="Create Partner Account"
        description="Add a new partner to your Xflow network"
      />

      <SectionCard>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="nickname">Nickname</Label>
              <Input
                id="nickname"
                value={form.nickname}
                onChange={(e) => updateForm("nickname", e.target.value)}
                placeholder="Unique name for the account"
                required
              />
            </div>

            <div>
              <Label htmlFor="business_type">Business Type</Label>
              <Select
                id="business_type"
                value={form.business_details.type}
                onChange={(e) => updateForm("business_details.type", e.target.value as "company" | "individual")}
                required
              >
                <option value="company">Company</option>
                <option value="individual">Individual</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="legal_name">Legal Name</Label>
              <Input
                id="legal_name"
                value={form.business_details.legal_name}
                onChange={(e) => updateForm("business_details.legal_name", e.target.value)}
                placeholder="Legal name of the business"
                required
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.business_details.email}
                onChange={(e) => updateForm("business_details.email", e.target.value)}
                placeholder="Business email"
                required
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Physical Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="line1">Address Line 1</Label>
                <Input
                  id="line1"
                  value={form.business_details.physical_address.line1}
                  onChange={(e) => updateForm("business_details.physical_address.line1", e.target.value)}
                  placeholder="Street address"
                  required
                />
              </div>

              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={form.business_details.physical_address.city}
                  onChange={(e) => updateForm("business_details.physical_address.city", e.target.value)}
                  placeholder="City"
                  required
                />
              </div>

              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={form.business_details.physical_address.state}
                  onChange={(e) => updateForm("business_details.physical_address.state", e.target.value)}
                  placeholder="State"
                  required
                />
              </div>

              <div>
                <Label htmlFor="postal_code">Postal Code</Label>
                <Input
                  id="postal_code"
                  value={form.business_details.physical_address.postal_code}
                  onChange={(e) => updateForm("business_details.physical_address.postal_code", e.target.value)}
                  placeholder="Postal code"
                  required
                />
              </div>

              <div>
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={form.business_details.physical_address.country}
                  onChange={(e) => updateForm("business_details.physical_address.country", e.target.value)}
                  placeholder="Country code (e.g., US)"
                  required
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          <Button
            type="submit"
            disabled={createPartner.isPending || isRouting}
            className="w-full md:w-auto"
          >
            {createPartner.isPending ? "Creating..." : "Create Partner Account"}
          </Button>
        </form>
      </SectionCard>
    </div>
  );
}