// Constants + sample Indian data for the Mock Data Seeder.
// Pure module — no "use server", no Supabase. Imported by both the server
// actions and the admin UI.

export const MOCK_MARKER = "[MOCK]";

export const MOCK_SEASON_NAME = "YIP Mock Season 2026";
export const MOCK_SEASON_YEAR = 2026;

export const MOCK_CHAPTER_EVENT_NAME = "MOCK Chapter Round — Erode";
export const MOCK_REGIONAL_EVENT_NAME = "MOCK Regional — South";
export const MOCK_NATIONAL_EVENT_NAME = "MOCK National Finals — Delhi";

export const MOCK_CHAPTER_VENUE = {
  name: "Kongu Vellalar Institute of Technology",
  address: "Kongu Nagar, Perundurai, Erode, Tamil Nadu 638060",
  city: "Erode",
  state: "Tamil Nadu",
  chapter: "Erode",
};

export const MOCK_REGIONAL_VENUE = {
  name: "IIT Madras — Research Park Auditorium",
  address: "Kanagam Road, Taramani, Chennai, Tamil Nadu 600113",
  city: "Chennai",
  state: "Tamil Nadu",
  chapter: "Chennai",
};

export const MOCK_NATIONAL_VENUE = {
  name: "Vigyan Bhavan",
  address: "Maulana Azad Road, New Delhi 110011",
  city: "New Delhi",
  state: "Delhi",
  chapter: "New Delhi",
};

// ── Tamil Nadu schools — realistic mix of Thalir and non-Thalir ────────
export const MOCK_SCHOOLS: Array<{
  name: string;
  city: string;
  is_thalir: boolean;
  contact_person: string;
  contact_phone: string;
}> = [
  {
    name: "Vellalar Matriculation Higher Secondary School",
    city: "Erode",
    is_thalir: true,
    contact_person: "Mrs. Revathi Krishnan",
    contact_phone: "9443521187",
  },
  {
    name: "Kongu Vellalar Matric Hr Sec School",
    city: "Erode",
    is_thalir: true,
    contact_person: "Mr. Selvaraj Palanisamy",
    contact_phone: "9843112290",
  },
  {
    name: "Nirmala Girls Higher Secondary School",
    city: "Coimbatore",
    is_thalir: false,
    contact_person: "Sr. Mary Assumpta",
    contact_phone: "9894553201",
  },
  {
    name: "Bharathi Vidya Bhavan Sr Sec School",
    city: "Salem",
    is_thalir: true,
    contact_person: "Mr. Venkatesan Raja",
    contact_phone: "9786621134",
  },
  {
    name: "PSG Sarvajana Higher Secondary School",
    city: "Coimbatore",
    is_thalir: false,
    contact_person: "Mrs. Lakshmi Rangarajan",
    contact_phone: "9443890015",
  },
];

// ── Indian names pool — male ────────────────────────────────────────────
export const MALE_NAMES: string[] = [
  "Arjun Murugan",
  "Karthik Subramanian",
  "Vishnu Rajasekaran",
  "Bharath Venkatesh",
  "Surya Ramakrishnan",
  "Aravind Balasubramanian",
  "Dhanush Palaniappan",
  "Gokul Chandrashekar",
  "Harish Manickam",
  "Jayaram Nataraj",
  "Krishnan Shankar",
  "Madhavan Iyer",
  "Nithin Venkataraman",
  "Praveen Arunachalam",
  "Rahul Natesan",
  "Siddharth Vasudevan",
  "Tharun Balaji",
  "Varun Ganesh",
  "Yash Ravichandran",
  "Adithya Srinivasan",
  "Aniruddh Velan",
  "Balaji Ramasamy",
  "Deepak Srinivas",
  "Eshwar Lakshmanan",
  "Faizan Abdullah",
  "Gautham Sundaram",
  "Hari Prasad",
  "Ishaan Gopinath",
  "Joshua Daniel",
  "Keerthan Sampath",
];

// ── Indian names pool — female ──────────────────────────────────────────
export const FEMALE_NAMES: string[] = [
  "Aishwarya Narayanan",
  "Divya Ramachandran",
  "Ishita Mohan",
  "Janani Parthasarathy",
  "Keerthana Dhanapal",
  "Lavanya Ramesh",
  "Meenakshi Anand",
  "Nandini Krishnamoorthy",
  "Pavithra Senthil",
  "Revathi Sundar",
  "Shruthi Ganesan",
  "Tanvi Vaidyanathan",
  "Uma Bharathi",
  "Vaishnavi Krishnan",
  "Yamuna Natarajan",
  "Abhirami Gopal",
  "Bhavana Pillai",
  "Chitra Devi",
  "Deepika Rangan",
  "Gayathri Mani",
  "Harshini Kumar",
  "Indhumathi Raj",
  "Kavya Sundararajan",
  "Lakshmi Priya",
  "Manisha Swaminathan",
  "Nivedha Ashwin",
  "Priya Darshini",
  "Radhika Menon",
  "Sneha Ramanujan",
  "Thanushree Bose",
];

// ── Indian jury names ──────────────────────────────────────────────────
export const MOCK_JURY_NAMES: string[] = [
  "Dr. Ramaswamy Venkataraman",
  "Smt. Lakshmi Narayanan",
  "Shri Kannan Gopalakrishnan",
  "Prof. Uma Mahadevan",
];

// ── Volunteer names — YUVA + external ──────────────────────────────────
export const MOCK_VOLUNTEER_NAMES: string[] = [
  "Aakash Sundar",
  "Brindha Kannan",
  "Chetan Rao",
  "Dhanya Prakash",
  "Eshan Gupta",
  "Farida Sheikh",
  "Girish Kumaran",
  "Hema Jayaraj",
  "Irfan Mohammed",
  "Jaya Chandran",
];

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Deterministic pseudo-random generator so a seed call produces repeatable
 * variance across participants (useful for comparable demos). Mulberry32.
 */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Unique-looking 10-digit Indian phone from an index. Starts with 9/8/7.
 * Designed to avoid collisions with each other and with realistic real
 * numbers (we stamp a distinctive 555... middle section).
 */
export function mockPhone(index: number): string {
  const prefixes = ["9", "8", "7"];
  const prefix = prefixes[index % prefixes.length];
  // Fixed 555 middle sentinel makes these visually identifiable as mocks.
  const suffix = String(100000 + index).padStart(6, "0");
  return `${prefix}555${suffix}`;
}

export const MOCK_PARENT_PHONE_PREFIX = "9";

/**
 * Build a notes string that is always prefixed with [MOCK] so even if the
 * is_mock flag is accidentally cleared, the row is still unambiguously
 * identifiable as demo data.
 */
export function mockNote(detail?: string): string {
  return detail ? `${MOCK_MARKER} ${detail}` : MOCK_MARKER;
}

// ── Oath ───────────────────────────────────────────────────────────────
export const MOCK_OATH_TEXT =
  '"I, <Name>, do solemnly affirm that I will bear true faith and allegiance to the Constitution of India and faithfully discharge the duties of my office."';

// ── Distribution counts (single source of truth for UI + seeder) ───────
export const MOCK_COUNTS = {
  seasons: 1,
  events: 3, // chapter + regional + national
  schools: 5,
  people: 30, // unique students; 1 re-used in regional + national
  participants: 32, // 30 chapter + 1 regional + 1 national
  parties: 2,
  jury_assignments: 4,
  scores: 120, // 30 participants x 4 jurors @ chapter
  parliamentary_motions: 5,
  bills: 2,
  questions: 10,
  participant_fees: 30,
  volunteers: 10,
  feedback_responses: 15,
  event_media: 5,
  branding_compliance_checks: 3,
  invitation_approvals: 1,
  promotions: 2, // chapter -> regional, regional -> national
  registrations: 30, // one per chapter participant
  organizer_profiles: 1, // 1 mock Chapter EM
} as const;

export type MockCounts = Record<keyof typeof MOCK_COUNTS, number>;
