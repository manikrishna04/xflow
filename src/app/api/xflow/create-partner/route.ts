import { NextRequest, NextResponse } from "next/server";

import { createPartnerSchema } from "@/lib/tradedge/schemas";
import { deriveBuyerEmail } from "@/lib/tradedge/invoices";
import { xflowRequest } from "@/lib/xflow/client";
import { xflowRouteErrorResponse } from "@/lib/xflow/route-error";
import type { XflowAccount } from "@/types/xflow";

export async function POST(request: NextRequest) {
  try {
    const parsed = createPartnerSchema.safeParse(await request.json());

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
        nickname: parsed.data.buyerName,
        business_details: {
          email: deriveBuyerEmail(parsed.data.buyerName, parsed.data.referenceId),
          legal_name: parsed.data.buyerName,
          physical_address: {
            city: "Sandbox City",
            country: parsed.data.buyerCountry,
            line1: "TradeEdge Test Lane",
            postal_code: "000000",
            state: "NA",
          },
          type: "company",
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

        let attempts = 0;
        while (
          attempts < 3 &&
          refreshedPartner.status?.toLowerCase() === "draft"
        ) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          refreshedPartner = await xflowRequest<XflowAccount>(`accounts/${partner.id}`, {
            headers: {
              "Xflow-Account": parsed.data.exporterAccountId,
            },
          });
          attempts += 1;
        }
      } catch (activationError) {
        activationWarning =
          activationError instanceof Error
            ? `Partner activation failed: ${activationError.message}`
            : "Partner activation failed.";

        try {
          refreshedPartner = await xflowRequest<XflowAccount>(`accounts/${partner.id}`, {
            headers: {
              "Xflow-Account": parsed.data.exporterAccountId,
            },
          });
        } catch {
          refreshedPartner = partner;
        }
      }
    }

    return NextResponse.json({ partner: refreshedPartner, activationWarning });
  } catch (error) {
    return xflowRouteErrorResponse(error);
  }
}
