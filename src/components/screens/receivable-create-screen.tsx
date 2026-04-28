"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  FileUp,
  Paperclip,
  Plus,
  Send,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useConnectedUserQuery,
  useCreateReceivableMutation,
  usePurposeCodesQuery,
} from "@/lib/hooks/use-tradedge-actions";
import { COMMON_PURPOSE_CODES_BY_PRODUCT_CATEGORY } from "@/lib/tradedge/purpose-codes";
import {
  buildPartnerDirectory,
  getPartnerCountry,
  getPartnerEmail,
  getPartnerLegalName,
  isPartnerActive,
} from "@/lib/tradedge/partners";
import { receivableFormSchema } from "@/lib/tradedge/schemas";
import { formatConnectedUserStatus, isConnectedUserActive } from "@/lib/tradedge/onboarding";
import { formatStatusLabel } from "@/lib/tradedge/format";
import { useTradEdgeStore } from "@/lib/store/tradedge-store";
import type { XflowFile } from "@/types/xflow";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function metadataEntriesToObject(entries: Array<{ key: string; value: string }>) {
  const normalized = entries
    .map((entry) => ({
      key: entry.key.trim(),
      value: entry.value.trim(),
    }))
    .filter((entry) => entry.key.length > 0);

  return normalized.length > 0
    ? Object.fromEntries(normalized.map((entry) => [entry.key, entry.value]))
    : undefined;
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

export function ReceivableCreateScreen() {
  const router = useRouter();
  const exporter = useTradEdgeStore((state) => state.exporter);
  const partners = useTradEdgeStore((state) => state.partners);
  const invoices = useTradEdgeStore((state) => state.invoices);
  const connectedUserQuery = useConnectedUserQuery(exporter?.accountId);
  const purposeCodesQuery = usePurposeCodesQuery();
  const createReceivable = useCreateReceivableMutation();
  const [isRouting, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    amountUsd: "1250",
    description: "TradeEdge invoice for exported advisory services",
    dueDate: "",
    invoiceDate: todayIso(),
    invoiceFile: null as File | null,
    invoiceNumber: `REC-${todayIso().replace(/-/g, "")}`,
    metadata: [{ key: "invoice_source", value: "dashboard" }],
    partnerId: "",
    purposeCode: "P1006",
    transactionType: "services" as "goods" | "services" | "software",
  });

  if (!exporter) {
    return (
      <EmptyState
        title="Complete connected-user onboarding first"
        description="Receivables belong to the connected user. Finish onboarding before creating receivables."
        actionHref="/onboarding"
        actionLabel="Open Onboarding"
      />
    );
  }

  const directory = buildPartnerDirectory(partners, invoices);
  const selectedPartner =
    directory.find((entry) => entry.id === form.partnerId) ?? null;
  const recommendedPurposeCodes: readonly string[] = [
    ...COMMON_PURPOSE_CODES_BY_PRODUCT_CATEGORY[form.transactionType],
  ];
  const categoryPurposeCodes =
    purposeCodesQuery.data?.filter((option) =>
      recommendedPurposeCodes.includes(option.code),
    ) ?? [];
  const accountStatus = connectedUserQuery.data?.account.status ?? exporter.status;
  const transactionsEnabled = isConnectedUserActive(accountStatus);
  const partnerIsReady = selectedPartner ? isPartnerActive(selectedPartner.partner.status) : false;

  if (!transactionsEnabled) {
    return (
      <EmptyState
        title="Transactions are blocked"
        description={`The connected user is currently ${formatConnectedUserStatus(accountStatus)}. Xflow requires the account to be Active before receivables can be created.`}
        actionHref="/onboarding"
        actionLabel="Open Onboarding"
      />
    );
  }

  if (directory.length === 0) {
    return (
      <EmptyState
        title="Create a partner first"
        description="Receivables now use the separate partner module. Add a partner, then return here to create the receivable."
        actionHref="/partners/new"
        actionLabel="Add Partner"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Receivables"
        title="Create receivable"
        description="Create only the receivable here. Partner records are selected from the separate partner module."
        actions={
          <Link href="/receivables">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" />
              Back to receivables
            </Button>
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard>
          <form
            className="space-y-8"
            onSubmit={async (event) => {
              event.preventDefault();
              setError("");

              if (!selectedPartner) {
                setError("Select a partner before creating the receivable.");
                return;
              }

              if (!partnerIsReady) {
                setError(
                  "The selected partner is not Active yet. Create or activate the partner first to avoid draft receivables.",
                );
                return;
              }

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

              const parsed = receivableFormSchema.safeParse({
                amountUsd: Number(form.amountUsd),
                description: form.description || undefined,
                dueDate: form.dueDate || undefined,
                invoiceDate: form.invoiceDate,
                invoiceDocumentId,
                invoiceNumber: form.invoiceNumber,
                metadata: metadataEntriesToObject(form.metadata),
                partnerId: form.partnerId,
                purposeCode: form.purposeCode,
                transactionType: form.transactionType,
              });

              if (!parsed.success) {
                setError(parsed.error.issues[0]?.message || "Enter valid receivable details.");
                return;
              }

              try {
                const result = await createReceivable.mutateAsync(parsed.data);

                if (result.invoice.creationWarning) {
                  toast.error(result.invoice.creationWarning, { duration: 5000 });
                } else {
                  toast.success("Receivable created.");
                }

                startTransition(() => {
                  router.push(`/receivables/${result.invoice.id}`);
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
                <p className="data-kicker">Partner Information</p>
              </div>

              <div>
                <Label htmlFor="partnerId">Select Partner</Label>
                <Select
                  id="partnerId"
                  value={form.partnerId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, partnerId: event.target.value }))
                  }
                >
                  <option value="">Select...</option>
                  {directory.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {getPartnerLegalName(entry.partner)} ({formatStatusLabel(entry.partner.status)})
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="space-y-5 border-t border-black/8 pt-8">
              <div>
                <p className="data-kicker">Invoice Details</p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <Label htmlFor="transactionType">Type of Transaction</Label>
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
                    <option value="">Select Type of Transaction</option>
                    <option value="goods">Goods</option>
                    <option value="services">Services</option>
                    <option value="software">Software</option>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="purposeCode">Invoice Purpose Code</Label>
                  <Select
                    id="purposeCode"
                    value={form.purposeCode}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, purposeCode: event.target.value }))
                    }
                  >
                    <option value="">Select...</option>
                    {(categoryPurposeCodes.length > 0
                      ? categoryPurposeCodes
                      : purposeCodesQuery.data ?? []
                    ).map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.code} - {option.description}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="invoiceNumber">Invoice Number</Label>
                <Input
                  id="invoiceNumber"
                  placeholder="Enter the Invoice number"
                  value={form.invoiceNumber}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, invoiceNumber: event.target.value }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="invoiceFile">Upload Invoice</Label>
                <input
                  id="invoiceFile"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      invoiceFile: event.target.files?.[0] || null,
                    }))
                  }
                />
                <label
                  htmlFor="invoiceFile"
                  className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-black/12 bg-[rgba(105,126,255,0.05)] px-6 py-10 text-center transition hover:bg-[rgba(105,126,255,0.08)]"
                >
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-primary shadow-[0_10px_24px_rgba(19,33,68,0.08)]">
                    <FileUp className="h-5 w-5" />
                  </span>
                  <span className="mt-4 text-sm font-semibold text-primary">Upload</span>
                  <span className="mt-2 text-sm text-foreground/58">
                    Drag and drop here or click to upload the files
                  </span>
                  <span className="mt-3 text-xs text-foreground/48">
                    We accept files less than 10MB in PDF, JPG, JPEG, or PNG format.
                  </span>
                </label>
                {form.invoiceFile ? (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-black/[0.04] px-3 py-1 text-xs text-foreground/70">
                    <Paperclip className="h-3.5 w-3.5" />
                    {form.invoiceFile.name}
                  </div>
                ) : null}
              </div>

              <div>
                <Label htmlFor="description">Invoice Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Enter a short description for this Invoice."
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <Label htmlFor="amountUsd">Invoice Amount</Label>
                  <div className="flex h-12 items-center rounded-2xl border border-black/10 bg-white/80 px-4 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                    <span className="mr-3 text-foreground/45">USD</span>
                    <input
                      id="amountUsd"
                      inputMode="decimal"
                      className="w-full bg-transparent outline-none"
                      value={form.amountUsd}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, amountUsd: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="receivableAmount">Receivable Amount</Label>
                  <div className="flex h-12 items-center rounded-2xl border border-black/10 bg-black/[0.03] px-4 text-sm text-foreground/68">
                    <span className="mr-3 text-foreground/45">USD</span>
                    <input
                      id="receivableAmount"
                      readOnly
                      className="w-full bg-transparent outline-none"
                      value={Number(form.amountUsd || 0).toFixed(2)}
                    />
                  </div>
                </div>
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
                  <Label htmlFor="dueDate">Payment Due Date (Optional)</Label>
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
            </div>

            <div className="space-y-5 border-t border-black/8 pt-8">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="data-kicker">Metadata</p>
                  <p className="mt-2 text-sm text-foreground/65">Optional</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      metadata: [...current.metadata, { key: "", value: "" }],
                    }))
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add Metadata
                </Button>
              </div>

              <div className="space-y-3">
                {form.metadata.map((entry, index) => (
                  <div key={`${index}-${entry.key}`} className="grid gap-3 md:grid-cols-[0.8fr_1fr_auto]">
                    <Input
                      placeholder="Key"
                      value={entry.key}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          metadata: current.metadata.map((item, itemIndex) =>
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
                          metadata: current.metadata.map((item, itemIndex) =>
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
                          metadata: current.metadata.filter((_, itemIndex) => itemIndex !== index),
                        }))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {error ? (
              <p className="rounded-2xl bg-[rgba(218,70,70,0.08)] px-4 py-3 text-sm text-[rgb(190,51,51)]">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Link href="/receivables">
                <Button type="button" variant="outline" className="w-full sm:w-auto">
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={
                  createReceivable.isPending || isRouting || uploading || !selectedPartner || !partnerIsReady
                }
              >
                {createReceivable.isPending || isRouting || uploading
                  ? uploading
                    ? "Uploading invoice..."
                    : "Creating receivable..."
                  : "Submit"}
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold">Selected partner</h2>
                <p className="mt-1 text-sm text-foreground/65">
                  Receivable creation only uses an existing partner record.
                </p>
              </div>
            </div>

            {selectedPartner ? (
              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-xl font-semibold text-foreground">
                    {getPartnerLegalName(selectedPartner.partner)}
                  </p>
                  <p className="mt-1 text-sm text-foreground/65">
                    {getPartnerEmail(selectedPartner.partner)}
                  </p>
                  <p className="mt-1 text-sm text-foreground/58">
                    {getPartnerCountry(selectedPartner.partner)}
                  </p>
                </div>

                <div>
                  <StatusBadge status={selectedPartner.partner.status} />
                </div>

                {!partnerIsReady ? (
                  <p className="rounded-2xl bg-[rgba(255,167,38,0.12)] px-4 py-3 text-sm text-[rgb(170,97,23)]">
                    This partner is still {formatStatusLabel(selectedPartner.partner.status) || "pending"}.
                    Creating a receivable now can leave it in draft.
                  </p>
                ) : null}

                {selectedPartner.activationWarning ? (
                  <p className="rounded-2xl bg-[rgba(255,167,38,0.12)] px-4 py-3 text-sm text-[rgb(170,97,23)]">
                    {selectedPartner.activationWarning}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-6 text-sm text-foreground/58">
                Select a partner to preview its status before creating the receivable.
              </p>
            )}
          </SectionCard>

          <SectionCard>
            <p className="data-kicker">Why This Changed</p>
            <h2 className="mt-3 text-2xl font-semibold">Separate receivable module</h2>
            <div className="mt-5 space-y-3 text-sm leading-7 text-foreground/68">
              <div>1. Partners are created separately and reused from the partner module.</div>
              <div>2. Receivable creation now focuses only on invoice and collection details.</div>
              <div>3. Partner status is shown before submission to reduce draft receivable issues.</div>
              <div>4. Any confirmation warning from Xflow is saved and shown on the receivable detail page.</div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
