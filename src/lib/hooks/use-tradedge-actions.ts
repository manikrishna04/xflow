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
  PartnerRecord,
  ReceivableQuoteLockSnapshot,
  ReceivableQuoteSnapshot,
  RemoteStatusSnapshot,
} from "@/types/tradedge";
import type {
  XflowAccount,
  XflowBalance,
  XflowList,
  XflowPayout,
  XflowQuote,
  XflowQuoteLock,
  XflowReceivable,
  XflowReceivableReconciliation,
  XflowTransfer,
} from "@/types/xflow";

type CreateAccountResponse = {
  account: XflowAccount;
};

type CreatePartnerResponse = {
  activationWarning?: string | null;
  partner: XflowAccount;
};

type CreateReceivableResponse = {
  confirmationWarning?: string | null;
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

type ReceivableQuoteResponse = {
  quote: XflowQuote;
};

type ReceivableQuoteLockResponse = {
  quoteLock: XflowQuoteLock;
};

type ReconcileReceivableResponse = {
  receivable: XflowReceivable;
  reconciliation: XflowReceivableReconciliation;
};

type PayoutListResponse = {
  payouts: XflowList<XflowPayout>;
};

type PayoutResponse = {
  payout: XflowPayout;
};

type PurposeCodesResponse = {
  purposeCodes: PurposeCodeOption[];
};

type PartnerCreationInput = {
  address: {
    city: string;
    country: string;
    line1: string;
    line2?: string;
    postalCode: string;
    state: string;
  };
  country: string;
  email: string;
  legalName: string;
  metadata?: Record<string, string>;
  nickname: string;
  partnerType: "company" | "individual";
};

type ConnectedUserTopupResponse = {
  balance: XflowBalance | null;
  recentTopups: XflowTransfer[];
  topUpSourceAccountId: string | null;
  transfer: XflowTransfer;
  treasuryWarning?: string | null;
};

function buildPartnerRecord(
  partner: XflowAccount,
  activationWarning?: string | null,
): PartnerRecord {
  const timestamp = partner.created
    ? new Date(partner.created * 1000).toISOString()
    : new Date().toISOString();

  return {
    activationWarning: activationWarning ?? null,
    createdAt: timestamp,
    id: partner.id,
    snapshot: partner,
    updatedAt: new Date().toISOString(),
  };
}

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

export function useTopUpConnectedUserBalanceMutation(accountId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      amount: string;
      currency: string;
      description?: string;
    }) => {
      if (!accountId) {
        throw new Error("Connected-user account id is missing.");
      }

      return apiPost<ConnectedUserTopupResponse, typeof input>(
        `/api/xflow/account/${accountId}/topup`,
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
  const upsertPartner = useTradEdgeStore((state) => state.upsertPartner);

  return useMutation({
    mutationFn: async (input: {
      amountUsd: number;
      description?: string;
      dueDate: string;
      invoiceDate: string;
      invoiceDocumentId?: string;
      invoiceNumber: string;
      metadata?: Record<string, string>;
      partnerDetails: PartnerCreationInput;
      purposeCode: string;
      transactionType: "goods" | "services" | "software";
    }) => {
      if (!exporter) {
        throw new Error("Complete connected-user onboarding before creating receivables.");
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

      const partnerResponse = await apiPost<
        CreatePartnerResponse,
        PartnerCreationInput & { exporterAccountId: string }
      >("/api/xflow/create-partner-account", {
        ...input.partnerDetails,
        exporterAccountId: exporter.accountId,
      });

      const partner = partnerResponse.partner;

      const { confirmationWarning, receivable, partner: returnedPartner } = await apiPost<
        CreateReceivableResponse,
        {
          amountUsd: number;
          description?: string;
          dueDate: string;
          exporterAccountId: string;
          invoiceDate: string;
          invoiceDocumentId?: string;
          invoiceId: string;
          invoiceNumber: string;
          metadata?: Record<string, string>;
          partnerId: string;
          purposeCode: string;
          referenceId: string;
          transactionType: "goods" | "services" | "software";
        }
      >("/api/xflow/create-receivable", {
        amountUsd: input.amountUsd,
        description: input.description,
        exporterAccountId: exporter.accountId,
        invoiceDate: input.invoiceDate,
        invoiceDocumentId: input.invoiceDocumentId,
        invoiceId,
        invoiceNumber: input.invoiceNumber,
        dueDate: input.dueDate,
        metadata: input.metadata,
        partnerId: partner.id,
        purposeCode: input.purposeCode,
        referenceId,
        transactionType: input.transactionType,
      });

      return buildInvoiceRecord({
        amountUsd: input.amountUsd,
        buyerCountry: input.partnerDetails.country,
        buyerName: input.partnerDetails.legalName,
        creationWarning: confirmationWarning,
        exporterAccountId: exporter.accountId,
        exporterLegalName: exporter.legalName,
        id: invoiceId,
        partner: returnedPartner ?? partner,
        receivable,
        referenceId,
      });
    },
    onSuccess: (invoice) => {
      if (invoice.partnerSnapshot) {
        upsertPartner(buildPartnerRecord(invoice.partnerSnapshot));
      }
      upsertInvoice(invoice);
    },
  });
}

export function useCreateReceivableMutation() {
  const exporter = useTradEdgeStore((state) => state.exporter);
  const upsertInvoice = useTradEdgeStore((state) => state.upsertInvoice);
  const upsertPartner = useTradEdgeStore((state) => state.upsertPartner);

  return useMutation({
    mutationFn: async (input: {
      amountUsd: number;
      description?: string;
      dueDate?: string;
      invoiceDate: string;
      invoiceDocumentId?: string;
      invoiceNumber: string;
      metadata?: Record<string, string>;
      partnerId: string;
      purposeCode: string;
      transactionType: "goods" | "services" | "software";
    }) => {
      if (!exporter) {
        throw new Error("Complete connected-user onboarding before creating receivables.");
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

      const { confirmationWarning, partner, receivable } = await apiPost<
        CreateReceivableResponse,
        {
          amountUsd: number;
          description?: string;
          dueDate?: string;
          exporterAccountId: string;
          invoiceDate: string;
          invoiceDocumentId?: string;
          invoiceId: string;
          invoiceNumber: string;
          metadata?: Record<string, string>;
          partnerId: string;
          purposeCode: string;
          referenceId: string;
          transactionType: "goods" | "services" | "software";
        }
      >("/api/xflow/create-receivable", {
        amountUsd: input.amountUsd,
        description: input.description,
        dueDate: input.dueDate,
        exporterAccountId: exporter.accountId,
        invoiceDate: input.invoiceDate,
        invoiceDocumentId: input.invoiceDocumentId,
        invoiceId,
        invoiceNumber: input.invoiceNumber,
        metadata: input.metadata,
        partnerId: input.partnerId,
        purposeCode: input.purposeCode,
        referenceId,
        transactionType: input.transactionType,
      });

      const buyerCountry = partner.business_details?.physical_address?.country || "US";
      const buyerName =
        partner.business_details?.legal_name || partner.nickname || input.partnerId;

      return {
        invoice: buildInvoiceRecord({
          amountUsd: input.amountUsd,
          buyerCountry,
          buyerName,
          creationWarning: confirmationWarning,
          exporterAccountId: exporter.accountId,
          exporterLegalName: exporter.legalName,
          id: invoiceId,
          partner,
          receivable,
          referenceId,
        }),
        partner: buildPartnerRecord(partner),
      };
    },
    onSuccess: ({ invoice, partner }) => {
      upsertPartner(partner);
      upsertInvoice(invoice);
    },
  });
}

export function useCreatePartnerAccountMutation() {
  const exporter = useTradEdgeStore((state) => state.exporter);
  const upsertPartner = useTradEdgeStore((state) => state.upsertPartner);

  return useMutation({
    mutationFn: async (input: {
      address: {
        city: string;
        country: string;
        line1: string;
        line2?: string;
        postalCode: string;
        state: string;
      };
      country: string;
      email: string;
      legalName: string;
      metadata?: Record<string, string>;
      nickname: string;
      partnerType: "company" | "individual";
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
    onSuccess: ({ activationWarning, partner }) => {
      upsertPartner(buildPartnerRecord(partner, activationWarning));
    },
  });
}

export function useReceivableQuoteQuery(options: {
  amount?: string;
  buyCurrency?: string;
  enabled?: boolean;
  exporterAccountId?: string | null;
  sellCurrency?: string;
}) {
  return useQuery({
    enabled:
      (options.enabled ?? true) &&
      Boolean(
        options.exporterAccountId &&
          options.amount &&
          options.buyCurrency &&
          options.sellCurrency,
      ),
    queryFn: async () => {
      if (
        !options.exporterAccountId ||
        !options.amount ||
        !options.buyCurrency ||
        !options.sellCurrency
      ) {
        throw new Error("Receivable quote inputs are incomplete.");
      }

      const response = await apiPost<
        ReceivableQuoteResponse,
        {
          amount: string;
          buyCurrency: string;
          exporterAccountId: string;
          sellCurrency: string;
          type: "payout_fx";
        }
      >("/api/xflow/quotes", {
        amount: options.amount,
        buyCurrency: options.buyCurrency,
        exporterAccountId: options.exporterAccountId,
        sellCurrency: options.sellCurrency,
        type: "payout_fx",
      });

      return {
        fetchedAt: new Date().toISOString(),
        quote: response.quote,
      } satisfies ReceivableQuoteSnapshot;
    },
    queryKey: [
      "receivable-quote",
      options.exporterAccountId,
      options.amount,
      options.sellCurrency,
      options.buyCurrency,
    ],
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useCreateQuoteLockMutation(invoice?: InvoiceRecord | null) {
  return useMutation({
    mutationFn: async (input: {
      amount: string;
      buyCurrency: string;
      exporterAccountId: string;
      sellCurrency: string;
    }) => {
      const response = await apiPost<
        ReceivableQuoteLockResponse,
        {
          amount: string;
          buyCurrency: string;
          exporterAccountId: string;
          lockDuration: "120";
          sellCurrency: string;
          type: "payout_fx";
        }
      >("/api/xflow/quote-locks", {
        amount: input.amount,
        buyCurrency: input.buyCurrency,
        exporterAccountId: input.exporterAccountId,
        lockDuration: "120",
        sellCurrency: input.sellCurrency,
        type: "payout_fx",
      });

      return {
        createdAt: new Date().toISOString(),
        quoteLock: response.quoteLock,
      } satisfies ReceivableQuoteLockSnapshot;
    },
    mutationKey: ["create-quote-lock", invoice?.id ?? "no-invoice"],
  });
}

export function useReconcileReceivableMutation(invoice?: InvoiceRecord | null) {
  const updateInvoice = useTradEdgeStore((state) => state.updateInvoice);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      addressId?: string;
      amount: string;
      liveFx?: "enabled" | "disabled";
      quoteLockId?: string;
    }) => {
      if (!invoice) {
        throw new Error("Receivable not found.");
      }

      return apiPost<
        ReconcileReceivableResponse,
        {
          addressId?: string;
          amount: string;
          debitAccountId: string;
          exporterAccountId: string;
          liveFx?: "enabled" | "disabled";
          quoteLockId?: string;
          receivableId: string;
        }
      >("/api/xflow/receivables/reconcile", {
        addressId: input.addressId,
        amount: input.amount,
        debitAccountId: invoice.exporterAccountId,
        exporterAccountId: invoice.exporterAccountId,
        liveFx: input.liveFx,
        quoteLockId: input.quoteLockId,
        receivableId: invoice.receivableId,
      });
    },
    onSuccess: ({ receivable, reconciliation }) => {
      if (!invoice) {
        return;
      }

      updateInvoice(invoice.id, {
        lastSyncedAt: new Date().toISOString(),
        receivableReconciliationSnapshot: reconciliation,
        receivableSnapshot: receivable,
        receivableStatus: receivable.status ?? invoice.receivableStatus ?? "pending",
        updatedAt: new Date().toISOString(),
      });

      void queryClient.invalidateQueries({
        queryKey: ["invoice-status", invoice.id],
      });
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

export function usePayoutsQuery(input: {
  accountId?: string | null;
  createdGt?: number;
  limit?: number;
  startingAfter?: string;
  status?: string;
}) {
  return useQuery({
    enabled: Boolean(input.accountId),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("accountId", input.accountId ?? "");
      params.set("limit", String(input.limit ?? 10));

      if (input.createdGt) {
        params.set("created.gt", String(input.createdGt));
      }

      if (input.startingAfter) {
        params.set("starting_after", input.startingAfter);
      }

      if (input.status && input.status !== "all") {
        params.set("status", input.status);
      }

      const response = await apiRequest<PayoutListResponse>(
        `/api/xflow/payouts?${params.toString()}`,
      );

      return response.payouts;
    },
    queryKey: [
      "payouts",
      input.accountId,
      input.createdGt ?? "all-time",
      input.limit ?? 10,
      input.startingAfter ?? "first-page",
      input.status ?? "all",
    ],
    refetchInterval: (queryState) => {
      const payouts = (queryState.state.data as XflowList<XflowPayout> | undefined)?.data ?? [];
      const hasActivePayout = payouts.some((payout) =>
        ["initialized", "processing", "hold"].includes((payout.status || "").toLowerCase()),
      );

      return hasActivePayout ? 12_000 : false;
    },
    staleTime: 8_000,
  });
}

export function usePayoutQuery(payoutId?: string | null, accountId?: string | null) {
  return useQuery({
    enabled: Boolean(payoutId && accountId),
    queryFn: async () => {
      const params = new URLSearchParams({
        accountId: accountId ?? "",
      });
      const response = await apiRequest<PayoutResponse>(
        `/api/xflow/payouts/${payoutId}?${params.toString()}`,
      );

      return response.payout;
    },
    queryKey: ["payout", accountId, payoutId],
    refetchInterval: (queryState) => {
      const payout = queryState.state.data as XflowPayout | undefined;
      const status = (payout?.status || "").toLowerCase();

      return ["initialized", "processing", "hold"].includes(status) ? 12_000 : false;
    },
    staleTime: 8_000,
  });
}

export function useUpdatePayoutMetadataMutation(payoutId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      accountId: string;
      metadata: Record<string, string>;
    }) => {
      if (!payoutId) {
        throw new Error("Payout id is missing.");
      }

      return apiPost<PayoutResponse, typeof input>(
        `/api/xflow/payouts/${payoutId}`,
        input,
      );
    },
    onSuccess: ({ payout }, input) => {
      queryClient.setQueryData(["payout", input.accountId, payout.id], payout);
      void queryClient.invalidateQueries({
        queryKey: ["payouts", input.accountId],
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

    if (
      newStatus.receivableStatus !== invoice.receivableStatus ||
      newStatus.payoutStatus !== invoice.payoutStatus
    ) {
      updateInvoice(invoice.id, newStatus);
    }
  }, [invoice, query.data, updateInvoice]);

  return query;
}
