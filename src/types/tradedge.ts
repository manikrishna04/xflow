import type {
  XflowAccount,
  XflowAddress,
  XflowPayout,
  XflowPerson,
  XflowReceivable,
} from "@/types/xflow";

export type ExporterProfile = {
  accountId: string;
  countryCode: string;
  createdAt: string;
  dba?: string | null;
  email: string;
  legalName: string;
  lastSyncedAt?: string | null;
  status?: string | null;
};

export type InstructionItem = {
  label: string;
  value: string;
};

export type PurposeCodeOption = {
  code: string;
  description: string;
};

export type InvoiceRecord = {
  amountUsd: number;
  buyerCountry: string;
  buyerEmail: string;
  buyerName: string;
  createdAt: string;
  exporterAccountId: string;
  exporterLegalName?: string;
  id: string;
  lastSyncedAt?: string | null;
  partnerId: string;
  partnerSnapshot?: XflowAccount | null;
  payoutAmountInr?: number | null;
  payoutId?: string | null;
  payoutSnapshot?: XflowPayout | null;
  payoutStatus?: string | null;
  receivableId: string;
  receivableSnapshot?: XflowReceivable | null;
  receivableStatus?: string | null;
  referenceId: string;
  updatedAt: string;
};

export type RemoteStatusSnapshot = {
  fetchedAt: string;
  payout: XflowPayout | null;
  receivable: XflowReceivable | null;
};

export type ConnectedUserStatus =
  | "draft"
  | "verifying"
  | "active"
  | "activated"
  | "input_required"
  | "deactivated"
  | "hold"
  | "rejected"
  | string;

export type OnboardingRequirement = {
  field: string;
  label: string;
  section:
    | "basic_information"
    | "about_business"
    | "business_identifiers"
    | "personnel_information"
    | "bank_details"
    | "fees"
    | "summary_and_declaration";
};

export type ConnectedUserSnapshot = {
  account: XflowAccount;
  payoutAddresses: XflowAddress[];
  persons: XflowPerson[];
  progress: {
    completed: number;
    percent: number;
    total: number;
  };
  requiredItems: OnboardingRequirement[];
  statusLabel: string;
  transactionsEnabled: boolean;
};
