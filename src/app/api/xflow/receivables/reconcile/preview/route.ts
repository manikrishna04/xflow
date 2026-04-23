import { NextRequest, NextResponse } from "next/server";

import { previewReceivableReconciliationSchema } from "@/lib/tradedge/schemas";
import { xflowRequest } from "@/lib/xflow/client";
import { xflowRouteErrorResponse } from "@/lib/xflow/route-error";
import type { XflowReceivableReconciliationPreview } from "@/types/xflow";

export async function POST(request: NextRequest) {
  try {
    const parsed = previewReceivableReconciliationSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid reconciliation preview payload." },
        { status: 400 },
      );
    }

    const preview = await xflowRequest<XflowReceivableReconciliationPreview>(
      `receivables/${parsed.data.receivableId}/reconcile/preview`,
      {
        method: "POST",
        headers: {
          "Xflow-Account": parsed.data.exporterAccountId,
        },
        body: {
          amount: parsed.data.amount,
          ...(parsed.data.reconciliationTime
            ? { reconciliation_time: parsed.data.reconciliationTime }
            : {}),
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

    return NextResponse.json({ preview });
  } catch (error) {
    return xflowRouteErrorResponse(error);
  }
}
