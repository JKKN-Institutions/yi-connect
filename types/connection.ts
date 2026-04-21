/**
 * Connection Type Definitions (Stutzee Feature 4A)
 *
 * Types for member-to-member scan-to-connect networking.
 */

// ============================================================================
// Base Row
// ============================================================================

export interface MemberConnection {
  id: string;
  from_member_id: string;
  to_member_id: string;
  event_id: string | null;
  note: string | null;
  created_at: string;
}

// ============================================================================
// Public scan-landing profile (what /connect?token=... shows)
// ============================================================================

/**
 * Narrow, intentionally-shallow profile view for the public scan landing page.
 * Do NOT include email, phone, DOB, address, etc. Only fields safe to expose
 * to any authenticated member who scanned the QR.
 */
export interface PublicConnectProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  company: string | null;
  designation: string | null;
  industry: string | null;
  linkedin_url: string | null;
  chapter_name: string | null;
}

// ============================================================================
// Joined row used in address book views
// ============================================================================

export interface ConnectionWithMember {
  id: string;
  from_member_id: string;
  to_member_id: string;
  event_id: string | null;
  note: string | null;
  created_at: string;
  to_member: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    company: string | null;
    designation: string | null;
    linkedin_url: string | null;
    chapter_name: string | null;
  };
  event: {
    id: string;
    title: string;
    start_date: string;
  } | null;
  is_mutual: boolean;
}

// ============================================================================
// Grouped for address-book page
// ============================================================================

export interface ConnectionEventGroup {
  event_id: string | null;
  event_title: string | null; // null means "No event (direct scan)"
  event_date: string | null;
  connections: ConnectionWithMember[];
}

// ============================================================================
// Action input types (source of truth lives in validations/connection.ts)
// ============================================================================

export interface CreateConnectionInput {
  targetQrToken: string;
  eventId?: string | null;
  note?: string | null;
}

export interface UpdateConnectionNoteInput {
  connectionId: string;
  note: string | null;
}

// ============================================================================
// Own-profile QR metadata (returned to settings page)
// ============================================================================

export interface MyProfileQr {
  profile_qr_token: string;
  allow_networking_qr: boolean;
}
