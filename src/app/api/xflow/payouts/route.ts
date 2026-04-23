import { NextRequest, NextResponse } from "next/server";

import { listPayoutsSchema } from "@/lib/tradedge/schemas";
import { xflowRequest } from "@/lib/xflow/client";
import { xflowRouteErrorResponse } from "@/lib/xflow/route-error";
import type { XflowList, XflowPayout } from "@/types/xflow";

function getAll(searchParams: URLSearchParams, key: string) {
  const values = searchParams.getAll(key).filter(Boolean);
  return values.length > 1 ? values : values[0];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const parsed = listPayoutsSchema.safeParse({
      accountId: searchParams.get("accountId"),
      createdEq: searchParams.get("created.eq") ?? undefined,
      createdGt: searchParams.get("created.gt") ?? undefined,
      createdGte: searchParams.get("created.gte") ?? undefined,
      createdLt: searchParams.get("created.lt") ?? undefined,
      createdLte: searchParams.get("created.lte") ?? undefined,
      endingBefore: searchParams.get("ending_before") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      startingAfter: searchParams.get("starting_after") ?? undefined,
      status: getAll(searchParams, "status"),
      toAccountId: searchParams.get("to.account_id") ?? undefined,
      toAddressId: searchParams.get("to.address_id") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid payout list filters." },
        { status: 400 },
      );
    }

    const payouts = await xflowRequest<XflowList<XflowPayout>>("payouts", {
      headers: {
        "Xflow-Account": parsed.data.accountId,
      },
      query: {
        "created.eq": parsed.data.createdEq,
        "created.gt": parsed.data.createdGt,
        "created.gte": parsed.data.createdGte,
        "created.lt": parsed.data.createdLt,
        "created.lte": parsed.data.createdLte,
        ending_before: parsed.data.endingBefore,
        limit: parsed.data.limit,
        starting_after: parsed.data.startingAfter,
        status: parsed.data.status,
        "to.account_id": parsed.data.toAccountId,
        "to.address_id": parsed.data.toAddressId,
      },
    });

    return NextResponse.json({ payouts });
  } catch (error) {
    return xflowRouteErrorResponse(error);
  }
}
