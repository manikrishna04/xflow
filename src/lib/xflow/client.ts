import "server-only";

import { requireXflowSecretKey } from "@/lib/xflow/config";
import type { XflowApiErrorPayload } from "@/types/xflow";

type PrimitiveQueryValue = string | number | boolean;
type QueryValue = PrimitiveQueryValue | PrimitiveQueryValue[] | undefined | null;

type RequestOptions = {
  headers?: HeadersInit;
  method?: "GET" | "POST";
  body?: unknown;
  query?: Record<string, QueryValue>;
};

export class XflowApiError extends Error {
  status: number;
  details: XflowApiErrorPayload | null;

  constructor(message: string, status: number, details: XflowApiErrorPayload | null) {
    super(message);
    this.name = "XflowApiError";
    this.status = status;
    this.details = details;
  }
}

function appendQuery(searchParams: URLSearchParams, query?: Record<string, QueryValue>) {
  if (!query) {
    return;
  }

  for (const [key, rawValue] of Object.entries(query)) {
    if (rawValue === undefined || rawValue === null || rawValue === "") {
      continue;
    }

    if (Array.isArray(rawValue)) {
      for (const value of rawValue) {
        searchParams.append(key, String(value));
      }
      continue;
    }

    searchParams.append(key, String(rawValue));
  }
}

function extractErrorMessage(
  details: XflowApiErrorPayload | null,
  fallback: string,
) {
  const firstError = details?.errors?.[0];

  if (!firstError) {
    return fallback;
  }

  return firstError.message || firstError.code || fallback;
}

export async function xflowRequest<T>(path: string, options: RequestOptions = {}) {
  const config = requireXflowSecretKey();
  const cleanedPath = path.replace(/^\/+/, "");
  const normalizedPath = cleanedPath.startsWith("v1/")
    ? cleanedPath.slice(3)
    : cleanedPath;
  const url = new URL(normalizedPath, `${config.baseUrl}/`);

  appendQuery(url.searchParams, options.query);

  let response: Response;

  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers ?? {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });
  } catch (error) {
    throw new XflowApiError(
      error instanceof Error ? error.message : "Unable to reach Xflow.",
      502,
      null,
    );
  }

  let json: unknown = null;

  try {
    json = await response.json();
  } catch {
    json = null;
  }

  if (!response.ok) {
    const details =
      json && typeof json === "object" ? (json as XflowApiErrorPayload) : null;

    throw new XflowApiError(
      extractErrorMessage(details, "Xflow request failed."),
      response.status,
      details,
    );
  }

  return json as T;
}
