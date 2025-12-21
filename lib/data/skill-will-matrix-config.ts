/**
 * Skill/Will Matrix Configuration
 *
 * Shared configuration for quadrant colors, labels, and actions.
 * This file can be safely imported from client components.
 */

import type { SkillWillCategory } from '@/types/member';

export const QUADRANT_CONFIG = {
  star: {
    label: 'Stars',
    description: 'High skill & high engagement',
    color: '#10B981', // green-500
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-700 dark:text-green-300',
    borderColor: 'border-green-500',
    icon: 'Star',
    action: 'Delegate, empower, showcase',
  },
  enthusiast: {
    label: 'Enthusiasts',
    description: 'High will, developing skills',
    color: '#3B82F6', // blue-500
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    textColor: 'text-blue-700 dark:text-blue-300',
    borderColor: 'border-blue-500',
    icon: 'Rocket',
    action: 'Train, mentor, develop',
  },
  cynic: {
    label: 'Cynics',
    description: 'High skill, lower engagement',
    color: '#F97316', // orange-500
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    textColor: 'text-orange-700 dark:text-orange-300',
    borderColor: 'border-orange-500',
    icon: 'AlertTriangle',
    action: 'Re-engage, understand, challenge',
  },
  dead_wood: {
    label: 'Needs Attention',
    description: 'Development opportunity',
    color: '#EF4444', // red-500
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    textColor: 'text-red-700 dark:text-red-300',
    borderColor: 'border-red-500',
    icon: 'AlertCircle',
    action: 'Support, coach, decide',
  },
} as const;

export type QuadrantConfig = typeof QUADRANT_CONFIG;
