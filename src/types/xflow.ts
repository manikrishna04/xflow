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

export type XflowMoneyAmount = {
  amount?: string | null;
  currency?: string | null;
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
  amount_reconcilable?: string | null;
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
    document?: string | null;
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
  automatic?: boolean | null;
  created?: number;
  currency?: string | null;
  id: string;
  livemode?: boolean | null;
  metadata?: Record<string, string> | null;
  object?: string;
  payment_method?: string | null;
  payment_method_details?: {
    payout_confirmation?: string | null;
    statement_descriptor?: string | null;
  } | null;
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

export type XflowList<T> = {
  data: T[];
  has_next?: boolean | null;
  object?: "list" | string;
};

export type XflowFile = {
  created?: number | null;
  id: string;
  livemode?: boolean | null;
  object?: string | null;
  purpose?: string | null;
  size?: number | null;
  type?: string | null;
} & Record<string, unknown>;

export type XflowReceivableReconciliationPreview = {
  amount?: string | null;
  currency?: string | null;
  estimated_settlement_date?: number | null;
  expected_settlement_date?: number | null;
  live_fx?: string | null;
  object?: string | null;
  reconciliation_time?: number | null;
  settlement_date?: number | null;
  timeline?: Array<Record<string, unknown>> | null;
} & Record<string, unknown>;

export type XflowReceivableReconciliation = {
  amount?: string | null;
  created?: number | null;
  currency?: string | null;
  id?: string | null;
  live_fx?: string | null;
  object?: string | null;
  quote_lock_id?: string | null;
  status?: string | null;
  to?: {
    address_id?: string | null;
  } | null;
  } & Record<string, unknown>;

export type XflowQuote = {
  buy?: {
    amount?: string | null;
    currency?: string | null;
  } | null;
  currency_pair?: string | null;
  dealt_currency?: string | null;
  fee_plan_id?: string | null;
  livemode?: boolean | null;
  object?: string | null;
  rate?: {
    inter_bank?: string | null;
    mid_market?: string | null;
    user?: string | null;
    valid_from?: number | null;
    valid_to?: number | null;
  } | null;
  sell?: {
    amount?: string | null;
    currency?: string | null;
  } | null;
  type?: string | null;
} & Record<string, unknown>;

export type XflowQuoteLock = {
  account_id?: string | null;
  buy?: {
    amount?: string | null;
    currency?: string | null;
  } | null;
  confirm_before?: number | string | null;
  created?: number | string | null;
  id: string;
  livemode?: boolean | null;
  lock_amount?: {
    amount?: string | null;
    currency?: string | null;
  } | null;
  lock_duration?: string | null;
  lock_type?: string | null;
  object?: string | null;
  rate?: {
    inter_bank?: string | null;
    mid_market?: string | null;
    user?: string | null;
  } | null;
  sell?: {
    amount?: string | null;
    currency?: string | null;
  } | null;
  status?: string | null;
  type?: string | null;
  valid_from?: number | string | null;
  valid_to?: number | string | null;
} & Record<string, unknown>;

export type XflowBalance = {
  account_id?: string | null;
  available?: XflowMoneyAmount[] | null;
  fee_advance?: XflowMoneyAmount[] | null;
  livemode?: boolean | null;
  object?: string;
  payout_processing?: XflowMoneyAmount[] | null;
  pending?: XflowMoneyAmount[] | null;
  processing?: XflowMoneyAmount[] | null;
};

export type XflowTransfer = {
  created?: number | null;
  description?: string | null;
  from?: {
    account_id?: string | null;
    amount?: string | null;
    currency?: string | null;
  } | null;
  id: string;
  linked_id?: string | null;
  linked_object?: string | null;
  livemode?: boolean | null;
  metadata?: Record<string, string> | null;
  object?: string;
  status?: string | null;
  to?: {
    account_id?: string | null;
    amount?: string | null;
    currency?: string | null;
  } | null;
  type?: string | null;
};
