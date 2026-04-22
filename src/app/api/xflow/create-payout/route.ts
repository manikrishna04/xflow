import { NextRequest, NextResponse } from "next/server";

import { createPayoutSchema } from "@/lib/tradedge/schemas";
import { xflowRequest } from "@/lib/xflow/client";
import { xflowRouteErrorResponse } from "@/lib/xflow/route-error";
import type { XflowPayout } from "@/types/xflow";

export async function POST(request: NextRequest) {
  try {
    const parsed = createPayoutSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid payout payload." },
        { status: 400 },
      );
    }

    const payout = await xflowRequest<XflowPayout>("payouts", {
      method: "POST",
      headers: {
        "Xflow-Account": parsed.data.exporterAccountId,
      },
      body: {
        account_id: parsed.data.exporterAccountId,
        amount: parsed.data.amountInr.toFixed(2),
        currency: "INR",
        metadata: {
          source: "tradedge_frontend",
        },
        reference_id: parsed.data.referenceId,
      },
    });

    return NextResponse.json({ payout });
  } catch (error) {
    return xflowRouteErrorResponse(error);
  }
}
