import { NextRequest, NextResponse } from "next/server";

import { createPartnerAccountSchema } from "@/lib/tradedge/schemas";
import { xflowRequest } from "@/lib/xflow/client";
import { xflowRouteErrorResponse } from "@/lib/xflow/route-error";
import type { XflowAccount } from "@/types/xflow";

export async function POST(request: NextRequest) {
  try {
    const parsed = createPartnerAccountSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid partner payload." },
        { status: 400 },
      );
    }

    const partner = await xflowRequest<XflowAccount>("accounts", {
      method: "POST",
      headers: {
        "Xflow-Account": parsed.data.exporterAccountId,
      },
      body: {
        type: "partner",
        nickname: parsed.data.nickname,
        metadata: parsed.data.metadata ?? undefined,
        business_details: {
          email: parsed.data.email,
          legal_name: parsed.data.legalName,
          physical_address: {
            city: parsed.data.address.city,
            country: parsed.data.country,
            line1: parsed.data.address.line1,
            line2: parsed.data.address.line2 || undefined,
            postal_code: parsed.data.address.postalCode,
            state: parsed.data.address.state,
          },
          type: parsed.data.partnerType,
        },
      },
    });

    let activationWarning: string | null = null;
    let refreshedPartner = partner;

    if (!partner.status || partner.status.toLowerCase() === "draft") {
      try {
        await xflowRequest(`accounts/${partner.id}/activate`, {
          method: "POST",
          headers: {
            "Xflow-Account": parsed.data.exporterAccountId,
          },
        });

        refreshedPartner = await xflowRequest<XflowAccount>(`accounts/${partner.id}`, {
          headers: {
            "Xflow-Account": parsed.data.exporterAccountId,
          },
        });
      } catch (activationError) {
        activationWarning =
          activationError instanceof Error
            ? `Partner activation failed: ${activationError.message}`
            : "Partner activation failed.";
      }
    }

    return NextResponse.json({ activationWarning, partner: refreshedPartner });
  } catch (error) {
    return xflowRouteErrorResponse(error);
  }
}
