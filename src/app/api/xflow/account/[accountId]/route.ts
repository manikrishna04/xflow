import { NextResponse } from "next/server";

import { buildConnectedUserSnapshot } from "@/lib/tradedge/onboarding";
import { getXflowAccount } from "@/lib/xflow/accounts";
import { xflowRequest } from "@/lib/xflow/client";
import { xflowRouteErrorResponse } from "@/lib/xflow/route-error";
import type { XflowAddress, XflowPerson } from "@/types/xflow";

type XflowListResponse<T> = {
  data: T[];
  has_next?: boolean;
  object?: string;
};

export async function GET(
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

    return NextResponse.json(
      buildConnectedUserSnapshot(account, payoutAddressesResponse.data, peopleResponse.data),
    );
  } catch (error) {
    return xflowRouteErrorResponse(error);
  }
}
