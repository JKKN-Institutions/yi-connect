/**
 * Yi SRTN × Tamil Nadu Budget 2026-27 — alignment dataset.
 *
 * Sources, and only these two:
 *   1. Yi Leadership Academy 2026 Pathfinder vertical one-pagers (National Yi)
 *   2. Tamil Nadu Budget Speech, 5 August 2026 — Revised Budget Estimates
 *
 * `para` is the paragraph number in the budget speech, so every row is checkable
 * against the published PDF. `crore` is the Revised Budget Estimate for the named
 * scheme — it is the SIZE OF THE POLICY AREA, not funding available to Yi.
 *
 * These rows are also published as a spreadsheet for chapter circulation
 * (Yi-SRTN-x-TN-Budget-2026-27-Alignment.xlsx, kept outside the repo). If that
 * workbook changes, update this file in the same commit so the public page and
 * the circulated spreadsheet cannot drift apart.
 *
 * Author: Ommsharravana — Chapter Chair, Yi Erode
 */

export type Alignment = 'Direct' | 'Partial' | 'None' | 'Internal';

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
};

export type ChapterRow = {
  chapter: string;
  named: string;
  scheme: string;
  para: string;
  vertical: string;
  move: string;
};

export type GapRow = {
  type: string;
  item: string;
  detail: string;
  para: string;
  crore: number | null;
  recommendation: string;
};

export type LeadRow = {
  vertical: string;
  name: string;
  chapter: string;
  role: string;
};

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
    "action": "Offer Farishtey as the State's certified first-responder curriculum"
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
    "action": "Place Chota Cop in the schools already under Palli Niraivu"
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
    "action": "Train member firms' staff; log against the State's trauma-care rollout"
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
    "action": "Run the campaigns alongside the AI enforcement rollout, not separately"
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
    "action": "Time the 2027 week to the Policy launch"
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
    "action": "STRONGEST MATCH — the budget asks for student volunteer groups by name"
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
    "action": "Position Break the Stigma as the prevention arm of the Rehab Fund"
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
    "action": "Enter via TN-VETRI block convergence, not standalone"
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
    "action": "Verify delivery in chapter-city schools; report to the department"
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
    "action": "Supply the after-school hour in chapter-city schools"
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
    "action": "Host the SRTN edition inside a corporation's health mission"
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
    "action": "Seek School Education empanelment first; POCSO protocol is mandatory"
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
    "action": "Offer Model School protocol as the safety layer of Palli Niraivu"
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
    "action": "Deliver through Singapenn's community outreach, co-branded"
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
    "action": "Offer the TOT cadre as trainers for the new curriculum module"
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
    "action": "Cyber safety is not separately funded; ride the curriculum module"
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
    "action": "Route through Tribal Sub-Plan habitations, not ad hoc"
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
    "action": "Audit BEFORE the redesign tenders are drawn — timing is the whole value"
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
    "action": "Run Project Smile as a Vetri Skill placement channel for PwD"
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
    "action": "Audit the 3,734 schools while they are being rebuilt, not after"
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
    "action": "Salem and Sivakasi (Virudhunagar) chapters sit in named districts"
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
    "action": "Use the White Paper to comment on assistive-device coverage gaps"
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
    "action": "Do not present this to a State department"
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
    "action": "Kanniyakumari is a named TN-SHORE district — lead there"
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
    "action": "Map chapter water bodies into the CM Urban Mission list"
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
    "action": "E-waste is unclaimed in both missions — easiest first win"
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
    "action": "Adopt a site on the Keeladi / Adichanallur / Kodumanal tour list"
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
    "action": "Chapter-level practice; no funding interface"
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
    "action": "Keep internal to Yi"
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
    "action": "Same population, same year — offer YUVA as the delivery network"
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
    "action": "Site a CX at an engineering college inside the AI programme"
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
    "action": "The Committee explicitly seeks industry input — Future 6.0 is the vehicle"
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
    "action": "Add ITIs and polytechnics to the partner list, not just degree colleges"
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
    "action": "Internal engagement mechanics"
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
    "action": "Recruit new Thalir schools from the two scheme lists"
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
    "action": "Offer the Thalir EC as the ready-made structure for the Anti-Drug Club"
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
    "action": "Position YiP as the practicum for the new civics curriculum"
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
    "action": "Add a Thirukkural and Tamil-heritage round to YiQ in SRTN"
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
    "action": "Financial literacy is named in the curriculum — supply the content"
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
    "action": "Anchor the SRTN week on a heritage site visit"
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
    "action": "State supplies capital, Yi supplies market access — clean division"
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
    "action": "Enter as a TN-VETRI convergence partner at BLOCK level; drop standalone adoption"
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
    "action": "Yi builds one, the State is building in every block — converge"
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
    "action": "Tirupur, Karur, Kanchipuram chapters sit on named clusters"
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
    "action": "The scheme text invites community participation by name"
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
    "action": "Invite scheme beneficiaries as delegates rather than seeking funds"
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
    "action": "Do not present this to a department"
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
    "action": "BIGGEST SINGLE OPENING — approach with committed places, not a proposal"
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
    "action": "Offer SRTN member firms as the seed dataset for the Directory"
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
    "action": "Bring the NRT desk on stage at YiFi — its first public outing"
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
    "action": "Offer Kid-preneur as the financial literacy delivery module"
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
    "action": "Use BEW to publicise the two subsidy schemes; no funding ask"
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
    "action": "Align the challenge brief to the scheme's priority cohort"
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
    "action": "Yi's own KPI REQUIRES a government partner — this budget supplies four"
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
    "action": "Near-identical scope and age band — merge rather than duplicate"
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
    "action": "Register clubs as the campus arm of the AI programme"
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
    "action": "Run Innovation Week inside SPARK schools and the new ITI trades"
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
    "action": "Attach to an adopted TN-VETRI block"
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
    "action": "EXACT MATCH: Yi's own target IS the State's scheme. Highest priority."
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
    "action": "Teach the 275 services in villages; report which ones fail in the field"
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
    "action": "Offer member professionals as guest faculty at the district centres"
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
    "action": "Internal member development"
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
    "action": "Same sports, same year — offer Thalir festivals as feeder rounds"
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
    "action": "Adopt maintenance of one State-built facility per chapter"
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
    "action": "Feed identified talent into the Olympic CoE pipeline"
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
    "action": "Ask to be named alongside NCC and NSS in the programme"
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
    "action": "Member engagement only"
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
    "action": "Do not present this to a department"
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
    "action": "Offer SRTN's diaspora members as the desk's first pipeline"
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
