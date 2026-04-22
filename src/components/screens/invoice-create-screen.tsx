"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useMemo } from "react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send } from "lucide-react";
import { useCreateInvoiceMutation, usePurposeCodesQuery } from "@/lib/hooks/use-tradedge-actions";
import { useTradEdgeStore } from "@/lib/store/tradedge-store";
import { COMMON_PURPOSE_CODES_BY_PRODUCT_CATEGORY } from "@/lib/tradedge/purpose-codes";

export function InvoiceCreateScreen() {
  const router = useRouter();
  const createInvoice = useCreateInvoiceMutation();
  const invoices = useTradEdgeStore((state) => state.invoices);
  const [isRouting, setIsRouting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    partnerId: "",
    transactionType: "",
    purposeCode: "",
    invoiceNumber: "",
    description: "",
    invoiceAmount: "",
    receivableAmount: "",
    invoiceDate: "",
    dueDate: "",
    file: null as File | null,
    metadata: [] as { key: string; value: string }[],
  });

  const partnerOptions = useMemo(() => {
    const partnerMap = new Map();
    invoices.forEach((invoice) => {
      if (invoice.partnerSnapshot && !partnerMap.has(invoice.partnerSnapshot.id)) {
        partnerMap.set(invoice.partnerSnapshot.id, invoice.partnerSnapshot);
      }
    });
    return Array.from(partnerMap.values()).map((partner) => ({
      id: partner.id,
      label: partner.business_details?.legal_name || partner.nickname || partner.id,
    }));
  }, [invoices]);

  const { data: allPurposeCodes = [] } = usePurposeCodesQuery();

  const purposeCodeOptions = useMemo(() => {
    if (!form.transactionType) return [];
    const categoryCodes = COMMON_PURPOSE_CODES_BY_PRODUCT_CATEGORY[form.transactionType as "goods" | "services" | "software"];
    if (!categoryCodes) return [];
    return allPurposeCodes.filter(code => (categoryCodes as readonly string[]).includes(code.code));
  }, [allPurposeCodes, form.transactionType]);

  const addMetadata = () => {
    setForm((prev) => ({
      ...prev,
      metadata: [...prev.metadata, { key: "", value: "" }],
    }));
  };

  const updateMetadata = (index: number, field: "key" | "value", value: string) => {
    const updated = [...form.metadata];
    updated[index][field] = value;
    setForm({ ...form, metadata: updated });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const selectedPartner = partnerOptions.find((option) => option.id === form.partnerId);
    const buyerName = selectedPartner?.label || "Buyer";
    const buyerCountry = "US";

    const metadataObj = Object.fromEntries(
      form.metadata
        .filter((entry) => entry.key.trim().length > 0)
        .map((entry) => [entry.key.trim(), entry.value]),
    );

    const amountUsd = Number(form.invoiceAmount);

    if (!form.partnerId) {
      setError("Please select a partner.");
      return;
    }

    if (!form.transactionType || !form.purposeCode) {
      setError("Please select a transaction type and purpose code.");
      return;
    }

    if (!form.invoiceNumber) {
      setError("Invoice number is required.");
      return;
    }

    if (!form.invoiceDate || !form.dueDate) {
      setError("Please provide invoice and due dates.");
      return;
    }

    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      setError("Enter a valid invoice amount.");
      return;
    }

    setIsRouting(true);

    try {
      await createInvoice.mutateAsync({
        amountUsd,
        partnerId: form.partnerId,
        buyerCountry,
        buyerName,
        transactionType: form.transactionType as "goods" | "services" | "software",
        purposeCode: form.purposeCode,
        invoiceNumber: form.invoiceNumber,
        description: form.description || undefined,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate,
        metadata: Object.keys(metadataObj).length > 0 ? metadataObj : undefined,
      });

      toast.success("Invoice created successfully.");
      startTransition(() => {
        router.push("/invoices");
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invoice.");
    } finally {
      setIsRouting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label>Partner</Label>
        <select
          className="w-full border p-2 rounded"
          value={form.partnerId}
          onChange={(e) => setForm({ ...form, partnerId: e.target.value })}
        >
          <option value="">Select...</option>
          {partnerOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label>Type of Transaction</Label>
        <select
          className="w-full border p-2 rounded"
          value={form.transactionType}
          onChange={(e) => setForm({ ...form, transactionType: e.target.value, purposeCode: "" })}
        >
          <option value="">Select Type of Transaction</option>
          <option value="goods">Goods</option>
          <option value="services">Services</option>
          <option value="software">Software</option>
        </select>
      </div>

      <div>
        <Label>Invoice Purpose Code</Label>
        <select
          className="w-full border p-2 rounded"
          value={form.purposeCode}
          onChange={(e) => setForm({ ...form, purposeCode: e.target.value })}
        >
          <option value="">Select...</option>
          {purposeCodeOptions.map((code) => (
            <option key={code.code} value={code.code}>
              {code.code} - {code.description}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label>Invoice Number</Label>
        <Input
          value={form.invoiceNumber}
          onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
        />
      </div>

      <div>
        <Label>Upload Invoice</Label>
        <Input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) =>
            setForm({
              ...form,
              file: e.target.files?.[0] || null,
            })
          }
        />
        <p className="text-sm text-gray-500">Max 10MB (PDF, JPG, PNG)</p>
      </div>

      <div>
        <Label>Invoice Description</Label>
        <Input
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>

      <div>
        <Label>Invoice Amount (USD)</Label>
        <Input
          value={form.invoiceAmount}
          onChange={(e) => setForm({ ...form, invoiceAmount: e.target.value })}
        />
      </div>

      <div>
        <Label>Receivable Amount (USD)</Label>
        <Input
          value={form.receivableAmount}
          onChange={(e) => setForm({ ...form, receivableAmount: e.target.value })}
        />
      </div>

      <div>
        <Label>Invoice Date</Label>
        <Input
          type="date"
          value={form.invoiceDate}
          onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
        />
      </div>

      <div>
        <Label>Payment Due Date</Label>
        <Input
          type="date"
          value={form.dueDate}
          onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
        />
      </div>

      <div>
        <Label>Metadata (Optional)</Label>
        {form.metadata.map((m, i) => (
          <div key={i} className="flex gap-2 mt-2">
            <Input
              placeholder="Key"
              value={m.key}
              onChange={(e) => updateMetadata(i, "key", e.target.value)}
            />
            <Input
              placeholder="Value"
              value={m.value}
              onChange={(e) => updateMetadata(i, "value", e.target.value)}
            />
          </div>
        ))}

        <Button type="button" onClick={addMetadata} className="mt-2">
          Add Metadata
        </Button>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="flex gap-4">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" size="lg" className="w-full" disabled={isRouting || isPending}>
          {isRouting || isPending ? "Creating buyer and receivable..." : "Create invoice"}
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
