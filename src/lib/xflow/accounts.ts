import "server-only";

import { getXflowRuntimeConfig } from "@/lib/xflow/config";
import { XflowApiError, xflowRequest } from "@/lib/xflow/client";
import type { XflowAccount } from "@/types/xflow";

type XflowListResponse<T> = {
  data: T[];
  has_next?: boolean;
};

function accountMatchesConfiguredParent(account: XflowAccount, parentAccountId?: string) {
  if (!parentAccountId) {
    return true;
  }

  return account.id === parentAccountId || account.parent_account_id === parentAccountId;
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
