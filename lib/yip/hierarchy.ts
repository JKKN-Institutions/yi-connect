// Handbook-aligned Yi hierarchy constants & pure helpers.
// Imported from server actions AND client components — no "use server" here.

export type YiZone = "ER" | "WR" | "NR" | "NER" | "SRTN" | "SRTKKA";
export type YiRole = "national" | "rm" | "chapter_em";

export const YI_ZONES: { code: YiZone; label: string; states: string[] }[] = [
  {
    code: "ER",
    label: "East",
    states: ["Bihar", "Jharkhand", "Odisha", "West Bengal", "Madhya Pradesh", "Chhattisgarh"],
  },
  {
    code: "WR",
    label: "West",
    states: ["Maharashtra", "Gujarat", "Rajasthan", "Goa", "Dadra & Nagar Haveli", "Daman & Diu"],
  },
  {
    code: "NR",
    label: "North",
    states: [
      "Jammu & Kashmir",
      "Ladakh",
      "Himachal Pradesh",
      "Punjab",
      "Haryana",
      "Delhi",
      "Uttar Pradesh",
      "Uttarakhand",
      "Chandigarh",
    ],
  },
  {
    code: "NER",
    label: "North East",
    states: [
      "Assam",
      "Arunachal Pradesh",
      "Meghalaya",
      "Manipur",
      "Mizoram",
      "Nagaland",
      "Tripura",
      "Sikkim",
    ],
  },
  {
    code: "SRTN",
    label: "South — Tamil Nadu",
    states: ["Tamil Nadu", "Puducherry"],
  },
  {
    code: "SRTKKA",
    label: "South — TK/KA/KL/AP",
    states: [
      "Karnataka",
      "Kerala",
      "Andhra Pradesh",
      "Telangana",
      "Lakshadweep",
      "Andaman and Nicobar Islands",
    ],
  },
];

/**
 * Infer a zone from a state name using the handbook region→state table.
 */
export function zoneFromState(state: string | null): YiZone | null {
  if (!state) return null;
  const trimmed = state.trim();
  for (const zone of YI_ZONES) {
    if (zone.states.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      return zone.code;
    }
  }
  return null;
}
