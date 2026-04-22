"use client";

type ApiErrorShape = {
  code?: string | null;
  details?: unknown;
  message?: string;
  status?: number;
};

export class ApiError extends Error {
  code?: string | null;
  details?: unknown;
  status: number;

  constructor(message: string, status: number, code?: string | null, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiRequest<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => null)) as T | ApiErrorShape | null;

  if (!response.ok) {
    const errorPayload = payload as ApiErrorShape | null;
    throw new ApiError(
      errorPayload?.message || "Request failed.",
      response.status,
      errorPayload?.code,
      errorPayload?.details,
    );
  }

  return payload as T;
}

export function apiPost<TResponse, TBody>(input: string, body: TBody) {
  return apiRequest<TResponse>(input, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
