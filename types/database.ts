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
      announcement_recipients: {
        Row: {
          announcement_id: string
          channel: string
          clicked_at: string | null
          created_at: string | null
          delivered_at: string | null
          failed_reason: string | null
          id: string
          member_id: string
          metadata: Json | null
          opened_at: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          announcement_id: string
          channel: string
          clicked_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          failed_reason?: string | null
          id?: string
          member_id: string
          metadata?: Json | null
          opened_at?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          announcement_id?: string
          channel?: string
          clicked_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          failed_reason?: string | null
          id?: string
          member_id?: string
          metadata?: Json | null
          opened_at?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcement_recipients_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_recipients_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_templates: {
        Row: {
          category: string | null
          chapter_id: string | null
          content_template: string
          created_at: string | null
          created_by: string | null
          default_channels: string[] | null
          id: string
          last_used_at: string | null
          name: string
          type: string
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          category?: string | null
          chapter_id?: string | null
          content_template: string
          created_at?: string | null
          created_by?: string | null
          default_channels?: string[] | null
          id?: string
          last_used_at?: string | null
          name: string
          type: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          category?: string | null
          chapter_id?: string | null
          content_template?: string
          created_at?: string | null
          created_by?: string | null
          default_channels?: string[] | null
          id?: string
          last_used_at?: string | null
          name?: string
          type?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "announcement_templates_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          audience_filter: Json | null
          channels: string[]
          chapter_id: string
          content: string
          created_at: string | null
          created_by: string
          id: string
          metadata: Json | null
          scheduled_at: string | null
          segment_id: string | null
          sent_at: string | null
          status: string | null
          template_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          audience_filter?: Json | null
          channels: string[]
          chapter_id: string
          content: string
          created_at?: string | null
          created_by: string
          id?: string
          metadata?: Json | null
          scheduled_at?: string | null
          segment_id?: string | null
          sent_at?: string | null
          status?: string | null
          template_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          audience_filter?: Json | null
          channels?: string[]
          chapter_id?: string
          content?: string
          created_at?: string | null
          created_by?: string
          id?: string
          metadata?: Json | null
          scheduled_at?: string | null
          segment_id?: string | null
          sent_at?: string | null
          status?: string | null
          template_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "communication_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "announcement_templates"
            referencedColumns: ["id"]
          },
        ]
      }
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
      award_categories: {
        Row: {
          chapter_id: string
          color: string | null
          created_at: string | null
          criteria: Json
          description: string | null
          frequency: Database["public"]["Enums"]["award_frequency"]
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          scoring_weights: Json
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          chapter_id: string
          color?: string | null
          created_at?: string | null
          criteria?: Json
          description?: string | null
          frequency?: Database["public"]["Enums"]["award_frequency"]
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          scoring_weights?: Json
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          chapter_id?: string
          color?: string | null
          created_at?: string | null
          criteria?: Json
          description?: string | null
          frequency?: Database["public"]["Enums"]["award_frequency"]
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          scoring_weights?: Json
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "award_categories_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      award_cycles: {
        Row: {
          announcement_message: string | null
          category_id: string
          created_at: string | null
          cycle_name: string
          description: string | null
          end_date: string
          id: string
          jury_deadline: string
          max_nominations_per_member: number | null
          nomination_deadline: string
          period_identifier: string | null
          start_date: string
          status: Database["public"]["Enums"]["award_cycle_status"] | null
          updated_at: string | null
          winners_announced_at: string | null
          year: number
        }
        Insert: {
          announcement_message?: string | null
          category_id: string
          created_at?: string | null
          cycle_name: string
          description?: string | null
          end_date: string
          id?: string
          jury_deadline: string
          max_nominations_per_member?: number | null
          nomination_deadline: string
          period_identifier?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["award_cycle_status"] | null
          updated_at?: string | null
          winners_announced_at?: string | null
          year: number
        }
        Update: {
          announcement_message?: string | null
          category_id?: string
          created_at?: string | null
          cycle_name?: string
          description?: string | null
          end_date?: string
          id?: string
          jury_deadline?: string
          max_nominations_per_member?: number | null
          nomination_deadline?: string
          period_identifier?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["award_cycle_status"] | null
          updated_at?: string | null
          winners_announced_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "award_cycles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "award_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      award_winners: {
        Row: {
          added_to_profile: boolean | null
          announced_at: string | null
          announced_by: string | null
          announcement_sent: boolean | null
          certificate_generated: boolean | null
          certificate_generated_at: string | null
          certificate_url: string | null
          created_at: string | null
          cycle_id: string
          final_score: number
          id: string
          nomination_id: string
          rank: number
        }
        Insert: {
          added_to_profile?: boolean | null
          announced_at?: string | null
          announced_by?: string | null
          announcement_sent?: boolean | null
          certificate_generated?: boolean | null
          certificate_generated_at?: string | null
          certificate_url?: string | null
          created_at?: string | null
          cycle_id: string
          final_score: number
          id?: string
          nomination_id: string
          rank: number
        }
        Update: {
          added_to_profile?: boolean | null
          announced_at?: string | null
          announced_by?: string | null
          announcement_sent?: boolean | null
          certificate_generated?: boolean | null
          certificate_generated_at?: string | null
          certificate_url?: string | null
          created_at?: string | null
          cycle_id?: string
          final_score?: number
          id?: string
          nomination_id?: string
          rank?: number
        }
        Relationships: [
          {
            foreignKeyName: "award_winners_announced_by_fkey"
            columns: ["announced_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "award_winners_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "award_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "award_winners_nomination_id_fkey"
            columns: ["nomination_id"]
            isOneToOne: true
            referencedRelation: "nominations"
            referencedColumns: ["id"]
          },
        ]
      }
      jury_members: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          completed_at: string | null
          created_at: string | null
          cycle_id: string
          id: string
          member_id: string
          reminder_sent_at: string | null
          scored_nominations: number | null
          total_nominations: number | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          completed_at?: string | null
          created_at?: string | null
          cycle_id: string
          id?: string
          member_id: string
          reminder_sent_at?: string | null
          scored_nominations?: number | null
          total_nominations?: number | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          completed_at?: string | null
          created_at?: string | null
          cycle_id?: string
          id?: string
          member_id?: string
          reminder_sent_at?: string | null
          scored_nominations?: number | null
          total_nominations?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "jury_members_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jury_members_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "award_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jury_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      jury_scores: {
        Row: {
          anomaly_reason: string | null
          comments: string | null
          consistency_score: number | null
          id: string
          impact_score: number | null
          innovation_score: number | null
          is_anomaly: boolean | null
          jury_member_id: string
          leadership_score: number | null
          nomination_id: string
          participation_score: number | null
          scored_at: string | null
          total_score: number | null
          updated_at: string | null
          weighted_score: number | null
        }
        Insert: {
          anomaly_reason?: string | null
          comments?: string | null
          consistency_score?: number | null
          id?: string
          impact_score?: number | null
          innovation_score?: number | null
          is_anomaly?: boolean | null
          jury_member_id: string
          leadership_score?: number | null
          nomination_id: string
          participation_score?: number | null
          scored_at?: string | null
          total_score?: number | null
          updated_at?: string | null
          weighted_score?: number | null
        }
        Update: {
          anomaly_reason?: string | null
          comments?: string | null
          consistency_score?: number | null
          id?: string
          impact_score?: number | null
          innovation_score?: number | null
          is_anomaly?: boolean | null
          jury_member_id?: string
          leadership_score?: number | null
          nomination_id?: string
          participation_score?: number | null
          scored_at?: string | null
          total_score?: number | null
          updated_at?: string | null
          weighted_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "jury_scores_jury_member_id_fkey"
            columns: ["jury_member_id"]
            isOneToOne: false
            referencedRelation: "jury_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jury_scores_nomination_id_fkey"
            columns: ["nomination_id"]
            isOneToOne: false
            referencedRelation: "nominations"
            referencedColumns: ["id"]
          },
        ]
      }
      nominations: {
        Row: {
          average_score: number | null
          created_at: string | null
          cycle_id: string
          id: string
          justification: string
          nominee_id: string
          nominator_id: string
          status: Database["public"]["Enums"]["nomination_status"] | null
          submitted_at: string | null
          total_jury_scores: number | null
          updated_at: string | null
          weighted_average_score: number | null
        }
        Insert: {
          average_score?: number | null
          created_at?: string | null
          cycle_id: string
          id?: string
          justification: string
          nominee_id: string
          nominator_id: string
          status?: Database["public"]["Enums"]["nomination_status"] | null
          submitted_at?: string | null
          total_jury_scores?: number | null
          updated_at?: string | null
          weighted_average_score?: number | null
        }
        Update: {
          average_score?: number | null
          created_at?: string | null
          cycle_id?: string
          id?: string
          justification?: string
          nominee_id?: string
          nominator_id?: string
          status?: Database["public"]["Enums"]["nomination_status"] | null
          submitted_at?: string | null
          total_jury_scores?: number | null
          updated_at?: string | null
          weighted_average_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nominations_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "award_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nominations_nominee_id_fkey"
            columns: ["nominee_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nominations_nominator_id_fkey"
            columns: ["nominator_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      // ... (other tables truncated for brevity - full types generated from Supabase)
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      availability_status: "available" | "busy" | "unavailable" | "conditional"
      award_cycle_status: "draft" | "open" | "nominations_closed" | "judging" | "completed" | "cancelled"
      award_frequency: "monthly" | "quarterly" | "annual"
      budget_period: "annual" | "quarterly" | "monthly" | "event_based"
      budget_status: "draft" | "submitted" | "approved" | "active" | "closed" | "rejected"
      carpool_status: "not_needed" | "needs_ride" | "can_drive" | "matched"
      college_type: "engineering" | "arts_science" | "medical" | "management" | "law" | "polytechnic" | "other"
      connection_type: "direct" | "referral" | "cold_outreach" | "existing_partner"
      event_category: "meeting" | "social" | "training" | "industrial_visit" | "community_service" | "fundraising" | "sports" | "cultural" | "other"
      event_status: "draft" | "upcoming" | "ongoing" | "completed" | "cancelled"
      expense_status: "draft" | "submitted" | "approved" | "rejected" | "paid"
      industry_portal_user_status: "invited" | "active" | "inactive" | "suspended"
      industry_sector: "it" | "manufacturing" | "education" | "healthcare" | "finance" | "retail" | "hospitality" | "construction" | "agriculture" | "other"
      nomination_status: "draft" | "submitted" | "under_review" | "shortlisted" | "winner" | "rejected"
      payment_method_type: "cash" | "upi" | "bank_transfer" | "cheque" | "card" | "other"
      rsvp_status: "going" | "maybe" | "not_going" | "waitlist"
      stakeholder_status: "active" | "inactive" | "potential" | "archived"
      volunteer_status: "invited" | "accepted" | "declined" | "completed" | "no_show"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]] extends { Tables: infer T; Views: infer V }
        ? T & V
        : never)
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]] extends { Tables: infer T; Views: infer V }
      ? T & V
      : never)[TableName] extends {
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
    ? keyof (Database[PublicTableNameOrOptions["schema"]] extends { Tables: infer T }
        ? T
        : never)
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]] extends { Tables: infer T }
      ? T
      : never)[TableName] extends {
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
    ? keyof (Database[PublicTableNameOrOptions["schema"]] extends { Tables: infer T }
        ? T
        : never)
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]] extends { Tables: infer T }
      ? T
      : never)[TableName] extends {
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
    ? keyof (Database[PublicEnumNameOrOptions["schema"]] extends { Enums: infer E }
        ? E
        : never)
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicEnumNameOrOptions["schema"]] extends { Enums: infer E }
      ? E
      : never)[EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[PublicCompositeTypeNameOrOptions["schema"]] extends { CompositeTypes: infer C }
        ? C
        : never)
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicCompositeTypeNameOrOptions["schema"]] extends { CompositeTypes: infer C }
      ? C
      : never)[CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
