import { z } from "zod";

const decimalAmount = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount with up to 2 decimals.");

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD date format.");

const metadataString = z.string().trim().max(500);
const isoCurrencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Use a valid ISO 4217 currency code.");

export const receivableInputSchema = z.object({
  accountId: z.string().trim().optional(),
  amount: decimalAmount,
  currency: z.literal("USD").default("USD"),
  description: z.string().trim().max(255).optional(),
  purposeCode: z.string().trim().min(1, "Purpose code is required."),
  transactionType: z.enum(["goods", "services", "software"]),
  invoiceReferenceNumber: z
    .string()
    .trim()
    .min(1, "Invoice reference is required.")
    .max(120),
  invoiceCreationDate: isoDate,
  invoiceDueDate: isoDate,
  metadata: z.record(z.string(), metadataString).optional(),
  autoConfirm: z.boolean().default(true),
});

export const paymentLinkInputSchema = z.object({
  accountId: z.string().trim().min(1, "Account ID is required."),
  receivableId: z.string().trim().min(1, "Receivable ID is required."),
  metadata: z.record(z.string(), metadataString).optional(),
});

export const depositInputSchema = z.object({
  accountId: z.string().trim().min(1, "Account ID is required."),
  addressId: z.string().trim().min(1, "Virtual account address is required."),
  amount: decimalAmount,
  currency: z.literal("USD").default("USD"),
  fromAccountId: z.string().trim().optional(),
  paymentMethod: z.enum([
    "domestic_credit",
    "domestic_fast_credit",
    "domestic_wire",
    "global_wire",
  ]),
  receivableId: z.string().trim().optional(),
  statementDescriptor: z.string().trim().max(255).optional(),
  metadata: z.record(z.string(), metadataString).optional(),
});

export const createPartnerAccountSchema = z.object({
  exporterAccountId: z.string().trim().min(1),
  business_details: z.object({
    email: z.string().email().max(50, "Email must be 50 characters or fewer."),
    legal_name: z.string().trim().min(1),
    physical_address: z.object({
      city: z.string().trim().min(1),
      country: z.string().trim().min(1),
      line1: z.string().trim().min(1),
      postal_code: z.string().trim().min(1),
      state: z.string().trim().min(1),
    }),
    type: z.enum(["company", "individual"]),
  }),
  nickname: z.string().trim().min(1),
  type: z.literal("partner"),
});

export const connectedUserTopupSchema = z.object({
  amount: decimalAmount.refine((value) => Number(value) > 0, "Enter an amount greater than zero."),
  currency: isoCurrencyCode.default("USD"),
  description: z.string().trim().max(255).optional(),
  metadata: z.record(z.string(), metadataString).optional(),
});
