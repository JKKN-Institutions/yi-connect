export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '13.0.5';
  };
  public: {
    Tables: {
      award_categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          icon: string | null;
          color: string | null;
          display_order: number;
          frequency: string;
          criteria_template: any;
          scoring_weights: any;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          icon?: string | null;
          color?: string | null;
          display_order?: number;
          frequency: string;
          criteria_template?: any;
          scoring_weights?: any;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          icon?: string | null;
          color?: string | null;
          display_order?: number;
          frequency?: string;
          criteria_template?: any;
          scoring_weights?: any;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      award_cycles: {
        Row: {
          id: string;
          category_id: string;
          cycle_name: string;
          year: number;
          status: string;
          nomination_start_date: string;
          nomination_end_date: string;
          nomination_deadline: string;
          voting_start_date: string;
          voting_end_date: string;
          start_date: string | null;
          end_date: string | null;
          jury_deadline: string | null;
          description: string | null;
          period_identifier: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          cycle_name: string;
          year: number;
          status?: string;
          nomination_start_date: string;
          nomination_end_date: string;
          nomination_deadline: string;
          voting_start_date: string;
          voting_end_date: string;
          start_date?: string | null;
          end_date?: string | null;
          jury_deadline?: string | null;
          description?: string | null;
          period_identifier?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          cycle_name?: string;
          year?: number;
          status?: string;
          nomination_start_date?: string;
          nomination_end_date?: string;
          nomination_deadline?: string;
          voting_start_date?: string;
          voting_end_date?: string;
          start_date?: string | null;
          end_date?: string | null;
          jury_deadline?: string | null;
          description?: string | null;
          period_identifier?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      nominations: {
        Row: {
          id: string;
          cycle_id: string;
          nominee_id: string;
          nominator_id: string;
          justification: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cycle_id: string;
          nominee_id: string;
          nominator_id: string;
          justification: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cycle_id?: string;
          nominee_id?: string;
          nominator_id?: string;
          justification?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      jury_members: {
        Row: {
          id: string;
          cycle_id: string;
          member_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          cycle_id: string;
          member_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          cycle_id?: string;
          member_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      jury_scores: {
        Row: {
          id: string;
          nomination_id: string;
          jury_member_id: string;
          scores: any;
          total_score: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nomination_id: string;
          jury_member_id: string;
          scores: any;
          total_score: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nomination_id?: string;
          jury_member_id?: string;
          scores?: any;
          total_score?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      award_winners: {
        Row: {
          id: string;
          cycle_id: string;
          nomination_id: string;
          rank: number;
          final_score: number | null;
          announced_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          cycle_id: string;
          nomination_id: string;
          rank: number;
          final_score?: number | null;
          announced_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          cycle_id?: string;
          nomination_id?: string;
          rank?: number;
          final_score?: number | null;
          announced_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
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
        Relationships: [];
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
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      skills: {
        Row: {
          id: string;
          name: string;
          category: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category?: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      member_skills: {
        Row: {
          id: string;
          member_id: string;
          skill_id: string;
          proficiency: string;
          years_of_experience: number | null;
          is_willing_to_mentor: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          skill_id: string;
          proficiency?: string;
          years_of_experience?: number | null;
          is_willing_to_mentor?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          skill_id?: string;
          proficiency?: string;
          years_of_experience?: number | null;
          is_willing_to_mentor?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };
      availability: {
        Row: {
          id: string;
          member_id: string;
          date: string;
          status: string;
          time_slots: Json | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          date: string;
          status?: string;
          time_slots?: Json | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          date?: string;
          status?: string;
          time_slots?: Json | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      engagement_metrics: {
        Row: {
          id: string;
          member_id: string;
          total_events_attended: number | null;
          events_attended_last_3_months: number | null;
          events_attended_last_6_months: number | null;
          events_organized: number | null;
          volunteer_hours: number | null;
          total_contributions: number | null;
          feedback_given: number | null;
          referrals_made: number | null;
          engagement_score: number | null;
          last_event_date: string | null;
          last_activity_date: string | null;
          calculated_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          total_events_attended?: number | null;
          events_attended_last_3_months?: number | null;
          events_attended_last_6_months?: number | null;
          events_organized?: number | null;
          volunteer_hours?: number | null;
          total_contributions?: number | null;
          feedback_given?: number | null;
          referrals_made?: number | null;
          engagement_score?: number | null;
          last_event_date?: string | null;
          last_activity_date?: string | null;
          calculated_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          total_events_attended?: number | null;
          events_attended_last_3_months?: number | null;
          events_attended_last_6_months?: number | null;
          events_organized?: number | null;
          volunteer_hours?: number | null;
          total_contributions?: number | null;
          feedback_given?: number | null;
          referrals_made?: number | null;
          engagement_score?: number | null;
          last_event_date?: string | null;
          last_activity_date?: string | null;
          calculated_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      leadership_assessments: {
        Row: {
          id: string;
          member_id: string;
          engagement_score: number | null;
          tenure_score: number | null;
          skills_score: number | null;
          leadership_experience_score: number | null;
          training_score: number | null;
          readiness_score: number | null;
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
          engagement_score?: number | null;
          tenure_score?: number | null;
          skills_score?: number | null;
          leadership_experience_score?: number | null;
          training_score?: number | null;
          readiness_score?: number | null;
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
          engagement_score?: number | null;
          tenure_score?: number | null;
          skills_score?: number | null;
          leadership_experience_score?: number | null;
          training_score?: number | null;
          readiness_score?: number | null;
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
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          phone: string | null;
          chapter_id: string | null;
          approved_email_id: string | null;
          approved_at: string | null;
          approved_by: string | null;
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
          approved_email_id?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
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
          approved_email_id?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      budgets: {
        Row: {
          id: string;
          chapter_id: string;
          name: string;
          description: string | null;
          fiscal_year: number;
          period: string;
          quarter: number | null;
          start_date: string;
          end_date: string;
          total_amount: number;
          allocated_amount: number;
          spent_amount: number;
          status: string;
          approved_by: string | null;
          approved_at: string | null;
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
          period: string;
          quarter?: number | null;
          start_date: string;
          end_date: string;
          total_amount: number;
          allocated_amount?: number;
          spent_amount?: number;
          status?: string;
          approved_by?: string | null;
          approved_at?: string | null;
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
          period?: string;
          quarter?: number | null;
          start_date?: string;
          end_date?: string;
          total_amount?: number;
          status?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      budget_allocations: {
        Row: {
          id: string;
          budget_id: string;
          category_id: string;
          amount: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          budget_id: string;
          category_id: string;
          amount: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          budget_id?: string;
          category_id?: string;
          amount?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      expense_categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          color: string | null;
          icon: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          color?: string | null;
          icon?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          color?: string | null;
          icon?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          id: string;
          chapter_id: string;
          budget_id: string | null;
          category_id: string;
          event_id: string | null;
          title: string;
          description: string | null;
          vendor_name: string | null;
          invoice_number: string | null;
          amount: number;
          expense_date: string;
          status: string;
          submitted_by: string;
          submitted_at: string | null;
          approved_by: string | null;
          approved_at: string | null;
          rejection_reason: string | null;
          payment_method: string | null;
          payment_ref: string | null;
          receipt_url: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          chapter_id: string;
          budget_id?: string | null;
          category_id: string;
          event_id?: string | null;
          title: string;
          description?: string | null;
          vendor_name?: string | null;
          invoice_number?: string | null;
          amount: number;
          expense_date: string;
          status?: string;
          submitted_by: string;
          submitted_at?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          rejection_reason?: string | null;
          payment_method?: string | null;
          payment_ref?: string | null;
          receipt_url?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          chapter_id?: string;
          budget_id?: string | null;
          category_id?: string;
          event_id?: string | null;
          title?: string;
          description?: string | null;
          amount?: number;
          expense_date?: string;
          status?: string;
          submitted_by?: string;
          submitted_at?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          rejection_reason?: string | null;
          payment_method?: string | null;
          payment_ref?: string | null;
          receipt_url?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };
      sponsorship_tiers: {
        Row: {
          id: string;
          chapter_id: string;
          name: string;
          tier_level: string;
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
          tier_level: string;
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
          tier_level?: string;
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
        Relationships: [];
      };
      sponsorship_deals: {
        Row: {
          id: string;
          chapter_id: string;
          sponsor_id: string;
          deal_name: string;
          tier_id: string | null;
          deal_stage: string;
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
          deal_stage?: string;
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
          deal_stage?: string;
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
        Relationships: [];
      };
      sponsorship_payments: {
        Row: {
          id: string;
          deal_id: string;
          amount: number;
          payment_date: string;
          payment_method: string;
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
          payment_method: string;
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
          payment_method?: string;
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
        Relationships: [];
      };
      reimbursement_requests: {
        Row: {
          id: string;
          chapter_id: string;
          expense_id: string | null;
          event_id: string | null;
          requester_id: string;
          title: string;
          description: string | null;
          amount: number;
          expense_date: string;
          category: string;
          payment_method: string | null;
          payment_method_preference: string | null;
          receipt_url: string | null;
          status: string;
          current_approver_id: string | null;
          submitted_at: string | null;
          final_approved_at: string | null;
          final_approved_by: string | null;
          rejection_reason: string | null;
          paid_at: string | null;
          payment_date: string | null;
          payment_ref: string | null;
          payment_reference: string | null;
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
          title: string;
          description?: string | null;
          amount: number;
          expense_date: string;
          category: string;
          payment_method?: string | null;
          payment_method_preference?: string | null;
          receipt_url?: string | null;
          status?: string;
          current_approver_id?: string | null;
          submitted_at?: string | null;
          final_approved_at?: string | null;
          final_approved_by?: string | null;
          rejection_reason?: string | null;
          paid_at?: string | null;
          payment_date?: string | null;
          payment_ref?: string | null;
          payment_reference?: string | null;
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
          title?: string;
          description?: string | null;
          amount?: number;
          expense_date?: string;
          category?: string;
          payment_method?: string | null;
          payment_method_preference?: string | null;
          receipt_url?: string | null;
          status?: string;
          current_approver_id?: string | null;
          submitted_at?: string | null;
          final_approved_at?: string | null;
          final_approved_by?: string | null;
          rejection_reason?: string | null;
          paid_at?: string | null;
          payment_date?: string | null;
          payment_ref?: string | null;
          payment_reference?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reimbursement_approvals: {
        Row: {
          id: string;
          request_id: string;
          approver_id: string;
          approval_level: number;
          status: string;
          action: string | null;
          comments: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          approver_id: string;
          approval_level: number;
          status?: string;
          action?: string | null;
          comments?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          approver_id?: string;
          approval_level?: number;
          status?: string;
          action?: string | null;
          comments?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          chapter_id: string;
          title: string;
          description: string | null;
          category: string;
          start_date: string;
          end_date: string;
          registration_start_date: string | null;
          registration_end_date: string | null;
          venue_id: string | null;
          venue_address: string | null;
          is_virtual: boolean;
          is_featured: boolean;
          virtual_meeting_link: string | null;
          max_capacity: number | null;
          current_registrations: number;
          waitlist_enabled: boolean;
          requires_approval: boolean;
          send_reminders: boolean;
          allow_guests: boolean;
          guest_limit: number | null;
          status: string;
          template_id: string | null;
          organizer_id: string;
          banner_url: string | null;
          banner_image_url: string | null;
          estimated_budget: number | null;
          attachments: any;
          custom_fields: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          chapter_id: string;
          title: string;
          description?: string | null;
          category: string;
          start_date: string;
          end_date: string;
          registration_start_date?: string | null;
          registration_end_date?: string | null;
          venue_id?: string | null;
          venue_address?: string | null;
          is_virtual?: boolean;
          is_featured?: boolean;
          virtual_meeting_link?: string | null;
          max_capacity?: number | null;
          current_registrations?: number;
          waitlist_enabled?: boolean;
          requires_approval?: boolean;
          send_reminders?: boolean;
          allow_guests?: boolean;
          guest_limit?: number | null;
          status?: string;
          template_id?: string | null;
          organizer_id: string;
          banner_url?: string | null;
          banner_image_url?: string | null;
          estimated_budget?: number | null;
          attachments?: any;
          custom_fields?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          chapter_id?: string;
          title?: string;
          description?: string | null;
          category?: string;
          start_date?: string;
          end_date?: string;
          registration_start_date?: string | null;
          registration_end_date?: string | null;
          venue_id?: string | null;
          venue_address?: string | null;
          is_virtual?: boolean;
          is_featured?: boolean;
          virtual_meeting_link?: string | null;
          max_capacity?: number | null;
          current_registrations?: number;
          waitlist_enabled?: boolean;
          requires_approval?: boolean;
          send_reminders?: boolean;
          allow_guests?: boolean;
          guest_limit?: number | null;
          status?: string;
          template_id?: string | null;
          organizer_id?: string;
          banner_url?: string | null;
          banner_image_url?: string | null;
          estimated_budget?: number | null;
          attachments?: any;
          custom_fields?: any;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      event_templates: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          category: string;
          default_duration_hours: number;
          template_data: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          category: string;
          default_duration_hours: number;
          template_data?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          category?: string;
          default_duration_hours?: number;
          template_data?: any;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      event_rsvps: {
        Row: {
          id: string;
          event_id: string;
          member_id: string;
          status: string;
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
          status?: string;
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
          status?: string;
          guests_count?: number;
          dietary_restrictions?: string | null;
          special_requirements?: string | null;
          checked_in_at?: string | null;
          checked_in_by?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
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
          status: string;
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
          status?: string;
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
          status?: string;
          dietary_restrictions?: string | null;
          special_requirements?: string | null;
          checked_in_at?: string | null;
          checked_in_by?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
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
        Relationships: [];
      };
      event_volunteers: {
        Row: {
          id: string;
          event_id: string;
          member_id: string;
          role_id: string | null;
          role_name: string;
          status: string;
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
          status?: string;
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
          status?: string;
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };
      venues: {
        Row: {
          id: string;
          name: string;
          address: string;
          capacity: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address: string;
          capacity?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string;
          capacity?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      venue_bookings: {
        Row: {
          id: string;
          event_id: string;
          venue_id: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          venue_id: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          venue_id?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      resources: {
        Row: {
          id: string;
          name: string;
          type: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      resource_bookings: {
        Row: {
          id: string;
          event_id: string;
          resource_id: string;
          quantity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          resource_id: string;
          quantity: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          resource_id?: string;
          quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      verticals: {
        Row: {
          id: string;
          chapter_id: string;
          name: string;
          slug: string;
          description: string | null;
          color: string | null;
          icon: string | null;
          is_active: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          chapter_id: string;
          name: string;
          slug: string;
          description?: string | null;
          color?: string | null;
          icon?: string | null;
          is_active?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          chapter_id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          color?: string | null;
          icon?: string | null;
          is_active?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'verticals_chapter_id_fkey';
            columns: ['chapter_id'];
            isOneToOne: false;
            referencedRelation: 'chapters';
            referencedColumns: ['id'];
          }
        ];
      };
      vertical_chairs: {
        Row: {
          id: string;
          vertical_id: string;
          member_id: string;
          role: string;
          term_start_date: string;
          term_end_date: string | null;
          responsibilities: string | null;
          is_current: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vertical_id: string;
          member_id: string;
          role?: string;
          term_start_date: string;
          term_end_date?: string | null;
          responsibilities?: string | null;
          is_current?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vertical_id?: string;
          member_id?: string;
          role?: string;
          term_start_date?: string;
          term_end_date?: string | null;
          responsibilities?: string | null;
          is_current?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vertical_chairs_vertical_id_fkey';
            columns: ['vertical_id'];
            isOneToOne: false;
            referencedRelation: 'verticals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vertical_chairs_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          }
        ];
      };
      vertical_plans: {
        Row: {
          id: string;
          vertical_id: string;
          fiscal_year: number;
          plan_title: string;
          plan_description: string | null;
          vision_statement: string | null;
          objectives: Json | null;
          budget_allocated: number;
          status: string;
          created_by: string;
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vertical_id: string;
          fiscal_year: number;
          plan_title: string;
          plan_description?: string | null;
          vision_statement?: string | null;
          objectives?: Json | null;
          budget_allocated?: number;
          status?: string;
          created_by: string;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vertical_id?: string;
          fiscal_year?: number;
          plan_title?: string;
          plan_description?: string | null;
          vision_statement?: string | null;
          objectives?: Json | null;
          budget_allocated?: number;
          status?: string;
          created_by?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vertical_plans_vertical_id_fkey';
            columns: ['vertical_id'];
            isOneToOne: false;
            referencedRelation: 'verticals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vertical_plans_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vertical_plans_approved_by_fkey';
            columns: ['approved_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          }
        ];
      };
      vertical_kpis: {
        Row: {
          id: string;
          plan_id: string;
          kpi_name: string;
          metric_type: string;
          target_q1: number;
          target_q2: number;
          target_q3: number;
          target_q4: number;
          target_annual: number;
          weight: number;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          kpi_name: string;
          metric_type: string;
          target_q1?: number;
          target_q2?: number;
          target_q3?: number;
          target_q4?: number;
          weight?: number;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          plan_id?: string;
          kpi_name?: string;
          metric_type?: string;
          target_q1?: number;
          target_q2?: number;
          target_q3?: number;
          target_q4?: number;
          weight?: number;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vertical_kpis_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'vertical_plans';
            referencedColumns: ['id'];
          }
        ];
      };
      vertical_kpi_actuals: {
        Row: {
          id: string;
          kpi_id: string;
          quarter: number;
          actual_value: number;
          recorded_date: string;
          completion_percentage: number;
          notes: string | null;
          recorded_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          kpi_id: string;
          quarter: number;
          actual_value: number;
          recorded_date?: string;
          notes?: string | null;
          recorded_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          kpi_id?: string;
          quarter?: number;
          actual_value?: number;
          recorded_date?: string;
          notes?: string | null;
          recorded_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vertical_kpi_actuals_kpi_id_fkey';
            columns: ['kpi_id'];
            isOneToOne: false;
            referencedRelation: 'vertical_kpis';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vertical_kpi_actuals_recorded_by_fkey';
            columns: ['recorded_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          }
        ];
      };
      vertical_members: {
        Row: {
          id: string;
          vertical_id: string;
          member_id: string;
          role: string | null;
          joined_at: string;
          left_at: string | null;
          is_active: boolean;
          contribution_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vertical_id: string;
          member_id: string;
          role?: string | null;
          joined_at?: string;
          left_at?: string | null;
          is_active?: boolean;
          contribution_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vertical_id?: string;
          member_id?: string;
          role?: string | null;
          joined_at?: string;
          left_at?: string | null;
          is_active?: boolean;
          contribution_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vertical_members_vertical_id_fkey';
            columns: ['vertical_id'];
            isOneToOne: false;
            referencedRelation: 'verticals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vertical_members_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          }
        ];
      };
      vertical_activities: {
        Row: {
          id: string;
          vertical_id: string;
          event_id: string | null;
          activity_date: string;
          activity_title: string;
          activity_type: string;
          description: string | null;
          beneficiaries_count: number;
          volunteer_hours: number;
          cost_incurred: number;
          impact_notes: string | null;
          photo_urls: string[] | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vertical_id: string;
          event_id?: string | null;
          activity_date: string;
          activity_title: string;
          activity_type: string;
          description?: string | null;
          beneficiaries_count?: number;
          volunteer_hours?: number;
          cost_incurred?: number;
          impact_notes?: string | null;
          photo_urls?: string[] | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vertical_id?: string;
          event_id?: string | null;
          activity_date?: string;
          activity_title?: string;
          activity_type?: string;
          description?: string | null;
          beneficiaries_count?: number;
          volunteer_hours?: number;
          cost_incurred?: number;
          impact_notes?: string | null;
          photo_urls?: string[] | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vertical_activities_vertical_id_fkey';
            columns: ['vertical_id'];
            isOneToOne: false;
            referencedRelation: 'verticals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vertical_activities_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vertical_activities_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          }
        ];
      };
      vertical_performance_reviews: {
        Row: {
          id: string;
          vertical_id: string;
          chair_id: string;
          review_period: string;
          fiscal_year: number;
          quarter: number;
          overall_rating: number;
          kpi_achievement_rate: number;
          budget_utilization_rate: number;
          event_completion_rate: number;
          strengths: string | null;
          areas_for_improvement: string | null;
          recommendations: string | null;
          reviewed_by: string;
          reviewed_at: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vertical_id: string;
          chair_id: string;
          review_period: string;
          fiscal_year: number;
          quarter: number;
          overall_rating: number;
          kpi_achievement_rate?: number;
          budget_utilization_rate?: number;
          event_completion_rate?: number;
          strengths?: string | null;
          areas_for_improvement?: string | null;
          recommendations?: string | null;
          reviewed_by: string;
          reviewed_at?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vertical_id?: string;
          chair_id?: string;
          review_period?: string;
          fiscal_year?: number;
          quarter?: number;
          overall_rating?: number;
          kpi_achievement_rate?: number;
          budget_utilization_rate?: number;
          event_completion_rate?: number;
          strengths?: string | null;
          areas_for_improvement?: string | null;
          recommendations?: string | null;
          reviewed_by?: string;
          reviewed_at?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vertical_performance_reviews_vertical_id_fkey';
            columns: ['vertical_id'];
            isOneToOne: false;
            referencedRelation: 'verticals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vertical_performance_reviews_chair_id_fkey';
            columns: ['chair_id'];
            isOneToOne: false;
            referencedRelation: 'vertical_chairs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vertical_performance_reviews_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          }
        ];
      };
      vertical_achievements: {
        Row: {
          id: string;
          vertical_id: string;
          achievement_date: string;
          title: string;
          description: string | null;
          category: string;
          impact_metrics: Json | null;
          recognition_type: string | null;
          photo_urls: string[] | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vertical_id: string;
          achievement_date: string;
          title: string;
          description?: string | null;
          category: string;
          impact_metrics?: Json | null;
          recognition_type?: string | null;
          photo_urls?: string[] | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vertical_id?: string;
          achievement_date?: string;
          title?: string;
          description?: string | null;
          category?: string;
          impact_metrics?: Json | null;
          recognition_type?: string | null;
          photo_urls?: string[] | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vertical_achievements_vertical_id_fkey';
            columns: ['vertical_id'];
            isOneToOne: false;
            referencedRelation: 'verticals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vertical_achievements_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          }
        ];
      };
      // Note: Other tables are in the complete generated types but truncated here for brevity
      // This file focuses on the new vertical tracking tables
    };
    Views: {
      vertical_kpi_progress: {
        Row: {
          plan_id: string | null;
          vertical_id: string | null;
          fiscal_year: number | null;
          total_kpis: number | null;
          completed_kpis: number | null;
          in_progress_kpis: number | null;
          not_started_kpis: number | null;
          overall_completion: number | null;
          weighted_achievement: number | null;
        };
      };
      vertical_impact_metrics: {
        Row: {
          vertical_id: string | null;
          fiscal_year: number | null;
          total_activities: number | null;
          total_events: number | null;
          total_beneficiaries: number | null;
          total_volunteer_hours: number | null;
          total_cost: number | null;
          avg_beneficiaries_per_activity: number | null;
          cost_per_beneficiary: number | null;
        };
      };
    };
    Functions: {
      calculate_vertical_ranking: {
        Args: {
          p_fiscal_year: number;
        };
        Returns: {
          vertical_id: string;
          vertical_name: string;
          rank: number;
          total_score: number;
          kpi_achievement: number;
          budget_utilization: number;
          impact_score: number;
        }[];
      };
      check_kpi_alerts: {
        Args: {
          p_vertical_id: string;
          p_quarter: number;
        };
        Returns: {
          kpi_id: string;
          kpi_name: string;
          target: number;
          actual: number;
          completion: number;
          alert_type: string;
          message: string;
        }[];
      };
    };
    Enums: {
      award_frequency: 'annual' | 'quarterly' | 'monthly' | 'one_time';
      award_cycle_status:
        | 'draft'
        | 'nomination_open'
        | 'nomination_closed'
        | 'voting_open'
        | 'voting_closed'
        | 'completed';
      nomination_status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
      budget_status: 'draft' | 'approved' | 'active' | 'closed';
      budget_period: 'quarterly' | 'annual' | 'custom';
      expense_status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';
      reimbursement_status:
        | 'draft'
        | 'submitted'
        | 'pending_approval'
        | 'approved'
        | 'rejected'
        | 'paid';
      vertical_status: 'draft' | 'active' | 'archived';
      plan_status: 'draft' | 'submitted' | 'approved' | 'active' | 'completed';
      metric_type: 'count' | 'percentage' | 'amount' | 'hours' | 'score';
      activity_type:
        | 'event'
        | 'meeting'
        | 'campaign'
        | 'workshop'
        | 'outreach'
        | 'other';
      achievement_category:
        | 'award'
        | 'milestone'
        | 'recognition'
        | 'impact'
        | 'innovation';
      review_status: 'pending' | 'completed' | 'published';
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
      booking_status: 'pending' | 'confirmed' | 'cancelled';
      volunteer_status: 'invited' | 'accepted' | 'declined' | 'completed';
      proficiency_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
      availability_status: 'available' | 'busy' | 'unavailable';
      skill_category:
        | 'technical'
        | 'business'
        | 'creative'
        | 'leadership'
        | 'communication'
        | 'other';
    };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type Inserts<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type Updates<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];

// Legacy Constants export for backwards compatibility
export const Constants = {
  public: {
    Enums: {
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
      ] as const,
      event_status: [
        'draft',
        'published',
        'ongoing',
        'completed',
        'cancelled'
      ] as const,
      booking_status: [
        'pending',
        'confirmed',
        'cancelled',
        'rejected'
      ] as const,
      rsvp_status: [
        'pending',
        'confirmed',
        'declined',
        'waitlist',
        'attended',
        'no_show'
      ] as const,
      volunteer_status: [
        'invited',
        'accepted',
        'declined',
        'confirmed',
        'completed',
        'cancelled'
      ] as const
    }
  }
} as const;
