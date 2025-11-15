/**
 * Database Type Definitions
 *
 * Auto-generated types for database tables and relationships.
 * Generated from Supabase schema for Yi Connect.
 *
 * Last updated: 2025-11-15 (Added Event Lifecycle Manager tables)
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      approved_emails: {
        Row: {
          approved_at: string | null
          approved_by: string
          assigned_chapter_id: string | null
          created_at: string | null
          created_member_id: string | null
          email: string
          first_login_at: string | null
          id: string
          is_active: boolean | null
          member_created: boolean | null
          member_request_id: string | null
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by: string
          assigned_chapter_id?: string | null
          created_at?: string | null
          created_member_id?: string | null
          email: string
          first_login_at?: string | null
          id?: string
          is_active?: boolean | null
          member_created?: boolean | null
          member_request_id?: string | null
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string
          assigned_chapter_id?: string | null
          created_at?: string | null
          created_member_id?: string | null
          email?: string
          first_login_at?: string | null
          id?: string
          is_active?: boolean | null
          member_created?: boolean | null
          member_request_id?: string | null
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approved_emails_assigned_chapter_id_fkey"
            columns: ["assigned_chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approved_emails_created_member_id_fkey"
            columns: ["created_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approved_emails_member_request_id_fkey"
            columns: ["member_request_id"]
            isOneToOne: false
            referencedRelation: "member_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      availability: {
        Row: {
          created_at: string
          date: string
          geographic_flexibility: string | null
          id: string
          member_id: string
          notes: string | null
          notice_period: string | null
          preferred_contact_method: string | null
          preferred_days: string | null
          status: Database["public"]["Enums"]["availability_status"]
          time_commitment_hours: number | null
          time_slots: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          geographic_flexibility?: string | null
          id?: string
          member_id: string
          notes?: string | null
          notice_period?: string | null
          preferred_contact_method?: string | null
          preferred_days?: string | null
          status?: Database["public"]["Enums"]["availability_status"]
          time_commitment_hours?: number | null
          time_slots?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          geographic_flexibility?: string | null
          id?: string
          member_id?: string
          notes?: string | null
          notice_period?: string | null
          preferred_contact_method?: string | null
          preferred_days?: string | null
          status?: Database["public"]["Enums"]["availability_status"]
          time_commitment_hours?: number | null
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
      event_checkins: {
        Row: {
          attendee_id: string
          attendee_type: string
          check_in_method: string | null
          checked_in_at: string
          checked_in_by: string | null
          created_at: string
          event_id: string
          id: string
          notes: string | null
        }
        Insert: {
          attendee_id: string
          attendee_type: string
          check_in_method?: string | null
          checked_in_at?: string
          checked_in_by?: string | null
          created_at?: string
          event_id: string
          id?: string
          notes?: string | null
        }
        Update: {
          attendee_id?: string
          attendee_type?: string
          check_in_method?: string | null
          checked_in_at?: string
          checked_in_by?: string | null
          created_at?: string
          event_id?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_checkins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_documents: {
        Row: {
          created_at: string
          description: string | null
          document_type: string
          event_id: string
          file_size_kb: number | null
          file_url: string
          id: string
          is_public: boolean
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          document_type: string
          event_id: string
          file_size_kb?: number | null
          file_url: string
          id?: string
          is_public?: boolean
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          document_type?: string
          event_id?: string
          file_size_kb?: number | null
          file_url?: string
          id?: string
          is_public?: boolean
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_documents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_feedback: {
        Row: {
          content_rating: number | null
          created_at: string
          event_id: string
          id: string
          is_anonymous: boolean
          member_id: string | null
          organization_rating: number | null
          overall_rating: number | null
          suggestions: string | null
          updated_at: string
          venue_rating: number | null
          what_could_improve: string | null
          what_went_well: string | null
          would_attend_again: boolean | null
        }
        Insert: {
          content_rating?: number | null
          created_at?: string
          event_id: string
          id?: string
          is_anonymous?: boolean
          member_id?: string | null
          organization_rating?: number | null
          overall_rating?: number | null
          suggestions?: string | null
          updated_at?: string
          venue_rating?: number | null
          what_could_improve?: string | null
          what_went_well?: string | null
          would_attend_again?: boolean | null
        }
        Update: {
          content_rating?: number | null
          created_at?: string
          event_id?: string
          id?: string
          is_anonymous?: boolean
          member_id?: string | null
          organization_rating?: number | null
          overall_rating?: number | null
          suggestions?: string | null
          updated_at?: string
          venue_rating?: number | null
          what_could_improve?: string | null
          what_went_well?: string | null
          would_attend_again?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "event_feedback_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_feedback_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      event_impact_metrics: {
        Row: {
          attendance_rate: number | null
          average_rating: number | null
          beneficiaries_count: number | null
          calculated_at: string
          event_id: string
          feedback_count: number
          guests_attended: number
          id: string
          members_attended: number
          net_profit: number | null
          satisfaction_rate: number | null
          social_impact_description: string | null
          total_attended: number
          total_expense: number | null
          total_registered: number
          total_revenue: number | null
          total_volunteer_hours: number
          updated_at: string
          volunteers_count: number
        }
        Insert: {
          attendance_rate?: number | null
          average_rating?: number | null
          beneficiaries_count?: number | null
          calculated_at?: string
          event_id: string
          feedback_count?: number
          guests_attended?: number
          id?: string
          members_attended?: number
          net_profit?: number | null
          satisfaction_rate?: number | null
          social_impact_description?: string | null
          total_attended?: number
          total_expense?: number | null
          total_registered?: number
          total_revenue?: number | null
          total_volunteer_hours?: number
          updated_at?: string
          volunteers_count?: number
        }
        Update: {
          attendance_rate?: number | null
          average_rating?: number | null
          beneficiaries_count?: number | null
          calculated_at?: string
          event_id?: string
          feedback_count?: number
          guests_attended?: number
          id?: string
          members_attended?: number
          net_profit?: number | null
          satisfaction_rate?: number | null
          social_impact_description?: string | null
          total_attended?: number
          total_expense?: number | null
          total_registered?: number
          total_revenue?: number | null
          total_volunteer_hours?: number
          updated_at?: string
          volunteers_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_impact_metrics_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvps: {
        Row: {
          checked_in_at: string | null
          checked_in_by: string | null
          created_at: string
          dietary_restrictions: string | null
          event_id: string
          guests_count: number
          id: string
          member_id: string
          notes: string | null
          special_requirements: string | null
          status: Database["public"]["Enums"]["rsvp_status"]
          updated_at: string
        }
        Insert: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string
          dietary_restrictions?: string | null
          event_id: string
          guests_count?: number
          id?: string
          member_id: string
          notes?: string | null
          special_requirements?: string | null
          status?: Database["public"]["Enums"]["rsvp_status"]
          updated_at?: string
        }
        Update: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string
          dietary_restrictions?: string | null
          event_id?: string
          guests_count?: number
          id?: string
          member_id?: string
          notes?: string | null
          special_requirements?: string | null
          status?: Database["public"]["Enums"]["rsvp_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      event_templates: {
        Row: {
          category: Database["public"]["Enums"]["event_category"]
          checklist: Json | null
          created_at: string
          created_by: string | null
          default_capacity: number | null
          default_duration_hours: number | null
          default_volunteer_roles: Json | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["event_category"]
          checklist?: Json | null
          created_at?: string
          created_by?: string | null
          default_capacity?: number | null
          default_duration_hours?: number | null
          default_volunteer_roles?: Json | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["event_category"]
          checklist?: Json | null
          created_at?: string
          created_by?: string | null
          default_capacity?: number | null
          default_duration_hours?: number | null
          default_volunteer_roles?: Json | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_volunteers: {
        Row: {
          accepted_at: string | null
          assigned_at: string
          assigned_by: string | null
          completed_at: string | null
          created_at: string
          event_id: string
          feedback: string | null
          hours_contributed: number | null
          id: string
          member_id: string
          notes: string | null
          rating: number | null
          role_id: string | null
          role_name: string
          status: Database["public"]["Enums"]["volunteer_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          assigned_at?: string
          assigned_by?: string | null
          completed_at?: string | null
          created_at?: string
          event_id: string
          feedback?: string | null
          hours_contributed?: number | null
          id?: string
          member_id: string
          notes?: string | null
          rating?: number | null
          role_id?: string | null
          role_name: string
          status?: Database["public"]["Enums"]["volunteer_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          assigned_at?: string
          assigned_by?: string | null
          completed_at?: string | null
          created_at?: string
          event_id?: string
          feedback?: string | null
          hours_contributed?: number | null
          id?: string
          member_id?: string
          notes?: string | null
          rating?: number | null
          role_id?: string | null
          role_name?: string
          status?: Database["public"]["Enums"]["volunteer_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_volunteers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_volunteers_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_volunteers_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "volunteer_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          actual_expense: number | null
          allow_guests: boolean
          attachment_urls: string[] | null
          banner_image_url: string | null
          category: Database["public"]["Enums"]["event_category"]
          chapter_id: string | null
          co_organizers: string[] | null
          created_at: string
          current_registrations: number
          custom_fields: Json | null
          description: string | null
          end_date: string
          estimated_budget: number | null
          guest_limit: number | null
          id: string
          is_active: boolean
          is_featured: boolean
          is_virtual: boolean
          max_capacity: number | null
          organizer_id: string | null
          registration_end_date: string | null
          registration_start_date: string | null
          requires_approval: boolean
          send_reminders: boolean
          start_date: string
          status: Database["public"]["Enums"]["event_status"]
          tags: string[] | null
          template_id: string | null
          title: string
          updated_at: string
          venue_address: string | null
          venue_id: string | null
          virtual_meeting_link: string | null
          waitlist_enabled: boolean
        }
        Insert: {
          actual_expense?: number | null
          allow_guests?: boolean
          attachment_urls?: string[] | null
          banner_image_url?: string | null
          category: Database["public"]["Enums"]["event_category"]
          chapter_id?: string | null
          co_organizers?: string[] | null
          created_at?: string
          current_registrations?: number
          custom_fields?: Json | null
          description?: string | null
          end_date: string
          estimated_budget?: number | null
          guest_limit?: number | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          is_virtual?: boolean
          max_capacity?: number | null
          organizer_id?: string | null
          registration_end_date?: string | null
          registration_start_date?: string | null
          requires_approval?: boolean
          send_reminders?: boolean
          start_date: string
          status?: Database["public"]["Enums"]["event_status"]
          tags?: string[] | null
          template_id?: string | null
          title: string
          updated_at?: string
          venue_address?: string | null
          venue_id?: string | null
          virtual_meeting_link?: string | null
          waitlist_enabled?: boolean
        }
        Update: {
          actual_expense?: number | null
          allow_guests?: boolean
          attachment_urls?: string[] | null
          banner_image_url?: string | null
          category?: Database["public"]["Enums"]["event_category"]
          chapter_id?: string | null
          co_organizers?: string[] | null
          created_at?: string
          current_registrations?: number
          custom_fields?: Json | null
          description?: string | null
          end_date?: string
          estimated_budget?: number | null
          guest_limit?: number | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          is_virtual?: boolean
          max_capacity?: number | null
          organizer_id?: string | null
          registration_end_date?: string | null
          registration_start_date?: string | null
          requires_approval?: boolean
          send_reminders?: boolean
          start_date?: string
          status?: Database["public"]["Enums"]["event_status"]
          tags?: string[] | null
          template_id?: string | null
          title?: string
          updated_at?: string
          venue_address?: string | null
          venue_id?: string | null
          virtual_meeting_link?: string | null
          waitlist_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "events_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "event_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_rsvps: {
        Row: {
          checked_in_at: string | null
          checked_in_by: string | null
          company: string | null
          created_at: string
          designation: string | null
          dietary_restrictions: string | null
          email: string
          event_id: string
          full_name: string
          id: string
          invited_by_member_id: string | null
          notes: string | null
          phone: string | null
          special_requirements: string | null
          status: Database["public"]["Enums"]["rsvp_status"]
          updated_at: string
        }
        Insert: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          company?: string | null
          created_at?: string
          designation?: string | null
          dietary_restrictions?: string | null
          email: string
          event_id: string
          full_name: string
          id?: string
          invited_by_member_id?: string | null
          notes?: string | null
          phone?: string | null
          special_requirements?: string | null
          status?: Database["public"]["Enums"]["rsvp_status"]
          updated_at?: string
        }
        Update: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          company?: string | null
          created_at?: string
          designation?: string | null
          dietary_restrictions?: string | null
          email?: string
          event_id?: string
          full_name?: string
          id?: string
          invited_by_member_id?: string | null
          notes?: string | null
          phone?: string | null
          special_requirements?: string | null
          status?: Database["public"]["Enums"]["rsvp_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_rsvps_invited_by_member_id_fkey"
            columns: ["invited_by_member_id"]
            isOneToOne: false
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
      member_networks: {
        Row: {
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string | null
          id: string
          member_id: string
          network_type: string
          notes: string | null
          organization_name: string
          relationship_strength: string | null
          updated_at: string | null
          verified: boolean | null
        }
        Insert: {
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          member_id: string
          network_type: string
          notes?: string | null
          organization_name: string
          relationship_strength?: string | null
          updated_at?: string | null
          verified?: boolean | null
        }
        Update: {
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          member_id?: string
          network_type?: string
          notes?: string | null
          organization_name?: string
          relationship_strength?: string | null
          updated_at?: string | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "member_networks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_requests: {
        Row: {
          address: string | null
          city: string
          company: string | null
          country: string | null
          created_at: string | null
          created_member_id: string | null
          date_of_birth: string | null
          designation: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          full_name: string
          gender: string | null
          how_did_you_hear: string | null
          id: string
          industry: string | null
          linkedin_url: string | null
          motivation: string
          phone: string
          pincode: string | null
          preferred_chapter_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          state: string
          status: string
          updated_at: string | null
          years_of_experience: number | null
        }
        Insert: {
          address?: string | null
          city: string
          company?: string | null
          country?: string | null
          created_at?: string | null
          created_member_id?: string | null
          date_of_birth?: string | null
          designation?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          full_name: string
          gender?: string | null
          how_did_you_hear?: string | null
          id?: string
          industry?: string | null
          linkedin_url?: string | null
          motivation: string
          phone: string
          pincode?: string | null
          preferred_chapter_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state: string
          status?: string
          updated_at?: string | null
          years_of_experience?: number | null
        }
        Update: {
          address?: string | null
          city?: string
          company?: string | null
          country?: string | null
          created_at?: string | null
          created_member_id?: string | null
          date_of_birth?: string | null
          designation?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          full_name?: string
          gender?: string | null
          how_did_you_hear?: string | null
          id?: string
          industry?: string | null
          linkedin_url?: string | null
          motivation?: string
          phone?: string
          pincode?: string | null
          preferred_chapter_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string
          status?: string
          updated_at?: string | null
          years_of_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "member_requests_created_member_id_fkey"
            columns: ["created_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_requests_preferred_chapter_id_fkey"
            columns: ["preferred_chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
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
          avatar_url: string | null
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
          family_count: number | null
          gender: string | null
          id: string
          industry: string | null
          interests: string[] | null
          is_active: boolean
          languages: string[] | null
          linkedin_url: string | null
          member_since: string
          membership_number: string | null
          membership_status: string
          membership_type: string | null
          notes: string | null
          pincode: string | null
          preferred_event_types: string[] | null
          renewal_date: string | null
          state: string | null
          updated_at: string
          vertical_interests: string[] | null
          willingness_level: number | null
          years_of_experience: number | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
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
          family_count?: number | null
          gender?: string | null
          id: string
          industry?: string | null
          interests?: string[] | null
          is_active?: boolean
          languages?: string[] | null
          linkedin_url?: string | null
          member_since?: string
          membership_number?: string | null
          membership_status?: string
          membership_type?: string | null
          notes?: string | null
          pincode?: string | null
          preferred_event_types?: string[] | null
          renewal_date?: string | null
          state?: string | null
          updated_at?: string
          vertical_interests?: string[] | null
          willingness_level?: number | null
          years_of_experience?: number | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
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
          family_count?: number | null
          gender?: string | null
          id?: string
          industry?: string | null
          interests?: string[] | null
          is_active?: boolean
          languages?: string[] | null
          linkedin_url?: string | null
          member_since?: string
          membership_number?: string | null
          membership_status?: string
          membership_type?: string | null
          notes?: string | null
          pincode?: string | null
          preferred_event_types?: string[] | null
          renewal_date?: string | null
          state?: string | null
          updated_at?: string
          vertical_interests?: string[] | null
          willingness_level?: number | null
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
          approved_at: string | null
          approved_by: string | null
          approved_email_id: string | null
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
          approved_at?: string | null
          approved_by?: string | null
          approved_email_id?: string | null
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
          approved_at?: string | null
          approved_by?: string | null
          approved_email_id?: string | null
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
            foreignKeyName: "profiles_approved_email_id_fkey"
            columns: ["approved_email_id"]
            isOneToOne: false
            referencedRelation: "approved_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_bookings: {
        Row: {
          created_at: string
          event_id: string
          id: string
          notes: string | null
          quantity: number
          resource_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          notes?: string | null
          quantity?: number
          resource_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          notes?: string | null
          quantity?: number
          resource_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_bookings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_bookings_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          quantity_available: number
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          quantity_available?: number
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          quantity_available?: number
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: []
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
      user_role_changes: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string
          id: string
          notes: string | null
          role_id: string
          user_id: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          role_id: string
          user_id: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_role_changes_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_changes_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_changes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      venue_bookings: {
        Row: {
          booking_reference: string | null
          created_at: string
          end_time: string
          event_id: string
          id: string
          notes: string | null
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
          venue_id: string
        }
        Insert: {
          booking_reference?: string | null
          created_at?: string
          end_time: string
          event_id: string
          id?: string
          notes?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          venue_id: string
        }
        Update: {
          booking_reference?: string | null
          created_at?: string
          end_time?: string
          event_id?: string
          id?: string
          notes?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_bookings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_bookings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string
          amenities: string[] | null
          booking_link: string | null
          capacity: number | null
          city: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          pincode: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address: string
          amenities?: string[] | null
          booking_link?: string | null
          capacity?: number | null
          city?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          pincode?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          amenities?: string[] | null
          booking_link?: string | null
          capacity?: number | null
          city?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          pincode?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      volunteer_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          required_skills: string[] | null
          responsibilities: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          required_skills?: string[] | null
          responsibilities?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          required_skills?: string[] | null
          responsibilities?: string[] | null
          updated_at?: string
        }
        Relationships: []
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
      calculate_event_impact: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      calculate_leadership_readiness: {
        Args: { p_member_id: string }
        Returns: number
      }
      can_manage_role: {
        Args: { manager_id: string; target_role_id: string }
        Returns: boolean
      }
      check_venue_availability: {
        Args: {
          p_end_time: string
          p_exclude_booking_id?: string
          p_start_time: string
          p_venue_id: string
        }
        Returns: boolean
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
      get_user_hierarchy_level: { Args: { user_id: string }; Returns: number }
      get_user_roles: {
        Args: { p_user_id: string }
        Returns: {
          hierarchy_level: number
          role_name: string
        }[]
      }
      is_same_chapter: { Args: { member_id: string }; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      availability_status: "available" | "busy" | "unavailable"
      booking_status: "pending" | "confirmed" | "cancelled"
      event_category:
        | "networking"
        | "social"
        | "professional_development"
        | "community_service"
        | "sports"
        | "cultural"
        | "fundraising"
        | "workshop"
        | "seminar"
        | "conference"
        | "webinar"
        | "other"
      event_status:
        | "draft"
        | "published"
        | "ongoing"
        | "completed"
        | "cancelled"
      proficiency_level: "beginner" | "intermediate" | "advanced" | "expert"
      rsvp_status:
        | "pending"
        | "confirmed"
        | "declined"
        | "waitlist"
        | "attended"
        | "no_show"
      skill_category:
        | "technical"
        | "business"
        | "creative"
        | "leadership"
        | "communication"
        | "other"
      volunteer_status: "invited" | "accepted" | "declined" | "completed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      availability_status: ["available", "busy", "unavailable"],
      booking_status: ["pending", "confirmed", "cancelled"],
      event_category: [
        "networking",
        "social",
        "professional_development",
        "community_service",
        "sports",
        "cultural",
        "fundraising",
        "workshop",
        "seminar",
        "conference",
        "webinar",
        "other",
      ],
      event_status: ["draft", "published", "ongoing", "completed", "cancelled"],
      proficiency_level: ["beginner", "intermediate", "advanced", "expert"],
      rsvp_status: [
        "pending",
        "confirmed",
        "declined",
        "waitlist",
        "attended",
        "no_show",
      ],
      skill_category: [
        "technical",
        "business",
        "creative",
        "leadership",
        "communication",
        "other",
      ],
      volunteer_status: ["invited", "accepted", "declined", "completed"],
    },
  },
} as const
