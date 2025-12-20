/**
 * Member Bulk Actions
 *
 * Server actions for bulk member operations like status updates, skills assignment, etc.
 */

'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { revalidatePath, revalidateTag } from 'next/cache';
import type { FormState } from '@/types';

interface BulkOperationResult {
  success_count: number;
  failure_count: number;
  failures: Array<{ id: string; error: string }>;
}

/**
 * Bulk update member status
 */
export async function bulkUpdateMemberStatus(
  prevState: FormState,
  formData: FormData
): Promise<FormState & { data?: BulkOperationResult }> {
  try {
    await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair']);

    const memberIdsJson = formData.get('member_ids');
    const status = formData.get('status') as string;

    if (!memberIdsJson || typeof memberIdsJson !== 'string') {
      return { message: 'No members selected.' };
    }

    if (!status) {
      return { message: 'Please select a status.' };
    }

    const memberIds: string[] = JSON.parse(memberIdsJson);

    if (memberIds.length === 0) {
      return { message: 'No members selected.' };
    }

    const supabase = await createServerSupabaseClient();

    let successCount = 0;
    let failureCount = 0;
    const failures: Array<{ id: string; error: string }> = [];

    // Update each member
    for (const memberId of memberIds) {
      const { error } = await supabase
        .from('members')
        .update({
          membership_status: status,
          is_active: status === 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', memberId);

      if (error) {
        failureCount++;
        failures.push({ id: memberId, error: error.message });
      } else {
        successCount++;
      }
    }

    // Invalidate caches
    revalidatePath('/members');
    revalidateTag('members-list');

    const result: BulkOperationResult = {
      success_count: successCount,
      failure_count: failureCount,
      failures,
    };

    if (failureCount === 0) {
      return {
        success: true,
        message: `Successfully updated status for ${successCount} member(s).`,
        data: result,
      };
    } else if (successCount > 0) {
      return {
        success: true,
        message: `Updated ${successCount} member(s). ${failureCount} failed.`,
        data: result,
      };
    } else {
      return {
        message: `Failed to update members. ${failureCount} error(s) occurred.`,
        data: result,
      };
    }
  } catch (error: any) {
    return { message: error.message || 'An unexpected error occurred.' };
  }
}

/**
 * Bulk assign skills to members
 */
export async function bulkAssignSkills(
  prevState: FormState,
  formData: FormData
): Promise<FormState & { data?: BulkOperationResult }> {
  try {
    await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair']);

    const memberIdsJson = formData.get('member_ids');
    const skillIdsJson = formData.get('skill_ids');

    if (!memberIdsJson || typeof memberIdsJson !== 'string') {
      return { message: 'No members selected.' };
    }

    if (!skillIdsJson || typeof skillIdsJson !== 'string') {
      return { message: 'No skills selected.' };
    }

    const memberIds: string[] = JSON.parse(memberIdsJson);
    const skillIds: string[] = JSON.parse(skillIdsJson);

    if (memberIds.length === 0) {
      return { message: 'No members selected.' };
    }

    if (skillIds.length === 0) {
      return { message: 'No skills selected.' };
    }

    const supabase = await createServerSupabaseClient();

    let successCount = 0;
    let failureCount = 0;
    const failures: Array<{ id: string; error: string }> = [];

    // Assign skills to each member
    for (const memberId of memberIds) {
      try {
        // Get existing skills for this member
        const { data: existingSkills } = await supabase
          .from('member_skills')
          .select('skill_id')
          .eq('member_id', memberId);

        const existingSkillIds = new Set(existingSkills?.map(s => s.skill_id) || []);

        // Filter out skills already assigned
        const newSkillIds = skillIds.filter(id => !existingSkillIds.has(id));

        if (newSkillIds.length === 0) {
          // All skills already assigned
          successCount++;
          continue;
        }

        // Insert new skill assignments
        const { error } = await supabase
          .from('member_skills')
          .insert(
            newSkillIds.map(skillId => ({
              member_id: memberId,
              skill_id: skillId,
              proficiency_level: 'beginner',
              years_experience: 0,
            }))
          );

        if (error) {
          failureCount++;
          failures.push({ id: memberId, error: error.message });
        } else {
          successCount++;
        }
      } catch (err: any) {
        failureCount++;
        failures.push({ id: memberId, error: err.message || 'Unknown error' });
      }
    }

    // Invalidate caches
    revalidatePath('/members');
    revalidateTag('members-list');

    const result: BulkOperationResult = {
      success_count: successCount,
      failure_count: failureCount,
      failures,
    };

    const skillCount = skillIds.length;

    if (failureCount === 0) {
      return {
        success: true,
        message: `Successfully assigned ${skillCount} skill(s) to ${successCount} member(s).`,
        data: result,
      };
    } else if (successCount > 0) {
      return {
        success: true,
        message: `Assigned skills to ${successCount} member(s). ${failureCount} failed.`,
        data: result,
      };
    } else {
      return {
        message: `Failed to assign skills. ${failureCount} error(s) occurred.`,
        data: result,
      };
    }
  } catch (error: any) {
    return { message: error.message || 'An unexpected error occurred.' };
  }
}

/**
 * Bulk update skill-will category
 */
export async function bulkUpdateCategory(
  prevState: FormState,
  formData: FormData
): Promise<FormState & { data?: BulkOperationResult }> {
  try {
    await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair']);

    const memberIdsJson = formData.get('member_ids');
    const category = formData.get('category') as string;

    if (!memberIdsJson || typeof memberIdsJson !== 'string') {
      return { message: 'No members selected.' };
    }

    if (!category) {
      return { message: 'Please select a category.' };
    }

    const memberIds: string[] = JSON.parse(memberIdsJson);

    if (memberIds.length === 0) {
      return { message: 'No members selected.' };
    }

    const supabase = await createServerSupabaseClient();

    let successCount = 0;
    let failureCount = 0;
    const failures: Array<{ id: string; error: string }> = [];

    // Update each member's category
    for (const memberId of memberIds) {
      const { error } = await supabase
        .from('members')
        .update({
          skill_will_category: category,
          updated_at: new Date().toISOString(),
        })
        .eq('id', memberId);

      if (error) {
        failureCount++;
        failures.push({ id: memberId, error: error.message });
      } else {
        successCount++;
      }
    }

    // Invalidate caches
    revalidatePath('/members');
    revalidateTag('members-list');

    const result: BulkOperationResult = {
      success_count: successCount,
      failure_count: failureCount,
      failures,
    };

    if (failureCount === 0) {
      return {
        success: true,
        message: `Successfully updated category for ${successCount} member(s).`,
        data: result,
      };
    } else if (successCount > 0) {
      return {
        success: true,
        message: `Updated ${successCount} member(s). ${failureCount} failed.`,
        data: result,
      };
    } else {
      return {
        message: `Failed to update category. ${failureCount} error(s) occurred.`,
        data: result,
      };
    }
  } catch (error: any) {
    return { message: error.message || 'An unexpected error occurred.' };
  }
}
