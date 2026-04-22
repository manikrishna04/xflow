"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePurposeCodesQuery } from "@/lib/hooks/use-tradedge-actions";
import { COMMON_PURPOSE_CODES_BY_PRODUCT_CATEGORY } from "@/lib/tradedge/purpose-codes";
import {
  multiStepOnboardingSchema,
  onboardingAboutBusinessSchema,
  onboardingBankDetailsSchema,
  onboardingBasicInfoSchema,
  onboardingBusinessIdentifiersSchema,
  onboardingFeesSchema,
  onboardingPersonalInfoSchema,
  onboardingSummarySchema,
} from "@/lib/tradedge/schemas";
import type { z } from "zod";

type OnboardingSubmitData = z.infer<typeof multiStepOnboardingSchema>;

type OnboardingFormData = {
  existingAccountId?: string;
  aboutBusiness: {
    dateOfIncorporation: string;
    productCategory: "goods" | "services" | "software";
    productDescription: string;
    registeredAddress: {
      city: string;
      country: string;
      line1: string;
      postalCode: string;
      state: string;
    };
    website: string;
  };
  bankDetails: {
    accountHolderName: string;
    accountNumber: string;
    city: string;
    ifsc: string;
    line1: string;
    postalCode: string;
    state: string;
  };
  basicInfo: {
    businessType: "individual" | "partnership" | "pvt_ltd" | "llp" | "sole_proprietorship";
    dba: string;
    email: string;
    legalName: string;
  };
  businessIdentifiers: {
    businessId: string;
    gst: string;
    pan: string;
  };
  fees: {
    estimatedMonthlyVolume: string;
    merchantCategoryCode: string;
    merchantSize: "small" | "medium" | "large" | "enterprise";
    purposeCodes: string[];
  };
  personalInfo: {
    primaryDirector: {
      fullName: string;
      pan: string;
    };
    secondaryDirector: {
      fullName: string;
      pan: string;
    };
  };
  summary: {
    dataAccuracy: boolean;
    termsAccepted: boolean;
  };
};

const STEPS = [
  {
    id: 1,
    title: "Basic Information",
    description: "Email, business type, and customer-facing business name.",
  },
  {
    id: 2,
    title: "About Your Business",
    description: "Business activity, incorporation details, and registered address.",
  },
  {
    id: 3,
    title: "Business Identifiers",
    description: "Business registration, PAN, and GST details.",
  },
  {
    id: 4,
    title: "Personnel Information",
    description:
      "Two director entries for the connected-user account. For company accounts, the primary director is also submitted as the owner and representative.",
  },
  {
    id: 5,
    title: "Bank Details",
    description: "Payout bank details for the connected user.",
  },
  {
    id: 6,
    title: "Fees",
    description: "Merchant profile details and purpose codes required for activation.",
  },
  {
    id: 7,
    title: "Summary and Declaration",
    description: "Review the data and capture declaration acceptance.",
  },
] as const;

const DEFAULT_FORM_DATA: OnboardingFormData = {
  aboutBusiness: {
    dateOfIncorporation: "",
    productCategory: "services",
    productDescription: "",
    registeredAddress: {
      city: "",
      country: "IN",
      line1: "",
      postalCode: "",
      state: "",
    },
    website: "",
  },
  bankDetails: {
    accountHolderName: "",
    accountNumber: "",
    city: "",
    ifsc: "",
    line1: "",
    postalCode: "",
    state: "",
  },
  basicInfo: {
    businessType: "pvt_ltd",
    dba: "",
    email: "",
    legalName: "",
  },
  businessIdentifiers: {
    businessId: "",
    gst: "",
    pan: "",
  },
  fees: {
    estimatedMonthlyVolume: "",
    merchantCategoryCode: "",
    merchantSize: "small",
    purposeCodes: [],
  },
  personalInfo: {
    primaryDirector: {
      fullName: "",
      pan: "",
    },
    secondaryDirector: {
      fullName: "",
      pan: "",
    },
  },
  summary: {
    dataAccuracy: false,
    termsAccepted: false,
  },
};

interface ConnectedUserOnboardingScreenProps {
  initialData?: Partial<OnboardingFormData>;
  isLoading?: boolean;
  onSubmit: (data: OnboardingSubmitData) => Promise<void>;
  submitLabel?: string;
}

function mergeInitialData(initialData?: Partial<OnboardingFormData>): OnboardingFormData {
  return {
    ...DEFAULT_FORM_DATA,
    ...initialData,
    aboutBusiness: {
      ...DEFAULT_FORM_DATA.aboutBusiness,
      ...initialData?.aboutBusiness,
      registeredAddress: {
        ...DEFAULT_FORM_DATA.aboutBusiness.registeredAddress,
        ...initialData?.aboutBusiness?.registeredAddress,
      },
    },
    bankDetails: {
      ...DEFAULT_FORM_DATA.bankDetails,
      ...initialData?.bankDetails,
    },
    basicInfo: {
      ...DEFAULT_FORM_DATA.basicInfo,
      ...initialData?.basicInfo,
    },
    businessIdentifiers: {
      ...DEFAULT_FORM_DATA.businessIdentifiers,
      ...initialData?.businessIdentifiers,
    },
    fees: {
      ...DEFAULT_FORM_DATA.fees,
      ...initialData?.fees,
    },
    personalInfo: {
      primaryDirector: {
        ...DEFAULT_FORM_DATA.personalInfo.primaryDirector,
        ...initialData?.personalInfo?.primaryDirector,
      },
      secondaryDirector: {
        ...DEFAULT_FORM_DATA.personalInfo.secondaryDirector,
        ...initialData?.personalInfo?.secondaryDirector,
      },
    },
    summary: {
      ...DEFAULT_FORM_DATA.summary,
      ...initialData?.summary,
    },
  };
}

function issuesToErrorMap(issues: Array<{ message: string; path: PropertyKey[] }>) {
  const nextErrors: Record<string, string> = {};

  for (const issue of issues) {
    nextErrors[issue.path.join(".")] = issue.message;
  }

  return nextErrors;
}

export function ConnectedUserOnboardingScreen({
  initialData,
  isLoading = false,
  onSubmit,
  submitLabel = "Create Connected User",
}: ConnectedUserOnboardingScreenProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [formData, setFormData] = useState<OnboardingFormData>(() => mergeInitialData(initialData));
  const purposeCodesQuery = usePurposeCodesQuery();
  const purposeCodeOptions = purposeCodesQuery.data ?? [];
  const recommendedPurposeCodeSet = new Set<string>(
    COMMON_PURPOSE_CODES_BY_PRODUCT_CATEGORY[formData.aboutBusiness.productCategory],
  );
  const recommendedPurposeCodes = purposeCodeOptions.filter((option) =>
    recommendedPurposeCodeSet.has(option.code),
  );

  const getError = (path: string) => errors[path];

  const validateCurrentStep = () => {
    if (currentStep === 1) {
      const result = onboardingBasicInfoSchema.safeParse(formData.basicInfo);

      if (!result.success) {
        setErrors(issuesToErrorMap(result.error.issues));
        return false;
      }
    }

    if (currentStep === 2) {
      const result = onboardingAboutBusinessSchema.safeParse(formData.aboutBusiness);

      if (!result.success) {
        setErrors(issuesToErrorMap(result.error.issues));
        return false;
      }
    }

    if (currentStep === 3) {
      const result = onboardingBusinessIdentifiersSchema.safeParse(formData.businessIdentifiers);

      if (!result.success) {
        setErrors(issuesToErrorMap(result.error.issues));
        return false;
      }
    }

    if (currentStep === 4) {
      const result = onboardingPersonalInfoSchema.safeParse(formData.personalInfo);

      if (!result.success) {
        setErrors(issuesToErrorMap(result.error.issues));
        return false;
      }
    }

    if (currentStep === 5) {
      const result = onboardingBankDetailsSchema.safeParse(formData.bankDetails);

      if (!result.success) {
        setErrors(issuesToErrorMap(result.error.issues));
        return false;
      }
    }

    if (currentStep === 6) {
      const result = onboardingFeesSchema.safeParse(formData.fees);

      if (!result.success) {
        setErrors(issuesToErrorMap(result.error.issues));
        return false;
      }
    }

    if (currentStep === 7) {
      const result = onboardingSummarySchema.safeParse(formData.summary);

      if (!result.success) {
        setErrors(issuesToErrorMap(result.error.issues));
        return false;
      }
    }

    setErrors({});
    return true;
  };

  const handleNext = async () => {
    setSubmitError("");

    if (!validateCurrentStep()) {
      return;
    }

    if (currentStep < STEPS.length) {
      setCurrentStep((step) => step + 1);
      return;
    }

    const result = multiStepOnboardingSchema.safeParse(formData);

    if (!result.success) {
      setErrors(issuesToErrorMap(result.error.issues));
      return;
    }

    try {
      await onSubmit(result.data);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not submit connected-user onboarding.",
      );
    }
  };

  const updateBasicInfo = (field: keyof OnboardingFormData["basicInfo"], value: string) => {
    setFormData((current) => ({
      ...current,
      basicInfo: {
        ...current.basicInfo,
        [field]: value,
      },
    }));
  };

  const updateAboutBusiness = (
    field: Exclude<keyof OnboardingFormData["aboutBusiness"], "registeredAddress">,
    value: string,
  ) => {
    setFormData((current) => ({
      ...current,
      aboutBusiness: {
        ...current.aboutBusiness,
        [field]: value,
      },
    }));
  };

  const updateRegisteredAddress = (
    field: keyof OnboardingFormData["aboutBusiness"]["registeredAddress"],
    value: string,
  ) => {
    setFormData((current) => ({
      ...current,
      aboutBusiness: {
        ...current.aboutBusiness,
        registeredAddress: {
          ...current.aboutBusiness.registeredAddress,
          [field]: field === "country" ? value.toUpperCase() : value,
        },
      },
    }));
  };

  const updateBusinessIdentifiers = (
    field: keyof OnboardingFormData["businessIdentifiers"],
    value: string,
  ) => {
    setFormData((current) => ({
      ...current,
      businessIdentifiers: {
        ...current.businessIdentifiers,
        [field]: value,
      },
    }));
  };

  const updateDirector = (
    director: keyof OnboardingFormData["personalInfo"],
    field: keyof OnboardingFormData["personalInfo"]["primaryDirector"],
    value: string,
  ) => {
    setFormData((current) => ({
      ...current,
      personalInfo: {
        ...current.personalInfo,
        [director]: {
          ...current.personalInfo[director],
          [field]: value,
        },
      },
    }));
  };

  const updateBankDetails = (
    field: keyof OnboardingFormData["bankDetails"],
    value: string,
  ) => {
    setFormData((current) => ({
      ...current,
      bankDetails: {
        ...current.bankDetails,
        [field]: value,
      },
    }));
  };

  const updateFees = (
    field: Exclude<keyof OnboardingFormData["fees"], "purposeCodes">,
    value: string,
  ) => {
    setFormData((current) => ({
      ...current,
      fees: {
        ...current.fees,
        [field]: value,
      },
    }));
  };

  const togglePurposeCode = (code: string) => {
    setFormData((current) => {
      const nextPurposeCodes = current.fees.purposeCodes.includes(code)
        ? current.fees.purposeCodes.filter((value) => value !== code)
        : [...current.fees.purposeCodes, code];

      return {
        ...current,
        fees: {
          ...current.fees,
          purposeCodes: nextPurposeCodes,
        },
      };
    });

    setErrors((current) => {
      if (!current.purposeCodes) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors.purposeCodes;
      return nextErrors;
    });
  };

  const updateSummary = (field: keyof OnboardingFormData["summary"], value: boolean) => {
    setFormData((current) => ({
      ...current,
      summary: {
        ...current.summary,
        [field]: value,
      },
    }));
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max items-center gap-3">
          {STEPS.map((step, index) => {
            const completed = step.id < currentStep;
            const active = step.id === currentStep;

            return (
              <div key={step.id} className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (step.id <= currentStep) {
                      setCurrentStep(step.id);
                      setErrors({});
                      setSubmitError("");
                    }
                  }}
                  className={`inline-flex items-center gap-3 rounded-full border px-4 py-2 text-left transition ${
                    active
                      ? "border-primary bg-primary/8 text-primary"
                      : completed
                        ? "border-[rgba(34,139,92,0.28)] bg-[rgba(34,139,92,0.08)] text-[rgb(34,139,92)]"
                        : "border-black/10 bg-white text-foreground/55"
                  }`}
                >
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                      active
                        ? "bg-primary text-white"
                        : completed
                          ? "bg-[rgb(34,139,92)] text-white"
                          : "bg-black/[0.06] text-foreground/55"
                    }`}
                  >
                    {step.id}
                  </span>
                  <span className="text-sm font-semibold">{step.title}</span>
                </button>
                {index < STEPS.length - 1 ? (
                  <div className="hidden h-px w-8 bg-black/10 md:block" />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8 rounded-[28px] border border-black/8 bg-white/80 p-6 md:p-8">
        <p className="data-kicker">{STEPS[currentStep - 1]?.title}</p>
        <h2 className="mt-3 text-3xl font-semibold">{STEPS[currentStep - 1]?.title}</h2>
        <p className="mt-2 text-sm leading-7 text-foreground/66">
          {STEPS[currentStep - 1]?.description}
        </p>

        <div className="mt-8 space-y-5">
          {currentStep === 1 ? (
            <>
              <div>
                <Label htmlFor="basicEmail">Business Email</Label>
                <Input
                  id="basicEmail"
                  type="email"
                  placeholder="ops@company.com"
                  value={formData.basicInfo.email}
                  onChange={(event) => updateBasicInfo("email", event.target.value)}
                />
                {getError("email") ? (
                  <p className="mt-1 text-sm text-[rgb(190,51,51)]">{getError("email")}</p>
                ) : null}
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <Label htmlFor="businessType">Business Type</Label>
                  <Select
                    id="businessType"
                    value={formData.basicInfo.businessType}
                    onChange={(event) => updateBasicInfo("businessType", event.target.value)}
                  >
                    <option value="individual">Individual</option>
                    <option value="partnership">Partnership</option>
                    <option value="pvt_ltd">Pvt Ltd</option>
                    <option value="llp">LLP</option>
                    <option value="sole_proprietorship">Sole Proprietorship</option>
                  </Select>
                  {getError("businessType") ? (
                    <p className="mt-1 text-sm text-[rgb(190,51,51)]">
                      {getError("businessType")}
                    </p>
                  ) : null}
                </div>
                <div>
                  <Label htmlFor="basicDba">Brand Name / Name on Invoice</Label>
                  <Input
                    id="basicDba"
                    placeholder="TradEdge Exports"
                    value={formData.basicInfo.dba}
                    onChange={(event) => updateBasicInfo("dba", event.target.value)}
                  />
                  {getError("dba") ? (
                    <p className="mt-1 text-sm text-[rgb(190,51,51)]">{getError("dba")}</p>
                  ) : null}
                </div>
              </div>

              <div>
                <Label htmlFor="basicLegalName">Business Legal Name</Label>
                <Input
                  id="basicLegalName"
                  placeholder="TradEdge Exports Private Limited"
                  value={formData.basicInfo.legalName}
                  onChange={(event) => updateBasicInfo("legalName", event.target.value)}
                />
                {getError("legalName") ? (
                  <p className="mt-1 text-sm text-[rgb(190,51,51)]">{getError("legalName")}</p>
                ) : null}
              </div>
            </>
          ) : null}

          {currentStep === 2 ? (
            <>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <Label htmlFor="businessWebsite">Website URL</Label>
                  <Input
                    id="businessWebsite"
                    type="url"
                    placeholder="https://www.company.com"
                    value={formData.aboutBusiness.website}
                    onChange={(event) => updateAboutBusiness("website", event.target.value)}
                  />
                  {getError("website") ? (
                    <p className="mt-1 text-sm text-[rgb(190,51,51)]">{getError("website")}</p>
                  ) : null}
                </div>
                <div>
                  <Label htmlFor="dateOfIncorporation">Date of Incorporation</Label>
                  <Input
                    id="dateOfIncorporation"
                    type="date"
                    value={formData.aboutBusiness.dateOfIncorporation}
                    onChange={(event) =>
                      updateAboutBusiness("dateOfIncorporation", event.target.value)
                    }
                  />
                  {getError("dateOfIncorporation") ? (
                    <p className="mt-1 text-sm text-[rgb(190,51,51)]">
                      {getError("dateOfIncorporation")}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <Label htmlFor="productCategory">Product Category</Label>
                  <Select
                    id="productCategory"
                    value={formData.aboutBusiness.productCategory}
                    onChange={(event) => updateAboutBusiness("productCategory", event.target.value)}
                  >
                    <option value="goods">Goods</option>
                    <option value="services">Services</option>
                    <option value="software">Software</option>
                  </Select>
                  {getError("productCategory") ? (
                    <p className="mt-1 text-sm text-[rgb(190,51,51)]">
                      {getError("productCategory")}
                    </p>
                  ) : null}
                </div>
                <div>
                  <Label htmlFor="registeredCountry">Registered Country Code</Label>
                  <Input
                    id="registeredCountry"
                    maxLength={2}
                    value={formData.aboutBusiness.registeredAddress.country}
                    onChange={(event) =>
                      updateRegisteredAddress("country", event.target.value.toUpperCase())
                    }
                  />
                  {getError("registeredAddress.country") ? (
                    <p className="mt-1 text-sm text-[rgb(190,51,51)]">
                      {getError("registeredAddress.country")}
                    </p>
                  ) : null}
                </div>
              </div>

              <div>
                <Label htmlFor="productDescription">Product Description</Label>
                <Textarea
                  id="productDescription"
                  placeholder="Describe what the business exports or sells."
                  value={formData.aboutBusiness.productDescription}
                  onChange={(event) =>
                    updateAboutBusiness("productDescription", event.target.value)
                  }
                />
                {getError("productDescription") ? (
                  <p className="mt-1 text-sm text-[rgb(190,51,51)]">
                    {getError("productDescription")}
                  </p>
                ) : null}
              </div>

              <div className="rounded-[24px] bg-black/[0.03] p-5">
                <p className="text-sm font-semibold text-foreground">Registered Address</p>
                <div className="mt-4 grid gap-5 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Label htmlFor="registeredLine1">Address Line 1</Label>
                    <Input
                      id="registeredLine1"
                      value={formData.aboutBusiness.registeredAddress.line1}
                      onChange={(event) => updateRegisteredAddress("line1", event.target.value)}
                    />
                    {getError("registeredAddress.line1") ? (
                      <p className="mt-1 text-sm text-[rgb(190,51,51)]">
                        {getError("registeredAddress.line1")}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <Label htmlFor="registeredCity">City</Label>
                    <Input
                      id="registeredCity"
                      value={formData.aboutBusiness.registeredAddress.city}
                      onChange={(event) => updateRegisteredAddress("city", event.target.value)}
                    />
                    {getError("registeredAddress.city") ? (
                      <p className="mt-1 text-sm text-[rgb(190,51,51)]">
                        {getError("registeredAddress.city")}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <Label htmlFor="registeredState">State</Label>
                    <Input
                      id="registeredState"
                      value={formData.aboutBusiness.registeredAddress.state}
                      onChange={(event) => updateRegisteredAddress("state", event.target.value)}
                    />
                    {getError("registeredAddress.state") ? (
                      <p className="mt-1 text-sm text-[rgb(190,51,51)]">
                        {getError("registeredAddress.state")}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <Label htmlFor="registeredPostalCode">Postal Code</Label>
                    <Input
                      id="registeredPostalCode"
                      value={formData.aboutBusiness.registeredAddress.postalCode}
                      onChange={(event) =>
                        updateRegisteredAddress("postalCode", event.target.value)
                      }
                    />
                    {getError("registeredAddress.postalCode") ? (
                      <p className="mt-1 text-sm text-[rgb(190,51,51)]">
                        {getError("registeredAddress.postalCode")}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {currentStep === 3 ? (
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="businessId">Business Registration ID</Label>
                <Input
                  id="businessId"
                  placeholder="CIN / LLPIN / registration number"
                  value={formData.businessIdentifiers.businessId}
                  onChange={(event) => updateBusinessIdentifiers("businessId", event.target.value)}
                />
                {getError("businessId") ? (
                  <p className="mt-1 text-sm text-[rgb(190,51,51)]">{getError("businessId")}</p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="businessPan">PAN</Label>
                <Input
                  id="businessPan"
                  value={formData.businessIdentifiers.pan}
                  onChange={(event) => updateBusinessIdentifiers("pan", event.target.value)}
                />
                {getError("pan") ? (
                  <p className="mt-1 text-sm text-[rgb(190,51,51)]">{getError("pan")}</p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="businessGst">GST Number</Label>
                <Input
                  id="businessGst"
                  value={formData.businessIdentifiers.gst}
                  onChange={(event) => updateBusinessIdentifiers("gst", event.target.value)}
                />
                {getError("gst") ? (
                  <p className="mt-1 text-sm text-[rgb(190,51,51)]">{getError("gst")}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {currentStep === 4 ? (
            <>
              {formData.basicInfo.businessType === "pvt_ltd" ? (
                <div className="rounded-[24px] border border-primary/12 bg-primary/6 px-5 py-4 text-sm leading-7 text-foreground/72">
                  Xflow requires company accounts to have a director, owner, and representative
                  before activation. This flow submits the primary director as the owner and
                  representative as well.
                </div>
              ) : null}

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-[24px] bg-black/[0.03] p-5">
                  <p className="text-sm font-semibold text-foreground">Primary Director</p>
                  <div className="mt-4 space-y-4">
                    <div>
                      <Label htmlFor="primaryDirectorName">Full Name</Label>
                      <Input
                        id="primaryDirectorName"
                        value={formData.personalInfo.primaryDirector.fullName}
                        onChange={(event) =>
                          updateDirector("primaryDirector", "fullName", event.target.value)
                        }
                      />
                      {getError("primaryDirector.fullName") ? (
                        <p className="mt-1 text-sm text-[rgb(190,51,51)]">
                          {getError("primaryDirector.fullName")}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <Label htmlFor="primaryDirectorPan">PAN</Label>
                      <Input
                        id="primaryDirectorPan"
                        value={formData.personalInfo.primaryDirector.pan}
                        onChange={(event) =>
                          updateDirector("primaryDirector", "pan", event.target.value)
                        }
                      />
                      {getError("primaryDirector.pan") ? (
                        <p className="mt-1 text-sm text-[rgb(190,51,51)]">
                          {getError("primaryDirector.pan")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] bg-black/[0.03] p-5">
                  <p className="text-sm font-semibold text-foreground">Secondary Director</p>
                  <div className="mt-4 space-y-4">
                    <div>
                      <Label htmlFor="secondaryDirectorName">Full Name</Label>
                      <Input
                        id="secondaryDirectorName"
                        value={formData.personalInfo.secondaryDirector.fullName}
                        onChange={(event) =>
                          updateDirector("secondaryDirector", "fullName", event.target.value)
                        }
                      />
                      {getError("secondaryDirector.fullName") ? (
                        <p className="mt-1 text-sm text-[rgb(190,51,51)]">
                          {getError("secondaryDirector.fullName")}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <Label htmlFor="secondaryDirectorPan">PAN</Label>
                      <Input
                        id="secondaryDirectorPan"
                        value={formData.personalInfo.secondaryDirector.pan}
                        onChange={(event) =>
                          updateDirector("secondaryDirector", "pan", event.target.value)
                        }
                      />
                      {getError("secondaryDirector.pan") ? (
                        <p className="mt-1 text-sm text-[rgb(190,51,51)]">
                          {getError("secondaryDirector.pan")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {currentStep === 5 ? (
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="accountHolderName">Account Holder Name</Label>
                <Input
                  id="accountHolderName"
                  value={formData.bankDetails.accountHolderName}
                  onChange={(event) =>
                    updateBankDetails("accountHolderName", event.target.value)
                  }
                />
                {getError("accountHolderName") ? (
                  <p className="mt-1 text-sm text-[rgb(190,51,51)]">
                    {getError("accountHolderName")}
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input
                  id="accountNumber"
                  value={formData.bankDetails.accountNumber}
                  onChange={(event) => updateBankDetails("accountNumber", event.target.value)}
                />
                {getError("accountNumber") ? (
                  <p className="mt-1 text-sm text-[rgb(190,51,51)]">
                    {getError("accountNumber")}
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="ifsc">IFSC / Domestic Credit Code</Label>
                <Input
                  id="ifsc"
                  value={formData.bankDetails.ifsc}
                  onChange={(event) => updateBankDetails("ifsc", event.target.value)}
                />
                {getError("ifsc") ? (
                  <p className="mt-1 text-sm text-[rgb(190,51,51)]">{getError("ifsc")}</p>
                ) : null}
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="bankLine1">Bank Address Line 1</Label>
                <Input
                  id="bankLine1"
                  value={formData.bankDetails.line1}
                  onChange={(event) => updateBankDetails("line1", event.target.value)}
                />
                {getError("line1") ? (
                  <p className="mt-1 text-sm text-[rgb(190,51,51)]">{getError("line1")}</p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="bankCity">City</Label>
                <Input
                  id="bankCity"
                  value={formData.bankDetails.city}
                  onChange={(event) => updateBankDetails("city", event.target.value)}
                />
                {getError("city") ? (
                  <p className="mt-1 text-sm text-[rgb(190,51,51)]">{getError("city")}</p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="bankState">State</Label>
                <Input
                  id="bankState"
                  value={formData.bankDetails.state}
                  onChange={(event) => updateBankDetails("state", event.target.value)}
                />
                {getError("state") ? (
                  <p className="mt-1 text-sm text-[rgb(190,51,51)]">{getError("state")}</p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="bankPostalCode">Postal Code</Label>
                <Input
                  id="bankPostalCode"
                  value={formData.bankDetails.postalCode}
                  onChange={(event) => updateBankDetails("postalCode", event.target.value)}
                />
                {getError("postalCode") ? (
                  <p className="mt-1 text-sm text-[rgb(190,51,51)]">{getError("postalCode")}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {currentStep === 6 ? (
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <Label htmlFor="merchantCategoryCode">Merchant Category Code</Label>
                <Input
                  id="merchantCategoryCode"
                  value={formData.fees.merchantCategoryCode}
                  onChange={(event) =>
                    updateFees("merchantCategoryCode", event.target.value)
                  }
                />
                {getError("merchantCategoryCode") ? (
                  <p className="mt-1 text-sm text-[rgb(190,51,51)]">
                    {getError("merchantCategoryCode")}
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="merchantSize">Merchant Size</Label>
                <Select
                  id="merchantSize"
                  value={formData.fees.merchantSize}
                  onChange={(event) => updateFees("merchantSize", event.target.value)}
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                  <option value="enterprise">Enterprise</option>
                </Select>
                {getError("merchantSize") ? (
                  <p className="mt-1 text-sm text-[rgb(190,51,51)]">
                    {getError("merchantSize")}
                  </p>
                ) : null}
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="estimatedMonthlyVolume">Estimated Monthly Volume (USD)</Label>
                <Input
                  id="estimatedMonthlyVolume"
                  placeholder="100000"
                  value={formData.fees.estimatedMonthlyVolume}
                  onChange={(event) =>
                    updateFees("estimatedMonthlyVolume", event.target.value)
                  }
                />
                {getError("estimatedMonthlyVolume") ? (
                  <p className="mt-1 text-sm text-[rgb(190,51,51)]">
                    {getError("estimatedMonthlyVolume")}
                  </p>
                ) : null}
              </div>

              <div className="md:col-span-2 rounded-[24px] bg-black/[0.03] p-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Purpose Codes</p>
                    <p className="mt-1 text-sm leading-7 text-foreground/66">
                      Select at least one export purpose code. Xflow requires this before a
                      connected user can be activated.
                    </p>
                  </div>
                  {formData.fees.purposeCodes.length > 0 ? (
                    <div className="rounded-full bg-primary/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                      {formData.fees.purposeCodes.length} selected
                    </div>
                  ) : null}
                </div>

                {recommendedPurposeCodes.length > 0 ? (
                  <div className="mt-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/48">
                      Recommended for {formData.aboutBusiness.productCategory}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {recommendedPurposeCodes.map((option) => {
                        const selected = formData.fees.purposeCodes.includes(option.code);

                        return (
                          <button
                            key={option.code}
                            type="button"
                            onClick={() => togglePurposeCode(option.code)}
                            className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                              selected
                                ? "border-primary bg-primary text-white"
                                : "border-primary/18 bg-white text-primary"
                            }`}
                          >
                            {option.code}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {purposeCodesQuery.isLoading ? (
                  <p className="mt-5 text-sm text-foreground/66">Loading purpose codes...</p>
                ) : null}

                {purposeCodesQuery.isError ? (
                  <p className="mt-5 text-sm text-[rgb(190,51,51)]">
                    Purpose codes could not be loaded. Refresh and try again.
                  </p>
                ) : null}

                {!purposeCodesQuery.isLoading && !purposeCodesQuery.isError ? (
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {purposeCodeOptions.map((option) => {
                      const selected = formData.fees.purposeCodes.includes(option.code);

                      return (
                        <label
                          key={option.code}
                          className={`flex cursor-pointer gap-3 rounded-[22px] border px-4 py-4 transition ${
                            selected
                              ? "border-primary bg-primary/6"
                              : "border-black/8 bg-white/82"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => togglePurposeCode(option.code)}
                            className="mt-1 h-4 w-4 shrink-0"
                          />
                          <span>
                            <span className="text-sm font-semibold text-foreground">
                              {option.code}
                            </span>
                            <span className="mt-1 block text-xs leading-6 text-foreground/66">
                              {option.description}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : null}

                {getError("purposeCodes") ? (
                  <p className="mt-4 text-sm text-[rgb(190,51,51)]">
                    {getError("purposeCodes")}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {currentStep === 7 ? (
            <>
              <div className="rounded-[24px] bg-[rgba(19,33,68,0.04)] p-5">
                <p className="text-sm font-semibold text-foreground">Connected User Summary</p>
                <div className="mt-4 grid gap-3 text-sm text-foreground/72 md:grid-cols-2">
                  <div>
                    <span className="font-semibold text-foreground">Business:</span>{" "}
                    {formData.basicInfo.legalName || "Not provided yet"}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Brand:</span>{" "}
                    {formData.basicInfo.dba || "Not provided yet"}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Email:</span>{" "}
                    {formData.basicInfo.email || "Not provided yet"}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Business type:</span>{" "}
                    {formData.basicInfo.businessType}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Primary director:</span>{" "}
                    {formData.personalInfo.primaryDirector.fullName || "Not provided yet"}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Secondary director:</span>{" "}
                    {formData.personalInfo.secondaryDirector.fullName || "Not provided yet"}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Registered country:</span>{" "}
                    {formData.aboutBusiness.registeredAddress.country}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Bank account:</span>{" "}
                    {formData.bankDetails.accountNumber || "Not provided yet"}
                  </div>
                  <div className="md:col-span-2">
                    <span className="font-semibold text-foreground">Purpose codes:</span>{" "}
                    {formData.fees.purposeCodes.length > 0
                      ? formData.fees.purposeCodes.join(", ")
                      : "Not provided yet"}
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-[24px] bg-black/[0.03] p-5">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={formData.summary.termsAccepted}
                    onChange={(event) => updateSummary("termsAccepted", event.target.checked)}
                    className="mt-1 h-4 w-4"
                  />
                  <span className="text-sm leading-7 text-foreground/72">
                    I confirm that the connected user has accepted the applicable Terms of Service.
                  </span>
                </label>
                {getError("termsAccepted") ? (
                  <p className="text-sm text-[rgb(190,51,51)]">{getError("termsAccepted")}</p>
                ) : null}

                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={formData.summary.dataAccuracy}
                    onChange={(event) => updateSummary("dataAccuracy", event.target.checked)}
                    className="mt-1 h-4 w-4"
                  />
                  <span className="text-sm leading-7 text-foreground/72">
                    I confirm that all information provided above is accurate and complete.
                  </span>
                </label>
                {getError("dataAccuracy") ? (
                  <p className="text-sm text-[rgb(190,51,51)]">{getError("dataAccuracy")}</p>
                ) : null}
              </div>
            </>
          ) : null}

          {submitError ? (
            <p className="rounded-2xl bg-[rgba(218,70,70,0.08)] px-4 py-3 text-sm text-[rgb(190,51,51)]">
              {submitError}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCurrentStep((step) => Math.max(step - 1, 1));
                setErrors({});
                setSubmitError("");
              }}
              disabled={currentStep === 1 || isLoading}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            <Button
              type="button"
              onClick={() => void handleNext()}
              disabled={isLoading || (currentStep === 6 && purposeCodesQuery.isLoading)}
            >
              {isLoading ? "Submitting..." : currentStep === STEPS.length ? submitLabel : "Next"}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
