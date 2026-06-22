/**
 * Varnam Vizha — Digital Playbook content.
 *
 * Curated institutional memory for the committee-only Playbook section.
 * Every fact here is drawn from the Yi Erode Varnam Vizha vault records
 * (WhatsApp exports, Annual Reports, EC-meeting notes) — nothing is invented.
 * Tamil names are included only where verified; otherwise omitted with a note.
 *
 * This module exports plain constants (no DB access). The year-by-year history
 * comes live from getAllEditions() in `@/lib/varnam/data/editions`.
 */

export type EventTemplate = {
  name: string;
  /** Tamil name — only present where verified. */
  tamilName?: string;
  category: "Ceremony" | "Sports" | "Cultural" | "Community" | "Heritage" | "Awareness" | "Music";
  whatItIs: string;
  checklist: string[];
  typicalVenue?: string;
  leadForum?: string;
};

/**
 * Blueprints for the signature events that recur across Varnam Vizha editions.
 * Checklists are distilled from the real 2025 operations (Dedicated-Groups-Intel,
 * Sub-Events-Catalog) so a future committee can re-run each event from memory.
 */
export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    name: "Inauguration",
    // The festival name வர்ணம் விழா is verified; the event title is left in English.
    category: "Ceremony",
    whatItIs:
      "Grand opening at the Collectorate with the District Collector, MP, Minister and partner-forum leads. Sets the tone and unlocks government goodwill for the rest of the festival.",
    checklist: [
      "Confirm Collector / MP / Minister availability via the PRO weeks ahead",
      "Submit the full event Excel to the Collectorate for permissions",
      "Release the official logo and anthem video at the inauguration",
      "Collect and display all partner-forum logos on the backdrop",
      "Brief press and media partners; schedule the press meet a few days prior",
      "Arrange ID tags (Core, Volunteers, Media, Sponsors) before the day",
    ],
    typicalVenue: "Collectorate Office, Erode",
    leadForum: "Yi (Young Indians)",
  },
  {
    name: "Awareness Bike Rally / Marathon",
    category: "Awareness",
    whatItIs:
      "Early-morning helmet, drug-awareness and road-safety rally (and the Marathon) led by Erode City Police — a high-visibility public opener that doubles as a civic message.",
    checklist: [
      "Secure route permissions through ADSP / Traffic Police contacts",
      "Confirm police patrol bike to lead; line up super-bike contingents",
      "Mobilise Yuva volunteers for a pre-dawn (4 AM) start",
      "Prepare helmet-awareness and pledge booths along the route",
      "Keep the Royal Enfield / Bullet rally separate — it was held back over legal issues in 2025",
      "Arrange water, ambulance standby and a flag-off banner",
    ],
    typicalVenue: "City route (police-approved)",
    leadForum: "Erode City Police + Yi",
  },
  {
    name: "Thiran Ottam",
    tamilName: "திறன் ஓட்டம்",
    category: "Awareness",
    whatItIs:
      "Accessibility-awareness rally / run for differently-abled participants — Yi Erode's signature differentiator. ~300 participants in 2025, with 145 JKKN college volunteers as the backbone.",
    checklist: [
      "Open a Google Form early AND keep handwritten forms (digital access varies)",
      "Lock the volunteer contingent (145 JKKN students across 6 colleges in 2025)",
      "Book primary + backup ambulances and a nursing first-aid team with medicines",
      "Order 300 chairs, ~2,000 half-litre water bottles, dustbins, audio, red carpet",
      "Print certificates + medals for every participant (300 in 2025)",
      "Invite school / institution heads as chief guests",
    ],
    typicalVenue: "City route",
    leadForum: "Yi Accessibility vertical",
  },
  {
    name: "Nila Soru",
    tamilName: "நிலா சோறு",
    category: "Community",
    whatItIs:
      "Moonlight community potluck dinner — the emotional anchor of the festival. Traditional Tamil practice, best held on the full-moon night. ~250 attendees in 2025.",
    checklist: [
      "Schedule on the full-moon day of the festival week",
      "Pick an open, atmospheric venue (the Thepakulam / tank area worked well)",
      "Coordinate the potluck so dishes are shared, not duplicated",
      "Arrange mats, lighting and a simple sound setup",
      "Keep it members-and-families warm rather than ticketed / commercial",
    ],
    typicalVenue: "Thepakulam (tank area) / open ground",
    leadForum: "Yi members",
  },
  {
    name: "Heritage Walk",
    category: "Heritage",
    whatItIs:
      "Sunday-morning walking tour of Erode's heritage landmarks, with the District Collector personally planning the route — the strongest government-relationship builder of the festival.",
    checklist: [
      "Request the Collector to plan / join the route (a relationship asset)",
      "Confirm an early start (8:45 AM worked well) before the heat",
      "Invite partner forums — Heritage Walk draws the widest cross-forum turnout",
      "Map ~10 landmarks; arrange a guide for historical context at each",
      "Capture photos / drone footage for the branding archive",
    ],
    typicalVenue: "Erode heritage route",
    leadForum: "Yi + OEF (Old Erode Foundation)",
  },
  {
    name: "Jolly Jam Concert",
    category: "Music",
    whatItIs:
      "The flagship ticketed music night (90's vs Gen Z musical show with Airtel Super Singers in 2025). The festival's revenue event — 1,000+ audience, tickets sold via BookMyShow.",
    checklist: [
      "Lock the performers and a large college-ground venue early",
      "Set up Gold / Silver / Bronze tiers on BookMyShow",
      "Place physical ticket booths around the city (salons, showrooms, novelty stores)",
      "Distribute ticket quotas to named sellers and track sales",
      "Prepare LED screens (landscape video) plus social promos (portrait video)",
      "Plan crowd, security and exit management for 1,000+",
    ],
    typicalVenue: "Vellalar College ground, Thindal",
    leadForum: "Yi Core Committee",
  },
  {
    name: "Turf Cricket Tournament",
    category: "Sports",
    whatItIs:
      "Inter-forum cricket on a turf ground — a reliable team-sport that builds rivalry and bonding across partner forums.",
    checklist: [
      "Book a turf ground and fix the inter-forum format / fixtures",
      "Invite teams from partner forums; collect entries early",
      "Arrange umpires, kit, scoreboard and a rolling trophy",
      "Schedule across the festival days to sustain footfall",
      "Plan prizes and a short presentation ceremony",
    ],
    typicalVenue: "Turf ground, Erode",
    leadForum: "Yi Sports vertical",
  },
  {
    name: "Kolam Contest",
    category: "Cultural",
    whatItIs:
      "Traditional rangoli (kolam) competition on a public road, co-organised with a newspaper partner (Daily Malar in 2025) for reach and credibility.",
    checklist: [
      "Tie up with a newspaper / media partner for co-branding and coverage",
      "Mark out kolam plots on a wide road (80ft Road in 2025) and get permissions",
      "Open registrations and define categories / judging criteria",
      "Arrange judges, prizes and certificates",
      "Schedule early morning when the road is free",
    ],
    typicalVenue: "80ft Road, Erode",
    leadForum: "Yi Cultural + media partner",
  },
  {
    name: "Women's Carnival",
    category: "Community",
    whatItIs:
      "A carnival celebrating women entrepreneurs and the women's community — ~200 participants in 2025. Pairs naturally with IWN (Indian Women Network).",
    checklist: [
      "Partner with IWN and women-led businesses for stalls",
      "Book an open ground (CSI Ground worked in 2025)",
      "Curate stalls, activities and a cultural showcase",
      "Promote on social with women-entrepreneur spotlights",
      "Arrange seating, sound and refreshments",
    ],
    typicalVenue: "CSI Ground, Erode",
    leadForum: "Yi + IWN",
  },
  {
    name: "Midnight Walkathon",
    category: "Community",
    whatItIs:
      "A late-night women's walkathon (500 women, 11 PM–2 AM in 2025), run with CII and folded into the Varnam Vizha umbrella — a powerful safety-and-solidarity statement.",
    checklist: [
      "Co-organise with CII and confirm the women-only walk format",
      "Get police clearance and a well-lit, secured city route",
      "Arrange marshals, ambulance standby and water points",
      "Time it as a one-night signature moment (11 PM–2 AM in 2025)",
      "Capture media for the safety-and-empowerment narrative",
    ],
    typicalVenue: "City route (lit & secured)",
    leadForum: "CII + Yi",
  },
  {
    name: "Valedictory",
    category: "Ceremony",
    whatItIs:
      "The grand finale, hosted at a partner college with the Collector as chief guest — where the festival is celebrated, vision documents are launched, and contributors are thanked.",
    checklist: [
      "Book a college auditorium / ground (Kongu Engineering College in 2025)",
      "Confirm the Collector / chief guest and prepare felicitations",
      "Compile the festival recap reel and impact numbers",
      "Recognise sponsors, volunteers and partner forums on stage",
      "Launch any vision / next-year document (e.g. Vision 2035)",
    ],
    typicalVenue: "Kongu Engineering College, Perundurai",
    leadForum: "Yi Core Committee",
  },
];

/** People / organisations the committee approaches each year. */
export type KeyContacts = {
  government: { name: string; role: string; note: string }[];
  sponsorTargets: { name: string; type: string; note: string }[];
  channels: { label: string; value: string }[];
  partnerForums: string[];
};

/**
 * Government contacts are for PERMISSIONS and participation only — never funding.
 * Sponsor targets are the prospect list surfaced in 2025 Core Committee planning.
 */
export const KEY_CONTACTS: KeyContacts = {
  government: [
    {
      name: "District Collector",
      role: "Collector, Erode",
      note: "Chief guest / route planner for Heritage Walk & Valedictory. Permissions and goodwill only — no funding.",
    },
    {
      name: "Superintendent of Police (SP)",
      role: "SP, Erode",
      note: "Route and crowd permissions for rallies and the Marathon. Coordinate via the Organising team.",
    },
    {
      name: "Additional SP (ASP / ADSP)",
      role: "Police coordination",
      note: "Actively supported Bike Rally logistics in 2025. Permissions only.",
    },
    {
      name: "City Commissioner",
      role: "Erode Corporation",
      note: "Municipal clearances for public venues and routes.",
    },
    {
      name: "PRO (Public Relations Officer)",
      role: "Collectorate",
      note: "The channel to reach the Collector and schedule official meetings.",
    },
    {
      name: "Traffic Police",
      role: "Traffic management",
      note: "Route and traffic clearance for rallies, walkathon and marathon.",
    },
  ],
  sponsorTargets: [
    { name: "Chennai Silks", type: "Textile / Retail", note: "Prospect (2025 Core Committee list)" },
    { name: "Amman Jewellery", type: "Jewellery", note: "Prospect" },
    { name: "RD Jewellery", type: "Jewellery", note: "Prospect" },
    { name: "Kannagi", type: "Retail", note: "Prospect" },
    { name: "Radha", type: "Retail", note: "Prospect" },
    { name: "Grasp", type: "Retail", note: "Prospect" },
    { name: "Domino's", type: "Food / QSR", note: "Prospect" },
    { name: "One Fine Day", type: "Food / Café", note: "Prospect" },
    { name: "Jolly Jungles", type: "Entertainment", note: "Prospect" },
    { name: "YAZHI Groups", type: "Corporate", note: "Past supporter (2025)" },
  ],
  channels: [
    { label: "Instagram", value: "@erodevarnamvizha" },
    { label: "YouTube", value: "@erodevarnamvizha" },
    { label: "Facebook", value: "@erodevarnamvizha" },
    { label: "Email", value: "erodevarnamvizha@gmail.com" },
  ],
  partnerForums: [
    "CII (Confederation of Indian Industry)",
    "OEF (Old Erode Foundation)",
    "IWN (Indian Women Network)",
    "Rotary",
    "JCI (Junior Chamber International)",
    "BNI",
    "Round Table 211",
    "Siragugal",
    "IMA (Indian Medical Association)",
    "EAA (Erode Architects Association)",
    "CREDAI",
    "Erode Runners Club",
    "EEDISSIA",
    "Erode Parenting Hub",
  ],
};

/** What worked and what to improve, from the 2026 EC-meeting review. */
export type Lessons = { worked: string[]; improve: string[] };

export const LESSONS: Lessons = {
  worked: [
    "Nila Soru is the emotional anchor — community bonding people remember most.",
    "The Thepakulam (tank area) is a great venue and deserves more days.",
    "A 3-day theme format keeps each block focused and easy to promote.",
    "Musical events draw the crowds — Jolly Jam was a 1,000+ success.",
    "Thiran Ottam is the differentiator — no other Erode forum runs an accessibility rally at this scale.",
    "Turf Cricket works well as an inter-forum team sport.",
    "The Heritage Walk is loved by people AND backed by the government.",
    "Bringing in social-media influencers (since 2023) hugely boosted Yi Erode's visibility.",
    "A dedicated Instagram (@erodevarnamvizha) plus a professional content team delivered 40+ reels.",
    "A press meet with the Collector gave the festival real credibility.",
  ],
  improve: [
    "Start planning in January — 2025 began in April and felt rushed.",
    "Build a formal sponsor deck early (2025's was only ready in August).",
    "Keep a dedicated budget tracker with a per-event breakdown.",
    "Export the Varnam Vizha WhatsApp groups to the vault for complete records.",
    "Add a standalone Food Festival.",
    "Invite more forums to collaborate under the umbrella.",
    "Explore a Tech Park concept (inspired by Covai Vizha).",
    "Align timing with FATIA Fair and the Edissia exhibition for a shared audience.",
    "Document every sub-event in the Health Card as a separate submission.",
  ],
};
