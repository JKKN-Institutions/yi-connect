/**
 * Database Types - Auto-generated from Supabase Schema
 * DO NOT EDIT MANUALLY - Use supabase gen types typescript
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
      events: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          chapter_id: string
          title: string
          description: string | null
          category: 'general' | 'industrial_visit' | 'conference' | 'workshop' | 'social'
          start_date: string
          end_date: string | null
          location: string | null
          venue_id: string | null
          venue_address: string | null
          is_virtual: boolean
          meeting_url: string | null
          virtual_meeting_link: string | null
          max_capacity: number | null
          current_registrations: number
          registration_deadline: string | null
          is_member_only: boolean
          visibility: 'public' | 'members_only' | 'chapter_only'
          status: 'draft' | 'published' | 'cancelled' | 'completed'
          is_featured: boolean
          banner_image_url: string | null
          created_by: string
          organizer_id: string
          estimated_budget: number | null
          impact_metrics: Record<string, any> | null
          // Industrial Visit specific fields
          industry_id: string | null
          requirements: string | null
          learning_outcomes: string | null
          contact_person_name: string | null
          contact_person_email: string | null
          contact_person_phone: string | null
          industry_sector: string | null
          logistics_parking: string | null
          logistics_directions: string | null
          logistics_dress_code: string | null
          entry_method: 'manual' | 'self_service'
          host_willingness_rating: number | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          chapter_id: string
          title: string
          description?: string | null
          category?: 'general' | 'industrial_visit' | 'conference' | 'workshop' | 'social'
          start_date: string
          end_date?: string | null
          location?: string | null
          venue_id?: string | null
          venue_address?: string | null
          is_virtual?: boolean
          meeting_url?: string | null
          virtual_meeting_link?: string | null
          max_capacity?: number | null
          current_registrations?: number
          registration_deadline?: string | null
          is_member_only?: boolean
          visibility?: 'public' | 'members_only' | 'chapter_only'
          status?: 'draft' | 'published' | 'cancelled' | 'completed'
          is_featured?: boolean
          banner_image_url?: string | null
          created_by: string
          organizer_id: string
          estimated_budget?: number | null
          impact_metrics?: Record<string, any> | null
          industry_id?: string | null
          requirements?: string | null
          learning_outcomes?: string | null
          contact_person_name?: string | null
          contact_person_email?: string | null
          contact_person_phone?: string | null
          industry_sector?: string | null
          logistics_parking?: string | null
          logistics_directions?: string | null
          logistics_dress_code?: string | null
          entry_method?: 'manual' | 'self_service'
          host_willingness_rating?: number | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          chapter_id?: string
          title?: string
          description?: string | null
          category?: 'general' | 'industrial_visit' | 'conference' | 'workshop' | 'social'
          start_date?: string
          end_date?: string | null
          location?: string | null
          venue_id?: string | null
          venue_address?: string | null
          is_virtual?: boolean
          meeting_url?: string | null
          virtual_meeting_link?: string | null
          max_capacity?: number | null
          current_registrations?: number
          registration_deadline?: string | null
          is_member_only?: boolean
          visibility?: 'public' | 'members_only' | 'chapter_only'
          status?: 'draft' | 'published' | 'cancelled' | 'completed'
          is_featured?: boolean
          banner_image_url?: string | null
          created_by?: string
          organizer_id?: string
          estimated_budget?: number | null
          impact_metrics?: Record<string, any> | null
          industry_id?: string | null
          requirements?: string | null
          learning_outcomes?: string | null
          contact_person_name?: string | null
          contact_person_email?: string | null
          contact_person_phone?: string | null
          industry_sector?: string | null
          logistics_parking?: string | null
          logistics_directions?: string | null
          logistics_dress_code?: string | null
          entry_method?: 'manual' | 'self_service'
          host_willingness_rating?: number | null
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
            foreignKeyName: "events_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "industries"
            referencedColumns: ["id"]
          }
        ]
      }
      event_rsvps: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          event_id: string
          member_id: string
          status: 'pending' | 'confirmed' | 'cancelled' | 'waitlisted' | 'attended' | 'no_show'
          response_note: string | null
          checked_in_at: string | null
          guests_count: number
          // IV specific fields
          family_count: number
          family_names: string[] | null
          carpool_status: 'not_needed' | 'need_ride' | 'offering_ride'
          seats_available: number | null
          pickup_location: string | null
          dietary_restrictions: string | null
          special_requirements: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          event_id: string
          member_id: string
          status?: 'pending' | 'confirmed' | 'cancelled' | 'waitlisted' | 'attended' | 'no_show'
          response_note?: string | null
          checked_in_at?: string | null
          guests_count?: number
          family_count?: number
          family_names?: string[] | null
          carpool_status?: 'not_needed' | 'need_ride' | 'offering_ride'
          seats_available?: number | null
          pickup_location?: string | null
          dietary_restrictions?: string | null
          special_requirements?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          event_id?: string
          member_id?: string
          status?: 'pending' | 'confirmed' | 'cancelled' | 'waitlisted' | 'attended' | 'no_show'
          response_note?: string | null
          checked_in_at?: string | null
          guests_count?: number
          family_count?: number
          family_names?: string[] | null
          carpool_status?: 'not_needed' | 'need_ride' | 'offering_ride'
          seats_available?: number | null
          pickup_location?: string | null
          dietary_restrictions?: string | null
          special_requirements?: string | null
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
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      industry_portal_users: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          industry_id: string
          user_id: string
          full_name: string
          email: string
          phone: string | null
          role: string | null
          status: 'invited' | 'active' | 'inactive' | 'suspended'
          invited_by: string | null
          invited_at: string | null
          last_login_at: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          industry_id: string
          user_id: string
          full_name: string
          email: string
          phone?: string | null
          role?: string | null
          status?: 'invited' | 'active' | 'inactive' | 'suspended'
          invited_by?: string | null
          invited_at?: string | null
          last_login_at?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          industry_id?: string
          user_id?: string
          full_name?: string
          email?: string
          phone?: string | null
          role?: string | null
          status?: 'invited' | 'active' | 'inactive' | 'suspended'
          invited_by?: string | null
          invited_at?: string | null
          last_login_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "industry_portal_users_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "industries"
            referencedColumns: ["id"]
          }
        ]
      }
      iv_waitlist: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          event_id: string
          member_id: string
          position: number
          status: 'waiting' | 'promoted' | 'expired' | 'withdrawn'
          notified_at: string | null
          promoted_at: string | null
          expires_at: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          event_id: string
          member_id: string
          position?: number
          status?: 'waiting' | 'promoted' | 'expired' | 'withdrawn'
          notified_at?: string | null
          promoted_at?: string | null
          expires_at?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          event_id?: string
          member_id?: string
          position?: number
          status?: 'waiting' | 'promoted' | 'expired' | 'withdrawn'
          notified_at?: string | null
          promoted_at?: string | null
          expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iv_waitlist_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iv_waitlist_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      industries: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          name: string
          industry_type: string | null
          description: string | null
          website: string | null
          logo_url: string | null
          address_line1: string | null
          address_line2: string | null
          city: string | null
          state: string | null
          postal_code: string | null
          country: string
          contact_person_name: string | null
          contact_person_email: string | null
          contact_person_phone: string | null
          relationship_status: string | null
          partnership_level: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          name: string
          industry_type?: string | null
          description?: string | null
          website?: string | null
          logo_url?: string | null
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          state?: string | null
          postal_code?: string | null
          country?: string
          contact_person_name?: string | null
          contact_person_email?: string | null
          contact_person_phone?: string | null
          relationship_status?: string | null
          partnership_level?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          name?: string
          industry_type?: string | null
          description?: string | null
          website?: string | null
          logo_url?: string | null
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          state?: string | null
          postal_code?: string | null
          country?: string
          contact_person_name?: string | null
          contact_person_email?: string | null
          contact_person_phone?: string | null
          relationship_status?: string | null
          partnership_level?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      chapters: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          name: string
          city: string | null
          state: string | null
          country: string
          established_date: string | null
          status: string
          description: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          name: string
          city?: string | null
          state?: string | null
          country?: string
          established_date?: string | null
          status?: string
          description?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          name?: string
          city?: string | null
          state?: string | null
          country?: string
          established_date?: string | null
          status?: string
          description?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          email: string
          full_name: string | null
          avatar_url: string | null
          phone: string | null
        }
        Insert: {
          id: string
          created_at?: string
          updated_at?: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          phone?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      members: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          profile_id: string
          chapter_id: string
          membership_number: string | null
          join_date: string | null
          status: string
          role: string | null
          bio: string | null
          designation: string | null
          company: string | null
          membership_status: string | null
          linkedin_url: string | null
          twitter_url: string | null
          facebook_url: string | null
          instagram_url: string | null
          address: string | null
          city: string | null
          state: string | null
          pincode: string | null
          country: string | null
          industry: string | null
          expertise: string[] | null
          interests: string[] | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          profile_id: string
          chapter_id: string
          membership_number?: string | null
          join_date?: string | null
          status?: string
          role?: string | null
          bio?: string | null
          designation?: string | null
          company?: string | null
          membership_status?: string | null
          linkedin_url?: string | null
          twitter_url?: string | null
          facebook_url?: string | null
          instagram_url?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          pincode?: string | null
          country?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          profile_id?: string
          chapter_id?: string
          membership_number?: string | null
          join_date?: string | null
          status?: string
          role?: string | null
          bio?: string | null
          designation?: string | null
          company?: string | null
          membership_status?: string | null
          linkedin_url?: string | null
          twitter_url?: string | null
          facebook_url?: string | null
          instagram_url?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          pincode?: string | null
          country?: string | null
          industry?: string | null
          expertise?: string[] | null
          interests?: string[] | null
        }
        Relationships: []
      }
      skills: {
        Row: {
          id: string
          name: string
          category: string
          description: string | null
        }
        Insert: {
          id?: string
          name: string
          category: string
          description?: string | null
        }
        Update: {
          id?: string
          name?: string
          category?: string
          description?: string | null
        }
        Relationships: []
      }
      member_skills: {
        Row: {
          id: string
          member_id: string
          skill_id: string
          proficiency_level: string
        }
        Insert: {
          id?: string
          member_id: string
          skill_id: string
          proficiency_level: string
        }
        Update: {
          id?: string
          member_id?: string
          skill_id?: string
          proficiency_level?: string
        }
        Relationships: []
      }
      certifications: {
        Row: {
          id: string
          name: string
          issuing_organization: string | null
        }
        Insert: {
          id?: string
          name: string
          issuing_organization?: string | null
        }
        Update: {
          id?: string
          name?: string
          issuing_organization?: string | null
        }
        Relationships: []
      }
      member_certifications: {
        Row: {
          id: string
          member_id: string
          certification_id: string
          issue_date: string | null
          expiry_date: string | null
        }
        Insert: {
          id?: string
          member_id: string
          certification_id: string
          issue_date?: string | null
          expiry_date?: string | null
        }
        Update: {
          id?: string
          member_id?: string
          certification_id?: string
          issue_date?: string | null
          expiry_date?: string | null
        }
        Relationships: []
      }
      availability: {
        Row: {
          id: string
          member_id: string
          status: string
          available_hours_per_week: number | null
        }
        Insert: {
          id?: string
          member_id: string
          status: string
          available_hours_per_week?: number | null
        }
        Update: {
          id?: string
          member_id?: string
          status?: string
          available_hours_per_week?: number | null
        }
        Relationships: []
      }
      engagement_metrics: {
        Row: {
          id: string
          member_id: string
          total_events_attended: number
          total_hours_volunteered: number
        }
        Insert: {
          id?: string
          member_id: string
          total_events_attended?: number
          total_hours_volunteered?: number
        }
        Update: {
          id?: string
          member_id?: string
          total_events_attended?: number
          total_hours_volunteered?: number
        }
        Relationships: []
      }
      leadership_assessments: {
        Row: {
          id: string
          member_id: string
          assessment_date: string
          score: number
        }
        Insert: {
          id?: string
          member_id: string
          assessment_date: string
          score: number
        }
        Update: {
          id?: string
          member_id?: string
          assessment_date?: string
          score?: number
        }
        Relationships: []
      }
      roles: {
        Row: {
          id: string
          name: string
          description: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role_id: string
        }
        Insert: {
          id?: string
          user_id: string
          role_id: string
        }
        Update: {
          id?: string
          user_id?: string
          role_id?: string
        }
        Relationships: []
      }
      financial_audit_logs: {
        Row: {
          id: string
          created_at: string
          action: string
          details: Json
        }
        Insert: {
          id?: string
          created_at?: string
          action: string
          details: Json
        }
        Update: {
          id?: string
          created_at?: string
          action?: string
          details?: Json
        }
        Relationships: []
      }
      event_volunteers: {
        Row: {
          id: string
          event_id: string
          member_id: string
          role_name: string | null
          hours_contributed: number | null
          status: string
        }
        Insert: {
          id?: string
          event_id: string
          member_id: string
          role_name?: string | null
          hours_contributed?: number | null
          status?: string
        }
        Update: {
          id?: string
          event_id?: string
          member_id?: string
          role_name?: string | null
          hours_contributed?: number | null
          status?: string
        }
        Relationships: []
      }
      venues: {
        Row: {
          id: string
          name: string
          address: string | null
          city: string | null
          capacity: number | null
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          city?: string | null
          capacity?: number | null
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          city?: string | null
          capacity?: number | null
        }
        Relationships: []
      }
      event_feedback: {
        Row: {
          id: string
          created_at: string
          event_id: string
          member_id: string | null
          overall_rating: number | null
          content_rating: number | null
          venue_rating: number | null
          organization_rating: number | null
          what_went_well: string | null
          what_could_improve: string | null
          suggestions: string | null
          would_attend_again: boolean | null
          is_anonymous: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          event_id: string
          member_id?: string | null
          overall_rating?: number | null
          content_rating?: number | null
          venue_rating?: number | null
          organization_rating?: number | null
          what_went_well?: string | null
          what_could_improve?: string | null
          suggestions?: string | null
          would_attend_again?: boolean | null
          is_anonymous?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          event_id?: string
          member_id?: string | null
          overall_rating?: number | null
          content_rating?: number | null
          venue_rating?: number | null
          organization_rating?: number | null
          what_went_well?: string | null
          what_could_improve?: string | null
          suggestions?: string | null
          would_attend_again?: boolean | null
          is_anonymous?: boolean
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
          }
        ]
      }
      event_documents: {
        Row: {
          id: string
          created_at: string
          event_id: string
          title: string
          description: string | null
          document_type: 'photo' | 'report' | 'certificate' | 'invoice' | 'other'
          file_url: string
          file_size_kb: number | null
          is_public: boolean
          uploaded_by: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          event_id: string
          title: string
          description?: string | null
          document_type: 'photo' | 'report' | 'certificate' | 'invoice' | 'other'
          file_url: string
          file_size_kb?: number | null
          is_public?: boolean
          uploaded_by?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          event_id?: string
          title?: string
          description?: string | null
          document_type?: 'photo' | 'report' | 'certificate' | 'invoice' | 'other'
          file_url?: string
          file_size_kb?: number | null
          is_public?: boolean
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
          {
            foreignKeyName: "event_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          }
        ]
      }
      budgets: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          chapter_id: string
          name: string
          description: string | null
          fiscal_year: number
          period: 'quarterly' | 'annual' | 'custom'
          quarter: number | null
          total_amount: number
          spent_amount: number
          allocated_amount: number
          start_date: string
          end_date: string
          status: 'draft' | 'approved' | 'active' | 'closed'
          approved_at: string | null
          approved_by: string | null
          created_by: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          chapter_id: string
          name: string
          description?: string | null
          fiscal_year: number
          period: 'quarterly' | 'annual' | 'custom'
          quarter?: number | null
          total_amount: number
          spent_amount?: number
          allocated_amount?: number
          start_date: string
          end_date: string
          status?: 'draft' | 'approved' | 'active' | 'closed'
          approved_at?: string | null
          approved_by?: string | null
          created_by: string
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          chapter_id?: string
          name?: string
          description?: string | null
          fiscal_year?: number
          period?: 'quarterly' | 'annual' | 'custom'
          quarter?: number | null
          total_amount?: number
          spent_amount?: number
          allocated_amount?: number
          start_date?: string
          end_date?: string
          status?: 'draft' | 'approved' | 'active' | 'closed'
          approved_at?: string | null
          approved_by?: string | null
          created_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          }
        ]
      }
      expenses: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          chapter_id: string
          title: string
          description: string | null
          amount: number
          expense_date: string
          category_id: string
          event_id: string | null
          budget_id: string | null
          vendor_name: string | null
          vendor_contact: string | null
          invoice_number: string | null
          tax_amount: number | null
          other_charges: number | null
          notes: string | null
          status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid'
          payment_status: 'pending' | 'processing' | 'paid' | 'failed' | 'refunded'
          payment_method: 'bank_transfer' | 'cash' | 'cheque' | 'upi' | 'credit_card' | 'online' | null
          payment_reference: string | null
          paid_at: string | null
          approved_at: string | null
          approved_by: string | null
          rejection_reason: string | null
          created_by: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          chapter_id: string
          title: string
          description?: string | null
          amount: number
          expense_date: string
          category_id: string
          event_id?: string | null
          budget_id?: string | null
          vendor_name?: string | null
          vendor_contact?: string | null
          invoice_number?: string | null
          tax_amount?: number | null
          other_charges?: number | null
          notes?: string | null
          status?: 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid'
          payment_status?: 'pending' | 'processing' | 'paid' | 'failed' | 'refunded'
          payment_method?: 'bank_transfer' | 'cash' | 'cheque' | 'upi' | 'credit_card' | 'online' | null
          payment_reference?: string | null
          paid_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          rejection_reason?: string | null
          created_by: string
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          chapter_id?: string
          title?: string
          description?: string | null
          amount?: number
          expense_date?: string
          category_id?: string
          event_id?: string | null
          budget_id?: string | null
          vendor_name?: string | null
          vendor_contact?: string | null
          invoice_number?: string | null
          tax_amount?: number | null
          other_charges?: number | null
          notes?: string | null
          status?: 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid'
          payment_status?: 'pending' | 'processing' | 'paid' | 'failed' | 'refunded'
          payment_method?: 'bank_transfer' | 'cash' | 'cheque' | 'upi' | 'credit_card' | 'online' | null
          payment_reference?: string | null
          paid_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          rejection_reason?: string | null
          created_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          }
        ]
      }
      reimbursement_requests: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          chapter_id: string
          title: string
          description: string
          amount: number
          expense_date: string
          expense_id: string | null
          event_id: string | null
          payment_method_preference: 'bank_transfer' | 'cash' | 'cheque' | 'upi' | 'credit_card' | 'online' | null
          bank_account_number: string | null
          bank_name: string | null
          ifsc_code: string | null
          upi_id: string | null
          notes: string | null
          status: 'draft' | 'submitted' | 'pending_approval' | 'approved' | 'rejected' | 'paid'
          submitted_at: string | null
          payment_method: 'bank_transfer' | 'cash' | 'cheque' | 'upi' | 'credit_card' | 'online' | null
          payment_date: string | null
          payment_reference: string | null
          created_by: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          chapter_id: string
          title: string
          description: string
          amount: number
          expense_date: string
          expense_id?: string | null
          event_id?: string | null
          payment_method_preference?: 'bank_transfer' | 'cash' | 'cheque' | 'upi' | 'credit_card' | 'online' | null
          bank_account_number?: string | null
          bank_name?: string | null
          ifsc_code?: string | null
          upi_id?: string | null
          notes?: string | null
          status?: 'draft' | 'submitted' | 'pending_approval' | 'approved' | 'rejected' | 'paid'
          submitted_at?: string | null
          payment_method?: 'bank_transfer' | 'cash' | 'cheque' | 'upi' | 'credit_card' | 'online' | null
          payment_date?: string | null
          payment_reference?: string | null
          created_by: string
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          chapter_id?: string
          title?: string
          description?: string
          amount?: number
          expense_date?: string
          expense_id?: string | null
          event_id?: string | null
          payment_method_preference?: 'bank_transfer' | 'cash' | 'cheque' | 'upi' | 'credit_card' | 'online' | null
          bank_account_number?: string | null
          bank_name?: string | null
          ifsc_code?: string | null
          upi_id?: string | null
          notes?: string | null
          status?: 'draft' | 'submitted' | 'pending_approval' | 'approved' | 'rejected' | 'paid'
          submitted_at?: string | null
          payment_method?: 'bank_transfer' | 'cash' | 'cheque' | 'upi' | 'credit_card' | 'online' | null
          payment_date?: string | null
          payment_reference?: string | null
          created_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "reimbursement_requests_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursement_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursement_requests_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursement_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          }
        ]
      }
      sponsorship_deals: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          chapter_id: string
          deal_name: string
          sponsor_id: string
          tier_id: string | null
          proposed_amount: number
          committed_amount: number | null
          received_amount: number | null
          deal_stage: 'prospect' | 'contacted' | 'proposal_sent' | 'negotiation' | 'committed' | 'contract_signed' | 'payment_received' | 'lost'
          proposal_date: string | null
          expected_closure_date: string | null
          commitment_date: string | null
          contract_signed_date: string | null
          event_id: string | null
          fiscal_year: number | null
          probability_percentage: number | null
          weighted_value: number | null
          point_of_contact: string | null
          assigned_to: string | null
          contract_number: string | null
          contract_terms: string | null
          deliverables: string[] | null
          notes: string | null
          rejection_reason: string | null
          created_by: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          chapter_id: string
          deal_name: string
          sponsor_id: string
          tier_id?: string | null
          proposed_amount: number
          committed_amount?: number | null
          received_amount?: number | null
          deal_stage?: 'prospect' | 'contacted' | 'proposal_sent' | 'negotiation' | 'committed' | 'contract_signed' | 'payment_received' | 'lost'
          proposal_date?: string | null
          expected_closure_date?: string | null
          commitment_date?: string | null
          contract_signed_date?: string | null
          event_id?: string | null
          fiscal_year?: number | null
          probability_percentage?: number | null
          weighted_value?: number | null
          point_of_contact?: string | null
          assigned_to?: string | null
          contract_number?: string | null
          contract_terms?: string | null
          deliverables?: string[] | null
          notes?: string | null
          rejection_reason?: string | null
          created_by: string
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          chapter_id?: string
          deal_name?: string
          sponsor_id?: string
          tier_id?: string | null
          proposed_amount?: number
          committed_amount?: number | null
          received_amount?: number | null
          deal_stage?: 'prospect' | 'contacted' | 'proposal_sent' | 'negotiation' | 'committed' | 'contract_signed' | 'payment_received' | 'lost'
          proposal_date?: string | null
          expected_closure_date?: string | null
          commitment_date?: string | null
          contract_signed_date?: string | null
          event_id?: string | null
          fiscal_year?: number | null
          probability_percentage?: number | null
          weighted_value?: number | null
          point_of_contact?: string | null
          assigned_to?: string | null
          contract_number?: string | null
          contract_terms?: string | null
          deliverables?: string[] | null
          notes?: string | null
          rejection_reason?: string | null
          created_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsorship_deals_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsorship_deals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          }
        ]
      }
      sponsors: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          chapter_id: string
          organization_name: string
          industry: string | null
          website: string | null
          contact_person_name: string | null
          contact_person_designation: string | null
          contact_email: string | null
          contact_phone: string | null
          address_line1: string | null
          address_line2: string | null
          city: string | null
          state: string | null
          pincode: string | null
          country: string | null
          relationship_status: string | null
          last_contact_date: string | null
          next_followup_date: string | null
          tags: string[] | null
          priority: string | null
          notes: string | null
          is_active: boolean
          created_by: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          chapter_id: string
          organization_name: string
          industry?: string | null
          website?: string | null
          contact_person_name?: string | null
          contact_person_designation?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          state?: string | null
          pincode?: string | null
          country?: string | null
          relationship_status?: string | null
          last_contact_date?: string | null
          next_followup_date?: string | null
          tags?: string[] | null
          priority?: string | null
          notes?: string | null
          is_active?: boolean
          created_by: string
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          chapter_id?: string
          organization_name?: string
          industry?: string | null
          website?: string | null
          contact_person_name?: string | null
          contact_person_designation?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          state?: string | null
          pincode?: string | null
          country?: string | null
          relationship_status?: string | null
          last_contact_date?: string | null
          next_followup_date?: string | null
          tags?: string[] | null
          priority?: string | null
          notes?: string | null
          is_active?: boolean
          created_by?: string
        }
        Relationships: []
      }
      sponsorship_tiers: {
        Row: {
          id: string
          created_at: string
          chapter_id: string
          name: string
          tier_name: string
          tier_level: 'platinum' | 'gold' | 'silver' | 'bronze' | 'supporter'
          min_amount: number
          max_amount: number | null
          benefits: string[] | null
          description: string | null
          is_active: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          chapter_id: string
          name: string
          tier_name?: string
          tier_level: 'platinum' | 'gold' | 'silver' | 'bronze' | 'supporter'
          min_amount: number
          max_amount?: number | null
          benefits?: string[] | null
          description?: string | null
          is_active?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          chapter_id?: string
          name?: string
          tier_name?: string
          tier_level?: 'platinum' | 'gold' | 'silver' | 'bronze' | 'supporter'
          min_amount?: number
          max_amount?: number | null
          benefits?: string[] | null
          description?: string | null
          is_active?: boolean
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          id: string
          created_at: string
          chapter_id: string
          name: string
          category_name: string
          description: string | null
          budget_allocation_percentage: number | null
          is_active: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          chapter_id: string
          name: string
          category_name?: string
          description?: string | null
          budget_allocation_percentage?: number | null
          is_active?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          chapter_id?: string
          name?: string
          category_name?: string
          description?: string | null
          budget_allocation_percentage?: number | null
          is_active?: boolean
        }
        Relationships: []
      }
      budget_allocations: {
        Row: {
          id: string
          created_at: string
          budget_id: string
          vertical_name: string
          category_name: string | null
          allocated_amount: number
          spent_amount: number
          description: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          budget_id: string
          vertical_name: string
          category_name?: string | null
          allocated_amount: number
          spent_amount?: number
          description?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          budget_id?: string
          vertical_name?: string
          category_name?: string | null
          allocated_amount?: number
          spent_amount?: number
          description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_allocations_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_iv_capacity: {
        Args: {
          event_id: string
        }
        Returns: {
          has_capacity: boolean
          current_count: number
          max_capacity: number | null
          available_spots: number | null
        }[]
      }
      add_to_waitlist: {
        Args: {
          p_event_id: string
          p_member_id: string
        }
        Returns: {
          waitlist_id: string
          position: number
        }[]
      }
      promote_from_waitlist: {
        Args: {
          p_event_id: string
        }
        Returns: {
          promoted_member_id: string
          new_rsvp_id: string
        }[]
      }
      calculate_carpool_matches: {
        Args: {
          p_event_id: string
        }
        Returns: {
          driver_id: string
          driver_name: string
          seats_available: number
          pickup_location: string | null
          rider_id: string
          rider_name: string
          match_score: number
        }[]
      }
      get_iv_analytics: {
        Args: {
          p_chapter_id: string
        }
        Returns: {
          total_ivs: number
          upcoming_ivs: number
          completed_ivs: number
          total_participants: number
          avg_attendance_rate: number
          total_carpool_seats_shared: number
          unique_industries_visited: number
        }[]
      }
    }
    Enums: {
      event_category: 'general' | 'industrial_visit' | 'conference' | 'workshop' | 'social'
      event_status: 'draft' | 'published' | 'cancelled' | 'completed'
      rsvp_status: 'pending' | 'confirmed' | 'cancelled' | 'waitlisted' | 'no_show'
      carpool_status: 'not_needed' | 'need_ride' | 'offering_ride'
      industry_portal_user_status: 'invited' | 'active' | 'inactive' | 'suspended'
      waitlist_status: 'waiting' | 'promoted' | 'expired' | 'withdrawn'
      proficiency_level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
      availability_status: 'available' | 'limited' | 'unavailable'
      skill_category: 'technical' | 'business' | 'creative' | 'leadership' | 'other'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

// Constants export for enum values (used in validation)
export const Constants = {
  public: {
    Enums: {
      event_category: ['general', 'industrial_visit', 'conference', 'workshop', 'social'] as const,
      event_status: ['draft', 'published', 'ongoing', 'completed', 'cancelled'] as const,
      rsvp_status: ['pending', 'confirmed', 'cancelled', 'waitlisted', 'attended', 'no_show'] as const,
      carpool_status: ['not_needed', 'need_ride', 'offering_ride'] as const,
      waitlist_status: ['waiting', 'promoted', 'expired', 'withdrawn'] as const,
      entry_method: ['manual', 'self_service'] as const,
      member_status: ['active', 'inactive', 'pending'] as const,
      member_role: ['member', 'board_member', 'chapter_leader', 'admin'] as const,
      industry_portal_user_status: ['invited', 'active', 'inactive', 'suspended'] as const,
    },
  },
} as const
