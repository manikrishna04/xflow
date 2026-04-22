import { NextRequest, NextResponse } from "next/server";

import { simulatePaymentSchema } from "@/lib/tradedge/schemas";
import { xflowRequest } from "@/lib/xflow/client";
import { xflowRouteErrorResponse } from "@/lib/xflow/route-error";
import type { XflowReceivable } from "@/types/xflow";

export async function POST(request: NextRequest) {
  try {
    const parsed = simulatePaymentSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid simulation payload." },
        { status: 400 },
      );
    }

    const simulation = await xflowRequest<unknown>(
      `receivables/${parsed.data.receivableId}/simulate-payment`,
      {
        method: "POST",
        headers: {
          "Xflow-Account": parsed.data.exporterAccountId,
        },
      },
    );

    const receivable = await xflowRequest<XflowReceivable>(
      `receivables/${parsed.data.receivableId}`,
      {
        headers: {
          "Xflow-Account": parsed.data.exporterAccountId,
        },
      },
    );

    return NextResponse.json({ receivable, simulation });
  } catch (error) {
    return xflowRouteErrorResponse(error);
  }
}
