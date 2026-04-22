import { NextRequest, NextResponse } from "next/server";

import { buildConnectedUserSnapshot } from "@/lib/tradedge/onboarding";
import { createPayoutAddressSchema } from "@/lib/tradedge/schemas";
import { getXflowAccount } from "@/lib/xflow/accounts";
import { xflowRequest } from "@/lib/xflow/client";
import { xflowRouteErrorResponse } from "@/lib/xflow/route-error";
import type { XflowAddress, XflowPerson } from "@/types/xflow";

type XflowListResponse<T> = {
  data: T[];
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ accountId: string }> },
) {
  try {
    const { accountId } = await context.params;
    const parsed = createPayoutAddressSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid payout bank payload." },
        { status: 400 },
      );
    }

    await xflowRequest<XflowAddress>("addresses", {
      method: "POST",
      headers: {
        "Xflow-Account": accountId,
      },
      body: {
        bank_account: {
          domestic_credit: parsed.data.bank.ifsc,
          number: parsed.data.bank.accountNumber,
          type: "domestic_credit",
        },
        billing_details: {
          city: parsed.data.bank.city,
          country: "IN",
          line1: parsed.data.bank.line1,
          postal_code: parsed.data.bank.postalCode,
          state: parsed.data.bank.state,
        },
        category: "user_payout",
        currency: "INR",
        linked_id: accountId,
        linked_object: "account",
        name: parsed.data.bank.accountHolderName,
        type: "bank_account",
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
