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
    PostgrestVersion: "14.4"
  }
  future: {
    Tables: {
      advancements: {
        Row: {
          advanced_at: string | null
          advanced_by: string | null
          from_event_id: string
          id: string
          rank: number | null
          team_id: string
          to_event_id: string
          total_score: number | null
        }
        Insert: {
          advanced_at?: string | null
          advanced_by?: string | null
          from_event_id: string
          id?: string
          rank?: number | null
          team_id: string
          to_event_id: string
          total_score?: number | null
        }
        Update: {
          advanced_at?: string | null
          advanced_by?: string | null
          from_event_id?: string
          id?: string
          rank?: number | null
          team_id?: string
          to_event_id?: string
          total_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "advancements_from_event_id_fkey"
            columns: ["from_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advancements_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advancements_to_event_id_fkey"
            columns: ["to_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      awards: {
        Row: {
          announced_at: string | null
          announced_by: string | null
          category: Database["future"]["Enums"]["award_category"]
          citation: string | null
          custom_label: string | null
          event_id: string
          id: string
          position: number | null
          team_id: string
        }
        Insert: {
          announced_at?: string | null
          announced_by?: string | null
          category: Database["future"]["Enums"]["award_category"]
          citation?: string | null
          custom_label?: string | null
          event_id: string
          id?: string
          position?: number | null
          team_id: string
        }
        Update: {
          announced_at?: string | null
          announced_by?: string | null
          category?: Database["future"]["Enums"]["award_category"]
          citation?: string | null
          custom_label?: string | null
          event_id?: string
          id?: string
          position?: number | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "awards_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "awards_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_core_team: {
        Row: {
          chapter_id: string
          created_at: string | null
          edition_id: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          role: Database["future"]["Enums"]["user_role"]
          user_id: string | null
        }
        Insert: {
          chapter_id: string
          created_at?: string | null
          edition_id: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          role: Database["future"]["Enums"]["user_role"]
          user_id?: string | null
        }
        Update: {
          chapter_id?: string
          created_at?: string | null
          edition_id?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          role?: Database["future"]["Enums"]["user_role"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chapter_core_team_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_final_sections: {
        Row: {
          ends_at: string | null
          event_id: string
          is_active: boolean | null
          notes: string | null
          section: Database["future"]["Enums"]["chapter_final_section"]
          starts_at: string | null
          title: string | null
        }
        Insert: {
          ends_at?: string | null
          event_id: string
          is_active?: boolean | null
          notes?: string | null
          section: Database["future"]["Enums"]["chapter_final_section"]
          starts_at?: string | null
          title?: string | null
        }
        Update: {
          ends_at?: string | null
          event_id?: string
          is_active?: boolean | null
          notes?: string | null
          section?: Database["future"]["Enums"]["chapter_final_section"]
          starts_at?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chapter_final_sections_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_track_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          chapter_id: string
          edition_id: string
          role: Database["future"]["Enums"]["track_host_role"]
          track_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          chapter_id: string
          edition_id: string
          role?: Database["future"]["Enums"]["track_host_role"]
          track_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          chapter_id?: string
          edition_id?: string
          role?: Database["future"]["Enums"]["track_host_role"]
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_track_assignments_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_track_assignments_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      colleges: {
        Row: {
          chapter_id: string | null
          city: string | null
          created_at: string | null
          id: string
          is_approved: boolean
          is_yuva: boolean | null
          merged_into: string | null
          name: string
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          state: string | null
          website_url: string | null
        }
        Insert: {
          chapter_id?: string | null
          city?: string | null
          created_at?: string | null
          id?: string
          is_approved?: boolean
          is_yuva?: boolean | null
          merged_into?: string | null
          name: string
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          state?: string | null
          website_url?: string | null
        }
        Update: {
          chapter_id?: string | null
          city?: string | null
          created_at?: string | null
          id?: string
          is_approved?: boolean
          is_yuva?: boolean | null
          merged_into?: string | null
          name?: string
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          state?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colleges_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_letters: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          delegate_id: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          id: string
          liability_consent: boolean | null
          medical_consent: boolean | null
          parent_address: string | null
          parent_email: string | null
          parent_name: string | null
          parent_phone: string | null
          rejection_reason: string | null
          signed_pdf_url: string | null
          status: Database["future"]["Enums"]["consent_status"] | null
          template_version: number | null
          travel_consent: boolean | null
          updated_at: string | null
          uploaded_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          delegate_id: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          id?: string
          liability_consent?: boolean | null
          medical_consent?: boolean | null
          parent_address?: string | null
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          rejection_reason?: string | null
          signed_pdf_url?: string | null
          status?: Database["future"]["Enums"]["consent_status"] | null
          template_version?: number | null
          travel_consent?: boolean | null
          updated_at?: string | null
          uploaded_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          delegate_id?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          id?: string
          liability_consent?: boolean | null
          medical_consent?: boolean | null
          parent_address?: string | null
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          rejection_reason?: string | null
          signed_pdf_url?: string | null
          status?: Database["future"]["Enums"]["consent_status"] | null
          template_version?: number | null
          travel_consent?: boolean | null
          updated_at?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_letters_delegate_id_fkey"
            columns: ["delegate_id"]
            isOneToOne: true
            referencedRelation: "delegates"
            referencedColumns: ["id"]
          },
        ]
      }
      corporate_partners: {
        Row: {
          access_code: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          event_id: string
          id: string
          is_internship_provider: boolean | null
          is_jury: boolean | null
          is_sponsor: boolean | null
          logo_url: string | null
          notes: string | null
          organization: string
          website_url: string | null
        }
        Insert: {
          access_code: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          event_id: string
          id?: string
          is_internship_provider?: boolean | null
          is_jury?: boolean | null
          is_sponsor?: boolean | null
          logo_url?: string | null
          notes?: string | null
          organization: string
          website_url?: string | null
        }
        Update: {
          access_code?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          event_id?: string
          id?: string
          is_internship_provider?: boolean | null
          is_jury?: boolean | null
          is_sponsor?: boolean | null
          logo_url?: string | null
          notes?: string | null
          organization?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "corporate_partners_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      delegates: {
        Row: {
          access_code: string | null
          age: number | null
          badges: Json
          chapter_id: string
          college_id: string | null
          course: string | null
          created_at: string | null
          declaration_accepted_at: string | null
          edition_id: string
          email: string | null
          email_verified_at: string | null
          full_name: string
          gender: string | null
          home_state: string | null
          id: string
          interest_internships: boolean
          interest_jobs: boolean
          interest_workshops: boolean
          is_active: boolean | null
          is_yi_yuva_member: boolean | null
          phone: string | null
          points: number
          preferred_track_slug: string | null
          profile_completion_pct: number
          registered_at: string | null
          resume_url: string | null
          specialization: string | null
          travel_commitment_acknowledged_at: string | null
          whatsapp: string | null
          why_statement: string | null
          year_of_study: number | null
        }
        Insert: {
          access_code?: string | null
          age?: number | null
          badges?: Json
          chapter_id: string
          college_id?: string | null
          course?: string | null
          created_at?: string | null
          declaration_accepted_at?: string | null
          edition_id: string
          email?: string | null
          email_verified_at?: string | null
          full_name: string
          gender?: string | null
          home_state?: string | null
          id?: string
          interest_internships?: boolean
          interest_jobs?: boolean
          interest_workshops?: boolean
          is_active?: boolean | null
          is_yi_yuva_member?: boolean | null
          phone?: string | null
          points?: number
          preferred_track_slug?: string | null
          profile_completion_pct?: number
          registered_at?: string | null
          resume_url?: string | null
          specialization?: string | null
          travel_commitment_acknowledged_at?: string | null
          whatsapp?: string | null
          why_statement?: string | null
          year_of_study?: number | null
        }
        Update: {
          access_code?: string | null
          age?: number | null
          badges?: Json
          chapter_id?: string
          college_id?: string | null
          course?: string | null
          created_at?: string | null
          declaration_accepted_at?: string | null
          edition_id?: string
          email?: string | null
          email_verified_at?: string | null
          full_name?: string
          gender?: string | null
          home_state?: string | null
          id?: string
          interest_internships?: boolean
          interest_jobs?: boolean
          interest_workshops?: boolean
          is_active?: boolean | null
          is_yi_yuva_member?: boolean | null
          phone?: string | null
          points?: number
          preferred_track_slug?: string | null
          profile_completion_pct?: number
          registered_at?: string | null
          resume_url?: string | null
          specialization?: string | null
          travel_commitment_acknowledged_at?: string | null
          whatsapp?: string | null
          why_statement?: string | null
          year_of_study?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delegates_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_delegates_college"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
        ]
      }
      edition_stage_log: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          chapter_id: string | null
          edition_id: string
          from_stage: Database["future"]["Enums"]["edition_stage"] | null
          id: string
          override: boolean | null
          override_reason: string | null
          to_stage: Database["future"]["Enums"]["edition_stage"]
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          chapter_id?: string | null
          edition_id: string
          from_stage?: Database["future"]["Enums"]["edition_stage"] | null
          id?: string
          override?: boolean | null
          override_reason?: string | null
          to_stage: Database["future"]["Enums"]["edition_stage"]
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          chapter_id?: string | null
          edition_id?: string
          from_stage?: Database["future"]["Enums"]["edition_stage"] | null
          id?: string
          override?: boolean | null
          override_reason?: string | null
          to_stage?: Database["future"]["Enums"]["edition_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "edition_stage_log_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
        ]
      }
      editions: {
        Row: {
          chapter_final_window_end: string | null
          chapter_final_window_start: string | null
          created_at: string | null
          current_stage: Database["future"]["Enums"]["edition_stage"] | null
          finale_visibility_cutoff: string | null
          id: string
          is_active: boolean | null
          kickoff_date: string | null
          name: string
          national_finals_window_end: string | null
          national_finals_window_start: string | null
          slug: string
          tagline: string | null
          updated_at: string | null
        }
        Insert: {
          chapter_final_window_end?: string | null
          chapter_final_window_start?: string | null
          created_at?: string | null
          current_stage?: Database["future"]["Enums"]["edition_stage"] | null
          finale_visibility_cutoff?: string | null
          id?: string
          is_active?: boolean | null
          kickoff_date?: string | null
          name: string
          national_finals_window_end?: string | null
          national_finals_window_start?: string | null
          slug: string
          tagline?: string | null
          updated_at?: string | null
        }
        Update: {
          chapter_final_window_end?: string | null
          chapter_final_window_start?: string | null
          created_at?: string | null
          current_stage?: Database["future"]["Enums"]["edition_stage"] | null
          finale_visibility_cutoff?: string | null
          id?: string
          is_active?: boolean | null
          kickoff_date?: string | null
          name?: string
          national_finals_window_end?: string | null
          national_finals_window_start?: string | null
          slug?: string
          tagline?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_otps: {
        Row: {
          attempts: number
          code: string
          consumed_at: string | null
          created_at: string
          delegate_id: string
          email: string
          expires_at: string
          id: string
        }
        Insert: {
          attempts?: number
          code: string
          consumed_at?: string | null
          created_at?: string
          delegate_id: string
          email: string
          expires_at: string
          id?: string
        }
        Update: {
          attempts?: number
          code?: string
          consumed_at?: string | null
          created_at?: string
          delegate_id?: string
          email?: string
          expires_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_otps_delegate_id_fkey"
            columns: ["delegate_id"]
            isOneToOne: false
            referencedRelation: "delegates"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_audit_log: {
        Row: {
          changed_by: string | null
          created_at: string | null
          evaluation_id: string
          id: string
          new_scores: Json | null
          new_total: number | null
          previous_scores: Json | null
          previous_total: number | null
          reason: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          evaluation_id: string
          id?: string
          new_scores?: Json | null
          new_total?: number | null
          previous_scores?: Json | null
          previous_total?: number | null
          reason?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          evaluation_id?: string
          id?: string
          new_scores?: Json | null
          new_total?: number | null
          previous_scores?: Json | null
          previous_total?: number | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_audit_log_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          comments: string | null
          created_at: string | null
          criteria_scores: Json
          event_id: string
          id: string
          jury_id: string
          key_gaps: string | null
          key_strengths: string | null
          policy_relevance: string | null
          q_and_a_notes: string | null
          recommendation: string | null
          rubric_id: string
          scalability_assessment: string | null
          status: Database["future"]["Enums"]["evaluation_status"] | null
          submitted_at: string | null
          team_id: string
          total_score: number
          updated_at: string | null
        }
        Insert: {
          comments?: string | null
          created_at?: string | null
          criteria_scores: Json
          event_id: string
          id?: string
          jury_id: string
          key_gaps?: string | null
          key_strengths?: string | null
          policy_relevance?: string | null
          q_and_a_notes?: string | null
          recommendation?: string | null
          rubric_id: string
          scalability_assessment?: string | null
          status?: Database["future"]["Enums"]["evaluation_status"] | null
          submitted_at?: string | null
          team_id: string
          total_score: number
          updated_at?: string | null
        }
        Update: {
          comments?: string | null
          created_at?: string | null
          criteria_scores?: Json
          event_id?: string
          id?: string
          jury_id?: string
          key_gaps?: string | null
          key_strengths?: string | null
          policy_relevance?: string | null
          q_and_a_notes?: string | null
          recommendation?: string | null
          rubric_id?: string
          scalability_assessment?: string | null
          status?: Database["future"]["Enums"]["evaluation_status"] | null
          submitted_at?: string | null
          team_id?: string
          total_score?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_jury_id_fkey"
            columns: ["jury_id"]
            isOneToOne: false
            referencedRelation: "jury_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "rubrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          chapter_id: string | null
          cover_image_url: string | null
          created_at: string | null
          created_by: string | null
          edition_id: string
          end_date: string | null
          id: string
          is_published: boolean | null
          name: string
          start_date: string | null
          tagline: string | null
          track_id: string | null
          type: Database["future"]["Enums"]["event_type"]
          updated_at: string | null
          venue: string | null
          venue_address: string | null
          venue_maps_url: string | null
        }
        Insert: {
          chapter_id?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          edition_id: string
          end_date?: string | null
          id?: string
          is_published?: boolean | null
          name: string
          start_date?: string | null
          tagline?: string | null
          track_id?: string | null
          type: Database["future"]["Enums"]["event_type"]
          updated_at?: string | null
          venue?: string | null
          venue_address?: string | null
          venue_maps_url?: string | null
        }
        Update: {
          chapter_id?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          edition_id?: string
          end_date?: string | null
          id?: string
          is_published?: boolean | null
          name?: string
          start_date?: string | null
          tagline?: string | null
          track_id?: string | null
          type?: Database["future"]["Enums"]["event_type"]
          updated_at?: string | null
          venue?: string | null
          venue_address?: string | null
          venue_maps_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      experts: {
        Row: {
          bio: string | null
          created_at: string | null
          edition_id: string
          email: string | null
          expertise_areas: string[] | null
          full_name: string
          id: string
          organization: string | null
          phone: string | null
          photo_url: string | null
          title: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          edition_id: string
          email?: string | null
          expertise_areas?: string[] | null
          full_name: string
          id?: string
          organization?: string | null
          phone?: string | null
          photo_url?: string | null
          title?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          edition_id?: string
          email?: string | null
          expertise_areas?: string[] | null
          full_name?: string
          id?: string
          organization?: string | null
          phone?: string | null
          photo_url?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "experts_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
        ]
      }
      government_engagements: {
        Row: {
          bio: string | null
          created_at: string | null
          engagement_type: string | null
          event_id: string
          id: string
          media_coverage_urls: string[] | null
          ministry_or_dept: string | null
          official_designation: string | null
          official_name: string
          photo_url: string | null
          scheduled_at: string | null
          summary: string | null
          whitepaper_accepted: boolean | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          engagement_type?: string | null
          event_id: string
          id?: string
          media_coverage_urls?: string[] | null
          ministry_or_dept?: string | null
          official_designation?: string | null
          official_name: string
          photo_url?: string | null
          scheduled_at?: string | null
          summary?: string | null
          whitepaper_accepted?: boolean | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          engagement_type?: string | null
          event_id?: string
          id?: string
          media_coverage_urls?: string[] | null
          ministry_or_dept?: string | null
          official_designation?: string | null
          official_name?: string
          photo_url?: string | null
          scheduled_at?: string | null
          summary?: string | null
          whitepaper_accepted?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "government_engagements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      host_deliverables: {
        Row: {
          event_id: string
          id: string
          internship_outcomes_doc_url: string | null
          media_coverage_doc_url: string | null
          participation_metrics_doc_url: string | null
          shortlist_winners_doc_url: string | null
          submitted_at: string | null
          submitted_by: string | null
          whitepaper_url: string | null
        }
        Insert: {
          event_id: string
          id?: string
          internship_outcomes_doc_url?: string | null
          media_coverage_doc_url?: string | null
          participation_metrics_doc_url?: string | null
          shortlist_winners_doc_url?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          whitepaper_url?: string | null
        }
        Update: {
          event_id?: string
          id?: string
          internship_outcomes_doc_url?: string | null
          media_coverage_doc_url?: string | null
          participation_metrics_doc_url?: string | null
          shortlist_winners_doc_url?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          whitepaper_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "host_deliverables_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      internship_slots: {
        Row: {
          created_at: string | null
          description: string | null
          domain: string | null
          duration: string | null
          id: string
          is_active: boolean | null
          location: string | null
          partner_id: string
          requirements: string | null
          slots_available: number | null
          stipend: string | null
          title: string
          work_mode: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          domain?: string | null
          duration?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          partner_id: string
          requirements?: string | null
          slots_available?: number | null
          stipend?: string | null
          title: string
          work_mode?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          domain?: string | null
          duration?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          partner_id?: string
          requirements?: string | null
          slots_available?: number | null
          stipend?: string | null
          title?: string
          work_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internship_slots_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "corporate_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_slots: {
        Row: {
          created_at: string | null
          delegate_id: string
          delegate_notes: string | null
          duration_minutes: number | null
          event_id: string
          id: string
          internship_slot_id: string | null
          outcome: Database["future"]["Enums"]["interview_outcome"] | null
          partner_id: string
          partner_notes: string | null
          room: string | null
          scheduled_at: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          delegate_id: string
          delegate_notes?: string | null
          duration_minutes?: number | null
          event_id: string
          id?: string
          internship_slot_id?: string | null
          outcome?: Database["future"]["Enums"]["interview_outcome"] | null
          partner_id: string
          partner_notes?: string | null
          room?: string | null
          scheduled_at: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          delegate_id?: string
          delegate_notes?: string | null
          duration_minutes?: number | null
          event_id?: string
          id?: string
          internship_slot_id?: string | null
          outcome?: Database["future"]["Enums"]["interview_outcome"] | null
          partner_id?: string
          partner_notes?: string | null
          room?: string | null
          scheduled_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_slots_delegate_id_fkey"
            columns: ["delegate_id"]
            isOneToOne: false
            referencedRelation: "delegates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_slots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_slots_internship_slot_id_fkey"
            columns: ["internship_slot_id"]
            isOneToOne: false
            referencedRelation: "internship_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_slots_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "corporate_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      jury_assignments: {
        Row: {
          access_code: string
          archetype: Database["future"]["Enums"]["jury_archetype"]
          bio: string | null
          created_at: string | null
          edition_id: string
          email: string | null
          event_id: string | null
          id: string
          is_active: boolean | null
          jury_name: string
          jury_title: string | null
          organization: string | null
          phone: string | null
          photo_url: string | null
          scope: string
          track_id: string | null
        }
        Insert: {
          access_code: string
          archetype: Database["future"]["Enums"]["jury_archetype"]
          bio?: string | null
          created_at?: string | null
          edition_id: string
          email?: string | null
          event_id?: string | null
          id?: string
          is_active?: boolean | null
          jury_name: string
          jury_title?: string | null
          organization?: string | null
          phone?: string | null
          photo_url?: string | null
          scope?: string
          track_id?: string | null
        }
        Update: {
          access_code?: string
          archetype?: Database["future"]["Enums"]["jury_archetype"]
          bio?: string | null
          created_at?: string | null
          edition_id?: string
          email?: string | null
          event_id?: string | null
          id?: string
          is_active?: boolean | null
          jury_name?: string
          jury_title?: string | null
          organization?: string | null
          phone?: string | null
          photo_url?: string | null
          scope?: string
          track_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jury_assignments_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jury_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jury_assignments_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      jury_team_assignments: {
        Row: {
          assigned_at: string | null
          jury_id: string
          team_id: string
        }
        Insert: {
          assigned_at?: string | null
          jury_id: string
          team_id: string
        }
        Update: {
          assigned_at?: string | null
          jury_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jury_team_assignments_jury_id_fkey"
            columns: ["jury_id"]
            isOneToOne: false
            referencedRelation: "jury_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jury_team_assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      media_coverage: {
        Row: {
          created_at: string | null
          event_id: string
          headline: string | null
          id: string
          media_type: string | null
          notes: string | null
          outlet: string | null
          publication_date: string | null
          reach_estimate: number | null
          url: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          headline?: string | null
          id?: string
          media_type?: string | null
          notes?: string | null
          outlet?: string | null
          publication_date?: string | null
          reach_estimate?: number | null
          url?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          headline?: string | null
          id?: string
          media_type?: string | null
          notes?: string | null
          outlet?: string | null
          publication_date?: string | null
          reach_estimate?: number | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_coverage_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_evaluations: {
        Row: {
          created_at: string
          edition_id: string
          engagement: number | null
          growth: number | null
          id: string
          mentor_id: string
          notes: string | null
          participation: number | null
          phase_event_id: string | null
          progress: number | null
          status: string
          submission_quality: number | null
          submitted_at: string | null
          team_id: string
          total_score: number | null
        }
        Insert: {
          created_at?: string
          edition_id: string
          engagement?: number | null
          growth?: number | null
          id?: string
          mentor_id: string
          notes?: string | null
          participation?: number | null
          phase_event_id?: string | null
          progress?: number | null
          status?: string
          submission_quality?: number | null
          submitted_at?: string | null
          team_id: string
          total_score?: number | null
        }
        Update: {
          created_at?: string
          edition_id?: string
          engagement?: number | null
          growth?: number | null
          id?: string
          mentor_id?: string
          notes?: string | null
          participation?: number | null
          phase_event_id?: string | null
          progress?: number | null
          status?: string
          submission_quality?: number | null
          submitted_at?: string | null
          team_id?: string
          total_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mentor_evaluations_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_evaluations_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_evaluations_phase_event_id_fkey"
            columns: ["phase_event_id"]
            isOneToOne: false
            referencedRelation: "phase_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_evaluations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_feedback: {
        Row: {
          created_at: string | null
          id: string
          improvements: string | null
          mentor_id: string
          next_actions: string | null
          phase: Database["future"]["Enums"]["phase"] | null
          rating: number | null
          strengths: string | null
          team_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          improvements?: string | null
          mentor_id: string
          next_actions?: string | null
          phase?: Database["future"]["Enums"]["phase"] | null
          rating?: number | null
          strengths?: string | null
          team_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          improvements?: string | null
          mentor_id?: string
          next_actions?: string | null
          phase?: Database["future"]["Enums"]["phase"] | null
          rating?: number | null
          strengths?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_feedback_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_feedback_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_team_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          mentor_id: string
          team_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          mentor_id: string
          team_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          mentor_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_team_assignments_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_team_assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      mentors: {
        Row: {
          access_code: string
          bio: string | null
          chapter_id: string | null
          created_at: string | null
          edition_id: string
          email: string | null
          expertise: string | null
          full_name: string
          id: string
          is_active: boolean | null
          organization: string | null
          phone: string | null
          photo_url: string | null
          title: string | null
        }
        Insert: {
          access_code: string
          bio?: string | null
          chapter_id?: string | null
          created_at?: string | null
          edition_id: string
          email?: string | null
          expertise?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          organization?: string | null
          phone?: string | null
          photo_url?: string | null
          title?: string | null
        }
        Update: {
          access_code?: string
          bio?: string | null
          chapter_id?: string | null
          created_at?: string | null
          edition_id?: string
          email?: string | null
          expertise?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          organization?: string | null
          phone?: string | null
          photo_url?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mentors_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          mentor_id: string
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          mentor_id: string
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          mentor_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_id: string
          sender_type: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_id: string
          sender_type: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
          sender_type?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      national_day1_sections: {
        Row: {
          ends_at: string | null
          event_id: string
          is_active: boolean | null
          notes: string | null
          section: Database["future"]["Enums"]["national_day1_section"]
          speaker_bio: string | null
          speaker_name: string | null
          speaker_photo_url: string | null
          speaker_title: string | null
          starts_at: string | null
          title: string | null
        }
        Insert: {
          ends_at?: string | null
          event_id: string
          is_active?: boolean | null
          notes?: string | null
          section: Database["future"]["Enums"]["national_day1_section"]
          speaker_bio?: string | null
          speaker_name?: string | null
          speaker_photo_url?: string | null
          speaker_title?: string | null
          starts_at?: string | null
          title?: string | null
        }
        Update: {
          ends_at?: string | null
          event_id?: string
          is_active?: boolean | null
          notes?: string | null
          section?: Database["future"]["Enums"]["national_day1_section"]
          speaker_bio?: string | null
          speaker_name?: string | null
          speaker_photo_url?: string | null
          speaker_title?: string | null
          starts_at?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "national_day1_sections_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      national_day2_sections: {
        Row: {
          ends_at: string | null
          event_id: string
          is_active: boolean | null
          notes: string | null
          section: Database["future"]["Enums"]["national_day2_section"]
          starts_at: string | null
          title: string | null
        }
        Insert: {
          ends_at?: string | null
          event_id: string
          is_active?: boolean | null
          notes?: string | null
          section: Database["future"]["Enums"]["national_day2_section"]
          starts_at?: string | null
          title?: string | null
        }
        Update: {
          ends_at?: string | null
          event_id?: string
          is_active?: boolean | null
          notes?: string | null
          section?: Database["future"]["Enums"]["national_day2_section"]
          starts_at?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "national_day2_sections_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      national_event_sections: {
        Row: {
          day: number
          ends_at: string | null
          event_id: string
          id: string
          is_active: boolean | null
          notes: string | null
          section_key: string
          sequence_order: number
          starts_at: string | null
          title: string | null
        }
        Insert: {
          day: number
          ends_at?: string | null
          event_id: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          section_key: string
          sequence_order?: number
          starts_at?: string | null
          title?: string | null
        }
        Update: {
          day?: number
          ends_at?: string | null
          event_id?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          section_key?: string
          sequence_order?: number
          starts_at?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "national_event_sections_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          body_preview: string | null
          created_at: string
          error: string | null
          id: string
          recipient_email: string
          recipient_subject_id: string | null
          recipient_subject_type: string | null
          sent_at: string | null
          status: string
          subject_line: string | null
          trigger_type: string
        }
        Insert: {
          body_preview?: string | null
          created_at?: string
          error?: string | null
          id?: string
          recipient_email: string
          recipient_subject_id?: string | null
          recipient_subject_type?: string | null
          sent_at?: string | null
          status?: string
          subject_line?: string | null
          trigger_type: string
        }
        Update: {
          body_preview?: string | null
          created_at?: string
          error?: string | null
          id?: string
          recipient_email?: string
          recipient_subject_id?: string | null
          recipient_subject_type?: string | null
          sent_at?: string | null
          status?: string
          subject_line?: string | null
          trigger_type?: string
        }
        Relationships: []
      }
      outreach_log: {
        Row: {
          activity_date: string | null
          activity_type: string
          attendees_count: number | null
          chapter_id: string
          college_id: string | null
          created_at: string | null
          edition_id: string
          id: string
          logged_by: string | null
          notes: string | null
        }
        Insert: {
          activity_date?: string | null
          activity_type: string
          attendees_count?: number | null
          chapter_id: string
          college_id?: string | null
          created_at?: string | null
          edition_id: string
          id?: string
          logged_by?: string | null
          notes?: string | null
        }
        Update: {
          activity_date?: string | null
          activity_type?: string
          attendees_count?: number | null
          chapter_id?: string
          college_id?: string | null
          created_at?: string | null
          edition_id?: string
          id?: string
          logged_by?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_log_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_log_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_resume_access: {
        Row: {
          delegate_id: string
          interested: boolean | null
          notes: string | null
          partner_id: string
          viewed_at: string | null
        }
        Insert: {
          delegate_id: string
          interested?: boolean | null
          notes?: string | null
          partner_id: string
          viewed_at?: string | null
        }
        Update: {
          delegate_id?: string
          interested?: boolean | null
          notes?: string | null
          partner_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_resume_access_delegate_id_fkey"
            columns: ["delegate_id"]
            isOneToOne: false
            referencedRelation: "delegates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_resume_access_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "corporate_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      phase_event_attendance: {
        Row: {
          attended: boolean | null
          delegate_id: string
          marked_at: string | null
          marked_by: string | null
          notes: string | null
          phase_event_id: string
        }
        Insert: {
          attended?: boolean | null
          delegate_id: string
          marked_at?: string | null
          marked_by?: string | null
          notes?: string | null
          phase_event_id: string
        }
        Update: {
          attended?: boolean | null
          delegate_id?: string
          marked_at?: string | null
          marked_by?: string | null
          notes?: string | null
          phase_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phase_event_attendance_delegate_id_fkey"
            columns: ["delegate_id"]
            isOneToOne: false
            referencedRelation: "delegates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phase_event_attendance_phase_event_id_fkey"
            columns: ["phase_event_id"]
            isOneToOne: false
            referencedRelation: "phase_events"
            referencedColumns: ["id"]
          },
        ]
      }
      phase_events: {
        Row: {
          capacity: number | null
          chapter_id: string
          completed: boolean | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          edition_id: string
          expert_id: string | null
          id: string
          meeting_url: string | null
          mentor_id: string | null
          mode: string | null
          notes: string | null
          phase: Database["future"]["Enums"]["phase"]
          scheduled_at: string
          title: string
          type: Database["future"]["Enums"]["phase_event_type"]
          venue: string | null
        }
        Insert: {
          capacity?: number | null
          chapter_id: string
          completed?: boolean | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          edition_id: string
          expert_id?: string | null
          id?: string
          meeting_url?: string | null
          mentor_id?: string | null
          mode?: string | null
          notes?: string | null
          phase: Database["future"]["Enums"]["phase"]
          scheduled_at: string
          title: string
          type: Database["future"]["Enums"]["phase_event_type"]
          venue?: string | null
        }
        Update: {
          capacity?: number | null
          chapter_id?: string
          completed?: boolean | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          edition_id?: string
          expert_id?: string | null
          id?: string
          meeting_url?: string | null
          mentor_id?: string | null
          mode?: string | null
          notes?: string | null
          phase?: Database["future"]["Enums"]["phase"]
          scheduled_at?: string
          title?: string
          type?: Database["future"]["Enums"]["phase_event_type"]
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_phase_events_expert"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_phase_events_mentor"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phase_events_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
        ]
      }
      post_event_reports: {
        Row: {
          authored_by: string | null
          created_at: string
          event_id: string
          id: string
          key_moments: string | null
          media_gallery_paths: Json | null
          press_coverage_links: Json | null
          status: string
          submitted_at: string | null
          turnout_count: number | null
        }
        Insert: {
          authored_by?: string | null
          created_at?: string
          event_id: string
          id?: string
          key_moments?: string | null
          media_gallery_paths?: Json | null
          press_coverage_links?: Json | null
          status?: string
          submitted_at?: string | null
          turnout_count?: number | null
        }
        Update: {
          authored_by?: string | null
          created_at?: string
          event_id?: string
          id?: string
          key_moments?: string | null
          media_gallery_paths?: Json | null
          press_coverage_links?: Json | null
          status?: string
          submitted_at?: string | null
          turnout_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_event_reports_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      problem_preferences: {
        Row: {
          created_at: string
          id: string
          problem_statement_id: string
          rank: number
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          problem_statement_id: string
          rank: number
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          problem_statement_id?: string
          rank?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "problem_preferences_problem_statement_id_fkey"
            columns: ["problem_statement_id"]
            isOneToOne: false
            referencedRelation: "problem_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "problem_preferences_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      problem_statements: {
        Row: {
          created_at: string | null
          display_order: number | null
          full_description: string | null
          id: string
          is_active: boolean | null
          national_priority_context: string | null
          policy_baseline_refs: Json | null
          reading_list: Json | null
          sdg_alignment: string[] | null
          short_description: string
          title: string
          track_id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          full_description?: string | null
          id?: string
          is_active?: boolean | null
          national_priority_context?: string | null
          policy_baseline_refs?: Json | null
          reading_list?: Json | null
          sdg_alignment?: string[] | null
          short_description: string
          title: string
          track_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          full_description?: string | null
          id?: string
          is_active?: boolean | null
          national_priority_context?: string | null
          policy_baseline_refs?: Json | null
          reading_list?: Json | null
          sdg_alignment?: string[] | null
          short_description?: string
          title?: string
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "problem_statements_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          subject_id: string
          subject_type: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          subject_id: string
          subject_type: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          subject_id?: string
          subject_type?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      resources: {
        Row: {
          created_at: string
          description: string | null
          edition_id: string
          external_url: string | null
          file_path: string | null
          id: string
          resource_type: string
          title: string
          uploaded_by_mentor_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          edition_id: string
          external_url?: string | null
          file_path?: string | null
          id?: string
          resource_type: string
          title: string
          uploaded_by_mentor_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          edition_id?: string
          external_url?: string | null
          file_path?: string | null
          id?: string
          resource_type?: string
          title?: string
          uploaded_by_mentor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_uploaded_by_mentor_id_fkey"
            columns: ["uploaded_by_mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
        ]
      }
      rubrics: {
        Row: {
          created_at: string | null
          criteria: Json
          edition_id: string
          id: string
          is_default: boolean | null
          name: string
          scope: string
          threshold_for_national: number | null
          total_max: number | null
        }
        Insert: {
          created_at?: string | null
          criteria: Json
          edition_id: string
          id?: string
          is_default?: boolean | null
          name: string
          scope: string
          threshold_for_national?: number | null
          total_max?: number | null
        }
        Update: {
          created_at?: string | null
          criteria?: Json
          edition_id?: string
          id?: string
          is_default?: boolean | null
          name?: string
          scope?: string
          threshold_for_national?: number | null
          total_max?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rubrics_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          created_at: string | null
          draft_solution_url: string | null
          feedback: string | null
          final_execution_plan_url: string | null
          final_policy_document_url: string | null
          final_presentation_deck_url: string | null
          final_scalability_model_url: string | null
          id: string
          phase: Database["future"]["Enums"]["deliverable_phase"]
          problem_definition_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["future"]["Enums"]["submission_status"] | null
          submitted_at: string | null
          submitted_by_delegate_id: string | null
          summary: string | null
          team_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          draft_solution_url?: string | null
          feedback?: string | null
          final_execution_plan_url?: string | null
          final_policy_document_url?: string | null
          final_presentation_deck_url?: string | null
          final_scalability_model_url?: string | null
          id?: string
          phase: Database["future"]["Enums"]["deliverable_phase"]
          problem_definition_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["future"]["Enums"]["submission_status"] | null
          submitted_at?: string | null
          submitted_by_delegate_id?: string | null
          summary?: string | null
          team_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          draft_solution_url?: string | null
          feedback?: string | null
          final_execution_plan_url?: string | null
          final_policy_document_url?: string | null
          final_presentation_deck_url?: string | null
          final_scalability_model_url?: string | null
          id?: string
          phase?: Database["future"]["Enums"]["deliverable_phase"]
          problem_definition_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["future"]["Enums"]["submission_status"] | null
          submitted_at?: string | null
          submitted_by_delegate_id?: string | null
          summary?: string | null
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_submitted_by_delegate_id_fkey"
            columns: ["submitted_by_delegate_id"]
            isOneToOne: false
            referencedRelation: "delegates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          created_at: string
          id: string
          invited_by: string
          invited_delegate_id: string
          message: string | null
          responded_at: string | null
          status: string
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by: string
          invited_delegate_id: string
          message?: string | null
          responded_at?: string | null
          status?: string
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string
          invited_delegate_id?: string
          message?: string | null
          responded_at?: string | null
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "delegates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_invited_delegate_id_fkey"
            columns: ["invited_delegate_id"]
            isOneToOne: false
            referencedRelation: "delegates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          delegate_id: string
          joined_at: string | null
          role_in_team: string | null
          team_id: string
        }
        Insert: {
          delegate_id: string
          joined_at?: string | null
          role_in_team?: string | null
          team_id: string
        }
        Update: {
          delegate_id?: string
          joined_at?: string | null
          role_in_team?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_delegate_id_fkey"
            columns: ["delegate_id"]
            isOneToOne: false
            referencedRelation: "delegates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          captain_id: string | null
          chapter_id: string
          created_at: string | null
          edition_id: string
          frozen_at: string | null
          id: string
          is_frozen: boolean
          leader_delegate_id: string | null
          problem_statement_id: string | null
          status: string | null
          team_name: string
          updated_at: string | null
        }
        Insert: {
          captain_id?: string | null
          chapter_id: string
          created_at?: string | null
          edition_id: string
          frozen_at?: string | null
          id?: string
          is_frozen?: boolean
          leader_delegate_id?: string | null
          problem_statement_id?: string | null
          status?: string | null
          team_name: string
          updated_at?: string | null
        }
        Update: {
          captain_id?: string | null
          chapter_id?: string
          created_at?: string | null
          edition_id?: string
          frozen_at?: string | null
          id?: string
          is_frozen?: boolean
          leader_delegate_id?: string | null
          problem_statement_id?: string | null
          status?: string | null
          team_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "delegates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_leader_delegate_id_fkey"
            columns: ["leader_delegate_id"]
            isOneToOne: false
            referencedRelation: "delegates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_problem_statement_id_fkey"
            columns: ["problem_statement_id"]
            isOneToOne: false
            referencedRelation: "problem_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      tracks: {
        Row: {
          color_hex: string | null
          description: string | null
          display_order: number | null
          edition_id: string
          icon: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          color_hex?: string | null
          description?: string | null
          display_order?: number | null
          edition_id: string
          icon?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          color_hex?: string | null
          description?: string | null
          display_order?: number | null
          edition_id?: string
          icon?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracks_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
        ]
      }
      whitepapers: {
        Row: {
          cover_image_url: string | null
          created_at: string | null
          edition_id: string
          executive_summary: string | null
          host_chapter_id: string | null
          id: string
          pdf_url: string | null
          published_at: string | null
          sections: Json
          status: string | null
          title: string | null
          track_id: string
          updated_at: string | null
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string | null
          edition_id: string
          executive_summary?: string | null
          host_chapter_id?: string | null
          id?: string
          pdf_url?: string | null
          published_at?: string | null
          sections?: Json
          status?: string | null
          title?: string | null
          track_id: string
          updated_at?: string | null
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string | null
          edition_id?: string
          executive_summary?: string | null
          host_chapter_id?: string | null
          id?: string
          pdf_url?: string | null
          published_at?: string | null
          sections?: Json
          status?: string | null
          title?: string | null
          track_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whitepapers_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whitepapers_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_stats: {
        Row: {
          total_chapters: number | null
          total_delegates: number | null
          total_teams: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_chapter_admin: { Args: { check_chapter_id: string }; Returns: boolean }
      leaderboard_chapter: {
        Args: { p_edition_id: string }
        Returns: {
          avg_score: number
          chapter_id: string
          chapter_name: string
          team_count: number
        }[]
      }
      leaderboard_institution: {
        Args: { p_edition_id: string }
        Returns: {
          avg_score: number
          college_id: string
          college_name: string
          team_count: number
        }[]
      }
      leaderboard_problem: {
        Args: { p_edition_id: string }
        Returns: {
          avg_score: number
          chapter_name: string
          problem_id: string
          problem_title: string
          rk: number
          team_id: string
          team_name: string
        }[]
      }
      leaderboard_track: {
        Args: { p_edition_id: string }
        Returns: {
          avg_score: number
          chapter_name: string
          rk: number
          team_id: string
          team_name: string
          track_id: string
          track_name: string
        }[]
      }
    }
    Enums: {
      award_category:
        | "track_champion"
        | "best_policy_framework"
        | "most_scalable"
        | "best_implementation"
        | "jury_special_mention"
        | "chapter_local_award"
      chapter_final_section:
        | "opening"
        | "team_presentations"
        | "jury_qa"
        | "govt_industry"
        | "announcement"
      consent_status: "pending" | "uploaded" | "approved" | "rejected"
      deliverable_phase: "phase_a" | "phase_b" | "phase_c"
      edition_stage:
        | "announcement"
        | "registration_open"
        | "teams_formed"
        | "phase_a_active"
        | "phase_a_complete"
        | "phase_b_active"
        | "phase_b_complete"
        | "phase_c_active"
        | "phase_c_complete"
        | "chapter_final_scheduled"
        | "chapter_final_live"
        | "chapter_final_scored"
        | "shortlist_published"
        | "consent_collection"
        | "national_day_1"
        | "national_day_2"
        | "awards_announced"
        | "post_event_deliverables"
        | "whitepaper_published"
        | "completed"
      evaluation_status: "draft" | "submitted"
      event_type: "chapter_final" | "national_track_final"
      interview_outcome:
        | "offered"
        | "shortlisted"
        | "followup"
        | "no_fit"
        | "no_show"
      jury_archetype: "policy" | "industry" | "senior_yi" | "academic"
      national_day1_section:
        | "opening"
        | "keynote"
        | "masterclass"
        | "townhall"
        | "networking"
      national_day2_section:
        | "semi_final"
        | "grand_final"
        | "opportunity_interviews"
        | "recognition"
      phase: "phase_a" | "phase_b" | "phase_c"
      phase_event_type:
        | "orientation"
        | "policy_workshop"
        | "expert_talk"
        | "mentorship_clinic"
        | "execution_planning"
        | "midpoint_review"
        | "refinement_workshop"
        | "mock_jury"
        | "doc_support"
      submission_status: "draft" | "submitted" | "approved" | "rejected"
      track_host_role: "participating" | "host"
      user_role:
        | "delegate"
        | "captain"
        | "mentor"
        | "expert"
        | "jury_chapter"
        | "jury_national"
        | "chapter_event_lead"
        | "college_outreach_lead"
        | "mentorship_content_lead"
        | "ops_documentation_lead"
        | "host_admin"
        | "national_admin"
        | "corporate_partner"
        | "chapter_chair"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agenda_items: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          agenda_type: string | null
          config: Json | null
          created_at: string | null
          day: number
          description: string | null
          duration_minutes: number | null
          event_id: string
          id: string
          mode: Database["public"]["Enums"]["agenda_mode"]
          planned_start: string | null
          sequence_order: number
          status: Database["public"]["Enums"]["agenda_status"] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          agenda_type?: string | null
          config?: Json | null
          created_at?: string | null
          day: number
          description?: string | null
          duration_minutes?: number | null
          event_id: string
          id?: string
          mode?: Database["public"]["Enums"]["agenda_mode"]
          planned_start?: string | null
          sequence_order: number
          status?: Database["public"]["Enums"]["agenda_status"] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          agenda_type?: string | null
          config?: Json | null
          created_at?: string | null
          day?: number
          description?: string | null
          duration_minutes?: number | null
          event_id?: string
          id?: string
          mode?: Database["public"]["Enums"]["agenda_mode"]
          planned_start?: string | null
          sequence_order?: number
          status?: Database["public"]["Enums"]["agenda_status"] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agenda_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_speakers: {
        Row: {
          actual_seconds: number | null
          agenda_item_id: string
          allotted_seconds: number | null
          created_at: string | null
          ended_at: string | null
          id: string
          notes: string | null
          participant_id: string
          speaking_order: number
          started_at: string | null
          status: string | null
        }
        Insert: {
          actual_seconds?: number | null
          agenda_item_id: string
          allotted_seconds?: number | null
          created_at?: string | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          participant_id: string
          speaking_order: number
          started_at?: string | null
          status?: string | null
        }
        Update: {
          actual_seconds?: number | null
          agenda_item_id?: string
          allotted_seconds?: number | null
          created_at?: string | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          participant_id?: string
          speaking_order?: number
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agenda_speakers_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_speakers_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          created_at: string | null
          event_id: string
          expected_impact: string | null
          id: string
          implementation: string | null
          is_mock: boolean
          lead_drafter: string | null
          objective: string | null
          party_side: Database["public"]["Enums"]["party_side"]
          policy_researcher: string | null
          presenter_1: string | null
          presenter_2: string | null
          problem_statement: string | null
          provisions: Json | null
          status: string | null
          title: string
          updated_at: string | null
          votes_abstain: number | null
          votes_against: number | null
          votes_for: number | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          expected_impact?: string | null
          id?: string
          implementation?: string | null
          is_mock?: boolean
          lead_drafter?: string | null
          objective?: string | null
          party_side: Database["public"]["Enums"]["party_side"]
          policy_researcher?: string | null
          presenter_1?: string | null
          presenter_2?: string | null
          problem_statement?: string | null
          provisions?: Json | null
          status?: string | null
          title: string
          updated_at?: string | null
          votes_abstain?: number | null
          votes_against?: number | null
          votes_for?: number | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          expected_impact?: string | null
          id?: string
          implementation?: string | null
          is_mock?: boolean
          lead_drafter?: string | null
          objective?: string | null
          party_side?: Database["public"]["Enums"]["party_side"]
          policy_researcher?: string | null
          presenter_1?: string | null
          presenter_2?: string | null
          problem_statement?: string | null
          provisions?: Json | null
          status?: string | null
          title?: string
          updated_at?: string | null
          votes_abstain?: number | null
          votes_against?: number | null
          votes_for?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bills_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_lead_drafter_fkey"
            columns: ["lead_drafter"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_policy_researcher_fkey"
            columns: ["policy_researcher"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_presenter_1_fkey"
            columns: ["presenter_1"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_presenter_2_fkey"
            columns: ["presenter_2"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      branding_compliance_checks: {
        Row: {
          checked_at: string | null
          checked_by: string | null
          created_at: string | null
          event_id: string
          evidence_url: string | null
          id: string
          is_mock: boolean
          notes: string | null
          rule_key: string
          status: Database["public"]["Enums"]["compliance_status"]
          updated_at: string | null
          violation_action: string | null
        }
        Insert: {
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string | null
          event_id: string
          evidence_url?: string | null
          id?: string
          is_mock?: boolean
          notes?: string | null
          rule_key: string
          status?: Database["public"]["Enums"]["compliance_status"]
          updated_at?: string | null
          violation_action?: string | null
        }
        Update: {
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string | null
          event_id?: string
          evidence_url?: string | null
          id?: string
          is_mock?: boolean
          notes?: string | null
          rule_key?: string
          status?: Database["public"]["Enums"]["compliance_status"]
          updated_at?: string | null
          violation_action?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branding_compliance_checks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      branding_rules: {
        Row: {
          category: string
          created_at: string | null
          description: string
          handbook_page: number | null
          id: string
          is_active: boolean
          requires_evidence: boolean
          rule_key: string
          severity: string
          sort_order: number
          title: string
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description: string
          handbook_page?: number | null
          id?: string
          is_active?: boolean
          requires_evidence?: boolean
          rule_key: string
          severity?: string
          sort_order?: number
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string
          handbook_page?: number | null
          id?: string
          is_active?: boolean
          requires_evidence?: boolean
          rule_key?: string
          severity?: string
          sort_order?: number
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      constituencies: {
        Row: {
          created_at: string | null
          id: string
          name: string
          state: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          state: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          state?: string
        }
        Relationships: []
      }
      default_checklist_items: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          handbook_page: number | null
          id: string
          is_active: boolean | null
          sequence_order: number
          title: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          handbook_page?: number | null
          id?: string
          is_active?: boolean | null
          sequence_order: number
          title: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          handbook_page?: number | null
          id?: string
          is_active?: boolean | null
          sequence_order?: number
          title?: string
        }
        Relationships: []
      }
      event_media: {
        Row: {
          caption: string | null
          created_at: string
          event_id: string
          file_name: string
          height: number | null
          id: string
          is_cover: boolean
          is_mock: boolean
          kind: Database["public"]["Enums"]["media_kind"]
          mime_type: string | null
          photographer_name: string | null
          public_url: string | null
          size_bytes: number | null
          sort_order: number | null
          storage_path: string
          tags: string[] | null
          taken_at: string | null
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
          visibility: Database["public"]["Enums"]["media_visibility"]
          width: number | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          event_id: string
          file_name: string
          height?: number | null
          id?: string
          is_cover?: boolean
          is_mock?: boolean
          kind?: Database["public"]["Enums"]["media_kind"]
          mime_type?: string | null
          photographer_name?: string | null
          public_url?: string | null
          size_bytes?: number | null
          sort_order?: number | null
          storage_path: string
          tags?: string[] | null
          taken_at?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
          visibility?: Database["public"]["Enums"]["media_visibility"]
          width?: number | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          event_id?: string
          file_name?: string
          height?: number | null
          id?: string
          is_cover?: boolean
          is_mock?: boolean
          kind?: Database["public"]["Enums"]["media_kind"]
          mime_type?: string | null
          photographer_name?: string | null
          public_url?: string | null
          size_bytes?: number | null
          sort_order?: number | null
          storage_path?: string
          tags?: string[] | null
          taken_at?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
          visibility?: Database["public"]["Enums"]["media_visibility"]
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_media_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_topic_assignments: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          is_central: boolean | null
          sequence: number | null
          topic_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          is_central?: boolean | null
          sequence?: number | null
          topic_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          is_central?: boolean | null
          sequence?: number | null
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_topic_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_topic_assignments_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          allocation_locked: boolean | null
          central_agenda: string | null
          chapter_em_id: string | null
          chapter_name: string | null
          city: string | null
          committee_topics: Json | null
          created_at: string | null
          created_by: string | null
          current_agenda_item_id: string | null
          day1_date: string
          day2_date: string
          fee_per_participant_inr: number | null
          id: string
          ingestion_enabled: boolean
          is_mock: boolean
          level: Database["public"]["Enums"]["event_level"]
          live_timer_end: string | null
          live_timer_label: string | null
          live_timer_running: boolean | null
          max_participants: number | null
          mycii_event_registered: boolean | null
          mycii_payment_link: string | null
          name: string
          oath_text: string | null
          questions_close_at: string | null
          registrations_frozen: boolean | null
          results_published_at: string | null
          scores_locked: boolean | null
          season_id: string | null
          state: string | null
          status: Database["public"]["Enums"]["event_status"]
          updated_at: string | null
          venue_address: string | null
          venue_name: string | null
          zone: Database["public"]["Enums"]["yi_zone"] | null
        }
        Insert: {
          allocation_locked?: boolean | null
          central_agenda?: string | null
          chapter_em_id?: string | null
          chapter_name?: string | null
          city?: string | null
          committee_topics?: Json | null
          created_at?: string | null
          created_by?: string | null
          current_agenda_item_id?: string | null
          day1_date: string
          day2_date: string
          fee_per_participant_inr?: number | null
          id?: string
          ingestion_enabled?: boolean
          is_mock?: boolean
          level?: Database["public"]["Enums"]["event_level"]
          live_timer_end?: string | null
          live_timer_label?: string | null
          live_timer_running?: boolean | null
          max_participants?: number | null
          mycii_event_registered?: boolean | null
          mycii_payment_link?: string | null
          name: string
          oath_text?: string | null
          questions_close_at?: string | null
          registrations_frozen?: boolean | null
          results_published_at?: string | null
          scores_locked?: boolean | null
          season_id?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string | null
          venue_address?: string | null
          venue_name?: string | null
          zone?: Database["public"]["Enums"]["yi_zone"] | null
        }
        Update: {
          allocation_locked?: boolean | null
          central_agenda?: string | null
          chapter_em_id?: string | null
          chapter_name?: string | null
          city?: string | null
          committee_topics?: Json | null
          created_at?: string | null
          created_by?: string | null
          current_agenda_item_id?: string | null
          day1_date?: string
          day2_date?: string
          fee_per_participant_inr?: number | null
          id?: string
          ingestion_enabled?: boolean
          is_mock?: boolean
          level?: Database["public"]["Enums"]["event_level"]
          live_timer_end?: string | null
          live_timer_label?: string | null
          live_timer_running?: boolean | null
          max_participants?: number | null
          mycii_event_registered?: boolean | null
          mycii_payment_link?: string | null
          name?: string
          oath_text?: string | null
          questions_close_at?: string | null
          registrations_frozen?: boolean | null
          results_published_at?: string | null
          scores_locked?: boolean | null
          season_id?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string | null
          venue_address?: string | null
          venue_name?: string | null
          zone?: Database["public"]["Enums"]["yi_zone"] | null
        }
        Relationships: [
          {
            foreignKeyName: "events_chapter_em_id_fkey"
            columns: ["chapter_em_id"]
            isOneToOne: false
            referencedRelation: "organizer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_current_agenda"
            columns: ["current_agenda_item_id"]
            isOneToOne: false
            referencedRelation: "agenda_items"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_responses: {
        Row: {
          answers: Json | null
          biggest_takeaway: string | null
          content_rating: number | null
          event_id: string
          id: string
          is_mock: boolean
          learned_something: string | null
          nps_score: number | null
          organization_rating: number | null
          overall_rating: number | null
          respondent_email: string | null
          respondent_name: string | null
          respondent_participant_id: string | null
          respondent_type: Database["public"]["Enums"]["feedback_respondent"]
          submitted_at: string | null
          suggestions: string | null
          what_didnt_work: string | null
          what_worked: string | null
          would_recommend: boolean | null
        }
        Insert: {
          answers?: Json | null
          biggest_takeaway?: string | null
          content_rating?: number | null
          event_id: string
          id?: string
          is_mock?: boolean
          learned_something?: string | null
          nps_score?: number | null
          organization_rating?: number | null
          overall_rating?: number | null
          respondent_email?: string | null
          respondent_name?: string | null
          respondent_participant_id?: string | null
          respondent_type: Database["public"]["Enums"]["feedback_respondent"]
          submitted_at?: string | null
          suggestions?: string | null
          what_didnt_work?: string | null
          what_worked?: string | null
          would_recommend?: boolean | null
        }
        Update: {
          answers?: Json | null
          biggest_takeaway?: string | null
          content_rating?: number | null
          event_id?: string
          id?: string
          is_mock?: boolean
          learned_something?: string | null
          nps_score?: number | null
          organization_rating?: number | null
          overall_rating?: number | null
          respondent_email?: string | null
          respondent_name?: string | null
          respondent_participant_id?: string | null
          respondent_type?: Database["public"]["Enums"]["feedback_respondent"]
          submitted_at?: string | null
          suggestions?: string | null
          what_didnt_work?: string | null
          what_worked?: string | null
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_responses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_responses_respondent_participant_id_fkey"
            columns: ["respondent_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_approvals: {
        Row: {
          approval_note: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          approved_by_national: boolean | null
          created_at: string | null
          draft_url: string | null
          event_id: string
          id: string
          invitation_category: string | null
          invitee_name: string
          invitee_role: string | null
          is_mock: boolean
          submitted_for_approval_at: string | null
          updated_at: string | null
        }
        Insert: {
          approval_note?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          approved_by_national?: boolean | null
          created_at?: string | null
          draft_url?: string | null
          event_id: string
          id?: string
          invitation_category?: string | null
          invitee_name: string
          invitee_role?: string | null
          is_mock?: boolean
          submitted_for_approval_at?: string | null
          updated_at?: string | null
        }
        Update: {
          approval_note?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          approved_by_national?: boolean | null
          created_at?: string | null
          draft_url?: string | null
          event_id?: string
          id?: string
          invitation_category?: string | null
          invitee_name?: string
          invitee_role?: string | null
          is_mock?: boolean
          submitted_for_approval_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitation_approvals_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      jury_assignments: {
        Row: {
          access_code: string
          created_at: string | null
          event_id: string
          id: string
          is_active: boolean | null
          is_mock: boolean
          jury_name: string
        }
        Insert: {
          access_code: string
          created_at?: string | null
          event_id: string
          id?: string
          is_active?: boolean | null
          is_mock?: boolean
          jury_name: string
        }
        Update: {
          access_code?: string
          created_at?: string | null
          event_id?: string
          id?: string
          is_active?: boolean | null
          is_mock?: boolean
          jury_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "jury_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          config: Json | null
          event_id: string
          id: string
          sent_at: string | null
          sent_to_count: number | null
          status: string | null
          template: string
        }
        Insert: {
          config?: Json | null
          event_id: string
          id?: string
          sent_at?: string | null
          sent_to_count?: number | null
          status?: string | null
          template: string
        }
        Update: {
          config?: Json | null
          event_id?: string
          id?: string
          sent_at?: string | null
          sent_to_count?: number | null
          status?: string | null
          template?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      organizer_checklist: {
        Row: {
          category: string | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          event_id: string
          id: string
          is_completed: boolean | null
          sequence_order: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          event_id: string
          id?: string
          is_completed?: boolean | null
          sequence_order?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          event_id?: string
          id?: string
          is_completed?: boolean | null
          sequence_order?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizer_checklist_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      organizer_profiles: {
        Row: {
          chapter_name: string | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean | null
          is_mock: boolean
          photo_url: string | null
          role: Database["public"]["Enums"]["yi_role"]
          title: string | null
          updated_at: string | null
          user_id: string | null
          zone: Database["public"]["Enums"]["yi_zone"] | null
        }
        Insert: {
          chapter_name?: string | null
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          is_mock?: boolean
          photo_url?: string | null
          role?: Database["public"]["Enums"]["yi_role"]
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          zone?: Database["public"]["Enums"]["yi_zone"] | null
        }
        Update: {
          chapter_name?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          is_mock?: boolean
          photo_url?: string | null
          role?: Database["public"]["Enums"]["yi_role"]
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          zone?: Database["public"]["Enums"]["yi_zone"] | null
        }
        Relationships: []
      }
      parliamentary_motions: {
        Row: {
          agenda_item_id: string | null
          created_at: string | null
          details: string | null
          directed_to_id: string | null
          directed_to_ministry:
            | Database["public"]["Enums"]["ministry_type"]
            | null
          event_id: string
          id: string
          is_mock: boolean
          minister_response: string | null
          motion_type: Database["public"]["Enums"]["motion_type"]
          outcome: string | null
          raised_at: string | null
          raised_by_id: string | null
          raised_by_name: string | null
          raised_by_party_side: Database["public"]["Enums"]["party_side"] | null
          raised_by_role: string | null
          resolution_note: string | null
          resolved_at: string | null
          ruled_at: string | null
          ruled_by: string | null
          speaker_note: string | null
          speaker_ruling: string | null
          status: Database["public"]["Enums"]["motion_status"]
          subject: string
          updated_at: string | null
          votes_abstain: number | null
          votes_against: number | null
          votes_for: number | null
        }
        Insert: {
          agenda_item_id?: string | null
          created_at?: string | null
          details?: string | null
          directed_to_id?: string | null
          directed_to_ministry?:
            | Database["public"]["Enums"]["ministry_type"]
            | null
          event_id: string
          id?: string
          is_mock?: boolean
          minister_response?: string | null
          motion_type: Database["public"]["Enums"]["motion_type"]
          outcome?: string | null
          raised_at?: string | null
          raised_by_id?: string | null
          raised_by_name?: string | null
          raised_by_party_side?:
            | Database["public"]["Enums"]["party_side"]
            | null
          raised_by_role?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          ruled_at?: string | null
          ruled_by?: string | null
          speaker_note?: string | null
          speaker_ruling?: string | null
          status?: Database["public"]["Enums"]["motion_status"]
          subject: string
          updated_at?: string | null
          votes_abstain?: number | null
          votes_against?: number | null
          votes_for?: number | null
        }
        Update: {
          agenda_item_id?: string | null
          created_at?: string | null
          details?: string | null
          directed_to_id?: string | null
          directed_to_ministry?:
            | Database["public"]["Enums"]["ministry_type"]
            | null
          event_id?: string
          id?: string
          is_mock?: boolean
          minister_response?: string | null
          motion_type?: Database["public"]["Enums"]["motion_type"]
          outcome?: string | null
          raised_at?: string | null
          raised_by_id?: string | null
          raised_by_name?: string | null
          raised_by_party_side?:
            | Database["public"]["Enums"]["party_side"]
            | null
          raised_by_role?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          ruled_at?: string | null
          ruled_by?: string | null
          speaker_note?: string | null
          speaker_ruling?: string | null
          status?: Database["public"]["Enums"]["motion_status"]
          subject?: string
          updated_at?: string | null
          votes_abstain?: number | null
          votes_against?: number | null
          votes_for?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "parliamentary_motions_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parliamentary_motions_directed_to_id_fkey"
            columns: ["directed_to_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parliamentary_motions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parliamentary_motions_raised_by_id_fkey"
            columns: ["raised_by_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_fees: {
        Row: {
          amount_inr: number
          created_at: string | null
          event_id: string
          id: string
          includes_gst: boolean | null
          is_mock: boolean
          is_paid: boolean | null
          note: string | null
          paid_at: string | null
          paid_via: string | null
          participant_id: string
          payment_link: string | null
          recorded_by: string | null
          transaction_ref: string | null
          updated_at: string | null
        }
        Insert: {
          amount_inr?: number
          created_at?: string | null
          event_id: string
          id?: string
          includes_gst?: boolean | null
          is_mock?: boolean
          is_paid?: boolean | null
          note?: string | null
          paid_at?: string | null
          paid_via?: string | null
          participant_id: string
          payment_link?: string | null
          recorded_by?: string | null
          transaction_ref?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_inr?: number
          created_at?: string | null
          event_id?: string
          id?: string
          includes_gst?: boolean | null
          is_mock?: boolean
          is_paid?: boolean | null
          note?: string | null
          paid_at?: string | null
          paid_via?: string | null
          participant_id?: string
          payment_link?: string | null
          recorded_by?: string | null
          transaction_ref?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participant_fees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_fees_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: true
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          access_code: string
          checked_in: boolean | null
          checked_in_at: string | null
          city: string | null
          class: number
          committee_name: string | null
          committee_number: number | null
          constituency_name: string | null
          constituency_state: string | null
          created_at: string | null
          email: string | null
          event_id: string
          full_name: string
          home_state: string | null
          id: string
          is_mock: boolean
          ministry: Database["public"]["Enums"]["ministry_type"] | null
          parent_phone: string | null
          parliament_role: Database["public"]["Enums"]["parliament_role"] | null
          party_id: string | null
          party_number: number | null
          party_side: Database["public"]["Enums"]["party_side"] | null
          person_id: string | null
          phone: string | null
          qualified_for_next: boolean | null
          school_id: string | null
          school_name: string
          section: string | null
          serial_no: number | null
          updated_at: string | null
        }
        Insert: {
          access_code: string
          checked_in?: boolean | null
          checked_in_at?: string | null
          city?: string | null
          class: number
          committee_name?: string | null
          committee_number?: number | null
          constituency_name?: string | null
          constituency_state?: string | null
          created_at?: string | null
          email?: string | null
          event_id: string
          full_name: string
          home_state?: string | null
          id?: string
          is_mock?: boolean
          ministry?: Database["public"]["Enums"]["ministry_type"] | null
          parent_phone?: string | null
          parliament_role?:
            | Database["public"]["Enums"]["parliament_role"]
            | null
          party_id?: string | null
          party_number?: number | null
          party_side?: Database["public"]["Enums"]["party_side"] | null
          person_id?: string | null
          phone?: string | null
          qualified_for_next?: boolean | null
          school_id?: string | null
          school_name: string
          section?: string | null
          serial_no?: number | null
          updated_at?: string | null
        }
        Update: {
          access_code?: string
          checked_in?: boolean | null
          checked_in_at?: string | null
          city?: string | null
          class?: number
          committee_name?: string | null
          committee_number?: number | null
          constituency_name?: string | null
          constituency_state?: string | null
          created_at?: string | null
          email?: string | null
          event_id?: string
          full_name?: string
          home_state?: string | null
          id?: string
          is_mock?: boolean
          ministry?: Database["public"]["Enums"]["ministry_type"] | null
          parent_phone?: string | null
          parliament_role?:
            | Database["public"]["Enums"]["parliament_role"]
            | null
          party_id?: string | null
          party_number?: number | null
          party_side?: Database["public"]["Enums"]["party_side"] | null
          person_id?: string | null
          phone?: string | null
          qualified_for_next?: boolean | null
          school_id?: string | null
          school_name?: string
          section?: string | null
          serial_no?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      parties: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          is_mock: boolean
          manifesto: Json | null
          name: string
          party_leader_id: string | null
          party_number: number
          side: Database["public"]["Enums"]["party_side"]
          symbol_url: string | null
          tagline: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          is_mock?: boolean
          manifesto?: Json | null
          name: string
          party_leader_id?: string | null
          party_number: number
          side: Database["public"]["Enums"]["party_side"]
          symbol_url?: string | null
          tagline?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          is_mock?: boolean
          manifesto?: Json | null
          name?: string
          party_leader_id?: string | null
          party_number?: number
          side?: Database["public"]["Enums"]["party_side"]
          symbol_url?: string | null
          tagline?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_parties_party_leader"
            columns: ["party_leader_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parties_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          bio: string | null
          city: string | null
          class: number | null
          created_at: string | null
          email: string | null
          full_name: string
          home_state: string | null
          id: string
          is_active: boolean | null
          is_mock: boolean
          notes: string | null
          parent_phone: string | null
          phone: string | null
          photo_url: string | null
          school_id: string | null
          school_name: string | null
          section: string | null
          updated_at: string | null
        }
        Insert: {
          bio?: string | null
          city?: string | null
          class?: number | null
          created_at?: string | null
          email?: string | null
          full_name: string
          home_state?: string | null
          id?: string
          is_active?: boolean | null
          is_mock?: boolean
          notes?: string | null
          parent_phone?: string | null
          phone?: string | null
          photo_url?: string | null
          school_id?: string | null
          school_name?: string | null
          section?: string | null
          updated_at?: string | null
        }
        Update: {
          bio?: string | null
          city?: string | null
          class?: number | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          home_state?: string | null
          id?: string
          is_active?: boolean | null
          is_mock?: boolean
          notes?: string | null
          parent_phone?: string | null
          phone?: string | null
          photo_url?: string | null
          school_id?: string | null
          school_name?: string | null
          section?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          full_name: string
          id: string
          is_mock: boolean
          promoted_at: string | null
          promoted_by: string | null
          reason: string | null
          school_name: string | null
          season_id: string | null
          source_avg_score: number | null
          source_awards: string | null
          source_event_id: string
          source_participant_id: string | null
          source_rank: number | null
          target_event_id: string
          target_participant_id: string | null
        }
        Insert: {
          full_name: string
          id?: string
          is_mock?: boolean
          promoted_at?: string | null
          promoted_by?: string | null
          reason?: string | null
          school_name?: string | null
          season_id?: string | null
          source_avg_score?: number | null
          source_awards?: string | null
          source_event_id: string
          source_participant_id?: string | null
          source_rank?: number | null
          target_event_id: string
          target_participant_id?: string | null
        }
        Update: {
          full_name?: string
          id?: string
          is_mock?: boolean
          promoted_at?: string | null
          promoted_by?: string | null
          reason?: string | null
          school_name?: string | null
          season_id?: string | null
          source_avg_score?: number | null
          source_awards?: string | null
          source_event_id?: string
          source_participant_id?: string | null
          source_rank?: number | null
          target_event_id?: string
          target_participant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promotions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_source_participant_id_fkey"
            columns: ["source_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_target_event_id_fkey"
            columns: ["target_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_target_participant_id_fkey"
            columns: ["target_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          answer_summary: string | null
          created_at: string | null
          directed_to_ministry: Database["public"]["Enums"]["ministry_type"]
          event_id: string
          filtered_by: string | null
          id: string
          is_mock: boolean
          question_text: string
          question_type: string | null
          queue_order: number | null
          status: string | null
          submitted_by: string
          updated_at: string | null
        }
        Insert: {
          answer_summary?: string | null
          created_at?: string | null
          directed_to_ministry: Database["public"]["Enums"]["ministry_type"]
          event_id: string
          filtered_by?: string | null
          id?: string
          is_mock?: boolean
          question_text: string
          question_type?: string | null
          queue_order?: number | null
          status?: string | null
          submitted_by: string
          updated_at?: string | null
        }
        Update: {
          answer_summary?: string | null
          created_at?: string | null
          directed_to_ministry?: Database["public"]["Enums"]["ministry_type"]
          event_id?: string
          filtered_by?: string | null
          id?: string
          is_mock?: boolean
          question_text?: string
          question_type?: string | null
          queue_order?: number | null
          status?: string | null
          submitted_by?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          city: string | null
          class: number | null
          created_at: string
          email: string | null
          event_id: string
          full_name: string
          home_state: string | null
          id: string
          is_mock: boolean
          parent_phone: string | null
          participant_id: string | null
          phone: string | null
          raw_payload: Json
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_name: string | null
          section: string | null
          source: Database["public"]["Enums"]["registration_source"]
          status: Database["public"]["Enums"]["registration_status"]
          submission_batch: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          class?: number | null
          created_at?: string
          email?: string | null
          event_id: string
          full_name: string
          home_state?: string | null
          id?: string
          is_mock?: boolean
          parent_phone?: string | null
          participant_id?: string | null
          phone?: string | null
          raw_payload: Json
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_name?: string | null
          section?: string | null
          source?: Database["public"]["Enums"]["registration_source"]
          status?: Database["public"]["Enums"]["registration_status"]
          submission_batch?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          class?: number | null
          created_at?: string
          email?: string | null
          event_id?: string
          full_name?: string
          home_state?: string | null
          id?: string
          is_mock?: boolean
          parent_phone?: string | null
          participant_id?: string | null
          phone?: string | null
          raw_payload?: Json
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_name?: string | null
          section?: string | null
          source?: Database["public"]["Enums"]["registration_source"]
          status?: Database["public"]["Enums"]["registration_status"]
          submission_batch?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      results: {
        Row: {
          avg_score: number | null
          award_category: string | null
          computed_at: string | null
          event_id: string
          id: string
          jury_count: number | null
          participant_id: string
          qualifies_next: boolean | null
          rank: number | null
          score_breakdown: Json | null
        }
        Insert: {
          avg_score?: number | null
          award_category?: string | null
          computed_at?: string | null
          event_id: string
          id?: string
          jury_count?: number | null
          participant_id: string
          qualifies_next?: boolean | null
          rank?: number | null
          score_breakdown?: Json | null
        }
        Update: {
          avg_score?: number | null
          award_category?: string | null
          computed_at?: string | null
          event_id?: string
          id?: string
          jury_count?: number | null
          participant_id?: string
          qualifies_next?: boolean | null
          rank?: number | null
          score_breakdown?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "results_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          city: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string | null
          id: string
          is_mock: boolean
          is_thalir: boolean | null
          name: string
          notes: string | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          city?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          is_mock?: boolean
          is_thalir?: boolean | null
          name: string
          notes?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          city?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          is_mock?: boolean
          is_thalir?: boolean | null
          name?: string
          notes?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      score_audit_log: {
        Row: {
          changed_by: string | null
          created_at: string | null
          id: string
          new_scores: Json | null
          new_total: number | null
          previous_scores: Json | null
          previous_total: number | null
          reason: string | null
          score_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_scores?: Json | null
          new_total?: number | null
          previous_scores?: Json | null
          previous_total?: number | null
          reason?: string | null
          score_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_scores?: Json | null
          new_total?: number | null
          previous_scores?: Json | null
          previous_total?: number | null
          reason?: string | null
          score_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_audit_log_score_id_fkey"
            columns: ["score_id"]
            isOneToOne: false
            referencedRelation: "scores"
            referencedColumns: ["id"]
          },
        ]
      }
      scores: {
        Row: {
          agenda_item_id: string | null
          comments: string | null
          created_at: string | null
          criteria_scores: Json
          event_id: string
          id: string
          is_mock: boolean
          jury_assignment_id: string
          participant_id: string
          rubric_id: string
          status: Database["public"]["Enums"]["score_status"] | null
          submitted_at: string | null
          total_score: number
          updated_at: string | null
        }
        Insert: {
          agenda_item_id?: string | null
          comments?: string | null
          created_at?: string | null
          criteria_scores: Json
          event_id: string
          id?: string
          is_mock?: boolean
          jury_assignment_id: string
          participant_id: string
          rubric_id: string
          status?: Database["public"]["Enums"]["score_status"] | null
          submitted_at?: string | null
          total_score: number
          updated_at?: string | null
        }
        Update: {
          agenda_item_id?: string | null
          comments?: string | null
          created_at?: string | null
          criteria_scores?: Json
          event_id?: string
          id?: string
          is_mock?: boolean
          jury_assignment_id?: string
          participant_id?: string
          rubric_id?: string
          status?: Database["public"]["Enums"]["score_status"] | null
          submitted_at?: string | null
          total_score?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scores_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_jury_assignment_id_fkey"
            columns: ["jury_assignment_id"]
            isOneToOne: false
            referencedRelation: "jury_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "scoring_rubrics"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_rubrics: {
        Row: {
          created_at: string | null
          criteria: Json
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          target_role: Database["public"]["Enums"]["parliament_role"]
          total_max: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          criteria: Json
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          target_role: Database["public"]["Enums"]["parliament_role"]
          total_max?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          criteria?: Json
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          target_role?: Database["public"]["Enums"]["parliament_role"]
          total_max?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      seasons: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          is_mock: boolean
          name: string
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_mock?: boolean
          name: string
          updated_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_mock?: boolean
          name?: string
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      topics: {
        Row: {
          category: Database["public"]["Enums"]["topic_category"]
          created_at: string | null
          description: string | null
          handbook_page: number | null
          id: string
          is_active: boolean | null
          sub_points: Json | null
          title: string
          topic_number: number | null
          zone: Database["public"]["Enums"]["yi_zone"] | null
        }
        Insert: {
          category: Database["public"]["Enums"]["topic_category"]
          created_at?: string | null
          description?: string | null
          handbook_page?: number | null
          id?: string
          is_active?: boolean | null
          sub_points?: Json | null
          title: string
          topic_number?: number | null
          zone?: Database["public"]["Enums"]["yi_zone"] | null
        }
        Update: {
          category?: Database["public"]["Enums"]["topic_category"]
          created_at?: string | null
          description?: string | null
          handbook_page?: number | null
          id?: string
          is_active?: boolean | null
          sub_points?: Json | null
          title?: string
          topic_number?: number | null
          zone?: Database["public"]["Enums"]["yi_zone"] | null
        }
        Relationships: []
      }
      volunteers: {
        Row: {
          arrived: boolean | null
          arrived_at: string | null
          created_at: string | null
          email: string | null
          event_id: string
          full_name: string
          id: string
          is_mock: boolean
          is_yuva: boolean | null
          notes: string | null
          phone: string | null
          shift: string | null
          station: Database["public"]["Enums"]["volunteer_station"] | null
          tshirt_size: string | null
          updated_at: string | null
        }
        Insert: {
          arrived?: boolean | null
          arrived_at?: string | null
          created_at?: string | null
          email?: string | null
          event_id: string
          full_name: string
          id?: string
          is_mock?: boolean
          is_yuva?: boolean | null
          notes?: string | null
          phone?: string | null
          shift?: string | null
          station?: Database["public"]["Enums"]["volunteer_station"] | null
          tshirt_size?: string | null
          updated_at?: string | null
        }
        Update: {
          arrived?: boolean | null
          arrived_at?: string | null
          created_at?: string | null
          email?: string | null
          event_id?: string
          full_name?: string
          id?: string
          is_mock?: boolean
          is_yuva?: boolean | null
          notes?: string | null
          phone?: string | null
          shift?: string | null
          station?: Database["public"]["Enums"]["volunteer_station"] | null
          tshirt_size?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "volunteers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      vote_sessions: {
        Row: {
          agenda_item_id: string
          bill_id: string | null
          closed_at: string | null
          config: Json | null
          event_id: string
          id: string
          opened_at: string | null
          revealed_at: string | null
          status: string | null
          vote_type: string
        }
        Insert: {
          agenda_item_id: string
          bill_id?: string | null
          closed_at?: string | null
          config?: Json | null
          event_id: string
          id?: string
          opened_at?: string | null
          revealed_at?: string | null
          status?: string | null
          vote_type: string
        }
        Update: {
          agenda_item_id?: string
          bill_id?: string | null
          closed_at?: string | null
          config?: Json | null
          event_id?: string
          id?: string
          opened_at?: string | null
          revealed_at?: string | null
          status?: string | null
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "vote_sessions_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vote_sessions_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vote_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          agenda_item_id: string
          cast_at: string | null
          event_id: string
          id: string
          participant_id: string
          vote_type: string
          vote_value: string
        }
        Insert: {
          agenda_item_id: string
          cast_at?: string | null
          event_id: string
          id?: string
          participant_id: string
          vote_type: string
          vote_value: string
        }
        Update: {
          agenda_item_id?: string
          cast_at?: string | null
          event_id?: string
          id?: string
          participant_id?: string
          vote_type?: string
          vote_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      agenda_mode: "party" | "committee" | "mixed"
      agenda_status: "upcoming" | "in_progress" | "completed" | "skipped"
      compliance_status:
        | "not_checked"
        | "pending_evidence"
        | "verified"
        | "violation"
        | "waived"
      event_level: "chapter" | "regional" | "national"
      event_status:
        | "draft"
        | "registration_open"
        | "registration_closed"
        | "day1_live"
        | "day1_complete"
        | "day2_live"
        | "completed"
        | "results_published"
      feedback_respondent: "participant" | "organizer" | "volunteer" | "jury"
      media_kind: "photo" | "video" | "document"
      media_visibility: "public" | "yi_internal" | "organizer_only"
      ministry_type:
        | "home"
        | "finance"
        | "education"
        | "health"
        | "women_child"
        | "disaster_management"
        | "youth_sports"
        | "it_digital"
      motion_status:
        | "submitted"
        | "admitted"
        | "rejected"
        | "discussing"
        | "voting"
        | "resolved"
        | "deferred"
      motion_type:
        | "adjournment"
        | "calling_attention"
        | "breach_of_privilege"
        | "no_confidence"
        | "short_duration"
        | "obituary"
        | "laying_of_papers"
      parliament_role:
        | "speaker"
        | "deputy_speaker"
        | "prime_minister"
        | "leader_of_opposition"
        | "cabinet_minister"
        | "shadow_minister"
        | "bill_committee"
        | "mp"
        | "deputy_prime_minister"
        | "party_leader"
        | "independent_mp"
      party_side: "ruling" | "opposition"
      registration_source:
        | "microsoft_forms"
        | "platform_direct"
        | "csv_upload"
        | "manual"
      registration_status: "pending" | "approved" | "rejected" | "duplicate"
      score_status: "draft" | "submitted" | "locked"
      topic_category: "central" | "regional"
      volunteer_station:
        | "registration"
        | "help_desk"
        | "av_tech"
        | "room_coordinator"
        | "hospitality"
        | "stage_manager"
        | "photographer"
        | "media"
        | "runner"
        | "safety"
        | "floating"
      yi_role: "national" | "rm" | "chapter_em"
      yi_zone: "ER" | "WR" | "NR" | "NER" | "SRTN" | "SRTKKA"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  yi: {
    Tables: {
      chapters: {
        Row: {
          chair_email: string | null
          chair_mobile: string | null
          chair_name: string | null
          city: string
          created_at: string | null
          finale_region: string | null
          id: string
          is_active: boolean | null
          is_finale_host: boolean
          logo_url: string | null
          name: string
          programme_duration_days: number
          region: string | null
          state: string | null
          yi_chapter_id: string | null
        }
        Insert: {
          chair_email?: string | null
          chair_mobile?: string | null
          chair_name?: string | null
          city: string
          created_at?: string | null
          finale_region?: string | null
          id?: string
          is_active?: boolean | null
          is_finale_host?: boolean
          logo_url?: string | null
          name: string
          programme_duration_days?: number
          region?: string | null
          state?: string | null
          yi_chapter_id?: string | null
        }
        Update: {
          chair_email?: string | null
          chair_mobile?: string | null
          chair_name?: string | null
          city?: string
          created_at?: string | null
          finale_region?: string | null
          id?: string
          is_active?: boolean | null
          is_finale_host?: boolean
          logo_url?: string | null
          name?: string
          programme_duration_days?: number
          region?: string | null
          state?: string | null
          yi_chapter_id?: string | null
        }
        Relationships: []
      }
      government_contact_log: {
        Row: {
          contact_date: string
          contact_type: string | null
          created_at: string | null
          id: string
          logged_by: string | null
          next_step: string | null
          partnership_id: string
          summary: string
        }
        Insert: {
          contact_date: string
          contact_type?: string | null
          created_at?: string | null
          id?: string
          logged_by?: string | null
          next_step?: string | null
          partnership_id: string
          summary: string
        }
        Update: {
          contact_date?: string
          contact_type?: string | null
          created_at?: string | null
          id?: string
          logged_by?: string | null
          next_step?: string | null
          partnership_id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "government_contact_log_partnership_id_fkey"
            columns: ["partnership_id"]
            isOneToOne: false
            referencedRelation: "government_partnerships"
            referencedColumns: ["id"]
          },
        ]
      }
      government_partnerships: {
        Row: {
          created_at: string | null
          id: string
          mou_signed: boolean | null
          mou_signed_date: string | null
          mou_url: string | null
          notes: string | null
          official_email: string | null
          official_name: string | null
          official_phone: string | null
          official_title: string | null
          org_name: string
          org_type: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          mou_signed?: boolean | null
          mou_signed_date?: string | null
          mou_url?: string | null
          notes?: string | null
          official_email?: string | null
          official_name?: string | null
          official_phone?: string | null
          official_title?: string | null
          org_name: string
          org_type?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          mou_signed?: boolean | null
          mou_signed_date?: string | null
          mou_url?: string | null
          notes?: string | null
          official_email?: string | null
          official_name?: string | null
          official_phone?: string | null
          official_title?: string | null
          org_name?: string
          org_type?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      national_admins: {
        Row: {
          added_at: string
          added_by: string | null
          email: string
          is_platform_admin: boolean
          is_super_admin: boolean
          note: string | null
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          email: string
          is_platform_admin?: boolean
          is_super_admin?: boolean
          note?: string | null
        }
        Update: {
          added_at?: string
          added_by?: string | null
          email?: string
          is_platform_admin?: boolean
          is_super_admin?: boolean
          note?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  future: {
    Enums: {
      award_category: [
        "track_champion",
        "best_policy_framework",
        "most_scalable",
        "best_implementation",
        "jury_special_mention",
        "chapter_local_award",
      ],
      chapter_final_section: [
        "opening",
        "team_presentations",
        "jury_qa",
        "govt_industry",
        "announcement",
      ],
      consent_status: ["pending", "uploaded", "approved", "rejected"],
      deliverable_phase: ["phase_a", "phase_b", "phase_c"],
      edition_stage: [
        "announcement",
        "registration_open",
        "teams_formed",
        "phase_a_active",
        "phase_a_complete",
        "phase_b_active",
        "phase_b_complete",
        "phase_c_active",
        "phase_c_complete",
        "chapter_final_scheduled",
        "chapter_final_live",
        "chapter_final_scored",
        "shortlist_published",
        "consent_collection",
        "national_day_1",
        "national_day_2",
        "awards_announced",
        "post_event_deliverables",
        "whitepaper_published",
        "completed",
      ],
      evaluation_status: ["draft", "submitted"],
      event_type: ["chapter_final", "national_track_final"],
      interview_outcome: [
        "offered",
        "shortlisted",
        "followup",
        "no_fit",
        "no_show",
      ],
      jury_archetype: ["policy", "industry", "senior_yi", "academic"],
      national_day1_section: [
        "opening",
        "keynote",
        "masterclass",
        "townhall",
        "networking",
      ],
      national_day2_section: [
        "semi_final",
        "grand_final",
        "opportunity_interviews",
        "recognition",
      ],
      phase: ["phase_a", "phase_b", "phase_c"],
      phase_event_type: [
        "orientation",
        "policy_workshop",
        "expert_talk",
        "mentorship_clinic",
        "execution_planning",
        "midpoint_review",
        "refinement_workshop",
        "mock_jury",
        "doc_support",
      ],
      submission_status: ["draft", "submitted", "approved", "rejected"],
      track_host_role: ["participating", "host"],
      user_role: [
        "delegate",
        "captain",
        "mentor",
        "expert",
        "jury_chapter",
        "jury_national",
        "chapter_event_lead",
        "college_outreach_lead",
        "mentorship_content_lead",
        "ops_documentation_lead",
        "host_admin",
        "national_admin",
        "corporate_partner",
        "chapter_chair",
      ],
    },
  },
  public: {
    Enums: {
      agenda_mode: ["party", "committee", "mixed"],
      agenda_status: ["upcoming", "in_progress", "completed", "skipped"],
      compliance_status: [
        "not_checked",
        "pending_evidence",
        "verified",
        "violation",
        "waived",
      ],
      event_level: ["chapter", "regional", "national"],
      event_status: [
        "draft",
        "registration_open",
        "registration_closed",
        "day1_live",
        "day1_complete",
        "day2_live",
        "completed",
        "results_published",
      ],
      feedback_respondent: ["participant", "organizer", "volunteer", "jury"],
      media_kind: ["photo", "video", "document"],
      media_visibility: ["public", "yi_internal", "organizer_only"],
      ministry_type: [
        "home",
        "finance",
        "education",
        "health",
        "women_child",
        "disaster_management",
        "youth_sports",
        "it_digital",
      ],
      motion_status: [
        "submitted",
        "admitted",
        "rejected",
        "discussing",
        "voting",
        "resolved",
        "deferred",
      ],
      motion_type: [
        "adjournment",
        "calling_attention",
        "breach_of_privilege",
        "no_confidence",
        "short_duration",
        "obituary",
        "laying_of_papers",
      ],
      parliament_role: [
        "speaker",
        "deputy_speaker",
        "prime_minister",
        "leader_of_opposition",
        "cabinet_minister",
        "shadow_minister",
        "bill_committee",
        "mp",
        "deputy_prime_minister",
        "party_leader",
        "independent_mp",
      ],
      party_side: ["ruling", "opposition"],
      registration_source: [
        "microsoft_forms",
        "platform_direct",
        "csv_upload",
        "manual",
      ],
      registration_status: ["pending", "approved", "rejected", "duplicate"],
      score_status: ["draft", "submitted", "locked"],
      topic_category: ["central", "regional"],
      volunteer_station: [
        "registration",
        "help_desk",
        "av_tech",
        "room_coordinator",
        "hospitality",
        "stage_manager",
        "photographer",
        "media",
        "runner",
        "safety",
        "floating",
      ],
      yi_role: ["national", "rm", "chapter_em"],
      yi_zone: ["ER", "WR", "NR", "NER", "SRTN", "SRTKKA"],
    },
  },
  yi: {
    Enums: {},
  },
} as const
