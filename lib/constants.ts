/**
 * Application Constants
 *
 * Central location for all application-wide constants and configuration.
 */

// Application Information
export const APP_NAME = 'Yi Connect'
export const APP_DESCRIPTION = 'Yi Chapter Management System'
export const APP_VERSION = '1.0.0'

// User Roles
export const ROLES = {
  MEMBER: 'Member',
  EC_MEMBER: 'EC Member',
  CHAIR: 'Chair',
  CO_CHAIR: 'Co-Chair',
  EXECUTIVE_MEMBER: 'Executive Member',
  NATIONAL_ADMIN: 'National Admin',
} as const

export type UserRole = (typeof ROLES)[keyof typeof ROLES]

// Role Hierarchy (higher number = more permissions)
export const ROLE_HIERARCHY = {
  [ROLES.MEMBER]: 1,
  [ROLES.EC_MEMBER]: 2,
  [ROLES.CO_CHAIR]: 3,
  [ROLES.CHAIR]: 4,
  [ROLES.EXECUTIVE_MEMBER]: 5,
  [ROLES.NATIONAL_ADMIN]: 6,
} as const

// Permissions
export const PERMISSIONS = {
  // Member Management
  VIEW_MEMBERS: 'view_members',
  MANAGE_MEMBERS: 'manage_members',
  EXPORT_MEMBERS: 'export_members',

  // Event Management
  VIEW_EVENTS: 'view_events',
  CREATE_EVENTS: 'create_events',
  MANAGE_EVENTS: 'manage_events',
  DELETE_EVENTS: 'delete_events',

  // Finance Management
  VIEW_FINANCES: 'view_finances',
  MANAGE_FINANCES: 'manage_finances',
  APPROVE_EXPENSES: 'approve_expenses',
  MANAGE_BUDGETS: 'manage_budgets',

  // Stakeholder Management
  VIEW_STAKEHOLDERS: 'view_stakeholders',
  MANAGE_STAKEHOLDERS: 'manage_stakeholders',

  // Communication
  SEND_ANNOUNCEMENTS: 'send_announcements',
  MANAGE_COMMUNICATIONS: 'manage_communications',

  // Awards & Recognition
  MANAGE_AWARDS: 'manage_awards',
  SUBMIT_NOMINATIONS: 'submit_nominations',

  // Leadership
  MANAGE_LEADERSHIP: 'manage_leadership',
  VIEW_SUCCESSION: 'view_succession',

  // Knowledge Management
  VIEW_DOCUMENTS: 'view_documents',
  MANAGE_DOCUMENTS: 'manage_documents',

  // System Administration
  MANAGE_SETTINGS: 'manage_settings',
  VIEW_ANALYTICS: 'view_analytics',
  MANAGE_ROLES: 'manage_roles',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

// Event Categories
export const EVENT_CATEGORIES = {
  TRAINING: 'Training',
  NETWORKING: 'Networking',
  COMMUNITY_SERVICE: 'Community Service',
  CONFERENCE: 'Conference',
  WORKSHOP: 'Workshop',
  SOCIAL: 'Social',
  FUNDRAISER: 'Fundraiser',
  COMPETITION: 'Competition',
  OTHER: 'Other',
} as const

// Event Statuses
export const EVENT_STATUSES = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
} as const

// RSVP Statuses
export const RSVP_STATUSES = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  DECLINED: 'Declined',
  WAITLISTED: 'Waitlisted',
  CHECKED_IN: 'Checked In',
} as const

// Financial Categories
export const EXPENSE_CATEGORIES = {
  VENUE: 'Venue',
  CATERING: 'Catering',
  MATERIALS: 'Materials',
  TRAVEL: 'Travel',
  MARKETING: 'Marketing',
  SPONSORSHIP: 'Sponsorship',
  VOLUNTEER: 'Volunteer',
  MISCELLANEOUS: 'Miscellaneous',
} as const

// Reimbursement Statuses
export const REIMBURSEMENT_STATUSES = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  PAID: 'Paid',
} as const

// Sponsorship Tiers
export const SPONSORSHIP_TIERS = {
  PLATINUM: 'Platinum',
  GOLD: 'Gold',
  SILVER: 'Silver',
  BRONZE: 'Bronze',
  PARTNER: 'Partner',
} as const

// Sponsorship Deal Stages
export const DEAL_STAGES = {
  PROSPECT: 'Prospect',
  CONTACTED: 'Contacted',
  PROPOSAL_SENT: 'Proposal Sent',
  NEGOTIATION: 'Negotiation',
  COMMITTED: 'Committed',
  LOST: 'Lost',
} as const

// Stakeholder Types
export const STAKEHOLDER_TYPES = {
  SCHOOL: 'School',
  COLLEGE: 'College',
  INDUSTRY: 'Industry',
  GOVERNMENT: 'Government',
  NGO: 'NGO',
  VENDOR: 'Vendor',
} as const

// Engagement Score Thresholds
export const ENGAGEMENT_THRESHOLDS = {
  EXCELLENT: 90,
  GOOD: 75,
  AVERAGE: 60,
  BELOW_AVERAGE: 40,
  POOR: 0,
} as const

// Leadership Readiness Thresholds
export const READINESS_THRESHOLDS = {
  READY: 70,
  DEVELOPING: 50,
  NEEDS_DEVELOPMENT: 0,
} as const

// File Upload Limits
export const FILE_LIMITS = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
} as const

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
  PAGE_SIZE_OPTIONS: [25, 50, 100],
} as const

// Date Formats
export const DATE_FORMATS = {
  DISPLAY: 'MMM dd, yyyy',
  DISPLAY_LONG: 'MMMM dd, yyyy',
  DISPLAY_WITH_TIME: 'MMM dd, yyyy HH:mm',
  INPUT: 'yyyy-MM-dd',
  INPUT_WITH_TIME: "yyyy-MM-dd'T'HH:mm",
} as const

// Cache Tags (for cache invalidation)
export const CACHE_TAGS = {
  MEMBERS: 'members',
  EVENTS: 'events',
  FINANCES: 'finances',
  STAKEHOLDERS: 'stakeholders',
  COMMUNICATIONS: 'communications',
  AWARDS: 'awards',
  LEADERSHIP: 'leadership',
  DOCUMENTS: 'documents',
  ANALYTICS: 'analytics',
} as const

// Navigation Routes
export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  LOGIN: '/login',
  SIGNUP: '/signup',
  UNAUTHORIZED: '/unauthorized',

  // Members
  MEMBERS: '/members',
  MEMBERS_NEW: '/members/new',
  MEMBERS_DETAIL: (id: string) => `/members/${id}`,
  MEMBERS_EDIT: (id: string) => `/members/${id}/edit`,
  MEMBERS_ANALYTICS: '/members/analytics',

  // Events
  EVENTS: '/events',
  EVENTS_NEW: '/events/new',
  EVENTS_DETAIL: (id: string) => `/events/${id}`,
  EVENTS_EDIT: (id: string) => `/events/${id}/edit`,
  EVENTS_ANALYTICS: '/events/analytics',

  // Finance
  FINANCE: '/finance',
  FINANCE_BUDGETS: '/finance/budgets',
  FINANCE_EXPENSES: '/finance/expenses',
  FINANCE_SPONSORS: '/finance/sponsors',
  FINANCE_REIMBURSEMENTS: '/finance/reimbursements',
  FINANCE_REPORTS: '/finance/reports',

  // Stakeholders
  STAKEHOLDERS: '/stakeholders',
  STAKEHOLDERS_NEW: '/stakeholders/new',
  STAKEHOLDERS_DETAIL: (id: string) => `/stakeholders/${id}`,

  // Communication
  COMMUNICATIONS: '/communications',
  COMMUNICATIONS_NEW: '/communications/new',

  // Awards
  AWARDS: '/awards',
  AWARDS_NOMINATIONS: '/awards/nominations',

  // Leadership
  LEADERSHIP: '/leadership',
  LEADERSHIP_SUCCESSION: '/leadership/succession',

  // Knowledge
  KNOWLEDGE: '/knowledge',
  KNOWLEDGE_SEARCH: '/knowledge/search',

  // Analytics
  ANALYTICS: '/analytics',
  ANALYTICS_VERTICALS: '/analytics/verticals',

  // Settings
  SETTINGS: '/settings',
  SETTINGS_PROFILE: '/settings/profile',
  SETTINGS_CHAPTER: '/settings/chapter',
} as const
