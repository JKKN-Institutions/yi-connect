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
} as const
