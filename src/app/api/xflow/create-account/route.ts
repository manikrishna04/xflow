import { NextRequest, NextResponse } from "next/server";

import { buildConnectedUserNickname, toXflowBusinessType } from "@/lib/tradedge/onboarding";
import { exporterAccountSchema } from "@/lib/tradedge/schemas";
import { findReusableConnectedUserAccount } from "@/lib/xflow/accounts";
import { xflowRequest } from "@/lib/xflow/client";
import { xflowRouteErrorResponse } from "@/lib/xflow/route-error";
import type { XflowAccount } from "@/types/xflow";

export async function POST(request: NextRequest) {
  try {
    const parsed = exporterAccountSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid exporter account payload." },
        { status: 400 },
      );
    }

    const reusableAccount =
      (await findReusableConnectedUserAccount({
        businessType: toXflowBusinessType(parsed.data.businessType),
        dba: parsed.data.dba,
        email: parsed.data.email,
        legalName: parsed.data.legalName,
      })) ?? null;

    const account =
      reusableAccount ||
      (await xflowRequest<XflowAccount>("accounts", {
        method: "POST",
        body: {
          nickname:
            parsed.data.nickname ||
            buildConnectedUserNickname({
              dba: parsed.data.dba,
              legalName: parsed.data.legalName,
            }),
          type: "user",
          business_details: {
            ...(parsed.data.dba ? { dba: parsed.data.dba } : {}),
            email: parsed.data.email,
            legal_name: parsed.data.legalName,
            physical_address: {
              country: parsed.data.countryCode,
            },
            type: toXflowBusinessType(parsed.data.businessType),
          },
        },
      }));

    return NextResponse.json({ account });
  } catch (error) {
    return xflowRouteErrorResponse(error);
  }
}
