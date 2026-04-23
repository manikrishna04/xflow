import { NextRequest, NextResponse } from "next/server";

import { connectedUserTopupSchema } from "@/lib/xflow/schemas";
import { createConnectedUserTopup, getConnectedUserTreasurySnapshot } from "@/lib/xflow/treasury";
import { xflowRouteErrorResponse } from "@/lib/xflow/route-error";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ accountId: string }> },
) {
  try {
    const { accountId } = await context.params;
    const parsed = connectedUserTopupSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid top-up payload." },
        { status: 400 },
      );
    }

    const transfer = await createConnectedUserTopup(accountId, parsed.data);
    const treasurySnapshot = await getConnectedUserTreasurySnapshot(accountId);

    return NextResponse.json({
      balance: treasurySnapshot.balance,
      recentTopups: treasurySnapshot.recentTopups,
      topUpSourceAccountId: treasurySnapshot.topUpSourceAccountId,
      transfer,
      treasuryWarning: treasurySnapshot.treasuryWarning,
    });
  } catch (error) {
    return xflowRouteErrorResponse(error);
  }
}
