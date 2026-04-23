import { NextRequest, NextResponse } from "next/server";

import { createReceivableSchema } from "@/lib/tradedge/schemas";
import { xflowRequest } from "@/lib/xflow/client";
import { xflowRouteErrorResponse } from "@/lib/xflow/route-error";
import type { XflowAccount, XflowReceivable } from "@/types/xflow";

async function refetchReceivable(
  exporterAccountId: string,
  receivableId: string,
  attempts = 4,
) {
  let receivable = await xflowRequest<XflowReceivable>(`receivables/${receivableId}`, {
    headers: {
      "Xflow-Account": exporterAccountId,
    },
  });

  let remainingAttempts = attempts;

  while (
    remainingAttempts > 0 &&
    (!receivable.status || receivable.status.toLowerCase() === "draft")
  ) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    receivable = await xflowRequest<XflowReceivable>(`receivables/${receivableId}`, {
      headers: {
        "Xflow-Account": exporterAccountId,
      },
    });
    remainingAttempts -= 1;
  }

  return receivable;
}

export async function POST(request: NextRequest) {
  try {
    const parsed = createReceivableSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid receivable payload." },
        { status: 400 },
      );
    }

    const amount = parsed.data.amountUsd.toFixed(2);

    const createdReceivable = await xflowRequest<XflowReceivable>("receivables", {
      method: "POST",
      headers: {
        "Xflow-Account": parsed.data.exporterAccountId,
      },
      body: {
        account_id: parsed.data.partnerId,
        amount_maximum_reconcilable: amount,
        currency: "USD",
        description:
          parsed.data.description?.trim() ||
          `TradEdge receivable ${parsed.data.invoiceNumber}`,
        invoice: {
          amount,
          creation_date: parsed.data.invoiceDate,
          currency: "USD",
          ...(parsed.data.invoiceDocumentId ? { document: parsed.data.invoiceDocumentId } : {}),
          ...(parsed.data.dueDate ? { due_date: parsed.data.dueDate } : {}),
          reference_number: parsed.data.invoiceNumber,
        },
        metadata: {
          invoice_id: parsed.data.invoiceId,
          source: "tradedge_frontend",
          ...(parsed.data.metadata ?? {}),
        },
        purpose_code: parsed.data.purposeCode,
        transaction_type: parsed.data.transactionType,
      },
    });

    let receivable = createdReceivable;
    let confirmationWarning: string | null = null;

    if (!createdReceivable.status || createdReceivable.status.toLowerCase() === "draft") {
      try {
        await xflowRequest(`receivables/${createdReceivable.id}/confirm`, {
          method: "POST",
          headers: {
            "Xflow-Account": parsed.data.exporterAccountId,
          },
        });

        receivable = await refetchReceivable(
          parsed.data.exporterAccountId,
          createdReceivable.id,
        );

        if (!receivable.status || receivable.status.toLowerCase() === "draft") {
          confirmationWarning =
            "Receivable confirmation was requested, but the latest status is still Draft.";
        }
      } catch (error) {
        console.error("Receivable confirmation failed:", error);
        confirmationWarning =
          error instanceof Error ? `Confirmation failed: ${error.message}` : "Could not auto-confirm receivable.";

        try {
          receivable = await refetchReceivable(
            parsed.data.exporterAccountId,
            createdReceivable.id,
            2,
          );
        } catch (refreshError) {
          console.error("Receivable refresh after confirmation failure failed:", refreshError);
        }

        // Check if receivable has system messages explaining why it can't be confirmed
        if (receivable.system_message && receivable.system_message.length > 0) {
          const systemMessages = receivable.system_message
            .map((msg) => `${msg.code}: ${msg.message}`)
            .join("; ");
          confirmationWarning += ` System messages: ${systemMessages}`;
        }
      }
    }

    const partner = await xflowRequest<XflowAccount>(`accounts/${parsed.data.partnerId}`, {
      headers: {
        "Xflow-Account": parsed.data.exporterAccountId,
      },
    });

    // Check if partner account is active
    if (partner.status && partner.status.toLowerCase() !== "active") {
      confirmationWarning = confirmationWarning
        ? `${confirmationWarning} Partner account status: ${partner.status}.`
        : `Partner account status: ${partner.status}. Receivable may require active partner account.`;
    }

    // Also check exporter account status
    try {
      const exporter = await xflowRequest<XflowAccount>(`accounts/${parsed.data.exporterAccountId}`, {
        headers: {
          "Xflow-Account": parsed.data.exporterAccountId,
        },
      });

      if (exporter.status && exporter.status.toLowerCase() !== "active") {
        confirmationWarning = confirmationWarning
          ? `${confirmationWarning} Exporter account status: ${exporter.status}.`
          : `Exporter account status: ${exporter.status}. Receivable may require active exporter account.`;
      }
    } catch (exporterError) {
      console.error("Could not check exporter account status:", exporterError);
    }

    return NextResponse.json({ confirmationWarning, receivable, partner });
  } catch (error) {
    return xflowRouteErrorResponse(error);
  }
}
