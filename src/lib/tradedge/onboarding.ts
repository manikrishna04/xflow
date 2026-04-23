import type { ConnectedUserSnapshot, OnboardingRequirement } from "@/types/tradedge";
import type {
  XflowAccount,
  XflowAddress,
  XflowBalance,
  XflowPerson,
  XflowTransfer,
} from "@/types/xflow";

function isPresent(value: string | null | undefined) {
  return Boolean(value && value.trim());
}

export function normalizeConnectedUserStatus(status?: string | null) {
  if (!status) {
    return "draft";
  }

  return status.toLowerCase();
}

export function isConnectedUserActive(status?: string | null) {
  const normalized = normalizeConnectedUserStatus(status);
  return normalized === "activated" || normalized === "active";
}

export function canResumeActivation(status?: string | null) {
  const normalized = normalizeConnectedUserStatus(status);
  return normalized === "draft" || normalized === "input_required";
}

export function formatConnectedUserStatus(status?: string | null) {
  const normalized = normalizeConnectedUserStatus(status);

  if (normalized === "activated" || normalized === "active") {
    return "Active";
  }

  if (normalized === "input_required") {
    return "Required Information";
  }

  return normalized.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatOnboardingSectionLabel(section: OnboardingRequirement["section"]) {
  return section.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export type ConnectedUserBusinessTypeInput =
  | "individual"
  | "partnership"
  | "pvt_ltd"
  | "llp"
  | "sole_proprietorship";

export function toXflowBusinessType(value?: string | null) {
  switch (value) {
    case "individual":
      return "individual";
    case "partnership":
      return "partnership";
    case "llp":
      return "limited_liability_partnership";
    case "sole_proprietorship":
      return "sole_proprietor";
    case "pvt_ltd":
    default:
      return "company";
  }
}

export function fromXflowBusinessType(value?: string | null): ConnectedUserBusinessTypeInput {
  switch (value) {
    case "individual":
      return "individual";
    case "partnership":
      return "partnership";
    case "limited_liability_partnership":
      return "llp";
    case "sole_proprietor":
      return "sole_proprietorship";
    case "company":
    default:
      return "pvt_ltd";
  }
}

export function buildConnectedUserNickname(input: {
  accountId?: string | null;
  dba?: string | null;
  existingNickname?: string | null;
  legalName: string;
}) {
  if (isPresent(input.existingNickname)) {
    return input.existingNickname!.trim();
  }

  const base = (input.dba || input.legalName || "connected-user")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

  const suffixSeed = input.accountId || crypto.randomUUID();
  const suffix = suffixSeed.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toLowerCase();

  return suffix ? `${base || "connected-user"}-${suffix}` : base || "connected-user";
}

function countDirectors(persons: XflowPerson[]) {
  return persons.filter((person) => Boolean(person.relationship?.director)).length;
}

type PersonnelRelationshipHolder = Pick<XflowPerson, "relationship">;

type RequirementChecklistItem = {
  field: string;
  label: string;
  section: OnboardingRequirement["section"];
  satisfied: boolean;
};

function getCompanyPersonnelCoverage(persons: PersonnelRelationshipHolder[]) {
  return {
    director: persons.some((person) => Boolean(person.relationship?.director)),
    owner: persons.some((person) => Boolean(person.relationship?.owner)),
    representative: persons.some((person) => Boolean(person.relationship?.representative)),
  };
}

function getMissingCompanyPersonnelRoles(persons: PersonnelRelationshipHolder[]) {
  const coverage = getCompanyPersonnelCoverage(persons);

  return (["director", "owner", "representative"] as const).filter((role) => !coverage[role]);
}

export function validateCompanyPersonnelRequirement(
  account: XflowAccount,
  persons: PersonnelRelationshipHolder[],
) {
  const businessType = account.business_details?.type;
  const isCompanyType = businessType === "company";
  const missingRoles = isCompanyType ? getMissingCompanyPersonnelRoles(persons) : [];

  if (missingRoles.length > 0) {
    return {
      valid: false,
      error: `Company accounts must have at least one director, owner, and representative before activation. Missing: ${missingRoles.join(", ")}.`,
    };
  }

  return { valid: true, error: null };
}

function getOnboardingRequirementChecklist(
  account: XflowAccount,
  payoutAddresses: XflowAddress[],
  persons: XflowPerson[] = [],
): RequirementChecklistItem[] {
  const business = account.business_details;
  const address = business?.physical_address;
  const ids = business?.ids;
  const monthlyVolume = business?.estimated_monthly_volume?.amount;
  const purposeCodes = account.purpose_code ?? [];
  const directorCount = countDirectors(persons);
  const missingCompanyRoles =
    business?.type === "company" ? getMissingCompanyPersonnelRoles(persons) : [];

  const requirementMap: RequirementChecklistItem[] = [
    {
      field: "nickname",
      label: "Nickname",
      section: "basic_information",
      satisfied: isPresent(account.nickname),
    },
    {
      field: "business_details.dba",
      label: "Business display name",
      section: "basic_information",
      satisfied: isPresent(business?.dba),
    },
    {
      field: "business_details.legal_name",
      label: "Legal name",
      section: "basic_information",
      satisfied: isPresent(business?.legal_name),
    },
    {
      field: "business_details.email",
      label: "Business email",
      section: "basic_information",
      satisfied: isPresent(business?.email),
    },
    {
      field: "business_details.type",
      label: "Business type",
      section: "basic_information",
      satisfied: isPresent(business?.type),
    },
    {
      field: "business_details.date_of_incorporation",
      label: "Date of incorporation",
      section: "about_business",
      satisfied: isPresent(business?.date_of_incorporation),
    },
    {
      field: "business_details.website",
      label: "Website",
      section: "about_business",
      satisfied: isPresent(business?.website),
    },
    {
      field: "business_details.product_category",
      label: "Product category",
      section: "about_business",
      satisfied: isPresent(business?.product_category),
    },
    {
      field: "business_details.product_description",
      label: "Product description",
      section: "about_business",
      satisfied: isPresent(business?.product_description),
    },
    {
      field: "business_details.physical_address.line1",
      label: "Registered address line 1",
      section: "about_business",
      satisfied: isPresent(address?.line1),
    },
    {
      field: "business_details.physical_address.city",
      label: "Registered city",
      section: "about_business",
      satisfied: isPresent(address?.city),
    },
    {
      field: "business_details.physical_address.state",
      label: "Registered state",
      section: "about_business",
      satisfied: isPresent(address?.state),
    },
    {
      field: "business_details.physical_address.postal_code",
      label: "Registered postal code",
      section: "about_business",
      satisfied: isPresent(address?.postal_code),
    },
    {
      field: "business_details.physical_address.country",
      label: "Registered country",
      section: "about_business",
      satisfied: isPresent(address?.country),
    },
    {
      field: "business_details.ids.business",
      label: "Business registration id",
      section: "business_identifiers",
      satisfied: isPresent(ids?.business),
    },
    {
      field: "business_details.ids.tax",
      label: "PAN / tax id",
      section: "business_identifiers",
      satisfied: isPresent(ids?.tax),
    },
    {
      field: "business_details.ids.tax_gst",
      label: "GST number",
      section: "business_identifiers",
      satisfied: isPresent(ids?.tax_gst),
    },
    {
      field: "persons.director.1",
      label: "Primary director",
      section: "personnel_information",
      satisfied: directorCount >= 1,
    },
    {
      field: "persons.director.2",
      label: "Secondary director",
      section: "personnel_information",
      satisfied: directorCount >= 2,
    },
    {
      field: "address.user_payout",
      label: "Payout bank account",
      section: "bank_details",
      satisfied: payoutAddresses.length > 0,
    },
    {
      field: "business_details.merchant_category_code",
      label: "Merchant category code",
      section: "fees",
      satisfied: isPresent(business?.merchant_category_code),
    },
    {
      field: "business_details.merchant_size",
      label: "Merchant size",
      section: "fees",
      satisfied: isPresent(business?.merchant_size),
    },
    {
      field: "business_details.estimated_monthly_volume.amount",
      label: "Estimated monthly volume",
      section: "fees",
      satisfied: isPresent(monthlyVolume),
    },
    {
      field: "purpose_code",
      label: "Purpose code",
      section: "fees",
      satisfied: purposeCodes.length > 0,
    },
    {
      field: "tos_acceptance",
      label: "Terms of service acceptance",
      section: "summary_and_declaration",
      satisfied: Boolean(account.tos_acceptance?.time),
    },
  ];

  if (business?.type === "company") {
    requirementMap.push(
      {
        field: "persons.owner",
        label: "Account owner",
        section: "personnel_information",
        satisfied: !missingCompanyRoles.includes("owner"),
      },
      {
        field: "persons.representative",
        label: "Business representative",
        section: "personnel_information",
        satisfied: !missingCompanyRoles.includes("representative"),
      },
    );
  }

  return requirementMap;
}

export function getRequiredOnboardingItems(
  account: XflowAccount,
  payoutAddresses: XflowAddress[],
  persons: XflowPerson[] = [],
): OnboardingRequirement[] {
  const items: OnboardingRequirement[] = [];
  const requirementMap = getOnboardingRequirementChecklist(account, payoutAddresses, persons);

  for (const requirement of requirementMap) {
    if (!requirement.satisfied) {
      items.push({
        field: requirement.field,
        label: requirement.label,
        section: requirement.section,
      });
    }
  }

  return items;
}

export function buildConnectedUserSnapshot(
  account: XflowAccount,
  payoutAddresses: XflowAddress[],
  persons: XflowPerson[] = [],
  options?: {
    balance?: XflowBalance | null;
    recentTopups?: XflowTransfer[];
    topUpSourceAccountId?: string | null;
    treasuryWarning?: string | null;
  },
): ConnectedUserSnapshot {
  const requirementChecklist = getOnboardingRequirementChecklist(account, payoutAddresses, persons);
  const requiredItems = requirementChecklist
    .filter((requirement) => !requirement.satisfied)
    .map((requirement) => ({
      field: requirement.field,
      label: requirement.label,
      section: requirement.section,
    }));
  const total = requirementChecklist.length;
  const completed = Math.max(total - requiredItems.length, 0);

  return {
    account,
    balance: options?.balance ?? null,
    payoutAddresses,
    persons,
    progress: {
      completed,
      percent: Math.round((completed / total) * 100),
      total,
    },
    recentTopups: options?.recentTopups ?? [],
    requiredItems,
    statusLabel: formatConnectedUserStatus(account.status),
    topUpSourceAccountId: options?.topUpSourceAccountId ?? null,
    treasuryWarning: options?.treasuryWarning ?? null,
    transactionsEnabled: isConnectedUserActive(account.status),
  };
}
