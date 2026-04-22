"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { apiPost, apiRequest } from "@/lib/api-client";
import type { PurposeCodeOption } from "@/types/tradedge";
import {
  canResumeActivation,
  isConnectedUserActive,
} from "@/lib/tradedge/onboarding";
import { applyRemoteStatus, buildInvoiceRecord, buildReferenceId } from "@/lib/tradedge/invoices";
import { useTradEdgeStore } from "@/lib/store/tradedge-store";
import type {
  ConnectedUserSnapshot,
  ExporterProfile,
  InvoiceRecord,
  RemoteStatusSnapshot,
} from "@/types/tradedge";
import type { XflowAccount, XflowPayout, XflowReceivable } from "@/types/xflow";

type CreateAccountResponse = {
  account: XflowAccount;
};

type CreatePartnerResponse = {
  partner: XflowAccount;
};

type CreateReceivableResponse = {
  receivable: XflowReceivable;
  partner: XflowAccount;
};

type SimulatePaymentResponse = {
  receivable: XflowReceivable | null;
  simulation: unknown;
};

type CreatePayoutResponse = {
  payout: XflowPayout;
};

type PurposeCodesResponse = {
  purposeCodes: PurposeCodeOption[];
};

function buildExporterFromSnapshot(
  snapshot: ConnectedUserSnapshot,
  currentExporter: ExporterProfile,
  syncedAt: string,
): ExporterProfile {
  return {
    ...currentExporter,
    accountId: snapshot.account.id,
    countryCode:
      snapshot.account.business_details?.physical_address?.country || currentExporter.countryCode,
    createdAt: snapshot.account.created
      ? new Date(snapshot.account.created * 1000).toISOString()
      : currentExporter.createdAt,
    dba: snapshot.account.business_details?.dba ?? currentExporter.dba ?? null,
    email: snapshot.account.business_details?.email || currentExporter.email,
    lastSyncedAt: syncedAt,
    legalName: snapshot.account.business_details?.legal_name || currentExporter.legalName,
    status: snapshot.account.status ?? currentExporter.status,
  };
}

function exporterSnapshotMatches(current: ExporterProfile, next: ExporterProfile) {
  return (
    current.accountId === next.accountId &&
    current.countryCode === next.countryCode &&
    current.createdAt === next.createdAt &&
    current.dba === next.dba &&
    current.email === next.email &&
    current.legalName === next.legalName &&
    current.status === next.status
  );
}

export function useCreateExporterMutation() {
  const setExporter = useTradEdgeStore((state) => state.setExporter);

  return useMutation({
    mutationFn: (input: { countryCode: string; dba?: string; email: string; legalName: string }) =>
      apiPost<CreateAccountResponse, typeof input>("/api/xflow/create-account", input),
    onSuccess: ({ account }, variables) => {
      const exporter: ExporterProfile = {
        accountId: account.id,
        countryCode: variables.countryCode,
        createdAt: account.created
          ? new Date(account.created * 1000).toISOString()
          : new Date().toISOString(),
        dba: account.business_details?.dba ?? variables.dba ?? null,
        email: variables.email,
        legalName: variables.legalName,
        lastSyncedAt: new Date().toISOString(),
        status: account.status ?? null,
      };

      setExporter(exporter);
    },
  });
}

export function usePurposeCodesQuery() {
  return useQuery({
    queryFn: async () => {
      const response = await apiRequest<PurposeCodesResponse>("/api/xflow/purpose-codes");
      return response.purposeCodes;
    },
    queryKey: ["purpose-codes"],
    staleTime: 60 * 60 * 1000,
  });
}

export function useConnectedUserQuery(accountId?: string | null) {
  const setExporter = useTradEdgeStore((state) => state.setExporter);

  const query = useQuery({
    enabled: Boolean(accountId),
    queryFn: () => apiRequest<ConnectedUserSnapshot>(`/api/xflow/account/${accountId}`),
    queryKey: ["connected-user", accountId],
    refetchInterval: (queryState) => {
      const snapshot = queryState.state.data as ConnectedUserSnapshot | undefined;

      if (!snapshot?.account?.status) {
        return 10_000;
      }

      const status = snapshot.account.status.toLowerCase();
      return status === "verifying" ? 12_000 : false;
    },
    staleTime: 5_000,
  });

  useEffect(() => {
    if (!query.data) {
      return;
    }

    const currentExporter = useTradEdgeStore.getState().exporter;

    if (!currentExporter) {
      return;
    }

    const nextExporter = buildExporterFromSnapshot(
      query.data,
      currentExporter,
      query.dataUpdatedAt ? new Date(query.dataUpdatedAt).toISOString() : new Date().toISOString(),
    );

    if (exporterSnapshotMatches(currentExporter, nextExporter)) {
      return;
    }

    setExporter(nextExporter);
  }, [query.data, query.dataUpdatedAt, setExporter]);

  return query;
}

export function useUpdateConnectedUserMutation(accountId?: string | null) {
  const queryClient = useQueryClient();
  const exporter = useTradEdgeStore((state) => state.exporter);
  const setExporter = useTradEdgeStore((state) => state.setExporter);

  return useMutation({
    mutationFn: (input: {
      address?: {
        city: string;
        country: string;
        line1: string;
        postalCode: string;
        state: string;
      };
      businessDetails?: {
        countryCode: string;
        dateOfIncorporation: string;
        dba: string;
        email: string;
        legalName: string;
        productCategory: "goods" | "services" | "software";
        productDescription: string;
        website: string;
      };
      tax?: {
        businessId: string;
        gst: string;
        pan: string;
      };
      purposeCodes?: string[];
      tosAccepted?: boolean;
    }) => {
      if (!accountId) {
        throw new Error("Start connected-user onboarding first.");
      }

      return apiPost<ConnectedUserSnapshot, typeof input>(
        `/api/xflow/account/${accountId}/update`,
        input,
      );
    },
    onSuccess: (snapshot) => {
      if (!exporter) {
        return;
      }

      setExporter({
        ...exporter,
        accountId: snapshot.account.id,
        countryCode:
          snapshot.account.business_details?.physical_address?.country || exporter.countryCode,
        dba: snapshot.account.business_details?.dba ?? exporter.dba ?? null,
        email: snapshot.account.business_details?.email || exporter.email,
        lastSyncedAt: new Date().toISOString(),
        legalName:
          snapshot.account.business_details?.legal_name || exporter.legalName,
        status: snapshot.account.status ?? exporter.status,
      });

      void queryClient.invalidateQueries({
        queryKey: ["connected-user", accountId],
      });
    },
  });
}

export function useCreatePayoutAddressMutation(accountId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      bank: {
        accountHolderName: string;
        accountNumber: string;
        city: string;
        ifsc: string;
        line1: string;
        postalCode: string;
        state: string;
      };
    }) => {
      if (!accountId) {
        throw new Error("Start connected-user onboarding first.");
      }

      return apiPost<ConnectedUserSnapshot, typeof input>(
        `/api/xflow/account/${accountId}/payout-address`,
        input,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["connected-user", accountId],
      });
    },
  });
}

export function useActivateConnectedUserMutation(accountId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (!accountId) {
        throw new Error("Start connected-user onboarding first.");
      }

      return apiPost<ConnectedUserSnapshot, Record<string, never>>(
        `/api/xflow/account/${accountId}/activate`,
        {},
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["connected-user", accountId],
      });
    },
  });
}

export function useCompleteConnectedUserOnboardingMutation(accountId?: string | null) {
  const queryClient = useQueryClient();
  const setExporter = useTradEdgeStore((state) => state.setExporter);
  const signIn = useTradEdgeStore((state) => state.signIn);

  return useMutation({
    mutationFn: (input: {
      existingAccountId?: string;
      basicInfo: {
        email: string;
        legalName: string;
        dba: string;
        businessType: "individual" | "partnership" | "pvt_ltd" | "llp" | "sole_proprietorship";
      };
      aboutBusiness: {
        dateOfIncorporation: string;
        productCategory: "goods" | "services" | "software";
        productDescription: string;
        registeredAddress: {
          city: string;
          country: string;
          line1: string;
          postalCode: string;
          state: string;
        };
        website: string;
      };
      businessIdentifiers: {
        businessId: string;
        pan: string;
        gst: string;
      };
      personalInfo: {
        primaryDirector: {
          fullName: string;
          pan: string;
        };
        secondaryDirector: {
          fullName: string;
          pan: string;
        };
      };
      bankDetails: {
        accountHolderName: string;
        accountNumber: string;
        ifsc: string;
        line1: string;
        city: string;
        state: string;
        postalCode: string;
      };
      fees: {
        merchantCategoryCode: string;
        merchantSize: "small" | "medium" | "large" | "enterprise";
        estimatedMonthlyVolume: string;
        purposeCodes: string[];
      };
      summary: {
        termsAccepted: boolean;
        dataAccuracy: boolean;
      };
    }) => {
      return apiPost<ConnectedUserSnapshot, typeof input>(
        "/api/xflow/connected-user/complete",
        {
          ...input,
          ...(accountId ? { existingAccountId: accountId } : {}),
        },
      );
    },
    onSuccess: (snapshot, input) => {
      setExporter({
        accountId: snapshot.account.id,
        countryCode:
          snapshot.account.business_details?.physical_address?.country ||
          input.aboutBusiness.registeredAddress.country,
        createdAt:
          snapshot.account.created
            ? new Date(snapshot.account.created * 1000).toISOString()
            : new Date().toISOString(),
        dba: input.basicInfo.dba,
        email: input.basicInfo.email,
        legalName: input.basicInfo.legalName,
        lastSyncedAt: new Date().toISOString(),
        status: snapshot.account.status ?? null,
      });
      signIn(snapshot.account.id);

      queryClient.setQueryData(["connected-user", snapshot.account.id], snapshot);
      void queryClient.invalidateQueries({
        queryKey: ["connected-user", snapshot.account.id],
      });
    },
  });
}

export function useCreateInvoiceMutation() {
  const exporter = useTradEdgeStore((state) => state.exporter);
  const upsertInvoice = useTradEdgeStore((state) => state.upsertInvoice);

  return useMutation({
    mutationFn: async (input: {
      amountUsd: number;
      partnerId?: string;
      buyerCountry: string;
      buyerName: string;
      transactionType: "goods" | "services" | "software";
      purposeCode: string;
      invoiceNumber: string;
      description?: string;
      invoiceDate: string;
      dueDate: string;
      metadata?: Record<string, string>;
    }) => {
      if (!exporter) {
        throw new Error("Complete connected-user onboarding before issuing invoices.");
      }

      if (!isConnectedUserActive(exporter.status)) {
        if (canResumeActivation(exporter.status)) {
          throw new Error(
            "Finish connected-user onboarding before creating receivables.",
          );
        }

        throw new Error("Receivables are blocked until the connected user is active.");
      }

      const invoiceId = crypto.randomUUID();
      const referenceId = buildReferenceId();

      const partner: XflowAccount = input.partnerId
        ? {
            id: input.partnerId,
            nickname: input.buyerName,
            business_details: {
              legal_name: input.buyerName,
              physical_address: {
                country: input.buyerCountry,
              },
            },
          }
        : await apiPost<
            CreatePartnerResponse,
            {
              buyerCountry: string;
              buyerName: string;
              exporterAccountId: string;
              referenceId: string;
            }
          >("/api/xflow/create-partner", {
            buyerCountry: input.buyerCountry,
            buyerName: input.buyerName,
            exporterAccountId: exporter.accountId,
            referenceId,
          }).then((response) => response.partner);

      const { receivable, partner: returnedPartner } = await apiPost<
        CreateReceivableResponse,
        {
          amountUsd: number;
          exporterAccountId: string;
          invoiceId: string;
          partnerId: string;
          referenceId: string;
          transactionType: "goods" | "services" | "software";
          purposeCode: string;
          invoiceNumber: string;
          description?: string;
          invoiceDate: string;
          dueDate: string;
          metadata?: Record<string, string>;
        }
      >("/api/xflow/create-receivable", {
        amountUsd: input.amountUsd,
        exporterAccountId: exporter.accountId,
        invoiceId,
        partnerId: partner.id,
        referenceId,
        transactionType: input.transactionType,
        purposeCode: input.purposeCode,
        invoiceNumber: input.invoiceNumber,
        description: input.description,
        invoiceDate: input.invoiceDate,
        dueDate: input.dueDate,
        metadata: input.metadata,
      });

      return buildInvoiceRecord({
        amountUsd: input.amountUsd,
        buyerCountry: input.buyerCountry,
        buyerName: input.buyerName,
        exporterAccountId: exporter.accountId,
        exporterLegalName: exporter.legalName,
        id: invoiceId,
        partner: returnedPartner ?? partner,
        receivable,
        referenceId,
      });
    },
    onSuccess: (invoice) => {
      upsertInvoice(invoice);
    },
  });
}

export function useCreatePartnerAccountMutation() {
  const exporter = useTradEdgeStore((state) => state.exporter);

  return useMutation({
    mutationFn: async (input: {
      business_details: {
        email: string;
        legal_name: string;
        physical_address: {
          city: string;
          country: string;
          line1: string;
          postal_code: string;
          state: string;
        };
        type: "company" | "individual";
      };
      nickname: string;
      type: "partner";
      metadata?: Record<string, string>;
    }) => {
      if (!exporter) {
        throw new Error("Exporter not found. Complete onboarding first.");
      }

      return apiPost<CreatePartnerResponse, typeof input & { exporterAccountId: string }>(
        "/api/xflow/create-partner-account",
        {
          ...input,
          exporterAccountId: exporter.accountId,
        },
      );
    },
  });
}

export function useSimulatePaymentMutation(invoice?: InvoiceRecord | null) {
  const updateInvoice = useTradEdgeStore((state) => state.updateInvoice);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!invoice) {
        throw new Error("Invoice not found.");
      }

      return apiPost<
        SimulatePaymentResponse,
        {
          exporterAccountId: string;
          receivableId: string;
        }
      >("/api/xflow/simulate-payment", {
        exporterAccountId: invoice.exporterAccountId,
        receivableId: invoice.receivableId,
      });
    },
    onSuccess: (payload) => {
      if (!invoice) {
        return;
      }

      updateInvoice(invoice.id, {
        lastSyncedAt: new Date().toISOString(),
        receivableSnapshot: payload.receivable ?? invoice.receivableSnapshot ?? null,
        receivableStatus:
          payload.receivable?.status ?? invoice.receivableStatus ?? "pending",
        updatedAt: new Date().toISOString(),
      });

      void queryClient.invalidateQueries({
        queryKey: ["invoice-status", invoice.id],
      });
    },
  });
}

export function useCreatePayoutMutation(invoice?: InvoiceRecord | null) {
  const updateInvoice = useTradEdgeStore((state) => state.updateInvoice);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (amountInr?: number) => {
      if (!invoice) {
        throw new Error("Invoice not found.");
      }

      return apiPost<
        CreatePayoutResponse,
        {
          amountInr: number;
          exporterAccountId: string;
          referenceId: string;
        }
      >("/api/xflow/create-payout", {
        amountInr: amountInr ?? invoice.payoutAmountInr ?? 0,
        exporterAccountId: invoice.exporterAccountId,
        referenceId: `${invoice.referenceId}-PAYOUT`,
      });
    },
    onSuccess: ({ payout }) => {
      if (!invoice) {
        return;
      }

      updateInvoice(invoice.id, {
        lastSyncedAt: new Date().toISOString(),
        payoutId: payout.id,
        payoutSnapshot: payout,
        payoutStatus: payout.status ?? "initialized",
        updatedAt: new Date().toISOString(),
      });

      void queryClient.invalidateQueries({
        queryKey: ["invoice-status", invoice.id],
      });
    },
  });
}

export function useSyncInvoiceStatusMutation() {
  const updateInvoice = useTradEdgeStore((state) => state.updateInvoice);

  return useMutation({
    mutationFn: async (invoice: InvoiceRecord) =>
      apiPost<
        RemoteStatusSnapshot,
        {
          exporterAccountId: string;
          payoutId?: string;
          receivableId?: string;
        }
      >("/api/xflow/status", {
        exporterAccountId: invoice.exporterAccountId,
        payoutId: invoice.payoutId ?? undefined,
        receivableId: invoice.receivableId,
      }),
    onSuccess: (snapshot, invoice) => {
      updateInvoice(invoice.id, applyRemoteStatus(invoice, snapshot));
    },
  });
}

export function useSyncAllInvoiceStatusesMutation() {
  const invoices = useTradEdgeStore((state) => state.invoices);
  const updateInvoice = useTradEdgeStore((state) => state.updateInvoice);

  return useMutation({
    mutationFn: async () => {
      const syncableInvoices = invoices.filter(
        (invoice) => invoice.exporterAccountId && invoice.receivableId,
      );

      const snapshots = await Promise.all(
        syncableInvoices.map(async (invoice) => ({
          invoice,
          snapshot: await apiPost<
            RemoteStatusSnapshot,
            {
              exporterAccountId: string;
              payoutId?: string;
              receivableId?: string;
            }
          >("/api/xflow/status", {
            exporterAccountId: invoice.exporterAccountId,
            payoutId: invoice.payoutId ?? undefined,
            receivableId: invoice.receivableId,
          }),
        })),
      );

      return snapshots;
    },
    onSuccess: (snapshots) => {
      for (const { invoice, snapshot } of snapshots) {
        updateInvoice(invoice.id, applyRemoteStatus(invoice, snapshot));
      }
    },
  });
}

export function useInvoiceStatusQuery(invoice?: InvoiceRecord | null) {
  const updateInvoice = useTradEdgeStore((state) => state.updateInvoice);

  const query = useQuery({
    enabled: Boolean(invoice?.exporterAccountId && invoice?.receivableId),
    queryFn: async () => {
      if (!invoice) {
        throw new Error("Invoice not found.");
      }

      return apiPost<
        RemoteStatusSnapshot,
        {
          exporterAccountId: string;
          payoutId?: string;
          receivableId?: string;
        }
      >("/api/xflow/status", {
        exporterAccountId: invoice.exporterAccountId,
        payoutId: invoice.payoutId ?? undefined,
        receivableId: invoice.receivableId,
      });
    },
    queryKey: ["invoice-status", invoice?.id, invoice?.payoutId ?? "no-payout"],
    refetchInterval: (queryState) => {
      const snapshot = queryState.state.data as RemoteStatusSnapshot | undefined;
      const receivableStatus =
        snapshot?.receivable?.status ?? invoice?.receivableStatus ?? null;
      const payoutStatus = snapshot?.payout?.status ?? invoice?.payoutStatus ?? null;

      const receivableTerminal = ["completed", "paid", "reconciled"].includes(
        (receivableStatus || "").toLowerCase(),
      );
      const payoutTerminal = ["settled", "failed", "cancelled"].includes(
        (payoutStatus || "").toLowerCase(),
      );

      if (!invoice) {
        return false;
      }

      if (!invoice.payoutId) {
        return receivableTerminal ? false : 12_000;
      }

      return payoutTerminal ? false : 12_000;
    },
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!invoice || !query.data) {
      return;
    }

    const newStatus = applyRemoteStatus(invoice, query.data);
    
    // Only update if actual statuses changed, not just timestamps
    if (
      newStatus.receivableStatus !== invoice.receivableStatus ||
      newStatus.payoutStatus !== invoice.payoutStatus
    ) {
      updateInvoice(invoice.id, newStatus);
    }
  }, [invoice?.id, invoice?.receivableStatus, invoice?.payoutStatus, query.data, updateInvoice]);

  return query;
}
