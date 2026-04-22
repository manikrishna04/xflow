import { NextRequest, NextResponse } from "next/server";

import { createReceivableSchema } from "@/lib/tradedge/schemas";
import { xflowRequest } from "@/lib/xflow/client";
import { xflowRouteErrorResponse } from "@/lib/xflow/route-error";
import type { XflowReceivable } from "@/types/xflow";

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
        account_id: parsed.data.exporterAccountId,
        amount: amount,
        amount_maximum_reconcilable: amount,
        currency: "USD",
        description: `TradEdge invoice ${parsed.data.referenceId} for ${parsed.data.buyerName}`,
        invoice: {
          amount,
          creation_date: new Date().toISOString().slice(0, 10),
          currency: "USD",
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10),
          reference_number: parsed.data.referenceId,
        },
        metadata: {
          invoice_id: parsed.data.invoiceId,
          source: "tradedge_frontend",
        },
        partner_id: parsed.data.partnerId,
        purpose_code: "S0803",
        reference_id: parsed.data.referenceId,
        transaction_type: "services",
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

        receivable = await xflowRequest<XflowReceivable>(
          `receivables/${createdReceivable.id}`,
          {
            headers: {
              "Xflow-Account": parsed.data.exporterAccountId,
            },
          },
        );
      } catch (error) {
        confirmationWarning =
          error instanceof Error ? error.message : "Could not auto-confirm receivable.";
      }
    }

    return NextResponse.json({ confirmationWarning, receivable });
  } catch (error) {
    return xflowRouteErrorResponse(error);
  }
}
