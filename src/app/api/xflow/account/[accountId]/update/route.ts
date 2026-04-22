import { NextRequest, NextResponse } from "next/server";

import { buildConnectedUserSnapshot, toXflowBusinessType } from "@/lib/tradedge/onboarding";
import { updateConnectedUserSchema } from "@/lib/tradedge/schemas";
import { getXflowAccount } from "@/lib/xflow/accounts";
import { xflowRequest } from "@/lib/xflow/client";
import { xflowRouteErrorResponse } from "@/lib/xflow/route-error";
import type { XflowAccount, XflowAddress, XflowPerson } from "@/types/xflow";

type XflowListResponse<T> = {
  data: T[];
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ accountId: string }> },
) {
  try {
    const { accountId } = await context.params;
    const parsed = updateConnectedUserSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid onboarding payload." },
        { status: 400 },
      );
    }

    const currentAccount = await getXflowAccount(accountId);
    const ipHeader =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";
    const ip = ipHeader.split(",")[0]?.trim() || "127.0.0.1";

    const nextBusinessDetails = {
      ...(currentAccount.business_details ?? {}),
      ...(parsed.data.businessDetails
        ? {
            date_of_incorporation: parsed.data.businessDetails.dateOfIncorporation,
            dba: parsed.data.businessDetails.dba,
            email: parsed.data.businessDetails.email,
            estimated_monthly_volume: parsed.data.businessDetails.estimatedMonthlyVolume
              ? {
                  amount: parsed.data.businessDetails.estimatedMonthlyVolume,
                  currency: "USD",
                }
              : currentAccount.business_details?.estimated_monthly_volume,
            legal_name: parsed.data.businessDetails.legalName,
            merchant_category_code:
              parsed.data.businessDetails.merchantCategoryCode ||
              currentAccount.business_details?.merchant_category_code,
            merchant_size:
              parsed.data.businessDetails.merchantSize ||
              currentAccount.business_details?.merchant_size,
            product_category: parsed.data.businessDetails.productCategory,
            product_description: parsed.data.businessDetails.productDescription,
            type: parsed.data.businessDetails.businessType
              ? toXflowBusinessType(parsed.data.businessDetails.businessType)
              : currentAccount.business_details?.type,
            website: parsed.data.businessDetails.website,
          }
        : {}),
      ...(parsed.data.address
        ? {
            physical_address: {
              ...(currentAccount.business_details?.physical_address ?? {}),
              city: parsed.data.address.city,
              country: parsed.data.address.country,
              line1: parsed.data.address.line1,
              postal_code: parsed.data.address.postalCode,
              state: parsed.data.address.state,
            },
          }
        : {}),
      ...(parsed.data.tax
        ? {
            ids: {
              ...(currentAccount.business_details?.ids ?? {}),
              business: parsed.data.tax.businessId,
              tax: parsed.data.tax.pan,
              tax_gst: parsed.data.tax.gst,
            },
          }
        : {}),
    };

    await xflowRequest<XflowAccount>(`accounts/${accountId}`, {
      method: "POST",
      headers: {
        "Xflow-Account": accountId,
      },
      body: {
        business_details: nextBusinessDetails,
        ...(parsed.data.nickname ? { nickname: parsed.data.nickname } : {}),
        ...(parsed.data.purposeCodes
          ? {
              purpose_code: parsed.data.purposeCodes.map((code) => ({ code })),
            }
          : {}),
        ...(parsed.data.tosAccepted
          ? {
              tos_acceptance: {
                ip,
                time: Math.floor(Date.now() / 1000),
                user_agent: request.headers.get("user-agent") || "TradEdge Sandbox",
              },
            }
          : {}),
      },
    });

    const [account, payoutAddressesResponse, peopleResponse] = await Promise.all([
      getXflowAccount(accountId),
      xflowRequest<XflowListResponse<XflowAddress>>("addresses", {
        headers: {
          "Xflow-Account": accountId,
        },
        query: {
          category: "user_payout",
          linked_id: accountId,
        },
      }),
      xflowRequest<XflowListResponse<XflowPerson>>("persons", {
        headers: {
          "Xflow-Account": accountId,
        },
      }),
    ]);

    return NextResponse.json(
      buildConnectedUserSnapshot(account, payoutAddressesResponse.data, peopleResponse.data),
    );
  } catch (error) {
    return xflowRouteErrorResponse(error);
  }
}
