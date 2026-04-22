import { NextResponse } from "next/server";

import { XFLOW_EXPORT_PURPOSE_CODES } from "@/lib/tradedge/purpose-codes";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json({
    purposeCodes: XFLOW_EXPORT_PURPOSE_CODES,
  });
}
