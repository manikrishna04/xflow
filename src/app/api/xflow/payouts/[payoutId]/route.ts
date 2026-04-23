import { NextRequest, NextResponse } from "next/server";

import {
  retrievePayoutSchema,
  updatePayoutMetadataSchema,
} from "@/lib/tradedge/schemas";
import { xflowRequest } from "@/lib/xflow/client";
import { xflowRouteErrorResponse } from "@/lib/xflow/route-error";
import type { XflowPayout } from "@/types/xflow";

type RouteContext = {
  params: Promise<{
    payoutId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { payoutId } = await context.params;
    const parsed = retrievePayoutSchema.safeParse({
      accountId: request.nextUrl.searchParams.get("accountId"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid payout lookup." },
        { status: 400 },
      );
    }

    const payout = await xflowRequest<XflowPayout>(`payouts/${payoutId}`, {
      headers: {
        "Xflow-Account": parsed.data.accountId,
      },
    });

    return NextResponse.json({ payout });
  } catch (error) {
    return xflowRouteErrorResponse(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { payoutId } = await context.params;
    const parsed = updatePayoutMetadataSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid payout metadata." },
        { status: 400 },
      );
    }

    const payout = await xflowRequest<XflowPayout>(`payouts/${payoutId}`, {
      method: "POST",
      headers: {
        "Xflow-Account": parsed.data.accountId,
      },
      body: {
        metadata: parsed.data.metadata,
      },
    });

    return NextResponse.json({ payout });
  } catch (error) {
    return xflowRouteErrorResponse(error);
  }
}
