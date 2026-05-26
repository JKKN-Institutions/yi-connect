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
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');
  const next = requestUrl.searchParams.get('next') || '/dashboard';

  // Check if OAuth provider returned an error
  if (error) {
    console.error('OAuth error:', error, errorDescription);

    // Check if it's an unauthorized email error (from database trigger)
    if (
      errorDescription?.includes('not authorized') ||
      errorDescription?.includes('not approved') ||
      errorDescription?.includes('Database error saving new user') ||
      error === 'server_error'
    ) {
      return NextResponse.redirect(
        new URL('/login?error=unauthorized', requestUrl.origin)
      );
    }

    // Generic auth error
    return NextResponse.redirect(
      new URL('/login?error=auth_failed', requestUrl.origin)
    );
  }

  if (code) {
    const supabase = await createServerSupabaseClient();

    // Exchange code for session
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError && data.user) {
      // Check if this is first login (no member record exists)
      const { data: existingMember } = await supabase
        .schema('yi_connect')
        .from('members')
        .select('id')
        .eq('id', data.user.id)
        .single();

      // If no member record exists, create one from the approved request
      if (!existingMember) {
        await createMemberFromRequest(data.user.id, data.user.email!);
      }

      // Check if user has registrations in YiFi/YiFuture/YIP and set cookies
      const response = NextResponse.redirect(new URL(next === '/dashboard' ? '/home' : next, requestUrl.origin));
      await setModuleCookies(supabase, data.user.email!, response);
      return response;
    }

    // Log exchange error for debugging
    if (exchangeError) {
      console.error('Exchange code error:', exchangeError);
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
      .schema('yi_connect')
      .from('approved_emails')
      .select('*, request:member_requests(*)')
      .eq('email', email)
      .single();

    if (!approvedEmail || !approvedEmail.request) {
      return;
    }

    const request = approvedEmail.request;

    // 2. Create member record with data from request
    const { data: member, error: memberError } = await supabase
      .schema('yi_connect')
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
      .schema('yi_connect')
      .from('approved_emails')
      .update({
        member_created: true,
        created_member_id: userId
      })
      .eq('id', approvedEmail.id);

    // 4. Update member_requests to link created member
    await supabase
      .schema('yi_connect')
      .from('member_requests')
      .update({
        created_member_id: userId
      })
      .eq('id', request.id);
  } catch (error) {
    console.error('Error in createMemberFromRequest:', error);
  }
}

/**
 * After Google sign-in, check if the user's email exists in YiFi, YiFuture,
 * or YIP registrant tables and auto-set the appropriate session cookies.
 * This eliminates the need for separate access code entry.
 */
async function setModuleCookies(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  email: string,
  response: NextResponse
) {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  };

  try {
    // Check YiFi registrants by email
    const { data: yifiData } = await supabase.rpc('yifi_find_by_email', {
      p_email: email,
    });
    if (yifiData?.id) {
      response.cookies.set('yifi_session', JSON.stringify({
        type: 'member',
        id: yifiData.id,
        name: yifiData.full_name,
        editionId: yifiData.edition_id,
      }), cookieOptions);
    }
  } catch {}

  try {
    // Check YiFuture delegates
    const { data: futureDelegate } = await supabase
      .schema('future' as any)
      .from('delegates')
      .select('id, full_name, edition_id, access_code')
      .eq('email', email)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (futureDelegate) {
      response.cookies.set('yifuture_session', JSON.stringify({
        type: 'delegate',
        id: futureDelegate.id,
        name: futureDelegate.full_name,
        accessCode: futureDelegate.access_code,
      }), cookieOptions);
    }
  } catch {}

  try {
    // Check YIP participants
    const { data: yipParticipant } = await supabase
      .from('participants')
      .select('id, full_name, access_code, event_id')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (yipParticipant) {
      response.cookies.set('yip_session', JSON.stringify({
        type: 'participant',
        id: yipParticipant.id,
        name: yipParticipant.full_name,
        eventId: yipParticipant.event_id,
      }), cookieOptions);
    }
  } catch {}
}
