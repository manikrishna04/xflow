import { NextResponse } from "next/server";

import { xflowRequest } from "@/lib/xflow/client";
import { xflowRouteErrorResponse } from "@/lib/xflow/route-error";
import type { XflowAccount } from "@/types/xflow";

type XflowListResponse<T> = {
  data: T[];
  has_next?: boolean;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json({ message: "Missing required query param: accountId" }, { status: 400 });
    }

    const partners: XflowAccount[] = [];
    let startingAfter: string | undefined;

    for (let page = 0; page < 10; page += 1) {
      const response = await xflowRequest<XflowListResponse<XflowAccount>>("accounts", {
        headers: {
          // Xflow expects the connected-user account context in this header.
          "Xflow-Account": accountId,
        },
        query: {
          limit: 10,
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        },
      });

      // 🔥 PRINT FULL RESPONSE
      console.log("XFLOW RAW RESPONSE:", JSON.stringify(response, null, 2));

      const pagePartners = response.data.filter(
        (account) => account.type === "partner",
      );

      partners.push(...pagePartners);

      if (!response.has_next || response.data.length === 0) {
        break;
      }

      startingAfter = response.data.at(-1)?.id;
    }

    return NextResponse.json({ partners });
  } catch (error) {
    console.error("ERROR:", error); // also log errors
    return xflowRouteErrorResponse(error);
  }
}
