/**
 * Feature Toggle System for Yi Connect
 *
 * Defines all toggleable features and their default states.
 * Features can be enabled/disabled per chapter.
 */

import { LucideIcon } from 'lucide-react'
import {
  Calendar,
  MessageSquare,
  Building,
  BookOpen,
  Briefcase,
  FileText,
  Award,
  DollarSign,
  BarChart3,
  Brain,
  Users,
  Layers,
  GitBranch,
  Factory,
} from 'lucide-react'

// Feature names must match the database enum
export type FeatureName =
  | 'events'
  | 'communications'
  | 'stakeholder_crm'
  | 'session_bookings'
  | 'opportunities'
  | 'knowledge_base'
  | 'awards'
  | 'finance'
  | 'analytics'
  | 'member_intelligence'
  | 'succession_planning'
  | 'verticals'
  | 'sub_chapters'
  | 'industrial_visits'

export interface FeatureDefinition {
  name: string
  description: string
  icon: LucideIcon
  default: boolean
  dependencies: FeatureName[]
  category: 'core' | 'engagement' | 'operations' | 'advanced'
}

export const CHAPTER_FEATURES: Record<FeatureName, FeatureDefinition> = {
  events: {
    name: 'Events',
    description: 'Create and manage chapter events, RSVPs, and check-ins',
    icon: Calendar,
    default: true,
    dependencies: [],
    category: 'core',
  },
  communications: {
    name: 'Communications',
    description: 'Announcements, WhatsApp integration, and notifications',
    icon: MessageSquare,
    default: true,
    dependencies: [],
    category: 'core',
  },
  stakeholder_crm: {
    name: 'Stakeholder CRM',
    description: 'Manage schools, colleges, industries, and partners',
    icon: Building,
    default: true,
    dependencies: [],
    category: 'core',
  },
  session_bookings: {
    name: 'Session Bookings',
    description: 'Book and manage training sessions with stakeholders',
    icon: BookOpen,
    default: false,
    dependencies: ['stakeholder_crm'],
    category: 'engagement',
  },
  opportunities: {
    name: 'Opportunities',
    description: 'Industry opportunities and member applications',
    icon: Briefcase,
    default: false,
    dependencies: ['stakeholder_crm'],
    category: 'engagement',
  },
  knowledge_base: {
    name: 'Knowledge Base',
    description: 'Shared documents, wiki, and learning resources',
    icon: FileText,
    default: true,
    dependencies: [],
    category: 'core',
  },
  awards: {
    name: 'Awards',
    description: 'Award nominations, jury evaluation, and recognition',
    icon: Award,
    default: false,
    dependencies: [],
    category: 'engagement',
  },
  finance: {
    name: 'Finance',
    description: 'Budget tracking, expenses, and reimbursements',
    icon: DollarSign,
    default: false,
    dependencies: [],
    category: 'operations',
  },
  analytics: {
    name: 'Analytics',
    description: 'Dashboards, reports, and chapter metrics',
    icon: BarChart3,
    default: true,
    dependencies: [],
    category: 'core',
  },
  member_intelligence: {
    name: 'Member Intelligence',
    description: 'Skills tracking, Skill-Will matrix, and assessments',
    icon: Brain,
    default: false,
    dependencies: [],
    category: 'advanced',
  },
  succession_planning: {
    name: 'Succession Planning',
    description: 'Leadership pipeline and transition management',
    icon: Users,
    default: false,
    dependencies: ['member_intelligence'],
    category: 'advanced',
  },
  verticals: {
    name: 'Verticals',
    description: 'Vertical teams (MASOOM, Yuva, Climate, etc.)',
    icon: Layers,
    default: true,
    dependencies: [],
    category: 'core',
  },
  sub_chapters: {
    name: 'Sub-Chapters',
    description: 'School, college, and industry sub-chapter management',
    icon: GitBranch,
    default: false,
    dependencies: [],
    category: 'operations',
  },
  industrial_visits: {
    name: 'Industrial Visits',
    description: 'Plan and track industry visits for stakeholders',
    icon: Factory,
    default: false,
    dependencies: ['stakeholder_crm'],
    category: 'engagement',
  },
}

// Get features by category
export function getFeaturesByCategory() {
  const categories = {
    core: [] as FeatureName[],
    engagement: [] as FeatureName[],
    operations: [] as FeatureName[],
    advanced: [] as FeatureName[],
  }

  for (const [name, def] of Object.entries(CHAPTER_FEATURES)) {
    categories[def.category].push(name as FeatureName)
  }

  return categories
}

// Get default enabled features
export function getDefaultEnabledFeatures(): FeatureName[] {
  return Object.entries(CHAPTER_FEATURES)
    .filter(([, def]) => def.default)
    .map(([name]) => name as FeatureName)
}

// Check if a feature has all its dependencies met
export function hasDependenciesMet(
  feature: FeatureName,
  enabledFeatures: FeatureName[]
): boolean {
  const deps = CHAPTER_FEATURES[feature].dependencies
  return deps.every((dep) => enabledFeatures.includes(dep))
}

// Get features that depend on a given feature
export function getDependentFeatures(feature: FeatureName): FeatureName[] {
  return Object.entries(CHAPTER_FEATURES)
    .filter(([, def]) => def.dependencies.includes(feature))
    .map(([name]) => name as FeatureName)
}

// Feature to nav route mapping
export const FEATURE_ROUTES: Record<FeatureName, string[]> = {
  events: ['/events'],
  communications: ['/communications'],
  stakeholder_crm: ['/stakeholders'],
  session_bookings: ['/coordinator', '/session-bookings'],
  opportunities: ['/opportunities'],
  knowledge_base: ['/knowledge'],
  awards: ['/awards'],
  finance: ['/finance'],
  analytics: ['/members/analytics', '/members/skill-will-matrix'],
  member_intelligence: ['/members/skill-will-matrix'],
  succession_planning: ['/succession'],
  verticals: ['/verticals'],
  sub_chapters: ['/sub-chapters'],
  industrial_visits: ['/industrial-visits'],
}

// Get feature for a given route
export function getFeatureForRoute(pathname: string): FeatureName | null {
  for (const [feature, routes] of Object.entries(FEATURE_ROUTES)) {
    if (routes.some((route) => pathname.startsWith(route))) {
      return feature as FeatureName
    }
  }
  return null
}

// Category display info
export const CATEGORY_INFO = {
  core: {
    name: 'Core Features',
    description: 'Essential features for chapter operations',
  },
  engagement: {
    name: 'Engagement Features',
    description: 'Features for stakeholder and member engagement',
  },
  operations: {
    name: 'Operations Features',
    description: 'Features for chapter administration',
  },
  advanced: {
    name: 'Advanced Features',
    description: 'Advanced analytics and planning features',
  },
}
