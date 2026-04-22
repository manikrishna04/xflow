import type { PurposeCodeOption } from "@/types/tradedge";

export const XFLOW_EXPORT_PURPOSE_CODES: PurposeCodeOption[] = [
  {
    code: "P0102",
    description: "Realisation of export bills (in respect of goods) sent on collection (full invoice value)",
  },
  {
    code: "P0103",
    description: "Advance receipts against export contracts, which will be covered later by GR/PP/SOFTEX/SDF",
  },
  {
    code: "P0201",
    description: "Receipts of surplus freight/passenger fare by Indian shipping companies operating abroad",
  },
  {
    code: "P0301",
    description: "Purchases towards travel (Includes purchases of foreign TCs, currency notes etc over the counter, by hotels, hospitals, emporiums, educational institutions etc.)",
  },
  {
    code: "P0306",
    description: "Other travel receipts",
  },
  {
    code: "P0801",
    description: "Hardware consultancy/implementation",
  },
  {
    code: "P0802",
    description: "Software consultancy/implementation (other than those covered in SOFTEX form)",
  },
  {
    code: "P0803",
    description: "Data base, data processing charges",
  },
  {
    code: "P0804",
    description: "Repair and maintenance of computer and software",
  },
  {
    code: "P0806",
    description: "Other information services - Subscription to newspapers, periodicals, etc.",
  },
  {
    code: "P0807",
    description: "Off site Software Exports",
  },
  {
    code: "P0901",
    description: "Franchises services - patents, copyrights, trade marks, industrial processes, franchises etc.",
  },
  {
    code: "P0902",
    description: "Receipts for use, through licensing arrangements, of produced originals or prototypes (such as manuscripts and films)",
  },
  {
    code: "P1002",
    description: "Trade related services - Commission on exports/imports",
  },
  {
    code: "P1003",
    description: "Operational leasing services (other than financial leasing and without operating crew) including charter hire",
  },
  {
    code: "P1004",
    description: "Legal services",
  },
  {
    code: "P1005",
    description: "Accounting, auditing, book keeping and tax consulting services",
  },
  {
    code: "P1006",
    description: "Business and management consultancy and public relations services",
  },
  {
    code: "P1007",
    description: "Advertising, trade fair, market research and public opinion polling services",
  },
  {
    code: "P1008",
    description: "Research & Development services",
  },
  {
    code: "P1009",
    description: "Architectural, engineering and other technical services",
  },
  {
    code: "P1014",
    description: "Engineering Services",
  },
  {
    code: "P1016",
    description: "Market research and public opinion polling service",
  },
  {
    code: "P1017",
    description: "Publishing and printing services",
  },
  {
    code: "P1019",
    description: "Commission agent services",
  },
  {
    code: "P1020",
    description: "Wholesale and retailing trade services",
  },
  {
    code: "P1022",
    description: "Other Technical Services including scientific/space services",
  },
  {
    code: "P1101",
    description: "Audio-visual and related services - services and associated fees related to production of motion pictures, rentals, fees received by actors, directors, producers and fees for distribution rights",
  },
  {
    code: "P1104",
    description: "Entertainment services",
  },
  {
    code: "P1107",
    description: "Educational services (e.g. fees received for correspondence courses offered to non-resident by Indian institutions)",
  },
  {
    code: "P1109",
    description: "Other Personal, Cultural & Recreational services",
  },
  {
    code: "P1306",
    description: "Receipts / Refund of taxes",
  },
  {
    code: "P1501",
    description: "Refunds / rebates on account of imports",
  },
  {
    code: "P1502",
    description: "Reversal of wrong entries, refunds of amount remitted for non-imports",
  },
  {
    code: "P1701",
    description: "Receipts on account of processing of goods",
  },
];

export const COMMON_PURPOSE_CODES_BY_PRODUCT_CATEGORY = {
  goods: ["P0102", "P0103", "P1701"],
  services: ["P1006", "P1007", "P1009"],
  software: ["P0802", "P0803", "P0807"],
} as const;
