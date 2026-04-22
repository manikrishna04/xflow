import { NextResponse } from "next/server";

import { XflowApiError } from "@/lib/xflow/client";

export function xflowRouteErrorResponse(error: unknown) {
  if (error instanceof XflowApiError) {
    const firstError = error.details?.errors?.[0];

    return NextResponse.json(
      {
        code: firstError?.code ?? null,
        message: error.message,
        status: error.status,
        details: error.details,
      },
      { status: error.status },
    );
  }

  const message =
    error instanceof Error ? error.message : "Unexpected error while calling Xflow.";

  return NextResponse.json({ message }, { status: 500 });
}
