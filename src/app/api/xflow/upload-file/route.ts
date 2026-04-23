import { NextRequest, NextResponse } from "next/server";

import { requireXflowSecretKey } from "@/lib/xflow/config";
import { xflowRouteErrorResponse } from "@/lib/xflow/route-error";
import type { XflowFile } from "@/types/xflow";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const exporterAccountId = String(formData.get("exporterAccountId") || "").trim();
    const purpose = String(formData.get("purpose") || "finance_document").trim();
    const uploadedFile = formData.get("file");

    if (!exporterAccountId) {
      return NextResponse.json({ message: "Exporter account id is required." }, { status: 400 });
    }

    if (!(uploadedFile instanceof File)) {
      return NextResponse.json({ message: "Upload an invoice file first." }, { status: 400 });
    }

    const config = requireXflowSecretKey();
    const payload = new FormData();
    payload.append("file", uploadedFile, uploadedFile.name);
    payload.append("payload", JSON.stringify({ purpose }));

    const response = await fetch(`${config.baseUrl}/files`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        "Xflow-Account": exporterAccountId,
      },
      body: payload,
      cache: "no-store",
    });

    const json = (await response.json().catch(() => null)) as XflowFile | { message?: string } | null;

    if (!response.ok) {
      return NextResponse.json(
        {
          message:
            (json && "message" in json && json.message) || "Could not upload invoice file.",
        },
        { status: response.status },
      );
    }

    return NextResponse.json({ file: json as XflowFile });
  } catch (error) {
    return xflowRouteErrorResponse(error);
  }
}
