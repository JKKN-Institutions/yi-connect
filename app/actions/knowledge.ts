'use server';

// Module 8: Knowledge Management - Server Actions

import { revalidateTag } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  createCategorySchema,
  updateCategorySchema,
  createDocumentSchema,
  updateDocumentSchema,
  createWikiPageSchema,
  updateWikiPageSchema,
  createBestPracticeSchema,
  updateBestPracticeSchema,
  reviewBestPracticeSchema,
  createAccessLogSchema,
} from '@/lib/validations/knowledge';
import type { FormState } from '@/types/knowledge';

// =============================================
// CATEGORY ACTIONS
// =============================================

export async function createCategory(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const supabase = await createServerSupabaseClient();

    // Get current user's chapter
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: 'Unauthorized' };
    }

    const { data: member } = await supabase
      .from('members')
      .select('chapter_id')
      .eq('id', user.id)
      .single();

    if (!member) {
      return { success: false, message: 'Member not found' };
    }

    // Validate input
    const validation = createCategorySchema.safeParse({
      name: formData.get('name'),
      slug: formData.get('slug'),
      description: formData.get('description') || undefined,
      icon: formData.get('icon') || undefined,
      color: formData.get('color') || undefined,
      parent_category_id: formData.get('parent_category_id') || undefined,
      sort_order: formData.get('sort_order') ? parseInt(formData.get('sort_order') as string) : 0,
    });

    if (!validation.success) {
      return {
        success: false,
        message: 'Invalid input',
        errors: validation.error.flatten().fieldErrors,
      };
    }

    // Insert category
    const { error } = await supabase
      .from('knowledge_categories')
      .insert({
        ...validation.data,
        chapter_id: member.chapter_id,
      });

    if (error) {
      if (error.code === '23505') {
        return { success: false, message: 'A category with this slug already exists' };
      }
      throw error;
    }

    revalidateTag('knowledge-categories', 'max');
    return { success: true, message: 'Category created successfully' };
  } catch (error) {
    console.error('Create category error:', error);
    return { success: false, message: 'Failed to create category' };
  }
}

export async function updateCategory(
  categoryId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const supabase = await createServerSupabaseClient();

    const validation = updateCategorySchema.safeParse({
      name: formData.get('name') || undefined,
      slug: formData.get('slug') || undefined,
      description: formData.get('description') || undefined,
      icon: formData.get('icon') || undefined,
      color: formData.get('color') || undefined,
      parent_category_id: formData.get('parent_category_id') || undefined,
      sort_order: formData.get('sort_order') ? parseInt(formData.get('sort_order') as string) : undefined,
      is_active: formData.get('is_active') === 'true',
    });

    if (!validation.success) {
      return {
        success: false,
        message: 'Invalid input',
        errors: validation.error.flatten().fieldErrors,
      };
    }

    const { error } = await supabase
      .from('knowledge_categories')
      .update(validation.data)
      .eq('id', categoryId);

    if (error) throw error;

    revalidateTag('knowledge-categories', 'max');
    return { success: true, message: 'Category updated successfully' };
  } catch (error) {
    console.error('Update category error:', error);
    return { success: false, message: 'Failed to update category' };
  }
}

export async function deleteCategory(categoryId: string): Promise<FormState> {
  try {
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase
      .from('knowledge_categories')
      .delete()
      .eq('id', categoryId);

    if (error) throw error;

    revalidateTag('knowledge-categories', 'max');
    return { success: true, message: 'Category deleted successfully' };
  } catch (error) {
    console.error('Delete category error:', error);
    return { success: false, message: 'Failed to delete category' };
  }
}

// =============================================
// DOCUMENT ACTIONS
// =============================================

export async function createDocument(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: 'Unauthorized' };
    }

    const { data: member } = await supabase
      .from('members')
      .select('chapter_id, id')
      .eq('id', user.id)
      .single();

    if (!member) {
      return { success: false, message: 'Member not found' };
    }

    // Get the file from form data
    const file = formData.get('file') as File;
    if (!file) {
      return { success: false, message: 'No file provided' };
    }

    // Get category slug for folder organization
    const categoryId = formData.get('category_id') as string;
    let categorySlug: string | null = null;

    if (categoryId && categoryId !== 'none') {
      const { data: category } = await supabase
        .from('knowledge_categories')
        .select('slug')
        .eq('id', categoryId)
        .single();
      categorySlug = category?.slug || null;
    }

    // Generate unique file path using database function
    const { data: filePath } = await supabase
      .rpc('generate_document_path', {
        p_chapter_id: member.chapter_id,
        p_file_name: file.name,
        p_category_slug: categorySlug,
      });

    if (!filePath) {
      return { success: false, message: 'Failed to generate file path' };
    }

    // Upload file to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('knowledge-documents')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return { success: false, message: 'Failed to upload file to storage' };
    }

    // Parse tags from form data
    const tagsData = formData.getAll('tags');
    const tags = tagsData.length > 0 ? tagsData.map(t => t.toString()) : [];

    // Extract auto-tags from filename
    const { data: autoTags } = await supabase
      .rpc('extract_auto_tags', { file_name: file.name });

    const combinedTags = [
      ...tags,
      ...(autoTags || []),
    ];

    // Insert document metadata
    const { data: document, error: dbError } = await supabase
      .from('knowledge_documents')
      .insert({
        title: formData.get('title'),
        description: formData.get('description') || null,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type,
        file_size_kb: Math.ceil(file.size / 1024),
        chapter_id: member.chapter_id,
        category_id: categoryId && categoryId !== 'none' ? categoryId : null,
        uploaded_by: member.id,
        tags: combinedTags,
        visibility: formData.get('visibility') || 'chapter',
        event_id: formData.get('event_id') || null,
        year_tag: new Date().getFullYear(),
      })
      .select()
      .single();

    if (dbError) {
      // Cleanup: delete uploaded file if database insert fails
      await supabase.storage
        .from('knowledge-documents')
        .remove([filePath]);
      throw dbError;
    }

    // Increment tag usage
    if (combinedTags.length > 0) {
      await supabase.rpc('increment_tag_usage', {
        p_chapter_id: member.chapter_id,
        p_tags: combinedTags,
      });
    }

    revalidateTag('knowledge-documents', 'max');
    return {
      success: true,
      message: 'Document uploaded successfully',
      redirectTo: `/knowledge/documents/${document.id}`,
    };
  } catch (error) {
    console.error('Create document error:', error);
    return { success: false, message: 'Failed to upload document' };
  }
}

export async function updateDocument(
  documentId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const supabase = await createServerSupabaseClient();

    const validation = updateDocumentSchema.safeParse({
      title: formData.get('title') || undefined,
      description: formData.get('description') || undefined,
      category_id: formData.get('category_id') || undefined,
      tags: formData.get('tags') ? JSON.parse(formData.get('tags') as string) : undefined,
      visibility: formData.get('visibility') || undefined,
      event_id: formData.get('event_id') || undefined,
    });

    if (!validation.success) {
      return {
        success: false,
        message: 'Invalid input',
        errors: validation.error.flatten().fieldErrors,
      };
    }

    const { error } = await supabase
      .from('knowledge_documents')
      .update(validation.data)
      .eq('id', documentId);

    if (error) throw error;

    revalidateTag('knowledge-documents', 'max');
    return { success: true, message: 'Document updated successfully' };
  } catch (error) {
    console.error('Update document error:', error);
    return { success: false, message: 'Failed to update document' };
  }
}

export async function deleteDocument(documentId: string): Promise<FormState> {
  try {
    const supabase = await createServerSupabaseClient();

    // Get document to delete file from storage
    const { data: document } = await supabase
      .from('knowledge_documents')
      .select('file_path')
      .eq('id', documentId)
      .single();

    if (document) {
      // Delete from storage
      await supabase.storage
        .from('knowledge-documents')
        .remove([document.file_path]);
    }

    // Delete from database (versions will cascade delete)
    const { error } = await supabase
      .from('knowledge_documents')
      .delete()
      .eq('id', documentId);

    if (error) throw error;

    revalidateTag('knowledge-documents', 'max');
    return { success: true, message: 'Document deleted successfully' };
  } catch (error) {
    console.error('Delete document error:', error);
    return { success: false, message: 'Failed to delete document' };
  }
}

export async function incrementDocumentView(documentId: string): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient();

    await supabase.rpc('increment', {
      table_name: 'knowledge_documents',
      row_id: documentId,
      column_name: 'view_count',
    });

    revalidateTag('knowledge-documents', 'max');
  } catch (error) {
    console.error('Increment view error:', error);
  }
}

export async function incrementDocumentDownload(documentId: string): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient();

    await supabase.rpc('increment', {
      table_name: 'knowledge_documents',
      row_id: documentId,
      column_name: 'download_count',
    });

    revalidateTag('knowledge-documents', 'max');
  } catch (error) {
    console.error('Increment download error:', error);
  }
}

export async function getDocumentDownloadUrl(documentId: string): Promise<{ url: string | null; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();

    // Get document file path
    const { data: document } = await supabase
      .from('knowledge_documents')
      .select('file_path')
      .eq('id', documentId)
      .single();

    if (!document) {
      return { url: null, error: 'Document not found' };
    }

    // Generate signed URL (valid for 1 hour)
    const { data: signedUrl, error } = await supabase.storage
      .from('knowledge-documents')
      .createSignedUrl(document.file_path, 3600);

    if (error) {
      console.error('Signed URL error:', error);
      return { url: null, error: 'Failed to generate download URL' };
    }

    return { url: signedUrl.signedUrl };
  } catch (error) {
    console.error('Get download URL error:', error);
    return { url: null, error: 'Failed to generate download URL' };
  }
}

// =============================================
// WIKI PAGE ACTIONS
// =============================================

export async function createWikiPage(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: 'Unauthorized' };
    }

    const { data: member } = await supabase
      .from('members')
      .select('chapter_id')
      .eq('id', user.id)
      .single();

    if (!member) {
      return { success: false, message: 'Member not found' };
    }

    const validation = createWikiPageSchema.safeParse({
      title: formData.get('title'),
      slug: formData.get('slug'),
      category: formData.get('category') || 'general',
      content: formData.get('content'),
      summary: formData.get('summary') || undefined,
      visibility: formData.get('visibility') || 'chapter',
    });

    if (!validation.success) {
      return {
        success: false,
        message: 'Invalid input',
        errors: validation.error.flatten().fieldErrors,
      };
    }

    const { data: wikiPage, error } = await supabase
      .from('wiki_pages')
      .insert({
        ...validation.data,
        chapter_id: member.chapter_id,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, message: 'A wiki page with this slug already exists' };
      }
      throw error;
    }

    revalidateTag('wiki-pages', 'max');
    return {
      success: true,
      message: 'Wiki page created successfully',
      redirectTo: `/knowledge/wiki/${wikiPage.slug}`,
    };
  } catch (error) {
    console.error('Create wiki page error:', error);
    return { success: false, message: 'Failed to create wiki page' };
  }
}

export async function updateWikiPage(
  pageId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: 'Unauthorized' };
    }

    const validation = updateWikiPageSchema.safeParse({
      title: formData.get('title') || undefined,
      content: formData.get('content') || undefined,
      summary: formData.get('summary') || undefined,
      change_summary: formData.get('change_summary') || undefined,
      visibility: formData.get('visibility') || undefined,
    });

    if (!validation.success) {
      return {
        success: false,
        message: 'Invalid input',
        errors: validation.error.flatten().fieldErrors,
      };
    }

    // Get current version
    const { data: currentPage } = await supabase
      .from('wiki_pages')
      .select('version, content')
      .eq('id', pageId)
      .single();

    if (!currentPage) {
      return { success: false, message: 'Wiki page not found' };
    }

    const newVersion = currentPage.version + 1;

    // Save current version to history
    await supabase
      .from('wiki_page_versions')
      .insert({
        wiki_page_id: pageId,
        version_number: currentPage.version,
        content: currentPage.content,
        change_summary: validation.data.change_summary,
        edited_by: user.id,
      });

    // Update wiki page
    const { error } = await supabase
      .from('wiki_pages')
      .update({
        ...validation.data,
        version: newVersion,
        last_edited_by: user.id,
      })
      .eq('id', pageId);

    if (error) throw error;

    // Update or create contributor record
    await supabase.rpc('upsert_wiki_contributor', {
      p_wiki_page_id: pageId,
      p_member_id: user.id,
    });

    revalidateTag('wiki-pages', 'max');
    return { success: true, message: 'Wiki page updated successfully' };
  } catch (error) {
    console.error('Update wiki page error:', error);
    return { success: false, message: 'Failed to update wiki page' };
  }
}

export async function deleteWikiPage(pageId: string): Promise<FormState> {
  try {
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase
      .from('wiki_pages')
      .delete()
      .eq('id', pageId);

    if (error) throw error;

    revalidateTag('wiki-pages', 'max');
    return { success: true, message: 'Wiki page deleted successfully' };
  } catch (error) {
    console.error('Delete wiki page error:', error);
    return { success: false, message: 'Failed to delete wiki page' };
  }
}

// =============================================
// BEST PRACTICE ACTIONS
// =============================================

export async function createBestPractice(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: 'Unauthorized' };
    }

    const { data: member } = await supabase
      .from('members')
      .select('chapter_id')
      .eq('id', user.id)
      .single();

    if (!member) {
      return { success: false, message: 'Member not found' };
    }

    const validation = createBestPracticeSchema.safeParse({
      title: formData.get('title'),
      description: formData.get('description'),
      full_content: formData.get('full_content') || undefined,
      impact_metrics: formData.get('impact_metrics') ? JSON.parse(formData.get('impact_metrics') as string) : undefined,
      document_ids: formData.get('document_ids') ? JSON.parse(formData.get('document_ids') as string) : undefined,
    });

    if (!validation.success) {
      return {
        success: false,
        message: 'Invalid input',
        errors: validation.error.flatten().fieldErrors,
      };
    }

    const { data: bestPractice, error } = await supabase
      .from('best_practices')
      .insert({
        ...validation.data,
        chapter_id: member.chapter_id,
        submitted_by: user.id,
        status: 'draft',
      })
      .select()
      .single();

    if (error) throw error;

    revalidateTag('best-practices', 'max');
    return {
      success: true,
      message: 'Best practice created successfully',
      redirectTo: `/knowledge/best-practices/${bestPractice.id}`,
    };
  } catch (error) {
    console.error('Create best practice error:', error);
    return { success: false, message: 'Failed to create best practice' };
  }
}

export async function updateBestPractice(
  practiceId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const supabase = await createServerSupabaseClient();

    const validation = updateBestPracticeSchema.safeParse({
      title: formData.get('title') || undefined,
      description: formData.get('description') || undefined,
      full_content: formData.get('full_content') || undefined,
      impact_metrics: formData.get('impact_metrics') ? JSON.parse(formData.get('impact_metrics') as string) : undefined,
      document_ids: formData.get('document_ids') ? JSON.parse(formData.get('document_ids') as string) : undefined,
    });

    if (!validation.success) {
      return {
        success: false,
        message: 'Invalid input',
        errors: validation.error.flatten().fieldErrors,
      };
    }

    const { error } = await supabase
      .from('best_practices')
      .update(validation.data)
      .eq('id', practiceId);

    if (error) throw error;

    revalidateTag('best-practices', 'max');
    return { success: true, message: 'Best practice updated successfully' };
  } catch (error) {
    console.error('Update best practice error:', error);
    return { success: false, message: 'Failed to update best practice' };
  }
}

export async function submitBestPractice(practiceId: string): Promise<FormState> {
  try {
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase
      .from('best_practices')
      .update({ status: 'submitted' })
      .eq('id', practiceId)
      .eq('status', 'draft');

    if (error) throw error;

    revalidateTag('best-practices', 'max');
    return { success: true, message: 'Best practice submitted for review' };
  } catch (error) {
    console.error('Submit best practice error:', error);
    return { success: false, message: 'Failed to submit best practice' };
  }
}

export async function reviewBestPractice(
  practiceId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: 'Unauthorized' };
    }

    const validation = reviewBestPracticeSchema.safeParse({
      action: formData.get('action'),
      review_notes: formData.get('review_notes'),
    });

    if (!validation.success) {
      return {
        success: false,
        message: 'Invalid input',
        errors: validation.error.flatten().fieldErrors,
      };
    }

    const newStatus = validation.data.action === 'approve' ? 'published' : 'rejected';

    const { error } = await supabase
      .from('best_practices')
      .update({
        status: newStatus,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: validation.data.review_notes,
        published_at: validation.data.action === 'approve' ? new Date().toISOString() : null,
      })
      .eq('id', practiceId);

    if (error) throw error;

    revalidateTag('best-practices', 'max');
    return { success: true, message: `Best practice ${validation.data.action}d successfully` };
  } catch (error) {
    console.error('Review best practice error:', error);
    return { success: false, message: 'Failed to review best practice' };
  }
}

export async function toggleBestPracticeUpvote(practiceId: string): Promise<FormState> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: 'Unauthorized' };
    }

    // Check if already upvoted
    const { data: existing } = await supabase
      .from('best_practice_upvotes')
      .select('id')
      .eq('best_practice_id', practiceId)
      .eq('member_id', user.id)
      .single();

    if (existing) {
      // Remove upvote
      await supabase
        .from('best_practice_upvotes')
        .delete()
        .eq('id', existing.id);

      await supabase.rpc('decrement_best_practice_upvotes', {
        p_practice_id: practiceId,
      });
    } else {
      // Add upvote
      await supabase
        .from('best_practice_upvotes')
        .insert({
          best_practice_id: practiceId,
          member_id: user.id,
        });

      await supabase.rpc('increment_best_practice_upvotes', {
        p_practice_id: practiceId,
      });
    }

    revalidateTag('best-practices', 'max');
    return { success: true, message: existing ? 'Upvote removed' : 'Upvote added' };
  } catch (error) {
    console.error('Toggle upvote error:', error);
    return { success: false, message: 'Failed to toggle upvote' };
  }
}

export async function deleteBestPractice(practiceId: string): Promise<FormState> {
  try {
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase
      .from('best_practices')
      .delete()
      .eq('id', practiceId);

    if (error) throw error;

    revalidateTag('best-practices', 'max');
    return { success: true, message: 'Best practice deleted successfully' };
  } catch (error) {
    console.error('Delete best practice error:', error);
    return { success: false, message: 'Failed to delete best practice' };
  }
}

// =============================================
// ACCESS LOG ACTIONS
// =============================================

export async function logAccess(
  resourceType: 'document' | 'wiki',
  resourceId: string,
  action: 'view' | 'download' | 'edit' | 'share'
): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('knowledge_access_log')
      .insert({
        document_id: resourceType === 'document' ? resourceId : null,
        wiki_page_id: resourceType === 'wiki' ? resourceId : null,
        member_id: user.id,
        action,
      });
  } catch (error) {
    console.error('Log access error:', error);
  }
}
