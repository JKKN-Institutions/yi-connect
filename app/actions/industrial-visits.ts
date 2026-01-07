/**
 * Industrial Visits Module - Server Actions
 * All mutation operations for IV management
 */

'use server';

import * as XLSX from 'xlsx';
import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { sendEmail, sendBatchEmails } from '@/lib/email';
import {
  eventCancellationEmail,
  ivBookingConfirmationEmail,
  ivWaitlistPromotionEmail,
  industryPortalInviteEmail,
  adminNewIVSlotEmail,
  waitlistCapacityNotificationEmail,
  ivRequestNotificationEmail,
} from '@/lib/email/templates';
import {
  createIVSchema,
  updateIVSchema,
  publishIVSchema,
  cancelIVSchema,
  rateHostSchema,
  createIVBookingSchema,
  updateIVBookingSchema,
  cancelIVBookingSchema,
  joinWaitlistSchema,
  leaveWaitlistSchema,
  promoteFromWaitlistSchema,
  createIndustryPortalUserSchema,
  updateIndustryPortalUserSchema,
  deleteIndustryPortalUserSchema,
  updateCarpoolPreferenceSchema,
  industryCreateIVSlotSchema,
  industryIncreaseCapacitySchema,
  memberRequestIVSchema,
  exportIVAttendeesSchema,
} from '@/lib/validations/industrial-visit';
import type { IVActionResult, WaitlistPromotion } from '@/types/industrial-visit';

// ==================== INDUSTRIAL VISIT CRUD ====================

/**
 * Create new Industrial Visit (Admin/Chair)
 */
export async function createIV(formData: FormData): Promise<IVActionResult<{ id: string }>> {
  try {
    const supabase = await createClient();

    // Parse and validate form data
    const rawData = {
      title: formData.get('title') as string,
      description: formData.get('description') as string | null,
      start_date: formData.get('start_date') as string,
      end_date: formData.get('end_date') as string,
      max_capacity: formData.get('max_capacity') ? parseInt(formData.get('max_capacity') as string) : null,
      industry_id: formData.get('industry_id') as string,
      requirements: formData.get('requirements') as string | null,
      learning_outcomes: formData.get('learning_outcomes') as string | null,
      contact_person_name: formData.get('contact_person_name') as string | null,
      contact_person_phone: formData.get('contact_person_phone') as string | null,
      contact_person_role: formData.get('contact_person_role') as string | null,
      logistics_parking: formData.get('logistics_parking') as string | null,
      logistics_food: formData.get('logistics_food') as string | null,
      logistics_meeting_point: formData.get('logistics_meeting_point') as string | null,
      logistics_arrival_time: formData.get('logistics_arrival_time') as string | null,
      entry_method: (formData.get('entry_method') as 'manual' | 'self_service') || 'manual',
      waitlist_enabled: formData.get('waitlist_enabled') === 'true',
      send_reminders: formData.get('send_reminders') !== 'false',
      allow_guests: formData.get('allow_guests') === 'true',
      guest_limit: formData.get('guest_limit') ? parseInt(formData.get('guest_limit') as string) : 0,
      banner_image_url: formData.get('banner_image_url') as string | null,
      tags: formData.get('tags') ? JSON.parse(formData.get('tags') as string) : null,
    };

    const validatedData = createIVSchema.parse(rawData);

    // Get current user's chapter
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, chapter_id')
      .eq('id', user.id)
      .single();

    if (!profile?.chapter_id) {
      return { success: false, error: 'User not associated with a chapter' };
    }

    // Create event
    const { data, error } = await supabase
      .from('events')
      .insert({
        ...validatedData,
        chapter_id: profile.chapter_id,
        category: 'industrial_visit',
        organizer_id: profile.id,
        status: 'draft',
        current_registrations: 0,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating IV:', error);
      return { success: false, error: `Failed to create industrial visit: ${error.message}` };
    }

    // Invalidate cache
    revalidateTag('industrial-visits', 'max');
    revalidateTag(`chapter-${profile.chapter_id}-ivs`, 'max');

    return {
      success: true,
      data: { id: data.id },
      message: 'Industrial visit created successfully',
    };
  } catch (error: unknown) {
    console.error('Error in createIV:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create industrial visit',
    };
  }
}

/**
 * Update Industrial Visit
 */
export async function updateIV(formData: FormData): Promise<IVActionResult> {
  try {
    const supabase = await createClient();

    const id = formData.get('id') as string;
    if (!id) {
      return { success: false, error: 'IV ID is required' };
    }

    // Parse updates
    const updates: Record<string, unknown> = {};
    const fields = [
      'title', 'description', 'start_date', 'end_date', 'max_capacity',
      'requirements', 'learning_outcomes',
      'contact_person_name', 'contact_person_phone', 'contact_person_role',
      'logistics_parking', 'logistics_food', 'logistics_meeting_point', 'logistics_arrival_time',
      'banner_image_url'
    ];

    fields.forEach(field => {
      const value = formData.get(field);
      if (value !== null && value !== undefined) {
        updates[field] = value;
      }
    });

    // Handle numeric fields
    if (formData.has('max_capacity')) {
      updates.max_capacity = parseInt(formData.get('max_capacity') as string) || null;
    }

    // Handle boolean fields
    if (formData.has('waitlist_enabled')) {
      updates.waitlist_enabled = formData.get('waitlist_enabled') === 'true';
    }

    // Validate
    const validatedData = updateIVSchema.parse({ id, ...updates });

    // Check ownership/permissions
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Update
    const { error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', id)
      .eq('category', 'industrial_visit');

    if (error) {
      console.error('Error updating IV:', error);
      return { success: false, error: `Failed to update industrial visit: ${error.message}` };
    }

    // Invalidate cache
    revalidateTag('industrial-visits', 'max');
    revalidateTag(`iv-${id}`, 'max');

    return {
      success: true,
      message: 'Industrial visit updated successfully',
    };
  } catch (error: unknown) {
    console.error('Error in updateIV:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update industrial visit',
    };
  }
}

/**
 * Publish Industrial Visit (make it visible to members)
 */
export async function publishIV(id: string): Promise<IVActionResult> {
  try {
    const supabase = await createClient();

    const validatedData = publishIVSchema.parse({ id });

    const { error } = await supabase
      .from('events')
      .update({ status: 'published' })
      .eq('id', validatedData.id)
      .eq('category', 'industrial_visit');

    if (error) {
      console.error('Error publishing IV:', error);
      return { success: false, error: `Failed to publish industrial visit: ${error.message}` };
    }

    revalidateTag('industrial-visits', 'max');
    revalidateTag(`iv-${id}`, 'max');

    return {
      success: true,
      message: 'Industrial visit published successfully',
    };
  } catch (error: unknown) {
    console.error('Error in publishIV:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to publish industrial visit',
    };
  }
}

/**
 * Cancel Industrial Visit
 */
export async function cancelIV(id: string, reason: string): Promise<IVActionResult> {
  try {
    const supabase = await createClient();

    const validatedData = cancelIVSchema.parse({ id, reason });

    const { error } = await supabase
      .from('events')
      .update({
        status: 'cancelled',
        custom_fields: { cancellation_reason: validatedData.reason }
      })
      .eq('id', validatedData.id)
      .eq('category', 'industrial_visit');

    if (error) {
      console.error('Error cancelling IV:', error);
      return { success: false, error: `Failed to cancel industrial visit: ${error.message}` };
    }

    // Get event details and all attendees for notification
    const { data: eventDetails } = await supabase
      .from('events')
      .select('title, start_date')
      .eq('id', validatedData.id)
      .single();

    const { data: attendees } = await supabase
      .from('event_rsvps')
      .select('member:profiles!event_rsvps_member_id_fkey(full_name, email)')
      .eq('event_id', validatedData.id)
      .eq('status', 'confirmed');

    // Send cancellation emails to all attendees
    if (attendees && attendees.length > 0 && eventDetails) {
      const cancellationEmails = attendees
        .filter((a) => {
          const member = a.member as { email?: string }[] | undefined;
          return member?.[0]?.email;
        })
        .map((attendee) => {
          const member = attendee.member as { email: string; full_name?: string }[];
          const emailTemplate = eventCancellationEmail({
            memberName: member[0]?.full_name || 'Member',
            eventTitle: eventDetails.title,
            reason: validatedData.reason,
          });
          return {
            to: member[0].email,
            subject: emailTemplate.subject,
            html: emailTemplate.html,
          };
        });

      await sendBatchEmails(cancellationEmails);
    }

    revalidateTag('industrial-visits', 'max');
    revalidateTag(`iv-${id}`, 'max');

    return {
      success: true,
      message: 'Industrial visit cancelled. All attendees will be notified.',
    };
  } catch (error: unknown) {
    console.error('Error in cancelIV:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel industrial visit',
    };
  }
}

/**
 * Delete Industrial Visit (soft delete)
 */
export async function deleteIV(id: string): Promise<IVActionResult> {
  try {
    const supabase = await createClient();

    // Check if event has bookings
    const { count } = await supabase
      .from('event_rsvps')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', id);

    if (count && count > 0) {
      return {
        success: false,
        error: 'Cannot delete IV with existing bookings. Cancel it instead.',
      };
    }

    // Soft delete by setting is_active = false
    const { error } = await supabase
      .from('events')
      .update({ is_active: false })
      .eq('id', id)
      .eq('category', 'industrial_visit');

    if (error) {
      console.error('Error deleting IV:', error);
      return { success: false, error: `Failed to delete industrial visit: ${error.message}` };
    }

    revalidateTag('industrial-visits', 'max');

    return {
      success: true,
      message: 'Industrial visit deleted successfully',
    };
  } catch (error: unknown) {
    console.error('Error in deleteIV:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete industrial visit',
    };
  }
}

/**
 * Rate industry host after IV
 */
export async function rateHost(id: string, rating: number, comments?: string): Promise<IVActionResult> {
  try {
    const supabase = await createClient();

    const validatedData = rateHostSchema.parse({ id, host_willingness_rating: rating, comments });

    const { error } = await supabase
      .from('events')
      .update({
        host_willingness_rating: validatedData.host_willingness_rating,
        custom_fields: { host_rating_comments: comments }
      })
      .eq('id', validatedData.id)
      .eq('category', 'industrial_visit');

    if (error) {
      console.error('Error rating host:', error);
      return { success: false, error: `Failed to rate host: ${error.message}` };
    }

    revalidateTag(`iv-${id}`, 'max');

    return {
      success: true,
      message: 'Thank you for your feedback!',
    };
  } catch (error: unknown) {
    console.error('Error in rateHost:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to rate host',
    };
  }
}

// ==================== IV BOOKING CRUD ====================

/**
 * Create IV Booking (Member RSVPs)
 */
export async function createIVBooking(formData: FormData): Promise<IVActionResult<{ id: string }>> {
  try {
    const supabase = await createClient();

    const rawData = {
      event_id: formData.get('event_id') as string,
      member_id: formData.get('member_id') as string,
      family_count: formData.get('family_count') ? parseInt(formData.get('family_count') as string) : 0,
      family_names: formData.get('family_names') ? JSON.parse(formData.get('family_names') as string) : null,
      carpool_status: formData.get('carpool_status') as any || 'not_needed',
      seats_available: formData.get('seats_available') ? parseInt(formData.get('seats_available') as string) : null,
      pickup_location: formData.get('pickup_location') as string | null,
      pickup_details: formData.get('pickup_details') as string | null,
      dietary_restrictions: formData.get('dietary_restrictions') as string | null,
      special_requirements: formData.get('special_requirements') as string | null,
      notes: formData.get('notes') as string | null,
    };

    const validatedData = createIVBookingSchema.parse(rawData);

    // Check capacity
    const { data: capacityCheck } = await supabase.rpc('check_iv_capacity', {
      event_id: validatedData.event_id
    }).single();

    if (!(capacityCheck as any)?.has_capacity) {
      // Event is full - cannot book
      // Note: User would need to manually join waitlist if desired
      return {
        success: false,
        error: 'This industrial visit is currently full. Please check the waitlist or try another event.',
      };
    }

    // Create RSVP
    const { data, error } = await supabase
      .from('event_rsvps')
      .insert({
        ...validatedData,
        status: 'confirmed',
        guests_count: validatedData.family_count,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating IV booking:', error);
      return { success: false, error: `Failed to create booking: ${error.message}` };
    }

    // Invalidate cache
    revalidateTag('industrial-visits', 'max');
    revalidateTag(`iv-${validatedData.event_id}`, 'max');
    revalidateTag(`member-${validatedData.member_id}-bookings`, 'max');

    return {
      success: true,
      data: { id: data.id },
      message: 'Booking confirmed! You will receive a confirmation email shortly.',
    };
  } catch (error: unknown) {
    console.error('Error in createIVBooking:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create booking',
    };
  }
}

/**
 * Update IV Booking
 */
export async function updateIVBooking(formData: FormData): Promise<IVActionResult> {
  try {
    const supabase = await createClient();

    const id = formData.get('id') as string;
    if (!id) {
      return { success: false, error: 'Booking ID is required' };
    }

    const updates: Record<string, unknown> = {};
    const fields = ['family_count', 'carpool_status', 'seats_available', 'pickup_location', 'pickup_details'];

    fields.forEach(field => {
      if (formData.has(field)) {
        const value = formData.get(field);
        updates[field] = value;
      }
    });

    if (formData.has('family_names')) {
      updates.family_names = JSON.parse(formData.get('family_names') as string);
    }

    const validatedData = updateIVBookingSchema.parse({ id, ...updates });

    const { error } = await supabase
      .from('event_rsvps')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating IV booking:', error);
      return { success: false, error: `Failed to update booking: ${error.message}` };
    }

    revalidateTag('industrial-visits', 'max');

    return {
      success: true,
      message: 'Booking updated successfully',
    };
  } catch (error: unknown) {
    console.error('Error in updateIVBooking:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update booking',
    };
  }
}

/**
 * Cancel IV Booking
 */
export async function cancelIVBooking(id: string, reason?: string): Promise<IVActionResult> {
  try {
    const supabase = await createClient();

    const validatedData = cancelIVBookingSchema.parse({ id, reason });

    // Get booking details for event_id
    const { data: booking } = await supabase
      .from('event_rsvps')
      .select('event_id, member_id')
      .eq('id', validatedData.id)
      .single();

    if (!booking) {
      return { success: false, error: 'Booking not found' };
    }

    // Update status to cancelled
    const { error } = await supabase
      .from('event_rsvps')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        notes: reason || null,
      })
      .eq('id', validatedData.id);

    if (error) {
      console.error('Error cancelling IV booking:', error);
      return { success: false, error: `Failed to cancel booking: ${error.message}` };
    }

    // Trigger will auto-promote from waitlist if applicable

    revalidateTag('industrial-visits', 'max');
    revalidateTag(`iv-${booking.event_id}`, 'max');
    revalidateTag(`member-${booking.member_id}-bookings`, 'max');

    return {
      success: true,
      message: 'Booking cancelled successfully',
    };
  } catch (error: unknown) {
    console.error('Error in cancelIVBooking:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel booking',
    };
  }
}

// ==================== WAITLIST OPERATIONS ====================

/**
 * Join Waitlist
 */
export async function joinWaitlist(eventId: string): Promise<IVActionResult<{ id: string }>> {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'You must be logged in to join the waitlist' };
    }

    const validatedData = joinWaitlistSchema.parse({ event_id: eventId, member_id: user.id });

    // Call database function to add to waitlist
    const { data, error } = await supabase.rpc('add_to_waitlist', {
      p_event_id: validatedData.event_id,
      p_member_id: validatedData.member_id
    });

    if (error) {
      console.error('Error joining waitlist:', error);
      return { success: false, error: `Failed to join waitlist: ${error.message}` };
    }

    revalidateTag(`iv-${eventId}`, 'max');
    revalidateTag(`member-${user.id}-waitlist`, 'max');

    return {
      success: true,
      data: { id: data },
      message: 'Added to waitlist. You will be notified when a spot opens up.',
    };
  } catch (error: unknown) {
    console.error('Error in joinWaitlist:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to join waitlist',
    };
  }
}

/**
 * Leave Waitlist
 */
export async function leaveWaitlist(id: string): Promise<IVActionResult> {
  try {
    const supabase = await createClient();

    const validatedData = leaveWaitlistSchema.parse({ id });

    const { error } = await supabase
      .from('iv_waitlist')
      .update({ status: 'withdrawn' })
      .eq('id', validatedData.id);

    if (error) {
      console.error('Error leaving waitlist:', error);
      return { success: false, error: `Failed to leave waitlist: ${error.message}` };
    }

    revalidateTag('industrial-visits', 'max');

    return {
      success: true,
      message: 'Removed from waitlist',
    };
  } catch (error: unknown) {
    console.error('Error in leaveWaitlist:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to leave waitlist',
    };
  }
}

/**
 * Manually promote from waitlist (Admin)
 */
export async function promoteFromWaitlist(eventId: string): Promise<IVActionResult<WaitlistPromotion>> {
  try {
    const supabase = await createClient();

    const validatedData = promoteFromWaitlistSchema.parse({ event_id: eventId });

    // Call database function
    const { data, error } = await supabase.rpc('promote_from_waitlist', {
      p_event_id: validatedData.event_id
    });

    if (error) {
      console.error('Error promoting from waitlist:', error);
      return { success: false, error: `Failed to promote from waitlist: ${error.message}` };
    }

    if (!data || data.length === 0) {
      return { success: false, error: 'No one in waitlist to promote' };
    }

    const promoted = data[0];

    revalidateTag(`iv-${eventId}`, 'max');

    // Get event details and promoted member's email
    const { data: eventDetails } = await supabase
      .from('events')
      .select('title, start_date, industry:industries(name)')
      .eq('id', eventId)
      .single();

    if (eventDetails && promoted.member_email) {
      const visitDate = new Date(eventDetails.start_date).toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const confirmByDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const emailTemplate = ivWaitlistPromotionEmail({
        memberName: promoted.member_name,
        industryName: (eventDetails.industry as any)?.name || eventDetails.title,
        visitDate,
        confirmByDate,
      });

      await sendEmail({
        to: promoted.member_email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      });
    }

    return {
      success: true,
      data: promoted,
      message: `${promoted.member_name} has been promoted from waitlist`,
    };
  } catch (error: unknown) {
    console.error('Error in promoteFromWaitlist:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to promote from waitlist',
    };
  }
}

// ==================== CARPOOL OPERATIONS ====================

/**
 * Update Carpool Preference
 */
export async function updateCarpoolPreference(formData: FormData): Promise<IVActionResult> {
  try {
    const supabase = await createClient();

    const rawData = {
      booking_id: formData.get('booking_id') as string,
      carpool_status: formData.get('carpool_status') as any,
      seats_available: formData.get('seats_available') ? parseInt(formData.get('seats_available') as string) : null,
      pickup_location: formData.get('pickup_location') as string | null,
      pickup_details: formData.get('pickup_details') as string | null,
    };

    const validatedData = updateCarpoolPreferenceSchema.parse(rawData);

    const { error } = await supabase
      .from('event_rsvps')
      .update({
        carpool_status: validatedData.carpool_status,
        seats_available: validatedData.seats_available,
        pickup_location: validatedData.pickup_location,
        pickup_details: validatedData.pickup_details,
      })
      .eq('id', validatedData.booking_id);

    if (error) {
      console.error('Error updating carpool preference:', error);
      return { success: false, error: `Failed to update carpool preference: ${error.message}` };
    }

    revalidateTag('industrial-visits', 'max');

    return {
      success: true,
      message: 'Carpool preference updated successfully',
    };
  } catch (error: unknown) {
    console.error('Error in updateCarpoolPreference:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update carpool preference',
    };
  }
}

// ==================== INDUSTRY PORTAL OPERATIONS ====================

/**
 * Create Industry Portal User
 */
export async function createIndustryPortalUser(formData: FormData): Promise<IVActionResult<{ id: string }>> {
  try {
    const supabase = await createClient();

    const rawData = {
      industry_id: formData.get('industry_id') as string,
      email: formData.get('email') as string,
      full_name: formData.get('full_name') as string,
      phone: formData.get('phone') as string | null,
      role: formData.get('role') as string | null,
      permissions: formData.get('permissions') ? JSON.parse(formData.get('permissions') as string) : undefined,
    };

    const validatedData = createIndustryPortalUserSchema.parse(rawData);

    const { data, error } = await supabase
      .from('industry_portal_users')
      .insert(validatedData)
      .select('id')
      .single();

    if (error) {
      console.error('Error creating industry portal user:', error);
      return { success: false, error: `Failed to create industry portal user: ${error.message}` };
    }

    // Get industry name for the invitation email
    const { data: industry } = await supabase
      .from('industries')
      .select('name')
      .eq('id', validatedData.industry_id)
      .single();

    // Send invitation email
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://yi-connect-app.vercel.app';
    const emailTemplate = industryPortalInviteEmail({
      userName: validatedData.full_name,
      industryName: industry?.name || 'Your Organization',
      role: validatedData.role || 'Portal User',
      inviteLink: `${APP_URL}/industry-portal`,
    });

    await sendEmail({
      to: validatedData.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });

    revalidateTag('industry-portal-users', 'max');

    return {
      success: true,
      data: { id: data.id },
      message: 'Industry portal user created. Invitation email sent.',
    };
  } catch (error: unknown) {
    console.error('Error in createIndustryPortalUser:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create industry portal user',
    };
  }
}

/**
 * Industry Creates IV Slot (Self-Service)
 */
export async function industryCreateIVSlot(formData: FormData): Promise<IVActionResult<{ id: string }>> {
  try {
    const supabase = await createClient();

    // Get authenticated industry user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get industry portal user details
    const { data: portalUser } = await supabase
      .from('industry_portal_users')
      .select('industry_id, industry:industries(chapter_id)')
      .eq('email', user.email)
      .eq('status', 'active')
      .single();

    if (!portalUser) {
      return { success: false, error: 'Industry portal user not found' };
    }

    const rawData = {
      title: formData.get('title') as string,
      description: formData.get('description') as string | null,
      start_date: formData.get('start_date') as string,
      end_date: formData.get('end_date') as string,
      max_capacity: parseInt(formData.get('max_capacity') as string),
      contact_person_name: formData.get('contact_person_name') as string | null,
      contact_person_phone: formData.get('contact_person_phone') as string | null,
      contact_person_role: formData.get('contact_person_role') as string | null,
      requirements: formData.get('requirements') as string | null,
      learning_outcomes: formData.get('learning_outcomes') as string | null,
      logistics_parking: formData.get('logistics_parking') as string | null,
      logistics_food: formData.get('logistics_food') as string | null,
      logistics_meeting_point: formData.get('logistics_meeting_point') as string | null,
      logistics_arrival_time: formData.get('logistics_arrival_time') as string | null,
    };

    const validatedData = industryCreateIVSlotSchema.parse(rawData);

    // Create event with self_service entry method
    const { data, error } = await supabase
      .from('events')
      .insert({
        ...validatedData,
        chapter_id: (portalUser.industry as any).chapter_id,
        industry_id: portalUser.industry_id,
        category: 'industrial_visit',
        entry_method: 'self_service',
        status: 'published', // Auto-publish industry-created slots
        waitlist_enabled: true,
        current_registrations: 0,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating IV slot:', error);
      return { success: false, error: `Failed to create IV slot: ${error.message}` };
    }

    // Get industry and chapter admin details for notification
    const { data: industryDetails } = await supabase
      .from('industries')
      .select('name')
      .eq('id', portalUser.industry_id)
      .single();

    const chapterId = (portalUser.industry as any).chapter_id;

    // Get chapter Chair/Co-Chair emails
    const { data: chapterAdmins } = await supabase
      .from('user_roles')
      .select(`
        user:profiles!user_roles_user_id_fkey(full_name, email)
      `)
      .eq('chapter_id', chapterId)
      .in('role_id', ['Chair', 'Co-Chair']);

    // Send notification to chapter admins
    if (chapterAdmins && chapterAdmins.length > 0) {
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://yi-connect-app.vercel.app';
      const adminEmails = chapterAdmins
        .filter((a) => {
          const user = a.user as { email?: string }[] | undefined;
          return user?.[0]?.email;
        })
        .map((admin) => {
          const user = admin.user as { email: string; full_name?: string }[];
          const emailTemplate = adminNewIVSlotEmail({
            adminName: user[0]?.full_name || 'Admin',
            industryName: industryDetails?.name || 'Industry Partner',
            slotTitle: validatedData.title,
            slotDate: new Date(validatedData.start_date).toLocaleDateString('en-IN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
            capacity: validatedData.max_capacity,
            manageLink: `${APP_URL}/admin/industrial-visits/${data.id}`,
          });
          return {
            to: user[0].email,
            subject: emailTemplate.subject,
            html: emailTemplate.html,
          };
        });

      await sendBatchEmails(adminEmails);
    }

    revalidateTag('industrial-visits', 'max');

    return {
      success: true,
      data: { id: data.id },
      message: 'IV slot created successfully and is now visible to members!',
    };
  } catch (error: unknown) {
    console.error('Error in industryCreateIVSlot:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create IV slot',
    };
  }
}

/**
 * Industry Increases Capacity
 */
export async function industryIncreaseCapacity(id: string, newCapacity: number): Promise<IVActionResult> {
  try {
    const supabase = await createClient();

    const validatedData = industryIncreaseCapacitySchema.parse({ id, new_capacity: newCapacity });

    // Get current capacity
    const { data: event } = await supabase
      .from('events')
      .select('max_capacity, current_registrations')
      .eq('id', validatedData.id)
      .single();

    if (!event) {
      return { success: false, error: 'Event not found' };
    }

    if (event.max_capacity && validatedData.new_capacity <= event.max_capacity) {
      return { success: false, error: 'New capacity must be greater than current capacity' };
    }

    // Update capacity
    const { error } = await supabase
      .from('events')
      .update({ max_capacity: validatedData.new_capacity })
      .eq('id', validatedData.id);

    if (error) {
      console.error('Error increasing capacity:', error);
      return { success: false, error: `Failed to increase capacity: ${error.message}` };
    }

    // Notify waitlisted members about capacity increase
    const { data: eventDetails } = await supabase
      .from('events')
      .select('title, industry:industries(name)')
      .eq('id', validatedData.id)
      .single();

    const { data: waitlistedMembers } = await supabase
      .from('iv_waitlist')
      .select(`
        position,
        member:profiles!iv_waitlist_member_id_fkey(full_name, email)
      `)
      .eq('event_id', validatedData.id)
      .eq('status', 'waiting')
      .order('position', { ascending: true });

    if (waitlistedMembers && waitlistedMembers.length > 0 && eventDetails) {
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://yi-connect-app.vercel.app';
      const waitlistEmails = waitlistedMembers
        .filter((w) => {
          const member = w.member as { email?: string }[] | undefined;
          return member?.[0]?.email;
        })
        .map((waitlisted) => {
          const member = waitlisted.member as { email: string; full_name?: string }[];
          const position = waitlisted.position;
          const emailTemplate = waitlistCapacityNotificationEmail({
            memberName: member[0]?.full_name || 'Member',
            eventTitle: eventDetails.title,
            industryName: (eventDetails.industry as { name?: string } | null)?.name || 'Industry Partner',
            newCapacity: validatedData.new_capacity,
            currentPosition: position,
            bookingLink: `${APP_URL}/industrial-visits`,
          });
          return {
            to: member[0].email,
            subject: emailTemplate.subject,
            html: emailTemplate.html,
          };
        });

      await sendBatchEmails(waitlistEmails);
    }

    revalidateTag(`iv-${id}`, 'max');

    return {
      success: true,
      message: 'Capacity increased. Waitlisted members will be notified.',
    };
  } catch (error: unknown) {
    console.error('Error in industryIncreaseCapacity:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to increase capacity',
    };
  }
}

// ==================== MEMBER REQUEST IV ====================

/**
 * Member Requests New IV
 */
export async function memberRequestIV(formData: FormData): Promise<IVActionResult> {
  try {
    const supabase = await createClient();

    const rawData = {
      industry_id: formData.get('industry_id') as string | null,
      suggested_industry_name: formData.get('suggested_industry_name') as string | null,
      preferred_dates: JSON.parse(formData.get('preferred_dates') as string),
      desired_learning_outcomes: formData.get('desired_learning_outcomes') as string,
      estimated_participants: parseInt(formData.get('estimated_participants') as string),
      additional_notes: formData.get('additional_notes') as string | null,
    };

    const validatedData = memberRequestIVSchema.parse(rawData);

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get user profile
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('full_name, email, chapter_id')
      .eq('id', user.id)
      .single();

    if (!userProfile?.chapter_id) {
      return { success: false, error: 'User not associated with a chapter' };
    }

    // Get industry name if provided
    let industryName = validatedData.suggested_industry_name || 'Not specified';
    if (validatedData.industry_id) {
      const { data: industry } = await supabase
        .from('industries')
        .select('name')
        .eq('id', validatedData.industry_id)
        .single();
      industryName = industry?.name || industryName;
    }

    // Get chapter admin emails
    const { data: chapterAdmins } = await supabase
      .from('user_roles')
      .select('user:profiles!user_roles_user_id_fkey(full_name, email)')
      .eq('chapter_id', userProfile.chapter_id)
      .in('role_id', ['Chair', 'Co-Chair']);

    // Send IV request notification to chapter admins
    if (chapterAdmins && chapterAdmins.length > 0) {
      const adminEmails = chapterAdmins
        .filter((a) => {
          const user = a.user as { email?: string }[] | undefined;
          return user?.[0]?.email;
        })
        .map((admin) => {
          const user = admin.user as { email: string; full_name?: string }[];
          const emailTemplate = ivRequestNotificationEmail({
            adminName: user[0]?.full_name || 'Admin',
            requesterName: userProfile.full_name || 'Member',
            requesterEmail: userProfile.email || user[0]?.email || '',
            industryName,
            preferredDates: validatedData.preferred_dates
              .map((d: string) => new Date(d).toLocaleDateString('en-IN'))
              .join(', '),
            learningOutcomes: validatedData.desired_learning_outcomes,
            estimatedParticipants: validatedData.estimated_participants,
            additionalNotes: validatedData.additional_notes || undefined,
          });
          return {
            to: user[0].email,
            subject: emailTemplate.subject,
            html: emailTemplate.html,
          };
        });

      await sendBatchEmails(adminEmails);
    }

    return {
      success: true,
      message: 'Your IV request has been submitted. The admin team will review it shortly.',
    };
  } catch (error: unknown) {
    console.error('Error in memberRequestIV:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit IV request',
    };
  }
}

// ==================== EXPORT ACTIONS ====================

/**
 * Export IV Attendees
 * Export attendee list in various formats (CSV, XLSX, JSON)
 */
export async function exportIVAttendees(formData: FormData): Promise<IVActionResult<{ data: string; filename: string }>> {
  try {
    const supabase = await createClient();

    const rawData = {
      event_id: formData.get('event_id') as string,
      format: (formData.get('format') as string) || 'csv',
      include_family: formData.get('include_family') === 'true',
      include_carpool: formData.get('include_carpool') === 'true',
    };

    const validatedData = exportIVAttendeesSchema.parse(rawData);

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('title, start_date')
      .eq('id', validatedData.event_id)
      .single();

    if (eventError || !event) {
      return { success: false, error: 'Event not found' };
    }

    // Get attendees
    const { data: attendees, error: attendeesError } = await supabase
      .from('event_rsvps')
      .select(`
        *,
        member:profiles!event_rsvps_member_id_fkey(
          id,
          full_name,
          email,
          phone,
          company
        )
      `)
      .eq('event_id', validatedData.event_id)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: true });

    if (attendeesError) {
      return { success: false, error: `Failed to fetch attendees: ${attendeesError.message}` };
    }

    // Transform data based on format
    type RsvpData = {
      member?: { full_name?: string; email?: string; phone?: string; company?: string };
      created_at: string;
      family_count?: number;
      family_names?: string[];
      carpool_status?: string;
      seats_available?: number;
      pickup_location?: string;
      dietary_restrictions?: string;
      special_requirements?: string;
    };
    const exportData = (attendees || []).map((rsvp: RsvpData) => {
      const baseData: Record<string, unknown> = {
        Name: rsvp.member?.full_name || 'Unknown',
        Email: rsvp.member?.email || '',
        Phone: rsvp.member?.phone || '',
        Company: rsvp.member?.company || '',
        'Registration Date': new Date(rsvp.created_at).toLocaleDateString(),
      };

      if (validatedData.include_family) {
        baseData['Family Count'] = rsvp.family_count || 0;
        if (rsvp.family_names && rsvp.family_names.length > 0) {
          baseData['Family Names'] = rsvp.family_names.join(', ');
        }
      }

      if (validatedData.include_carpool) {
        baseData['Carpool Status'] = rsvp.carpool_status || 'not_needed';
        if (rsvp.carpool_status === 'offering_ride') {
          baseData['Seats Available'] = rsvp.seats_available || 0;
          baseData['Pickup Location'] = rsvp.pickup_location || '';
        }
      }

      baseData['Dietary Restrictions'] = rsvp.dietary_restrictions || '';
      baseData['Special Requirements'] = rsvp.special_requirements || '';

      return baseData;
    });

    const eventTitle = event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = new Date().toISOString().split('T')[0];

    if (validatedData.format === 'json') {
      return {
        success: true,
        data: {
          data: JSON.stringify(exportData, null, 2),
          filename: `iv_attendees_${eventTitle}_${timestamp}.json`,
        },
        message: 'Attendees exported successfully as JSON',
      };
    }

    if (validatedData.format === 'csv') {
      // Generate CSV
      if (exportData.length === 0) {
        return {
          success: true,
          data: {
            data: 'No attendees to export',
            filename: `iv_attendees_${eventTitle}_${timestamp}.csv`,
          },
          message: 'No attendees found',
        };
      }

      const headers = Object.keys(exportData[0]);
      const csvRows = [
        headers.join(','),
        ...exportData.map((row: Record<string, unknown>) =>
          headers.map((header) => {
            const value = row[header] || '';
            // Escape commas and quotes
            const escaped = String(value).replace(/"/g, '""');
            return `"${escaped}"`;
          }).join(',')
        ),
      ];

      return {
        success: true,
        data: {
          data: csvRows.join('\n'),
          filename: `iv_attendees_${eventTitle}_${timestamp}.csv`,
        },
        message: 'Attendees exported successfully as CSV',
      };
    }

    // Generate XLSX using xlsx library
    if (exportData.length === 0) {
      return {
        success: true,
        data: {
          data: '',
          filename: `iv_attendees_${eventTitle}_${timestamp}.xlsx`,
        },
        message: 'No attendees found',
      };
    }

    // Create worksheet from data
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Auto-size columns based on content
    const colWidths = Object.keys(exportData[0]).map(key => ({
      wch: Math.max(
        key.length,
        ...exportData.map((row: Record<string, unknown>) => String(row[key] || '').length)
      ) + 2
    }));
    worksheet['!cols'] = colWidths;

    // Create workbook and add the worksheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendees');

    // Generate buffer
    const xlsxBuffer = XLSX.write(workbook, {
      type: 'base64',
      bookType: 'xlsx',
    });

    return {
      success: true,
      data: {
        data: xlsxBuffer,
        filename: `iv_attendees_${eventTitle}_${timestamp}.xlsx`,
      },
      message: 'Attendees exported successfully as XLSX',
    };
  } catch (error: unknown) {
    console.error('Error in exportIVAttendees:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export attendees',
    };
  }
}
