/**
 * Profile Type Definitions
 *
 * Types for user profile management
 */

import type { Database } from './database'

// Database types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

// Extended profile with relations
export interface ProfileWithRole extends Profile {
  roles?: Array<{
    role_name: string
    hierarchy_level: number
  }>
  chapter?: {
    id: string
    name: string
    location: string
  } | null
}

// Profile form data
export interface ProfileFormData {
  full_name: string
  email: string
  phone?: string | null
  avatar_url?: string | null
}
