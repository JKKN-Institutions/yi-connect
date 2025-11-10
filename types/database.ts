/**
 * Database Type Definitions
 *
 * Auto-generated types for database tables and relationships.
 * Generated from Supabase schema for Yi Connect.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      availability: {
        Row: {
          created_at: string
          date: string
          id: string
          member_id: string
          notes: string | null
          status: Database["public"]["Enums"]["availability_status"]
          time_slots: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          member_id: string
          notes?: string | null
          status?: Database["public"]["Enums"]["availability_status"]
          time_slots?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          member_id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["availability_status"]
          time_slots?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      certifications: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          issuing_organization: string
          name: string
          updated_at: string
          validity_period_months: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          issuing_organization: string
          name: string
          updated_at?: string
          validity_period_months?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          issuing_organization?: string
          name?: string
          updated_at?: string
          validity_period_months?: number | null
        }
        Relationships: []
      }
      chapters: {
        Row: {
          created_at: string | null
          established_date: string | null
          id: string
          location: string
          member_count: number | null
          name: string
          region: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          established_date?: string | null
          id?: string
          location: string
          member_count?: number | null
          name: string
          region?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          established_date?: string | null
          id?: string
          location?: string
          member_count?: number | null
          name?: string
          region?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      engagement_metrics: {
        Row: {
          calculated_at: string
          created_at: string
          engagement_score: number | null
          events_attended_last_3_months: number | null
          events_attended_last_6_months: number | null
          events_organized: number | null
          feedback_given: number | null
          id: string
          last_activity_date: string | null
          last_event_date: string | null
          member_id: string
          referrals_made: number | null
          total_contributions: number | null
          total_events_attended: number | null
          updated_at: string
          volunteer_hours: number | null
        }
        Insert: {
          calculated_at?: string
          created_at?: string
          engagement_score?: number | null
          events_attended_last_3_months?: number | null
          events_attended_last_6_months?: number | null
          events_organized?: number | null
          feedback_given?: number | null
          id?: string
          last_activity_date?: string | null
          last_event_date?: string | null
          member_id: string
          referrals_made?: number | null
          total_contributions?: number | null
          total_events_attended?: number | null
          updated_at?: string
          volunteer_hours?: number | null
        }
        Update: {
          calculated_at?: string
          created_at?: string
          engagement_score?: number | null
          events_attended_last_3_months?: number | null
          events_attended_last_6_months?: number | null
          events_organized?: number | null
          feedback_given?: number | null
          id?: string
          last_activity_date?: string | null
          last_event_date?: string | null
          member_id?: string
          referrals_made?: number | null
          total_contributions?: number | null
          total_events_attended?: number | null
          updated_at?: string
          volunteer_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "engagement_metrics_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      leadership_assessments: {
        Row: {
          areas_for_development: string[] | null
          assessed_at: string
          created_at: string
          engagement_score: number | null
          id: string
          leadership_experience_score: number | null
          member_id: string
          next_assessment_date: string | null
          notes: string | null
          readiness_level: string | null
          readiness_score: number | null
          recommended_roles: string[] | null
          recommended_training: string[] | null
          skills_score: number | null
          strengths: string[] | null
          tenure_score: number | null
          training_score: number | null
          updated_at: string
        }
        Insert: {
          areas_for_development?: string[] | null
          assessed_at?: string
          created_at?: string
          engagement_score?: number | null
          id?: string
          leadership_experience_score?: number | null
          member_id: string
          next_assessment_date?: string | null
          notes?: string | null
          readiness_level?: string | null
          readiness_score?: number | null
          recommended_roles?: string[] | null
          recommended_training?: string[] | null
          skills_score?: number | null
          strengths?: string[] | null
          tenure_score?: number | null
          training_score?: number | null
          updated_at?: string
        }
        Update: {
          areas_for_development?: string[] | null
          assessed_at?: string
          created_at?: string
          engagement_score?: number | null
          id?: string
          leadership_experience_score?: number | null
          member_id?: string
          next_assessment_date?: string | null
          notes?: string | null
          readiness_level?: string | null
          readiness_score?: number | null
          recommended_roles?: string[] | null
          recommended_training?: string[] | null
          skills_score?: number | null
          strengths?: string[] | null
          tenure_score?: number | null
          training_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leadership_assessments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_certifications: {
        Row: {
          certificate_number: string | null
          certification_id: string
          created_at: string
          document_url: string | null
          expiry_date: string | null
          id: string
          issued_date: string
          member_id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          certificate_number?: string | null
          certification_id: string
          created_at?: string
          document_url?: string | null
          expiry_date?: string | null
          id?: string
          issued_date: string
          member_id: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          certificate_number?: string | null
          certification_id?: string
          created_at?: string
          document_url?: string | null
          expiry_date?: string | null
          id?: string
          issued_date?: string
          member_id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_certifications_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "certifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_certifications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_skills: {
        Row: {
          created_at: string
          id: string
          is_willing_to_mentor: boolean
          member_id: string
          notes: string | null
          proficiency: Database["public"]["Enums"]["proficiency_level"]
          skill_id: string
          updated_at: string
          years_of_experience: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_willing_to_mentor?: boolean
          member_id: string
          notes?: string | null
          proficiency?: Database["public"]["Enums"]["proficiency_level"]
          skill_id: string
          updated_at?: string
          years_of_experience?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          is_willing_to_mentor?: boolean
          member_id?: string
          notes?: string | null
          proficiency?: Database["public"]["Enums"]["proficiency_level"]
          skill_id?: string
          updated_at?: string
          years_of_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "member_skills_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          address: string | null
          chapter_id: string | null
          city: string | null
          communication_preferences: Json | null
          company: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          designation: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          gender: string | null
          id: string
          industry: string | null
          interests: string[] | null
          is_active: boolean
          linkedin_url: string | null
          member_since: string
          membership_number: string | null
          membership_status: string
          notes: string | null
          pincode: string | null
          preferred_event_types: string[] | null
          state: string | null
          updated_at: string
          years_of_experience: number | null
        }
        Insert: {
          address?: string | null
          chapter_id?: string | null
          city?: string | null
          communication_preferences?: Json | null
          company?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          designation?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          gender?: string | null
          id: string
          industry?: string | null
          interests?: string[] | null
          is_active?: boolean
          linkedin_url?: string | null
          member_since?: string
          membership_number?: string | null
          membership_status?: string
          notes?: string | null
          pincode?: string | null
          preferred_event_types?: string[] | null
          state?: string | null
          updated_at?: string
          years_of_experience?: number | null
        }
        Update: {
          address?: string | null
          chapter_id?: string | null
          city?: string | null
          communication_preferences?: Json | null
          company?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          designation?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          gender?: string | null
          id?: string
          industry?: string | null
          interests?: string[] | null
          is_active?: boolean
          linkedin_url?: string | null
          member_since?: string
          membership_number?: string | null
          membership_status?: string
          notes?: string | null
          pincode?: string | null
          preferred_event_types?: string[] | null
          state?: string | null
          updated_at?: string
          years_of_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "members_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          chapter_id: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          chapter_id?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          chapter_id?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          hierarchy_level: number
          id: string
          name: string
          permissions: string[] | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          hierarchy_level?: number
          id?: string
          name: string
          permissions?: string[] | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          hierarchy_level?: number
          id?: string
          name?: string
          permissions?: string[] | null
        }
        Relationships: []
      }
      skills: {
        Row: {
          category: Database["public"]["Enums"]["skill_category"]
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["skill_category"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["skill_category"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          role_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          role_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_engagement_score: {
        Args: { p_member_id: string }
        Returns: number
      }
      calculate_leadership_readiness: {
        Args: { p_member_id: string }
        Returns: number
      }
      get_skill_gaps: {
        Args: { p_chapter_id: string }
        Returns: {
          advanced_count: number
          avg_proficiency: number
          beginner_count: number
          expert_count: number
          gap_severity: string
          intermediate_count: number
          mentors_available: number
          skill_category: Database["public"]["Enums"]["skill_category"]
          skill_id: string
          skill_name: string
          total_members_with_skill: number
        }[]
      }
    }
    Enums: {
      availability_status: "available" | "busy" | "unavailable"
      proficiency_level: "beginner" | "intermediate" | "advanced" | "expert"
      skill_category:
        | "technical"
        | "business"
        | "creative"
        | "leadership"
        | "communication"
        | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper types for easy access
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"]

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"]

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T]
