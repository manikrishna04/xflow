import { NextRequest, NextResponse } from "next/server";

import { createPartnerAccountSchema } from "@/lib/xflow/schemas";
import { xflowRequest } from "@/lib/xflow/client";
import { xflowRouteErrorResponse } from "@/lib/xflow/route-error";
import type { XflowAccount } from "@/types/xflow";

export async function POST(request: NextRequest) {
  try {
    const parsed = createPartnerAccountSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid partner account payload." },
        { status: 400 },
      );
    }

    const { exporterAccountId, metadata, ...body } = parsed.data;

    const partner = await xflowRequest<XflowAccount>("accounts", {
      method: "POST",
      headers: {
        "Xflow-Account": exporterAccountId,
      },
      body: {
        ...body,
        metadata,
      },
    });

    return NextResponse.json({ partner });
  } catch (error) {
    return xflowRouteErrorResponse(error);
  }
}