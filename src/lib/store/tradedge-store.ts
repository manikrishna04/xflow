"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { ExporterProfile, InvoiceRecord, PartnerRecord } from "@/types/tradedge";

type TradEdgeStore = {
  exporter: ExporterProfile | null;
  invoices: InvoiceRecord[];
  partners: PartnerRecord[];
  session: {
    email: string;
    isAuthenticated: boolean;
  };
  clearWorkspace: () => void;
  removeInvoice: (invoiceId: string) => void;
  setExporter: (exporter: ExporterProfile | null) => void;
  setPartners: (partners: PartnerRecord[]) => void;
  signIn: (email: string) => void;
  signOut: () => void;
  upsertInvoice: (invoice: InvoiceRecord) => void;
  upsertPartner: (partner: PartnerRecord) => void;
  updateInvoice: (invoiceId: string, patch: Partial<InvoiceRecord>) => void;
};

function sortInvoices(invoices: InvoiceRecord[]) {
  return [...invoices].sort(
    (left, right) => new Date(right.createdAt).valueOf() - new Date(left.createdAt).valueOf(),
  );
}

function sortPartners(partners: PartnerRecord[]) {
  return [...partners].sort(
    (left, right) => new Date(right.updatedAt).valueOf() - new Date(left.updatedAt).valueOf(),
  );
}

export const useTradEdgeStore = create<TradEdgeStore>()(
  persist(
    (set) => ({
      exporter: null,
      invoices: [],
      partners: [],
      session: {
        email: "",
        isAuthenticated: false,
      },
      clearWorkspace: () =>
        set(() => ({
          exporter: null,
          invoices: [],
          partners: [],
          session: {
            email: "",
            isAuthenticated: false,
          },
        })),
      removeInvoice: (invoiceId) =>
        set((state) => ({
          invoices: state.invoices.filter((invoice) => invoice.id !== invoiceId),
        })),
      setExporter: (exporter) => set(() => ({ exporter })),
      setPartners: (partners) => set(() => ({ partners: sortPartners(partners) })),
      signIn: (accountId) =>
        set(() => ({
          session: {
            email: accountId,
            isAuthenticated: true,
          },
        })),
      signOut: () =>
        set((state) => ({
          session: {
            ...state.session,
            isAuthenticated: false,
          },
        })),
      upsertInvoice: (invoice) =>
        set((state) => ({
          invoices: sortInvoices([
            invoice,
            ...state.invoices.filter((item) => item.id !== invoice.id),
          ]),
        })),
      upsertPartner: (partner) =>
        set((state) => ({
          partners: sortPartners([
            partner,
            ...state.partners.filter((item) => item.id !== partner.id),
          ]),
        })),
      updateInvoice: (invoiceId, patch) =>
        set((state) => ({
          invoices: sortInvoices(
            state.invoices.map((invoice) =>
              invoice.id === invoiceId
                ? {
                    ...invoice,
                    ...patch,
                  }
                : invoice,
            ),
          ),
        })),
    }),
    {
      name: "tradedge-connected-user",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
