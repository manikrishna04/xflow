import "server-only";

import { getXflowRuntimeConfig } from "@/lib/xflow/config";
import { XflowApiError, xflowRequest } from "@/lib/xflow/client";
import type { XflowAccount } from "@/types/xflow";

type XflowListResponse<T> = {
  data: T[];
  has_next?: boolean;
};

type ReusableConnectedUserLookup = {
  businessType?: string | null;
  dba?: string | null;
  email: string;
  legalName: string;
};

function accountMatchesConfiguredParent(account: XflowAccount, parentAccountId?: string) {
  if (!parentAccountId) {
    return true;
  }

  return account.id === parentAccountId || account.parent_account_id === parentAccountId;
}

function normalizeComparableValue(value?: string | null) {
  return value?.trim().toLowerCase() || "";
}

function isReusableConnectedUserStatus(status?: string | null) {
  const normalizedStatus = normalizeComparableValue(status);

  return (
    normalizedStatus === "draft" ||
    normalizedStatus === "input_required" ||
    normalizedStatus === "verifying" ||
    normalizedStatus === "activated" ||
    normalizedStatus === "active"
  );
}

function getReusableStatusPriority(status?: string | null) {
  const normalizedStatus = normalizeComparableValue(status);

  switch (normalizedStatus) {
    case "activated":
    case "active":
      return 4;
    case "verifying":
      return 3;
    case "input_required":
      return 2;
    case "draft":
      return 1;
    default:
      return 0;
  }
}

function accountMatchesReusableIdentity(
  account: XflowAccount,
  lookup: ReusableConnectedUserLookup,
) {
  if (account.type !== "user" || !isReusableConnectedUserStatus(account.status)) {
    return false;
  }

  if (
    normalizeComparableValue(account.business_details?.email) !==
    normalizeComparableValue(lookup.email)
  ) {
    return false;
  }

  if (
    normalizeComparableValue(account.business_details?.legal_name) !==
    normalizeComparableValue(lookup.legalName)
  ) {
    return false;
  }

  if (
    lookup.businessType &&
    normalizeComparableValue(account.business_details?.type) !==
      normalizeComparableValue(lookup.businessType)
  ) {
    return false;
  }

  return true;
}

function choosePreferredReusableAccount(
  current: XflowAccount | null,
  candidate: XflowAccount,
  lookup: ReusableConnectedUserLookup,
) {
  if (!current) {
    return candidate;
  }

  const currentPriority = getReusableStatusPriority(current.status);
  const candidatePriority = getReusableStatusPriority(candidate.status);

  if (candidatePriority !== currentPriority) {
    return candidatePriority > currentPriority ? candidate : current;
  }

  const currentDbaMatch =
    normalizeComparableValue(current.business_details?.dba) === normalizeComparableValue(lookup.dba);
  const candidateDbaMatch =
    normalizeComparableValue(candidate.business_details?.dba) ===
    normalizeComparableValue(lookup.dba);

  if (candidateDbaMatch !== currentDbaMatch) {
    return candidateDbaMatch ? candidate : current;
  }

  return (candidate.created ?? 0) > (current.created ?? 0) ? candidate : current;
}

async function findAccountFromPlatformList(accountId: string) {
  const { parentAccountId } = getXflowRuntimeConfig();
  let startingAfter: string | undefined;

  for (let page = 0; page < 10; page += 1) {
    const response = await xflowRequest<XflowListResponse<XflowAccount>>("accounts", {
      query: {
        limit: 10,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      },
    });

    const match = response.data.find(
      (account) =>
        account.id === accountId && accountMatchesConfiguredParent(account, parentAccountId),
    );

    if (match) {
      return match;
    }

    if (!response.has_next || response.data.length === 0) {
      return null;
    }

    startingAfter = response.data.at(-1)?.id;
  }

  return null;
}

export async function findReusableConnectedUserAccount(
  lookup: ReusableConnectedUserLookup,
) {
  const { parentAccountId } = getXflowRuntimeConfig();
  let startingAfter: string | undefined;
  let bestMatch: XflowAccount | null = null;

  for (let page = 0; page < 20; page += 1) {
    const response = await xflowRequest<XflowListResponse<XflowAccount>>("accounts", {
      query: {
        limit: 10,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      },
    });

    for (const account of response.data) {
      if (
        accountMatchesConfiguredParent(account, parentAccountId) &&
        accountMatchesReusableIdentity(account, lookup)
      ) {
        bestMatch = choosePreferredReusableAccount(bestMatch, account, lookup);
      }
    }

    if (!response.has_next || response.data.length === 0) {
      return bestMatch;
    }

    startingAfter = response.data.at(-1)?.id;
  }

  return bestMatch;
}

export async function getXflowAccount(accountId: string) {
  try {
    return await xflowRequest<XflowAccount>(`accounts/${accountId}`);
  } catch (error) {
    if (
      error instanceof XflowApiError &&
      error.status === 404 &&
      error.details?.errors?.[0]?.code === "object_not_found"
    ) {
      const fallbackAccount = await findAccountFromPlatformList(accountId);

      if (fallbackAccount) {
        return fallbackAccount;
      }
    }

    throw error;
  }
}
