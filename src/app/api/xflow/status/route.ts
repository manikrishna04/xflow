import { NextRequest, NextResponse } from "next/server";

import { statusRequestSchema } from "@/lib/tradedge/schemas";
import { xflowRequest } from "@/lib/xflow/client";
import { xflowRouteErrorResponse } from "@/lib/xflow/route-error";
import type { XflowPayout, XflowReceivable } from "@/types/xflow";

export async function POST(request: NextRequest) {
  try {
    const parsed = statusRequestSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid status payload." },
        { status: 400 },
      );
    }

    const headers = {
      "Xflow-Account": parsed.data.exporterAccountId,
    };

    const [receivable, payout] = await Promise.all([
      parsed.data.receivableId
        ? xflowRequest<XflowReceivable>(`receivables/${parsed.data.receivableId}`, { headers })
        : Promise.resolve(null),
      parsed.data.payoutId
        ? xflowRequest<XflowPayout>(`payouts/${parsed.data.payoutId}`, { headers })
        : Promise.resolve(null),
    ]);

    return NextResponse.json({
      fetchedAt: new Date().toISOString(),
      payout,
      receivable,
    });
  } catch (error) {
    return xflowRouteErrorResponse(error);
  }
}
