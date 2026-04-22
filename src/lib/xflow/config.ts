import "server-only";

export type XflowRuntimeConfig = {
  baseUrl: string;
  parentAccountId?: string;
  isConfigured: boolean;
  isTestMode: boolean;
  secretKey: string;
};

function normalizeBaseUrl(rawBaseUrl: string) {
  const trimmed = rawBaseUrl.trim().replace(/\/+$/, "");

  if (/\/v\d+$/.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed}/v1`;
}

export function getXflowRuntimeConfig(): XflowRuntimeConfig {
  const secretKey = process.env.XFLOW_SECRET_KEY?.trim() ?? "";
  const baseUrl = normalizeBaseUrl(
    process.env.XFLOW_API_BASE?.trim() || "https://api.xflowpay.com/v1",
  );
  const parentAccountId =
    process.env.XFLOW_PARENT_ACCOUNT_ID?.trim() ||
    process.env.XFLOW_PLATFORM_ACCOUNT_ID?.trim() ||
    "";

  return {
    baseUrl,
    isConfigured: Boolean(secretKey),
    isTestMode: secretKey.startsWith("sk_test_"),
    parentAccountId: parentAccountId || undefined,
    secretKey,
  };
}

export function requireXflowSecretKey() {
  const config = getXflowRuntimeConfig();

  if (!config.secretKey) {
    throw new Error(
      "Missing Xflow configuration. Add XFLOW_SECRET_KEY to your environment before using the tester.",
    );
  }

  return config;
}
