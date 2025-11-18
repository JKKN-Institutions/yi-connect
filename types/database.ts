// This file should be generated using:
// npx supabase gen types typescript --project-id=jxvbjpkypzedtrqewesc > types/database.ts
//
// Or use the Supabase MCP tool to regenerate types
//
// For now, using manual type definitions based on schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          chapter_id: string | null;
          template_id: string | null;
          title: string;
          description: string | null;
          category: Database['public']['Enums']['event_category'];
          status: Database['public']['Enums']['event_status'];
          start_date: string;
          end_date: string;
          registration_start_date: string | null;
          registration_end_date: string | null;
          venue_id: string | null;
          venue_address: string | null;
          is_virtual: boolean;
          virtual_meeting_link: string | null;
          max_capacity: number | null;
          current_registrations: number;
          waitlist_enabled: boolean;
          organizer_id: string | null;
          co_organizers: string[] | null;
          estimated_budget: number | null;
          actual_expense: number | null;
          requires_approval: boolean;
          send_reminders: boolean;
          allow_guests: boolean;
          guest_limit: number | null;
          banner_image_url: string | null;
          attachment_urls: string[] | null;
          tags: string[] | null;
          custom_fields: Json | null;
          is_featured: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          chapter_id?: string | null;
          template_id?: string | null;
          title: string;
          description?: string | null;
          category: Database['public']['Enums']['event_category'];
          status?: Database['public']['Enums']['event_status'];
          start_date: string;
          end_date: string;
          registration_start_date?: string | null;
          registration_end_date?: string | null;
          venue_id?: string | null;
          venue_address?: string | null;
          is_virtual?: boolean;
          virtual_meeting_link?: string | null;
          max_capacity?: number | null;
          current_registrations?: number;
          waitlist_enabled?: boolean;
          organizer_id?: string | null;
          co_organizers?: string[] | null;
          estimated_budget?: number | null;
          actual_expense?: number | null;
          requires_approval?: boolean;
          send_reminders?: boolean;
          allow_guests?: boolean;
          guest_limit?: number | null;
          banner_image_url?: string | null;
          attachment_urls?: string[] | null;
          tags?: string[] | null;
          custom_fields?: Json | null;
          is_featured?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          chapter_id?: string | null;
          template_id?: string | null;
          title?: string;
          description?: string | null;
          category?: Database['public']['Enums']['event_category'];
          status?: Database['public']['Enums']['event_status'];
          start_date?: string;
          end_date?: string;
          registration_start_date?: string | null;
          registration_end_date?: string | null;
          venue_id?: string | null;
          venue_address?: string | null;
          is_virtual?: boolean;
          virtual_meeting_link?: string | null;
          max_capacity?: number | null;
          current_registrations?: number;
          waitlist_enabled?: boolean;
          organizer_id?: string | null;
          co_organizers?: string[] | null;
          estimated_budget?: number | null;
          actual_expense?: number | null;
          requires_approval?: boolean;
          send_reminders?: boolean;
          allow_guests?: boolean;
          guest_limit?: number | null;
          banner_image_url?: string | null;
          attachment_urls?: string[] | null;
          tags?: string[] | null;
          custom_fields?: Json | null;
          is_featured?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      event_templates: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          category: Database['public']['Enums']['event_category'];
          default_duration_hours: number | null;
          default_capacity: number | null;
          default_volunteer_roles: Json | null;
          checklist: Json | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          category: Database['public']['Enums']['event_category'];
          default_duration_hours?: number | null;
          default_capacity?: number | null;
          default_volunteer_roles?: Json | null;
          checklist?: Json | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          category?: Database['public']['Enums']['event_category'];
          default_duration_hours?: number | null;
          default_capacity?: number | null;
          default_volunteer_roles?: Json | null;
          checklist?: Json | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      venues: {
        Row: {
          id: string;
          name: string;
          address: string;
          city: string | null;
          state: string | null;
          pincode: string | null;
          capacity: number | null;
          amenities: string[] | null;
          contact_person: string | null;
          contact_phone: string | null;
          contact_email: string | null;
          booking_link: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address: string;
          city?: string | null;
          state?: string | null;
          pincode?: string | null;
          capacity?: number | null;
          amenities?: string[] | null;
          contact_person?: string | null;
          contact_phone?: string | null;
          contact_email?: string | null;
          booking_link?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string;
          city?: string | null;
          state?: string | null;
          pincode?: string | null;
          capacity?: number | null;
          amenities?: string[] | null;
          contact_person?: string | null;
          contact_phone?: string | null;
          contact_email?: string | null;
          booking_link?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      venue_bookings: {
        Row: {
          id: string;
          event_id: string;
          venue_id: string;
          start_time: string;
          end_time: string;
          status: Database['public']['Enums']['booking_status'];
          booking_reference: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          venue_id: string;
          start_time: string;
          end_time: string;
          status?: Database['public']['Enums']['booking_status'];
          booking_reference?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          venue_id?: string;
          start_time?: string;
          end_time?: string;
          status?: Database['public']['Enums']['booking_status'];
          booking_reference?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      resources: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          category: string | null;
          quantity_available: number;
          unit_cost: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          category?: string | null;
          quantity_available?: number;
          unit_cost?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          category?: string | null;
          quantity_available?: number;
          unit_cost?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      resource_bookings: {
        Row: {
          id: string;
          event_id: string;
          resource_id: string;
          quantity: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          resource_id: string;
          quantity?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          resource_id?: string;
          quantity?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      event_rsvps: {
        Row: {
          id: string;
          event_id: string;
          member_id: string;
          status: Database['public']['Enums']['rsvp_status'];
          guests_count: number;
          dietary_restrictions: string | null;
          special_requirements: string | null;
          checked_in_at: string | null;
          checked_in_by: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          member_id: string;
          status?: Database['public']['Enums']['rsvp_status'];
          guests_count?: number;
          dietary_restrictions?: string | null;
          special_requirements?: string | null;
          checked_in_at?: string | null;
          checked_in_by?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          member_id?: string;
          status?: Database['public']['Enums']['rsvp_status'];
          guests_count?: number;
          dietary_restrictions?: string | null;
          special_requirements?: string | null;
          checked_in_at?: string | null;
          checked_in_by?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      guest_rsvps: {
        Row: {
          id: string;
          event_id: string;
          invited_by_member_id: string | null;
          full_name: string;
          email: string;
          phone: string | null;
          company: string | null;
          designation: string | null;
          status: Database['public']['Enums']['rsvp_status'];
          dietary_restrictions: string | null;
          special_requirements: string | null;
          checked_in_at: string | null;
          checked_in_by: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          invited_by_member_id?: string | null;
          full_name: string;
          email: string;
          phone?: string | null;
          company?: string | null;
          designation?: string | null;
          status?: Database['public']['Enums']['rsvp_status'];
          dietary_restrictions?: string | null;
          special_requirements?: string | null;
          checked_in_at?: string | null;
          checked_in_by?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          invited_by_member_id?: string | null;
          full_name?: string;
          email?: string;
          phone?: string | null;
          company?: string | null;
          designation?: string | null;
          status?: Database['public']['Enums']['rsvp_status'];
          dietary_restrictions?: string | null;
          special_requirements?: string | null;
          checked_in_at?: string | null;
          checked_in_by?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      volunteer_roles: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          required_skills: string[] | null;
          responsibilities: string[] | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          required_skills?: string[] | null;
          responsibilities?: string[] | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          required_skills?: string[] | null;
          responsibilities?: string[] | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      event_volunteers: {
        Row: {
          id: string;
          event_id: string;
          member_id: string;
          role_id: string | null;
          role_name: string;
          status: Database['public']['Enums']['volunteer_status'];
          assigned_by: string | null;
          assigned_at: string;
          accepted_at: string | null;
          completed_at: string | null;
          hours_contributed: number | null;
          feedback: string | null;
          rating: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          member_id: string;
          role_id?: string | null;
          role_name: string;
          status?: Database['public']['Enums']['volunteer_status'];
          assigned_by?: string | null;
          assigned_at?: string;
          accepted_at?: string | null;
          completed_at?: string | null;
          hours_contributed?: number | null;
          feedback?: string | null;
          rating?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          member_id?: string;
          role_id?: string | null;
          role_name?: string;
          status?: Database['public']['Enums']['volunteer_status'];
          assigned_by?: string | null;
          assigned_at?: string;
          accepted_at?: string | null;
          completed_at?: string | null;
          hours_contributed?: number | null;
          feedback?: string | null;
          rating?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      event_checkins: {
        Row: {
          id: string;
          event_id: string;
          attendee_type: string;
          attendee_id: string;
          checked_in_at: string;
          checked_in_by: string | null;
          check_in_method: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          attendee_type: string;
          attendee_id: string;
          checked_in_at?: string;
          checked_in_by?: string | null;
          check_in_method?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          attendee_type?: string;
          attendee_id?: string;
          checked_in_at?: string;
          checked_in_by?: string | null;
          check_in_method?: string | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      event_feedback: {
        Row: {
          id: string;
          event_id: string;
          member_id: string | null;
          overall_rating: number | null;
          content_rating: number | null;
          venue_rating: number | null;
          organization_rating: number | null;
          what_went_well: string | null;
          what_could_improve: string | null;
          suggestions: string | null;
          would_attend_again: boolean | null;
          is_anonymous: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          member_id?: string | null;
          overall_rating?: number | null;
          content_rating?: number | null;
          venue_rating?: number | null;
          organization_rating?: number | null;
          what_went_well?: string | null;
          what_could_improve?: string | null;
          suggestions?: string | null;
          would_attend_again?: boolean | null;
          is_anonymous?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          member_id?: string | null;
          overall_rating?: number | null;
          content_rating?: number | null;
          venue_rating?: number | null;
          organization_rating?: number | null;
          what_went_well?: string | null;
          what_could_improve?: string | null;
          suggestions?: string | null;
          would_attend_again?: boolean | null;
          is_anonymous?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      event_documents: {
        Row: {
          id: string;
          event_id: string;
          title: string;
          description: string | null;
          document_type: string;
          file_url: string;
          file_size_kb: number | null;
          uploaded_by: string | null;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          title: string;
          description?: string | null;
          document_type: string;
          file_url: string;
          file_size_kb?: number | null;
          uploaded_by?: string | null;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          title?: string;
          description?: string | null;
          document_type?: string;
          file_url?: string;
          file_size_kb?: number | null;
          uploaded_by?: string | null;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      event_impact_metrics: {
        Row: {
          id: string;
          event_id: string;
          total_registered: number;
          total_attended: number;
          members_attended: number;
          guests_attended: number;
          attendance_rate: number | null;
          volunteers_count: number;
          total_volunteer_hours: number;
          average_rating: number | null;
          feedback_count: number;
          satisfaction_rate: number | null;
          total_revenue: number | null;
          total_expense: number | null;
          net_profit: number | null;
          beneficiaries_count: number | null;
          social_impact_description: string | null;
          calculated_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          total_registered?: number;
          total_attended?: number;
          members_attended?: number;
          guests_attended?: number;
          attendance_rate?: number | null;
          volunteers_count?: number;
          total_volunteer_hours?: number;
          average_rating?: number | null;
          feedback_count?: number;
          satisfaction_rate?: number | null;
          total_revenue?: number | null;
          total_expense?: number | null;
          net_profit?: number | null;
          beneficiaries_count?: number | null;
          social_impact_description?: string | null;
          calculated_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          total_registered?: number;
          total_attended?: number;
          members_attended?: number;
          guests_attended?: number;
          attendance_rate?: number | null;
          volunteers_count?: number;
          total_volunteer_hours?: number;
          average_rating?: number | null;
          feedback_count?: number;
          satisfaction_rate?: number | null;
          total_revenue?: number | null;
          total_expense?: number | null;
          net_profit?: number | null;
          beneficiaries_count?: number | null;
          social_impact_description?: string | null;
          calculated_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      event_status:
        | 'draft'
        | 'published'
        | 'ongoing'
        | 'completed'
        | 'cancelled';
      event_category:
        | 'networking'
        | 'social'
        | 'professional_development'
        | 'community_service'
        | 'sports'
        | 'cultural'
        | 'fundraising'
        | 'workshop'
        | 'seminar'
        | 'conference'
        | 'webinar'
        | 'other'
        | 'industrial_visit';
      rsvp_status:
        | 'pending'
        | 'confirmed'
        | 'declined'
        | 'waitlist'
        | 'attended'
        | 'no_show';
      volunteer_status: 'invited' | 'accepted' | 'declined' | 'completed';
      booking_status: 'pending' | 'confirmed' | 'cancelled';
      budget_status: 'draft' | 'approved' | 'active' | 'closed';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database['public'];

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']] extends {
        Tables: infer T;
        Views: infer V;
      }
        ? T & V
        : never)
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']] extends {
      Tables: infer T;
      Views: infer V;
    }
      ? T & V
      : never)[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] &
      PublicSchema['Views'])
  ? (PublicSchema['Tables'] &
      PublicSchema['Views'])[PublicTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']] extends {
        Tables: infer T;
      }
        ? T
        : never)
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']] extends { Tables: infer T }
      ? T
      : never)[TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
  ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
      Insert: infer I;
    }
    ? I
    : never
  : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']] extends {
        Tables: infer T;
      }
        ? T
        : never)
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']] extends { Tables: infer T }
      ? T
      : never)[TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
  ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
      Update: infer U;
    }
    ? U
    : never
  : never;

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema['Enums']
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicEnumNameOrOptions['schema']] extends {
        Enums: infer E;
      }
        ? E
        : never)
    : never = never
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicEnumNameOrOptions['schema']] extends { Enums: infer E }
      ? E
      : never)[EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema['Enums']
  ? PublicSchema['Enums'][PublicEnumNameOrOptions]
  : never;
