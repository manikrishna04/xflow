"use client";

import { FilePlus2, Landmark, Paperclip, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import toast from "react-hot-toast";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useConnectedUserQuery,
  useCreateInvoiceMutation,
  usePurposeCodesQuery,
} from "@/lib/hooks/use-tradedge-actions";
import { COMMON_PURPOSE_CODES_BY_PRODUCT_CATEGORY } from "@/lib/tradedge/purpose-codes";
import { invoiceFormSchema } from "@/lib/tradedge/schemas";
import { formatConnectedUserStatus, isConnectedUserActive } from "@/lib/tradedge/onboarding";
import { useTradEdgeStore } from "@/lib/store/tradedge-store";
import type { XflowFile } from "@/types/xflow";

const PARTNER_COUNTRY_OPTIONS = [
  { code: "US", label: "United States" },
  { code: "IN", label: "India" },
  { code: "GB", label: "United Kingdom" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "CA", label: "Canada" },
  { code: "SG", label: "Singapore" },
  { code: "AU", label: "Australia" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "NL", label: "Netherlands" },
] as const;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function metadataEntriesToObject(entries: Array<{ key: string; value: string }>) {
  const normalized = entries
    .map((entry) => ({
      key: entry.key.trim(),
      value: entry.value.trim(),
    }))
    .filter((entry) => entry.key.length > 0);

  return normalized.length > 0 ? Object.fromEntries(normalized.map((entry) => [entry.key, entry.value])) : undefined;
}

async function uploadInvoiceFile(file: File, exporterAccountId: string) {
  const formData = new FormData();
  formData.append("exporterAccountId", exporterAccountId);
  formData.append("purpose", "finance_document");
  formData.append("file", file);

  const response = await fetch("/api/xflow/upload-file", {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as
    | { file?: XflowFile; message?: string }
    | null;

  if (!response.ok || !payload?.file?.id) {
    throw new Error(payload?.message || "Could not upload invoice file.");
  }

  return payload.file.id;
}

type InvoiceCreateScreenProps = {
  basePath?: string;
  variant?: "invoice" | "receivable";
};

export function InvoiceCreateScreen({
  basePath = "/receivables",
}: InvoiceCreateScreenProps) {
  const router = useRouter();
  const exporter = useTradEdgeStore((state) => state.exporter);
  const connectedUserQuery = useConnectedUserQuery(exporter?.accountId);
  const purposeCodesQuery = usePurposeCodesQuery();
  const createInvoice = useCreateInvoiceMutation();
  const [isRouting, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    amountUsd: "1250",
    description: "Quarterly services receivable for exported advisory work",
    dueDate: addDaysIso(7),
    invoiceDate: todayIso(),
    invoiceFile: null as File | null,
    invoiceNumber: `REC-${todayIso().replace(/-/g, "")}`,
    partnerAddressCity: "New York",
    partnerAddressLine1: "123 Trade Street",
    partnerAddressLine2: "",
    partnerAddressPostalCode: "10001",
    partnerAddressState: "NY",
    partnerCountry: "US",
    partnerEmail: "finance@northstarretail.com",
    partnerLegalName: "Northstar Retail LLC",
    partnerMetadata: [{ key: "crm_id", value: "partner-001" }],
    partnerNickname: "Northstar",
    partnerType: "company" as "company" | "individual",
    purposeCode: "P1006",
    transactionType: "services" as "goods" | "services" | "software",
  });

  const categoryPurposeCodes = useMemo(() => {
    const codes =
      COMMON_PURPOSE_CODES_BY_PRODUCT_CATEGORY[form.transactionType] || [];

    return purposeCodesQuery.data?.filter((option) => (codes as readonly string[]).includes(option.code)) ?? [];
  }, [form.transactionType, purposeCodesQuery.data]);

  if (!exporter) {
    return (
      <EmptyState
        title="Complete connected-user onboarding first"
        description="Receivables belong to the connected user. Finish onboarding and wait for the account to become active before creating receivables."
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
        description={`The connected user is currently ${formatConnectedUserStatus(accountStatus)}. Xflow parity requires the account to be Active before a partner or receivable can be created.`}
        actionHref="/onboarding"
        actionLabel="Open Onboarding"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="New Receivable"
        title="Create receivable"
        description="Add partner information, optionally upload the invoice document, and create the receivable in one flow."
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FilePlus2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold">Partner and receivable form</h2>
              <p className="mt-1 text-sm text-foreground/65">
                This form creates the partner first, then creates the receivable with the uploaded invoice document and selected purpose code.
              </p>
            </div>
          </div>

          <form
            className="mt-8 space-y-8"
            onSubmit={async (event) => {
              event.preventDefault();
              setError("");

              const partnerMetadata = metadataEntriesToObject(form.partnerMetadata);
              let invoiceDocumentId: string | undefined;

              if (form.invoiceFile) {
                if (form.invoiceFile.size > 10 * 1024 * 1024) {
                  setError("Invoice file must be 10MB or smaller.");
                  return;
                }

                try {
                  setUploading(true);
                  invoiceDocumentId = await uploadInvoiceFile(form.invoiceFile, exporter.accountId);
                } catch (uploadError) {
                  setError(
                    uploadError instanceof Error
                      ? uploadError.message
                      : "Could not upload the invoice document.",
                  );
                  setUploading(false);
                  return;
                }
                setUploading(false);
              }

              const parsed = invoiceFormSchema.safeParse({
                amountUsd: Number(form.amountUsd),
                description: form.description || undefined,
                dueDate: form.dueDate,
                invoiceDate: form.invoiceDate,
                invoiceDocumentId,
                invoiceNumber: form.invoiceNumber,
                metadata: partnerMetadata,
                partnerDetails: {
                  address: {
                    city: form.partnerAddressCity,
                    country: form.partnerCountry,
                    line1: form.partnerAddressLine1,
                    line2: form.partnerAddressLine2 || undefined,
                    postalCode: form.partnerAddressPostalCode,
                    state: form.partnerAddressState,
                  },
                  country: form.partnerCountry,
                  email: form.partnerEmail,
                  legalName: form.partnerLegalName,
                  metadata: partnerMetadata,
                  nickname: form.partnerNickname,
                  partnerType: form.partnerType,
                },
                purposeCode: form.purposeCode,
                transactionType: form.transactionType,
              });

              if (!parsed.success) {
                setError(parsed.error.issues[0]?.message || "Enter valid receivable details.");
                return;
              }

              try {
                const receivable = await createInvoice.mutateAsync(parsed.data);
                toast.success("Partner and receivable created.");
                startTransition(() => {
                  router.push(`${basePath}/${receivable.id}`);
                });
              } catch (mutationError) {
                setError(
                  mutationError instanceof Error
                    ? mutationError.message
                    : "Could not create the receivable.",
                );
              }
            }}
          >
            <div className="space-y-5">
              <div>
                <p className="data-kicker">Add Partner</p>
                <h3 className="mt-2 text-xl font-semibold">Basic Information</h3>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <Label htmlFor="partnerLegalName">Legal Name</Label>
                  <Input
                    id="partnerLegalName"
                    placeholder="Enter Partner's Legal Name"
                    value={form.partnerLegalName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, partnerLegalName: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="partnerNickname">Nickname</Label>
                  <Input
                    id="partnerNickname"
                    placeholder="Enter Partner's Nickname"
                    value={form.partnerNickname}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, partnerNickname: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                <div>
                  <Label htmlFor="partnerCountry">Country</Label>
                  <Select
                    id="partnerCountry"
                    value={form.partnerCountry}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, partnerCountry: event.target.value }))
                    }
                  >
                    {PARTNER_COUNTRY_OPTIONS.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label htmlFor="partnerEmail">Email</Label>
                  <Input
                    id="partnerEmail"
                    type="email"
                    placeholder="Add Partner's Email ID"
                    value={form.partnerEmail}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, partnerEmail: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="partnerType">Partner Type</Label>
                  <Select
                    id="partnerType"
                    value={form.partnerType}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        partnerType: event.target.value as "company" | "individual",
                      }))
                    }
                  >
                    <option value="company">Company</option>
                    <option value="individual">Individual</option>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <p className="data-kicker">Address</p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <Label htmlFor="partnerAddressLine1">Line 1</Label>
                  <Input
                    id="partnerAddressLine1"
                    placeholder="Enter Address line 1"
                    value={form.partnerAddressLine1}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        partnerAddressLine1: event.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="partnerAddressLine2">Line 2</Label>
                  <Input
                    id="partnerAddressLine2"
                    placeholder="Enter Address line 2"
                    value={form.partnerAddressLine2}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        partnerAddressLine2: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                <div>
                  <Label htmlFor="partnerAddressCity">City</Label>
                  <Input
                    id="partnerAddressCity"
                    placeholder="Enter City"
                    value={form.partnerAddressCity}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, partnerAddressCity: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="partnerAddressState">State/Province/Region</Label>
                  <Input
                    id="partnerAddressState"
                    placeholder="Enter State/Province/Region"
                    value={form.partnerAddressState}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, partnerAddressState: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="partnerAddressPostalCode">Zipcode</Label>
                  <Input
                    id="partnerAddressPostalCode"
                    placeholder="Enter Zipcode"
                    value={form.partnerAddressPostalCode}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        partnerAddressPostalCode: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <p className="data-kicker">Receivable Details</p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <Label htmlFor="transactionType">Transaction Type</Label>
                  <Select
                    id="transactionType"
                    value={form.transactionType}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        purposeCode: "",
                        transactionType: event.target.value as "goods" | "services" | "software",
                      }))
                    }
                  >
                    <option value="goods">Goods</option>
                    <option value="services">Services</option>
                    <option value="software">Software</option>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="purposeCode">Purpose Code</Label>
                  <Select
                    id="purposeCode"
                    value={form.purposeCode}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, purposeCode: event.target.value }))
                    }
                  >
                    <option value="">Select purpose code</option>
                    {(categoryPurposeCodes.length > 0 ? categoryPurposeCodes : purposeCodesQuery.data ?? []).map(
                      (option) => (
                        <option key={option.code} value={option.code}>
                          {option.code} - {option.description}
                        </option>
                      ),
                    )}
                  </Select>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <Label htmlFor="invoiceNumber">Invoice / Reference Number</Label>
                  <Input
                    id="invoiceNumber"
                    placeholder="Enter Invoice Number"
                    value={form.invoiceNumber}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, invoiceNumber: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="amountUsd">Receivable Amount (USD)</Label>
                  <Input
                    id="amountUsd"
                    inputMode="decimal"
                    placeholder="Enter Receivable Amount"
                    value={form.amountUsd}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, amountUsd: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Add receivable description"
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <Label htmlFor="invoiceDate">Invoice Date</Label>
                  <Input
                    id="invoiceDate"
                    type="date"
                    value={form.invoiceDate}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, invoiceDate: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={form.dueDate}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, dueDate: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="invoiceFile">Upload Invoice</Label>
                <Input
                  id="invoiceFile"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      invoiceFile: event.target.files?.[0] || null,
                    }))
                  }
                />
                <p className="mt-2 text-xs text-foreground/55">
                  Optional. PDF, JPG, or PNG up to 10MB. The file is uploaded first and then attached to the receivable.
                </p>
                {form.invoiceFile ? (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-black/[0.04] px-3 py-1 text-xs text-foreground/70">
                    <Paperclip className="h-3.5 w-3.5" />
                    {form.invoiceFile.name}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <p className="data-kicker">Metadata</p>
                <p className="mt-2 text-sm text-foreground/65">Optional</p>
              </div>

              <div className="space-y-3">
                {form.partnerMetadata.map((entry, index) => (
                  <div key={`${index}-${entry.key}`} className="grid gap-3 md:grid-cols-[0.8fr_1fr_auto]">
                    <Input
                      placeholder="Key"
                      value={entry.key}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          partnerMetadata: current.partnerMetadata.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, key: event.target.value } : item,
                          ),
                        }))
                      }
                    />
                    <Input
                      placeholder="Value"
                      value={entry.value}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          partnerMetadata: current.partnerMetadata.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, value: event.target.value } : item,
                          ),
                        }))
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          partnerMetadata: current.partnerMetadata.filter((_, itemIndex) => itemIndex !== index),
                        }))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    partnerMetadata: [...current.partnerMetadata, { key: "", value: "" }],
                  }))
                }
              >
                Add Metadata
              </Button>
            </div>

            {error ? (
              <p className="rounded-2xl bg-[rgba(218,70,70,0.08)] px-4 py-3 text-sm text-[rgb(190,51,51)]">
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={createInvoice.isPending || isRouting || uploading}
            >
              {createInvoice.isPending || isRouting || uploading
                ? uploading
                  ? "Uploading invoice..."
                  : "Creating partner and receivable..."
                : "Create receivable"}
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard>
            <p className="data-kicker">Exporter Context</p>
            <h2 className="mt-3 text-3xl font-semibold">{exporter.legalName}</h2>
            <div className="mt-4 space-y-3 text-sm text-foreground/68">
              <div>
                <span className="font-semibold text-foreground">Account:</span>{" "}
                {exporter.accountId}
              </div>
              <div>
                <span className="font-semibold text-foreground">Country:</span>{" "}
                {exporter.countryCode}
              </div>
              <div>
                <span className="font-semibold text-foreground">Email:</span> {exporter.email}
              </div>
            </div>
          </SectionCard>

          <SectionCard>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(255,167,38,0.14)] text-[rgb(170,97,23)]">
                <Landmark className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold">What happens next</h2>
                <p className="mt-1 text-sm text-foreground/65">
                  The screen creates partner and receivable objects in sequence.
                </p>
              </div>
            </div>
            <div className="mt-6 space-y-3 text-sm leading-7 text-foreground/68">
              <div>1. Create the partner using the legal, contact, type, and address details above.</div>
              <div>2. Upload the invoice document if you selected a file.</div>
              <div>3. Create and auto-confirm the receivable with purpose code and invoice metadata.</div>
              <div>4. Open the receivable detail page for instructions, payment simulation, and reconciliation.</div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
