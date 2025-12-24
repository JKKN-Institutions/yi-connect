/**
 * Industry Portal Authentication
 *
 * Utilities for authenticating industry users and getting their associated industry.
 */

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

/**
 * Get the industry ID for the currently authenticated user.
 * Checks if the user's email is associated with an industry contact.
 *
 * @returns The industry ID if the user is associated with an industry, null otherwise
 */
export async function getCurrentIndustryId(): Promise<string | null> {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return null;
    }

    const supabase = await createClient();

    // Check if user's email is in stakeholder_contacts for an industry
    const { data: contact } = await supabase
      .from('stakeholder_contacts')
      .select('stakeholder_id')
      .eq('stakeholder_type', 'industries')
      .eq('email', user.email)
      .maybeSingle();

    if (contact?.stakeholder_id) {
      return contact.stakeholder_id;
    }

    // Also check if there's an industry where the user is the creator
    const { data: industry } = await supabase
      .from('industries')
      .select('id')
      .eq('created_by', user.id)
      .maybeSingle();

    return industry?.id || null;
  } catch (error) {
    console.error('Error getting industry ID:', error);
    return null;
  }
}

/**
 * Check if the current user has access to the industry portal.
 *
 * @returns Object with access status and industry details
 */
export async function checkIndustryPortalAccess(): Promise<{
  hasAccess: boolean;
  industryId: string | null;
  industryName: string | null;
}> {
  try {
    const industryId = await getCurrentIndustryId();

    if (!industryId) {
      return { hasAccess: false, industryId: null, industryName: null };
    }

    const supabase = await createClient();
    const { data: industry } = await supabase
      .from('industries')
      .select('id, name')
      .eq('id', industryId)
      .single();

    return {
      hasAccess: !!industry,
      industryId: industry?.id || null,
      industryName: industry?.name || null
    };
  } catch (error) {
    console.error('Error checking industry portal access:', error);
    return { hasAccess: false, industryId: null, industryName: null };
  }
}
