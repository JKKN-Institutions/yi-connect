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
      award_categories: {
        Row: {
          id: string;
          chapter_id: string | null;
          name: string;
          description: string | null;
          criteria: Json | null;
          scoring_weights: Json | null;
          frequency: Database['public']['Enums']['award_frequency'];
          icon: string | null;
          color: string | null;
          sort_order: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          chapter_id?: string | null;
          name: string;
          description?: string | null;
          criteria?: Json | null;
          scoring_weights?: Json | null;
          frequency: Database['public']['Enums']['award_frequency'];
          icon?: string | null;
          color?: string | null;
          sort_order?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          chapter_id?: string | null;
          name?: string;
          description?: string | null;
          criteria?: Json | null;
          scoring_weights?: Json | null;
          frequency?: Database['public']['Enums']['award_frequency'];
          icon?: string | null;
          color?: string | null;
          sort_order?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      award_cycles: {
        Row: {
          id: string;
          category_id: string;
          cycle_name: string;
          year: number;
          period_identifier: string | null;
          start_date: string;
          end_date: string;
          nomination_deadline: string;
          jury_deadline: string;
          status: Database['public']['Enums']['award_cycle_status'];
          description: string | null;
          max_nominations_per_member: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          cycle_name: string;
          year: number;
          period_identifier?: string | null;
          start_date: string;
          end_date: string;
          nomination_deadline: string;
          jury_deadline: string;
          status?: Database['public']['Enums']['award_cycle_status'];
          description?: string | null;
          max_nominations_per_member?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          cycle_name?: string;
          year?: number;
          period_identifier?: string | null;
          start_date?: string;
          end_date?: string;
          nomination_deadline?: string;
          jury_deadline?: string;
          status?: Database['public']['Enums']['award_cycle_status'];
          description?: string | null;
          max_nominations_per_member?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      nominations: {
        Row: {
          id: string;
          cycle_id: string;
          nominee_id: string;
          nominator_id: string;
          justification: string;
          supporting_documents: Json | null;
          status: Database['public']['Enums']['nomination_status'];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cycle_id: string;
          nominee_id: string;
          nominator_id: string;
          justification: string;
          supporting_documents?: Json | null;
          status?: Database['public']['Enums']['nomination_status'];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cycle_id?: string;
          nominee_id?: string;
          nominator_id?: string;
          justification?: string;
          supporting_documents?: Json | null;
          status?: Database['public']['Enums']['nomination_status'];
          created_at?: string;
          updated_at?: string;
        };
      };
      jury_members: {
        Row: {
          id: string;
          cycle_id: string;
          member_id: string;
          completed: boolean;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cycle_id: string;
          member_id: string;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cycle_id?: string;
          member_id?: string;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      jury_scores: {
        Row: {
          id: string;
          nomination_id: string;
          jury_member_id: string;
          impact_score: number;
          innovation_score: number;
          participation_score: number;
          consistency_score: number;
          leadership_score: number;
          comments: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nomination_id: string;
          jury_member_id: string;
          impact_score: number;
          innovation_score: number;
          participation_score: number;
          consistency_score: number;
          leadership_score: number;
          comments?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nomination_id?: string;
          jury_member_id?: string;
          impact_score?: number;
          innovation_score?: number;
          participation_score?: number;
          consistency_score?: number;
          leadership_score?: number;
          comments?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      award_winners: {
        Row: {
          id: string;
          cycle_id: string;
          nomination_id: string;
          rank: number;
          final_score: number;
          announced_by: string | null;
          announced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cycle_id: string;
          nomination_id: string;
          rank: number;
          final_score: number;
          announced_by?: string | null;
          announced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cycle_id?: string;
          nomination_id?: string;
          rank?: number;
          final_score?: number;
          announced_by?: string | null;
          announced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      budgets: {
        Row: {
          id: string;
          chapter_id: string;
          name: string;
          description: string | null;
          fiscal_year: number;
          period: Database['public']['Enums']['budget_period'];
          quarter: number | null;
          total_amount: number;
          allocated_amount: number;
          spent_amount: number;
          committed_amount: number;
          status: Database['public']['Enums']['budget_status'];
          approved_by: string | null;
          approved_at: string | null;
          start_date: string;
          end_date: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          chapter_id: string;
          name: string;
          description?: string | null;
          fiscal_year: number;
          period?: Database['public']['Enums']['budget_status'];
          quarter?: number | null;
          total_amount: number;
          allocated_amount?: number;
          spent_amount?: number;
          committed_amount?: number;
          status?: Database['public']['Enums']['budget_status'];
          approved_by?: string | null;
          approved_at?: string | null;
          start_date: string;
          end_date: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          chapter_id?: string;
          name?: string;
          description?: string | null;
          fiscal_year?: number;
          period?: Database['public']['Enums']['budget_status'];
          quarter?: number | null;
          total_amount?: number;
          allocated_amount?: number;
          spent_amount?: number;
          committed_amount?: number;
          status?: Database['public']['Enums']['budget_status'];
          approved_by?: string | null;
          approved_at?: string | null;
          start_date?: string;
          end_date?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      budget_allocations: {
        Row: {
          id: string;
          budget_id: string;
          vertical_name: string;
          category_name: string | null;
          allocated_amount: number;
          spent_amount: number;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          budget_id: string;
          vertical_name: string;
          category_name?: string | null;
          allocated_amount: number;
          spent_amount?: number;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          budget_id?: string;
          vertical_name?: string;
          category_name?: string | null;
          allocated_amount?: number;
          spent_amount?: number;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      expenses: {
        Row: {
          id: string;
          chapter_id: string;
          event_id: string | null;
          budget_id: string | null;
          category_id: string;
          title: string;
          description: string | null;
          amount: number;
          expense_date: string;
          vendor_name: string | null;
          vendor_contact: string | null;
          invoice_number: string | null;
          payment_method: Database['public']['Enums']['payment_method_type'] | null;
          payment_date: string | null;
          payment_reference: string | null;
          status: Database['public']['Enums']['expense_status'];
          submitted_by: string | null;
          submitted_at: string | null;
          approved_by: string | null;
          approved_at: string | null;
          rejection_reason: string | null;
          tax_amount: number;
          other_charges: number;
          total_amount: number;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          chapter_id: string;
          event_id?: string | null;
          budget_id?: string | null;
          category_id: string;
          title: string;
          description?: string | null;
          amount: number;
          expense_date?: string;
          vendor_name?: string | null;
          vendor_contact?: string | null;
          invoice_number?: string | null;
          payment_method?: Database['public']['Enums']['payment_method_type'] | null;
          payment_date?: string | null;
          payment_reference?: string | null;
          status?: Database['public']['Enums']['expense_status'];
          submitted_by?: string | null;
          submitted_at?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          rejection_reason?: string | null;
          tax_amount?: number;
          other_charges?: number;
          notes?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          chapter_id?: string;
          event_id?: string | null;
          budget_id?: string | null;
          category_id?: string;
          title?: string;
          description?: string | null;
          amount?: number;
          expense_date?: string;
          vendor_name?: string | null;
          vendor_contact?: string | null;
          invoice_number?: string | null;
          payment_method?: Database['public']['Enums']['payment_method_type'] | null;
          payment_date?: string | null;
          payment_reference?: string | null;
          status?: Database['public']['Enums']['expense_status'];
          submitted_by?: string | null;
          submitted_at?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          rejection_reason?: string | null;
          tax_amount?: number;
          other_charges?: number;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      expense_categories: {
        Row: {
          id: string;
          chapter_id: string | null;
          name: string;
          description: string | null;
          parent_category_id: string | null;
          color: string;
          icon: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          chapter_id?: string | null;
          name: string;
          description?: string | null;
          parent_category_id?: string | null;
          color?: string;
          icon?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          chapter_id?: string | null;
          name?: string;
          description?: string | null;
          parent_category_id?: string | null;
          color?: string;
          icon?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      expense_receipts: {
        Row: {
          id: string;
          expense_id: string;
          file_name: string;
          file_path: string;
          file_size: number | null;
          file_type: string | null;
          uploaded_by: string;
          uploaded_at: string;
          description: string | null;
        };
        Insert: {
          id?: string;
          expense_id: string;
          file_name: string;
          file_path: string;
          file_size?: number | null;
          file_type?: string | null;
          uploaded_by: string;
          uploaded_at?: string;
          description?: string | null;
        };
        Update: {
          id?: string;
          expense_id?: string;
          file_name?: string;
          file_path?: string;
          file_size?: number | null;
          file_type?: string | null;
          uploaded_by?: string;
          uploaded_at?: string;
          description?: string | null;
        };
      };
      sponsors: {
        Row: {
          id: string;
          chapter_id: string;
          organization_name: string;
          industry: string | null;
          website: string | null;
          contact_person_name: string | null;
          contact_person_designation: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          state: string | null;
          pincode: string | null;
          country: string | null;
          relationship_status: string | null;
          first_contact_date: string | null;
          last_contact_date: string | null;
          next_followup_date: string | null;
          total_sponsored_amount: number;
          current_year_amount: number;
          tags: string[] | null;
          priority: string | null;
          notes: string | null;
          is_active: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          chapter_id: string;
          organization_name: string;
          industry?: string | null;
          website?: string | null;
          contact_person_name?: string | null;
          contact_person_designation?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          pincode?: string | null;
          country?: string | null;
          relationship_status?: string | null;
          first_contact_date?: string | null;
          last_contact_date?: string | null;
          next_followup_date?: string | null;
          total_sponsored_amount?: number;
          current_year_amount?: number;
          tags?: string[] | null;
          priority?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          chapter_id?: string;
          organization_name?: string;
          industry?: string | null;
          website?: string | null;
          contact_person_name?: string | null;
          contact_person_designation?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          pincode?: string | null;
          country?: string | null;
          relationship_status?: string | null;
          first_contact_date?: string | null;
          last_contact_date?: string | null;
          next_followup_date?: string | null;
          total_sponsored_amount?: number;
          current_year_amount?: number;
          tags?: string[] | null;
          priority?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      sponsorship_tiers: {
        Row: {
          id: string;
          chapter_id: string;
          name: string;
          tier_level: Database['public']['Enums']['sponsorship_tier'];
          min_amount: number;
          max_amount: number | null;
          benefits: string[] | null;
          description: string | null;
          color: string | null;
          icon: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          chapter_id: string;
          name: string;
          tier_level: Database['public']['Enums']['sponsorship_tier'];
          min_amount: number;
          max_amount?: number | null;
          benefits?: string[] | null;
          description?: string | null;
          color?: string | null;
          icon?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          chapter_id?: string;
          name?: string;
          tier_level?: Database['public']['Enums']['sponsorship_tier'];
          min_amount?: number;
          max_amount?: number | null;
          benefits?: string[] | null;
          description?: string | null;
          color?: string | null;
          icon?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      sponsorship_deals: {
        Row: {
          id: string;
          chapter_id: string;
          sponsor_id: string;
          deal_name: string;
          tier_id: string | null;
          deal_stage: Database['public']['Enums']['deal_stage'];
          proposed_amount: number;
          committed_amount: number | null;
          received_amount: number;
          proposal_date: string | null;
          expected_closure_date: string | null;
          commitment_date: string | null;
          contract_signed_date: string | null;
          event_id: string | null;
          fiscal_year: number | null;
          contract_number: string | null;
          contract_terms: string | null;
          deliverables: string[] | null;
          probability_percentage: number;
          weighted_value: number;
          point_of_contact: string | null;
          assigned_to: string | null;
          notes: string | null;
          rejection_reason: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          chapter_id: string;
          sponsor_id: string;
          deal_name: string;
          tier_id?: string | null;
          deal_stage?: Database['public']['Enums']['deal_stage'];
          proposed_amount: number;
          committed_amount?: number | null;
          received_amount?: number;
          proposal_date?: string | null;
          expected_closure_date?: string | null;
          commitment_date?: string | null;
          contract_signed_date?: string | null;
          event_id?: string | null;
          fiscal_year?: number | null;
          contract_number?: string | null;
          contract_terms?: string | null;
          deliverables?: string[] | null;
          probability_percentage?: number;
          point_of_contact?: string | null;
          assigned_to?: string | null;
          notes?: string | null;
          rejection_reason?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          chapter_id?: string;
          sponsor_id?: string;
          deal_name?: string;
          tier_id?: string | null;
          deal_stage?: Database['public']['Enums']['deal_stage'];
          proposed_amount?: number;
          committed_amount?: number | null;
          received_amount?: number;
          proposal_date?: string | null;
          expected_closure_date?: string | null;
          commitment_date?: string | null;
          contract_signed_date?: string | null;
          event_id?: string | null;
          fiscal_year?: number | null;
          contract_number?: string | null;
          contract_terms?: string | null;
          deliverables?: string[] | null;
          probability_percentage?: number;
          point_of_contact?: string | null;
          assigned_to?: string | null;
          notes?: string | null;
          rejection_reason?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      sponsorship_payments: {
        Row: {
          id: string;
          deal_id: string;
          amount: number;
          payment_date: string;
          payment_method: Database['public']['Enums']['payment_method_type'];
          transaction_reference: string | null;
          bank_name: string | null;
          cheque_number: string | null;
          utr_number: string | null;
          receipt_number: string | null;
          receipt_date: string | null;
          notes: string | null;
          recorded_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          deal_id: string;
          amount: number;
          payment_date?: string;
          payment_method: Database['public']['Enums']['payment_method_type'];
          transaction_reference?: string | null;
          bank_name?: string | null;
          cheque_number?: string | null;
          utr_number?: string | null;
          receipt_number?: string | null;
          receipt_date?: string | null;
          notes?: string | null;
          recorded_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          deal_id?: string;
          amount?: number;
          payment_date?: string;
          payment_method?: Database['public']['Enums']['payment_method_type'];
          transaction_reference?: string | null;
          bank_name?: string | null;
          cheque_number?: string | null;
          utr_number?: string | null;
          receipt_number?: string | null;
          receipt_date?: string | null;
          notes?: string | null;
          recorded_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      reimbursement_requests: {
        Row: {
          id: string;
          chapter_id: string;
          expense_id: string | null;
          event_id: string | null;
          requester_id: string;
          requester_name: string;
          requester_email: string | null;
          requester_phone: string | null;
          title: string;
          description: string;
          amount: number;
          expense_date: string;
          payment_method_preference: Database['public']['Enums']['payment_method_type'] | null;
          bank_account_number: string | null;
          bank_name: string | null;
          ifsc_code: string | null;
          upi_id: string | null;
          status: Database['public']['Enums']['reimbursement_status'];
          submitted_at: string | null;
          current_approver_id: string | null;
          final_approved_by: string | null;
          final_approved_at: string | null;
          paid_by: string | null;
          paid_at: string | null;
          payment_reference: string | null;
          payment_date: string | null;
          rejection_reason: string | null;
          rejected_by: string | null;
          rejected_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          chapter_id: string;
          expense_id?: string | null;
          event_id?: string | null;
          requester_id: string;
          requester_name: string;
          requester_email?: string | null;
          requester_phone?: string | null;
          title: string;
          description: string;
          amount: number;
          expense_date: string;
          payment_method_preference?: Database['public']['Enums']['payment_method_type'] | null;
          bank_account_number?: string | null;
          bank_name?: string | null;
          ifsc_code?: string | null;
          upi_id?: string | null;
          status?: Database['public']['Enums']['reimbursement_status'];
          submitted_at?: string | null;
          current_approver_id?: string | null;
          final_approved_by?: string | null;
          final_approved_at?: string | null;
          paid_by?: string | null;
          paid_at?: string | null;
          payment_reference?: string | null;
          payment_date?: string | null;
          rejection_reason?: string | null;
          rejected_by?: string | null;
          rejected_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          chapter_id?: string;
          expense_id?: string | null;
          event_id?: string | null;
          requester_id?: string;
          requester_name?: string;
          requester_email?: string | null;
          requester_phone?: string | null;
          title?: string;
          description?: string;
          amount?: number;
          expense_date?: string;
          payment_method_preference?: Database['public']['Enums']['payment_method_type'] | null;
          bank_account_number?: string | null;
          bank_name?: string | null;
          ifsc_code?: string | null;
          upi_id?: string | null;
          status?: Database['public']['Enums']['reimbursement_status'];
          submitted_at?: string | null;
          current_approver_id?: string | null;
          final_approved_by?: string | null;
          final_approved_at?: string | null;
          paid_by?: string | null;
          paid_at?: string | null;
          payment_reference?: string | null;
          payment_date?: string | null;
          rejection_reason?: string | null;
          rejected_by?: string | null;
          rejected_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      reimbursement_approvals: {
        Row: {
          id: string;
          request_id: string;
          approver_id: string;
          approver_level: number;
          action: Database['public']['Enums']['approval_action'] | null;
          comments: string | null;
          action_date: string | null;
          is_required: boolean;
          is_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          approver_id: string;
          approver_level?: number;
          action?: Database['public']['Enums']['approval_action'] | null;
          comments?: string | null;
          action_date?: string | null;
          is_required?: boolean;
          is_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          approver_id?: string;
          approver_level?: number;
          action?: Database['public']['Enums']['approval_action'] | null;
          comments?: string | null;
          action_date?: string | null;
          is_required?: boolean;
          is_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      members: {
        Row: {
          id: string;
          chapter_id: string | null;
          membership_number: string | null;
          member_since: string;
          membership_status: string;
          company: string | null;
          designation: string | null;
          industry: string | null;
          years_of_experience: number | null;
          linkedin_url: string | null;
          date_of_birth: string | null;
          gender: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          country: string | null;
          pincode: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          emergency_contact_relationship: string | null;
          interests: string[] | null;
          preferred_event_types: string[] | null;
          communication_preferences: Json | null;
          is_active: boolean;
          notes: string | null;
          avatar_url: string | null;
          renewal_date: string | null;
          membership_type: string | null;
          family_count: number;
          languages: string[] | null;
          willingness_level: number | null;
          vertical_interests: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          chapter_id?: string | null;
          membership_number?: string | null;
          member_since?: string;
          membership_status?: string;
          company?: string | null;
          designation?: string | null;
          industry?: string | null;
          years_of_experience?: number | null;
          linkedin_url?: string | null;
          date_of_birth?: string | null;
          gender?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string | null;
          pincode?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          emergency_contact_relationship?: string | null;
          interests?: string[] | null;
          preferred_event_types?: string[] | null;
          communication_preferences?: Json | null;
          is_active?: boolean;
          notes?: string | null;
          avatar_url?: string | null;
          membership_type?: string | null;
          family_count?: number;
          languages?: string[] | null;
          willingness_level?: number | null;
          vertical_interests?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          chapter_id?: string | null;
          membership_number?: string | null;
          member_since?: string;
          membership_status?: string;
          company?: string | null;
          designation?: string | null;
          industry?: string | null;
          years_of_experience?: number | null;
          linkedin_url?: string | null;
          date_of_birth?: string | null;
          gender?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string | null;
          pincode?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          emergency_contact_relationship?: string | null;
          interests?: string[] | null;
          preferred_event_types?: string[] | null;
          communication_preferences?: Json | null;
          is_active?: boolean;
          notes?: string | null;
          avatar_url?: string | null;
          membership_type?: string | null;
          family_count?: number;
          languages?: string[] | null;
          willingness_level?: number | null;
          vertical_interests?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      skills: {
        Row: {
          id: string;
          name: string;
          category: Database['public']['Enums']['skill_category'];
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category?: Database['public']['Enums']['skill_category'];
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category?: Database['public']['Enums']['skill_category'];
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      member_skills: {
        Row: {
          id: string;
          member_id: string;
          skill_id: string;
          proficiency: Database['public']['Enums']['proficiency_level'];
          years_of_experience: number;
          is_willing_to_mentor: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          skill_id: string;
          proficiency?: Database['public']['Enums']['proficiency_level'];
          years_of_experience?: number;
          is_willing_to_mentor?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          skill_id?: string;
          proficiency?: Database['public']['Enums']['proficiency_level'];
          years_of_experience?: number;
          is_willing_to_mentor?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      certifications: {
        Row: {
          id: string;
          name: string;
          issuing_organization: string;
          description: string | null;
          validity_period_months: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          issuing_organization: string;
          description?: string | null;
          validity_period_months?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          issuing_organization?: string;
          description?: string | null;
          validity_period_months?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      member_certifications: {
        Row: {
          id: string;
          member_id: string;
          certification_id: string;
          certificate_number: string | null;
          issued_date: string;
          expiry_date: string | null;
          document_url: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          certification_id: string;
          certificate_number?: string | null;
          issued_date: string;
          expiry_date?: string | null;
          document_url?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          certification_id?: string;
          certificate_number?: string | null;
          issued_date?: string;
          expiry_date?: string | null;
          document_url?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      availability: {
        Row: {
          id: string;
          member_id: string;
          date: string;
          status: Database['public']['Enums']['availability_status'];
          time_slots: Json | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          date: string;
          status?: Database['public']['Enums']['availability_status'];
          time_slots?: Json | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          date?: string;
          status?: Database['public']['Enums']['availability_status'];
          time_slots?: Json | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      engagement_metrics: {
        Row: {
          id: string;
          member_id: string;
          total_events_attended: number;
          events_attended_last_3_months: number;
          events_attended_last_6_months: number;
          events_organized: number;
          volunteer_hours: number;
          total_contributions: number;
          feedback_given: number;
          referrals_made: number;
          engagement_score: number;
          last_event_date: string | null;
          last_activity_date: string | null;
          calculated_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          total_events_attended?: number;
          events_attended_last_3_months?: number;
          events_attended_last_6_months?: number;
          events_organized?: number;
          volunteer_hours?: number;
          total_contributions?: number;
          feedback_given?: number;
          referrals_made?: number;
          engagement_score?: number;
          last_event_date?: string | null;
          last_activity_date?: string | null;
          calculated_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          total_events_attended?: number;
          events_attended_last_3_months?: number;
          events_attended_last_6_months?: number;
          events_organized?: number;
          volunteer_hours?: number;
          total_contributions?: number;
          feedback_given?: number;
          referrals_made?: number;
          engagement_score?: number;
          last_event_date?: string | null;
          last_activity_date?: string | null;
          calculated_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      leadership_assessments: {
        Row: {
          id: string;
          member_id: string;
          engagement_score: number;
          tenure_score: number;
          skills_score: number;
          leadership_experience_score: number;
          training_score: number;
          readiness_score: number;
          readiness_level: string | null;
          strengths: string[] | null;
          areas_for_development: string[] | null;
          recommended_roles: string[] | null;
          recommended_training: string[] | null;
          assessed_at: string;
          next_assessment_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          engagement_score?: number;
          tenure_score?: number;
          skills_score?: number;
          leadership_experience_score?: number;
          training_score?: number;
          readiness_score?: number;
          readiness_level?: string | null;
          strengths?: string[] | null;
          areas_for_development?: string[] | null;
          recommended_roles?: string[] | null;
          recommended_training?: string[] | null;
          assessed_at?: string;
          next_assessment_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          engagement_score?: number;
          tenure_score?: number;
          skills_score?: number;
          leadership_experience_score?: number;
          training_score?: number;
          readiness_score?: number;
          readiness_level?: string | null;
          strengths?: string[] | null;
          areas_for_development?: string[] | null;
          recommended_roles?: string[] | null;
          recommended_training?: string[] | null;
          assessed_at?: string;
          next_assessment_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          phone: string | null;
          chapter_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          avatar_url?: string | null;
          phone?: string | null;
          chapter_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          avatar_url?: string | null;
          phone?: string | null;
          chapter_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      chapters: {
        Row: {
          id: string;
          name: string;
          location: string;
          region: string | null;
          established_date: string | null;
          member_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          location: string;
          region?: string | null;
          established_date?: string | null;
          member_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          location?: string;
          region?: string | null;
          established_date?: string | null;
          member_count?: number;
          created_at?: string;
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
      budget_period: 'quarterly' | 'annual' | 'custom';
      budget_status: 'draft' | 'approved' | 'active' | 'closed';
      expense_status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';
      payment_method_type: 'bank_transfer' | 'cash' | 'cheque' | 'upi' | 'credit_card' | 'online';
      sponsorship_tier: 'platinum' | 'gold' | 'silver' | 'bronze' | 'supporter';
      deal_stage: 'prospect' | 'contacted' | 'proposal_sent' | 'negotiation' | 'committed' | 'contract_signed' | 'payment_received' | 'lost';
      reimbursement_status: 'draft' | 'submitted' | 'pending_approval' | 'approved' | 'rejected' | 'paid';
      approval_action: 'approve' | 'reject' | 'request_changes';
      proficiency_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
      availability_status: 'available' | 'busy' | 'unavailable';
      skill_category: 'technical' | 'business' | 'creative' | 'leadership' | 'communication' | 'other';
      award_frequency: 'monthly' | 'quarterly' | 'annual' | 'one_time';
      award_cycle_status:
        | 'draft'
        | 'open'
        | 'nominations_closed'
        | 'judging'
        | 'completed'
        | 'cancelled';
      nomination_status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
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

// ============================================================================
// Constants Export (for validation schemas)
// ============================================================================

export const Constants = {
  public: {
    Enums: {
      event_status: [
        'draft',
        'published',
        'ongoing',
        'completed',
        'cancelled'
      ] as ['draft', 'published', 'ongoing', 'completed', 'cancelled'],
      event_category: [
        'networking',
        'social',
        'professional_development',
        'community_service',
        'sports',
        'cultural',
        'fundraising',
        'workshop',
        'seminar',
        'conference',
        'webinar',
        'other',
        'industrial_visit'
      ] as [
        'networking',
        'social',
        'professional_development',
        'community_service',
        'sports',
        'cultural',
        'fundraising',
        'workshop',
        'seminar',
        'conference',
        'webinar',
        'other',
        'industrial_visit'
      ],
      rsvp_status: [
        'pending',
        'confirmed',
        'declined',
        'waitlist',
        'attended',
        'no_show'
      ] as [
        'pending',
        'confirmed',
        'declined',
        'waitlist',
        'attended',
        'no_show'
      ],
      volunteer_status: ['invited', 'accepted', 'declined', 'completed'] as [
        'invited',
        'accepted',
        'declined',
        'completed'
      ],
      booking_status: ['pending', 'confirmed', 'cancelled'] as [
        'pending',
        'confirmed',
        'cancelled'
      ],
      budget_status: ['draft', 'approved', 'active', 'closed'] as [
        'draft',
        'approved',
        'active',
        'closed'
      ],
      award_frequency: ['monthly', 'quarterly', 'annual', 'one_time'] as [
        'monthly',
        'quarterly',
        'annual',
        'one_time'
      ],
      award_cycle_status: [
        'draft',
        'open',
        'nominations_closed',
        'judging',
        'completed',
        'cancelled'
      ] as [
        'draft',
        'open',
        'nominations_closed',
        'judging',
        'completed',
        'cancelled'
      ],
      nomination_status: ['pending', 'approved', 'rejected', 'withdrawn'] as [
        'pending',
        'approved',
        'rejected',
        'withdrawn'
      ],
      proficiency_level: ['beginner', 'intermediate', 'advanced', 'expert'] as [
        'beginner',
        'intermediate',
        'advanced',
        'expert'
      ],
      availability_status: ['available', 'busy', 'unavailable'] as [
        'available',
        'busy',
        'unavailable'
      ],
      skill_category: [
        'technical',
        'business',
        'creative',
        'leadership',
        'communication',
        'other'
      ] as [
        'technical',
        'business',
        'creative',
        'leadership',
        'communication',
        'other'
      ]
    }
  }
} as const;
