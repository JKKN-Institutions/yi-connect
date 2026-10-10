export type TpSettings = {
  member_fee_inr: number;
  standard_fee_inr: number;
  gst_pct: number;
  catalyst_seats: number;
  meeting_cap: number;
  payment_instructions: string | null;
};

export type TpDelegate = {
  id: string;
  token: string;
  badge_code: string;
  full_name: string;
  chapter: string;
  zone: string;
  business_name: string | null;
  industry: string;
  role_title: string | null;
  needs: string[];
  offers: string[];
  partner_meetings_opt_in: boolean;
  checked_in_at: string | null;
  is_sample: boolean;
};

export type TpPartnerStatus = "applied" | "payment_submitted" | "confirmed" | "rejected";

export type TpPartner = {
  id: string;
  token: string;
  member_name: string;
  email: string;
  phone: string;
  chapter: string;
  zone: string | null;
  business_name: string;
  industry: string;
  offers: string[];
  wants_industries: string[];
  pitch: string | null;
  tier: "member" | "standard";
  amount_due_inr: number;
  status: TpPartnerStatus;
  payment_reference: string | null;
  payment_submitted_at: string | null;
  confirmed_at: string | null;
  reject_reason: string | null;
  is_sample: boolean;
  created_at: string;
};

export type TpMeeting = {
  id: string;
  partner_id: string;
  delegate_id: string;
  status: "requested" | "accepted" | "declined";
  slot: string | null;
  created_at: string;
  responded_at: string | null;
};

export type TpAgendaItem = {
  id: string;
  day: number;
  starts_at: string;
  title: string;
  hall: string;
  kind: string;
  sort_order: number;
  is_sample: boolean;
};

export type TpResult<T = null> = { success: true; data: T } | { success: false; error: string };
