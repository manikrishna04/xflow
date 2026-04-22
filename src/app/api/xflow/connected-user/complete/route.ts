import { NextRequest, NextResponse } from "next/server";

import {
  buildConnectedUserNickname,
  buildConnectedUserSnapshot,
  formatConnectedUserStatus,
  isConnectedUserActive,
  normalizeConnectedUserStatus,
  toXflowBusinessType,
  validateCompanyPersonnelRequirement,
} from "@/lib/tradedge/onboarding";
import { multiStepOnboardingSchema } from "@/lib/tradedge/schemas";
import { findReusableConnectedUserAccount, getXflowAccount } from "@/lib/xflow/accounts";
import { xflowRequest } from "@/lib/xflow/client";
import { xflowRouteErrorResponse } from "@/lib/xflow/route-error";
import type { XflowAccount, XflowAddress, XflowPerson } from "@/types/xflow";

type XflowListResponse<T> = {
  data: T[];
};

type DesiredPersonPayload = ReturnType<typeof buildPersonPayload> & {
  roleLabel: string;
};

function canEditConnectedUserAccount(status?: string | null) {
  const normalizedStatus = normalizeComparableValue(status);
  return normalizedStatus === "" || normalizedStatus === "draft" || normalizedStatus === "input_required";
}

function buildPersonPayload(
  person: { fullName: string; pan: string },
  options: { businessType: string; isPrimaryDirector: boolean },
) {
  const isCompanyType = options.businessType === "company";

  return {
    full_name: person.fullName,
    relationship: {
      director: true,
      ...(options.isPrimaryDirector ? { representative: true } : {}),
      ...(isCompanyType && options.isPrimaryDirector ? { owner: true } : {}),
    },
    supporting_ids: {
      tax: person.pan,
    },
  };
}

function normalizeComparableValue(value?: string | null) {
  return value?.trim().toLowerCase() || "";
}

function isUpdatablePerson(person: XflowPerson) {
  return normalizeComparableValue(person.status) === "unverified";
}

function personMatchesIdentity(existingPerson: XflowPerson, desiredPerson: DesiredPersonPayload) {
  return (
    normalizeComparableValue(existingPerson.full_name) ===
      normalizeComparableValue(desiredPerson.full_name) &&
    normalizeComparableValue(existingPerson.supporting_ids?.tax) ===
      normalizeComparableValue(desiredPerson.supporting_ids.tax)
  );
}

function personMatchesRelationships(
  existingPerson: XflowPerson,
  desiredPerson: DesiredPersonPayload,
) {
  return (
    Boolean(existingPerson.relationship?.director) ===
      Boolean(desiredPerson.relationship.director) &&
    Boolean(existingPerson.relationship?.owner) === Boolean(desiredPerson.relationship.owner) &&
    Boolean(existingPerson.relationship?.representative) ===
      Boolean(desiredPerson.relationship.representative)
  );
}

function findExistingPersonForDesiredPayload(
  desiredPerson: DesiredPersonPayload,
  existingPeople: XflowPerson[],
  usedPersonIds: Set<string>,
) {
  const availablePeople = existingPeople.filter((person) => !usedPersonIds.has(person.id));
  const desiredTax = normalizeComparableValue(desiredPerson.supporting_ids.tax);
  const desiredName = normalizeComparableValue(desiredPerson.full_name);

  if (desiredTax) {
    const taxMatch = availablePeople.find(
      (person) => normalizeComparableValue(person.supporting_ids?.tax) === desiredTax,
    );

    if (taxMatch) {
      return taxMatch;
    }
  }

  if (desiredName) {
    const nameMatch = availablePeople.find(
      (person) => normalizeComparableValue(person.full_name) === desiredName,
    );

    if (nameMatch) {
      return nameMatch;
    }
  }

  if (desiredPerson.relationship.representative) {
    return (
      availablePeople.find((person) => Boolean(person.relationship?.representative)) ||
      availablePeople.find((person) => Boolean(person.relationship?.owner)) ||
      null
    );
  }

  return (
    availablePeople.find(
      (person) =>
        Boolean(person.relationship?.director) && !Boolean(person.relationship?.representative),
    ) || null
  );
}

export async function POST(request: NextRequest) {
  try {
    const parsed = multiStepOnboardingSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid connected-user onboarding payload." },
        { status: 400 },
      );
    }

    const input = parsed.data;
    const xflowBusinessType = toXflowBusinessType(input.basicInfo.businessType);
    const ipHeader =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";
    const ip = ipHeader.split(",")[0]?.trim() || "127.0.0.1";

    let accountId = input.existingAccountId;
    let currentAccount: XflowAccount;

    if (accountId) {
      currentAccount = await getXflowAccount(accountId);
    } else {
      const reusableAccount =
        (await findReusableConnectedUserAccount({
          businessType: xflowBusinessType,
          dba: input.basicInfo.dba,
          email: input.basicInfo.email,
          legalName: input.basicInfo.legalName,
        })) ?? null;

      if (reusableAccount) {
        accountId = reusableAccount.id;
        currentAccount = reusableAccount;
      } else {
        const createdAccount = await xflowRequest<XflowAccount>("accounts", {
          method: "POST",
          body: {
            business_details: {
              dba: input.basicInfo.dba,
              email: input.basicInfo.email,
              legal_name: input.basicInfo.legalName,
              physical_address: {
                country: input.aboutBusiness.registeredAddress.country,
              },
              type: xflowBusinessType,
            },
            nickname: buildConnectedUserNickname({
              dba: input.basicInfo.dba,
              legalName: input.basicInfo.legalName,
            }),
            type: "user",
          },
        });

        accountId = createdAccount.id;
        currentAccount = createdAccount;
      }
    }

    if (!canEditConnectedUserAccount(currentAccount.status)) {
      const [account, payoutAddressesResponse, peopleResponse] = await Promise.all([
        getXflowAccount(accountId),
        xflowRequest<XflowListResponse<XflowAddress>>("addresses", {
          headers: {
            "Xflow-Account": accountId,
          },
          query: {
            category: "user_payout",
            linked_id: accountId,
          },
        }),
        xflowRequest<XflowListResponse<XflowPerson>>("persons", {
          headers: {
            "Xflow-Account": accountId,
          },
        }),
      ]);

      return NextResponse.json({
        ...buildConnectedUserSnapshot(account, payoutAddressesResponse.data, peopleResponse.data),
        statusMessage: `Connected user is already ${formatConnectedUserStatus(account.status)}. Editing is locked for this Xflow account state.`,
      });
    }

    const nickname = buildConnectedUserNickname({
      accountId,
      dba: input.basicInfo.dba,
      existingNickname: currentAccount.nickname,
      legalName: input.basicInfo.legalName,
    });

    await xflowRequest<XflowAccount>(`accounts/${accountId}`, {
      method: "POST",
      headers: {
        "Xflow-Account": accountId,
      },
      body: {
        business_details: {
          ...(currentAccount.business_details ?? {}),
          date_of_incorporation: input.aboutBusiness.dateOfIncorporation,
          dba: input.basicInfo.dba,
          email: input.basicInfo.email,
          estimated_monthly_volume: {
            amount: input.fees.estimatedMonthlyVolume,
            currency: "USD",
          },
          ids: {
            ...(currentAccount.business_details?.ids ?? {}),
            business: input.businessIdentifiers.businessId,
            tax: input.businessIdentifiers.pan,
            tax_gst: input.businessIdentifiers.gst,
          },
          legal_name: input.basicInfo.legalName,
          merchant_category_code: input.fees.merchantCategoryCode,
          merchant_size: input.fees.merchantSize,
          physical_address: {
            ...(currentAccount.business_details?.physical_address ?? {}),
            city: input.aboutBusiness.registeredAddress.city,
            country: input.aboutBusiness.registeredAddress.country,
            line1: input.aboutBusiness.registeredAddress.line1,
            postal_code: input.aboutBusiness.registeredAddress.postalCode,
            state: input.aboutBusiness.registeredAddress.state,
          },
          product_category: input.aboutBusiness.productCategory,
          product_description: input.aboutBusiness.productDescription,
          type: xflowBusinessType,
          website: input.aboutBusiness.website,
        },
        nickname,
        purpose_code: input.fees.purposeCodes.map((code) => ({ code })),
        tos_acceptance: {
          ip,
          time: Math.floor(Date.now() / 1000),
          user_agent: request.headers.get("user-agent") || "TradEdge Sandbox",
        },
      },
    });

    const peopleResponse = await xflowRequest<XflowListResponse<XflowPerson>>("persons", {
      headers: {
        "Xflow-Account": accountId,
      },
    });

    const desiredPeople = [
      {
        ...buildPersonPayload(input.personalInfo.primaryDirector, {
          businessType: xflowBusinessType,
          isPrimaryDirector: true,
        }),
        roleLabel: "primary director",
      },
      {
        ...buildPersonPayload(input.personalInfo.secondaryDirector, {
          businessType: xflowBusinessType,
          isPrimaryDirector: false,
        }),
        roleLabel: "secondary director",
      },
    ];

    const personnelValidation = validateCompanyPersonnelRequirement(
      {
        ...currentAccount,
        business_details: {
          ...(currentAccount.business_details ?? {}),
          type: xflowBusinessType,
        },
      },
      desiredPeople.map((person, index) => ({
        id: `pending-person-${index}`,
        relationship: person.relationship,
      })),
    );

    if (!personnelValidation.valid) {
      return NextResponse.json({ message: personnelValidation.error }, { status: 400 });
    }

    const usedPersonIds = new Set<string>();
    const personMutations: Array<Promise<XflowPerson>> = [];

    for (const person of desiredPeople) {
      const { roleLabel, ...personPayload } = person;
      const existingPerson = findExistingPersonForDesiredPayload(
        person,
        peopleResponse.data,
        usedPersonIds,
      );

      if (existingPerson) {
        usedPersonIds.add(existingPerson.id);

        if (!isUpdatablePerson(existingPerson)) {
          if (
            !personMatchesIdentity(existingPerson, person) ||
            !personMatchesRelationships(existingPerson, person)
          ) {
            return NextResponse.json(
              {
                message: `The ${roleLabel} already exists in Xflow as a verified person and cannot be updated. Start a new connected-user account if you need to change this person.`,
              },
              { status: 400 },
            );
          }

          continue;
        }

        personMutations.push(
          xflowRequest<XflowPerson>(`persons/${existingPerson.id}`, {
            method: "POST",
            headers: {
              "Xflow-Account": accountId,
            },
            body: personPayload,
          }),
        );
        continue;
      }

      personMutations.push(
        xflowRequest<XflowPerson>("persons", {
          method: "POST",
          headers: {
            "Xflow-Account": accountId,
          },
          body: personPayload,
        }),
      );
    }

    await Promise.all(personMutations);

    const payoutAddressesResponse = await xflowRequest<XflowListResponse<XflowAddress>>("addresses", {
      headers: {
        "Xflow-Account": accountId,
      },
      query: {
        category: "user_payout",
        linked_id: accountId,
      },
    });

    if (payoutAddressesResponse.data.length === 0) {
      await xflowRequest<XflowAddress>("addresses", {
        method: "POST",
        headers: {
          "Xflow-Account": accountId,
        },
        body: {
          bank_account: {
            domestic_credit: input.bankDetails.ifsc,
            number: input.bankDetails.accountNumber,
            type: "domestic_credit",
          },
          billing_details: {
            city: input.bankDetails.city,
            country: input.aboutBusiness.registeredAddress.country,
            line1: input.bankDetails.line1,
            postal_code: input.bankDetails.postalCode,
            state: input.bankDetails.state,
          },
          category: "user_payout",
          currency: "INR",
          linked_id: accountId,
          linked_object: "account",
          name: input.bankDetails.accountHolderName,
          type: "bank_account",
        },
      });
    }

    const latestAccount = await getXflowAccount(accountId);
    const normalizedStatus = normalizeConnectedUserStatus(latestAccount.status);

    if (!isConnectedUserActive(normalizedStatus) && normalizedStatus !== "verifying") {
      await xflowRequest(`accounts/${accountId}/activate`, {
        method: "POST",
        headers: {
          "Xflow-Account": accountId,
        },
      });
    }

    const [account, refreshedPayoutAddressesResponse, refreshedPeopleResponse] = await Promise.all([
      getXflowAccount(accountId),
      xflowRequest<XflowListResponse<XflowAddress>>("addresses", {
        headers: {
          "Xflow-Account": accountId,
        },
        query: {
          category: "user_payout",
          linked_id: accountId,
        },
      }),
      xflowRequest<XflowListResponse<XflowPerson>>("persons", {
        headers: {
          "Xflow-Account": accountId,
        },
      }),
    ]);

    return NextResponse.json({
      ...buildConnectedUserSnapshot(
        account,
        refreshedPayoutAddressesResponse.data,
        refreshedPeopleResponse.data,
      ),
      statusMessage: `Connected user is now ${formatConnectedUserStatus(account.status)}.`,
    });
  } catch (error) {
    return xflowRouteErrorResponse(error);
  }
}
