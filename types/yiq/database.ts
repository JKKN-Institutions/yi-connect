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
    PostgrestVersion: "14.17"
  }
  yi: {
    Tables: {
      brand_rules: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          handbook_page: number | null
          id: string
          is_active: boolean | null
          requires_evidence: boolean | null
          rule_key: string
          severity: string | null
          sort_order: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          handbook_page?: number | null
          id?: string
          is_active?: boolean | null
          requires_evidence?: boolean | null
          rule_key: string
          severity?: string | null
          sort_order?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          handbook_page?: number | null
          id?: string
          is_active?: boolean | null
          requires_evidence?: boolean | null
          rule_key?: string
          severity?: string | null
          sort_order?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      chapters: {
        Row: {
          chair_email: string | null
          chair_mobile: string | null
          chair_name: string | null
          city: string
          created_at: string | null
          finale_end_date: string | null
          finale_region: string | null
          finale_start_date: string | null
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
          finale_end_date?: string | null
          finale_region?: string | null
          finale_start_date?: string | null
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
          finale_end_date?: string | null
          finale_region?: string | null
          finale_start_date?: string | null
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
      institutions: {
        Row: {
          address: string | null
          city: string | null
          created_at: string | null
          email: string | null
          has_yuva_chapter: boolean | null
          id: string
          is_active: boolean | null
          is_thalir: boolean | null
          name: string
          notes: string | null
          phone: string | null
          pincode: string | null
          source_future_college_id: string | null
          source_yi_connect_college_id: string | null
          source_yi_connect_school_id: string | null
          state: string | null
          type: Database["yi"]["Enums"]["institution_type"]
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          has_yuva_chapter?: boolean | null
          id?: string
          is_active?: boolean | null
          is_thalir?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          pincode?: string | null
          source_future_college_id?: string | null
          source_yi_connect_college_id?: string | null
          source_yi_connect_school_id?: string | null
          state?: string | null
          type: Database["yi"]["Enums"]["institution_type"]
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          has_yuva_chapter?: boolean | null
          id?: string
          is_active?: boolean | null
          is_thalir?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          pincode?: string | null
          source_future_college_id?: string | null
          source_yi_connect_college_id?: string | null
          source_yi_connect_school_id?: string | null
          state?: string | null
          type?: Database["yi"]["Enums"]["institution_type"]
          updated_at?: string | null
          website?: string | null
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
      years: {
        Row: {
          created_at: string | null
          display_name: string
          ended_at: string | null
          id: string
          is_active: boolean | null
          is_mock: boolean
          started_at: string | null
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          display_name: string
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          is_mock?: boolean
          started_at?: string | null
          updated_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          display_name?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          is_mock?: boolean
          started_at?: string | null
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      zones: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          is_active: boolean | null
          name: string
          parent_code: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          is_active?: boolean | null
          name: string
          parent_code?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          is_active?: boolean | null
          name?: string
          parent_code?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zones_parent_code_fkey"
            columns: ["parent_code"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["code"]
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
      institution_type: "school" | "higher_secondary" | "college" | "university"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  yiq: {
    Tables: {
      ai_jobs: {
        Row: {
          attempts: number
          chapter_event_id: string | null
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          edition_id: string | null
          error_text: string | null
          id: string
          kind: string
          payload: Json
          result: Json | null
          status: string
          subject_id: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          chapter_event_id?: string | null
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          edition_id?: string | null
          error_text?: string | null
          id?: string
          kind: string
          payload?: Json
          result?: Json | null
          status?: string
          subject_id?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          chapter_event_id?: string | null
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          edition_id?: string | null
          error_text?: string | null
          id?: string
          kind?: string
          payload?: Json
          result?: Json | null
          status?: string
          subject_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_jobs_chapter_event_id_fkey"
            columns: ["chapter_event_id"]
            isOneToOne: false
            referencedRelation: "chapter_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_jobs_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
        ]
      }
      attempt_answers: {
        Row: {
          answered_at: string
          attempt_id: string
          id: string
          is_correct: boolean | null
          is_flagged: boolean
          marks_awarded: number
          question_id: string
          selected_option: string | null
        }
        Insert: {
          answered_at?: string
          attempt_id: string
          id?: string
          is_correct?: boolean | null
          is_flagged?: boolean
          marks_awarded?: number
          question_id: string
          selected_option?: string | null
        }
        Update: {
          answered_at?: string
          attempt_id?: string
          id?: string
          is_correct?: boolean | null
          is_flagged?: boolean
          marks_awarded?: number
          question_id?: string
          selected_option?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attempt_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      attempt_restarts: {
        Row: {
          attempt_id: string
          chapter_event_id: string | null
          consumed_at: string | null
          created_at: string
          granted_at: string
          granted_by_label: string | null
          granted_by_user_id: string | null
          granted_ms: number
          id: string
          new_expires_at: string | null
          new_started_at: string | null
          reason: string
          student_id: string
          updated_at: string
        }
        Insert: {
          attempt_id: string
          chapter_event_id?: string | null
          consumed_at?: string | null
          created_at?: string
          granted_at?: string
          granted_by_label?: string | null
          granted_by_user_id?: string | null
          granted_ms: number
          id?: string
          new_expires_at?: string | null
          new_started_at?: string | null
          reason: string
          student_id: string
          updated_at?: string
        }
        Update: {
          attempt_id?: string
          chapter_event_id?: string | null
          consumed_at?: string | null
          created_at?: string
          granted_at?: string
          granted_by_label?: string | null
          granted_by_user_id?: string | null
          granted_ms?: number
          id?: string
          new_expires_at?: string | null
          new_started_at?: string | null
          reason?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempt_restarts_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_restarts_chapter_event_id_fkey"
            columns: ["chapter_event_id"]
            isOneToOne: false
            referencedRelation: "chapter_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_restarts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attempts: {
        Row: {
          chapter_event_id: string | null
          correct_count: number
          created_at: string
          disqualified_reason: string | null
          expires_at: string
          id: string
          ip_address: string | null
          is_mock: boolean
          paper_id: string
          question_order: string[]
          score: number
          started_at: string
          status: string
          student_id: string
          submitted_at: string | null
          team_id: string
          time_taken_seconds: number | null
          unanswered_count: number
          updated_at: string
          user_agent: string | null
          wrong_count: number
        }
        Insert: {
          chapter_event_id?: string | null
          correct_count?: number
          created_at?: string
          disqualified_reason?: string | null
          expires_at: string
          id?: string
          ip_address?: string | null
          is_mock?: boolean
          paper_id: string
          question_order?: string[]
          score?: number
          started_at?: string
          status?: string
          student_id: string
          submitted_at?: string | null
          team_id: string
          time_taken_seconds?: number | null
          unanswered_count?: number
          updated_at?: string
          user_agent?: string | null
          wrong_count?: number
        }
        Update: {
          chapter_event_id?: string | null
          correct_count?: number
          created_at?: string
          disqualified_reason?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          is_mock?: boolean
          paper_id?: string
          question_order?: string[]
          score?: number
          started_at?: string
          status?: string
          student_id?: string
          submitted_at?: string | null
          team_id?: string
          time_taken_seconds?: number | null
          unanswered_count?: number
          updated_at?: string
          user_agent?: string | null
          wrong_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "attempts_chapter_event_id_fkey"
            columns: ["chapter_event_id"]
            isOneToOne: false
            referencedRelation: "chapter_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_label: string | null
          actor_user_id: string | null
          chapter_event_id: string | null
          created_at: string
          detail: Json | null
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_label?: string | null
          actor_user_id?: string | null
          chapter_event_id?: string | null
          created_at?: string
          detail?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_label?: string | null
          actor_user_id?: string | null
          chapter_event_id?: string | null
          created_at?: string
          detail?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      chapter_events: {
        Row: {
          best_quizzer_junior_student_id: string | null
          best_quizzer_senior_student_id: string | null
          champion_team_junior_id: string | null
          champion_team_senior_id: string | null
          chapter_name: string
          created_at: string
          created_by: string | null
          edition_id: string
          finals_date: string | null
          finals_venue: string | null
          id: string
          online_round_closes_at: string | null
          online_round_opens_at: string | null
          qualifying_team_count: number
          registration_closes_at: string | null
          registration_opens_at: string | null
          results_published_at: string | null
          status: string
          updated_at: string
          yi_zone: string | null
        }
        Insert: {
          best_quizzer_junior_student_id?: string | null
          best_quizzer_senior_student_id?: string | null
          champion_team_junior_id?: string | null
          champion_team_senior_id?: string | null
          chapter_name: string
          created_at?: string
          created_by?: string | null
          edition_id: string
          finals_date?: string | null
          finals_venue?: string | null
          id?: string
          online_round_closes_at?: string | null
          online_round_opens_at?: string | null
          qualifying_team_count?: number
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          results_published_at?: string | null
          status?: string
          updated_at?: string
          yi_zone?: string | null
        }
        Update: {
          best_quizzer_junior_student_id?: string | null
          best_quizzer_senior_student_id?: string | null
          champion_team_junior_id?: string | null
          champion_team_senior_id?: string | null
          chapter_name?: string
          created_at?: string
          created_by?: string | null
          edition_id?: string
          finals_date?: string | null
          finals_venue?: string | null
          id?: string
          online_round_closes_at?: string | null
          online_round_opens_at?: string | null
          qualifying_team_count?: number
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          results_published_at?: string | null
          status?: string
          updated_at?: string
          yi_zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chapter_events_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
        ]
      }
      editions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          national_finale_at: string | null
          national_semifinal_at: string | null
          online_round_closes_at: string | null
          online_round_opens_at: string | null
          registration_closes_at: string | null
          registration_opens_at: string | null
          slug: string
          updated_at: string
          yi_year: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          national_finale_at?: string | null
          national_semifinal_at?: string | null
          online_round_closes_at?: string | null
          online_round_opens_at?: string | null
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          slug: string
          updated_at?: string
          yi_year: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          national_finale_at?: string | null
          national_semifinal_at?: string | null
          online_round_closes_at?: string | null
          online_round_opens_at?: string | null
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          slug?: string
          updated_at?: string
          yi_year?: number
        }
        Relationships: []
      }
      email_queue: {
        Row: {
          attempts: number
          chapter_event_id: string | null
          claimed_at: string | null
          created_at: string
          dedupe_key: string
          id: string
          kind: string
          last_error: string | null
          payload: Json
          recipient: string
          recipient_name: string | null
          sent_at: string | null
          status: string
          student_id: string | null
          subject: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          chapter_event_id?: string | null
          claimed_at?: string | null
          created_at?: string
          dedupe_key: string
          id?: string
          kind: string
          last_error?: string | null
          payload?: Json
          recipient: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
          student_id?: string | null
          subject: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          chapter_event_id?: string | null
          claimed_at?: string | null
          created_at?: string
          dedupe_key?: string
          id?: string
          kind?: string
          last_error?: string | null
          payload?: Json
          recipient?: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
          student_id?: string | null
          subject?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_chapter_event_id_fkey"
            columns: ["chapter_event_id"]
            isOneToOne: false
            referencedRelation: "chapter_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      finals_round_questions: {
        Row: {
          asked_at: string | null
          assigned_team_id: string | null
          created_at: string
          display_order: number
          finals_round_id: string
          id: string
          question_id: string
        }
        Insert: {
          asked_at?: string | null
          assigned_team_id?: string | null
          created_at?: string
          display_order?: number
          finals_round_id: string
          id?: string
          question_id: string
        }
        Update: {
          asked_at?: string | null
          assigned_team_id?: string | null
          created_at?: string
          display_order?: number
          finals_round_id?: string
          id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finals_round_questions_assigned_team_id_fkey"
            columns: ["assigned_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finals_round_questions_finals_round_id_fkey"
            columns: ["finals_round_id"]
            isOneToOne: false
            referencedRelation: "finals_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finals_round_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      finals_rounds: {
        Row: {
          category: string
          chapter_event_id: string | null
          created_at: string
          display_order: number
          edition_id: string | null
          id: string
          name: string
          points_correct: number
          points_pass_bonus: number
          points_wrong: number
          questions_per_team: number
          round_number: number
          round_type: string
          stage: string
          status: string
          time_limit_seconds: number | null
          updated_at: string
        }
        Insert: {
          category: string
          chapter_event_id?: string | null
          created_at?: string
          display_order?: number
          edition_id?: string | null
          id?: string
          name: string
          points_correct?: number
          points_pass_bonus?: number
          points_wrong?: number
          questions_per_team?: number
          round_number: number
          round_type: string
          stage?: string
          status?: string
          time_limit_seconds?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          chapter_event_id?: string | null
          created_at?: string
          display_order?: number
          edition_id?: string | null
          id?: string
          name?: string
          points_correct?: number
          points_pass_bonus?: number
          points_wrong?: number
          questions_per_team?: number
          round_number?: number
          round_type?: string
          stage?: string
          status?: string
          time_limit_seconds?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finals_rounds_chapter_event_id_fkey"
            columns: ["chapter_event_id"]
            isOneToOne: false
            referencedRelation: "chapter_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finals_rounds_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
        ]
      }
      finals_scores: {
        Row: {
          created_at: string
          finals_round_id: string
          id: string
          outcome: string
          points: number
          question_id: string | null
          recorded_by: string | null
          sequence_no: number
          team_id: string
        }
        Insert: {
          created_at?: string
          finals_round_id: string
          id?: string
          outcome?: string
          points?: number
          question_id?: string | null
          recorded_by?: string | null
          sequence_no?: number
          team_id: string
        }
        Update: {
          created_at?: string
          finals_round_id?: string
          id?: string
          outcome?: string
          points?: number
          question_id?: string | null
          recorded_by?: string | null
          sequence_no?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finals_scores_finals_round_id_fkey"
            columns: ["finals_round_id"]
            isOneToOne: false
            referencedRelation: "finals_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finals_scores_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finals_scores_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      national_entries: {
        Row: {
          category: string
          chapter_name: string
          created_at: string
          edition_id: string
          finale_rank: number | null
          finale_score: number | null
          id: string
          quarterfinal_rank: number | null
          quarterfinal_score: number | null
          semifinal_rank: number | null
          semifinal_score: number | null
          status: string
          team_id: string
          updated_at: string
        }
        Insert: {
          category: string
          chapter_name: string
          created_at?: string
          edition_id: string
          finale_rank?: number | null
          finale_score?: number | null
          id?: string
          quarterfinal_rank?: number | null
          quarterfinal_score?: number | null
          semifinal_rank?: number | null
          semifinal_score?: number | null
          status?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          chapter_name?: string
          created_at?: string
          edition_id?: string
          finale_rank?: number | null
          finale_score?: number | null
          id?: string
          quarterfinal_rank?: number | null
          quarterfinal_score?: number | null
          semifinal_rank?: number | null
          semifinal_score?: number | null
          status?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "national_entries_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "national_entries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      paper_questions: {
        Row: {
          created_at: string
          display_order: number
          id: string
          marks: number | null
          paper_id: string
          question_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          marks?: number | null
          paper_id: string
          question_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          marks?: number | null
          paper_id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paper_questions_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paper_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      papers: {
        Row: {
          category: string
          chapter_event_id: string | null
          created_at: string
          created_by: string | null
          duration_minutes: number
          edition_id: string
          id: string
          instructions: string | null
          is_published: boolean
          marks_per_question: number
          name: string
          negative_marks: number
          paper_kind: string
          published_at: string | null
          shuffle_options: boolean
          shuffle_questions: boolean
          total_questions: number
          updated_at: string
        }
        Insert: {
          category: string
          chapter_event_id?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          edition_id: string
          id?: string
          instructions?: string | null
          is_published?: boolean
          marks_per_question?: number
          name: string
          negative_marks?: number
          paper_kind?: string
          published_at?: string | null
          shuffle_options?: boolean
          shuffle_questions?: boolean
          total_questions?: number
          updated_at?: string
        }
        Update: {
          category?: string
          chapter_event_id?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          edition_id?: string
          id?: string
          instructions?: string | null
          is_published?: boolean
          marks_per_question?: number
          name?: string
          negative_marks?: number
          paper_kind?: string
          published_at?: string | null
          shuffle_options?: boolean
          shuffle_questions?: boolean
          total_questions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "papers_chapter_event_id_fkey"
            columns: ["chapter_event_id"]
            isOneToOne: false
            referencedRelation: "chapter_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "papers_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          answer_explanation: string | null
          category: string
          correct_answer_text: string | null
          correct_option: string | null
          created_at: string
          created_by: string | null
          difficulty: string
          generated_for_student_id: string | null
          id: string
          is_active: boolean
          is_ai_generated: boolean
          is_retired: boolean
          media_credit: string | null
          media_url: string | null
          option_a: string | null
          option_b: string | null
          option_c: string | null
          option_d: string | null
          pool: string
          question_text: string
          question_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          source: string | null
          times_used: number
          topic_id: string
          updated_at: string
        }
        Insert: {
          answer_explanation?: string | null
          category?: string
          correct_answer_text?: string | null
          correct_option?: string | null
          created_at?: string
          created_by?: string | null
          difficulty?: string
          generated_for_student_id?: string | null
          id?: string
          is_active?: boolean
          is_ai_generated?: boolean
          is_retired?: boolean
          media_credit?: string | null
          media_url?: string | null
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          pool?: string
          question_text: string
          question_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string | null
          times_used?: number
          topic_id: string
          updated_at?: string
        }
        Update: {
          answer_explanation?: string | null
          category?: string
          correct_answer_text?: string | null
          correct_option?: string | null
          created_at?: string
          created_by?: string | null
          difficulty?: string
          generated_for_student_id?: string | null
          id?: string
          is_active?: boolean
          is_ai_generated?: boolean
          is_retired?: boolean
          media_credit?: string | null
          media_url?: string | null
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          pool?: string
          question_text?: string
          question_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string | null
          times_used?: number
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          board: string | null
          chapter_name: string
          city: string | null
          contact_email: string
          contact_person: string
          contact_phone: string
          created_at: string
          district: string | null
          edition_id: string
          id: string
          is_verified: boolean
          name: string
          notes: string | null
          pincode: string | null
          principal_name: string | null
          registered_ip: string | null
          school_type: string
          state: string | null
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          board?: string | null
          chapter_name: string
          city?: string | null
          contact_email: string
          contact_person: string
          contact_phone: string
          created_at?: string
          district?: string | null
          edition_id: string
          id?: string
          is_verified?: boolean
          name: string
          notes?: string | null
          pincode?: string | null
          principal_name?: string | null
          registered_ip?: string | null
          school_type?: string
          state?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          board?: string | null
          chapter_name?: string
          city?: string | null
          contact_email?: string
          contact_person?: string
          contact_phone?: string
          created_at?: string
          district?: string | null
          edition_id?: string
          id?: string
          is_verified?: boolean
          name?: string
          notes?: string | null
          pincode?: string | null
          principal_name?: string | null
          registered_ip?: string | null
          school_type?: string
          state?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schools_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          access_code: string
          class_level: number
          created_at: string
          email: string | null
          full_name: string
          gender: string | null
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          is_active: boolean
          is_captain: boolean
          phone: string | null
          section: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          access_code: string
          class_level: number
          created_at?: string
          email?: string | null
          full_name: string
          gender?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          is_active?: boolean
          is_captain?: boolean
          phone?: string | null
          section?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          access_code?: string
          class_level?: number
          created_at?: string
          email?: string | null
          full_name?: string
          gender?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          is_active?: boolean
          is_captain?: boolean
          phone?: string | null
          section?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          advanced_to_national: boolean
          category: string
          chapter_event_id: string
          created_at: string
          disqualified_at: string | null
          disqualified_by: string | null
          disqualified_reason: string | null
          finals_rank: number | null
          finals_total_score: number | null
          id: string
          name: string
          online_eliminated_reason: string | null
          online_members_attempted: number
          online_rank: number | null
          online_score: number | null
          online_total_score: number | null
          registered_ip: string | null
          registered_user_agent: string | null
          school_id: string
          status: string
          status_before_disqualification: string | null
          team_code: string
          updated_at: string
        }
        Insert: {
          advanced_to_national?: boolean
          category: string
          chapter_event_id: string
          created_at?: string
          disqualified_at?: string | null
          disqualified_by?: string | null
          disqualified_reason?: string | null
          finals_rank?: number | null
          finals_total_score?: number | null
          id?: string
          name: string
          online_eliminated_reason?: string | null
          online_members_attempted?: number
          online_rank?: number | null
          online_score?: number | null
          online_total_score?: number | null
          registered_ip?: string | null
          registered_user_agent?: string | null
          school_id: string
          status?: string
          status_before_disqualification?: string | null
          team_code: string
          updated_at?: string
        }
        Update: {
          advanced_to_national?: boolean
          category?: string
          chapter_event_id?: string
          created_at?: string
          disqualified_at?: string | null
          disqualified_by?: string | null
          disqualified_reason?: string | null
          finals_rank?: number | null
          finals_total_score?: number | null
          id?: string
          name?: string
          online_eliminated_reason?: string | null
          online_members_attempted?: number
          online_rank?: number | null
          online_score?: number | null
          online_total_score?: number | null
          registered_ip?: string | null
          registered_user_agent?: string | null
          school_id?: string
          status?: string
          status_before_disqualification?: string | null
          team_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_chapter_event_id_fkey"
            columns: ["chapter_event_id"]
            isOneToOne: false
            referencedRelation: "chapter_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      attempt_last_answered: {
        Args: { p_attempt_ids: string[] }
        Returns: {
          attempt_id: string
          last_answered_at: string
        }[]
      }
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
  yi: {
    Enums: {
      institution_type: ["school", "higher_secondary", "college", "university"],
    },
  },
  yiq: {
    Enums: {},
  },
} as const
