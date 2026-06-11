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
  yuva: {
    Tables: {
      academies: {
        Row: {
          capacity_norm: number
          chapter: string
          coordinator_person_id: string | null
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          institution_id: string | null
          institution_other: string | null
          is_active: boolean
          logo_storage_path: string | null
          qualitative_notes: string | null
          signatories: Json
          updated_at: string
        }
        Insert: {
          capacity_norm?: number
          chapter: string
          coordinator_person_id?: string | null
          created_at?: string
          created_by?: string | null
          display_name: string
          id?: string
          institution_id?: string | null
          institution_other?: string | null
          is_active?: boolean
          logo_storage_path?: string | null
          qualitative_notes?: string | null
          signatories?: Json
          updated_at?: string
        }
        Update: {
          capacity_norm?: number
          chapter?: string
          coordinator_person_id?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          institution_id?: string | null
          institution_other?: string | null
          is_active?: boolean
          logo_storage_path?: string | null
          qualitative_notes?: string | null
          signatories?: Json
          updated_at?: string
        }
        Relationships: []
      }
      applications: {
        Row: {
          chapter: string
          consent_at: string
          created_at: string
          degree: string | null
          dob: string | null
          email: string
          full_name: string
          id: string
          institution_id: string | null
          institution_other: string | null
          motivation: string
          person_id: string | null
          phone: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          run_id: string
          status: Database["yuva"]["Enums"]["application_status"]
          status_token: string
          year_of_study: string | null
          yuva_member_claim: string
        }
        Insert: {
          chapter: string
          consent_at: string
          created_at?: string
          degree?: string | null
          dob?: string | null
          email: string
          full_name: string
          id?: string
          institution_id?: string | null
          institution_other?: string | null
          motivation: string
          person_id?: string | null
          phone?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          run_id: string
          status?: Database["yuva"]["Enums"]["application_status"]
          status_token?: string
          year_of_study?: string | null
          yuva_member_claim: string
        }
        Update: {
          chapter?: string
          consent_at?: string
          created_at?: string
          degree?: string | null
          dob?: string | null
          email?: string
          full_name?: string
          id?: string
          institution_id?: string | null
          institution_other?: string | null
          motivation?: string
          person_id?: string | null
          phone?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          run_id?: string
          status?: Database["yuva"]["Enums"]["application_status"]
          status_token?: string
          year_of_study?: string | null
          yuva_member_claim?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          enrollment_id: string
          marked_at: string
          marked_by: string | null
          present: boolean
          run_session_id: string
        }
        Insert: {
          enrollment_id: string
          marked_at?: string
          marked_by?: string | null
          present: boolean
          run_session_id: string
        }
        Update: {
          enrollment_id?: string
          marked_at?: string
          marked_by?: string | null
          present?: boolean
          run_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_run_session_id_fkey"
            columns: ["run_session_id"]
            isOneToOne: false
            referencedRelation: "run_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_person_id: string | null
          chapter: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          meta: Json
        }
        Insert: {
          action: string
          actor_person_id?: string | null
          chapter?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          meta?: Json
        }
        Update: {
          action?: string
          actor_person_id?: string | null
          chapter?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          meta?: Json
        }
        Relationships: []
      }
      certificate_counters: {
        Row: {
          seq: number
          year: number
        }
        Insert: {
          seq: number
          year: number
        }
        Update: {
          seq?: number
          year?: number
        }
        Relationships: []
      }
      certificates: {
        Row: {
          attendance_pct: number | null
          certificate_no: string
          enrollment_id: string
          id: string
          issued_at: string
          issued_by: string | null
          pdf_storage_path: string
          revoked: boolean
        }
        Insert: {
          attendance_pct?: number | null
          certificate_no: string
          enrollment_id: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          pdf_storage_path: string
          revoked?: boolean
        }
        Update: {
          attendance_pct?: number | null
          certificate_no?: string
          enrollment_id?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          pdf_storage_path?: string
          revoked?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "certificates_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          access_code: string
          application_id: string | null
          certificate_id: string | null
          chapter: string
          id: string
          joined_at: string
          person_id: string
          run_id: string
          status: Database["yuva"]["Enums"]["enrollment_status"]
        }
        Insert: {
          access_code: string
          application_id?: string | null
          certificate_id?: string | null
          chapter: string
          id?: string
          joined_at?: string
          person_id: string
          run_id: string
          status?: Database["yuva"]["Enums"]["enrollment_status"]
        }
        Update: {
          access_code?: string
          application_id?: string | null
          certificate_id?: string | null
          chapter?: string
          id?: string
          joined_at?: string
          person_id?: string
          run_id?: string
          status?: Database["yuva"]["Enums"]["enrollment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          attempted_at: string
          id: string
          key: string
          success: boolean
        }
        Insert: {
          attempted_at?: string
          id?: string
          key: string
          success?: boolean
        }
        Update: {
          attempted_at?: string
          id?: string
          key?: string
          success?: boolean
        }
        Relationships: []
      }
      login_otps: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
        }
        Relationships: []
      }
      materials: {
        Row: {
          created_at: string
          id: string
          run_session_id: string
          storage_path: string
          title: string
          uploaded_by: string | null
          visible: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          run_session_id: string
          storage_path: string
          title: string
          uploaded_by?: string | null
          visible?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          run_session_id?: string
          storage_path?: string
          title?: string
          uploaded_by?: string | null
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "materials_run_session_id_fkey"
            columns: ["run_session_id"]
            isOneToOne: false
            referencedRelation: "run_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_profiles: {
        Row: {
          bio: string | null
          expertise: string[]
          is_public: boolean
          organization: string | null
          person_id: string
          photo_storage_path: string | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          expertise?: string[]
          is_public?: boolean
          organization?: string | null
          person_id: string
          photo_storage_path?: string | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          expertise?: string[]
          is_public?: boolean
          organization?: string | null
          person_id?: string
          photo_storage_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_kind: string
          sender_person_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_kind: string
          sender_person_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_kind?: string
          sender_person_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          attempts: number
          created_at: string
          dedupe_key: string | null
          email_type: string
          id: string
          last_error: string | null
          payload: Json
          recipient: string
          sent_at: string | null
          status: string
          subject: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          dedupe_key?: string | null
          email_type: string
          id?: string
          last_error?: string | null
          payload?: Json
          recipient: string
          sent_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          attempts?: number
          created_at?: string
          dedupe_key?: string | null
          email_type?: string
          id?: string
          last_error?: string | null
          payload?: Json
          recipient?: string
          sent_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
      program_sessions: {
        Row: {
          description: string | null
          document_storage_path: string | null
          duration_minutes: number
          expects_submission: boolean
          id: string
          learning_objective: string | null
          name: string
          program_id: string
          seq: number
        }
        Insert: {
          description?: string | null
          document_storage_path?: string | null
          duration_minutes: number
          expects_submission?: boolean
          id?: string
          learning_objective?: string | null
          name: string
          program_id: string
          seq: number
        }
        Update: {
          description?: string | null
          document_storage_path?: string | null
          duration_minutes?: number
          expects_submission?: boolean
          id?: string
          learning_objective?: string | null
          name?: string
          program_id?: string
          seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_sessions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          category: Database["yuva"]["Enums"]["program_category"]
          created_at: string
          created_by: string | null
          id: string
          objective: string | null
          status: Database["yuva"]["Enums"]["program_status"]
          summary: string | null
          syllabus_storage_path: string | null
          takeaways: Json
          title: string
          total_minutes: number
          updated_at: string
        }
        Insert: {
          category: Database["yuva"]["Enums"]["program_category"]
          created_at?: string
          created_by?: string | null
          id?: string
          objective?: string | null
          status?: Database["yuva"]["Enums"]["program_status"]
          summary?: string | null
          syllabus_storage_path?: string | null
          takeaways?: Json
          title: string
          total_minutes?: number
          updated_at?: string
        }
        Update: {
          category?: Database["yuva"]["Enums"]["program_category"]
          created_at?: string
          created_by?: string | null
          id?: string
          objective?: string | null
          status?: Database["yuva"]["Enums"]["program_status"]
          summary?: string | null
          syllabus_storage_path?: string | null
          takeaways?: Json
          title?: string
          total_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      run_sessions: {
        Row: {
          description: string | null
          document_storage_path: string | null
          duration_minutes: number
          expects_submission: boolean
          id: string
          learning_objective: string | null
          mentor_person_id: string | null
          name: string
          remarks: string | null
          run_id: string
          scheduled_at: string | null
          seq: number
          status: Database["yuva"]["Enums"]["session_status"]
          venue: string | null
        }
        Insert: {
          description?: string | null
          document_storage_path?: string | null
          duration_minutes: number
          expects_submission?: boolean
          id?: string
          learning_objective?: string | null
          mentor_person_id?: string | null
          name: string
          remarks?: string | null
          run_id: string
          scheduled_at?: string | null
          seq: number
          status?: Database["yuva"]["Enums"]["session_status"]
          venue?: string | null
        }
        Update: {
          description?: string | null
          document_storage_path?: string | null
          duration_minutes?: number
          expects_submission?: boolean
          id?: string
          learning_objective?: string | null
          mentor_person_id?: string | null
          name?: string
          remarks?: string | null
          run_id?: string
          scheduled_at?: string | null
          seq?: number
          status?: Database["yuva"]["Enums"]["session_status"]
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "run_sessions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      runs: {
        Row: {
          academy_id: string
          apply_close_at: string | null
          apply_open_at: string | null
          capacity: number
          chapter: string
          cohort_announce_date: string | null
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          program_id: string
          published_at: string | null
          start_date: string | null
          status: Database["yuva"]["Enums"]["run_status"]
          updated_at: string
        }
        Insert: {
          academy_id: string
          apply_close_at?: string | null
          apply_open_at?: string | null
          capacity?: number
          chapter: string
          cohort_announce_date?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          program_id: string
          published_at?: string | null
          start_date?: string | null
          status?: Database["yuva"]["Enums"]["run_status"]
          updated_at?: string
        }
        Update: {
          academy_id?: string
          apply_close_at?: string | null
          apply_open_at?: string | null
          capacity?: number
          chapter?: string
          cohort_announce_date?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          program_id?: string
          published_at?: string | null
          start_date?: string | null
          status?: Database["yuva"]["Enums"]["run_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "runs_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          enrollment_id: string
          feedback: string | null
          file_storage_path: string | null
          id: string
          is_late: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          run_session_id: string
          status: Database["yuva"]["Enums"]["submission_status"]
          submitted_at: string | null
          text_body: string | null
          version: number
        }
        Insert: {
          enrollment_id: string
          feedback?: string | null
          file_storage_path?: string | null
          id?: string
          is_late?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          run_session_id: string
          status?: Database["yuva"]["Enums"]["submission_status"]
          submitted_at?: string | null
          text_body?: string | null
          version?: number
        }
        Update: {
          enrollment_id?: string
          feedback?: string | null
          file_storage_path?: string | null
          id?: string
          is_late?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          run_session_id?: string
          status?: Database["yuva"]["Enums"]["submission_status"]
          submitted_at?: string | null
          text_body?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "submissions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_run_session_id_fkey"
            columns: ["run_session_id"]
            isOneToOne: false
            referencedRelation: "run_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          created_at: string
          id: string
          run_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          run_id: string
        }
        Update: {
          created_at?: string
          id?: string
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "threads_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_see: { Args: { p_chapter: string }; Returns: boolean }
      current_person_id: { Args: never; Returns: string }
      is_academy_coordinator: {
        Args: { p_academy_id: string }
        Returns: boolean
      }
      is_run_mentor: { Args: { p_run_id: string }; Returns: boolean }
      is_yuva_national: { Args: never; Returns: boolean }
      next_certificate_no: { Args: never; Returns: string }
    }
    Enums: {
      application_status: "pending" | "accepted" | "rejected" | "withdrawn"
      enrollment_status: "active" | "completed" | "dropped"
      program_category:
        | "entrepreneurship"
        | "innovation"
        | "learning"
        | "accessibility"
        | "climate_change"
        | "health"
        | "road_safety"
      program_status: "draft" | "approved" | "archived"
      run_status:
        | "draft"
        | "published"
        | "applications_closed"
        | "in_progress"
        | "completed"
        | "certified"
        | "cancelled"
      session_status: "scheduled" | "completed" | "cancelled"
      submission_status: "draft" | "submitted" | "reviewed"
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
  yuva: {
    Enums: {
      application_status: ["pending", "accepted", "rejected", "withdrawn"],
      enrollment_status: ["active", "completed", "dropped"],
      program_category: [
        "entrepreneurship",
        "innovation",
        "learning",
        "accessibility",
        "climate_change",
        "health",
        "road_safety",
      ],
      program_status: ["draft", "approved", "archived"],
      run_status: [
        "draft",
        "published",
        "applications_closed",
        "in_progress",
        "completed",
        "certified",
        "cancelled",
      ],
      session_status: ["scheduled", "completed", "cancelled"],
      submission_status: ["draft", "submitted", "reviewed"],
    },
  },
} as const
