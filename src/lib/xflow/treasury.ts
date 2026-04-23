import "server-only";

import { getXflowRuntimeConfig } from "@/lib/xflow/config";
import { xflowRequest } from "@/lib/xflow/client";
import type { XflowBalance, XflowTransfer } from "@/types/xflow";

type XflowListResponse<T> = {
  data: T[];
  has_next?: boolean;
  object?: string;
};

export type ConnectedUserTreasurySnapshot = {
  balance: XflowBalance | null;
  recentTopups: XflowTransfer[];
  topUpSourceAccountId: string | null;
  treasuryWarning: string | null;
};

export type CreateConnectedUserTopupInput = {
  amount: string;
  currency: string;
  description?: string;
  metadata?: Record<string, string>;
};

function getTopUpSourceAccountId() {
  return getXflowRuntimeConfig().parentAccountId ?? null;
}

function requireTopUpSourceAccountId(accountId: string) {
  const topUpSourceAccountId = getTopUpSourceAccountId();

  if (!topUpSourceAccountId) {
    throw new Error(
      "Set XFLOW_PARENT_ACCOUNT_ID or XFLOW_PLATFORM_ACCOUNT_ID before topping up a connected user.",
    );
  }

  if (topUpSourceAccountId === accountId) {
    throw new Error("The platform source account and connected user account cannot be the same.");
  }

  return topUpSourceAccountId;
}

export async function getConnectedUserTreasurySnapshot(
  accountId: string,
): Promise<ConnectedUserTreasurySnapshot> {
  const topUpSourceAccountId = getTopUpSourceAccountId();

  try {
    const [balance, recentTopupsResponse] = await Promise.all([
      xflowRequest<XflowBalance>("balance", {
        headers: {
          "Xflow-Account": accountId,
        },
      }),
      xflowRequest<XflowListResponse<XflowTransfer>>("transfers", {
        headers: {
          "Xflow-Account": accountId,
        },
        query: {
          limit: 5,
          "to.account_id": accountId,
          type: "platform_debit",
        },
      }),
    ]);

    return {
      balance,
      recentTopups: recentTopupsResponse.data,
      topUpSourceAccountId,
      treasuryWarning: null,
    };
  } catch (error) {
    return {
      balance: null,
      recentTopups: [],
      topUpSourceAccountId,
      treasuryWarning:
        error instanceof Error
          ? error.message
          : "Connected-user treasury data is temporarily unavailable.",
    };
  }
}

export async function createConnectedUserTopup(
  accountId: string,
  input: CreateConnectedUserTopupInput,
) {
  const topUpSourceAccountId = requireTopUpSourceAccountId(accountId);

  return xflowRequest<XflowTransfer>("transfers", {
    method: "POST",
    headers: {
      "Xflow-Account": accountId,
    },
    body: {
      ...(input.description ? { description: input.description } : {}),
      ...(input.metadata && Object.keys(input.metadata).length > 0
        ? { metadata: input.metadata }
        : {}),
      from: {
        account_id: topUpSourceAccountId,
        amount: input.amount,
        currency: input.currency,
      },
      to: {
        account_id: accountId,
        currency: input.currency,
      },
      type: "platform_debit",
    },
  });
}
