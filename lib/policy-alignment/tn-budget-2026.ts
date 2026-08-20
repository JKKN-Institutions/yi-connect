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
 * A judgement against a fixed rubric (see RUBRIC), not a measurement. `why`
 * states the evidence behind each score.
 *
 * Action windows are forward-looking from 14 August 2026 and follow YI's
 * calendar. The State's own procurement and rollout timing is not known and is
 * not implied anywhere in this file.
 *
 * Also published as a spreadsheet for chapter circulation
 * (Yi-SRTN-x-TN-Budget-2026-27-Alignment.xlsx, kept outside the repo). Update
 * both together so the public page and the circulated file cannot drift.
 *
 * Framing: every row states what the DEPARTMENT gains, not what Yi does.
 * A Yi growth target is not a government benefit and must never be presented
 * as one — see POSITIONING.neverSay.
 *
 * Author: Ommsharravana — Chapter Chair, Yi Erode
 */

export type Alignment = 'Direct' | 'Partial' | 'None' | 'Internal';
export type Band = 'Act now' | 'Open a door' | 'Re-scope first' | 'Not this year';
export type Effort = 'Afternoon' | 'A week' | 'A quarter';
export type OwnerScope = 'chapter' | 'region' | 'named';

export type Scores = { outcome: number; people: number; timing: number; invitation: number };

export type AlignmentRow = {
  pillar: string; vertical: string; programme: string; target: string;
  scheme: string; para: string; crore: number | null; dept: string;
  align: Alignment; action: string; scores: Scores; score: number; band: Band;
  why: string; firstStep: string; owner: string; window: string; proof: string;
  effort: Effort; ownerRole: string; ownerScope: OwnerScope; namedChapters: string[];
  /** What the DEPARTMENT gets. The reason they would say yes. */
  govGain: string;
};

export type ChapterRow = { chapter: string; named: string; scheme: string; para: string; vertical: string; move: string };
export type GapRow = { type: string; item: string; detail: string; para: string; crore: number | null; recommendation: string; firstStep: string; owner: string; window: string; effort: Effort };
export type LeadRow = { vertical: string; name: string; chapter: string; role: string };

/** One concrete thing Yi does, stated as what the department gets for it. */
export type DeptOffer = {
  work: string;
  gains: string;
  costs: string;
  scale?: string;
};

export type DeptCase = {
  dept: string;
  budget: string;
  /** What this budget obliges the department to deliver. */
  mandate: string;
  para: string;
  /** What they are short of — the reason an outside partner is worth a meeting. */
  constraint: string;
  offers: DeptOffer[];
  /** What the department receives back as proof. */
  evidence: string;
};

export type Positioning = {
  headline: string;
  sub: string;
  assets: { title: string; body: string }[];
  say: string[];
  neverSay: string[];
  ask: string[];
};

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

export const EFFORT_META: { effort: Effort; blurb: string }[] = [
  { effort: 'Afternoon', blurb: 'One sitting — a letter, a list, a registration, a single ask.' },
  { effort: 'A week', blurb: 'A few visits or calls, or a small survey.' },
  { effort: 'A quarter', blurb: 'Sustained delivery across a term. Needs a team, not a volunteer.' },
];

export const SOURCE_NOTE =
  'Built from the Yi Leadership Academy 2026 Pathfinder one-pagers and the Tamil Nadu Budget Speech of 5 August 2026. Paragraph numbers cite the speech.';

export const AUTHOR = 'Ommsharravana — Chapter Chair, Yi Erode';

export const POSITIONING: Positioning = {
  "headline": "Yi is not asking the Government of Tamil Nadu for anything.",
  "sub": "It is offering the three things this budget cannot buy: employers who will act, hands in fifteen cities, and independent evidence that a scheme landed. In a year with a ₹55,775 crore revenue deficit, the organisation that arrives without an ask is the one that gets a second meeting.",
  "assets": [
    {
      "title": "Employers who will act",
      "body": "Yi is CII-affiliated. It is not a student body and not a grant-seeking NGO — it is young business owners and professionals. Three separate commitments in this budget need exactly that constituency: 20,000 internships 'in collaboration with private industries' (¶27), 'industry transformation experts' on the Governance Reforms Committee (¶151), and a CSR-funded disaster response fund (¶153). No other youth organisation in Tamil Nadu can supply an employer."
    },
    {
      "title": "Presence in fifteen cities",
      "body": "Departments run state-wide schemes from Chennai and learn implementation reality months later, filtered upward through district staff. Yi has resident, professionally credible people in fifteen cities who can look at something this week. Six of those cities sit inside districts this budget names by name."
    },
    {
      "title": "Independent evidence",
      "body": "The Expenditure Reforms Committee has been asked to judge whether welfare reaches its target beneficiaries (¶181). It has no field instrument, and buying one from a consultancy is the very expenditure it exists to cut. Yi can sample publicly observable facts across fifteen cities, publish the method, and hand over the data — keeping no exclusive copy."
    }
  ],
  "say": [
    "Cite the paragraph number. It proves the budget was read, and it moves the conversation from a pitch to a shared document in ninety seconds.",
    "Lead with what will be handed over, not with what access is wanted.",
    "State the ask plainly and keep it small: a letter, a list, an introduction. Nothing else.",
    "Say 'we are the industry side already named in ¶151' — it reframes Yi from applicant to specified constituency.",
    "Offer the first piece of work unpaid and unconditional, with no MoU attached.",
    "Name what Yi will NOT do — procurement, construction, anything with money attached. Refusing something is the fastest way to be believed."
  ],
  "neverSay": [
    "Any Yi growth target — school counts, membership numbers, chapter expansion. That is Yi's KPI and reads as using the department to hit it.",
    "'Partnership' as an opening word. It implies obligation before any value has been shown.",
    "Any request for funding, however small, including reimbursement. One rupee changes the category from partner to vendor.",
    "Political language from the budget speech. Yi is non-political; quote scheme names and paragraph numbers only.",
    "A promise spanning all fifteen chapters unless all fifteen are genuinely ready. One undelivered city discredits the other fourteen.",
    "'We would like to be involved.' Involvement is not a service. Name the deliverable."
  ],
  "ask": [
    "A letter naming Yi as facilitator for a listed set of institutions",
    "A list — schools, SHGs, troupes, beneficiaries, sites",
    "An introduction to the district officer who owns the scheme",
    "A schedule, where timing decides the value of the work"
  ]
};

export const DEPT_CASES: DeptCase[] = [
  {
    "dept": "School Education",
    "budget": "₹44,527 cr",
    "mandate": "Constitute Anti-Drug Clubs and student volunteer groups across school campuses and display the 10581 helpline (¶16). Daily cleaning, water and 24-hour security in 10,000 schools (¶12). Rebuild 3,734 schools to recommended norms (¶13). Rewrite the curriculum around financial literacy, gender equality, environmental awareness and global citizenship (¶15).",
    "para": "12, 13, 15, 16",
    "constraint": "A club in every school needs one adult who turns up every month. The department has teachers, not spare adults, and ¶16 funds ₹7 crore of awareness across the whole State — there is no line item for facilitators.",
    "offers": [
      {
        "work": "Constitute and run the Anti-Drug Club in schools where Yi already has a standing Thalir relationship, with a Yi member as the named monthly facilitator.",
        "gains": "The club-formation commitment is met in those schools without hiring anyone or diverting a teacher.",
        "costs": "A DEO letter naming Yi as facilitator for the listed schools.",
        "scale": "~40 schools per chapter already in the network; 15 chapters."
      },
      {
        "work": "Campus compliance sweep: is a club actually constituted, and is 10581 physically displayed where students can see it.",
        "gains": "An independent count of what has actually landed. Right now nobody in Chennai can answer this for any district.",
        "costs": "Nothing. Both facts are observable from outside a classroom.",
        "scale": "300 schools across 15 cities in about six weeks."
      },
      {
        "work": "Hand over the Kid-preneur financial-literacy module — already written, already run with school children — for the revised curriculum.",
        "gains": "A tested module instead of a design tender and a procurement cycle.",
        "costs": "A curriculum-cell review of the content.",
        "scale": "Module plus trained delivery volunteers."
      },
      {
        "work": "Staff the new one-hour daily after-school sport period in schools where staff cannot stay back (¶34).",
        "gains": "The hour actually happens in schools that would otherwise report it as delivered on paper.",
        "costs": "Headmaster permission and ground access.",
        "scale": "2 schools per chapter to start; 30 across SRTN."
      },
      {
        "work": "Layer the MASOOM child-safety protocol onto Palli Niraivu schools while they are being rebuilt.",
        "gains": "Safety designed in at rebuild cost rather than retrofitted later at full cost.",
        "costs": "Site access during works and a staff briefing slot.",
        "scale": "Palli Niraivu schools in the 15 chapter districts."
      },
      {
        "work": "Accessibility audit of each Palli Niraivu school before its works are signed off.",
        "gains": "RPwD non-compliance caught while drawings can still change, instead of after handover.",
        "costs": "The works schedule and site access.",
        "scale": "Every rebuild school in a chapter district."
      }
    ],
    "evidence": "A per-school sheet — club constituted yes/no, helpline displayed yes/no, date, photograph reference — handed to the District Education Officer monthly."
  },
  {
    "dept": "Labour Welfare & Skill Development  ·  TNSDC",
    "budget": "₹2,022 cr  ·  Vetri Skill ₹150 cr",
    "mandate": "Skill 12 lakh college students and 1 lakh unemployed youth this year, and place 20,000 in stipended internships 'in collaboration with Government and private industries' (¶27). Skill 5 lakh youth in AI by 2031 (¶28). Open an AI/ML trade in 50 ITIs (¶25).",
    "para": "25, 26, 27, 28",
    "constraint": "The internship number is the hardest commitment in this budget, because government cannot manufacture employers. A department can fund a stipend; it cannot create a firm willing to host a student.",
    "offers": [
      {
        "work": "Bring committed internship places from Yi member companies — a counted, signed number, not an expression of interest.",
        "gains": "Real places against the 20,000 target, from firms already vetted through CII membership. This is the single scarcest input the scheme needs.",
        "costs": "Nothing. The stipend is already budgeted.",
        "scale": "Member firms across 15 cities."
      },
      {
        "work": "Supply practitioner mentors to the AI Industry Development Program from member companies actually deploying AI.",
        "gains": "Industry-current teaching without a consultancy engagement.",
        "costs": "Scheduling and campus access."
      },
      {
        "work": "Run Naukri Bazaar job fairs co-branded with District Employment and Career Guidance Centres.",
        "gains": "Employer footfall the district centres struggle to attract on their own.",
        "costs": "Venue and the centre's candidate list."
      },
      {
        "work": "Place Yi professionals as guest faculty for the new SSC, RRB and IBPS coaching (¶26).",
        "gains": "Subject expertise at zero cost against a ₹3.38 crore allocation.",
        "costs": "A slot in the coaching timetable."
      },
      {
        "work": "Run Project Smile as a dedicated placement channel for candidates with disabilities.",
        "gains": "Inclusive-hiring outcomes that are measurable, not aspirational.",
        "costs": "Candidate referrals from the district office."
      }
    ],
    "evidence": "Signed internship and placement counts by district, with employer names, reconcilable against the scheme's own target."
  },
  {
    "dept": "Home, Prohibition & Excise",
    "budget": "₹17,290 cr",
    "mandate": "Frame a new Road Safety Policy on five pillars, the fifth being education (¶146). Run 65 STING units against narcotics (¶144). Operate a ₹70 crore Rehabilitation Fund for de-addiction (¶145). Zero tolerance on crimes against women and children through the Singapenn Task Force (¶143).",
    "para": "143, 144, 145, 146",
    "constraint": "Enforcement scales with police strength. Prevention does not scale at all without civilians, and the department has no civilian cadre.",
    "offers": [
      {
        "work": "Offer Farishtey as the State's bystander first-responder curriculum — already written, already certifying at scale.",
        "gains": "The trauma-care pillar gets trained civilians at crash sites, using a curriculum the department does not have to commission.",
        "costs": "Recognition of the certification. No funding."
      },
      {
        "work": "Run Chota Cop in schools across the 15 chapter cities.",
        "gains": "The education pillar delivered through a child-led mechanism with a decade of evidence behind it.",
        "costs": "A joint letter with School Education."
      },
      {
        "work": "Run helmet, seat-belt and Horn-Not-OK campaigns at the junctions scheduled for AI enforcement, two months ahead of the cameras (¶115).",
        "gains": "Compliance rises before penalties start, which sharply reduces the public backlash that usually follows automated enforcement.",
        "costs": "The rollout schedule — which junctions, when."
      },
      {
        "work": "Position Break the Stigma as the prevention front-end to the Rehabilitation Fund.",
        "gains": "Reduced intake pressure on ₹70 crore of treatment capacity.",
        "costs": "A referral pathway with the district de-addiction cell."
      },
      {
        "work": "Deliver parent POCSO sessions co-branded with the Singapenn Task Force.",
        "gains": "Community reach for a task force that is police-staffed and cannot be everywhere.",
        "costs": "An officer at the session."
      }
    ],
    "evidence": "Certified-responder counts, campaign reach by junction, session registers with dates and locations."
  },
  {
    "dept": "Finance  ·  Chief Secretary's office",
    "budget": "Revenue deficit ₹55,775 cr",
    "mandate": "Constitute an Expenditure Reforms Committee to review all welfare schemes 'by evaluating their positive impact on the target beneficiary groups' (¶181). Constitute a Governance Processes Reforms Committee including 'industry transformation experts' (¶151). Frame a Right to Services Act (¶152).",
    "para": "151, 152, 181",
    "constraint": "The Expenditure Reforms Committee has been asked to judge whether welfare actually reaches beneficiaries — and has no independent field instrument to do it with. Buying one from a consultancy is exactly the expenditure the Committee exists to reduce.",
    "offers": [
      {
        "work": "Independent last-mile verification of a named scheme: one checkable question, sampled across 15 cities, method published alongside the result.",
        "gains": "Third-party field evidence at zero procurement cost — precisely the Committee's stated mandate, delivered by a body with no financial interest in the answer.",
        "costs": "Nothing. Yi picks schemes where the facts are publicly observable.",
        "scale": "300-sample sweeps, six weeks each, repeatable."
      },
      {
        "work": "Citizen-side usability testing of the 275 services being added to the Namma Arasu chatbot (¶95).",
        "gains": "A defect list before public complaint, from villages rather than from a testing lab.",
        "costs": "The service list."
      },
      {
        "work": "Nominate industry practitioners to the Governance Processes Reforms Committee.",
        "gains": "The 'industry transformation experts' the Committee is already specified to include, from an organised body rather than ad-hoc invitation.",
        "costs": "Committee seats already provided for in ¶151."
      },
      {
        "work": "Convene a structured youth consultation on the Right to Services Act through Future 6.0.",
        "gains": "A consultation record with the demographic most affected by service delivery, before the Bill is drafted.",
        "costs": "An official to attend and listen."
      }
    ],
    "evidence": "Published method, sample size, and raw findings — handed over in full, with the State owning the data and Yi keeping no exclusive copy."
  },
  {
    "dept": "Rural Development & Panchayat Raj",
    "budget": "₹39,609 cr  ·  TN-VETRI ₹6,000 cr/yr",
    "mandate": "Run TN-VETRI as a convergence mission across water, solid waste, sanitation and connectivity, 'converging with the needs and resources of other departments' (¶133, ¶134). Extend a ₹5 lakh investment subsidy to every SHG enterprise that performs (¶137), against a ₹38,000 crore SHG credit plan.",
    "para": "133, 134, 137",
    "constraint": "TN-VETRI is built to converge but needs a convener at block level. And the SHG subsidy funds production — it does not fund a market. An enterprise with capital and no buyer stalls.",
    "offers": [
      {
        "work": "Give subsidised SHG enterprises market access through Rural Bazaar and Yi member retail and procurement networks.",
        "gains": "The ₹5 lakh subsidy converts into a trading business instead of stranded inventory. This is the difference between the scheme's output and its outcome.",
        "costs": "The DRDA's list of subsidised SHGs.",
        "scale": "15 city bazaars plus year-round member procurement."
      },
      {
        "work": "Act as the non-government convergence partner at block level for TN-VETRI.",
        "gains": "A convener the BDO can task who does not sit in another department's hierarchy.",
        "costs": "Naming Yi in the block plan."
      },
      {
        "work": "Deliver financial and digital literacy in adopted villages, teaching the State's own e-Sevai and Namma Arasu services.",
        "gains": "Uptake of digital infrastructure the State has already paid to build.",
        "costs": "Nothing."
      },
      {
        "work": "Support rural artisan livelihoods through Range De and the Palmyra and handicraft schemes.",
        "gains": "Measurable rural incomes attributable to a named scheme.",
        "costs": "Introductions to registered artisan groups."
      }
    ],
    "evidence": "SHG turnover before and after market access, bazaar sales figures, literacy session registers by village."
  },
  {
    "dept": "Youth Welfare & Sports Development",
    "budget": "₹1,051 cr",
    "mandate": "Build neighbourhood sports facilities and small gymnasiums in every block and urban local body (¶34). Introduce one hour of structured sport per day after school. Run the Tamil Nadu Rural Sports Competition at ₹42 crore and establish 10 Olympic Centres of Excellence (¶33). Integrate NCC and NSS into an Integrated Youth Development Programme (¶32).",
    "para": "32, 33, 34",
    "constraint": "Building a facility is procurement and will happen. Keeping it used, programmed and maintained afterwards is not procurement, and there is no cadre for it. Unused facilities are how sports budgets become embarrassments.",
    "offers": [
      {
        "work": "Adopt programming and upkeep of one State-built neighbourhood facility per chapter, instead of building a parallel Yi facility.",
        "gains": "Utilisation and maintenance without a recurring line item — the difference between a facility and a ruin three years on.",
        "costs": "A use agreement.",
        "scale": "15 facilities, one per chapter."
      },
      {
        "work": "Run inter-school traditional sports festivals — kabaddi, kho-kho, carrom, chess — as feeder rounds into the Rural Sports Competition.",
        "gains": "A talent funnel into a ₹42 crore competition, built and run at no cost to the department.",
        "costs": "Recognition as a qualifying round."
      },
      {
        "work": "Refer identified 8-18 talent into Olympic Centre of Excellence trials.",
        "gains": "A wider catchment than departmental scouting reaches, especially in non-metro districts.",
        "costs": "Trial access."
      },
      {
        "work": "Ask that YUVA be named alongside NCC and NSS in the Integrated Youth Development Programme (¶32).",
        "gains": "A third youth network in the programme at no additional cost — one that reaches college students NCC and NSS do not.",
        "costs": "Naming Yi in the programme document."
      }
    ],
    "evidence": "Facility usage logs, festival participant counts, athletes referred and selected."
  },
  {
    "dept": "Municipal Administration & Water Supply",
    "budget": "₹29,863 cr  ·  CM Urban Mission ₹2,117 cr",
    "mandate": "Integrated solid waste management, protection of urban water bodies, expansion of green spaces, safety of women and children, and AI-driven e-governance under the Chief Minister's Integrated Urban Development Mission (¶107). People-friendly streets with pedestrian paths, cycle lanes and safe school access in every corporation (¶111).",
    "para": "107, 108, 109, 111",
    "constraint": "The Mission covers every urban local body and depends on citizen participation a corporation can invite but cannot mandate.",
    "offers": [
      {
        "work": "Audit accessibility of streets scheduled for people-friendly redesign — before the tender drawings are finalised.",
        "gains": "Design corrected on paper instead of rebuilt after handover. Timing is the entire value; the same audit after completion is worthless.",
        "costs": "The redesign schedule and street list.",
        "scale": "Sarv-Sugamya audits, minimum 5 public places per team."
      },
      {
        "work": "Operate an e-waste collection channel for the city.",
        "gains": "A waste stream neither the Urban Mission nor TN-VETRI names an operator for, handled at no cost.",
        "costs": "Publicising the collection point."
      },
      {
        "work": "Adopt and maintain named urban water bodies under Water Warriors.",
        "gains": "Protection and upkeep without a maintenance contract.",
        "costs": "Adding the water body to the protected list."
      },
      {
        "work": "Ward-level citizen testing of e-Sevai 2.0 and the expanded chatbot services.",
        "gains": "Knowing which services fail in real use, from residents rather than from a lab.",
        "costs": "Nothing."
      }
    ],
    "evidence": "Audit findings dated before tender, tonnage collected, water body condition reports, service failure lists."
  },
  {
    "dept": "Environment, Climate Change & Forests",
    "budget": "₹1,762 cr",
    "mandate": "Restore 2,500 hectares of mangrove under TN-SHORE across eight coastal districts (¶127). Mitigate human-wildlife conflict across 100 villages in eleven named districts (¶128). Launch an Eco-Tourism Mission implemented 'through active community participation' (¶169).",
    "para": "127, 128, 169",
    "constraint": "Plantation is procurable; survival is not. Twelve months after a planting drive, someone has to still be there. And ¶169 requires community participation the department must find rather than fund.",
    "offers": [
      {
        "work": "Monitor and report twelve-month tree survival, not sapling count, in chapter districts.",
        "gains": "The metric the Green Tamil Nadu Mission is actually judged on, independently measured.",
        "costs": "The planting locations."
      },
      {
        "work": "Supply volunteers and local buy-in for mangrove restoration in Kanniyakumari and adjacent coastal blocks.",
        "gains": "Labour and community acceptance in a district where a Yi chapter already sits.",
        "costs": "Site coordination with the Forest Range Officer."
      },
      {
        "work": "Provide community anchors for eco-tourism circuits — the participation the scheme text specifies.",
        "gains": "The 'active community participation' ¶169 requires, supplied rather than sought.",
        "costs": "Circuit inclusion."
      },
      {
        "work": "Run conflict-mitigation awareness in the eleven named districts, six of which contain a Yi chapter.",
        "gains": "Behaviour change in conflict villages, alongside the fencing and patrolling the ₹20 crore funds.",
        "costs": "The village list."
      }
    ],
    "evidence": "Twelve-month survival percentages by site, hectares supported, circuit anchors named, village session records."
  },
  {
    "dept": "Welfare of Differently Abled Persons",
    "budget": "₹1,485 cr",
    "mandate": "Establish Nambikkai Illam institutions for intellectual disability in Thanjavur, Tiruvannamalai, Salem, Cuddalore and Virudhunagar (¶48). Subsidise AI-based assistive devices up to ₹30,000 (¶47).",
    "para": "47, 48, 49",
    "constraint": "An institution needs community acceptance around it and employers willing to hire its graduates. Neither can be procured, and both decide whether the building becomes a service or a shell.",
    "offers": [
      {
        "work": "Run inclusive job fairs with member employers and convert them into issued appointment letters.",
        "gains": "Actual appointments — the outcome the department is judged on, not training completions.",
        "costs": "Candidate referrals.",
        "scale": "15 jobs per chapter as the stated minimum."
      },
      {
        "work": "Deliver PwD-led experiential sensitisation in schools and colleges around the new institutions.",
        "gains": "Community acceptance in the districts where Nambikkai Illam is being built — Salem and Sivakasi already have Yi chapters in them.",
        "costs": "Introductions to the institution."
      },
      {
        "work": "Audit public buildings, schools and colleges for RPwD compliance.",
        "gains": "A compliance baseline the department does not currently hold for any district.",
        "costs": "Nothing."
      }
    ],
    "evidence": "Appointment letters issued with employer names, audit reports by building, sensitisation session counts."
  },
  {
    "dept": "Health & Family Welfare",
    "budget": "₹23,357 cr",
    "mandate": "Run 1,000 Mobile Geriatric Treatment Centres visiting every village panchayat (¶57). Build telemedicine as five hubs feeding 200 spokes, scaling to 1,000 (¶59). Establish Thai Care maternity centres (¶58).",
    "para": "57, 58, 59",
    "constraint": "A mobile unit's economics depend on turnout per visit. Turnout depends on a trusted local face telling people it is coming. The department has clinicians, not community organisers.",
    "offers": [
      {
        "work": "Route and publicise mobile geriatric circuits in adopted villages, with a local Yi member as the visible anchor.",
        "gains": "Higher turnout per visit, which is the unit economics of the entire ₹33 crore scheme.",
        "costs": "The circuit schedule."
      },
      {
        "work": "Drive awareness and utilisation of telemedicine spokes at Primary Health Centres.",
        "gains": "Utilisation — without which hub-and-spoke capacity is stranded capital.",
        "costs": "Spoke locations."
      },
      {
        "work": "Run youth mental-health and substance-abuse sessions across YUVA colleges.",
        "gains": "Reach into a cohort the public health system rarely touches until it presents as a crisis.",
        "costs": "Nothing."
      },
      {
        "work": "Deliver NCD screening drives through member companies for working-age adults.",
        "gains": "Screening numbers from a population that does not visit government facilities, at employer cost.",
        "costs": "Screening protocol and reporting format."
      }
    ],
    "evidence": "Attendance per circuit against baseline, spoke utilisation, screening counts with referrals."
  },
  {
    "dept": "Industries, Investment Promotion & Commerce  ·  MSME  ·  Handlooms",
    "budget": "₹4,414 cr  ·  ₹2,142 cr  ·  ₹1,678 cr",
    "mandate": "Create a Tamil Nadu Industrial Capability Directory listing the State's manufacturing and supply capabilities (¶78). Launch Guidance 3.0 (¶79) and a Non-Resident Tamil Investment Facilitation Desk (¶80). Establish the Tamil Nadu Institute of Design (¶88) and a Technical Textiles Transformation Scheme (¶89).",
    "para": "78, 79, 80, 81, 88, 89",
    "constraint": "A capability directory is worthless until firms list themselves. An NRT desk needs diaspora contacts to work. A design institute needs industry to tell it what to teach. All three launch empty.",
    "offers": [
      {
        "work": "Seed the Industrial Capability Directory with Yi member firms across 15 cities and their supply capabilities.",
        "gains": "A populated directory at launch rather than an empty portal an investor bounces off.",
        "costs": "Directory access and a listing format."
      },
      {
        "work": "Supply a warm diaspora pipeline to the Non-Resident Tamil Investment Desk through Yi International Membership.",
        "gains": "Introductions to Tamils abroad already connected to home chapters, instead of cold outreach.",
        "costs": "Nothing."
      },
      {
        "work": "Provide industry input to the Tamil Nadu Institute of Design curriculum from the Tirupur, Karur, Kanchipuram and Sivakasi clusters.",
        "gains": "Employability designed in from the first cohort, from the firms that will hire the graduates.",
        "costs": "A curriculum consultation."
      },
      {
        "work": "Run cluster-level safety and green-manufacturing programmes in Sivakasi, Tirupur and Karur.",
        "gains": "Compliance improvement across an MSME cluster through peer pressure rather than inspection.",
        "costs": "Nothing."
      }
    ],
    "evidence": "Firms listed with capability tags, introductions made and converted, curriculum contributions on record."
  },
  {
    "dept": "Tourism, Art & Culture",
    "budget": "₹775 cr",
    "mandate": "Select 200 folk art troupes each year and give each of them 100 days of performance under the Folk Artists Livelihood Protection Scheme (¶171). Run Food and Arts Festivals along culinary tourism routes (¶167). Take school students to named archaeological sites (¶175).",
    "para": "167, 169, 170, 171, 175",
    "constraint": "200 troupes times 100 days is twenty thousand performance-days. The scheme funds the artist. It does not fund a stage, an audience, or a calendar — and without those the commitment cannot physically be honoured.",
    "offers": [
      {
        "work": "Supply performance slots for scheme-registered troupes at Yi chapter events, Varnam Vizha festivals and member company functions across 15 cities.",
        "gains": "Guaranteed performance-days against a commitment the department has made but has no venue pipeline for. This is the clearest supply-demand match in the entire budget.",
        "costs": "The registered troupe list.",
        "scale": "15 cities, year-round chapter calendars."
      },
      {
        "work": "Host regional editions of the Food and Arts Festival.",
        "gains": "Reach and footfall without an event-management procurement.",
        "costs": "Scheme branding and artist linkage."
      },
      {
        "work": "Adopt and maintain a heritage site on the school-tour list, and host the visits.",
        "gains": "A maintained site and hosted educational visits against a ₹1 crore allocation that funds transport, not hosting.",
        "costs": "Site adoption permission."
      }
    ],
    "evidence": "Performance-days delivered per troupe with dates and venues, festival footfall, site visits hosted."
  },
  {
    "dept": "Social Welfare & Women Empowerment",
    "budget": "₹9,818 cr",
    "mandate": "Skill transgender persons through TNSDC and support them into enterprise with subsidy-linked credit; establish Aran shelter homes in five districts and short-stay facilities in fifteen (¶54). Construct 500 Anganwadi centres (¶53). Establish senior citizen homes in twelve districts and recreation centres in five (¶52).",
    "para": "52, 53, 54",
    "constraint": "Training and shelter are fundable. Employment at the end of them is not — it depends on employers choosing to hire, which no scheme can compel.",
    "offers": [
      {
        "work": "Place TNSDC-trained transgender candidates into member companies.",
        "gains": "The placement end of a training scheme, which is where such schemes usually fail quietly.",
        "costs": "Candidate referrals from the district office."
      },
      {
        "work": "Audit amenities at Anganwadi centres — water, toilets, electricity — in chapter cities.",
        "gains": "A condition baseline against the ¶53 commitment, independently gathered.",
        "costs": "Centre list."
      },
      {
        "work": "Provide volunteer programming at senior citizen recreation centres — reading, yoga, indoor games.",
        "gains": "Activity and footfall at new centres without a staffing line.",
        "costs": "Centre access."
      }
    ],
    "evidence": "Placements with employer names, Anganwadi condition sheets, programming calendars and attendance."
  },
  {
    "dept": "AI, Information Technology & Digital Services",
    "budget": "₹398 cr",
    "mandate": "Strengthen the TN AI Mission across AI, quantum, AVGC-XR (¶94). Upgrade every e-Sevai centre and expand the Namma Arasu chatbot from 76 to 275 public services (¶95). Build a Tamil Large Language Model through the Tamil Virtual Academy (¶174).",
    "para": "94, 95, 174",
    "constraint": "Expanding to 275 services multiplies the surface area for failure, and defects surface as citizen complaints unless someone tests them in the field first.",
    "offers": [
      {
        "work": "Field-test the new chatbot services in villages and small towns, and report exactly which ones fail and how.",
        "gains": "A defect list before the complaints arrive, gathered from the actual usage conditions rather than a testing environment.",
        "costs": "The service list.",
        "scale": "Adopted rural networks across 15 chapters."
      },
      {
        "work": "Point IDS 6 student innovation cohorts at real State problem statements from the AI Mission.",
        "gains": "A solution and prototype pipeline at no cost, with the State choosing the problems.",
        "costs": "Problem statements."
      },
      {
        "work": "Supply volunteers for Tamil LLM evaluation and data quality review.",
        "gains": "Evaluation capacity in Tamil from native speakers across all regions of the State.",
        "costs": "Evaluation protocol."
      }
    ],
    "evidence": "Service-by-service failure reports with location and device, prototypes delivered, evaluation sets completed."
  },
  {
    "dept": "Higher Education",
    "budget": "₹8,393 cr",
    "mandate": "Establish 200 integrated student hostels delivering 1 lakh beds under TN-SUDAR, through a de-risked PPP, explicitly intended to 'integrate youth across diverse communities and faiths' (¶22). Establish a Government Law College of Excellence at Madurai (¶23).",
    "para": "21, 22, 23",
    "constraint": "TN-SUDAR states a social-integration objective alongside a construction target. Buildings are procurable; integration is a programme, and none is funded.",
    "offers": [
      {
        "work": "Run structured integration and leadership programming inside TN-SUDAR hostels once occupied.",
        "gains": "The social-integration objective in ¶22 actually pursued, rather than assumed to follow from shared accommodation.",
        "costs": "Access to hostel common facilities."
      },
      {
        "work": "Bring Young Indians Parliament to the new Madurai Law College as a standing civic exercise.",
        "gains": "A practical civic and legislative exercise for a law school being built as an institution of excellence.",
        "costs": "Academic calendar space."
      },
      {
        "work": "Onboard ITIs and polytechnics — not only degree colleges — as YUVA partner institutions.",
        "gains": "Youth programming reaching the vocational stream that most youth initiatives skip entirely.",
        "costs": "Institution list."
      }
    ],
    "evidence": "Programme calendars and participation by hostel and institution."
  }
];

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
    "proof": "A written acknowledgement from the Home Dept naming Farishtey in the education pillar",
    "effort": "Afternoon",
    "ownerRole": "SRTN RM — Road Safety",
    "ownerScope": "region",
    "namedChapters": [],
    "govGain": "Trained civilians at crash sites, using a certification curriculum the department does not have to write or procure."
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
    "proof": "Digital report cards from 10 schools, shared with the District Education Officer",
    "effort": "A quarter",
    "ownerRole": "Chapter Road Safety Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "The Road Safety Policy's education pillar delivered in schools, through a mechanism with a decade of evidence."
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
    "proof": "One joint drill completed with a district hospital",
    "effort": "A week",
    "ownerRole": "Chapter Road Safety Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "First-response capability around trauma centres, extending their reach beyond the clinical staff they fund."
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
    "proof": "Campaign run at the named junctions before cameras go live",
    "effort": "A week",
    "ownerRole": "Chapter Road Safety Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "Public compliance raised before AI enforcement starts, reducing the backlash that follows automated penalties."
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
    "proof": "A State speaker confirmed for the SRTN week",
    "effort": "Afternoon",
    "ownerRole": "SRTN RM — Road Safety",
    "ownerScope": "region",
    "namedChapters": [],
    "govGain": "A ready-made public platform for launching the new Policy, at no event cost."
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
    "proof": "10581 displayed and a club constituted in every Thalir school in the chapter",
    "effort": "A quarter",
    "ownerRole": "Chapter Health Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "The Anti-Drug Club commitment met in schools that already have a standing adult facilitator, without hiring."
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
    "proof": "A referral pathway agreed with one district de-addiction centre",
    "effort": "A week",
    "ownerRole": "SRTN RM — Health",
    "ownerScope": "region",
    "namedChapters": [],
    "govGain": "Reduced intake pressure on ₹70 crore of de-addiction capacity, by preventing rather than treating."
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
    "proof": "Sessions delivered in a village with TN-VETRI works underway",
    "effort": "A week",
    "ownerRole": "Chapter Health Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "Sanitation behaviour change alongside TN-VETRI's physical works, which the works alone do not produce."
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
    "proof": "A written condition report on 10 schools submitted to the DEO",
    "effort": "A week",
    "ownerRole": "Chapter Health Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "Independent confirmation that Super Clean Super Campus water and toilet upkeep is actually happening."
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
    "proof": "The daily hour actually running in two schools",
    "effort": "A quarter",
    "ownerRole": "Chapter Sports Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "The daily after-school sport hour actually running in schools that cannot staff it."
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
    "proof": "A State health official on the summit platform",
    "effort": "Afternoon",
    "ownerRole": "SRTN RM — Health",
    "ownerScope": "region",
    "namedChapters": [],
    "govGain": "Reach for the Urban Public Health Mission without an event procurement."
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
    "proof": "A written empanelment or an approved school list",
    "effort": "A quarter",
    "ownerRole": "SRTN RM — MASOOM",
    "ownerScope": "region",
    "namedChapters": [],
    "govGain": "Prevention reaching children directly, extending a police-staffed task force into classrooms."
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
    "proof": "Model School protocol adopted in at least one Palli Niraivu school",
    "effort": "A week",
    "ownerRole": "Chapter MASOOM Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "Child-safety protocol designed into school rebuilds at build cost rather than retrofitted later."
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
    "proof": "One co-branded session held with Singapenn officers present",
    "effort": "A week",
    "ownerRole": "Chapter MASOOM Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "Community reach for Singapenn among parents, who are where most disclosure actually begins."
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
    "proof": "A trainer count on record with the region",
    "effort": "Afternoon",
    "ownerRole": "SRTN RM — MASOOM",
    "ownerScope": "region",
    "namedChapters": [],
    "govGain": "A trained delivery cadre available when the new gender-equality module needs teaching."
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
    "proof": "Quarterly session count recorded per school",
    "effort": "A quarter",
    "ownerRole": "Chapter MASOOM Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "Cyber-safety coverage in schools, which this budget funds nowhere else."
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
    "proof": "Sessions held in a Tribal Sub-Plan habitation",
    "effort": "A week",
    "ownerRole": "Chapter MASOOM Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "Child-protection reach into tribal habitations already receiving infrastructure investment."
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
    "proof": "5 audited public places submitted, at least 3 on the redesign list",
    "effort": "A week",
    "ownerRole": "SRTN RM — Accessibility",
    "ownerScope": "region",
    "namedChapters": [],
    "govGain": "Street accessibility problems identified while drawings can still change, avoiding rebuild cost."
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
    "proof": "15 appointment letters issued",
    "effort": "A quarter",
    "ownerRole": "Chapter Accessibility Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "Appointment letters issued to candidates with disabilities — the outcome, not the training count."
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
    "proof": "Audit findings submitted before a school's works complete",
    "effort": "A week",
    "ownerRole": "Chapter Accessibility Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "RPwD compliance caught before rebuild sign-off instead of after handover."
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
    "proof": "Named as a partner at the institution's launch",
    "effort": "Afternoon",
    "ownerRole": "Chapter Accessibility Convener",
    "ownerScope": "named",
    "namedChapters": [
      "Salem",
      "Sivakasi"
    ],
    "govGain": "Community acceptance around new Nambikkai Illam institutions in Salem and Virudhunagar."
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
    "proof": "A TN-specific section in the published White Paper",
    "effort": "A week",
    "ownerRole": "SRTN RM — Accessibility",
    "ownerScope": "region",
    "namedChapters": [],
    "govGain": "Independent commentary on where assistive-device coverage falls short."
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
    "proof": "n/a",
    "effort": "Afternoon",
    "ownerRole": "Chapter Accessibility Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "No State gain — railways is a Union subject. Listed so nobody wastes a meeting on it."
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
    "proof": "12-month survival rate reported, not sapling count",
    "effort": "A quarter",
    "ownerRole": "Chapter Climate Change Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "Twelve-month survival data, which is the metric the mission is judged on, not sapling count."
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
    "proof": "One water body added to the corporation's list",
    "effort": "A week",
    "ownerRole": "SRTN RM — Climate Change",
    "ownerScope": "region",
    "namedChapters": [],
    "govGain": "Urban water bodies protected and maintained without a maintenance contract."
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
    "proof": "Collection point listed on corporation communications",
    "effort": "A week",
    "ownerRole": "Chapter Climate Change Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "An e-waste stream handled that neither urban nor rural mission names an operator for."
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
    "proof": "A site adopted and one school visit hosted",
    "effort": "A week",
    "ownerRole": "Chapter Climate Change Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "A maintained heritage site with hosted school visits against an allocation that funds only transport."
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
    "proof": "Plastic-free chapter events",
    "effort": "Afternoon",
    "ownerRole": "Chapter Chair",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "No direct gain — this changes Yi's own footprint, not the State's."
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
    "proof": "n/a",
    "effort": "Afternoon",
    "ownerRole": "National team",
    "ownerScope": "region",
    "namedChapters": [],
    "govGain": "No State gain. Listed so the absence is explicit."
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
    "proof": "A named role for YUVA in one district's Vetri Skill rollout",
    "effort": "A week",
    "ownerRole": "Regional Chair",
    "ownerScope": "region",
    "namedChapters": [],
    "govGain": "A delivery network reaching the same 12 lakh college students the scheme must skill this year."
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
    "proof": "CX located at an AI-programme campus",
    "effort": "A quarter",
    "ownerRole": "Regional Chair",
    "ownerScope": "region",
    "namedChapters": [],
    "govGain": "A campus hub for the AI programme without building one."
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
    "proof": "A Committee member or official attending Future 6.0",
    "effort": "Afternoon",
    "ownerRole": "Regional Chair",
    "ownerScope": "region",
    "namedChapters": [],
    "govGain": "The industry consultation ¶151 specifies, convened rather than solicited."
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
    "proof": "Two ITI or polytechnic partners onboarded",
    "effort": "A quarter",
    "ownerRole": "Chapter YUVA Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "Youth programming reaching the ITI and polytechnic stream that most initiatives skip."
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
    "proof": "n/a",
    "effort": "Afternoon",
    "ownerRole": "Chapter YUVA Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "No State gain — internal engagement mechanics."
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
    "proof": "New Thalir schools drawn from the scheme lists",
    "effort": "Afternoon",
    "ownerRole": "Chapter Thalir Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "Facilitator coverage in schools the department is already investing in."
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
    "proof": "Thalir ECs formally recognised as Anti-Drug Clubs",
    "effort": "A week",
    "ownerRole": "SRTN RM — Thalir",
    "ownerScope": "region",
    "namedChapters": [],
    "govGain": "A constituted, already-trained student volunteer group in each school — exactly what ¶16 asks for."
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
    "proof": "A department observer at one SRTN YiP",
    "effort": "A week",
    "ownerRole": "National Thalir Chair",
    "ownerScope": "region",
    "namedChapters": [],
    "govGain": "A working civic practicum for the new curriculum's global-citizenship objective."
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
    "proof": "A Tamil round in the SRTN question set",
    "effort": "A week",
    "ownerRole": "SRTN RM — Thalir",
    "ownerScope": "region",
    "namedChapters": [],
    "govGain": "Tamil-language and Thirukkural engagement reaching students competitively."
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
    "proof": "Module delivered in a SPARK school",
    "effort": "A quarter",
    "ownerRole": "Chapter Thalir Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "A tested financial-literacy module instead of a design tender."
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
    "proof": "A site visit held during the week",
    "effort": "A week",
    "ownerRole": "Chapter Thalir Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "Footfall and engagement at named archaeological sites."
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
    "proof": "Subsidised SHGs trading at a Yi bazaar",
    "effort": "A week",
    "ownerRole": "SRTN RM — Rural Initiatives",
    "ownerScope": "region",
    "namedChapters": [],
    "govGain": "Subsidised SHG enterprises converted into trading businesses instead of stranded inventory."
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
    "proof": "An adopted network inside a TN-VETRI block",
    "effort": "A week",
    "ownerRole": "Chapter Rural Initiatives Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "A non-government convener the BDO can task inside a TN-VETRI block."
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
    "proof": "A maintenance or programming role at one State facility",
    "effort": "A week",
    "ownerRole": "Chapter Sports Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "State-built block facilities kept in use and maintained without a recurring line item."
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
    "proof": "Artisan groups registered with the department",
    "effort": "A week",
    "ownerRole": "Chapter Rural Initiatives Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "Rural artisan incomes attributable to the Palmyra and handicraft schemes."
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
    "proof": "A site accepted into the Mission circuit",
    "effort": "A week",
    "ownerRole": "Chapter Rural Initiatives Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "The 'active community participation' the Eco-Tourism Mission text requires, supplied not sought."
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
    "proof": "Scheme beneficiaries attending as delegates",
    "effort": "Afternoon",
    "ownerRole": "Chapter Rural Initiatives Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "Recognition and exposure for Vetri Entrepreneur beneficiaries."
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
    "proof": "n/a",
    "effort": "Afternoon",
    "ownerRole": "Chapter Chair",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "No State gain — internal to Yi."
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
    "proof": "A committed internship count on paper before the first meeting",
    "effort": "A quarter",
    "ownerRole": "Chapter Entrepreneurship Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "Employer footfall at district job fairs the centres struggle to attract alone."
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
    "proof": "Member firms listed in the State directory",
    "effort": "Afternoon",
    "ownerRole": "Chapter Entrepreneurship Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "A populated Industrial Capability Directory at launch instead of an empty portal."
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
    "proof": "NRT Desk on the YiFi programme",
    "effort": "Afternoon",
    "ownerRole": "National Entrepreneurship team",
    "ownerScope": "region",
    "namedChapters": [],
    "govGain": "A public first outing for the Non-Resident Tamil Investment Desk."
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
    "proof": "Module accepted in at least one government school",
    "effort": "A week",
    "ownerRole": "Chapter Entrepreneurship Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "Financial literacy delivered in classrooms by people who run businesses."
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
    "proof": "Scheme applications generated from the week",
    "effort": "A week",
    "ownerRole": "Chapter Entrepreneurship Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "Publicity driving applications to the MSME subsidy schemes."
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
    "proof": "Brief published naming the priority cohort",
    "effort": "Afternoon",
    "ownerRole": "Chapter Entrepreneurship Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "Employability focus on the scheme's stated priority cohort."
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
    "proof": "A State-sourced problem statement in the IDS set",
    "effort": "A week",
    "ownerRole": "National Innovation Chair",
    "ownerScope": "region",
    "namedChapters": [],
    "govGain": "A student innovation pipeline working the State's own problem statements at no cost."
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
    "proof": "InnovX delivered inside a SPARK school",
    "effort": "A quarter",
    "ownerRole": "Chapter Innovation Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "Enrichment inside SPARK schools rather than a competing programme for the same children."
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
    "proof": "Clubs recognised at an AI-programme college",
    "effort": "A week",
    "ownerRole": "SRTN RM — Innovation",
    "ownerScope": "region",
    "namedChapters": [],
    "govGain": "A campus arm for the AI programme, already staffed by students."
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
    "proof": "Week hosted on SPARK or ITI campuses",
    "effort": "A week",
    "ownerRole": "Chapter Innovation Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "Practitioner-led AI and prototyping weeks inside SPARK schools and the new ITI trades."
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
    "proof": "Mentoring delivered in an adopted block",
    "effort": "A week",
    "ownerRole": "Chapter Innovation Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "Innovation mentoring reaching rural talent inside adopted blocks."
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
    "proof": "Signed commitments from member firms, then a departmental meeting",
    "effort": "A quarter",
    "ownerRole": "SRTN RM — Learning",
    "ownerScope": "region",
    "namedChapters": [],
    "govGain": "Real, committed internship places against the hardest target in this budget."
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
    "proof": "A field report on service failures sent to the IT Dept",
    "effort": "A quarter",
    "ownerRole": "Chapter Learning Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "Field uptake of the digital services the State has already paid to build, plus a defect list."
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
    "proof": "One member teaching at a district centre",
    "effort": "Afternoon",
    "ownerRole": "Chapter Learning Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "Subject expertise at district career centres at zero cost."
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
    "proof": "n/a",
    "effort": "Afternoon",
    "ownerRole": "Chapter Learning Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "No State gain — internal member development."
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
    "proof": "Thalir festival recognised as a qualifying round",
    "effort": "A week",
    "ownerRole": "SRTN RM — Sports",
    "ownerScope": "region",
    "namedChapters": [],
    "govGain": "A feeder pipeline into the ₹42 crore Rural Sports Competition, built and run free."
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
    "proof": "A signed upkeep or programming arrangement",
    "effort": "A week",
    "ownerRole": "Chapter Sports Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "Programming and upkeep for one State facility per chapter."
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
    "proof": "Identified athletes entering a State trial",
    "effort": "A week",
    "ownerRole": "Chapter Sports Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "A wider talent catchment into Olympic Centre trials than departmental scouting reaches."
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
    "proof": "YUVA named in a programme document",
    "effort": "Afternoon",
    "ownerRole": "Regional Chair",
    "ownerScope": "region",
    "namedChapters": [],
    "govGain": "A third youth network alongside NCC and NSS, reaching college students they do not."
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
    "proof": "n/a",
    "effort": "Afternoon",
    "ownerRole": "Chapter Sports Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "No State gain — internal engagement."
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
    "proof": "n/a",
    "effort": "Afternoon",
    "ownerRole": "Chapter Branding Convener",
    "ownerScope": "chapter",
    "namedChapters": [],
    "govGain": "No State gain — Yi-facing by design."
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
    "proof": "A list handed over and one introduction made",
    "effort": "A week",
    "ownerRole": "Regional Chair",
    "ownerScope": "region",
    "namedChapters": [],
    "govGain": "A warm diaspora pipeline for the NRT Desk instead of cold outreach."
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
    "recommendation": "Create a Governance vertical, absorbing the YiP civic engine — largest unclaimed surface",
    "firstStep": "Draft a one-page proposal to create a Governance & Public Systems vertical, using YiP as the existing engine, and take it to the Regional Chair for the next EC.",
    "owner": "Regional Chair",
    "window": "Next regional EC meeting",
    "effort": "A week"
  },
  {
    "type": "Gap — no Yi vertical",
    "item": "Ageing & elder care",
    "detail": "1,000 mobile geriatric centres; senior homes in 12 districts; recreation centres in 5",
    "para": "57, 52",
    "crore": 40,
    "recommendation": "Extend Health, or open an Elder Care sub-vertical",
    "firstStep": "Ask the District Health Officer where the mobile geriatric units will route in your district, and offer chapter volunteers for the first circuit.",
    "owner": "Chapter Health Convener",
    "window": "When the units are commissioned",
    "effort": "A week"
  },
  {
    "type": "Gap — no Yi vertical",
    "item": "Gender-diverse inclusion",
    "detail": "Aran shelter homes in 5 districts; short-stay homes in 15; TNSDC skilling; ₹50,000 subsidy",
    "para": "54",
    "crore": null,
    "recommendation": "Widen Accessibility to Inclusion — today it is disability-only",
    "firstStep": "Widen the Accessibility vertical's written scope to cover gender-diverse inclusion, then contact the district Social Welfare office about the Aran shelter homes.",
    "owner": "SRTN RM — Accessibility",
    "window": "This quarter",
    "effort": "A week"
  },
  {
    "type": "Gap — no Yi vertical",
    "item": "Water security",
    "detail": "River linking; Cooum and Adyar restoration; Cauvery, Vaigai, Tamiraparani pollution DPRs",
    "para": "123, 112, 124",
    "crore": 225,
    "recommendation": "Climate Change treats water as one item; the State treats it as a standing crisis",
    "firstStep": "Pick one river stretch or urban water body in your city and make it the chapter's standing site, rather than a one-off Water Warriors drive.",
    "owner": "Chapter Climate Change Convener",
    "window": "This year",
    "effort": "A quarter"
  },
  {
    "type": "Gap — no Yi vertical",
    "item": "Design & craft economy",
    "detail": "TN Institute of Design; Technical Textiles; Palmyra Corporation; Tiruppur TTTC",
    "para": "88, 89, 90, 91",
    "crore": 86,
    "recommendation": "Tirupur, Karur, Kanchipuram, Sivakasi chapters sit on these clusters with no vertical pointed at them",
    "firstStep": "List the artisan and weaver clusters inside your chapter city and register them with the Handlooms Dept ahead of the Institute of Design opening.",
    "owner": "Chapter Rural Initiatives Convener",
    "window": "Before the Institute is operational",
    "effort": "A week"
  },
  {
    "type": "Do not chase",
    "item": "Vetri Laptop Scheme",
    "detail": "Procurement of laptops for college students",
    "para": "21",
    "crore": 2000,
    "recommendation": "Pure procurement — no partnership shape",
    "firstStep": "Do not approach any department about this. If asked, say plainly that Yi has no role in procurement.",
    "owner": "Chapter Chair",
    "window": "n/a",
    "effort": "Afternoon"
  },
  {
    "type": "Do not chase",
    "item": "Bicycles for Class XI",
    "detail": "5.32 lakh bicycles with helmets and water bottles",
    "para": "18",
    "crore": 277,
    "recommendation": "Pure procurement",
    "firstStep": "Do not approach any department about this.",
    "owner": "Chapter Chair",
    "window": "n/a",
    "effort": "Afternoon"
  },
  {
    "type": "Do not chase",
    "item": "Annan's Seer",
    "detail": "8 gram gold coin and silk saree at marriage",
    "para": "50",
    "crore": 812,
    "recommendation": "Direct benefit transfer",
    "firstStep": "Do not approach any department about this.",
    "owner": "Chapter Chair",
    "window": "n/a",
    "effort": "Afternoon"
  },
  {
    "type": "Do not chase",
    "item": "Thai Maaman Thanga Mothiram",
    "detail": "1 gram gold ring per newborn in Government hospitals",
    "para": "56",
    "crore": 560,
    "recommendation": "Direct benefit transfer",
    "firstStep": "Do not approach any department about this.",
    "owner": "Chapter Chair",
    "window": "n/a",
    "effort": "Afternoon"
  },
  {
    "type": "Do not chase",
    "item": "Palli Niraivu Thittam (construction)",
    "detail": "School building works — the CONSTRUCTION component only",
    "para": "13",
    "crore": 2132,
    "recommendation": "Construction is procurement. The audit and safety layers ARE open to Yi — see Matrix.",
    "firstStep": "Engage only on the audit and child-safety layers. Say explicitly in the first meeting that Yi is not seeking any construction role.",
    "owner": "Chapter Chair",
    "window": "At first contact",
    "effort": "Afternoon"
  },
  {
    "type": "Do not chase",
    "item": "Kamarajar Breakfast Scheme",
    "detail": "Expansion to Classes VI to VIII",
    "para": "51",
    "crore": 710,
    "recommendation": "Direct benefit transfer",
    "firstStep": "Do not approach any department about this.",
    "owner": "Chapter Chair",
    "window": "n/a",
    "effort": "Afternoon"
  },
  {
    "type": "Caution",
    "item": "Political framing",
    "detail": "The speech carries heavy party and leadership framing throughout",
    "para": "—",
    "crore": null,
    "recommendation": "Yi is non-political. Quote scheme names and ¶ numbers only, never political language.",
    "firstStep": "Brief every convener before their first departmental meeting: quote scheme names and paragraph numbers, never language from the political passages of the speech.",
    "owner": "Regional Chair",
    "window": "Before any department is approached",
    "effort": "Afternoon"
  },
  {
    "type": "Caution",
    "item": "Conflict of interest",
    "detail": "Budget relaxed tender eligibility for young entrepreneurs and small businesses",
    "para": "8",
    "crore": null,
    "recommendation": "Yi members are that cohort. Write a declared-interest and recusal firewall BEFORE the first meeting.",
    "firstStep": "Write and publish the declared-interest and recusal rule: no chapter measures a scheme where a member firm is a bidder. Publish it, do not keep it internal.",
    "owner": "Regional Chair",
    "window": "Before the first engagement — not after the first accusation",
    "effort": "A week"
  },
  {
    "type": "Caution",
    "item": "Data protection",
    "detail": "Field data collection involving minors and beneficiaries",
    "para": "—",
    "crore": null,
    "recommendation": "Limit to publicly observable facts until a lawful basis under DPDP is established.",
    "firstStep": "Restrict all field data collection to publicly observable facts until a lawful basis under the DPDP Act is written down and approved.",
    "owner": "Regional Chair",
    "window": "Before any field data is collected",
    "effort": "A week"
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
