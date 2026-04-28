import { NextRequest, NextResponse } from "next/server";

import { xflowRequest } from "@/lib/xflow/client";
import { xflowRouteErrorResponse } from "@/lib/xflow/route-error";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    console.log("FILE RECEIVED:", file);

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { message: "A file must be provided for invoice upload." },
        { status: 400 },
      );
    }

    const uploadPayload = new FormData();
    uploadPayload.append("file", file);
    uploadPayload.append("payload", new Blob([JSON.stringify({ purpose: "transactional_document" })], { type: "application/json" }));

    const fileResponse = await xflowRequest("files", {
      method: "POST",
      body: uploadPayload,
    });

    return NextResponse.json({ file: fileResponse });
  } catch (error) {
    console.error("FILE UPLOAD EXCEPTION:", error);
    return xflowRouteErrorResponse(error);
  }
}
