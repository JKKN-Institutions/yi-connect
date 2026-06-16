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
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bulk_calculate_cycle_eligibility: {
        Args: { p_cycle_id: string }
        Returns: number
      }
      calculate_member_eligibility: {
        Args: { p_member_id: string; p_position_id: string }
        Returns: {
          breakdown: Json
          is_eligible: boolean
          total_score: number
        }[]
      }
      get_user_roles: {
        Args: { p_user_id: string }
        Returns: {
          hierarchy_level: number
          permissions: string[]
          role_id: string
          role_name: string
        }[]
      }
      merge_directory_people: {
        Args: {
          p_prefer_source_auth?: boolean
          p_source: string
          p_target: string
        }
        Returns: Json
      }
      yifi_admin_census_summary: {
        Args: { p_edition_id: string }
        Returns: Json
      }
      yifi_admin_list_dossiers: {
        Args: { p_edition_id: string }
        Returns: Json
      }
      yifi_admin_list_matches: { Args: { p_edition_id: string }; Returns: Json }
      yifi_admin_list_registrants: {
        Args: { p_edition_id: string }
        Returns: Json
      }
      yifi_admin_list_vows: { Args: { p_edition_id: string }; Returns: Json }
      yifi_admin_toggle_checkin: {
        Args: { p_checked_in: boolean; p_registrant_id: string }
        Returns: Json
      }
      yifi_admin_update_match: {
        Args: {
          p_match_id: string
          p_slot_time: string
          p_table_number: number
        }
        Returns: Json
      }
      yifi_admin_update_vow: {
        Args: {
          p_tile_engraved: boolean
          p_tile_placed: boolean
          p_vow_id: string
        }
        Returns: Json
      }
      yifi_check_organiser: {
        Args: { p_edition_id: string; p_email: string }
        Returns: Json
      }
      yifi_create_vow: {
        Args: {
          p_category: string
          p_edition_id: string
          p_registrant_id: string
          p_vow_text: string
        }
        Returns: Json
      }
      yifi_current_edition: { Args: never; Returns: Json }
      yifi_find_by_email: { Args: { p_email: string }; Returns: Json }
      yifi_gen_access_code: { Args: never; Returns: string }
      yifi_get_dossier: {
        Args: { p_edition_id: string; p_registrant_id: string }
        Returns: Json
      }
      yifi_get_edition: { Args: { p_slug: string }; Returns: Json }
      yifi_get_matches: {
        Args: { p_edition_id: string; p_registrant_id: string }
        Returns: Json
      }
      yifi_get_registrant_by_id: { Args: { p_id: string }; Returns: Json }
      yifi_get_stats: { Args: { p_edition_id: string }; Returns: Json }
      yifi_get_vows: {
        Args: { p_edition_id: string; p_registrant_id: string }
        Returns: Json
      }
      yifi_list_organisers: { Args: { p_edition_id: string }; Returns: Json }
      yifi_lookup_registrant: { Args: { p_code: string }; Returns: Json }
      yifi_prefill_by_email: { Args: { p_email: string }; Returns: Json }
      yifi_register_self: {
        Args: {
          p_can_offer: Json
          p_challenges: string[]
          p_chapter_name: string
          p_city: string
          p_designation: string
          p_email: string
          p_full_name: string
          p_is_couple: boolean
          p_member_category: string
          p_organisation: string
          p_partner_email: string
          p_partner_name: string
          p_partner_phone: string
          p_phone: string
          p_sector: string
          p_seeking: string[]
          p_total_team_size: string
        }
        Returns: Json
      }
      yifi_update_census: {
        Args: {
          p_can_offer: Json
          p_challenges: string[]
          p_city: string
          p_designation: string
          p_organisation: string
          p_registrant_id: string
          p_sector: string
        }
        Returns: Json
      }
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
        | "point_of_order"
        | "impeach_speaker"
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
        | "nominated_speaker"
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
  yi_directory: {
    Tables: {
      people: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean | null
          merged_into: string | null
          needs_identity_review: boolean
          phone: string | null
          photo_url: string | null
          source_future_team_id: string | null
          source_yip_profile_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          merged_into?: string | null
          needs_identity_review?: boolean
          phone?: string | null
          photo_url?: string | null
          source_future_team_id?: string | null
          source_yip_profile_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          merged_into?: string | null
          needs_identity_review?: boolean
          phone?: string | null
          photo_url?: string | null
          source_future_team_id?: string | null
          source_yip_profile_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      role_assignments: {
        Row: {
          app: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          person_id: string
          role: string
          source_future_team_id: string | null
          source_yip_profile_id: string | null
          title: string | null
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
          yi_chapter: string | null
          yi_edition_id: string | null
          yi_year: number
          yi_zone: string | null
        }
        Insert: {
          app: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          person_id: string
          role: string
          source_future_team_id?: string | null
          source_yip_profile_id?: string | null
          title?: string | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
          yi_chapter?: string | null
          yi_edition_id?: string | null
          yi_year?: number
          yi_zone?: string | null
        }
        Update: {
          app?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          person_id?: string
          role?: string
          source_future_team_id?: string | null
          source_yip_profile_id?: string | null
          title?: string | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
          yi_chapter?: string | null
          yi_edition_id?: string | null
          yi_year?: number
          yi_zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_assignments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          app: string
          capability: string
          role: string
          scope_type: string
        }
        Insert: {
          app: string
          capability: string
          role: string
          scope_type: string
        }
        Update: {
          app?: string
          capability?: string
          role?: string
          scope_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_can_see: {
        Args: { p_app: string; p_chapter?: string; p_zone?: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  yip: {
    Tables: {
      admin_audit_log: {
        Row: {
          action_type: string
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json
          performed_by_email: string | null
          performed_by_organizer_id: string | null
          performed_by_user_id: string | null
          target_event_id: string | null
          target_id: string | null
          target_table: string
          user_agent: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          performed_by_email?: string | null
          performed_by_organizer_id?: string | null
          performed_by_user_id?: string | null
          target_event_id?: string | null
          target_id?: string | null
          target_table: string
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          performed_by_email?: string | null
          performed_by_organizer_id?: string | null
          performed_by_user_id?: string | null
          target_event_id?: string | null
          target_id?: string | null
          target_table?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_target_event_id_fkey"
            columns: ["target_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda: {
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
          is_scoreable: boolean
          mode: Database["public"]["Enums"]["agenda_mode"]
          planned_start: string | null
          sequence_order: number
          session_key: string | null
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
          is_scoreable?: boolean
          mode?: Database["public"]["Enums"]["agenda_mode"]
          planned_start?: string | null
          sequence_order: number
          session_key?: string | null
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
          is_scoreable?: boolean
          mode?: Database["public"]["Enums"]["agenda_mode"]
          planned_start?: string | null
          sequence_order?: number
          session_key?: string | null
          status?: Database["public"]["Enums"]["agenda_status"] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "yip_agenda_event_fkey"
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
            referencedRelation: "agenda"
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
      award_overrides: {
        Row: {
          award_label: string
          created_at: string
          event_id: string
          id: string
          note: string | null
          participant_id: string
          set_by_email: string | null
          set_by_user: string | null
          updated_at: string
        }
        Insert: {
          award_label: string
          created_at?: string
          event_id: string
          id?: string
          note?: string | null
          participant_id: string
          set_by_email?: string | null
          set_by_user?: string | null
          updated_at?: string
        }
        Update: {
          award_label?: string
          created_at?: string
          event_id?: string
          id?: string
          note?: string | null
          participant_id?: string
          set_by_email?: string | null
          set_by_user?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "award_overrides_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "award_overrides_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_documents: {
        Row: {
          committee_name: string
          content_type: string
          created_at: string
          description: string
          event_id: string
          file_name: string
          file_path: string
          file_size_bytes: number
          id: string
          is_mock: boolean
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          committee_name: string
          content_type: string
          created_at?: string
          description?: string
          event_id: string
          file_name: string
          file_path: string
          file_size_bytes?: number
          id?: string
          is_mock?: boolean
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          committee_name?: string
          content_type?: string
          created_at?: string
          description?: string
          event_id?: string
          file_name?: string
          file_path?: string
          file_size_bytes?: number
          id?: string
          is_mock?: boolean
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_documents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
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
          opposition_response: string | null
          opposition_response_at: string | null
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
          opposition_response?: string | null
          opposition_response_at?: string | null
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
          opposition_response?: string | null
          opposition_response_at?: string | null
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
          {
            foreignKeyName: "yip_bills_event_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_checks: {
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
            foreignKeyName: "yip_brand_checks_event_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_channels: {
        Row: {
          committee_name: string | null
          created_at: string
          event_id: string
          frozen_at: string | null
          id: string
          kind: string
          name: string
          party_id: string | null
        }
        Insert: {
          committee_name?: string | null
          created_at?: string
          event_id: string
          frozen_at?: string | null
          id?: string
          kind: string
          name: string
          party_id?: string | null
        }
        Update: {
          committee_name?: string | null
          created_at?: string
          event_id?: string
          frozen_at?: string | null
          id?: string
          kind?: string
          name?: string
          party_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_channels_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_channels_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string
          channel_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          dm_to_volunteer_id: string | null
          event_id: string
          id: string
          reported_at: string | null
          reported_by_participant_id: string | null
          sender_kind: string
          sender_participant_id: string | null
          sender_user: string | null
          sender_volunteer_id: string | null
        }
        Insert: {
          body: string
          channel_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          dm_to_volunteer_id?: string | null
          event_id: string
          id?: string
          reported_at?: string | null
          reported_by_participant_id?: string | null
          sender_kind: string
          sender_participant_id?: string | null
          sender_user?: string | null
          sender_volunteer_id?: string | null
        }
        Update: {
          body?: string
          channel_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          dm_to_volunteer_id?: string | null
          event_id?: string
          id?: string
          reported_at?: string | null
          reported_by_participant_id?: string | null
          sender_kind?: string
          sender_participant_id?: string | null
          sender_user?: string | null
          sender_volunteer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_dm_to_volunteer_id_fkey"
            columns: ["dm_to_volunteer_id"]
            isOneToOne: false
            referencedRelation: "volunteers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_reported_by_participant_id_fkey"
            columns: ["reported_by_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_participant_id_fkey"
            columns: ["sender_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_volunteer_id_fkey"
            columns: ["sender_volunteer_id"]
            isOneToOne: false
            referencedRelation: "volunteers"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_mutes: {
        Row: {
          created_at: string
          event_id: string
          id: string
          muted_by: string | null
          participant_id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          muted_by?: string | null
          participant_id: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          muted_by?: string | null
          participant_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_mutes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_mutes_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist: {
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
            foreignKeyName: "yip_checklist_event_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_template: {
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
      committee_scores: {
        Row: {
          bill_draft_quality: number
          committee_name: string
          created_at: string
          event_id: string
          feasibility: number
          id: string
          innovation: number
          judge_notes: string | null
          policy_relevance: number
          presentation_defence: number
          scored_by: string | null
          team_collaboration: number
          updated_at: string
        }
        Insert: {
          bill_draft_quality?: number
          committee_name: string
          created_at?: string
          event_id: string
          feasibility?: number
          id?: string
          innovation?: number
          judge_notes?: string | null
          policy_relevance?: number
          presentation_defence?: number
          scored_by?: string | null
          team_collaboration?: number
          updated_at?: string
        }
        Update: {
          bill_draft_quality?: number
          committee_name?: string
          created_at?: string
          event_id?: string
          feasibility?: number
          id?: string
          innovation?: number
          judge_notes?: string | null
          policy_relevance?: number
          presentation_defence?: number
          scored_by?: string | null
          team_collaboration?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_scores_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
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
      contestants: {
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
          yi_institution_id: string | null
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
          yi_institution_id?: string | null
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
          yi_institution_id?: string | null
        }
        Relationships: []
      }
      event_chief_guests: {
        Row: {
          created_at: string
          designation: string | null
          display_order: number
          event_id: string
          id: string
          name: string
          organization: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          designation?: string | null
          display_order?: number
          event_id: string
          id?: string
          name: string
          organization?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          designation?: string | null
          display_order?: number
          event_id?: string
          id?: string
          name?: string
          organization?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_chief_guests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_topics: {
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
            foreignKeyName: "event_topic_assignments_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yip_event_topics_event_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
          live_banner_active: boolean
          live_banner_text: string | null
          live_timer_end: string | null
          live_timer_label: string | null
          live_timer_running: boolean | null
          max_participants: number | null
          mycii_event_registered: boolean | null
          mycii_payment_link: string | null
          name: string
          oath_text: string | null
          questions_close_at: string | null
          questions_open_at: string | null
          registrations_frozen: boolean | null
          results_published_at: string | null
          scores_locked: boolean | null
          social_links: string[]
          social_reach_count: number | null
          state: string | null
          status: Database["public"]["Enums"]["event_status"]
          updated_at: string | null
          venue_address: string | null
          venue_name: string | null
          yi_chapter_id: string | null
          yi_year_id: string | null
          yi_zone_code: string | null
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
          live_banner_active?: boolean
          live_banner_text?: string | null
          live_timer_end?: string | null
          live_timer_label?: string | null
          live_timer_running?: boolean | null
          max_participants?: number | null
          mycii_event_registered?: boolean | null
          mycii_payment_link?: string | null
          name: string
          oath_text?: string | null
          questions_close_at?: string | null
          questions_open_at?: string | null
          registrations_frozen?: boolean | null
          results_published_at?: string | null
          scores_locked?: boolean | null
          social_links?: string[]
          social_reach_count?: number | null
          state?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string | null
          venue_address?: string | null
          venue_name?: string | null
          yi_chapter_id?: string | null
          yi_year_id?: string | null
          yi_zone_code?: string | null
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
          live_banner_active?: boolean
          live_banner_text?: string | null
          live_timer_end?: string | null
          live_timer_label?: string | null
          live_timer_running?: boolean | null
          max_participants?: number | null
          mycii_event_registered?: boolean | null
          mycii_payment_link?: string | null
          name?: string
          oath_text?: string | null
          questions_close_at?: string | null
          questions_open_at?: string | null
          registrations_frozen?: boolean | null
          results_published_at?: string | null
          scores_locked?: boolean | null
          social_links?: string[]
          social_reach_count?: number | null
          state?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string | null
          venue_address?: string | null
          venue_name?: string | null
          yi_chapter_id?: string | null
          yi_year_id?: string | null
          yi_zone_code?: string | null
          zone?: Database["public"]["Enums"]["yi_zone"] | null
        }
        Relationships: [
          {
            foreignKeyName: "events_chapter_em_id_fkey"
            columns: ["chapter_em_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yip_events_current_agenda_fkey"
            columns: ["current_agenda_item_id"]
            isOneToOne: false
            referencedRelation: "agenda"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
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
            foreignKeyName: "feedback_responses_respondent_participant_id_fkey"
            columns: ["respondent_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yip_feedback_event_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      fees: {
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
            foreignKeyName: "participant_fees_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: true
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yip_fees_event_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
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
            foreignKeyName: "yip_invitations_event_fkey"
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
          email: string | null
          event_id: string
          id: string
          is_active: boolean | null
          is_mock: boolean
          jury_name: string
        }
        Insert: {
          access_code: string
          created_at?: string | null
          email?: string | null
          event_id: string
          id?: string
          is_active?: boolean | null
          is_mock?: boolean
          jury_name: string
        }
        Update: {
          access_code?: string
          created_at?: string | null
          email?: string | null
          event_id?: string
          id?: string
          is_active?: boolean | null
          is_mock?: boolean
          jury_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "yip_jury_event_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      jury_session_assignments: {
        Row: {
          agenda_item_id: string
          created_at: string
          event_id: string
          id: string
          jury_assignment_id: string
        }
        Insert: {
          agenda_item_id: string
          created_at?: string
          event_id: string
          id?: string
          jury_assignment_id: string
        }
        Update: {
          agenda_item_id?: string
          created_at?: string
          event_id?: string
          id?: string
          jury_assignment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jury_session_assignments_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "agenda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jury_session_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jury_session_assignments_jury_assignment_id_fkey"
            columns: ["jury_assignment_id"]
            isOneToOne: false
            referencedRelation: "jury_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
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
            foreignKeyName: "yip_media_event_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      motions: {
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
            referencedRelation: "agenda"
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
            foreignKeyName: "parliamentary_motions_raised_by_id_fkey"
            columns: ["raised_by_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yip_motions_event_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      organizers: {
        Row: {
          chapter_name: string | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean | null
          is_mock: boolean
          login_slug: string | null
          person_id: string | null
          photo_url: string | null
          role: Database["public"]["Enums"]["yi_role"]
          title: string | null
          updated_at: string | null
          user_id: string | null
          yi_zone_code: string | null
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
          login_slug?: string | null
          person_id?: string | null
          photo_url?: string | null
          role?: Database["public"]["Enums"]["yi_role"]
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          yi_zone_code?: string | null
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
          login_slug?: string | null
          person_id?: string | null
          photo_url?: string | null
          role?: Database["public"]["Enums"]["yi_role"]
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          yi_zone_code?: string | null
          zone?: Database["public"]["Enums"]["yi_zone"] | null
        }
        Relationships: []
      }
      participants: {
        Row: {
          access_code: string
          checked_in: boolean | null
          checked_in_at: string | null
          checked_in_day1: boolean
          checked_in_day1_at: string | null
          checked_in_day2: boolean
          checked_in_day2_at: string | null
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
          yi_institution_id: string | null
        }
        Insert: {
          access_code: string
          checked_in?: boolean | null
          checked_in_at?: string | null
          checked_in_day1?: boolean
          checked_in_day1_at?: string | null
          checked_in_day2?: boolean
          checked_in_day2_at?: string | null
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
          yi_institution_id?: string | null
        }
        Update: {
          access_code?: string
          checked_in?: boolean | null
          checked_in_at?: string | null
          checked_in_day1?: boolean
          checked_in_day1_at?: string | null
          checked_in_day2?: boolean
          checked_in_day2_at?: string | null
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
          yi_institution_id?: string | null
        }
        Relationships: [
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
            referencedRelation: "contestants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yip_participants_event_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      participations: {
        Row: {
          created_at: string | null
          edition_id: string | null
          event_id: string | null
          id: string
          person_id: string
          score: number | null
          status: string | null
          team: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          edition_id?: string | null
          event_id?: string | null
          id?: string
          person_id: string
          score?: number | null
          status?: string | null
          team?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          edition_id?: string | null
          event_id?: string | null
          id?: string
          person_id?: string
          score?: number | null
          status?: string | null
          team?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
            foreignKeyName: "yip_parties_event_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      position_bonus_config: {
        Row: {
          bonuses: Json
          id: boolean
          updated_at: string
        }
        Insert: {
          bonuses: Json
          id?: boolean
          updated_at?: string
        }
        Update: {
          bonuses?: Json
          id?: boolean
          updated_at?: string
        }
        Relationships: []
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
            foreignKeyName: "promotions_source_participant_id_fkey"
            columns: ["source_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_target_participant_id_fkey"
            columns: ["target_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yip_promotions_source_event_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yip_promotions_target_event_fkey"
            columns: ["target_event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
            foreignKeyName: "questions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yip_questions_event_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
            foreignKeyName: "registrations_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yip_registrations_event_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
            foreignKeyName: "results_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yip_results_event_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      rubrics: {
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
      score_audit: {
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
          flag_no_confidence_brought: boolean
          flag_ruckus: boolean
          flag_suspension: boolean
          flag_walkout: boolean
          id: string
          is_mock: boolean
          jury_assignment_id: string
          participant_id: string
          position_bonus: number
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
          flag_no_confidence_brought?: boolean
          flag_ruckus?: boolean
          flag_suspension?: boolean
          flag_walkout?: boolean
          id?: string
          is_mock?: boolean
          jury_assignment_id: string
          participant_id: string
          position_bonus?: number
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
          flag_no_confidence_brought?: boolean
          flag_ruckus?: boolean
          flag_suspension?: boolean
          flag_walkout?: boolean
          id?: string
          is_mock?: boolean
          jury_assignment_id?: string
          participant_id?: string
          position_bonus?: number
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
            referencedRelation: "agenda"
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
            referencedRelation: "rubrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yip_scores_event_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_flags_config: {
        Row: {
          deltas: Json
          id: boolean
          updated_at: string
        }
        Insert: {
          deltas: Json
          id?: boolean
          updated_at?: string
        }
        Update: {
          deltas?: Json
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      scoring_settings: {
        Row: {
          aggregation_method: string
          best_n: number
          id: boolean
          normalize_per_session: boolean
          updated_at: string
        }
        Insert: {
          aggregation_method?: string
          best_n?: number
          id?: boolean
          normalize_per_session?: boolean
          updated_at?: string
        }
        Update: {
          aggregation_method?: string
          best_n?: number
          id?: boolean
          normalize_per_session?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      session_parameters: {
        Row: {
          agenda_type: string | null
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          label: string
          parameters: Json
          session_key: string
          session_weight: number
          total_max: number
          updated_at: string
        }
        Insert: {
          agenda_type?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          label: string
          parameters?: Json
          session_key: string
          session_weight?: number
          total_max?: number
          updated_at?: string
        }
        Update: {
          agenda_type?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          label?: string
          parameters?: Json
          session_key?: string
          session_weight?: number
          total_max?: number
          updated_at?: string
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
          access_code: string | null
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
          access_code?: string | null
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
          access_code?: string | null
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
            foreignKeyName: "yip_volunteers_event_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      vote_audit: {
        Row: {
          changed_at: string
          changed_by: string
          id: string
          new_value: string
          old_value: string
          reason: string | null
          vote_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          id?: string
          new_value: string
          old_value: string
          reason?: string | null
          vote_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          id?: string
          new_value?: string
          old_value?: string
          reason?: string | null
          vote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vote_audit_vote_id_fkey"
            columns: ["vote_id"]
            isOneToOne: false
            referencedRelation: "votes"
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
            referencedRelation: "agenda"
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
            foreignKeyName: "yip_vote_sessions_event_fkey"
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
          entry_method: string
          event_id: string
          id: string
          participant_id: string
          recorded_by_user: string | null
          recorded_by_volunteer_id: string | null
          recorded_via_volunteer_id: string | null
          session_id: string | null
          vote_type: string
          vote_value: string
        }
        Insert: {
          agenda_item_id: string
          cast_at?: string | null
          entry_method?: string
          event_id: string
          id?: string
          participant_id: string
          recorded_by_user?: string | null
          recorded_by_volunteer_id?: string | null
          recorded_via_volunteer_id?: string | null
          session_id?: string | null
          vote_type: string
          vote_value: string
        }
        Update: {
          agenda_item_id?: string
          cast_at?: string | null
          entry_method?: string
          event_id?: string
          id?: string
          participant_id?: string
          recorded_by_user?: string | null
          recorded_by_volunteer_id?: string | null
          recorded_via_volunteer_id?: string | null
          session_id?: string | null
          vote_type?: string
          vote_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "agenda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_recorded_by_volunteer_id_fkey"
            columns: ["recorded_by_volunteer_id"]
            isOneToOne: false
            referencedRelation: "volunteers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_recorded_via_volunteer_id_fkey"
            columns: ["recorded_via_volunteer_id"]
            isOneToOne: false
            referencedRelation: "volunteers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vote_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yip_votes_event_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      yuva_assignments: {
        Row: {
          committee_name: string | null
          created_at: string
          event_id: string
          id: string
          party_id: string | null
          volunteer_id: string
        }
        Insert: {
          committee_name?: string | null
          created_at?: string
          event_id: string
          id?: string
          party_id?: string | null
          volunteer_id: string
        }
        Update: {
          committee_name?: string | null
          created_at?: string
          event_id?: string
          id?: string
          party_id?: string | null
          volunteer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "yuva_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yuva_assignments_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yuva_assignments_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "volunteers"
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
        "point_of_order",
        "impeach_speaker",
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
        "nominated_speaker",
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
    Enums: {
      institution_type: ["school", "higher_secondary", "college", "university"],
    },
  },
  yi_directory: {
    Enums: {},
  },
  yip: {
    Enums: {},
  },
} as const
