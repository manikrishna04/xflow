import { z } from "zod";

const countryCodeSchema = z
  .string()
  .trim()
  .min(2, "Use a 2-letter country code.")
  .max(2, "Use a 2-letter country code.")
  .transform((value) => value.toUpperCase());

export const connectedUserBusinessTypeSchema = z.enum(
  ["individual", "partnership", "pvt_ltd", "llp", "sole_proprietorship"],
  {
    message: "Select a valid business type.",
  },
);

export const merchantSizeSchema = z.enum(["small", "medium", "large", "enterprise"], {
  message: "Select merchant size.",
});

export const accountIdLoginSchema = z.object({
  accountId: z
    .string()
    .trim()
    .regex(
      /^account_[A-Za-z0-9_]+$/,
      "Enter a valid Xflow account id.",
    ),
});

export const exporterAccountSchema = z.object({
  countryCode: countryCodeSchema,
  dba: z.string().trim().max(120).optional(),
  email: z.email("Enter a valid business email."),
  legalName: z.string().trim().min(2, "Enter the exporter's legal name."),
  businessType: connectedUserBusinessTypeSchema.optional(),
  nickname: z.string().trim().min(2, "Enter a nickname.").max(40).optional(),
});

export const onboardingAddressSchema = z.object({
  city: z.string().trim().min(2, "Enter the city."),
  country: countryCodeSchema,
  line1: z.string().trim().min(4, "Enter the registered address."),
  postalCode: z.string().trim().min(4, "Enter the postal code."),
  state: z.string().trim().min(2, "Enter the state."),
});

export const onboardingBusinessSchema = z.object({
  countryCode: countryCodeSchema,
  dateOfIncorporation: z.string().trim().min(1, "Enter the incorporation date."),
  dba: z.string().trim().min(3, "Enter the display name (at least 3 characters)."),
  email: z.email("Enter a valid business email."),
  estimatedMonthlyVolume: z.string().trim().optional().or(z.literal("")),
  legalName: z.string().trim().min(2, "Enter the legal name."),
  businessType: connectedUserBusinessTypeSchema.optional(),
  merchantCategoryCode: z.string().trim().optional().or(z.literal("")),
  merchantSize: merchantSizeSchema.optional(),
  productCategory: z.enum(["goods", "services", "software"]),
  productDescription: z.string().trim().min(10, "Add a short product description."),
  website: z.url("Enter a valid website URL."),
});

export const onboardingTaxSchema = z.object({
  businessId: z.string().trim().min(3, "Enter the business registration id."),
  gst: z.string().trim().min(5, "Enter the GST number."),
  pan: z.string().trim().min(5, "Enter the PAN."),
});

export const onboardingTosSchema = z.object({
  accepted: z.literal(true, {
    error: "You must capture Terms acceptance before activation.",
  }),
});

export const payoutBankSchema = z.object({
  accountHolderName: z.string().trim().min(2, "Enter the account holder name."),
  accountNumber: z.string().trim().min(6, "Enter the account number."),
  city: z.string().trim().min(2, "Enter the bank city."),
  ifsc: z.string().trim().min(5, "Enter the IFSC / domestic credit code."),
  line1: z.string().trim().min(4, "Enter the bank address line."),
  postalCode: z.string().trim().min(4, "Enter the postal code."),
  state: z.string().trim().min(2, "Enter the state."),
});

const metadataSchema = z.record(z.string().trim().min(1), z.string().trim().max(500));
const isoDateSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/, "Date must use YYYY-MM-DD.");

export const partnerAddressSchema = z.object({
  city: z.string().trim().min(2, "Enter city."),
  country: countryCodeSchema,
  line1: z.string().trim().min(4, "Enter address line 1."),
  line2: z.string().trim().max(120).optional().or(z.literal("")),
  postalCode: z.string().trim().min(3, "Enter zipcode."),
  state: z.string().trim().min(2, "Enter state / province / region."),
});

export const invoiceFormSchema = z.object({
  amountUsd: z
    .number({ error: "Enter a valid USD amount." })
    .positive("Amount must be greater than zero.")
    .max(1_000_000, "Amount is too large for the demo flow."),
  description: z.string().trim().max(255).optional(),
  dueDate: z
    .string()
    .trim()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/, "Due date must use YYYY-MM-DD."),
  invoiceDate: z
    .string()
    .trim()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/, "Invoice date must use YYYY-MM-DD."),
  invoiceDocumentId: z.string().trim().min(1).optional(),
  invoiceNumber: z.string().trim().min(1, "Enter invoice number."),
  metadata: metadataSchema.optional(),
  partnerDetails: z.object({
    address: partnerAddressSchema,
    country: countryCodeSchema,
    email: z.email("Add partner email."),
    legalName: z.string().trim().min(2, "Enter partner legal name."),
    metadata: metadataSchema.optional(),
    nickname: z.string().trim().min(2, "Enter partner nickname."),
    partnerType: z.enum(["company", "individual"], {
      message: "Select partner type.",
    }),
  }),
  purposeCode: z.string().trim().min(1, "Select purpose code."),
  transactionType: z.enum(["goods", "services", "software"], {
    message: "Select partner transaction type.",
  }),
});

export const createPartnerSchema = z.object({
  buyerCountry: countryCodeSchema,
  buyerName: z.string().trim().min(2),
  exporterAccountId: z.string().trim().min(1),
  referenceId: z.string().trim().min(1),
});

export const createPartnerAccountSchema = z.object({
  address: partnerAddressSchema,
  country: countryCodeSchema,
  email: z.email("Add partner email."),
  exporterAccountId: z.string().trim().min(1),
  legalName: z.string().trim().min(2),
  metadata: metadataSchema.optional(),
  nickname: z.string().trim().min(2),
  partnerType: z.enum(["company", "individual"]),
});

export const createReceivableSchema = z.object({
  amountUsd: z.number().positive(),
  description: z.string().trim().max(255).optional(),
  dueDate: isoDateSchema.optional(),
  exporterAccountId: z.string().trim().min(1),
  invoiceId: z.string().trim().min(1),
  invoiceDocumentId: z.string().trim().min(1).optional(),
  invoiceNumber: z.string().trim().min(1),
  invoiceDate: isoDateSchema,
  metadata: metadataSchema.optional(),
  partnerId: z.string().trim().min(1),
  referenceId: z.string().trim().min(1),
  transactionType: z.enum(["goods", "services", "software"]),
  purposeCode: z.string().trim().min(1),
});

export const receivableFormSchema = z.object({
  amountUsd: z
    .number({ error: "Enter a valid USD amount." })
    .positive("Amount must be greater than zero.")
    .max(1_000_000, "Amount is too large for the demo flow."),
  description: z.string().trim().max(255).optional(),
  dueDate: isoDateSchema.optional(),
  invoiceDate: isoDateSchema,
  invoiceDocumentId: z.string().trim().min(1).optional(),
  invoiceNumber: z.string().trim().min(1, "Enter invoice number."),
  metadata: metadataSchema.optional(),
  partnerId: z.string().trim().min(1, "Select a partner."),
  purposeCode: z.string().trim().min(1, "Select purpose code."),
  transactionType: z.enum(["goods", "services", "software"], {
    message: "Select transaction type.",
  }),
});

export const simulatePaymentSchema = z.object({
  exporterAccountId: z.string().trim().min(1),
  receivableId: z.string().trim().min(1),
});

export const createPayoutSchema = z.object({
  amountInr: z.number().positive(),
  exporterAccountId: z.string().trim().min(1),
  referenceId: z.string().trim().min(1),
});

export const listPayoutsSchema = z.object({
  accountId: z.string().trim().min(1),
  createdEq: z.coerce.number().int().positive().optional(),
  createdGt: z.coerce.number().int().positive().optional(),
  createdGte: z.coerce.number().int().positive().optional(),
  createdLt: z.coerce.number().int().positive().optional(),
  createdLte: z.coerce.number().int().positive().optional(),
  endingBefore: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(10).optional(),
  startingAfter: z.string().trim().min(1).optional(),
  status: z
    .union([
      z.string().trim().min(1),
      z.array(z.string().trim().min(1)),
    ])
    .optional(),
  toAccountId: z.string().trim().min(1).optional(),
  toAddressId: z.string().trim().min(1).optional(),
});

export const retrievePayoutSchema = z.object({
  accountId: z.string().trim().min(1),
});

export const updatePayoutMetadataSchema = z.object({
  accountId: z.string().trim().min(1),
  metadata: metadataSchema,
});

export const previewReceivableReconciliationSchema = z.object({
  addressId: z.string().trim().min(1).optional(),
  amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount."),
  exporterAccountId: z.string().trim().min(1),
  liveFx: z.enum(["enabled", "disabled"]).optional(),
  receivableId: z.string().trim().min(1),
  reconciliationTime: z.number().int().positive().optional(),
});

export const reconcileReceivableSchema = z.object({
  addressId: z.string().trim().min(1).optional(),
  amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount."),
  debitAccountId: z.string().trim().min(1).optional(),
  exporterAccountId: z.string().trim().min(1),
  liveFx: z.enum(["enabled", "disabled"]).optional(),
  quoteLockId: z.string().trim().min(1).optional(),
  receivableId: z.string().trim().min(1),
});

export const statusRequestSchema = z.object({
  exporterAccountId: z.string().trim().min(1),
  payoutId: z.string().trim().optional(),
  receivableId: z.string().trim().optional(),
});

export const onboardingBasicInfoSchema = z.object({
  email: z.email("Enter a valid business email."),
  legalName: z.string().trim().min(2, "Enter the legal name."),
  dba: z.string().trim().min(3, "Enter the display name (at least 3 characters)."),
  businessType: connectedUserBusinessTypeSchema,
});

export const onboardingAboutBusinessSchema = z.object({
  dateOfIncorporation: z.string().trim().min(1, "Enter the incorporation date."),
  productCategory: z.enum(["goods", "services", "software"], {
    message: "Select a product category.",
  }),
  productDescription: z
    .string()
    .trim()
    .min(10, "Add a short product description (at least 10 characters)."),
  registeredAddress: onboardingAddressSchema,
  website: z.url("Enter a valid website URL."),
});

export const onboardingBusinessIdentifiersSchema = z.object({
  businessId: z.string().trim().min(3, "Enter the business registration id."),
  pan: z.string().trim().min(5, "Enter the PAN."),
  gst: z.string().trim().min(5, "Enter the GST number."),
});

export const onboardingPersonSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the full name."),
  pan: z.string().trim().min(5, "Enter the PAN."),
});

export const onboardingPersonalInfoSchema = z.object({
  primaryDirector: onboardingPersonSchema,
  secondaryDirector: onboardingPersonSchema,
});

export const onboardingBankDetailsSchema = z.object({
  accountHolderName: z.string().trim().min(2, "Enter the account holder name."),
  accountNumber: z.string().trim().min(6, "Enter the account number."),
  ifsc: z.string().trim().min(5, "Enter the IFSC code."),
  line1: z.string().trim().min(4, "Enter the bank address line."),
  city: z.string().trim().min(2, "Enter the bank city."),
  state: z.string().trim().min(2, "Enter the state."),
  postalCode: z.string().trim().min(4, "Enter the postal code."),
});

export const onboardingFeesSchema = z.object({
  estimatedMonthlyVolume: z
    .string()
    .trim()
    .min(1, "Enter the estimated monthly volume."),
  merchantCategoryCode: z
    .string()
    .trim()
    .min(3, "Enter the merchant category code."),
  merchantSize: merchantSizeSchema,
  purposeCodes: z
    .array(z.string().trim().min(1, "Select a valid purpose code."))
    .min(1, "Select at least one purpose code for activation."),
});

export const onboardingSummarySchema = z.object({
  termsAccepted: z.literal(true, {
    error: "You must accept the terms and conditions.",
  }),
  dataAccuracy: z.literal(true, {
    error: "You must confirm the accuracy of the provided information.",
  }),
});

export const multiStepOnboardingSchema = z.object({
  existingAccountId: z.string().trim().min(1).optional(),
  basicInfo: onboardingBasicInfoSchema,
  aboutBusiness: onboardingAboutBusinessSchema,
  businessIdentifiers: onboardingBusinessIdentifiersSchema,
  personalInfo: onboardingPersonalInfoSchema,
  bankDetails: onboardingBankDetailsSchema,
  fees: onboardingFeesSchema,
  summary: onboardingSummarySchema,
});

export const updateConnectedUserSchema = z.object({
  address: onboardingAddressSchema.optional(),
  businessDetails: onboardingBusinessSchema.optional(),
  nickname: z.string().trim().min(2, "Enter a nickname.").max(40).optional(),
  purposeCodes: z.array(z.string().trim().min(1)).min(1).optional(),
  tax: onboardingTaxSchema.optional(),
  tosAccepted: z.boolean().optional(),
});

export const createPayoutAddressSchema = z.object({
  bank: payoutBankSchema,
});

export const upsertConnectedUserPeopleSchema = z.object({
  people: z.array(onboardingPersonSchema).min(2, "Provide at least two directors."),
});
