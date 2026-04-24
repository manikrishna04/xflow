import "server-only";

import { NextResponse } from "next/server";

const RESPONSE_HEADERS_TO_FORWARD = new Set([
  "cache-control",
  "content-type",
  "etag",
  "location",
  "x-request-id",
]);

function getMicroserviceBaseUrl() {
  const baseUrl = process.env.XFLOW_MICROSERVICE_BASE_URL?.trim();

  if (!baseUrl) {
    throw new Error(
      "Missing XFLOW_MICROSERVICE_BASE_URL. Point it at tradedge-fastapi, for example http://127.0.0.1:8000/api/xflow.",
    );
  }

  return baseUrl.replace(/\/+$/, "");
}

function buildTargetUrl(request: Request, path: string) {
  const normalizedPath = path.replace(/^\/+/, "");
  const targetUrl = new URL(`${getMicroserviceBaseUrl()}/${normalizedPath}`);
  const incomingUrl = new URL(request.url);

  incomingUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value);
  });

  return targetUrl;
}

function buildForwardHeaders(request: Request, options?: { dropContentType?: boolean }) {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    const normalizedKey = key.toLowerCase();

    if (
      normalizedKey === "host" ||
      normalizedKey === "content-length" ||
      normalizedKey === "connection" ||
      normalizedKey === "accept-encoding" ||
      (options?.dropContentType && normalizedKey === "content-type")
    ) {
      return;
    }

    headers.set(key, value);
  });

  return headers;
}

function buildResponseHeaders(source: Headers) {
  const headers = new Headers();

  source.forEach((value, key) => {
    if (RESPONSE_HEADERS_TO_FORWARD.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  return headers;
}

export async function proxyXflowMicroservice(request: Request, path: string) {
  const targetUrl = buildTargetUrl(request, path);
  const method = request.method.toUpperCase();
  let body: BodyInit | undefined;
  let headers: Headers;

  try {
    if (method === "GET" || method === "HEAD") {
      headers = buildForwardHeaders(request);
    } else {
      const contentType = request.headers.get("content-type") || "";

      if (contentType.includes("multipart/form-data")) {
        body = await request.formData();
        headers = buildForwardHeaders(request, { dropContentType: true });
      } else {
        const rawBody = await request.text();
        body = rawBody.length > 0 ? rawBody : undefined;
        headers = buildForwardHeaders(request);
      }
    }

    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    });

    return new NextResponse(response.body, {
      status: response.status,
      headers: buildResponseHeaders(response.headers),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Could not reach tradedge-fastapi.",
      },
      { status: 502 },
    );
  }
}
