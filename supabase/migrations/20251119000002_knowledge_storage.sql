-- =============================================
-- Module 8: Knowledge Management - Storage Setup
-- Migration: 20251119000002
-- Description: Create Storage bucket and policies for knowledge documents
-- =============================================

-- =============================================
-- CREATE STORAGE BUCKET
-- =============================================

-- Create the knowledge-documents bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'knowledge-documents',
  'knowledge-documents',
  false, -- Private bucket (access controlled by RLS)
  52428800, -- 50MB file size limit (50 * 1024 * 1024)
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/plain'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- STORAGE RLS POLICIES
-- =============================================

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to upload documents to their chapter folder
CREATE POLICY "knowledge_upload_policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'knowledge-documents' AND
  (storage.foldername(name))[1] = (
    SELECT chapter_id::text
    FROM members
    WHERE id = auth.uid()
  )
);

-- Policy: Allow users to view documents based on visibility rules
CREATE POLICY "knowledge_view_policy"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'knowledge-documents' AND
  (
    -- Document belongs to user's chapter
    (storage.foldername(name))[1] = (
      SELECT chapter_id::text
      FROM members
      WHERE id = auth.uid()
    )
    OR
    -- Document is public
    EXISTS (
      SELECT 1
      FROM knowledge_documents kd
      WHERE kd.file_path = name
        AND kd.visibility = 'public'
    )
  )
);

-- Policy: Allow users to update/delete their own uploaded documents
CREATE POLICY "knowledge_update_policy"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'knowledge-documents' AND
  EXISTS (
    SELECT 1
    FROM knowledge_documents kd
    WHERE kd.file_path = name
      AND kd.uploaded_by = auth.uid()
  )
);

CREATE POLICY "knowledge_delete_policy"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'knowledge-documents' AND
  EXISTS (
    SELECT 1
    FROM knowledge_documents kd
    WHERE kd.file_path = name
      AND kd.uploaded_by = auth.uid()
  )
);

-- =============================================
-- HELPER FUNCTIONS FOR STORAGE
-- =============================================

-- Function to generate unique file path
CREATE OR REPLACE FUNCTION generate_document_path(
  p_chapter_id UUID,
  p_file_name TEXT,
  p_category_slug TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  v_timestamp TEXT;
  v_random TEXT;
  v_path TEXT;
BEGIN
  v_timestamp := TO_CHAR(NOW(), 'YYYYMMDD_HH24MISS');
  v_random := SUBSTRING(MD5(RANDOM()::TEXT), 1, 8);

  v_path := p_chapter_id::TEXT || '/';

  IF p_category_slug IS NOT NULL THEN
    v_path := v_path || p_category_slug || '/';
  ELSE
    v_path := v_path || 'uncategorized/';
  END IF;

  v_path := v_path || v_timestamp || '_' || v_random || '_' || p_file_name;

  RETURN v_path;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_document_path IS 'Generate a unique, organized path for document storage';

-- =============================================
-- STORAGE CLEANUP TRIGGER
-- =============================================

-- Function to delete storage file when document is deleted
CREATE OR REPLACE FUNCTION delete_document_storage()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete the file from storage
  PERFORM storage.delete(OLD.file_path);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-delete storage files
CREATE TRIGGER knowledge_document_storage_cleanup
AFTER DELETE ON knowledge_documents
FOR EACH ROW
EXECUTE FUNCTION delete_document_storage();

COMMENT ON TRIGGER knowledge_document_storage_cleanup ON knowledge_documents IS 'Automatically delete storage files when documents are deleted';
