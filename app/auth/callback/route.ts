/**
 * OAuth Callback Route Handler
 *
 * Handles OAuth provider callbacks (Google, etc.)
 *
 * On first login, automatically creates member record from approved request.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/dashboard';

  if (code) {
    const supabase = await createServerSupabaseClient();

    // Exchange code for session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Check if this is first login (no member record exists)
      const { data: existingMember } = await supabase
        .from('members')
        .select('id')
        .eq('id', data.user.id)
        .single();

      // If no member record exists, create one from the approved request
      if (!existingMember) {
        await createMemberFromRequest(data.user.id, data.user.email!);
      }

      // Successful authentication - redirect to dashboard or specified page
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // Authentication failed - redirect to login with error
  return NextResponse.redirect(
    new URL('/login?error=auth_failed', requestUrl.origin)
  );
}

/**
 * Auto-create member record from approved request on first login
 */
async function createMemberFromRequest(userId: string, email: string) {
  const supabase = await createServerSupabaseClient();

  try {
    // 1. Get the approved email record
    const { data: approvedEmail } = await supabase
      .from('approved_emails')
      .select('*, request:member_requests(*)')
      .eq('email', email)
      .single();

    if (!approvedEmail || !approvedEmail.request) {
      console.log('No approved request found for email:', email);
      return;
    }

    const request = approvedEmail.request;

    // 2. Create member record with data from request
    const { data: member, error: memberError } = await supabase
      .from('members')
      .insert({
        id: userId,
        chapter_id:
          approvedEmail.assigned_chapter_id || request.preferred_chapter_id,

        // Basic Info
        email: request.email,
        phone: request.phone,
        date_of_birth: request.date_of_birth,
        gender: request.gender,

        // Professional Info
        company: request.company,
        designation: request.designation,
        industry: request.industry,
        years_of_experience: request.years_of_experience,
        linkedin_url: request.linkedin_url,

        // Personal Info
        address: request.address,
        city: request.city,
        state: request.state,
        country: request.country,
        pincode: request.pincode,

        // Emergency Contact
        emergency_contact_name: request.emergency_contact_name,
        emergency_contact_phone: request.emergency_contact_phone,
        emergency_contact_relationship: request.emergency_contact_relationship,

        // Membership
        membership_status: 'active',
        member_since: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    if (memberError) {
      console.error('Error creating member record:', memberError);
      return;
    }

    // 3. Update approved_emails to mark member as created
    await supabase
      .from('approved_emails')
      .update({
        member_created: true,
        created_member_id: userId
      })
      .eq('id', approvedEmail.id);

    // 4. Update member_requests to link created member
    await supabase
      .from('member_requests')
      .update({
        created_member_id: userId
      })
      .eq('id', request.id);

    console.log('✅ Member record created automatically for:', email);
  } catch (error) {
    console.error('Error in createMemberFromRequest:', error);
  }
}
