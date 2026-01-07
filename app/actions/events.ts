/**
 * Event Module Server Actions
 *
 * Server Actions for Event Lifecycle Manager module mutations.
 * Handles events, venues, RSVPs, volunteers, feedback, and documents.
 */

'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/data/auth';
import { uploadImage } from './upload';
import { sendEmail, sendBatchEmails } from '@/lib/email';
import { eventCancellationEmail, volunteerAssignmentEmail } from '@/lib/email/templates';
import {
  createEventSchema,
  updateEventSchema,
  publishEventSchema,
  cancelEventSchema,
  createVenueSchema,
  updateVenueSchema,
  deleteVenueSchema,
  createVenueBookingSchema,
  updateVenueBookingSchema,
  createResourceSchema,
  updateResourceSchema,
  createResourceBookingSchema,
  updateResourceBookingSchema,
  createRSVPSchema,
  updateRSVPSchema,
  deleteRSVPSchema,
  createGuestRSVPSchema,
  updateGuestRSVPSchema,
  deleteGuestRSVPSchema,
  assignVolunteerSchema,
  updateVolunteerSchema,
  deleteVolunteerSchema,
  createVolunteerRoleSchema,
  updateVolunteerRoleSchema,
  deleteVolunteerRoleSchema,
  checkInSchema,
  deleteCheckInSchema,
  createEventFeedbackSchema,
  updateEventFeedbackSchema,
  deleteEventFeedbackSchema,
  uploadEventDocumentSchema,
  updateEventDocumentSchema,
  deleteEventDocumentSchema,
  createEventTemplateSchema,
  updateEventTemplateSchema,
  deleteEventTemplateSchema,
  type CreateEventInput,
  type UpdateEventInput,
  type PublishEventInput,
  type CancelEventInput,
  type CreateVenueInput,
  type UpdateVenueInput,
  type CreateRSVPInput,
  type UpdateRSVPInput,
  type CreateGuestRSVPInput,
  type UpdateGuestRSVPInput,
  type AssignVolunteerInput,
  type UpdateVolunteerInput,
  type CheckInInput,
  type CreateEventFeedbackInput,
  type UpdateEventFeedbackInput,
  type UploadEventDocumentInput
} from '@/lib/validations/event';

type ActionResponse<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * Sanitize form data before sending to database
 * Converts empty strings to null for optional fields
 */
function sanitizeEventData<T extends Record<string, any>>(data: T): T {
  const sanitized = { ...data } as Record<string, any>;

  // Fields that should be null instead of empty string
  const nullableFields = [
    'venue_id',
    'template_id',
    'chapter_id',
    'venue_address',
    'venue_latitude',
    'venue_longitude',
    'virtual_meeting_link',
    'registration_start_date',
    'registration_end_date',
    'banner_image_url'
  ];

  for (const field of nullableFields) {
    if (
      field in sanitized &&
      (sanitized[field] === '' || sanitized[field] === undefined)
    ) {
      sanitized[field] = null;
    }
  }

  // Remove undefined values
  Object.keys(sanitized).forEach((key) => {
    if (sanitized[key] === undefined) {
      delete sanitized[key];
    }
  });

  return sanitized as T;
}

/**
 * Get user's hierarchy level from database
 */
async function getUserHierarchyLevel(userId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('get_user_hierarchy_level', {
    user_id: userId
  });
  return data || 0;
}

// ============================================================================
// Event Actions
// ============================================================================

/**
 * Create a new event
 */
export async function createEvent(
  input: CreateEventInput
): Promise<ActionResponse<{ id: string }>> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate input
    const validated = createEventSchema.parse(input);

    // Handle image upload if it's a base64 data URL
    let bannerImageUrl = validated.banner_image_url;
    if (bannerImageUrl && bannerImageUrl.startsWith('data:image/')) {
      const uploadResult = await uploadImage(
        bannerImageUrl,
        'event-images',
        'banners'
      );
      if (uploadResult.success && uploadResult.data) {
        bannerImageUrl = uploadResult.data.url;
      } else {
        // If upload fails, don't create the event
        return {
          success: false,
          error: uploadResult.error || 'Failed to upload banner image'
        };
      }
    }

    // Sanitize data (convert empty strings to null)
    const sanitizedData = sanitizeEventData({
      ...validated,
      banner_image_url: bannerImageUrl
    });

    // Insert event
    const { data, error } = await supabase
      .from('events')
      .insert({
        ...sanitizedData,
        organizer_id: user.id,
        status: 'draft',
        current_registrations: 0
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating event:', error);
      return { success: false, error: 'Failed to create event' };
    }

    // Invalidate cache
    updateTag('events');
    revalidatePath('/events');

    return { success: true, data: { id: data.id } };
  } catch (error) {
    console.error('Error in createEvent:', error);
    return { success: false, error: 'Invalid input data' };
  }
}

/**
 * Update an existing event
 */
export async function updateEvent(
  eventId: string,
  input: UpdateEventInput
): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate input
    const validated = updateEventSchema.parse(input);

    // Check if user has permission to update
    const { data: event } = await supabase
      .from('events')
      .select('organizer_id')
      .eq('id', eventId)
      .single();

    if (!event) {
      return { success: false, error: 'Event not found' };
    }

    // Only organizer or admin can update
    if (event.organizer_id !== user.id) {
      return { success: false, error: 'Permission denied' };
    }

    // Handle image upload if it's a base64 data URL
    let bannerImageUrl = validated.banner_image_url;
    if (bannerImageUrl && bannerImageUrl.startsWith('data:image/')) {
      const uploadResult = await uploadImage(
        bannerImageUrl,
        'event-images',
        'banners'
      );
      if (uploadResult.success && uploadResult.data) {
        bannerImageUrl = uploadResult.data.url;
      } else {
        // If upload fails, don't update the event
        return {
          success: false,
          error: uploadResult.error || 'Failed to upload banner image'
        };
      }
    }

    // Sanitize data (convert empty strings to null)
    const sanitizedData = sanitizeEventData({
      ...validated,
      banner_image_url: bannerImageUrl
    });

    // Update event
    const { error } = await supabase
      .from('events')
      .update(sanitizedData)
      .eq('id', eventId);

    if (error) {
      console.error('Error updating event:', error);
      return { success: false, error: 'Failed to update event' };
    }

    // Invalidate cache
    updateTag('events');
    revalidatePath('/events');
    revalidatePath(`/events/${eventId}`);

    return { success: true };
  } catch (error) {
    console.error('Error in updateEvent:', error);
    return { success: false, error: 'Invalid input data' };
  }
}

/**
 * Publish an event (change status from draft to published)
 */
export async function publishEvent(
  input: PublishEventInput
): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const validated = publishEventSchema.parse(input);

    // Check permission
    const { data: event } = await supabase
      .from('events')
      .select('organizer_id, status')
      .eq('id', validated.id)
      .single();

    if (!event) {
      return { success: false, error: 'Event not found' };
    }

    if (event.organizer_id !== user.id) {
      return { success: false, error: 'Permission denied' };
    }

    if (event.status !== 'draft') {
      return { success: false, error: 'Only draft events can be published' };
    }

    // Update status
    const { error } = await supabase
      .from('events')
      .update({ status: 'published' })
      .eq('id', validated.id);

    if (error) {
      console.error('Error publishing event:', error);
      return { success: false, error: 'Failed to publish event' };
    }

    // Invalidate cache
    updateTag('events');
    revalidatePath('/events');
    revalidatePath(`/events/${validated.id}`);

    return { success: true };
  } catch (error) {
    console.error('Error in publishEvent:', error);
    return { success: false, error: 'Invalid input data' };
  }
}

/**
 * Cancel an event
 */
export async function cancelEvent(
  input: CancelEventInput
): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const validated = cancelEventSchema.parse(input);

    // Check permission
    const { data: event } = await supabase
      .from('events')
      .select('organizer_id, status')
      .eq('id', validated.id)
      .single();

    if (!event) {
      return { success: false, error: 'Event not found' };
    }

    if (event.organizer_id !== user.id) {
      return { success: false, error: 'Permission denied' };
    }

    if (event.status === 'completed' || event.status === 'cancelled') {
      return {
        success: false,
        error: 'Cannot cancel completed or already cancelled events'
      };
    }

    // Update status and add cancellation note
    const { error } = await supabase
      .from('events')
      .update({
        status: 'cancelled',
        notes: validated.reason
      })
      .eq('id', validated.id);

    if (error) {
      console.error('Error cancelling event:', error);
      return { success: false, error: 'Failed to cancel event' };
    }

    // Send cancellation notifications to all RSVPs
    const { data: eventDetails } = await supabase
      .from('events')
      .select('title')
      .eq('id', validated.id)
      .single();

    const { data: rsvps } = await supabase
      .from('event_rsvps')
      .select('member:member_id(id, email, full_name)')
      .eq('event_id', validated.id)
      .eq('status', 'confirmed');

    if (rsvps && rsvps.length > 0 && eventDetails) {
      const emails = rsvps
        .filter((r) => {
          const member = r.member as { email?: string }[] | undefined;
          return member?.[0]?.email;
        })
        .map((r) => {
          const member = r.member as { email: string; full_name?: string }[];
          const template = eventCancellationEmail({
            memberName: member[0]?.full_name || 'Member',
            eventTitle: eventDetails.title,
            reason: validated.reason,
          });
          return {
            to: member[0].email,
            subject: template.subject,
            html: template.html,
          };
        });

      if (emails.length > 0) {
        await sendBatchEmails(emails);
      }
    }

    // Invalidate cache
    updateTag('events');
    revalidatePath('/events');
    revalidatePath(`/events/${validated.id}`);

    return { success: true };
  } catch (error) {
    console.error('Error in cancelEvent:', error);
    return { success: false, error: 'Invalid input data' };
  }
}

/**
 * Delete an event (soft delete or hard delete for drafts)
 */
export async function deleteEvent(eventId: string): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Check permission
    const { data: event } = await supabase
      .from('events')
      .select('organizer_id, status')
      .eq('id', eventId)
      .single();

    if (!event) {
      return { success: false, error: 'Event not found' };
    }

    if (event.organizer_id !== user.id) {
      return { success: false, error: 'Permission denied' };
    }

    // Only allow deletion of draft events
    if (event.status !== 'draft') {
      return {
        success: false,
        error:
          'Only draft events can be deleted. Please cancel the event instead.'
      };
    }

    // Delete event
    const { error } = await supabase.from('events').delete().eq('id', eventId);

    if (error) {
      console.error('Error deleting event:', error);
      return { success: false, error: 'Failed to delete event' };
    }

    // Invalidate cache
    updateTag('events');
    revalidatePath('/events');

    return { success: true };
  } catch (error) {
    console.error('Error in deleteEvent:', error);
    return { success: false, error: 'Failed to delete event' };
  }
}

// ============================================================================
// Venue Actions
// ============================================================================

/**
 * Create a new venue
 */
export async function createVenue(
  input: CreateVenueInput
): Promise<ActionResponse<{ id: string }>> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Only admins and event coordinators can create venues
    const hierarchyLevel = await getUserHierarchyLevel(user.id);
    if (hierarchyLevel > 3) {
      return { success: false, error: 'Permission denied' };
    }

    const validated = createVenueSchema.parse(input);

    const { data, error } = await supabase
      .from('venues')
      .insert(validated)
      .select('id')
      .single();

    if (error) {
      console.error('Error creating venue:', error);
      return { success: false, error: 'Failed to create venue' };
    }

    updateTag('venues');
    revalidatePath('/events/venues');

    return { success: true, data: { id: data.id } };
  } catch (error) {
    console.error('Error in createVenue:', error);
    return { success: false, error: 'Invalid input data' };
  }
}

/**
 * Update a venue
 */
export async function updateVenue(
  venueId: string,
  input: UpdateVenueInput
): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }
    const hierarchyLevel = await getUserHierarchyLevel(user.id);
    if (hierarchyLevel > 3) {
      return { success: false, error: 'Unauthorized' };
    }

    const validated = updateVenueSchema.parse(input);

    const { error } = await supabase
      .from('venues')
      .update(validated)
      .eq('id', venueId);

    if (error) {
      console.error('Error updating venue:', error);
      return { success: false, error: 'Failed to update venue' };
    }

    updateTag('venues');
    revalidatePath('/events/venues');
    revalidatePath(`/events/venues/${venueId}`);

    return { success: true };
  } catch (error) {
    console.error('Error in updateVenue:', error);
    return { success: false, error: 'Invalid input data' };
  }
}

/**
 * Delete a venue
 */
export async function deleteVenue(venueId: string): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }
    const hierarchyLevel = await getUserHierarchyLevel(user.id);
    if (hierarchyLevel > 3) {
      return { success: false, error: 'Unauthorized' };
    }

    // Check if venue is being used
    const { data: bookings } = await supabase
      .from('venue_bookings')
      .select('id')
      .eq('venue_id', venueId)
      .limit(1);

    if (bookings && bookings.length > 0) {
      return {
        success: false,
        error:
          'Cannot delete venue with existing bookings. Deactivate it instead.'
      };
    }

    const { error } = await supabase.from('venues').delete().eq('id', venueId);

    if (error) {
      console.error('Error deleting venue:', error);
      return { success: false, error: 'Failed to delete venue' };
    }

    updateTag('venues');
    revalidatePath('/events/venues');

    return { success: true };
  } catch (error) {
    console.error('Error in deleteVenue:', error);
    return { success: false, error: 'Failed to delete venue' };
  }
}

// ============================================================================
// RSVP Actions
// ============================================================================

/**
 * Create or update RSVP for a member
 */
export async function createOrUpdateRSVP(
  input: CreateRSVPInput
): Promise<ActionResponse<{ id: string }>> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Ensure member can only RSVP for themselves unless admin
    const hierarchyLevel = await getUserHierarchyLevel(user.id);
    if (input.member_id !== user.id && hierarchyLevel > 3) {
      return { success: false, error: 'Permission denied' };
    }

    const validated = createRSVPSchema.parse(input);

    // Check if event allows guests
    const { data: event } = await supabase
      .from('events')
      .select(
        'allow_guests, guest_limit, max_capacity, current_registrations, status'
      )
      .eq('id', validated.event_id)
      .single();

    if (!event) {
      return { success: false, error: 'Event not found' };
    }

    if (event.status !== 'published') {
      return { success: false, error: 'Cannot RSVP to unpublished events' };
    }

    if (!event.allow_guests && validated.guests_count > 0) {
      return { success: false, error: 'This event does not allow guests' };
    }

    if (event.guest_limit && validated.guests_count > event.guest_limit) {
      return {
        success: false,
        error: `Maximum ${event.guest_limit} guests allowed`
      };
    }

    // Check capacity
    const totalAttendees = 1 + (validated.guests_count || 0);
    if (
      event.max_capacity &&
      event.current_registrations + totalAttendees > event.max_capacity
    ) {
      // Add to waitlist if enabled
      validated.status = 'waitlist';
    }

    // Upsert RSVP
    const { data, error } = await supabase
      .from('event_rsvps')
      .upsert(
        {
          ...validated,
          member_id: validated.member_id,
          event_id: validated.event_id
        },
        {
          onConflict: 'event_id,member_id'
        }
      )
      .select('id')
      .single();

    if (error) {
      console.error('Error creating/updating RSVP:', error);
      return { success: false, error: 'Failed to save RSVP' };
    }

    updateTag('events');
    updateTag('rsvps');
    revalidatePath(`/events/${validated.event_id}`);

    return { success: true, data: { id: data.id } };
  } catch (error) {
    console.error('Error in createOrUpdateRSVP:', error);
    return { success: false, error: 'Invalid input data' };
  }
}

/**
 * Update RSVP status
 */
export async function updateRSVP(
  rsvpId: string,
  input: UpdateRSVPInput
): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const validated = updateRSVPSchema.parse(input);

    // Check permission
    const { data: rsvp } = await supabase
      .from('event_rsvps')
      .select('member_id, event_id')
      .eq('id', rsvpId)
      .single();

    if (!rsvp) {
      return { success: false, error: 'RSVP not found' };
    }

    const hierarchyLevel = await getUserHierarchyLevel(user.id);
    if (rsvp.member_id !== user.id && hierarchyLevel > 3) {
      return { success: false, error: 'Permission denied' };
    }

    const { error } = await supabase
      .from('event_rsvps')
      .update(validated)
      .eq('id', rsvpId);

    if (error) {
      console.error('Error updating RSVP:', error);
      return { success: false, error: 'Failed to update RSVP' };
    }

    updateTag('events');
    updateTag('rsvps');
    revalidatePath(`/events/${rsvp.event_id}`);

    return { success: true };
  } catch (error) {
    console.error('Error in updateRSVP:', error);
    return { success: false, error: 'Invalid input data' };
  }
}

/**
 * Delete RSVP
 */
export async function deleteRSVP(rsvpId: string): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Check permission
    const { data: rsvp } = await supabase
      .from('event_rsvps')
      .select('member_id, event_id')
      .eq('id', rsvpId)
      .single();

    if (!rsvp) {
      return { success: false, error: 'RSVP not found' };
    }

    const hierarchyLevel = await getUserHierarchyLevel(user.id);
    if (rsvp.member_id !== user.id && hierarchyLevel > 3) {
      return { success: false, error: 'Permission denied' };
    }

    const { error } = await supabase
      .from('event_rsvps')
      .delete()
      .eq('id', rsvpId);

    if (error) {
      console.error('Error deleting RSVP:', error);
      return { success: false, error: 'Failed to delete RSVP' };
    }

    updateTag('events');
    updateTag('rsvps');
    revalidatePath(`/events/${rsvp.event_id}`);

    return { success: true };
  } catch (error) {
    console.error('Error in deleteRSVP:', error);
    return { success: false, error: 'Failed to delete RSVP' };
  }
}

/**
 * Create guest RSVP
 */
export async function createGuestRSVP(
  input: CreateGuestRSVPInput
): Promise<ActionResponse<{ id: string }>> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const validated = createGuestRSVPSchema.parse(input);

    // Check if event allows guests
    const { data: event } = await supabase
      .from('events')
      .select('allow_guests, status')
      .eq('id', validated.event_id)
      .single();

    if (!event) {
      return { success: false, error: 'Event not found' };
    }

    if (!event.allow_guests) {
      return { success: false, error: 'This event does not allow guests' };
    }

    if (event.status !== 'published') {
      return { success: false, error: 'Cannot RSVP to unpublished events' };
    }

    const { data, error } = await supabase
      .from('guest_rsvps')
      .insert({
        ...validated,
        invited_by_member_id: validated.invited_by_member_id || user.id
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating guest RSVP:', error);
      return { success: false, error: 'Failed to create guest RSVP' };
    }

    updateTag('events');
    updateTag('rsvps');
    revalidatePath(`/events/${validated.event_id}`);

    return { success: true, data: { id: data.id } };
  } catch (error) {
    console.error('Error in createGuestRSVP:', error);
    return { success: false, error: 'Invalid input data' };
  }
}

/**
 * Update guest RSVP
 */
export async function updateGuestRSVP(
  guestRsvpId: string,
  input: UpdateGuestRSVPInput
): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const validated = updateGuestRSVPSchema.parse(input);

    // Check permission
    const { data: guestRsvp } = await supabase
      .from('guest_rsvps')
      .select('invited_by_member_id, event_id')
      .eq('id', guestRsvpId)
      .single();

    if (!guestRsvp) {
      return { success: false, error: 'Guest RSVP not found' };
    }

    const hierarchyLevel = await getUserHierarchyLevel(user.id);
    if (guestRsvp.invited_by_member_id !== user.id && hierarchyLevel > 3) {
      return { success: false, error: 'Permission denied' };
    }

    const { error } = await supabase
      .from('guest_rsvps')
      .update(validated)
      .eq('id', guestRsvpId);

    if (error) {
      console.error('Error updating guest RSVP:', error);
      return { success: false, error: 'Failed to update guest RSVP' };
    }

    updateTag('events');
    updateTag('rsvps');
    revalidatePath(`/events/${guestRsvp.event_id}`);

    return { success: true };
  } catch (error) {
    console.error('Error in updateGuestRSVP:', error);
    return { success: false, error: 'Invalid input data' };
  }
}

/**
 * Delete guest RSVP
 */
export async function deleteGuestRSVP(
  guestRsvpId: string
): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Check permission
    const { data: guestRsvp } = await supabase
      .from('guest_rsvps')
      .select('invited_by_member_id, event_id')
      .eq('id', guestRsvpId)
      .single();

    if (!guestRsvp) {
      return { success: false, error: 'Guest RSVP not found' };
    }

    const hierarchyLevel = await getUserHierarchyLevel(user.id);
    if (guestRsvp.invited_by_member_id !== user.id && hierarchyLevel > 3) {
      return { success: false, error: 'Permission denied' };
    }

    const { error } = await supabase
      .from('guest_rsvps')
      .delete()
      .eq('id', guestRsvpId);

    if (error) {
      console.error('Error deleting guest RSVP:', error);
      return { success: false, error: 'Failed to delete guest RSVP' };
    }

    updateTag('events');
    updateTag('rsvps');
    revalidatePath(`/events/${guestRsvp.event_id}`);

    return { success: true };
  } catch (error) {
    console.error('Error in deleteGuestRSVP:', error);
    return { success: false, error: 'Failed to delete guest RSVP' };
  }
}

// ============================================================================
// Volunteer Actions
// ============================================================================

/**
 * Assign a volunteer to an event
 */
export async function assignVolunteer(
  input: AssignVolunteerInput
): Promise<ActionResponse<{ id: string }>> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Only event organizers and admins can assign volunteers
    const { data: event } = await supabase
      .from('events')
      .select('organizer_id')
      .eq('id', input.event_id)
      .single();

    if (!event) {
      return { success: false, error: 'Event not found' };
    }

    const hierarchyLevel = await getUserHierarchyLevel(user.id);
    if (event.organizer_id !== user.id && hierarchyLevel > 3) {
      return { success: false, error: 'Permission denied' };
    }

    const validated = assignVolunteerSchema.parse(input);

    const { data, error } = await supabase
      .from('event_volunteers')
      .insert({
        ...validated,
        status: 'invited'
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error assigning volunteer:', error);
      return { success: false, error: 'Failed to assign volunteer' };
    }

    // Send notification to volunteer
    const { data: eventDetails } = await supabase
      .from('events')
      .select('title, start_date')
      .eq('id', validated.event_id)
      .single();

    const { data: volunteer } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', validated.member_id)
      .single();

    const { data: role } = await supabase
      .from('volunteer_roles')
      .select('name')
      .eq('id', validated.role_id)
      .single();

    if (volunteer?.email && eventDetails) {
      const template = volunteerAssignmentEmail({
        memberName: volunteer.full_name || 'Member',
        eventTitle: eventDetails.title,
        role: role?.name || 'Volunteer',
        eventDate: new Date(eventDetails.start_date).toLocaleDateString('en-IN', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        eventLink: `${process.env.NEXT_PUBLIC_APP_URL || ''}/events/${validated.event_id}`,
      });

      await sendEmail({
        to: volunteer.email,
        subject: template.subject,
        html: template.html,
      });
    }

    updateTag('events');
    updateTag('volunteers');
    revalidatePath(`/events/${validated.event_id}`);

    return { success: true, data: { id: data.id } };
  } catch (error) {
    console.error('Error in assignVolunteer:', error);
    return { success: false, error: 'Invalid input data' };
  }
}

/**
 * Update volunteer assignment
 */
export async function updateVolunteer(
  volunteerId: string,
  input: UpdateVolunteerInput
): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const validated = updateVolunteerSchema.parse(input);

    // Check permission
    const { data: volunteer } = await supabase
      .from('event_volunteers')
      .select('member_id, event_id, event:events!inner(organizer_id)')
      .eq('id', volunteerId)
      .single();

    if (!volunteer) {
      return { success: false, error: 'Volunteer assignment not found' };
    }

    // Member can update their own status, organizer can update everything
    // Higher hierarchy_level = more authority (Super Admin=7, National Admin=6, etc.)
    const hierarchyLevel = await getUserHierarchyLevel(user.id);
    const isOrganizer = (volunteer.event as any).organizer_id === user.id;
    const isSelf = volunteer.member_id === user.id;
    const isAdmin = hierarchyLevel >= 4; // Chair and above

    if (!isOrganizer && !isSelf && !isAdmin) {
      return { success: false, error: 'Permission denied' };
    }

    // Only allow status update if self
    if (isSelf && !isOrganizer && !isAdmin) {
      if (Object.keys(validated).some((key) => key !== 'status')) {
        return {
          success: false,
          error: 'You can only update your RSVP status'
        };
      }
    }

    const { error } = await supabase
      .from('event_volunteers')
      .update(validated)
      .eq('id', volunteerId);

    if (error) {
      console.error('Error updating volunteer:', error);
      return { success: false, error: 'Failed to update volunteer' };
    }

    updateTag('events');
    updateTag('volunteers');
    revalidatePath(`/events/${volunteer.event_id}`);

    return { success: true };
  } catch (error) {
    console.error('Error in updateVolunteer:', error);
    return { success: false, error: 'Invalid input data' };
  }
}

/**
 * Remove volunteer from event
 */
export async function deleteVolunteer(
  volunteerId: string
): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Check permission
    const { data: volunteer } = await supabase
      .from('event_volunteers')
      .select('member_id, event_id, event:events!inner(organizer_id)')
      .eq('id', volunteerId)
      .single();

    if (!volunteer) {
      return { success: false, error: 'Volunteer assignment not found' };
    }

    // Higher hierarchy_level = more authority (Super Admin=7, National Admin=6, etc.)
    const hierarchyLevel = await getUserHierarchyLevel(user.id);
    const isOrganizer = (volunteer.event as any).organizer_id === user.id;
    const isSelf = volunteer.member_id === user.id;
    const isAdmin = hierarchyLevel >= 4; // Chair and above

    if (!isOrganizer && !isSelf && !isAdmin) {
      return { success: false, error: 'Permission denied' };
    }

    const { error } = await supabase
      .from('event_volunteers')
      .delete()
      .eq('id', volunteerId);

    if (error) {
      console.error('Error deleting volunteer:', error);
      return { success: false, error: 'Failed to remove volunteer' };
    }

    updateTag('events');
    updateTag('volunteers');
    revalidatePath(`/events/${volunteer.event_id}`);

    return { success: true };
  } catch (error) {
    console.error('Error in deleteVolunteer:', error);
    return { success: false, error: 'Failed to remove volunteer' };
  }
}

// ============================================================================
// Check-in Actions
// ============================================================================

/**
 * Check in an attendee (member or guest)
 */
export async function checkInAttendee(
  input: CheckInInput
): Promise<ActionResponse<{ id: string }>> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const validated = checkInSchema.parse(input);

    // Verify event exists and is ongoing/published
    const { data: event } = await supabase
      .from('events')
      .select('status, organizer_id')
      .eq('id', validated.event_id)
      .single();

    if (!event) {
      return { success: false, error: 'Event not found' };
    }

    if (event.status !== 'ongoing' && event.status !== 'published') {
      return {
        success: false,
        error: 'Can only check in to ongoing or published events'
      };
    }

    // Check if already checked in
    const { data: existing } = await supabase
      .from('event_checkins')
      .select('id')
      .eq('event_id', validated.event_id)
      .eq('attendee_type', validated.attendee_type)
      .eq('attendee_id', validated.attendee_id)
      .maybeSingle();

    if (existing) {
      return { success: false, error: 'Attendee already checked in' };
    }

    // Create check-in
    const { data, error } = await supabase
      .from('event_checkins')
      .insert({
        ...validated,
        checked_in_by: user.id,
        checked_in_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error checking in attendee:', error);
      return { success: false, error: 'Failed to check in attendee' };
    }

    // Update RSVP status to attended
    if (validated.attendee_type === 'member') {
      await supabase
        .from('event_rsvps')
        .update({ status: 'attended' })
        .eq('event_id', validated.event_id)
        .eq('member_id', validated.attendee_id);
    } else {
      await supabase
        .from('guest_rsvps')
        .update({ status: 'attended' })
        .eq('event_id', validated.event_id)
        .eq('id', validated.attendee_id);
    }

    updateTag('events');
    updateTag('checkins');
    revalidatePath(`/events/${validated.event_id}`);

    return { success: true, data: { id: data.id } };
  } catch (error) {
    console.error('Error in checkInAttendee:', error);
    return { success: false, error: 'Invalid input data' };
  }
}

/**
 * Self check-in for mobile - current user checks themselves into an event
 */
export async function selfCheckIn(
  eventId: string
): Promise<ActionResponse<{
  eventId: string;
  eventTitle: string;
  venue: string | null;
  checkInTime: string;
}>> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Please log in to check in' };
    }

    // Get event details
    const { data: event } = await supabase
      .from('events')
      .select('id, title, status, venue, start_date, end_date')
      .eq('id', eventId)
      .single();

    if (!event) {
      return { success: false, error: 'Event not found' };
    }

    if (event.status !== 'ongoing' && event.status !== 'published') {
      return {
        success: false,
        error: 'This event is not open for check-in'
      };
    }

    // Check if already checked in
    const { data: existing } = await supabase
      .from('event_checkins')
      .select('id, checked_in_at')
      .eq('event_id', eventId)
      .eq('attendee_type', 'member')
      .eq('attendee_id', user.id)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        error: 'You have already checked in to this event'
      };
    }

    // Create check-in
    const checkInTime = new Date().toISOString();
    const { error: insertError } = await supabase
      .from('event_checkins')
      .insert({
        event_id: eventId,
        attendee_type: 'member',
        attendee_id: user.id,
        checked_in_by: user.id,
        checked_in_at: checkInTime
      });

    if (insertError) {
      console.error('Error creating check-in:', insertError);
      return { success: false, error: 'Failed to check in' };
    }

    // Update RSVP status to attended
    await supabase
      .from('event_rsvps')
      .update({ status: 'attended' })
      .eq('event_id', eventId)
      .eq('member_id', user.id);

    updateTag('events');
    updateTag('checkins');

    return {
      success: true,
      data: {
        eventId: event.id,
        eventTitle: event.title,
        venue: event.venue,
        checkInTime: new Date(checkInTime).toLocaleTimeString()
      }
    };
  } catch (error) {
    console.error('Error in selfCheckIn:', error);
    return { success: false, error: 'Check-in failed' };
  }
}

// ============================================================================
// Feedback Actions
// ============================================================================

/**
 * Submit event feedback
 */
export async function submitEventFeedback(
  input: CreateEventFeedbackInput
): Promise<ActionResponse<{ id: string }>> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const validated = createEventFeedbackSchema.parse(input);

    // Check if event is completed
    const { data: event } = await supabase
      .from('events')
      .select('status')
      .eq('id', validated.event_id)
      .single();

    if (!event) {
      return { success: false, error: 'Event not found' };
    }

    if (event.status !== 'completed') {
      return {
        success: false,
        error: 'Can only submit feedback for completed events'
      };
    }

    // Set member_id unless anonymous
    const feedbackData = {
      ...validated,
      member_id: validated.is_anonymous ? null : validated.member_id || user.id
    };

    const { data, error } = await supabase
      .from('event_feedback')
      .insert(feedbackData)
      .select('id')
      .single();

    if (error) {
      console.error('Error submitting feedback:', error);
      return { success: false, error: 'Failed to submit feedback' };
    }

    // Recalculate event impact metrics
    await supabase.rpc('calculate_event_impact', {
      p_event_id: validated.event_id
    });

    updateTag('events');
    updateTag('feedback');
    revalidatePath(`/events/${validated.event_id}`);

    return { success: true, data: { id: data.id } };
  } catch (error) {
    console.error('Error in submitEventFeedback:', error);
    return { success: false, error: 'Invalid input data' };
  }
}

/**
 * Update event feedback
 */
export async function updateEventFeedback(
  feedbackId: string,
  input: UpdateEventFeedbackInput
): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const validated = updateEventFeedbackSchema.parse(input);

    // Check permission
    const { data: feedback } = await supabase
      .from('event_feedback')
      .select('member_id, event_id')
      .eq('id', feedbackId)
      .single();

    if (!feedback) {
      return { success: false, error: 'Feedback not found' };
    }

    const hierarchyLevel = await getUserHierarchyLevel(user.id);
    if (feedback.member_id !== user.id && hierarchyLevel > 3) {
      return { success: false, error: 'Permission denied' };
    }

    const { error } = await supabase
      .from('event_feedback')
      .update(validated)
      .eq('id', feedbackId);

    if (error) {
      console.error('Error updating feedback:', error);
      return { success: false, error: 'Failed to update feedback' };
    }

    // Recalculate event impact metrics
    await supabase.rpc('calculate_event_impact', {
      p_event_id: feedback.event_id
    });

    updateTag('events');
    updateTag('feedback');
    revalidatePath(`/events/${feedback.event_id}`);

    return { success: true };
  } catch (error) {
    console.error('Error in updateEventFeedback:', error);
    return { success: false, error: 'Invalid input data' };
  }
}

/**
 * Delete event feedback
 */
export async function deleteEventFeedback(
  feedbackId: string
): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Check permission
    const { data: feedback } = await supabase
      .from('event_feedback')
      .select('member_id, event_id')
      .eq('id', feedbackId)
      .single();

    if (!feedback) {
      return { success: false, error: 'Feedback not found' };
    }

    const hierarchyLevel = await getUserHierarchyLevel(user.id);
    if (feedback.member_id !== user.id && hierarchyLevel > 3) {
      return { success: false, error: 'Permission denied' };
    }

    const { error } = await supabase
      .from('event_feedback')
      .delete()
      .eq('id', feedbackId);

    if (error) {
      console.error('Error deleting feedback:', error);
      return { success: false, error: 'Failed to delete feedback' };
    }

    // Recalculate event impact metrics
    await supabase.rpc('calculate_event_impact', {
      p_event_id: feedback.event_id
    });

    updateTag('events');
    updateTag('feedback');
    revalidatePath(`/events/${feedback.event_id}`);

    return { success: true };
  } catch (error) {
    console.error('Error in deleteEventFeedback:', error);
    return { success: false, error: 'Failed to delete feedback' };
  }
}

// ============================================================================
// Document Actions
// ============================================================================

/**
 * Upload event document
 */
export async function uploadEventDocument(
  input: UploadEventDocumentInput
): Promise<ActionResponse<{ id: string }>> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const validated = uploadEventDocumentSchema.parse(input);

    // Check permission
    const { data: event } = await supabase
      .from('events')
      .select('organizer_id')
      .eq('id', validated.event_id)
      .single();

    if (!event) {
      return { success: false, error: 'Event not found' };
    }

    const hierarchyLevel = await getUserHierarchyLevel(user.id);
    if (event.organizer_id !== user.id && hierarchyLevel > 3) {
      return { success: false, error: 'Permission denied' };
    }

    const { data, error } = await supabase
      .from('event_documents')
      .insert({
        ...validated,
        uploaded_by: user.id
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error uploading document:', error);
      return { success: false, error: 'Failed to upload document' };
    }

    updateTag('events');
    updateTag('documents');
    revalidatePath(`/events/${validated.event_id}`);

    return { success: true, data: { id: data.id } };
  } catch (error) {
    console.error('Error in uploadEventDocument:', error);
    return { success: false, error: 'Invalid input data' };
  }
}

/**
 * Delete event document
 */
export async function deleteEventDocument(
  documentId: string
): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Check permission
    const { data: document } = await supabase
      .from('event_documents')
      .select('uploaded_by, event_id, event:events!inner(organizer_id)')
      .eq('id', documentId)
      .single();

    if (!document) {
      return { success: false, error: 'Document not found' };
    }

    // Higher hierarchy_level = more authority (Super Admin=7, National Admin=6, etc.)
    const hierarchyLevel = await getUserHierarchyLevel(user.id);
    const isOrganizer = (document.event as any).organizer_id === user.id;
    const isUploader = document.uploaded_by === user.id;
    const isAdmin = hierarchyLevel >= 4; // Chair and above

    if (!isOrganizer && !isUploader && !isAdmin) {
      return { success: false, error: 'Permission denied' };
    }

    // Get document details to find the storage path
    const { data: docDetails } = await supabase
      .from('event_documents')
      .select('file_url')
      .eq('id', documentId)
      .single();

    // Delete file from storage if URL exists
    if (docDetails?.file_url) {
      try {
        // Extract path from URL - typically stored as bucket/path format
        const url = new URL(docDetails.file_url);
        const pathParts = url.pathname.split('/storage/v1/object/public/');
        if (pathParts.length > 1) {
          const [bucket, ...filePath] = pathParts[1].split('/');
          await supabase.storage.from(bucket).remove([filePath.join('/')]);
        }
      } catch {
        // Log but don't fail if storage deletion fails
        console.warn('Failed to delete file from storage:', docDetails.file_url);
      }
    }

    const { error } = await supabase
      .from('event_documents')
      .delete()
      .eq('id', documentId);

    if (error) {
      console.error('Error deleting document:', error);
      return { success: false, error: 'Failed to delete document' };
    }

    updateTag('events');
    updateTag('documents');
    revalidatePath(`/events/${document.event_id}`);

    return { success: true };
  } catch (error) {
    console.error('Error in deleteEventDocument:', error);
    return { success: false, error: 'Failed to delete document' };
  }
}

// ============================================================================
// Export Actions
// ============================================================================

/**
 * Export events to CSV format
 */
export async function exportEvents(
  eventIds?: string[]
): Promise<ActionResponse<{ data: string; filename: string }>> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Build query
    let query = supabase
      .from('events')
      .select(`
        id,
        title,
        description,
        category,
        status,
        start_date,
        end_date,
        venue,
        max_attendees,
        registration_deadline,
        is_virtual,
        meeting_link,
        created_at,
        organizer:profiles!events_organizer_id_fkey(full_name),
        vertical:verticals(name),
        rsvps:event_rsvps(count)
      `)
      .order('start_date', { ascending: false });

    if (eventIds && eventIds.length > 0) {
      query = query.in('id', eventIds);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error('Error fetching events for export:', error);
      return { success: false, error: 'Failed to fetch events' };
    }

    if (!events || events.length === 0) {
      return { success: false, error: 'No events to export' };
    }

    // Transform data for CSV
    const exportData = events.map(event => ({
      'Title': event.title,
      'Category': event.category,
      'Status': event.status,
      'Start Date': event.start_date ? new Date(event.start_date).toLocaleDateString() : '',
      'End Date': event.end_date ? new Date(event.end_date).toLocaleDateString() : '',
      'Venue': event.is_virtual ? 'Virtual' : (event.venue || 'TBD'),
      'Max Attendees': event.max_attendees || 'Unlimited',
      'Registrations': (event.rsvps as any)?.[0]?.count || 0,
      'Organizer': (event.organizer as any)?.full_name || 'Unknown',
      'Vertical': (event.vertical as any)?.name || 'General',
      'Created': event.created_at ? new Date(event.created_at).toLocaleDateString() : ''
    }));

    // Generate CSV
    const headers = Object.keys(exportData[0]);
    const csvRows = [
      headers.join(','),
      ...exportData.map(row =>
        headers.map(header => {
          const value = String(row[header as keyof typeof row] || '');
          // Escape quotes and wrap in quotes if contains comma
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ];

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = eventIds?.length
      ? `events_selected_${timestamp}.csv`
      : `events_all_${timestamp}.csv`;

    return {
      success: true,
      data: {
        data: csvRows.join('\n'),
        filename
      }
    };
  } catch (error) {
    console.error('Error in exportEvents:', error);
    return { success: false, error: 'Failed to export events' };
  }
}
