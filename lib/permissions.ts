/**
 * Centralized Permission Definitions
 *
 * This file contains all permission constants, role hierarchy levels,
 * and permission mappings for Yi Connect.
 *
 * Hierarchy Levels:
 * 0 - No role (unauthenticated or no assigned role)
 * 1 - Yi Member (basic member)
 * 2 - Sub-Chapter Lead / Coordinator
 * 3 - Co-Chair
 * 4 - Chair
 * 5 - Executive Member
 * 6 - National Admin
 */

// ============================================================================
// HIERARCHY LEVELS
// ============================================================================

export const HIERARCHY_LEVELS = {
  NONE: 0,
  MEMBER: 1,
  COORDINATOR: 2, // Sub-chapter lead, school/college/industry coordinator
  CO_CHAIR: 3,
  CHAIR: 4,
  EXECUTIVE: 5,
  NATIONAL_ADMIN: 6,
} as const

export type HierarchyLevel = (typeof HIERARCHY_LEVELS)[keyof typeof HIERARCHY_LEVELS]

// ============================================================================
// ROLE NAMES
// ============================================================================

export const ROLES = {
  YI_MEMBER: 'Yi Member',
  SUB_CHAPTER_LEAD: 'Sub-Chapter Lead',
  SCHOOL_COORDINATOR: 'School Coordinator',
  COLLEGE_COORDINATOR: 'College Coordinator',
  INDUSTRY_COORDINATOR: 'Industry Coordinator',
  VERTICAL_CHAIR: 'Vertical Chair',
  CO_CHAIR: 'Co-Chair',
  CHAIR: 'Chair',
  EXECUTIVE_MEMBER: 'Executive Member',
  NATIONAL_ADMIN: 'National Admin',
} as const

export type RoleName = (typeof ROLES)[keyof typeof ROLES]

// ============================================================================
// PERMISSION CONSTANTS
// ============================================================================

export const PERMISSIONS = {
  // Member Management
  VIEW_MEMBERS: 'view_members',
  MANAGE_MEMBERS: 'manage_members',
  ASSIGN_ROLES: 'assign_roles',
  VIEW_MEMBER_ASSESSMENTS: 'view_member_assessments',
  MANAGE_MEMBER_ASSESSMENTS: 'manage_member_assessments',

  // Events
  VIEW_EVENTS: 'view_events',
  CREATE_EVENTS: 'create_events',
  MANAGE_EVENTS: 'manage_events',
  MARK_ATTENDANCE: 'mark_attendance',
  VIEW_EVENT_REPORTS: 'view_event_reports',

  // Stakeholders
  VIEW_STAKEHOLDERS: 'view_stakeholders',
  MANAGE_STAKEHOLDERS: 'manage_stakeholders',
  VIEW_STAKEHOLDER_CONTACTS: 'view_stakeholder_contacts',
  MANAGE_STAKEHOLDER_CONTACTS: 'manage_stakeholder_contacts',

  // Session Bookings
  VIEW_BOOKINGS: 'view_bookings',
  CREATE_BOOKINGS: 'create_bookings',
  MANAGE_BOOKINGS: 'manage_bookings',
  APPROVE_BOOKINGS: 'approve_bookings',
  ASSIGN_TRAINERS: 'assign_trainers',

  // Industry Opportunities
  VIEW_OPPORTUNITIES: 'view_opportunities',
  CREATE_OPPORTUNITIES: 'create_opportunities',
  MANAGE_OPPORTUNITIES: 'manage_opportunities',
  APPLY_OPPORTUNITIES: 'apply_opportunities',
  APPROVE_APPLICATIONS: 'approve_applications',

  // Materials
  VIEW_MATERIALS: 'view_materials',
  UPLOAD_MATERIALS: 'upload_materials',
  APPROVE_MATERIALS: 'approve_materials',

  // Finance
  VIEW_FINANCE: 'view_finance',
  MANAGE_FINANCE: 'manage_finance',
  APPROVE_EXPENSES: 'approve_expenses',

  // Reports & Dashboards
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_REPORTS: 'view_reports',
  GENERATE_REPORTS: 'generate_reports',
  VIEW_ANALYTICS: 'view_analytics',

  // Verticals
  VIEW_VERTICAL_DASHBOARD: 'view_vertical_dashboard',
  MANAGE_VERTICAL: 'manage_vertical',
  VIEW_TRAINER_REPORTS: 'view_trainer_reports',
  MANAGE_VERTICAL_ACTIVITIES: 'manage_vertical_activities',

  // Sub-Chapters
  VIEW_SUB_CHAPTER: 'view_sub_chapter',
  MANAGE_SUB_CHAPTER: 'manage_sub_chapter',
  MANAGE_CHAPTER_MEMBERS: 'manage_chapter_members',
  CREATE_CHAPTER_EVENTS: 'create_chapter_events',
  VIEW_CHAPTER_REPORTS: 'view_chapter_reports',
  VIEW_CHAPTER_DASHBOARD: 'view_chapter_dashboard',

  // Communications
  VIEW_COMMUNICATIONS: 'view_communications',
  SEND_ANNOUNCEMENTS: 'send_announcements',
  MANAGE_TEMPLATES: 'manage_templates',

  // Knowledge Management
  VIEW_KNOWLEDGE_BASE: 'view_knowledge_base',
  MANAGE_KNOWLEDGE_BASE: 'manage_knowledge_base',

  // Awards
  VIEW_AWARDS: 'view_awards',
  NOMINATE_AWARDS: 'nominate_awards',
  MANAGE_AWARDS: 'manage_awards',
  SCORE_NOMINATIONS: 'score_nominations',

  // Administration
  MANAGE_SETTINGS: 'manage_settings',
  VIEW_AUDIT_LOGS: 'view_audit_logs',
  MANAGE_ROLES: 'manage_roles',
  IMPERSONATE_USERS: 'impersonate_users',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

// ============================================================================
// ROLE-PERMISSION MAPPINGS
// ============================================================================

/**
 * Default permissions for each role
 * These are used when creating new roles or validating access
 */
export const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  [ROLES.YI_MEMBER]: [
    PERMISSIONS.VIEW_EVENTS,
    PERMISSIONS.VIEW_STAKEHOLDERS,
    PERMISSIONS.VIEW_OPPORTUNITIES,
    PERMISSIONS.APPLY_OPPORTUNITIES,
    PERMISSIONS.VIEW_MATERIALS,
    PERMISSIONS.VIEW_KNOWLEDGE_BASE,
    PERMISSIONS.VIEW_AWARDS,
    PERMISSIONS.NOMINATE_AWARDS,
    PERMISSIONS.VIEW_COMMUNICATIONS,
  ],

  [ROLES.SUB_CHAPTER_LEAD]: [
    PERMISSIONS.VIEW_SUB_CHAPTER,
    PERMISSIONS.MANAGE_SUB_CHAPTER,
    PERMISSIONS.MANAGE_CHAPTER_MEMBERS,
    PERMISSIONS.CREATE_CHAPTER_EVENTS,
    PERMISSIONS.VIEW_CHAPTER_REPORTS,
    PERMISSIONS.VIEW_CHAPTER_DASHBOARD,
    PERMISSIONS.MARK_ATTENDANCE,
  ],

  [ROLES.SCHOOL_COORDINATOR]: [
    PERMISSIONS.VIEW_BOOKINGS,
    PERMISSIONS.CREATE_BOOKINGS,
    PERMISSIONS.VIEW_MATERIALS,
    PERMISSIONS.VIEW_EVENTS,
  ],

  [ROLES.COLLEGE_COORDINATOR]: [
    PERMISSIONS.VIEW_BOOKINGS,
    PERMISSIONS.CREATE_BOOKINGS,
    PERMISSIONS.VIEW_MATERIALS,
    PERMISSIONS.VIEW_EVENTS,
    PERMISSIONS.VIEW_OPPORTUNITIES,
  ],

  [ROLES.INDUSTRY_COORDINATOR]: [
    PERMISSIONS.VIEW_BOOKINGS,
    PERMISSIONS.CREATE_BOOKINGS,
    PERMISSIONS.VIEW_OPPORTUNITIES,
    PERMISSIONS.CREATE_OPPORTUNITIES,
    PERMISSIONS.VIEW_MATERIALS,
  ],

  [ROLES.VERTICAL_CHAIR]: [
    PERMISSIONS.VIEW_VERTICAL_DASHBOARD,
    PERMISSIONS.MANAGE_VERTICAL,
    PERMISSIONS.VIEW_TRAINER_REPORTS,
    PERMISSIONS.MANAGE_VERTICAL_ACTIVITIES,
    PERMISSIONS.VIEW_STAKEHOLDERS,
    PERMISSIONS.MANAGE_STAKEHOLDERS,
    PERMISSIONS.ASSIGN_TRAINERS,
    PERMISSIONS.APPROVE_MATERIALS,
    PERMISSIONS.VIEW_BOOKINGS,
    PERMISSIONS.APPROVE_BOOKINGS,
  ],

  [ROLES.CO_CHAIR]: [
    PERMISSIONS.VIEW_MEMBERS,
    PERMISSIONS.VIEW_MEMBER_ASSESSMENTS,
    PERMISSIONS.VIEW_EVENTS,
    PERMISSIONS.MANAGE_EVENTS,
    PERMISSIONS.VIEW_STAKEHOLDERS,
    PERMISSIONS.VIEW_BOOKINGS,
    PERMISSIONS.MANAGE_BOOKINGS,
    PERMISSIONS.VIEW_OPPORTUNITIES,
    PERMISSIONS.VIEW_MATERIALS,
    PERMISSIONS.VIEW_FINANCE,
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.VIEW_COMMUNICATIONS,
    PERMISSIONS.SEND_ANNOUNCEMENTS,
    PERMISSIONS.VIEW_AWARDS,
    PERMISSIONS.SCORE_NOMINATIONS,
  ],

  [ROLES.CHAIR]: [
    PERMISSIONS.VIEW_MEMBERS,
    PERMISSIONS.MANAGE_MEMBERS,
    PERMISSIONS.VIEW_MEMBER_ASSESSMENTS,
    PERMISSIONS.MANAGE_MEMBER_ASSESSMENTS,
    PERMISSIONS.VIEW_EVENTS,
    PERMISSIONS.CREATE_EVENTS,
    PERMISSIONS.MANAGE_EVENTS,
    PERMISSIONS.MARK_ATTENDANCE,
    PERMISSIONS.VIEW_EVENT_REPORTS,
    PERMISSIONS.VIEW_STAKEHOLDERS,
    PERMISSIONS.MANAGE_STAKEHOLDERS,
    PERMISSIONS.VIEW_STAKEHOLDER_CONTACTS,
    PERMISSIONS.MANAGE_STAKEHOLDER_CONTACTS,
    PERMISSIONS.VIEW_BOOKINGS,
    PERMISSIONS.MANAGE_BOOKINGS,
    PERMISSIONS.APPROVE_BOOKINGS,
    PERMISSIONS.ASSIGN_TRAINERS,
    PERMISSIONS.VIEW_OPPORTUNITIES,
    PERMISSIONS.MANAGE_OPPORTUNITIES,
    PERMISSIONS.APPROVE_APPLICATIONS,
    PERMISSIONS.VIEW_MATERIALS,
    PERMISSIONS.UPLOAD_MATERIALS,
    PERMISSIONS.APPROVE_MATERIALS,
    PERMISSIONS.VIEW_FINANCE,
    PERMISSIONS.MANAGE_FINANCE,
    PERMISSIONS.APPROVE_EXPENSES,
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.GENERATE_REPORTS,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.VIEW_COMMUNICATIONS,
    PERMISSIONS.SEND_ANNOUNCEMENTS,
    PERMISSIONS.MANAGE_TEMPLATES,
    PERMISSIONS.VIEW_KNOWLEDGE_BASE,
    PERMISSIONS.MANAGE_KNOWLEDGE_BASE,
    PERMISSIONS.VIEW_AWARDS,
    PERMISSIONS.MANAGE_AWARDS,
    PERMISSIONS.SCORE_NOMINATIONS,
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.VIEW_AUDIT_LOGS,
    PERMISSIONS.ASSIGN_ROLES,
  ],

  [ROLES.EXECUTIVE_MEMBER]: [
    // Executive has all Chair permissions plus additional
    ...Object.values(PERMISSIONS).filter(
      (p) => p !== PERMISSIONS.IMPERSONATE_USERS
    ),
  ],

  [ROLES.NATIONAL_ADMIN]: [
    // National Admin has all permissions
    ...Object.values(PERMISSIONS),
  ],
}

// ============================================================================
// USER TYPE DEFINITIONS (from Part3.md Section 5)
// ============================================================================

export const USER_TYPES = {
  YI_MEMBER: 'yi_member',
  SCHOOL_COORDINATOR: 'school_coordinator',
  COLLEGE_COORDINATOR: 'college_coordinator',
  INDUSTRY_COORDINATOR: 'industry_coordinator',
  VERTICAL_CHAIR: 'vertical_chair',
  ADMIN_CHAIR: 'admin_chair',
} as const

export type UserType = (typeof USER_TYPES)[keyof typeof USER_TYPES]

/**
 * Maps user types to their specific access patterns
 */
export const USER_TYPE_ACCESS = {
  [USER_TYPES.YI_MEMBER]: {
    description: 'Yi Members (Trainers)',
    canSee: ['own_profile', 'assigned_sessions', 'session_materials', 'own_awards', 'public_events'],
    cannotSee: ['other_member_profiles', 'other_assessments', 'other_applications', 'financial_data'],
    specialRules: [
      'Cannot see other members Skill-Will assessments',
      'Cannot see other members opportunity applications',
      'Can only mark attendance for assigned sessions',
    ],
  },
  [USER_TYPES.SCHOOL_COORDINATOR]: {
    description: 'School Coordinators (External)',
    canSee: ['own_institution_bookings', 'assigned_trainers', 'session_materials'],
    cannotSee: ['other_institutions', 'member_details', 'financial_data', 'assessments'],
    specialRules: [
      'Can only see bookings for their institution',
      'Can request sessions 7 days in advance',
      'No direct member access',
    ],
  },
  [USER_TYPES.COLLEGE_COORDINATOR]: {
    description: 'College Coordinators (External)',
    canSee: ['own_institution_bookings', 'assigned_trainers', 'session_materials', 'opportunities'],
    cannotSee: ['other_institutions', 'member_details', 'financial_data', 'assessments'],
    specialRules: [
      'Can only see bookings for their institution',
      'Can view and apply for industry opportunities',
      'Can request sessions 7 days in advance',
    ],
  },
  [USER_TYPES.INDUSTRY_COORDINATOR]: {
    description: 'Industry Coordinators (External)',
    canSee: ['own_company_data', 'opportunity_applications', 'mou_status'],
    cannotSee: ['other_industries', 'member_details', 'chapter_financials'],
    specialRules: [
      'Can only post opportunities if MoU is active',
      'Can only see applications to their opportunities',
      'Opportunities auto-close when MoU expires',
    ],
  },
  [USER_TYPES.VERTICAL_CHAIR]: {
    description: 'Vertical Chairs (Industry, YEA, Yuva, etc.)',
    canSee: ['vertical_stakeholders', 'vertical_trainers', 'vertical_sessions', 'vertical_reports'],
    cannotSee: ['other_vertical_data', 'member_assessments_outside_vertical'],
    specialRules: [
      'Full access to their vertical data only',
      'Can approve materials for their vertical',
      'Can assign trainers within their vertical',
    ],
  },
  [USER_TYPES.ADMIN_CHAIR]: {
    description: 'Admin/Chair (Full Access)',
    canSee: ['all_data'],
    cannotSee: [],
    specialRules: [
      'Full system access',
      'Can generate all reports',
      'Can override any restriction',
    ],
  },
} as const

// ============================================================================
// BUSINESS RULES (from Part3.md)
// ============================================================================

export const BUSINESS_RULES = {
  // Rule 1: Session booking advance time
  SESSION_BOOKING_ADVANCE_DAYS: 7,

  // Rule 2: Trainer workload limits
  TRAINER_MAX_SESSIONS_PER_MONTH: 6,
  TRAINER_WARNING_THRESHOLD: 4, // Show warning when trainer reaches this

  // Rule 3: Materials approval
  MATERIALS_APPROVAL_DAYS_BEFORE_SESSION: 3,
  MATERIALS_REQUIRE_CHAIR_APPROVAL: true,

  // Rule 5: MoU requirements
  MOU_REQUIRED_FOR_OPPORTUNITIES: true,
  MOU_AUTO_CLOSE_OPPORTUNITIES_ON_EXPIRY: true,

  // Rule 6: Privacy rules
  MEMBERS_CAN_SEE_OTHER_ASSESSMENTS: false,
  MEMBERS_CAN_SEE_OTHER_APPLICATIONS: false,
  COORDINATORS_SEE_OWN_INSTITUTION_ONLY: true,
} as const

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a hierarchy level has admin privileges (Chair+)
 */
export function isAdminLevel(level: number): boolean {
  return level >= HIERARCHY_LEVELS.CHAIR
}

/**
 * Check if a hierarchy level has leadership privileges (Co-Chair+)
 */
export function isLeadershipLevel(level: number): boolean {
  return level >= HIERARCHY_LEVELS.CO_CHAIR
}

/**
 * Check if a hierarchy level is coordinator level
 */
export function isCoordinatorLevel(level: number): boolean {
  return level === HIERARCHY_LEVELS.COORDINATOR
}

/**
 * Get the minimum hierarchy level required for a permission
 */
export function getMinimumLevelForPermission(permission: Permission): HierarchyLevel {
  // Administrative permissions require Chair+
  const adminPermissions: Permission[] = [
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.VIEW_AUDIT_LOGS,
    PERMISSIONS.MANAGE_ROLES,
    PERMISSIONS.IMPERSONATE_USERS,
    PERMISSIONS.ASSIGN_ROLES,
  ]

  if (adminPermissions.includes(permission)) {
    return HIERARCHY_LEVELS.CHAIR
  }

  // Approval permissions require Co-Chair+
  const approvalPermissions: Permission[] = [
    PERMISSIONS.APPROVE_BOOKINGS,
    PERMISSIONS.APPROVE_MATERIALS,
    PERMISSIONS.APPROVE_EXPENSES,
    PERMISSIONS.APPROVE_APPLICATIONS,
  ]

  if (approvalPermissions.includes(permission)) {
    return HIERARCHY_LEVELS.CO_CHAIR
  }

  // Management permissions typically require Coordinator+
  const managePermissions: Permission[] = [
    PERMISSIONS.MANAGE_MEMBERS,
    PERMISSIONS.MANAGE_EVENTS,
    PERMISSIONS.MANAGE_STAKEHOLDERS,
    PERMISSIONS.MANAGE_BOOKINGS,
    PERMISSIONS.MANAGE_OPPORTUNITIES,
  ]

  if (managePermissions.includes(permission)) {
    return HIERARCHY_LEVELS.COORDINATOR
  }

  // View and basic permissions for members
  return HIERARCHY_LEVELS.MEMBER
}

/**
 * Check if a role name is an external coordinator role
 */
export function isExternalCoordinatorRole(roleName: string): boolean {
  const externalRoles: string[] = [
    ROLES.SCHOOL_COORDINATOR,
    ROLES.COLLEGE_COORDINATOR,
    ROLES.INDUSTRY_COORDINATOR,
  ]
  return externalRoles.includes(roleName)
}

/**
 * Get stakeholder type from coordinator role
 */
export function getStakeholderTypeFromRole(
  roleName: RoleName
): 'school' | 'college' | 'industry' | null {
  switch (roleName) {
    case ROLES.SCHOOL_COORDINATOR:
      return 'school'
    case ROLES.COLLEGE_COORDINATOR:
      return 'college'
    case ROLES.INDUSTRY_COORDINATOR:
      return 'industry'
    default:
      return null
  }
}
