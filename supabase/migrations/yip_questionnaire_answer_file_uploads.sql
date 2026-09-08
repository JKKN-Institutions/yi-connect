-- Let a candidate hand in a FILE as well as (or instead of) typed text.
--
-- Why: the Student Journalist paper is a single 300-500 word news report. On
-- 2026-08-22, 32 candidates submitted it and only 5 had typed anything at all
-- -- 27 handed in blank. Typing a full report on a phone inside the window is
-- the obvious suspect. Uploading a document, or a photo of a handwritten
-- report, removes that barrier.
--
-- Shape: an array, not one file, because a handwritten report photographed is
-- usually more than one page. Capped in the server action, not here, so the
-- limit can move without a migration.
--
-- Each element: { path, name, size, mime, uploaded_at }
--   path       storage object path inside the yip-questionnaire-uploads bucket
--   name       the candidate's own filename, shown to organisers
--   size       bytes, as accepted
--   mime       content type, as validated
--   uploaded_at ISO timestamp

ALTER TABLE yip.questionnaire_answers
  ADD COLUMN IF NOT EXISTS files jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN yip.questionnaire_answers.files IS
  'Files handed in for this answer: [{path,name,size,mime,uploaded_at}]. An answer counts as given if it has typed text OR at least one file.';

-- A candidate hands in files for their own attempt only; every read and write
-- goes through a server action holding the service client, exactly as the
-- yip-bill-documents bucket already works. The bucket is PRIVATE: nothing is
-- served publicly, and organisers get time-limited signed URLs.
--
-- Mime list mirrors yip-bill-documents (PDF / Word / PowerPoint / images
-- including HEIC, which is what an iPhone camera produces). Size limit is
-- raised to 10 MB because a photographed page is much larger than a PDF.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'yip-questionnaire-uploads',
  'yip-questionnaire-uploads',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
