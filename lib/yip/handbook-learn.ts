// Handbook pages 47–48: Student FAQs (verbatim) + Sample Script references (p. 39–43).
// No "use server" — shared with client.

export type HandbookFAQ = { q: string; a: string };

export const STUDENT_FAQS: HandbookFAQ[] = [
  {
    q: "What is YIP?",
    a: "YIP is a 2-day simulation of the Indian Parliament for students (Classes 9–12), where they take on roles as MPs, form parties, debate issues, and draft policies.",
  },
  {
    q: "What is the objective of YIP?",
    a: "To develop leadership, critical thinking, public speaking, teamwork, and an understanding of governance and policy-making.",
  },
  {
    q: "How should students prepare?",
    a: "Prepare a 90-second speech on a selected topic, stay updated with current affairs, and familiarise yourself with basic parliamentary terms.",
  },
  {
    q: "What are the agenda topics?",
    a: "Topics are broad national issues (education, health, economy, environment, etc.) shared prior to the session. Browse the full list in the Topics library.",
  },
  {
    q: "What is Party Formation?",
    a: "Students are grouped into parties, where they define a name, symbol, and a 4-point manifesto, and select a Party Leader.",
  },
  {
    q: "How are roles assigned?",
    a: "Speaker is selected through nomination; Government and Opposition are formed, followed by assignment of Cabinet and Shadow Ministers.",
  },
  {
    q: "What is Question Hour?",
    a: "Students submit questions in advance (at least 4 days prior); selected questions are raised in the House and answered by Ministers.",
  },
  {
    q: "What is Zero Hour?",
    a: "Students raise urgent or emerging issues without prior notice, encouraging spontaneous participation.",
  },
  {
    q: "Will bills be debated?",
    a: "Yes — bills are presented, debated in Parliament, and voted upon by participants. The Bill Committee drafts; the House votes Aye / No.",
  },
  {
    q: "Can non-speakers participate effectively?",
    a: "Yes — students can contribute through discussions, research, bill drafting, and teamwork. Every role matters.",
  },
  {
    q: "Are there awards and recognitions?",
    a: "Yes — 15 awards across categories: Best Parliamentarian, Best Speaker, Leadership Excellence, Best Debater, Innovative Ideas, Team Spirit, MVP, and more.",
  },
  {
    q: "What is the dress code?",
    a: "Formal / semi-formal Indian attire, or school uniform.",
  },
  {
    q: "What should students carry?",
    a: "Notepad, pen, prepared speech, and awareness of your role, party, and topic.",
  },
  {
    q: "How is communication managed?",
    a: "Through common and committee-specific WhatsApp groups for coordination and updates.",
  },
  {
    q: "Why is constituency allocation important?",
    a: "Constituency allocation ensures participants represent real regions, grounding discussions in local realities and helping connect national policies with on-ground impact.",
  },
  {
    q: "Where can I access important YIP resources?",
    a: "YIP Repository (materials + templates), YIP Webpage on the official Young Indians website, and the chapter-specific payment link shared by your Chapter EM.",
  },
  {
    q: "What happens if my party's No-Confidence Motion passes?",
    a: "If a No-Confidence Motion is passed by majority vote, the sitting Government must resign — a real parliamentary consequence simulated in the House.",
  },
];

// Sample Script segments from handbook p. 39–43
export type ScriptSegment = {
  title: string;
  role: string;
  line: string;
};

export const SAMPLE_SCRIPT: ScriptSegment[] = [
  { title: "Opening of the Session", role: "Speaker",
    line: '"The House shall now come to order. We are gathered today for the Youth Parliament session, focusing on pressing issues in our city. Let us proceed with the agenda."' },
  { title: "Obituary Reference", role: "Speaker",
    line: '"Before we begin, the House shall observe a moment of silence to honor [Name], a great social worker who dedicated their life to solving our city\'s waste management crisis. We recognize their contributions and express our condolences."' },
  { title: "Question Hour", role: "Opposition MP",
    line: '"Honorable Speaker, my question is directed to the Minister of Transport. The increasing traffic congestion in our city causes delays and pollution. What steps is the government taking to address this?"' },
  { title: "Question Hour — Supplementary", role: "Opposition MP",
    line: '"While these measures are welcome, what is the timeline for completion?"' },
  { title: "Adjournment Motion", role: "Opposition MP",
    line: '"Honorable Speaker, I request the House to adjourn regular business to discuss the water crisis affecting several neighborhoods. The lack of proper water supply has disrupted daily life, and immediate action is needed."' },
  { title: "Breach of Privilege", role: "MP",
    line: '"Honorable Speaker, last week I raised concerns over the rise in industrial pollution, but my request for official pollution reports was ignored by the Environment Minister. This is a breach of my privilege as an MP."' },
  { title: "Papers to be Laid on the Table", role: "Education Minister",
    line: '"With permission from the Speaker, I lay before the House the report on digital learning initiatives in government schools, detailing the budget and implementation strategy."' },
  { title: "Calling Attention Notice", role: "MP",
    line: '"Honorable Speaker, I call the attention of the Waste Management Minister to the increasing garbage dumps in public areas, which are causing health hazards. What immediate action is being taken?"' },
  { title: "Legislative Business — Bill Introduction", role: "Urban Development Minister",
    line: '"Honorable Speaker, I introduce the \'Smart Roads and Pedestrian Safety Bill\' to improve road infrastructure, pedestrian crossings, and streetlights in the city. This bill aims to reduce accidents and ensure safe mobility for all citizens."' },
  { title: "Private Members' Bill", role: "Private Member MP",
    line: '"I introduce a Private Member\'s Bill for \'Free Sanitary Hygiene Products in Public Schools.\' Many students miss school due to a lack of access to sanitary products. This bill proposes free distribution in all schools."' },
  { title: "No-Confidence Motion", role: "Leader of Opposition",
    line: '"Honourable Speaker, the ruling government has failed to address major city issues, including traffic congestion and pollution. We, the opposition, move a No-Confidence Motion against the Council of Ministers."' },
  { title: "Prime Minister's Response", role: "Prime Minister",
    line: '"Honourable Speaker, our government has launched major infrastructure and environmental initiatives. We stand by our work and will continue to address these challenges."' },
  { title: "Closing Statement", role: "Leader of Opposition",
    line: '"We will continue to hold the government accountable and work for the people\'s welfare."' },
  { title: "Adjournment", role: "Speaker",
    line: '"With that, today\'s session comes to an end. The Youth Parliament is now adjourned." (Speaker bangs the gavel.)' },
];

export const REFERENCE_LINKS = [
  {
    label: "PRS Legislative Research",
    url: "https://www.prsindia.org",
    description: "Tracks legislative activity in Parliament — bills, debates, committee reports.",
  },
  {
    label: "Centre for Policy Research",
    url: "https://www.cprindia.org",
    description: "Independent think-tank publishing policy analysis across sectors.",
  },
  {
    label: "Young Indians (Yi)",
    url: "https://www.youngindians.net",
    description: "Official Yi website — program details, chapters, leadership.",
  },
];
