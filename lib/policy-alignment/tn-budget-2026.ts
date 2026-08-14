/**
 * Yi SRTN × Tamil Nadu Budget 2026-27 — scored alignment dataset.
 *
 * Sources, and only these two:
 *   1. Yi Leadership Academy 2026 Pathfinder vertical one-pagers (National Yi)
 *   2. Tamil Nadu Budget Speech, 5 August 2026 — Revised Budget Estimates
 *
 * `para` cites the paragraph in the budget speech so every row is checkable.
 * `crore` is the Revised Budget Estimate for the named scheme — the SIZE OF THE
 * POLICY AREA, not funding available to Yi.
 *
 * Scoring: outcome + people + timing + invitation, each 0-2, total out of 8.
 * The score is a judgement made against a fixed rubric (see RUBRIC), not a
 * measurement. `why` states the evidence behind each score.
 *
 * Action windows are forward-looking from 14 August 2026.
 *
 * Also published as a spreadsheet for chapter circulation
 * (Yi-SRTN-x-TN-Budget-2026-27-Alignment.xlsx, kept outside the repo). Update
 * both together so the public page and the circulated file cannot drift.
 *
 * Author: Ommsharravana — Chapter Chair, Yi Erode
 */

export type Alignment = 'Direct' | 'Partial' | 'None' | 'Internal';
export type Band = 'Act now' | 'Open a door' | 'Re-scope first' | 'Not this year';

export type Scores = {
  outcome: number;
  people: number;
  timing: number;
  invitation: number;
};

export type AlignmentRow = {
  pillar: string;
  vertical: string;
  programme: string;
  target: string;
  scheme: string;
  para: string;
  crore: number | null;
  dept: string;
  align: Alignment;
  action: string;
  scores: Scores;
  score: number;
  band: Band;
  why: string;
  firstStep: string;
  owner: string;
  window: string;
  proof: string;
};

export type ChapterRow = { chapter: string; named: string; scheme: string; para: string; vertical: string; move: string; };
export type GapRow = { type: string; item: string; detail: string; para: string; crore: number | null; recommendation: string; };
export type LeadRow = { vertical: string; name: string; chapter: string; role: string; };

/** What each 0-2 sub-score means. Shown on the page so the number is auditable. */
export const RUBRIC: { key: keyof Scores; label: string; two: string; one: string; zero: string }[] = [
  { key: 'outcome', label: 'Outcome', two: 'Identical outcome', one: 'Contributing', zero: 'Unrelated' },
  { key: 'people', label: 'People', two: 'Same beneficiary cohort', one: 'Overlapping', zero: 'Different' },
  { key: 'timing', label: 'Timing', two: 'Both live in 2026-27', one: 'One side undated or next cycle', zero: 'Not yet real' },
  { key: 'invitation', label: 'Invitation', two: 'Budget text names outside participation', one: 'Participation plausible', zero: 'Closed to outsiders' },
];

export const BAND_META: { band: Band; min: number; blurb: string }[] = [
  { band: 'Act now', min: 7, blurb: 'Same outcome, same people, same year, and a door that is already open.' },
  { band: 'Open a door', min: 5, blurb: 'The match is real but there is no route in yet. Find the counterpart first.' },
  { band: 'Re-scope first', min: 3, blurb: 'Related, but Yi\'s current form does not fit the scheme. Change the shape before approaching.' },
  { band: 'Not this year', min: 0, blurb: 'No scheme, no counterpart, or internal to Yi. Listed so the absence is explicit.' },
];

export const SOURCE_NOTE =
  'Built from the Yi Leadership Academy 2026 Pathfinder one-pagers and the Tamil Nadu Budget Speech of 5 August 2026. Paragraph numbers cite the speech.';

export const AUTHOR = 'Ommsharravana — Chapter Chair, Yi Erode';

export const ALIGNMENT_ROWS: AlignmentRow[] = [
  {
    "pillar": "Nation Building",
    "vertical": "Road Safety",
    "programme": "Farishtey — Good Samaritan",
    "target": "10 lakh reached; 5 lakh certified Farishtey",
    "scheme": "Road Safety Policy — pillar 4, emergency trauma care; Safe Roads Mission advanced trauma care",
    "para": "146, 115",
    "crore": 130,
    "dept": "Home, Prohibition & Excise / Highways",
    "align": "Direct",
    "action": "Offer Farishtey as the State's certified first-responder curriculum",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 1
    },
    "score": 7,
    "band": "Act now",
    "why": "Both target survival in the first hour after a crash. The Policy's 4th pillar is emergency trauma care; Farishtey already certifies bystanders under the Good Samaritan Law.",
    "firstStep": "Write to the Road Safety Policy drafting cell offering Farishtey as the ready-made bystander curriculum, with the certified-numbers evidence attached.",
    "owner": "SRTN RM Road Safety — Puvelan SV (Salem)",
    "window": "Before the Policy is notified — it is being formulated now",
    "proof": "A written acknowledgement from the Home Dept naming Farishtey in the education pillar"
  },
  {
    "pillar": "Nation Building",
    "vertical": "Road Safety",
    "programme": "Chota Cop",
    "target": "10 lakh lives; digital report card",
    "scheme": "Road Safety Policy — pillar 5, education; safe school access networks",
    "para": "146, 111",
    "crore": 130,
    "dept": "Home, Prohibition & Excise",
    "align": "Direct",
    "action": "Place Chota Cop in the schools already under Palli Niraivu",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 1
    },
    "score": 7,
    "band": "Act now",
    "why": "Chota Cop teaches road rules to school children; the Policy's 5th pillar is education and ¶111 funds safe school access networks. Same children, same year.",
    "firstStep": "Pick 10 schools already inside Palli Niraivu in your chapter city and run Chota Cop there, so the report card lands where the State is already spending.",
    "owner": "Chapter Road Safety Convener",
    "window": "Start with the current school term",
    "proof": "Digital report cards from 10 schools, shared with the District Education Officer"
  },
  {
    "pillar": "Nation Building",
    "vertical": "Road Safety",
    "programme": "Emergency / First Responder Training",
    "target": "All chapters, all stakeholders",
    "scheme": "Advanced trauma care centres under Safe Roads Mission",
    "para": "115",
    "crore": null,
    "dept": "Highways & Minor Ports",
    "align": "Direct",
    "action": "Train member firms' staff; log against the State's trauma-care rollout",
    "scores": {
      "outcome": 2,
      "people": 1,
      "timing": 2,
      "invitation": 1
    },
    "score": 6,
    "band": "Open a door",
    "why": "Yi trains bystanders and faculty; the State is building advanced trauma care centres. Same outcome, adjacent cohorts — the State trains clinicians, Yi trains the people who arrive first.",
    "firstStep": "Offer member-company staff as the first cohort for a joint drill with the nearest trauma care centre.",
    "owner": "Chapter Road Safety Convener",
    "window": "This quarter",
    "proof": "One joint drill completed with a district hospital"
  },
  {
    "pillar": "Nation Building",
    "vertical": "Road Safety",
    "programme": "Helmet / Seat Belt / Horn Not OK Please",
    "target": "Per chapter, with local transport authority",
    "scheme": "AI-based speed and traffic enforcement; Road Safety Fund",
    "para": "115, 146",
    "crore": 130,
    "dept": "Home, Prohibition & Excise",
    "align": "Direct",
    "action": "Run the campaigns alongside the AI enforcement rollout, not separately",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 1
    },
    "score": 7,
    "band": "Act now",
    "why": "Helmet, seat belt and HNOP campaigns change the exact behaviours the AI enforcement rollout will start penalising. Yi can prepare the public before enforcement bites.",
    "firstStep": "Ask the city traffic authority which junctions get AI enforcement first, and run helmet and seat-belt drives at those junctions two months ahead.",
    "owner": "Chapter Road Safety Convener",
    "window": "Ahead of the enforcement rollout",
    "proof": "Campaign run at the named junctions before cameras go live"
  },
  {
    "pillar": "Nation Building",
    "vertical": "Road Safety",
    "programme": "Road Safety Week (26–31 Jan)",
    "target": "National campaign week",
    "scheme": "New Road Safety Policy, five pillars",
    "para": "146",
    "crore": 130,
    "dept": "Home, Prohibition & Excise",
    "align": "Direct",
    "action": "Time the 2027 week to the Policy launch",
    "scores": {
      "outcome": 1,
      "people": 2,
      "timing": 1,
      "invitation": 1
    },
    "score": 5,
    "band": "Open a door",
    "why": "An awareness week is a moment, not a mechanism. It aligns with the Policy but contributes little on its own — its value is as a launch platform.",
    "firstStep": "Hold the January 2027 week open and offer it to the Home Dept as the Policy's public launch platform.",
    "owner": "SRTN RM Road Safety — Puvelan SV (Salem)",
    "window": "Road Safety Week, 26–31 January 2027",
    "proof": "A State speaker confirmed for the SRTN week"
  },
  {
    "pillar": "Nation Building",
    "vertical": "Health",
    "programme": "Substance abuse prevention — 'I'm My First Doctor'",
    "target": "1 session per Thalir school",
    "scheme": "Anti-Drug Clubs & student volunteer groups in schools; 10581 helpline; Drug-Free TN app",
    "para": "16",
    "crore": 7,
    "dept": "School Education",
    "align": "Direct",
    "action": "STRONGEST MATCH — the budget asks for student volunteer groups by name",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 2
    },
    "score": 8,
    "band": "Act now",
    "why": "The strongest match in the whole budget. ¶16 funds 'Anti-Drug Clubs and student volunteer groups' in schools — the budget asks for the exact thing Yi already runs.",
    "firstStep": "Offer existing Thalir school networks as ready-formed Anti-Drug Clubs, and get the 10581 helpline displayed on every Thalir campus.",
    "owner": "Chapter Health Convener with Thalir Convener",
    "window": "Immediately — the scheme is funded and starting",
    "proof": "10581 displayed and a club constituted in every Thalir school in the chapter"
  },
  {
    "pillar": "Nation Building",
    "vertical": "Health",
    "programme": "Break the Stigma — mental health",
    "target": "1 session per member chapter / college / village",
    "scheme": "Rehabilitation Fund for de-addiction",
    "para": "145",
    "crore": 70,
    "dept": "Home, Prohibition & Excise",
    "align": "Direct",
    "action": "Position Break the Stigma as the prevention arm of the Rehab Fund",
    "scores": {
      "outcome": 2,
      "people": 1,
      "timing": 2,
      "invitation": 1
    },
    "score": 6,
    "band": "Open a door",
    "why": "The ₹70 cr Rehabilitation Fund treats addiction; Break the Stigma prevents it. Complementary rather than identical — Yi is upstream of where the money sits.",
    "firstStep": "Approach the district de-addiction cell offering Break the Stigma as the prevention front-end that reduces intake.",
    "owner": "SRTN RM Health — JayaaVignesh Thangarajan",
    "window": "Health Week, 18–24 August 2026",
    "proof": "A referral pathway agreed with one district de-addiction centre"
  },
  {
    "pillar": "Nation Building",
    "vertical": "Health",
    "programme": "Sanitation & menstrual health (rural)",
    "target": "Sessions for girls and women per village",
    "scheme": "TN-VETRI — sanitation sub-mission",
    "para": "133",
    "crore": 6000,
    "dept": "Rural Development & Panchayat Raj",
    "align": "Direct",
    "action": "Enter via TN-VETRI block convergence, not standalone",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 1
    },
    "score": 7,
    "band": "Act now",
    "why": "TN-VETRI has a dedicated sanitation sub-mission and Yi runs sanitation and menstrual health sessions for the same rural women.",
    "firstStep": "Identify the block where your adopted rural network sits and ask the BDO which TN-VETRI sanitation works are scheduled there.",
    "owner": "Chapter Health Convener with Rural Initiatives Convener",
    "window": "This quarter",
    "proof": "Sessions delivered in a village with TN-VETRI works underway"
  },
  {
    "pillar": "Nation Building",
    "vertical": "Health",
    "programme": "Safe drinking water for rural schools",
    "target": "Per adopted rural network",
    "scheme": "Super Clean Super Campus — drinking water & toilet maintenance, 10,000 schools",
    "para": "12",
    "crore": 139,
    "dept": "School Education",
    "align": "Direct",
    "action": "Verify delivery in chapter-city schools; report to the department",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 1
    },
    "score": 7,
    "band": "Act now",
    "why": "Super Clean Super Campus funds drinking water and toilet maintenance in 10,000 schools. Yi's rural school water work is the same objective in the same schools.",
    "firstStep": "Verify water and toilet condition in the Super Clean schools in your city and send the findings to the District Education Officer.",
    "owner": "Chapter Health Convener",
    "window": "This quarter",
    "proof": "A written condition report on 10 schools submitted to the DEO"
  },
  {
    "pillar": "Nation Building",
    "vertical": "Health",
    "programme": "Active Living / Fit India / Kovalam Marathon",
    "target": "Fit India enrolment per Thalir school",
    "scheme": "'Take Up Sports, Give Up Drugs'; 1 hour structured sport per day after school",
    "para": "32, 34",
    "crore": 97,
    "dept": "Youth Welfare & Sports Development",
    "align": "Direct",
    "action": "Supply the after-school hour in chapter-city schools",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 1
    },
    "score": 7,
    "band": "Act now",
    "why": "'Take Up Sports, Give Up Drugs' and the new one-hour daily school sport period need bodies to run them. Fit India enrolment is the same push.",
    "firstStep": "Offer to staff the after-school hour in two schools per chapter, using member and YUVA volunteers.",
    "owner": "Chapter Sports Convener",
    "window": "Current school term",
    "proof": "The daily hour actually running in two schools"
  },
  {
    "pillar": "Nation Building",
    "vertical": "Health",
    "programme": "HEALTHYi National Wellness Summit",
    "target": "National summit",
    "scheme": "Urban Public Health Improvement Mission (within CM Urban Mission)",
    "para": "107",
    "crore": 2117,
    "dept": "Municipal Administration & Water Supply",
    "align": "Partial",
    "action": "Host the SRTN edition inside a corporation's health mission",
    "scores": {
      "outcome": 1,
      "people": 1,
      "timing": 1,
      "invitation": 1
    },
    "score": 4,
    "band": "Re-scope first",
    "why": "A national wellness summit is loosely related to the Urban Public Health Improvement Mission. No shared cohort, no shared date, and the Mission is still being scoped.",
    "firstStep": "No separate approach. If the summit lands in SRTN, invite a corporation health officer as a speaker.",
    "owner": "SRTN RM Health — JayaaVignesh Thangarajan",
    "window": "When the summit date is announced",
    "proof": "A State health official on the summit platform"
  },
  {
    "pillar": "Nation Building",
    "vertical": "MASOOM",
    "programme": "Student CSA sessions",
    "target": "Minimum 2 age-appropriate sessions per month per chapter",
    "scheme": "Singapenn Special Task Force — zero tolerance, crimes against women and children",
    "para": "143",
    "crore": 354,
    "dept": "Home, Prohibition & Excise",
    "align": "Direct",
    "action": "Seek School Education empanelment first; POCSO protocol is mandatory",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 1
    },
    "score": 7,
    "band": "Act now",
    "why": "Singapenn's mandate is crimes against women and children; MASOOM's CSA sessions are prevention for the same children. The overlap is real but Yi needs standing to enter schools.",
    "firstStep": "Seek School Education Dept empanelment for MASOOM before scaling — running unempanelled sessions in government schools is the risk here, not the alignment.",
    "owner": "SRTN RM MASOOM — Yadhavi Yogesh",
    "window": "Start the empanelment request this quarter",
    "proof": "A written empanelment or an approved school list"
  },
  {
    "pillar": "Nation Building",
    "vertical": "MASOOM",
    "programme": "MASOOM Model School",
    "target": "Certified schools per chapter",
    "scheme": "Palli Niraivu Thittam — 3,734 schools modernised",
    "para": "13",
    "crore": 300,
    "dept": "School Education",
    "align": "Direct",
    "action": "Offer Model School protocol as the safety layer of Palli Niraivu",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 1
    },
    "score": 7,
    "band": "Act now",
    "why": "3,734 schools are being physically modernised under Palli Niraivu. A safety protocol layered onto a rebuild costs far less than retrofitting one later.",
    "firstStep": "Get the Palli Niraivu school list for your district and offer the Model School protocol for the schools already in the programme.",
    "owner": "Chapter MASOOM Convener",
    "window": "While the rebuild programme is running",
    "proof": "Model School protocol adopted in at least one Palli Niraivu school"
  },
  {
    "pillar": "Nation Building",
    "vertical": "MASOOM",
    "programme": "Parent POCSO awareness",
    "target": "Minimum 3 sessions per quarter",
    "scheme": "Singapenn Special Task Force — proactive crime prevention",
    "para": "143",
    "crore": 354,
    "dept": "Home, Prohibition & Excise",
    "align": "Direct",
    "action": "Deliver through Singapenn's community outreach, co-branded",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 1
    },
    "score": 7,
    "band": "Act now",
    "why": "Singapenn is explicitly proactive crime prevention. Parent POCSO awareness is proactive prevention aimed at the same offence class.",
    "firstStep": "Ask the district Singapenn unit to co-brand parent POCSO sessions, so parents hear it from Yi and the police together.",
    "owner": "Chapter MASOOM Convener",
    "window": "This quarter",
    "proof": "One co-branded session held with Singapenn officers present"
  },
  {
    "pillar": "Nation Building",
    "vertical": "MASOOM",
    "programme": "Training of Trainers (Arpan / Muktha)",
    "target": "2,000+ certified trainers nationally",
    "scheme": "School Education curriculum revision — gender equality module",
    "para": "15",
    "crore": 25,
    "dept": "School Education",
    "align": "Partial",
    "action": "Offer the TOT cadre as trainers for the new curriculum module",
    "scores": {
      "outcome": 1,
      "people": 1,
      "timing": 2,
      "invitation": 1
    },
    "score": 5,
    "band": "Open a door",
    "why": "A certified trainer cadre is an asset the curriculum revision could use, but the revision funds content design, not trainer supply. The link is opportunistic.",
    "firstStep": "Log the SRTN certified-trainer count and hold it ready as an offer when the gender-equality module needs delivery capacity.",
    "owner": "SRTN RM MASOOM — Yadhavi Yogesh",
    "window": "When the curriculum module reaches delivery",
    "proof": "A trainer count on record with the region"
  },
  {
    "pillar": "Nation Building",
    "vertical": "MASOOM",
    "programme": "Digilante 2.0 — cyber safety",
    "target": "Minimum 3 sessions per quarter",
    "scheme": "Curriculum revision — digital competence",
    "para": "15",
    "crore": 25,
    "dept": "School Education",
    "align": "Partial",
    "action": "Cyber safety is not separately funded; ride the curriculum module",
    "scores": {
      "outcome": 1,
      "people": 2,
      "timing": 2,
      "invitation": 1
    },
    "score": 6,
    "band": "Open a door",
    "why": "Cyber safety is not separately funded anywhere in this budget. It sits under 'digital competence' in the curriculum revision, which is a small ₹25 cr line covering many subjects.",
    "firstStep": "Do not seek funding. Deliver Digilante inside existing Thalir schools and document reach, so cyber safety has evidence when it is next funded.",
    "owner": "Chapter MASOOM Convener",
    "window": "Ongoing",
    "proof": "Quarterly session count recorded per school"
  },
  {
    "pillar": "Nation Building",
    "vertical": "MASOOM",
    "programme": "Rural outreach — slums & tribal",
    "target": "Minimum 1 session per quarter",
    "scheme": "Aandror Membattu Thittam — tribal habitation development",
    "para": "41",
    "crore": 250,
    "dept": "Social Justice (Tribal Welfare)",
    "align": "Direct",
    "action": "Route through Tribal Sub-Plan habitations, not ad hoc",
    "scores": {
      "outcome": 1,
      "people": 2,
      "timing": 2,
      "invitation": 1
    },
    "score": 6,
    "band": "Open a door",
    "why": "Aandror Membattu upgrades tribal habitations broadly; Yi's rural MASOOM outreach reaches the same communities but addresses a different need within them.",
    "firstStep": "Route quarterly rural sessions through habitations already listed under the Tribal Sub-Plan rather than choosing villages independently.",
    "owner": "Chapter MASOOM Convener",
    "window": "Each quarter",
    "proof": "Sessions held in a Tribal Sub-Plan habitation"
  },
  {
    "pillar": "Nation Building",
    "vertical": "Accessibility",
    "programme": "Yi SARV-SUGAMYA — public space audits",
    "target": "2,500 public places audited nationally",
    "scheme": "People-friendly streets; accessibility for all in street redesign",
    "para": "111, 108",
    "crore": null,
    "dept": "Municipal Administration & Water Supply",
    "align": "Direct",
    "action": "Audit BEFORE the redesign tenders are drawn — timing is the whole value",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 1
    },
    "score": 7,
    "band": "Act now",
    "why": "Both are about whether a public place can actually be used by everyone. The timing is the whole value — audits before the redesign tenders are drawn, not after.",
    "firstStep": "Get the list of streets scheduled for people-friendly redesign in your city and audit those specific streets first.",
    "owner": "SRTN RM Accessibility — Srivas A (Chennai)",
    "window": "Before 31 August 2026 — the Sarv-Sugamya deadline",
    "proof": "5 audited public places submitted, at least 3 on the redesign list"
  },
  {
    "pillar": "Nation Building",
    "vertical": "Accessibility",
    "programme": "Project Smile — inclusive job fairs",
    "target": "15 jobs offered & appointments issued per chapter",
    "scheme": "Vetri Skill Training Scheme; Differently Abled welfare",
    "para": "27, 49",
    "crore": 150,
    "dept": "Labour Welfare & Skill Development",
    "align": "Direct",
    "action": "Run Project Smile as a Vetri Skill placement channel for PwD",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 2
    },
    "score": 8,
    "band": "Act now",
    "why": "Vetri Skill is explicitly delivered 'in collaboration with Government and private industries'. Project Smile is an employer-facing job fair for PwD. The budget invites exactly this.",
    "firstStep": "Collect firm commitments for 15 PwD placements from member companies, then take the number to the Skill Development Dept — not a proposal, a supply.",
    "owner": "Chapter Accessibility Convener with Entrepreneurship Convener",
    "window": "This quarter",
    "proof": "15 appointment letters issued"
  },
  {
    "pillar": "Nation Building",
    "vertical": "Accessibility",
    "programme": "School & college accessibility audits",
    "target": "25% of Thalir schools and YUVA colleges 100% accessible",
    "scheme": "Palli Niraivu Thittam — infrastructure to recommended norms",
    "para": "13",
    "crore": 300,
    "dept": "School Education",
    "align": "Direct",
    "action": "Audit the 3,734 schools while they are being rebuilt, not after",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 1
    },
    "score": 7,
    "band": "Act now",
    "why": "25% of Thalir schools and YUVA colleges 100% accessible is Yi's own target; ¶13 rebuilds 3,734 schools to 'recommended norms'. Audit during the rebuild or the chance is gone.",
    "firstStep": "Audit the Palli Niraivu schools in your district now, while drawings can still change.",
    "owner": "Chapter Accessibility Convener",
    "window": "While Palli Niraivu works are in progress",
    "proof": "Audit findings submitted before a school's works complete"
  },
  {
    "pillar": "Nation Building",
    "vertical": "Accessibility",
    "programme": "Adrishya Kaaravaan — PwD-led sensitisation",
    "target": "Experiential sessions per chapter",
    "scheme": "Nambikkai Illam — intellectual disability institutions, 5 districts",
    "para": "48",
    "crore": 4,
    "dept": "Welfare of Differently Abled Persons",
    "align": "Direct",
    "action": "Salem and Sivakasi (Virudhunagar) chapters sit in named districts",
    "scores": {
      "outcome": 1,
      "people": 2,
      "timing": 1,
      "invitation": 1
    },
    "score": 5,
    "band": "Open a door",
    "why": "Nambikkai Illam institutions are being established, not yet running. Sensitisation is valuable but there is no operating counterpart to work with yet.",
    "firstStep": "Salem and Sivakasi only: register interest with the district Differently Abled Welfare office to run sensitisation once the institution opens.",
    "owner": "Salem and Sivakasi Chapter Accessibility Conveners",
    "window": "When the institution opens",
    "proof": "Named as a partner at the institution's launch"
  },
  {
    "pillar": "Nation Building",
    "vertical": "Accessibility",
    "programme": "National Accessibility Summit + White Paper",
    "target": "23 October 2026",
    "scheme": "AI-based assistive devices subsidy up to ₹30,000",
    "para": "47",
    "crore": null,
    "dept": "Welfare of Differently Abled Persons",
    "align": "Partial",
    "action": "Use the White Paper to comment on assistive-device coverage gaps",
    "scores": {
      "outcome": 1,
      "people": 1,
      "timing": 2,
      "invitation": 1
    },
    "score": 5,
    "band": "Open a door",
    "why": "A White Paper is advocacy, not delivery. Its value here is that it can comment on a live State scheme — the assistive-device subsidy — rather than in general.",
    "firstStep": "Add a Tamil Nadu section to the White Paper covering gaps in the ₹30,000 assistive-device subsidy.",
    "owner": "SRTN RM Accessibility — Srivas A (Chennai)",
    "window": "National Accessibility Summit, 23 October 2026",
    "proof": "A TN-specific section in the published White Paper"
  },
  {
    "pillar": "Nation Building",
    "vertical": "Accessibility",
    "programme": "Railway Station Initiative",
    "target": "100 stations converged via CSR",
    "scheme": "No State scheme — railways is a Union subject",
    "para": "—",
    "crore": null,
    "dept": "(Union — Indian Railways)",
    "align": "None",
    "action": "Do not present this to a State department",
    "scores": {
      "outcome": 1,
      "people": 1,
      "timing": 0,
      "invitation": 0
    },
    "score": 2,
    "band": "Not this year",
    "why": "Railways is a Union subject. There is no State scheme, no State counterpart and no State money. Presenting this to a TN department wastes the meeting.",
    "firstStep": "Do not raise this with any State department. Pursue it separately through the Divisional Railway Manager and CSR.",
    "owner": "Chapter Accessibility Convener",
    "window": "Outside this alignment entirely",
    "proof": "n/a"
  },
  {
    "pillar": "Nation Building",
    "vertical": "Climate Change",
    "programme": "Yi Green Challenge — tree plantation",
    "target": "10 lakh+ saplings nationally; 5,000 per chapter",
    "scheme": "Green Tamil Nadu Mission; TN-SHORE mangrove restoration, 2,500 ha",
    "para": "127",
    "crore": 322,
    "dept": "Environment, Climate Change & Forests",
    "align": "Direct",
    "action": "Kanniyakumari is a named TN-SHORE district — lead there",
    "scores": {
      "outcome": 2,
      "people": 1,
      "timing": 2,
      "invitation": 1
    },
    "score": 6,
    "band": "Open a door",
    "why": "Yi plants 5,000 trees per chapter; the State runs Green Tamil Nadu and TN-SHORE. Same outcome, but the State works through the Forest Dept, not volunteers, so entry needs negotiating.",
    "firstStep": "Ask the District Forest Officer where survival rates are weakest and plant there, tracking survival rather than count.",
    "owner": "Chapter Climate Change Convener",
    "window": "Climate Action Week, 5–12 September 2026",
    "proof": "12-month survival rate reported, not sapling count"
  },
  {
    "pillar": "Nation Building",
    "vertical": "Climate Change",
    "programme": "Water Warriors",
    "target": "5 clean-ups + 2 rejuvenation per chapter; 10,000 cu.m national",
    "scheme": "Protection of urban water bodies; blue-green infrastructure",
    "para": "107, 109",
    "crore": 2117,
    "dept": "Municipal Administration & Water Supply",
    "align": "Direct",
    "action": "Map chapter water bodies into the CM Urban Mission list",
    "scores": {
      "outcome": 2,
      "people": 1,
      "timing": 2,
      "invitation": 1
    },
    "score": 6,
    "band": "Open a door",
    "why": "Protecting urban water bodies is named in the CM Urban Mission. Water Warriors does the same work, but the Mission is corporation-led and Yi is not yet in its plan.",
    "firstStep": "Take your chapter's cleaned water bodies to the corporation and ask for them to be added to the Mission's protected list.",
    "owner": "SRTN RM Climate Change — Prashanth Ram (Vellore)",
    "window": "Climate Action Week, 5–12 September 2026",
    "proof": "One water body added to the corporation's list"
  },
  {
    "pillar": "Nation Building",
    "vertical": "Climate Change",
    "programme": "E-Waste Collective Drives",
    "target": "1,000 kg per chapter; 25,000 kg national",
    "scheme": "Integrated solid waste management; TN-VETRI solid waste sub-mission",
    "para": "107, 133",
    "crore": 6000,
    "dept": "Municipal Admin / Rural Development",
    "align": "Direct",
    "action": "E-waste is unclaimed in both missions — easiest first win",
    "scores": {
      "outcome": 2,
      "people": 1,
      "timing": 2,
      "invitation": 1
    },
    "score": 6,
    "band": "Open a door",
    "why": "E-waste is the least-claimed slice of both solid waste missions. Neither TN-VETRI nor the Urban Mission names an e-waste operator — the easiest space to occupy.",
    "firstStep": "Offer the chapter e-waste drive as the city's e-waste channel and ask the corporation to publicise the collection point.",
    "owner": "Chapter Climate Change Convener",
    "window": "Climate Action Week, 5–12 September 2026",
    "proof": "Collection point listed on corporation communications"
  },
  {
    "pillar": "Nation Building",
    "vertical": "Climate Change",
    "programme": "My City, My Pride — heritage adoption",
    "target": "1 historical site per chapter",
    "scheme": "Tamil heritage sites on ECR; archaeological site tours for school students",
    "para": "170, 175",
    "crore": 5,
    "dept": "Tourism, Art & Culture",
    "align": "Direct",
    "action": "Adopt a site on the Keeladi / Adichanallur / Kodumanal tour list",
    "scores": {
      "outcome": 2,
      "people": 1,
      "timing": 2,
      "invitation": 1
    },
    "score": 6,
    "band": "Open a door",
    "why": "My City My Pride adopts one heritage site per chapter; ¶175 funds school visits to named archaeological sites. Adopt a site on the State's own tour list and the two reinforce.",
    "firstStep": "Adopt a site from the Keeladi / Adichanallur / Kodumanal list where your chapter is nearest.",
    "owner": "Chapter Climate Change Convener",
    "window": "This year",
    "proof": "A site adopted and one school visit hosted"
  },
  {
    "pillar": "Nation Building",
    "vertical": "Climate Change",
    "programme": "Green Torch Chapter",
    "target": "Plastic-free events, segregation, composting",
    "scheme": "Integrated solid waste management under CM Urban Mission",
    "para": "107",
    "crore": 2117,
    "dept": "Municipal Administration & Water Supply",
    "align": "Partial",
    "action": "Chapter-level practice; no funding interface",
    "scores": {
      "outcome": 1,
      "people": 0,
      "timing": 2,
      "invitation": 1
    },
    "score": 4,
    "band": "Re-scope first",
    "why": "Green Torch is about how Yi runs its own chapter. Worth doing, but it changes Yi's footprint, not the State's — there is no counterpart to engage.",
    "firstStep": "Keep internal. No departmental approach.",
    "owner": "Chapter Chair",
    "window": "Ongoing",
    "proof": "Plastic-free chapter events"
  },
  {
    "pillar": "Nation Building",
    "vertical": "Climate Change",
    "programme": "COP31 participation (9–20 Nov 2026)",
    "target": "National delegation",
    "scheme": "No State scheme",
    "para": "—",
    "crore": null,
    "dept": "(International)",
    "align": "None",
    "action": "Keep internal to Yi",
    "scores": {
      "outcome": 0,
      "people": 0,
      "timing": 1,
      "invitation": 0
    },
    "score": 1,
    "band": "Not this year",
    "why": "An international climate conference has no Tamil Nadu scheme behind it. Listed only so the absence is explicit.",
    "firstStep": "No State action.",
    "owner": "National team",
    "window": "COP31, 9–20 November 2026",
    "proof": "n/a"
  },
  {
    "pillar": "MYTRI Stakeholders",
    "vertical": "YUVA",
    "programme": "YUVA membership scale",
    "target": "1 million YUVA members by 2026",
    "scheme": "Vetri Skill Training — 12 lakh college students this year",
    "para": "27",
    "crore": 150,
    "dept": "Labour Welfare & Skill Development",
    "align": "Direct",
    "action": "Same population, same year — offer YUVA as the delivery network",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 2
    },
    "score": 8,
    "band": "Act now",
    "why": "Yi targets 1 million YUVA members; the State will skill 12 lakh college students this year and says it will do so with private industry. Same population, same year, invitation on the record.",
    "firstStep": "Present YUVA's SRTN campus network to the Skill Development Dept as a delivery channel with a stated reach number.",
    "owner": "Regional Chair with SRTN YUVA leads",
    "window": "This quarter, while the year's target is live",
    "proof": "A named role for YUVA in one district's Vetri Skill rollout"
  },
  {
    "pillar": "MYTRI Stakeholders",
    "vertical": "YUVA",
    "programme": "YUVA Centres of Excellence (CX)",
    "target": "10 CX established by 2026",
    "scheme": "AI Industry Development Program — 5 lakh youth by 2031, IIT Madras",
    "para": "28",
    "crore": null,
    "dept": "Labour Welfare & Skill Development",
    "align": "Direct",
    "action": "Site a CX at an engineering college inside the AI programme",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 1,
      "invitation": 1
    },
    "score": 6,
    "band": "Open a door",
    "why": "A YUVA Centre of Excellence and the AI Industry Development Program both build campus capability, but the AI programme runs to 2031 and is not seeking hosts yet.",
    "firstStep": "Site the next SRTN CX at an engineering college already inside the AI programme, so the two share infrastructure.",
    "owner": "Regional Chair",
    "window": "Before the next CX site is chosen",
    "proof": "CX located at an AI-programme campus"
  },
  {
    "pillar": "MYTRI Stakeholders",
    "vertical": "YUVA",
    "programme": "Future 6.0 — Youth Advocacy Summit",
    "target": "Sept 2026, chapter-led, with MPs and MLAs",
    "scheme": "Governance Processes Reforms Committee; Right to Services Act",
    "para": "151, 152",
    "crore": null,
    "dept": "Finance / Chief Secretary's office",
    "align": "Direct",
    "action": "The Committee explicitly seeks industry input — Future 6.0 is the vehicle",
    "scores": {
      "outcome": 2,
      "people": 1,
      "timing": 2,
      "invitation": 2
    },
    "score": 7,
    "band": "Act now",
    "why": "¶151 says the Governance Processes Reforms Committee will include 'industry transformation experts'. Future 6.0 convenes young industry leaders with MPs and MLAs. The door is named in the budget text.",
    "firstStep": "Write to the Chief Secretary's office offering Future 6.0 as a consultation forum for the Committee.",
    "owner": "Regional Chair",
    "window": "Future 6.0, September 2026 — approach now",
    "proof": "A Committee member or official attending Future 6.0"
  },
  {
    "pillar": "MYTRI Stakeholders",
    "vertical": "YUVA",
    "programme": "YUVA Partner Institutions",
    "target": "Onboard colleges per chapter",
    "scheme": "AI/ML trade in 50 ITIs; five new ITIs",
    "para": "25",
    "crore": 10,
    "dept": "Labour Welfare & Skill Development",
    "align": "Direct",
    "action": "Add ITIs and polytechnics to the partner list, not just degree colleges",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 1
    },
    "score": 7,
    "band": "Act now",
    "why": "Onboarding partner institutions matches the ITI and polytechnic expansion, but Yi's partner list is degree-college heavy and the schemes are weighted to ITIs.",
    "firstStep": "Add two ITIs or polytechnics to the chapter's YUVA partner list this year.",
    "owner": "Chapter YUVA Convener",
    "window": "This academic year",
    "proof": "Two ITI or polytechnic partners onboarded"
  },
  {
    "pillar": "MYTRI Stakeholders",
    "vertical": "YUVA",
    "programme": "YUVA Credit System / Record Attempts",
    "target": "Credit-based engagement; 1 record per chapter",
    "scheme": "No State scheme",
    "para": "—",
    "crore": null,
    "dept": "—",
    "align": "None",
    "action": "Internal engagement mechanics",
    "scores": {
      "outcome": 0,
      "people": 1,
      "timing": 1,
      "invitation": 0
    },
    "score": 2,
    "band": "Not this year",
    "why": "Credit systems and record attempts are internal engagement mechanics. No scheme, no counterpart, no money.",
    "firstStep": "Keep internal.",
    "owner": "Chapter YUVA Convener",
    "window": "Ongoing",
    "proof": "n/a"
  },
  {
    "pillar": "MYTRI Stakeholders",
    "vertical": "Thalir",
    "programme": "Expand Thalir school network",
    "target": "+50% schools per chapter",
    "scheme": "Super Clean Super Campus, 10,000 schools; Palli Niraivu, 3,734 schools",
    "para": "12, 13",
    "crore": 439,
    "dept": "School Education",
    "align": "Direct",
    "action": "Recruit new Thalir schools from the two scheme lists",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 1
    },
    "score": 7,
    "band": "Act now",
    "why": "Yi wants 50% more Thalir schools; the State is upgrading 10,000 campuses and rebuilding 3,734. The recruitment list is sitting in a government file.",
    "firstStep": "Ask the District Education Officer for the Super Clean and Palli Niraivu school lists and recruit new Thalir schools from them.",
    "owner": "Chapter Thalir Convener",
    "window": "This academic year",
    "proof": "New Thalir schools drawn from the scheme lists"
  },
  {
    "pillar": "MYTRI Stakeholders",
    "vertical": "Thalir",
    "programme": "School-level Thalir ECs (student leaders)",
    "target": "Student ECs in every Thalir school",
    "scheme": "Anti-Drug Clubs and student volunteer groups in schools",
    "para": "16",
    "crore": 7,
    "dept": "School Education",
    "align": "Direct",
    "action": "Offer the Thalir EC as the ready-made structure for the Anti-Drug Club",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 2
    },
    "score": 8,
    "band": "Act now",
    "why": "¶16 funds 'student volunteer groups' in schools. A school-level Thalir EC is a student volunteer group that already exists, already trained. The budget is describing Yi's structure.",
    "firstStep": "Offer the Thalir EC in each school as the constituted Anti-Drug Club, with the teacher-in-charge as the link.",
    "owner": "SRTN RM Thalir — Shenher Lal (Madurai)",
    "window": "Immediately — the scheme is funded and starting",
    "proof": "Thalir ECs formally recognised as Anti-Drug Clubs"
  },
  {
    "pillar": "MYTRI Stakeholders",
    "vertical": "Thalir",
    "programme": "Young Indians Parliament (YiP)",
    "target": "100% chapter participation",
    "scheme": "Curriculum revision — global citizenship, critical thinking",
    "para": "15",
    "crore": 25,
    "dept": "School Education",
    "align": "Direct",
    "action": "Position YiP as the practicum for the new civics curriculum",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 1
    },
    "score": 7,
    "band": "Act now",
    "why": "The curriculum revision names critical thinking and global citizenship. YiP is the practical version of exactly that — but it is a Yi programme, not a curriculum component.",
    "firstStep": "Offer YiP to the School Education Dept as the practicum for the new civics curriculum, using an SRTN event as the demonstration.",
    "owner": "National Thalir Chair — Pradeep Chanthirakumar (Trichy)",
    "window": "Before the revised curriculum is finalised",
    "proof": "A department observer at one SRTN YiP"
  },
  {
    "pillar": "MYTRI Stakeholders",
    "vertical": "Thalir",
    "programme": "Young Indians Quiz (YiQ)",
    "target": "New national launch 2026",
    "scheme": "Thirukkural recitation awards, 500 students; competitive exam preparedness",
    "para": "172, 15",
    "crore": null,
    "dept": "Tamil Development / School Education",
    "align": "Direct",
    "action": "Add a Thirukkural and Tamil-heritage round to YiQ in SRTN",
    "scores": {
      "outcome": 1,
      "people": 2,
      "timing": 2,
      "invitation": 1
    },
    "score": 6,
    "band": "Open a door",
    "why": "YiQ builds critical thinking, which the curriculum names, and the State separately funds Thirukkural recitation. Related, but YiQ is new and has no State counterpart yet.",
    "firstStep": "Add a Thirukkural and Tamil heritage round to YiQ in SRTN, making it legible to the Tamil Development Dept.",
    "owner": "SRTN RM Thalir — Shenher Lal (Madurai)",
    "window": "At the YiQ launch",
    "proof": "A Tamil round in the SRTN question set"
  },
  {
    "pillar": "MYTRI Stakeholders",
    "vertical": "Thalir",
    "programme": "Future Readiness — financial literacy, innovation mindset",
    "target": "Per Thalir school",
    "scheme": "Curriculum revision names financial literacy; TN SPARK to 2,600 more schools",
    "para": "15, 29",
    "crore": 25,
    "dept": "School Education",
    "align": "Direct",
    "action": "Financial literacy is named in the curriculum — supply the content",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 1
    },
    "score": 7,
    "band": "Act now",
    "why": "¶15 names financial literacy as a curriculum objective by name. Thalir's Future Readiness pillar covers exactly that, and Kid-preneur is the delivery vehicle.",
    "firstStep": "Package Kid-preneur as a ready financial-literacy module and offer it to the DEO for the schools already running TN SPARK.",
    "owner": "Chapter Thalir Convener",
    "window": "This academic year",
    "proof": "Module delivered in a SPARK school"
  },
  {
    "pillar": "MYTRI Stakeholders",
    "vertical": "Thalir",
    "programme": "Bharat Thalir Week",
    "target": "National week",
    "scheme": "Educational tours to archaeological sites for school students",
    "para": "175",
    "crore": 1,
    "dept": "Tamil Development",
    "align": "Partial",
    "action": "Anchor the SRTN week on a heritage site visit",
    "scores": {
      "outcome": 1,
      "people": 2,
      "timing": 1,
      "invitation": 1
    },
    "score": 5,
    "band": "Open a door",
    "why": "A national week aligned to a ₹1 cr heritage-tour line. Real but small, and the tour scheme is tiny relative to the week's ambition.",
    "firstStep": "Anchor the SRTN week on a visit to a named archaeological site so it plugs into the State's tour programme.",
    "owner": "Chapter Thalir Convener",
    "window": "Bharat Thalir Week",
    "proof": "A site visit held during the week"
  },
  {
    "pillar": "MYTRI Stakeholders",
    "vertical": "Rural Initiatives",
    "programme": "Rural Bazaar — SHG market access",
    "target": "During RI Week, 28 Jul – 3 Aug",
    "scheme": "Singappenngal Valimaippaduthum — ₹5 lakh subsidy per SHG enterprise; ₹38,000 cr SHG credit plan",
    "para": "137",
    "crore": null,
    "dept": "Rural Development & Panchayat Raj",
    "align": "Direct",
    "action": "State supplies capital, Yi supplies market access — clean division",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 1
    },
    "score": 7,
    "band": "Act now",
    "why": "The State supplies SHG capital — ₹5 lakh per enterprise against a ₹38,000 cr credit plan — and supplies no market. Rural Bazaar supplies market access. Clean division of labour.",
    "firstStep": "Ask the DRDA for SHGs that received the ₹5 lakh subsidy and invite those specific groups to the next Rural Bazaar.",
    "owner": "SRTN RM Rural Initiatives — Mohan Kumar (Tirupur)",
    "window": "RI Week, 28 July – 3 August 2027; approach the DRDA now",
    "proof": "Subsidised SHGs trading at a Yi bazaar"
  },
  {
    "pillar": "MYTRI Stakeholders",
    "vertical": "Rural Initiatives",
    "programme": "Adopt rural networks (village/panchayat/SHG/artisan)",
    "target": "1–2 per chapter; no MOU required",
    "scheme": "TN-VETRI — village empowerment, with sub-missions and departmental convergence",
    "para": "133, 134",
    "crore": 6000,
    "dept": "Rural Development & Panchayat Raj",
    "align": "Direct",
    "action": "Enter as a TN-VETRI convergence partner at BLOCK level; drop standalone adoption",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 2
    },
    "score": 8,
    "band": "Act now",
    "why": "TN-VETRI was built to 'converge with the needs and resources of other departments' and is chaired at Minister level. It is a convergence vehicle actively looking for partners.",
    "firstStep": "Stop adopting villages independently. Ask the BDO which blocks are under TN-VETRI and adopt inside one.",
    "owner": "Chapter Rural Initiatives Convener",
    "window": "This quarter",
    "proof": "An adopted network inside a TN-VETRI block"
  },
  {
    "pillar": "MYTRI Stakeholders",
    "vertical": "Rural Initiatives",
    "programme": "Rural sports infrastructure",
    "target": "1 facility + community tournament per chapter",
    "scheme": "Neighbourhood sports facilities in all blocks and ULBs; TN Rural Sports Competition",
    "para": "34, 33",
    "crore": 42,
    "dept": "Youth Welfare & Sports Development",
    "align": "Direct",
    "action": "Yi builds one, the State is building in every block — converge",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 1
    },
    "score": 7,
    "band": "Act now",
    "why": "Yi builds one rural sports facility per chapter; the State is building in every block and ULB. Yi's single facility is marginal unless it attaches to the State programme.",
    "firstStep": "Offer to run and maintain one State-built neighbourhood facility rather than building a parallel one.",
    "owner": "Chapter Sports Convener with RI Convener",
    "window": "As block facilities are commissioned",
    "proof": "A maintenance or programming role at one State facility"
  },
  {
    "pillar": "MYTRI Stakeholders",
    "vertical": "Rural Initiatives",
    "programme": "Range De — eco-friendly colours, artisans",
    "target": "National artisan livelihood initiative",
    "scheme": "TN Palmyra Development Corporation; TN Institute of Design",
    "para": "90, 88",
    "crore": 76,
    "dept": "Handlooms, Handicrafts, Textiles & Khadi",
    "align": "Direct",
    "action": "Tirupur, Karur, Kanchipuram chapters sit on named clusters",
    "scores": {
      "outcome": 1,
      "people": 2,
      "timing": 1,
      "invitation": 1
    },
    "score": 5,
    "band": "Open a door",
    "why": "Range De supports artisans; the Palmyra Corporation and Institute of Design support artisans. Same people, but both State bodies are still being established.",
    "firstStep": "Register the chapter's artisan groups with the Handlooms Dept now, so they are on the list when the Corporation begins operating.",
    "owner": "Chapter Rural Initiatives Convener",
    "window": "Before the Corporation is operational",
    "proof": "Artisan groups registered with the department"
  },
  {
    "pillar": "MYTRI Stakeholders",
    "vertical": "Rural Initiatives",
    "programme": "Preserving rural heritage",
    "target": "Identify and support rural heritage sites",
    "scheme": "Tamil Nadu Eco-Tourism Mission — 'through active community participation'",
    "para": "169",
    "crore": 25,
    "dept": "Tourism, Art & Culture",
    "align": "Direct",
    "action": "The scheme text invites community participation by name",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 2
    },
    "score": 8,
    "band": "Act now",
    "why": "The Eco-Tourism Mission says it will be implemented 'through active community participation' and Yi's rural heritage work is community-anchored by design. The invitation is in the scheme text.",
    "firstStep": "Nominate one rural heritage site from your chapter for the Eco-Tourism Mission circuit, with the community leader as the named anchor.",
    "owner": "Chapter Rural Initiatives Convener",
    "window": "This year, while circuits are being defined",
    "proof": "A site accepted into the Mission circuit"
  },
  {
    "pillar": "MYTRI Stakeholders",
    "vertical": "Rural Initiatives",
    "programme": "Rural Rise 2.0 (at YiFi 2026)",
    "target": "Conclave for rural entrepreneurs",
    "scheme": "Vetri Entrepreneur Scheme — capital subsidy and interest subvention",
    "para": "37",
    "crore": 75,
    "dept": "Social Justice",
    "align": "Partial",
    "action": "Invite scheme beneficiaries as delegates rather than seeking funds",
    "scores": {
      "outcome": 1,
      "people": 2,
      "timing": 1,
      "invitation": 1
    },
    "score": 5,
    "band": "Open a door",
    "why": "A conclave for rural entrepreneurs relates to the Vetri Entrepreneur Scheme, but Rural Rise sits inside YiFi in June and the scheme is running now.",
    "firstStep": "Invite Vetri Entrepreneur Scheme beneficiaries as delegates rather than seeking any funding.",
    "owner": "Chapter Rural Initiatives Convener",
    "window": "YiFi 2027",
    "proof": "Scheme beneficiaries attending as delegates"
  },
  {
    "pillar": "MYTRI Stakeholders",
    "vertical": "Membership",
    "programme": "Membership growth",
    "target": "9,000+ active members; 6 new chapters",
    "scheme": "No State scheme — internal by design",
    "para": "—",
    "crore": null,
    "dept": "—",
    "align": "Internal",
    "action": "Do not present this to a department",
    "scores": {
      "outcome": 0,
      "people": 0,
      "timing": 1,
      "invitation": 0
    },
    "score": 1,
    "band": "Not this year",
    "why": "Membership growth is Yi's internal engine. No policy surface, and giving it one would damage credibility in a first meeting.",
    "firstStep": "Keep internal.",
    "owner": "Chapter Chair",
    "window": "Ongoing",
    "proof": "n/a"
  },
  {
    "pillar": "Youth Leadership",
    "vertical": "Entrepreneurship",
    "programme": "Naukri Bazaar / Job Fair (YUVA)",
    "target": "Employability bridge per chapter",
    "scheme": "Vetri Skill Training — 20,000 internships with stipend, 'in collaboration with private industries'",
    "para": "27",
    "crore": 150,
    "dept": "Labour Welfare & Skill Development",
    "align": "Direct",
    "action": "BIGGEST SINGLE OPENING — approach with committed places, not a proposal",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 2
    },
    "score": 8,
    "band": "Act now",
    "why": "The budget funds 20,000 stipended internships and says they will be delivered with private industry. Naukri Bazaar connects students to employers. Yi is the employer network.",
    "firstStep": "Collect signed internship commitments from member firms — a count, not an intent — then take that number to the Skill Development Dept.",
    "owner": "Chapter Entrepreneurship Convener — Neil Kikani (Coimbatore) for SRTN",
    "window": "This quarter, while the year's target is live",
    "proof": "A committed internship count on paper before the first meeting"
  },
  {
    "pillar": "Youth Leadership",
    "vertical": "Entrepreneurship",
    "programme": "YiBE — Yi Business Exchange",
    "target": "Extend YiBE to YUVA",
    "scheme": "Tamil Nadu Industrial Capability Directory — digital listing of manufacturing capability",
    "para": "78",
    "crore": null,
    "dept": "Industries, Investment Promotion & Commerce",
    "align": "Direct",
    "action": "Offer SRTN member firms as the seed dataset for the Directory",
    "scores": {
      "outcome": 2,
      "people": 1,
      "timing": 1,
      "invitation": 1
    },
    "score": 5,
    "band": "Open a door",
    "why": "The State is building an Industrial Capability Directory; YiBE is a working business exchange. The idea matches, but the Directory is announced, not built, so there is nothing to plug into yet.",
    "firstStep": "Offer SRTN member firms as a seed dataset when the Directory opens for listings.",
    "owner": "Chapter Entrepreneurship Convener",
    "window": "When the Directory opens",
    "proof": "Member firms listed in the State directory"
  },
  {
    "pillar": "Youth Leadership",
    "vertical": "Entrepreneurship",
    "programme": "YiFi Summit (June 2026)",
    "target": "Flagship finance and startup conclave",
    "scheme": "Non-Resident Tamil Investment Facilitation Desk; Guidance 3.0 investment platform",
    "para": "80, 79",
    "crore": null,
    "dept": "Industries, Investment Promotion & Commerce",
    "align": "Direct",
    "action": "Bring the NRT desk on stage at YiFi — its first public outing",
    "scores": {
      "outcome": 1,
      "people": 1,
      "timing": 1,
      "invitation": 1
    },
    "score": 4,
    "band": "Re-scope first",
    "why": "YiFi is a finance and startup conclave; the NRT Desk and Guidance 3.0 are investment facilitation. Related audiences, but YiFi is in June and both State tools are new.",
    "firstStep": "Invite the Non-Resident Tamil Investment Desk to present at YiFi 2027 — its first public outing.",
    "owner": "National Entrepreneurship team with SRTN",
    "window": "YiFi Summit, June 2027",
    "proof": "NRT Desk on the YiFi programme"
  },
  {
    "pillar": "Youth Leadership",
    "vertical": "Entrepreneurship",
    "programme": "Kid-preneur Program (Thalir)",
    "target": "Structured workshops for select Thalir",
    "scheme": "Curriculum revision — financial literacy for school children",
    "para": "15",
    "crore": 25,
    "dept": "School Education",
    "align": "Direct",
    "action": "Offer Kid-preneur as the financial literacy delivery module",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 1
    },
    "score": 7,
    "band": "Act now",
    "why": "Kid-preneur teaches business skills to school children; ¶15 names financial literacy as a curriculum objective. Same children, same skill, same year.",
    "firstStep": "Offer Kid-preneur as a plug-in module to the DEO alongside the Thalir Future Readiness work.",
    "owner": "Chapter Entrepreneurship Convener with Thalir Convener",
    "window": "This academic year",
    "proof": "Module accepted in at least one government school"
  },
  {
    "pillar": "Youth Leadership",
    "vertical": "Entrepreneurship",
    "programme": "Bharat Entrepreneurship Week (5–11 Mar)",
    "target": "National week",
    "scheme": "MSME capital subsidy; TN Women Entrepreneurs Empowerment Scheme",
    "para": "85",
    "crore": 577,
    "dept": "Micro, Small and Medium Enterprises",
    "align": "Partial",
    "action": "Use BEW to publicise the two subsidy schemes; no funding ask",
    "scores": {
      "outcome": 1,
      "people": 1,
      "timing": 1,
      "invitation": 1
    },
    "score": 4,
    "band": "Re-scope first",
    "why": "An entrepreneurship week can publicise the MSME subsidy schemes, but publicity is not delivery and BEW is in March.",
    "firstStep": "Use BEW 2027 to publicise the ₹225 cr women entrepreneurs and ₹352 cr capital subsidy schemes. No funding ask.",
    "owner": "Chapter Entrepreneurship Convener",
    "window": "BEW, 5–11 March 2027",
    "proof": "Scheme applications generated from the week"
  },
  {
    "pillar": "Youth Leadership",
    "vertical": "Entrepreneurship",
    "programme": "Bharat Billion Impact Challenge (Sept 2026)",
    "target": "YUVA employability challenge",
    "scheme": "Vetri Skill Training — 1 lakh unemployed youth",
    "para": "27",
    "crore": 150,
    "dept": "Labour Welfare & Skill Development",
    "align": "Partial",
    "action": "Align the challenge brief to the scheme's priority cohort",
    "scores": {
      "outcome": 1,
      "people": 2,
      "timing": 2,
      "invitation": 1
    },
    "score": 6,
    "band": "Open a door",
    "why": "The challenge targets employability for the same youth the scheme targets, but the challenge is a competition and the scheme is training at scale.",
    "firstStep": "Write the challenge brief around the scheme's priority cohort — youth from families without permanent employment.",
    "owner": "Chapter Entrepreneurship Convener",
    "window": "Bharat Billion Impact Challenge, September 2026",
    "proof": "Brief published naming the priority cohort"
  },
  {
    "pillar": "Youth Leadership",
    "vertical": "Innovation",
    "programme": "IDS 6 — Ideate, Define, Showcase (YUVA)",
    "target": "KPI: 'Partnership with Government — Yes'",
    "scheme": "TN AI Mission; Arivagam AI & Innovation City; Guidance 3.0",
    "para": "94, 83, 79",
    "crore": null,
    "dept": "AI, IT & Digital Services / Industries",
    "align": "Direct",
    "action": "Yi's own KPI REQUIRES a government partner — this budget supplies four",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 1,
      "invitation": 2
    },
    "score": 7,
    "band": "Act now",
    "why": "Yi's own IDS 6 KPI reads 'Partnership with Government — Yes'. This budget supplies four possible partners. The requirement is Yi's; the supply is the State's.",
    "firstStep": "Register IDS 6 problem statements against a real State problem — Arivagam, TN AI Mission or Guidance 3.0 — instead of inventing them.",
    "owner": "National Innovation Chair — Kumaravel (Erode), with SRTN RM Jothi (Hosur)",
    "window": "Before the next IDS cycle opens",
    "proof": "A State-sourced problem statement in the IDS set"
  },
  {
    "pillar": "Youth Leadership",
    "vertical": "Innovation",
    "programme": "InnovX (Thalir, Classes 4–9)",
    "target": "3–5 teams per Thalir school; Feb & Jul 2026",
    "scheme": "TN SPARK — AI, robotics and online tools, expanded to 2,600 more schools",
    "para": "29",
    "crore": null,
    "dept": "School Education",
    "align": "Direct",
    "action": "Near-identical scope and age band — merge rather than duplicate",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 1
    },
    "score": 7,
    "band": "Act now",
    "why": "InnovX runs Classes 4–9; TN SPARK runs Classes 6–12 across 7,600 schools with a three-tier framework. These are near-duplicates and Yi's is far smaller.",
    "firstStep": "Do not run InnovX in parallel. Offer it as enrichment inside SPARK schools and align the age tiers.",
    "owner": "Chapter Innovation Convener",
    "window": "Before the next InnovX cycle",
    "proof": "InnovX delivered inside a SPARK school"
  },
  {
    "pillar": "Youth Leadership",
    "vertical": "Innovation",
    "programme": "Innovation Clubs in YUVA colleges",
    "target": "One per chapter",
    "scheme": "AI Industry Development Program — engineering colleges, polytechnics, ITIs",
    "para": "28",
    "crore": null,
    "dept": "Labour Welfare & Skill Development",
    "align": "Direct",
    "action": "Register clubs as the campus arm of the AI programme",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 1
    },
    "score": 7,
    "band": "Act now",
    "why": "Innovation Clubs on campuses and the AI Industry Development Program both build campus innovation capability for the same students.",
    "firstStep": "Register chapter Innovation Clubs as the campus arm of the AI programme at colleges already inside it.",
    "owner": "SRTN RM Innovation — Jothi (Hosur)",
    "window": "This academic year",
    "proof": "Clubs recognised at an AI-programme college"
  },
  {
    "pillar": "Youth Leadership",
    "vertical": "Innovation",
    "programme": "Innovation Week (3–7 Aug) — AI for Yi, prototyping, robotics",
    "target": "Minimum 3 activities, all 4 stakeholders",
    "scheme": "TN SPARK three-tier framework; AI/ML trade in 50 ITIs",
    "para": "29, 25",
    "crore": 10,
    "dept": "School Education / Labour Welfare",
    "align": "Direct",
    "action": "Run Innovation Week inside SPARK schools and the new ITI trades",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 1,
      "invitation": 1
    },
    "score": 6,
    "band": "Open a door",
    "why": "Innovation Week's content — design thinking, prototyping, robotics, AI — is exactly the SPARK and ITI syllabus. But the 2026 week has just passed.",
    "firstStep": "Plan the 2027 week to run inside SPARK schools and the new AI/ML ITI trades rather than in Yi venues.",
    "owner": "Chapter Innovation Convener",
    "window": "Innovation Week, August 2027",
    "proof": "Week hosted on SPARK or ITI campuses"
  },
  {
    "pillar": "Youth Leadership",
    "vertical": "Innovation",
    "programme": "Rural Jugaad / Rural Mentoring",
    "target": "Mentor rural innovators to prototype",
    "scheme": "TN-VETRI convergence",
    "para": "133",
    "crore": 6000,
    "dept": "Rural Development & Panchayat Raj",
    "align": "Partial",
    "action": "Attach to an adopted TN-VETRI block",
    "scores": {
      "outcome": 1,
      "people": 1,
      "timing": 1,
      "invitation": 1
    },
    "score": 4,
    "band": "Re-scope first",
    "why": "Mentoring rural innovators is worthwhile but TN-VETRI funds infrastructure, not innovation mentoring. The connection is thin.",
    "firstStep": "Attach rural mentoring to an already-adopted TN-VETRI block rather than pitching it separately.",
    "owner": "Chapter Innovation Convener",
    "window": "Alongside rural network adoption",
    "proof": "Mentoring delivered in an adopted block"
  },
  {
    "pillar": "Youth Leadership",
    "vertical": "Learning",
    "programme": "Internships for YUVA in member organisations",
    "target": "Pathfinder target for the year",
    "scheme": "Vetri Skill — 20,000 stipended internships with private industry",
    "para": "27",
    "crore": 150,
    "dept": "Labour Welfare & Skill Development",
    "align": "Direct",
    "action": "EXACT MATCH: Yi's own target IS the State's scheme. Highest priority.",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 2
    },
    "score": 8,
    "band": "Act now",
    "why": "Yi's Pathfinder target is internships for YUVA within member organisations. ¶27 funds 20,000 stipended internships with private industry. Yi's target and the State's scheme are the same sentence.",
    "firstStep": "Count the internship places member firms will actually commit this year, get them in writing, and open the conversation with a number rather than a proposal.",
    "owner": "SRTN RM Learning — Yokesh (Karur), with Regional Chair",
    "window": "This quarter — highest priority in this document",
    "proof": "Signed commitments from member firms, then a departmental meeting"
  },
  {
    "pillar": "Youth Leadership",
    "vertical": "Learning",
    "programme": "Financial & digital literacy for rural communities",
    "target": "Chapter-level capability build",
    "scheme": "e-Sevai 2.0; Namma Arasu WhatsApp chatbot expanding 76 → 275 services",
    "para": "95",
    "crore": null,
    "dept": "AI, IT & Digital Services",
    "align": "Direct",
    "action": "Teach the 275 services in villages; report which ones fail in the field",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 1
    },
    "score": 7,
    "band": "Act now",
    "why": "Yi teaches financial and digital literacy in rural areas; the State is expanding Namma Arasu from 76 to 275 services and upgrading e-Sevai. Teaching those services IS digital literacy.",
    "firstStep": "Teach the Namma Arasu services in adopted villages and report which ones fail in the field — that feedback is worth more than the teaching.",
    "owner": "Chapter Learning Convener",
    "window": "This quarter",
    "proof": "A field report on service failures sent to the IT Dept"
  },
  {
    "pillar": "Youth Leadership",
    "vertical": "Learning",
    "programme": "Yi Talks / peer learning / Inner Circles",
    "target": "Standardised reporting, central repository",
    "scheme": "District Employment & Career Guidance Centres — SSC, RRB, IBPS coaching",
    "para": "26",
    "crore": 3.38,
    "dept": "Labour Welfare & Skill Development",
    "align": "Partial",
    "action": "Offer member professionals as guest faculty at the district centres",
    "scores": {
      "outcome": 1,
      "people": 1,
      "timing": 2,
      "invitation": 1
    },
    "score": 5,
    "band": "Open a door",
    "why": "Yi Talks is peer learning among members; the District Career Guidance Centres coach for competitive exams. Different purposes, but Yi has professionals the centres lack.",
    "firstStep": "Offer member professionals as guest faculty at the District Employment and Career Guidance Centre.",
    "owner": "Chapter Learning Convener",
    "window": "This quarter",
    "proof": "One member teaching at a district centre"
  },
  {
    "pillar": "Youth Leadership",
    "vertical": "Learning",
    "programme": "CEO Leadership Mission / International Learning Mission",
    "target": "Q2 and Q3 2026",
    "scheme": "No State scheme",
    "para": "—",
    "crore": null,
    "dept": "—",
    "align": "None",
    "action": "Internal member development",
    "scores": {
      "outcome": 0,
      "people": 0,
      "timing": 1,
      "invitation": 0
    },
    "score": 1,
    "band": "Not this year",
    "why": "Leadership missions are internal member development. No scheme, no counterpart.",
    "firstStep": "Keep internal.",
    "owner": "Chapter Learning Convener",
    "window": "Q2–Q3",
    "proof": "n/a"
  },
  {
    "pillar": "Youth Leadership",
    "vertical": "Sports",
    "programme": "Thalir traditional sports festival",
    "target": "1 per chapter — Kabaddi, Kho-Kho, Carrom, Chess",
    "scheme": "Tamil Nadu Rural Sports Competition — traditional Tamil sports to the global stage",
    "para": "33",
    "crore": 42,
    "dept": "Youth Welfare & Sports Development",
    "align": "Direct",
    "action": "Same sports, same year — offer Thalir festivals as feeder rounds",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 1
    },
    "score": 7,
    "band": "Act now",
    "why": "Yi runs an inter-school traditional sports festival — Kabaddi, Kho-Kho, Carrom, Chess. The ₹42 cr Rural Sports Competition promotes traditional Tamil sports. Same sports, same year.",
    "firstStep": "Offer the Thalir festival as a feeder round to the State Rural Sports Competition.",
    "owner": "SRTN RM Sports — Karthigeyan Sampath (Karur)",
    "window": "Before the State competition calendar is fixed",
    "proof": "Thalir festival recognised as a qualifying round"
  },
  {
    "pillar": "Youth Leadership",
    "vertical": "Sports",
    "programme": "Rural sports facility development",
    "target": "1 facility per chapter + community tournament",
    "scheme": "Neighbourhood sports facilities and small gymnasiums in all blocks and ULBs",
    "para": "34",
    "crore": null,
    "dept": "Youth Welfare & Sports Development",
    "align": "Direct",
    "action": "Adopt maintenance of one State-built facility per chapter",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 1
    },
    "score": 7,
    "band": "Act now",
    "why": "Yi develops one rural sports facility per chapter; the State is building facilities in every block and ULB. Yi's marginal contribution is small; its maintenance capacity is not.",
    "firstStep": "Adopt programming and upkeep for one State-built facility instead of building a parallel one.",
    "owner": "Chapter Sports Convener",
    "window": "As facilities are commissioned",
    "proof": "A signed upkeep or programming arrangement"
  },
  {
    "pillar": "Youth Leadership",
    "vertical": "Sports",
    "programme": "Talent identification and development",
    "target": "Across members, YUVA, Thalir, rural",
    "scheme": "World-class training for school students aged 8–18; 10 Olympic Centres of Excellence",
    "para": "33",
    "crore": 55,
    "dept": "Youth Welfare & Sports Development",
    "align": "Direct",
    "action": "Feed identified talent into the Olympic CoE pipeline",
    "scores": {
      "outcome": 2,
      "people": 2,
      "timing": 2,
      "invitation": 1
    },
    "score": 7,
    "band": "Act now",
    "why": "Yi identifies sporting talent across four stakeholder groups; the State funds world-class training for 8–18 year olds and 10 Olympic Centres of Excellence. Yi finds them, the State trains them.",
    "firstStep": "Send identified 8–18 talent to the nearest Olympic Centre of Excellence trial rather than holding them in Yi events.",
    "owner": "Chapter Sports Convener",
    "window": "As the Centres open",
    "proof": "Identified athletes entering a State trial"
  },
  {
    "pillar": "Youth Leadership",
    "vertical": "Sports",
    "programme": "YUVA inter-collegiate tournament",
    "target": "1 per chapter, minimum 3 sports",
    "scheme": "'Take Up Sports, Give Up Drugs' Integrated Youth Development Programme with NCC and NSS",
    "para": "32",
    "crore": null,
    "dept": "Youth Welfare & Sports Development",
    "align": "Direct",
    "action": "Ask to be named alongside NCC and NSS in the programme",
    "scores": {
      "outcome": 1,
      "people": 2,
      "timing": 2,
      "invitation": 2
    },
    "score": 7,
    "band": "Act now",
    "why": "¶32 names NCC and NSS as the youth organisations to be integrated with Health, Police and Social Welfare. YUVA is a comparable network and is simply not named — that is the ask.",
    "firstStep": "Write to the Youth Welfare Dept asking for YUVA to be named alongside NCC and NSS in the Integrated Youth Development Programme.",
    "owner": "Regional Chair",
    "window": "While the programme is being set up",
    "proof": "YUVA named in a programme document"
  },
  {
    "pillar": "Youth Leadership",
    "vertical": "Sports",
    "programme": "Member tournaments",
    "target": "2 per chapter",
    "scheme": "No State scheme — internal",
    "para": "—",
    "crore": null,
    "dept": "—",
    "align": "Internal",
    "action": "Member engagement only",
    "scores": {
      "outcome": 0,
      "people": 0,
      "timing": 1,
      "invitation": 0
    },
    "score": 1,
    "band": "Not this year",
    "why": "Member tournaments are internal engagement. No policy surface.",
    "firstStep": "Keep internal.",
    "owner": "Chapter Sports Convener",
    "window": "Ongoing",
    "proof": "n/a"
  },
  {
    "pillar": "Youth Leadership",
    "vertical": "Branding",
    "programme": "One Yi voice / National Branding Week",
    "target": "30–40% digital growth",
    "scheme": "No State scheme — internal by design",
    "para": "—",
    "crore": null,
    "dept": "—",
    "align": "Internal",
    "action": "Do not present this to a department",
    "scores": {
      "outcome": 0,
      "people": 0,
      "timing": 1,
      "invitation": 0
    },
    "score": 1,
    "band": "Not this year",
    "why": "Branding is Yi-facing by design. Presenting it to a department would read as self-promotion.",
    "firstStep": "Keep internal.",
    "owner": "Chapter Branding Convener",
    "window": "National Branding Week, 24–31 August 2026",
    "proof": "n/a"
  },
  {
    "pillar": "Youth Leadership",
    "vertical": "International Membership",
    "programme": "Roots + Wings — Yi Circles abroad",
    "target": "Global members linked to home chapters",
    "scheme": "Non-Resident Tamil Investment Facilitation Desk within Guidance",
    "para": "80",
    "crore": null,
    "dept": "Industries, Investment Promotion & Commerce",
    "align": "Direct",
    "action": "Offer SRTN's diaspora members as the desk's first pipeline",
    "scores": {
      "outcome": 2,
      "people": 1,
      "timing": 1,
      "invitation": 1
    },
    "score": 5,
    "band": "Open a door",
    "why": "The Non-Resident Tamil Investment Desk wants diaspora investment; Yi International Membership is diaspora members rooted in home chapters. Strong idea, but the Desk is newly announced.",
    "firstStep": "Compile SRTN members living abroad and offer the list to the NRT Desk as its first pipeline once it opens.",
    "owner": "Regional Chair",
    "window": "When the NRT Desk begins operating",
    "proof": "A list handed over and one introduction made"
  }
];

export const CHAPTER_ROWS: ChapterRow[] = [
  {
    "chapter": "Coimbatore",
    "named": "Yes — human–wildlife conflict district",
    "scheme": "Conflict mitigation across 100 villages; Coimbatore–Ariyalur 765 KV line",
    "para": "128, 99",
    "vertical": "Climate Change",
    "move": "Take 5 conflict villages; Entrepreneurship Chair is Coimbatore-based"
  },
  {
    "chapter": "Erode",
    "named": "Yes — human–wildlife conflict district",
    "scheme": "Conflict mitigation across 100 villages",
    "para": "128",
    "vertical": "Innovation",
    "move": "National Innovation Chair is from Erode — lead IDS 6 government tie-up"
  },
  {
    "chapter": "Salem",
    "named": "Yes — Nambikkai Illam district; conflict district",
    "scheme": "Nambikkai Illam intellectual disability institution",
    "para": "48, 128",
    "vertical": "Accessibility",
    "move": "Adrishya Kaaravaan at the new institution; SRTN Road Safety RM is Salem"
  },
  {
    "chapter": "Sivakasi",
    "named": "Yes — Virudhunagar, a Nambikkai Illam district",
    "scheme": "Nambikkai Illam; MSME capital subsidy for the cluster",
    "para": "48, 85",
    "vertical": "Accessibility",
    "move": "Accessibility + MSME safety; SRTN Membership RM is Sivakasi"
  },
  {
    "chapter": "Dindigul",
    "named": "Yes — human–wildlife conflict district",
    "scheme": "Conflict mitigation across 100 villages",
    "para": "128",
    "vertical": "Climate Change",
    "move": "Water Warriors plus conflict-village work"
  },
  {
    "chapter": "Tirupur",
    "named": "Yes — conflict district",
    "scheme": "Tiruppur Textiles Technology Centre; Green Steel; conflict villages",
    "para": "91, 86, 128",
    "vertical": "Rural Initiatives",
    "move": "Range De with the textile artisan cluster; SRTN RI RM is Tirupur"
  },
  {
    "chapter": "Hosur",
    "named": "Yes — Krishnagiri, a conflict district",
    "scheme": "SIPCOT parks in backward districts; Hosur–Bommasandra metro proposal",
    "para": "81, 121",
    "vertical": "Innovation",
    "move": "Industrial skilling pipeline; SRTN Innovation RM is Hosur"
  },
  {
    "chapter": "Thoothukudi",
    "named": "Yes — Space Industrial Investment Zone",
    "scheme": "Space Zone anchored by Kulasekarapattinam spaceport, with IN-SPACe",
    "para": "82",
    "vertical": "Innovation",
    "move": "IDS 6 problem statements from the Space Zone; Climate Co-Chair is Thoothukudi"
  },
  {
    "chapter": "Kanniyakumari",
    "named": "Yes — TN-SHORE mangrove district",
    "scheme": "Mangrove afforestation across 2,500 hectares",
    "para": "127",
    "vertical": "Climate Change",
    "move": "Yi Green Challenge saplings inside TN-SHORE"
  },
  {
    "chapter": "Chennai",
    "named": "Yes — Third Master Plan, MY-HOME, Cooum & Adyar",
    "scheme": "Metropolitan planning; 1 lakh housing units; river restoration",
    "para": "102, 105, 112",
    "vertical": "Accessibility",
    "move": "Sarv-Sugamya audits before street-redesign tenders; Accessibility RM is Chennai"
  },
  {
    "chapter": "Madurai",
    "named": "Yes — Law College of Excellence; Vaigai riverfront",
    "scheme": "Government Law College 2027-28; river tourism",
    "para": "23, 167",
    "vertical": "Thalir",
    "move": "YiP with the new law school; SRTN Thalir RM is Madurai"
  },
  {
    "chapter": "Trichy",
    "named": "Yes — Kaveri riverfront corridor",
    "scheme": "Riverfront development, Hogenakkal to Srirangam",
    "para": "167",
    "vertical": "Thalir",
    "move": "National Thalir Chair is from Trichy — anchor YiQ launch"
  },
  {
    "chapter": "Vellore",
    "named": "Partly — SIPCOT backward-district parks",
    "scheme": "New industrial parks with district-specific plans",
    "para": "81",
    "vertical": "Entrepreneurship",
    "move": "Vetri Skill internships with park tenants; Climate RM is Vellore"
  },
  {
    "chapter": "Kanchipuram",
    "named": "Adjacent — Chengalpattu is a TN-SHORE district",
    "scheme": "TN Institute of Design; handloom and silk cluster",
    "para": "88, 127",
    "vertical": "Rural Initiatives",
    "move": "Range De with silk weavers; claim adjacency, never the district itself"
  },
  {
    "chapter": "Karur",
    "named": "Yes — home textiles cluster",
    "scheme": "TN Institute of Design; Technical Textiles Transformation Scheme",
    "para": "88, 89",
    "vertical": "Learning",
    "move": "Design economy; SRTN Learning RM and Sports RM are both Karur"
  }
];

export const GAP_ROWS: GapRow[] = [
  {
    "type": "Gap — no Yi vertical",
    "item": "Governance & public systems",
    "detail": "Right to Services Act; e-Sevai 2.0; Namma Arasu 76 → 275 services; Expenditure Reforms Committee",
    "para": "152, 95, 181",
    "crore": null,
    "recommendation": "Create a Governance vertical, absorbing the YiP civic engine — largest unclaimed surface"
  },
  {
    "type": "Gap — no Yi vertical",
    "item": "Ageing & elder care",
    "detail": "1,000 mobile geriatric centres; senior homes in 12 districts; recreation centres in 5",
    "para": "57, 52",
    "crore": 40,
    "recommendation": "Extend Health, or open an Elder Care sub-vertical"
  },
  {
    "type": "Gap — no Yi vertical",
    "item": "Gender-diverse inclusion",
    "detail": "Aran shelter homes in 5 districts; short-stay homes in 15; TNSDC skilling; ₹50,000 subsidy",
    "para": "54",
    "crore": null,
    "recommendation": "Widen Accessibility to Inclusion — today it is disability-only"
  },
  {
    "type": "Gap — no Yi vertical",
    "item": "Water security",
    "detail": "River linking; Cooum and Adyar restoration; Cauvery, Vaigai, Tamiraparani pollution DPRs",
    "para": "123, 112, 124",
    "crore": 225,
    "recommendation": "Climate Change treats water as one item; the State treats it as a standing crisis"
  },
  {
    "type": "Gap — no Yi vertical",
    "item": "Design & craft economy",
    "detail": "TN Institute of Design; Technical Textiles; Palmyra Corporation; Tiruppur TTTC",
    "para": "88, 89, 90, 91",
    "crore": 86,
    "recommendation": "Tirupur, Karur, Kanchipuram, Sivakasi chapters sit on these clusters with no vertical pointed at them"
  },
  {
    "type": "Do not chase",
    "item": "Vetri Laptop Scheme",
    "detail": "Procurement of laptops for college students",
    "para": "21",
    "crore": 2000,
    "recommendation": "Pure procurement — no partnership shape"
  },
  {
    "type": "Do not chase",
    "item": "Bicycles for Class XI",
    "detail": "5.32 lakh bicycles with helmets and water bottles",
    "para": "18",
    "crore": 277,
    "recommendation": "Pure procurement"
  },
  {
    "type": "Do not chase",
    "item": "Annan's Seer",
    "detail": "8 gram gold coin and silk saree at marriage",
    "para": "50",
    "crore": 812,
    "recommendation": "Direct benefit transfer"
  },
  {
    "type": "Do not chase",
    "item": "Thai Maaman Thanga Mothiram",
    "detail": "1 gram gold ring per newborn in Government hospitals",
    "para": "56",
    "crore": 560,
    "recommendation": "Direct benefit transfer"
  },
  {
    "type": "Do not chase",
    "item": "Palli Niraivu Thittam (construction)",
    "detail": "School building works — the CONSTRUCTION component only",
    "para": "13",
    "crore": 2132,
    "recommendation": "Construction is procurement. The audit and safety layers ARE open to Yi — see Matrix."
  },
  {
    "type": "Do not chase",
    "item": "Kamarajar Breakfast Scheme",
    "detail": "Expansion to Classes VI to VIII",
    "para": "51",
    "crore": 710,
    "recommendation": "Direct benefit transfer"
  },
  {
    "type": "Caution",
    "item": "Political framing",
    "detail": "The speech carries heavy party and leadership framing throughout",
    "para": "—",
    "crore": null,
    "recommendation": "Yi is non-political. Quote scheme names and ¶ numbers only, never political language."
  },
  {
    "type": "Caution",
    "item": "Conflict of interest",
    "detail": "Budget relaxed tender eligibility for young entrepreneurs and small businesses",
    "para": "8",
    "crore": null,
    "recommendation": "Yi members are that cohort. Write a declared-interest and recusal firewall BEFORE the first meeting."
  },
  {
    "type": "Caution",
    "item": "Data protection",
    "detail": "Field data collection involving minors and beneficiaries",
    "para": "—",
    "crore": null,
    "recommendation": "Limit to publicly observable facts until a lawful basis under DPDP is established."
  }
];

export const LEAD_ROWS: LeadRow[] = [
  {
    "vertical": "Accessibility",
    "name": "Srivas A",
    "chapter": "Chennai",
    "role": "RM — SRTN"
  },
  {
    "vertical": "Accessibility",
    "name": "Ashwin Manohar",
    "chapter": "Coimbatore",
    "role": "National Co-Chair"
  },
  {
    "vertical": "Branding",
    "name": "Anandakrishnan",
    "chapter": "Puducherry",
    "role": "RM — SRTN"
  },
  {
    "vertical": "Branding",
    "name": "Jayaprashanth Jayachandran",
    "chapter": "Coimbatore",
    "role": "National Chair"
  },
  {
    "vertical": "Climate Change",
    "name": "Prashanth Ram",
    "chapter": "Vellore",
    "role": "RM — SRTN"
  },
  {
    "vertical": "Climate Change",
    "name": "Christopher",
    "chapter": "Pudukkottai",
    "role": "RM — SRTN"
  },
  {
    "vertical": "Climate Change",
    "name": "T R K Dinesh",
    "chapter": "Thoothukudi",
    "role": "National Co-Chair"
  },
  {
    "vertical": "Entrepreneurship",
    "name": "Neil Kikani",
    "chapter": "Coimbatore",
    "role": "RM — SRTN"
  },
  {
    "vertical": "Health",
    "name": "JayaaVignesh Thangarajan",
    "chapter": "—",
    "role": "RM — SRTN"
  },
  {
    "vertical": "Innovation",
    "name": "Jothi",
    "chapter": "Hosur",
    "role": "RM — SRTN"
  },
  {
    "vertical": "Innovation",
    "name": "Kumaravel",
    "chapter": "Erode",
    "role": "National Chair"
  },
  {
    "vertical": "Learning",
    "name": "Yokesh",
    "chapter": "Karur",
    "role": "RM — SRTN"
  },
  {
    "vertical": "MASOOM",
    "name": "Yadhavi Yogesh",
    "chapter": "—",
    "role": "RM — SRTN"
  },
  {
    "vertical": "Membership",
    "name": "Shanmuga Nataraj",
    "chapter": "Sivakasi",
    "role": "RM — SRTN"
  },
  {
    "vertical": "Road Safety",
    "name": "Puvelan SV",
    "chapter": "Salem",
    "role": "RM — SRTN"
  },
  {
    "vertical": "Rural Initiatives",
    "name": "Mohan Kumar",
    "chapter": "Tirupur",
    "role": "RM — SRTN"
  },
  {
    "vertical": "Sports",
    "name": "Karthigeyan Sampath",
    "chapter": "Karur",
    "role": "RM — SRTN"
  },
  {
    "vertical": "Sports",
    "name": "Shrikumarswelu",
    "chapter": "Coimbatore",
    "role": "National Chair"
  },
  {
    "vertical": "Thalir",
    "name": "Shenher Lal",
    "chapter": "Madurai",
    "role": "RM — SRTN"
  },
  {
    "vertical": "Thalir",
    "name": "Pradeep Chanthirakumar",
    "chapter": "Trichy",
    "role": "National Chair"
  }
];
