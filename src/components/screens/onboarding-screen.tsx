"use client";

import { useState } from "react";
import toast from "react-hot-toast";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { ConnectedUserOnboardingScreen } from "@/components/screens/connected-user-onboarding-screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCompleteConnectedUserOnboardingMutation,
  useConnectedUserQuery,
} from "@/lib/hooks/use-tradedge-actions";
import {
  formatConnectedUserStatus,
  fromXflowBusinessType,
  isConnectedUserActive,
  normalizeConnectedUserStatus,
} from "@/lib/tradedge/onboarding";
import { useTradEdgeStore } from "@/lib/store/tradedge-store";
import type { XflowPerson } from "@/types/xflow";

function mapPersonToForm(person?: XflowPerson | null) {
  return {
    fullName: person?.full_name || "",
    pan: person?.supporting_ids?.tax || "",
  };
}

function getInitialPersonnel(persons: XflowPerson[] = []) {
  const directors = persons.filter((person) => Boolean(person.relationship?.director));
  const primaryDirector =
    directors.find((person) => Boolean(person.relationship?.representative)) ||
    directors[0] ||
    persons[0];
  const secondaryDirector =
    directors.find((person) => person.id !== primaryDirector?.id) ||
    persons.find((person) => person.id !== primaryDirector?.id);

  return {
    primaryDirector: mapPersonToForm(primaryDirector),
    secondaryDirector: mapPersonToForm(secondaryDirector),
  };
}

export function OnboardingScreen() {
  const exporter = useTradEdgeStore((state) => state.exporter);
  const setExporter = useTradEdgeStore((state) => state.setExporter);
  const clearWorkspace = useTradEdgeStore((state) => state.clearWorkspace);
  const connectedUserQuery = useConnectedUserQuery(exporter?.accountId);
  const completeOnboarding = useCompleteConnectedUserOnboardingMutation(exporter?.accountId);
  const [accountRecoveryId, setAccountRecoveryId] = useState("");

  const snapshot = connectedUserQuery.data;
  const account = snapshot?.account;
  const accountStatus = account?.status ?? exporter?.status ?? null;
  const normalizedStatus = normalizeConnectedUserStatus(accountStatus);
  const showSubmittedState =
    Boolean(account) && (isConnectedUserActive(accountStatus) || normalizedStatus === "verifying");

  if (exporter?.accountId && connectedUserQuery.isLoading && !snapshot) {
    return (
      <EmptyState
        title="Loading connected user"
        description="Fetching the latest connected-user details from Xflow."
      />
    );
  }

  if (exporter?.accountId && !connectedUserQuery.isLoading && !snapshot) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Onboarding"
          title="Connected User Unavailable"
          description="The saved connected-user account id could not be loaded from Xflow. This usually means the browser has a stale account id saved locally."
        />

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <SectionCard>
            <p className="data-kicker">Saved Workspace Account</p>
            <h2 className="mt-3 text-2xl font-semibold">{exporter.accountId}</h2>
            <p className="mt-3 text-sm leading-7 text-foreground/66">
              Replace it with the real connected-user draft account id to continue onboarding.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <Label htmlFor="accountRecoveryId">Correct Connected User Account ID</Label>
                <Input
                  id="accountRecoveryId"
                  placeholder="account_F0A_..."
                  value={accountRecoveryId}
                  onChange={(event) => setAccountRecoveryId(event.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => {
                    const nextAccountId = accountRecoveryId.trim();

                    if (!nextAccountId) {
                      toast.error("Enter the correct connected-user account id first.");
                      return;
                    }

                    setExporter({
                      ...exporter,
                      accountId: nextAccountId,
                      lastSyncedAt: new Date().toISOString(),
                    });
                    toast.success("Connected-user account id updated.");
                  }}
                >
                  Use This Account ID
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    clearWorkspace();
                    toast.success("Local workspace cleared.");
                  }}
                >
                  Clear Local Workspace
                </Button>
              </div>
            </div>
          </SectionCard>

          <SectionCard>
            <p className="data-kicker">Recovery Notes</p>
            <h2 className="mt-3 text-2xl font-semibold">Why this happened</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-foreground/68">
              <div>The app stores the connected-user account id in browser local storage.</div>
              <div>If that saved id does not exist in Xflow anymore, onboarding cannot continue.</div>
              <div>Once you replace it with the real draft account id, the onboarding wizard will resume from that account.</div>
            </div>
          </SectionCard>
        </div>
      </div>
    );
  }

  if (showSubmittedState && account) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Onboarding"
          title={
            normalizedStatus === "verifying" ? "Connected User Submitted" : "Connected User Active"
          }
          description={
            normalizedStatus === "verifying"
              ? "The connected user has been submitted to Xflow and is currently under review."
              : "The connected user is active and ready for receivables and payouts."
          }
        />

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <SectionCard>
            <p className="data-kicker">Account Overview</p>
            <h2 className="mt-3 text-3xl font-semibold">
              {account.business_details?.legal_name || exporter?.legalName}
            </h2>
            <div className="mt-4">
              <StatusBadge status={account.status} label={formatConnectedUserStatus(account.status)} />
            </div>
            <div className="mt-6 space-y-3 text-sm text-foreground/68">
              <div>
                <span className="font-semibold text-foreground">Account ID:</span> {account.id}
              </div>
              <div>
                <span className="font-semibold text-foreground">Business email:</span>{" "}
                {account.business_details?.email || exporter?.email}
              </div>
              <div>
                <span className="font-semibold text-foreground">Nickname:</span>{" "}
                {account.nickname || "Generated during onboarding"}
              </div>
              <div>
                <span className="font-semibold text-foreground">Personnel records:</span>{" "}
                {String(snapshot?.persons.length ?? 0)}
              </div>
            </div>
          </SectionCard>

          <SectionCard>
            <p className="data-kicker">Lifecycle Status</p>
            <h2 className="mt-3 text-3xl font-semibold">
              {formatConnectedUserStatus(account.status)}
            </h2>
            <p className="mt-4 text-sm leading-7 text-foreground/66">
              {normalizedStatus === "verifying"
                ? "Xflow is reviewing the submitted connected-user details. If they need anything else, the account can move to Required Information."
                : "The connected user has cleared onboarding and can now be used in the transaction flow."}
            </p>
          </SectionCard>
        </div>
      </div>
    );
  }

  const initialPurposeCodes = (account?.purpose_code ?? [])
    .map((item) => item.code?.trim())
    .filter((code): code is string => Boolean(code));
  const initialPersonnel = getInitialPersonnel(snapshot?.persons ?? []);

  const initialData = {
    existingAccountId: exporter?.accountId || undefined,
    aboutBusiness: {
      dateOfIncorporation: account?.business_details?.date_of_incorporation || "",
      productCategory:
        (account?.business_details?.product_category as "goods" | "services" | "software") ||
        "services",
      productDescription: account?.business_details?.product_description || "",
      registeredAddress: {
        city: account?.business_details?.physical_address?.city || "",
        country:
          account?.business_details?.physical_address?.country || exporter?.countryCode || "IN",
        line1: account?.business_details?.physical_address?.line1 || "",
        postalCode: account?.business_details?.physical_address?.postal_code || "",
        state: account?.business_details?.physical_address?.state || "",
      },
      website: account?.business_details?.website || "",
    },
    bankDetails: {
      accountHolderName: snapshot?.payoutAddresses[0]?.name || exporter?.legalName || "",
      accountNumber: snapshot?.payoutAddresses[0]?.bank_account?.number || "",
      city: snapshot?.payoutAddresses[0]?.billing_details?.city || "",
      ifsc:
        snapshot?.payoutAddresses[0]?.bank_account?.domestic_credit ||
        snapshot?.payoutAddresses[0]?.bank_account?.domestic_wire ||
        "",
      line1: snapshot?.payoutAddresses[0]?.billing_details?.line1 || "",
      postalCode: snapshot?.payoutAddresses[0]?.billing_details?.postal_code || "",
      state: snapshot?.payoutAddresses[0]?.billing_details?.state || "",
    },
    basicInfo: {
      businessType: fromXflowBusinessType(account?.business_details?.type),
      dba: account?.business_details?.dba || exporter?.dba || "",
      email: account?.business_details?.email || exporter?.email || "",
      legalName: account?.business_details?.legal_name || exporter?.legalName || "",
    },
    businessIdentifiers: {
      businessId: account?.business_details?.ids?.business || "",
      gst: account?.business_details?.ids?.tax_gst || "",
      pan: account?.business_details?.ids?.tax || "",
    },
    fees: {
      estimatedMonthlyVolume: account?.business_details?.estimated_monthly_volume?.amount || "",
      merchantCategoryCode: account?.business_details?.merchant_category_code || "",
      merchantSize:
        (account?.business_details?.merchant_size as
          | "small"
          | "medium"
          | "large"
          | "enterprise") || "small",
      purposeCodes: initialPurposeCodes,
    },
    personalInfo: {
      primaryDirector: initialPersonnel.primaryDirector,
      secondaryDirector: initialPersonnel.secondaryDirector,
    },
    summary: {
      dataAccuracy: false,
      termsAccepted: Boolean(account?.tos_acceptance?.time),
    },
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Onboarding"
        title="Connected User Onboarding"
        description="Capture every required connected-user field up front. Submitting this form creates or updates the account, adds the required people, saves bank details, and requests activation in one flow."
      />

      {normalizedStatus === "input_required" ? (
        <SectionCard>
          <p className="data-kicker">Action Needed</p>
          <h2 className="mt-3 text-2xl font-semibold">Xflow requested additional information</h2>
          <p className="mt-3 text-sm leading-7 text-foreground/66">
            Review the connected-user details below, update anything missing, and submit again.
          </p>
        </SectionCard>
      ) : null}

      <ConnectedUserOnboardingScreen
        key={`${exporter?.accountId || "new"}-${snapshot?.persons.length || 0}-${account?.status || "draft"}`}
        initialData={initialData}
        isLoading={completeOnboarding.isPending}
        submitLabel={exporter?.accountId ? "Submit Connected User" : "Create Connected User"}
        onSubmit={async (data) => {
          try {
            await completeOnboarding.mutateAsync(data);
            toast.success("Connected-user onboarding submitted.");
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Failed to submit connected-user onboarding.",
            );
            throw error;
          }
        }}
      />
    </div>
  );
}
