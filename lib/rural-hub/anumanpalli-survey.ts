// GENERATED from artifacts/anumanpalli-road-map-tamil-2026-10-02.html (the page projected at the
// Anumanpalli launch, 2 Oct 2026). Tamil was machine-written and is NOT yet checked by a native
// speaker: every Tamil string here NEEDS NATIVE REVIEW before the page is shared widely.
// Strings marked NEW below did not appear on the projected page; they were added for the online form.

export const SURVEY_KEY = "anumanpalli-2026" as const;

/** The Yi chapter that owns this survey. Only that chapter's Chair and Co-Chair
 *  (yi_directory roles, app='yi') may read the answers. */
export const SURVEY_CHAPTER = "Erode" as const;

/** Flip to true once a native Tamil speaker has read every string on the page. */
export const TAMIL_REVIEWED = false;

export type Bi = { ta: string; en: string };
export type SurveyOption = { key: string } & Bi;
export type SurveyQuestion = Bi & {
  key: string;
  kind: "single" | "multi";
  /** multi only: most boxes a person may tick. */
  max: number | null;
  howto: Bi | null;
  options: SurveyOption[];
  /** Optional free-text box under the choices. */
  text: Bi | null;
};
export type SurveySection = Bi & { n: number; banner: Bi | null; questions: string[] };

export const HEADER = { label: "Yi கிராமப்புற மையம் · Yi ஈரோடு", title: { ta: "அனுமன்பள்ளி வளர்ச்சிப் பாதை", en: "Anumanpalli Road Map" }, sub: { ta: "அட்டவணை அனுமன்பள்ளி, முகாசி அனுமன்பள்ளி: ஒரே மையம். ஆகஸ்டில் நீங்கள் சொன்னதிலிருந்து உருவானது. உங்களுடன் சேர்ந்து முடிப்போம்.", en: "Attavanai Anumanpalli and Mugasi Anumanpalli, one hub. Built from what you told us in August. Finished with you, not for you." } };

export const ABOUT: (Bi & { k: string })[] = [
  { k: "இரண்டு ஊராட்சிகள், ஒரே மையம்", ta: "அட்டவணை, முகாசி அனுமன்பள்ளி", en: "Two panchayats, one hub" },
  { k: "இடம்", ta: "மொடக்குறிச்சி ஒன்றியம், அரச்சலூர் அருகில்", en: "Modakurichi block, near Arachalur" },
  { k: "மக்கள்", ta: "சுமார் 8,400 பேர், சுமார் 2,600 வீடுகள்", en: "About 8,400 people, about 2,600 homes" },
  { k: "முக்கியத் தொழில்", ta: "விவசாயம், பால், ஜவுளி, சாயத் தொழில்", en: "Farming, milk, textiles and dyeing" },
];
export const ABOUT_NOTE: Bi = { ta: "மக்கள், வீடுகள்: 2011 மக்கள்தொகைக் கணக்கெடுப்பு.", en: "People and homes are from the 2011 census, the latest village count available." };

/** Section 1, "You said": what the village told Yi in August. Shown, not asked. */
export const YOU_SAID_HEADING: Bi = { ta: "நீங்கள் சொன்னது", en: "You said" };
export const YOU_SAID: (Bi & { titleTa: string })[] = [
  { titleTa: "நல்ல விலைக்கு விற்பது", ta: "உறுதியாக வாங்குபவர் இல்லை. இடைத்தரகர்கள் விலை வைக்கிறார்கள். குளிர்பதனக் கிடங்கு இல்லை.", en: "Selling better. Nobody commits to buy. Middlemen set the price. No cold storage." },
  { titleTa: "மதிப்புக் கூட்டல்", ta: "ஊரை விட்டுப் போகும் முன் மதிப்புக் கூட்டுவது. பாலில் இருந்து இன்னும் அதிகம் பெறுவது.", en: "Farm to finished product. Add value before it leaves the village. Do more with our milk." },
  { titleTa: "சிறந்த விவசாயம்", ta: "இயற்கை விவசாயத்திற்கு மாறுவது. இழந்த பயிர்களை மீட்பது. பயிரும் கால்நடையும் சேர்ந்து.", en: "Farming better. Move to organic. Bring back lost crops. Crops and cattle together." },
  { titleTa: "இயந்திரமும் வேலையாட்களும்", ta: "இயந்திர வாடகை அதிகம். வேலையாட்கள் கிடைப்பது கடினம். புதிய BS6 வாகனங்களுக்கு மெக்கானிக் பயிற்சி இல்லை.", en: "Machines and labour. Machine rent is too high. Labour is hard to find. Our mechanics have no training for the newer BS6 vehicles." },
  { titleTa: "தொழில் திறன்", ta: "விவசாயத்தை ஒரு தொழிலாகப் பார்ப்பது. நிதி, திட்டமிடல் கற்பது. ஊருக்கு வெளியே உள்ளவர்களைச் சந்திப்பது.", en: "Business skills. Farming as a business. Finance and planning. Meet people beyond the village." },
  { titleTa: "பெண்கள்", ta: "தொழில்நுட்பம் கற்று, அதனுடன் வளர்வது.", en: "Women. Learn technology, and grow with it." },
  { titleTa: "குழந்தைகள், இளைஞர்கள்", ta: "தொழில் வழிகாட்டுதல். விளையாட்டு, களரி. போதை விழிப்புணர்வு. நூலகம்.", en: "Children and youth. Career guidance. Sports and Kalari. Drug awareness. A library." },
  { titleTa: "ஊர் நிர்வாகம்", ta: "டிஜிட்டல் ஊராட்சிக் கூட்டங்கள். நல்ல அடிப்படை வசதிகள்.", en: "Village systems. Digital panchayat meetings. Better infrastructure." },
];

export const QUESTIONS: SurveyQuestion[] = [
  {
    key: "year1_start", kind: "multi", max: 3,
    ta: "முதல் ஆண்டில் எந்த மூன்றைத் தொடங்கலாம்?",
    en: "Which three should we start in Year 1?",
    howto: { ta: "அதிகக் கைகள் பெறும் மூன்று முதலில் தொடங்கும்.", en: "The three with the most hands start first." },
    options: [
      { key: "composting_with_deepesh_bhaskar", ta: "மட்கு உரம் தயாரித்தல், Nilayaan நிறுவனத்தின் Deepesh Bhaskar உடன்", en: "Composting, with Deepesh Bhaskar of Nilayaan" },
      { key: "a_committed_buyer_for", ta: "ஒரு பயிருக்கு உறுதியான வாங்குபவர்", en: "A committed buyer for one crop, through Yi member businesses" },
      { key: "drug_awareness_and_career", ta: "குழந்தைகளுக்குப் போதை விழிப்புணர்வு, தொழில் வழிகாட்டுதல்", en: "Drug awareness and career guidance for children" },
      { key: "technology_training_for_women", ta: "பெண்களுக்குத் தொழில்நுட்பப் பயிற்சி", en: "Technology training for women" },
      { key: "shared_or_cold_storage", ta: "பொதுக் கிடங்கு அல்லது குளிர்பதனக் கிடங்கு", en: "Shared or cold storage" },
      { key: "a_machinery_bank", ta: "இயந்திர வங்கி", en: "A machinery bank" },
      { key: "more_from_our_milk", ta: "பாலில் இருந்து கூடுதல் வருமானம்", en: "More from our milk" },
      { key: "support_for_textile_and", ta: "ஜவுளி, சாயத் தொழிலுக்கு உதவி", en: "Support for textile and dyeing work" },
      { key: "sports_and_kalari", ta: "விளையாட்டு, களரி", en: "Sports and Kalari" },
      { key: "bs6_vehicle_training_for", ta: "மெக்கானிக்குகளுக்கு BS6 வாகனப் பயிற்சி", en: "BS6 vehicle training for our mechanics" },
    ],
    text: null,
  },
  {
    key: "share_with_students", kind: "single", max: null,
    ta: "நீங்கள் கேட்டவற்றைத் தீர்வுகளுக்காக மாணவர்களிடம் பகிரலாமா?",
    en: "Can we share what you asked with students, to work on solutions?",
    howto: null,
    options: [
      { key: "yes", ta: "ஆம்", en: "Yes" },
      { key: "yes_after_we_check", ta: "ஆம், நாங்கள் சரிபார்த்த பிறகு", en: "Yes, after we check it" },
      { key: "no", ta: "வேண்டாம்", en: "No" },
    ],
    text: null,
  },
  { // NEW Tamil options
    key: "compost_first", kind: "single", max: null,
    ta: "மட்கு உரம் தேர்வானால், தன் தோட்டத்தில் முதலில் செய்து பார்க்க யார் தயார்?",
    en: "If composting is chosen, who will try it first on their own farm?",
    howto: null,
    options: [
      { key: "yes_i_will_try", ta: "ஆம், நான் தயார்", en: "Yes, I will try it" },
      { key: "not_now", ta: "இப்போது இல்லை", en: "Not now" },
    ],
    text: null,
  },
  {
    key: "first_buyer_crop", kind: "single", max: null,
    ta: "வாங்குபவர் தேர்வானால், முதலில் எந்தப் பயிருக்கு?",
    en: "If a buyer is chosen, which crop first?",
    howto: null,
    options: [
      { key: "coconut", ta: "தேங்காய்", en: "Coconut" },
      { key: "milk", ta: "பால்", en: "Milk" },
      { key: "another_crop", ta: "வேறு பயிர்", en: "Another crop" },
    ],
    text: { ta: "பயிர்:", en: "Crop:" },
  },
  {
    key: "later_paths", kind: "multi", max: 3,
    ta: "முதல் ஆண்டுக்குப் பிறகு எந்தப் பாதைகளை ஆராயலாம்?",
    en: "Which paths should we explore after Year 1?",
    howto: { ta: "மூன்று வரை தேர்வு செய்யுங்கள்.", en: "Pick up to three." },
    options: [
      { key: "a_farmers_group_that", ta: "விவசாயிகள் குழு சேர்ந்து விற்பது, குழுவே நடத்தும் பொதுக் கிடங்கு", en: "A farmers' group that sells together, with shared storage it runs" },
      { key: "a_small_processing_unit", ta: "ஊர் இளைஞர்கள் நடத்தும் சிறிய பதப்படுத்தும் அலகு", en: "A small processing unit run by village youth" },
      { key: "organic_and_mixed_farming", ta: "விருப்பமுள்ள பண்ணைகளில் இயற்கை விவசாயம்", en: "Organic and mixed farming on farms that volunteer" },
      { key: "a_machinery_bank_owned", ta: "விவசாயிகள் குழுவுக்குச் சொந்தமான இயந்திர வங்கி", en: "A machinery bank owned by the farmers' group" },
      { key: "business_and_money_planning", ta: "இளம் விவசாயிகளுக்குத் தொழில், பணத் திட்டமிடல் பயிற்சி", en: "Business and money-planning training for young farmers" },
      { key: "women_s_groups_running", ta: "பெண்கள் குழுக்கள் நடத்தும் சிறு தொழில்", en: "Women's groups running a small business" },
      { key: "career_guidance_kalari_coaching", ta: "தொழில் வழிகாட்டுதல், களரிப் பயிற்சி, சிறிய நூலகம்", en: "Career guidance, Kalari coaching, a small library" },
      { key: "panchayat_meetings_recorded_and", ta: "ஊராட்சிக் கூட்டங்கள் பதிவு செய்து பகிர்வது", en: "Panchayat meetings recorded and shared" },
    ],
    text: null,
  },
  {
    key: "shared_assets_owner", kind: "single", max: null,
    ta: "கிடங்கு, இயந்திரம், தண்ணீர் போன்ற பொதுச் சொத்துகள் யாருக்குச் சொந்தம்?",
    en: "Who should own shared things like storage, machines and water?",
    howto: null,
    options: [
      { key: "the_farmers_group", ta: "விவசாயிகள் குழு", en: "The farmers' group" },
      { key: "the_panchayat", ta: "ஊராட்சி", en: "The panchayat" },
      { key: "a_committee_you_choose", ta: "நீங்கள் தேர்ந்தெடுக்கும் குழு", en: "A committee you choose" },
      { key: "decide_later", ta: "பிறகு முடிவு செய்வோம்", en: "Decide later" },
    ],
    text: null,
  },
  {
    key: "lead_selection", kind: "single", max: null,
    ta: "ஒவ்வொரு ஊராட்சியின் பொறுப்பாளரை எப்படித் தேர்வு செய்வது?",
    en: "How should each panchayat pick its lead?",
    howto: null,
    options: [
      { key: "name_one_today", ta: "இன்றே பெயரிடுவோம்", en: "Name one today" },
      { key: "at_the_next_meeting", ta: "அடுத்த கூட்டத்தில்", en: "At the next meeting" },
      { key: "one_youth_and_one", ta: "ஒரு இளைஞர், ஒரு மூத்தவர்", en: "One youth and one elder" },
    ],
    text: { ta: "பெயர்கள்:", en: "Names you suggest:" },
  },
  { // NEW Tamil options
    key: "youth_help", kind: "single", max: null,
    ta: "இதை நடத்த உதவ எந்த இளைஞர்கள் முன்வருவீர்கள்?",
    en: "Which young people will help run this?",
    howto: null,
    options: [
      { key: "i_will_help", ta: "நான் முன்வருகிறேன்", en: "I will help" },
      { key: "not_now", ta: "இப்போது இல்லை", en: "Not now" },
    ],
    text: null,
  },
  {
    key: "meeting_frequency", kind: "single", max: null,
    ta: "எவ்வளவு அடிக்கடி சந்திப்போம்?",
    en: "How often should we meet?",
    howto: null,
    options: [
      { key: "every_two_weeks", ta: "இரண்டு வாரத்திற்கு ஒருமுறை", en: "Every two weeks" },
      { key: "once_a_month", ta: "மாதம் ஒருமுறை", en: "Once a month" },
    ],
    text: null,
  },
  {
    key: "next_meeting", kind: "single", max: null,
    ta: "அடுத்த கூட்டம் எங்கே, எப்போது?",
    en: "Where and when is the next meeting?",
    howto: null,
    options: [
      { key: "here_again", ta: "மீண்டும் இங்கே", en: "Here again" },
      { key: "attavanai_anumanpalli", ta: "அட்டவணை அனுமன்பள்ளி", en: "Attavanai Anumanpalli" },
      { key: "mugasi_anumanpalli", ta: "முகாசி அனுமன்பள்ளி", en: "Mugasi Anumanpalli" },
      { key: "take_turns", ta: "மாறி மாறி", en: "Take turns" },
    ],
    text: { ta: "இடம், தேதி:", en: "Place and date:" },
  },
  {
    key: "working_signs", kind: "multi", max: 2,
    ta: "வேலை நடக்கிறது என்று எதை வைத்துத் தெரிந்துகொள்வது?",
    en: "What should tell us it is working?",
    howto: { ta: "இரண்டு தேர்வு செய்யுங்கள்.", en: "Pick two." },
    options: [
      { key: "most_of_you_keep", ta: "பெரும்பாலோர் தொடர்ந்து வருவது", en: "Most of you keep coming back" },
      { key: "a_buyer_commits_in", ta: "ஒரு வாங்குபவர் எழுத்துமூலம் உறுதி", en: "A buyer commits in writing" },
      { key: "the_first_compost_made", ta: "இங்கேயே தயாரான முதல் மட்கு உரம்", en: "The first compost made here" },
      { key: "children_reached", ta: "சென்றடைந்த குழந்தைகள்", en: "Children reached" },
      { key: "something_else", ta: "வேறு ஏதாவது", en: "Something else" },
    ],
    text: null,
  },
  {
    key: "you_said_check", kind: "single", max: null,
    ta: "நீங்கள் சொன்னதில் ஏதாவது விடுபட்டதா, தவறாக உள்ளதா?",
    en: "Did we miss anything, or get anything wrong, in \"You said\"?",
    howto: null,
    options: [
      { key: "all_correct", ta: "எல்லாம் சரி", en: "All correct" },
      { key: "something_is_missing", ta: "ஏதோ விடுபட்டது", en: "Something is missing" },
      { key: "something_is_wrong", ta: "ஏதோ தவறு", en: "Something is wrong" },
    ],
    text: { ta: "சேர்க்க / திருத்த:", en: "Added or corrected:" },
  },
];

export const SECTIONS: SurveySection[] = [
  { n: 2, ta: "முதல் ஆண்டு: நீங்கள் தேர்வு செய்யுங்கள்", en: "Year 1. You choose", banner: null, questions: ["year1_start", "share_with_students", "compost_first", "first_buyer_crop"] },
  { n: 3, ta: "ஆண்டு 2 முதல் 5 வரை: சாத்தியமான பாதைகள், முடிவு உங்களுடையது", en: "Years 2 to 5. Possible paths, you decide", banner: { ta: "இவை சாத்தியங்கள், முடிவுகள் அல்ல. நீங்கள் தேர்வு செய்தால் மட்டுமே தொடங்கும்.", en: "These are possibilities, not decisions. Each starts only if you choose it." }, questions: ["later_paths", "shared_assets_owner"] },
  { n: 4, ta: "யார் முன்னெடுப்பது", en: "Who carries it", banner: null, questions: ["lead_selection", "youth_help", "meeting_frequency", "next_meeting"] },
  { n: 5, ta: "வேலை நடக்கிறதா என்று எப்படித் தெரியும்", en: "How we will know it is working", banner: null, questions: ["working_signs"] },
  { n: 6, ta: "கடைசிக் கேள்வி", en: "One last question", banner: null, questions: ["you_said_check"] },
];

export const CLOSING: Bi = { ta: "இது பதிப்பு 1. இரண்டு வாரத்தில் நீங்களே பாதைகளைத் தேர்வு செய்து பதிப்பு 2-ஐ எழுதுவீர்கள்.", en: "This is version 1. In two weeks, you choose the paths and write version 2." };

/** NEW: the "about you" part of the online form. Short Tamil, needs native review. */
export const PANCHAYATS: SurveyOption[] = [
  { key: "attavanai", ta: "அட்டவணை அனுமன்பள்ளி", en: "Attavanai Anumanpalli" },
  { key: "mugasi", ta: "முகாசி அனுமன்பள்ளி", en: "Mugasi Anumanpalli" },
  { key: "other", ta: "வேறு ஊர்", en: "Another village" },
];
export const LABELS = {
  aboutYou: { ta: "உங்களைப் பற்றி", en: "About you" },
  name: { ta: "பெயர்", en: "Your name" },
  panchayat: { ta: "உங்கள் ஊராட்சி", en: "Your panchayat" },
  // Phone is now required: it is how a second send replaces the first (Director, 9 Nov).
  // The Tamil is the projected label with "(optional)" removed.
  phone: { ta: "தொலைபேசி", en: "Phone number" },
  // [TAMIL_TBD] needs a Tamil line from a native speaker; English only for now.
  phoneNote: { ta: "", en: "One answer per phone. If you send again from the same phone, your new answers replace the old ones." },
  anyElse: { ta: "வேறு ஏதாவது", en: "Anything else you want to tell us" },
  submit: { ta: "அனுப்புங்கள்", en: "Send" },
  thanks: { ta: "நன்றி!", en: "Thank you. Your answers are saved." },
  pickUpTo: { ta: "வரை", en: "up to" },
} satisfies Record<string, Bi>;

export const QUESTION_BY_KEY = new Map(QUESTIONS.map((q) => [q.key, q]));
