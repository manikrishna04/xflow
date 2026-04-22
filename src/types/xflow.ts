export type XflowApiErrorPayload = {
  errors?: Array<{
    code?: string;
    message?: string;
    metadata?: Record<string, string>;
  }>;
  http_status_code?: number;
  object?: string;
};

export type XflowAccountPurposeCode = {
  code?: string | null;
  status?: string | null;
};

export type XflowAccount = {
  id: string;
  address?: string | null;
  business_details?: {
    date_of_incorporation?: string | null;
    dba?: string | null;
    email?: string | null;
    estimated_monthly_volume?: {
      amount?: string | null;
      currency?: string | null;
    } | null;
    ids?: {
      business?: string | null;
      tax?: string | null;
      tax_deduction?: string | null;
      tax_gst?: string | null;
      tax_trade?: string | null;
    } | null;
    legal_name?: string | null;
    merchant_category_code?: string | null;
    merchant_size?: string | null;
    physical_address?: {
      city?: string | null;
      country?: string | null;
      line1?: string | null;
      line2?: string | null;
      postal_code?: string | null;
      state?: string | null;
    } | null;
    product_category?: string | null;
    product_description?: string | null;
    type?: string | null;
    website?: string | null;
  } | null;
  capability?: Record<string, string> | null;
  created?: number;
  livemode?: boolean | null;
  metadata?: Record<string, string> | null;
  nickname?: string | null;
  object?: string;
  parent_account_id?: string | null;
  purpose_code?: XflowAccountPurposeCode[] | null;
  status?: string | null;
  supporting_documentation?: {
    additional_verification?: string | null;
    id_document?: string | null;
    ownership_structure_document?: string | null;
  } | null;
  system_message?:
    | Array<{
        code?: string;
        message?: string;
      }>
    | null;
  tos_acceptance?: {
    ip?: string | null;
    time?: number | null;
    user_agent?: string | null;
  } | null;
  type?: string | null;
};

export type XflowAddress = {
  bank_account?: {
    bank_name?: string | null;
    domestic_credit?: string | null;
    domestic_debit?: string | null;
    domestic_fast_credit?: string | null;
    domestic_wire?: string | null;
    entity_type?: string | null;
    global_wire?: string | null;
    iban?: string | null;
    last4?: string | null;
    number?: string | null;
    type?: string | null;
  } | null;
  billing_details?: {
    city?: string | null;
    country?: string | null;
    line1?: string | null;
    line2?: string | null;
    postal_code?: string | null;
    state?: string | null;
  } | null;
  category?: string | null;
  created?: number;
  currency?: string | null;
  id: string;
  is_reusable?: boolean | null;
  linked_id?: string | null;
  linked_object?: string | null;
  livemode?: boolean | null;
  metadata?: Record<string, string> | null;
  name?: string | null;
  object?: string;
  status?: string | null;
  supporting_documentation?: {
    id_document?: string | null;
  } | null;
  type?: string | null;
};

export type XflowPerson = {
  created?: number;
  full_name?: string | null;
  id: string;
  livemode?: boolean | null;
  metadata?: Record<string, string> | null;
  object?: string;
  physical_address?: {
    city?: string | null;
    country?: string | null;
    line1?: string | null;
    line2?: string | null;
    postal_code?: string | null;
    state?: string | null;
  } | null;
  relationship?: {
    director?: boolean | null;
    owner?: boolean | null;
    representative?: boolean | null;
  } | null;
  status?: string | null;
  supporting_documentation?: {
    id_document?: string | null;
    physical_address_document?: string | null;
  } | null;
  supporting_ids?: {
    tax?: string | null;
  } | null;
};

export type XflowReceivable = {
  account_id?: string | null;
  amount?: string | null;
  amount_locked?: string | null;
  amount_maximum_reconcilable?: string | null;
  amount_reconciled?: string | null;
  amount_reconciled_not_settled?: string | null;
  amount_settled_payouts?: string | null;
  created?: number;
  currency?: string | null;
  description?: string | null;
  id: string;
  invoice?: {
    amount?: string | null;
    creation_date?: string | null;
    currency?: string | null;
    due_date?: string | null;
    reference_number?: string | null;
  } | null;
  metadata?: Record<string, string> | null;
  object?: string;
  partner_id?: string | null;
  payment_instructions?: Record<string, unknown> | null;
  purpose_code?: string | null;
  reference_id?: string | null;
  status?: string | null;
  system_message?: Array<{
    code?: string;
    message?: string;
  }> | null;
  transaction_type?: string | null;
};

export type XflowPayout = {
  amount?: string | null;
  arrival_date?: number | null;
  created?: number;
  currency?: string | null;
  id: string;
  metadata?: Record<string, string> | null;
  object?: string;
  payment_method?: string | null;
  payout_confirmation?: string | null;
  statement_descriptor?: string | null;
  status?: string | null;
  to?: {
    account_id?: string | null;
    address_id?: string | null;
  } | null;
  tracking_info?: string | null;
  unique_transaction_reference?: string | null;
};
