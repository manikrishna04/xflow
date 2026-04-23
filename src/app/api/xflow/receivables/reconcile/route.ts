import { NextRequest, NextResponse } from "next/server";

import { reconcileReceivableSchema } from "@/lib/tradedge/schemas";
import { xflowRequest } from "@/lib/xflow/client";
import { xflowRouteErrorResponse } from "@/lib/xflow/route-error";
import type {
  XflowReceivable,
  XflowReceivableReconciliation,
} from "@/types/xflow";

export async function POST(request: NextRequest) {
  try {
    const parsed = reconcileReceivableSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid reconciliation payload." },
        { status: 400 },
      );
    }

    const headers = {
      "Xflow-Account": parsed.data.exporterAccountId,
    };

    const reconciliation = await xflowRequest<XflowReceivableReconciliation>(
      `receivables/${parsed.data.receivableId}/reconcile`,
      {
        method: "POST",
        headers,
        body: {
          amount: parsed.data.amount,
          ...(parsed.data.debitAccountId ? { account_id: parsed.data.debitAccountId } : {}),
          ...(parsed.data.quoteLockId ? { quote_lock_id: parsed.data.quoteLockId } : {}),
          ...(parsed.data.addressId
            ? {
                to: {
                  address_id: parsed.data.addressId,
                },
              }
            : {}),
          ...(parsed.data.liveFx ? { live_fx: parsed.data.liveFx } : {}),
        },
      },
    );

    const receivable = await xflowRequest<XflowReceivable>(
      `receivables/${parsed.data.receivableId}`,
      {
        headers,
      },
    );

    return NextResponse.json({ receivable, reconciliation });
  } catch (error) {
    return xflowRouteErrorResponse(error);
  }
}
