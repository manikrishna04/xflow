import { NextResponse } from "next/server";

import { buildConnectedUserSnapshot, validateCompanyPersonnelRequirement } from "@/lib/tradedge/onboarding";
import { getXflowAccount } from "@/lib/xflow/accounts";
import { xflowRequest } from "@/lib/xflow/client";
import { xflowRouteErrorResponse } from "@/lib/xflow/route-error";
import type { XflowAddress, XflowPerson } from "@/types/xflow";

type XflowListResponse<T> = {
  data: T[];
};

export async function POST(
  _request: Request,
  context: { params: Promise<{ accountId: string }> },
) {
  try {
    const { accountId } = await context.params;

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

    // Validate personnel requirement for company types
    const personnelValidation = validateCompanyPersonnelRequirement(account, peopleResponse.data);
    if (!personnelValidation.valid) {
      return NextResponse.json(
        { message: personnelValidation.error },
        { status: 400 },
      );
    }

    await xflowRequest(`accounts/${accountId}/activate`, {
      method: "POST",
      headers: {
        "Xflow-Account": accountId,
      },
    });

    const refreshedAccount = await getXflowAccount(accountId);

    return NextResponse.json(
      buildConnectedUserSnapshot(refreshedAccount, payoutAddressesResponse.data, peopleResponse.data),
    );
  } catch (error) {
    return xflowRouteErrorResponse(error);
  }
}
