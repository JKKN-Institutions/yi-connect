-- Uploaded files for Yi-Future submissions.
--
-- WHY THIS EXISTS
-- Submissions have only ever accepted a LINK. All 734 URLs on file are Google
-- Drive or Docs; not one is an uploaded file, and no file input has ever
-- existed in this app (the DeliverableUpload component says so: "File-upload
-- is deferred — for Future 6.0 we accept public share URLs").
--
-- That has two costs the field reported:
--   1. Jury and moderators must REQUEST ACCESS from each student's Drive,
--      one at a time, before they can read a submission.
--   2. The chapter's work cannot be gathered in one place, so there is no
--      corpus to build the white paper from.
--
-- WHY A TABLE RATHER THAN MORE COLUMNS ON future.submissions
-- A submission already carries six *_url columns, one per deliverable slot.
-- Adding six more *_file_path columns would double that and still allow only
-- one file per slot. A child table keyed on (submission_id, slot) allows a
-- team to attach the policy document AND its annexures, makes "every file for
-- chapter X" a single join for the export, and leaves the existing columns
-- completely untouched — so nothing that reads submissions today changes
-- behaviour.
--
-- LINKS ARE NOT REPLACED. A slot may carry a link, a file, or both. Teams with
-- a 200MB video or a living Google Doc keep working exactly as they do now.

create table if not exists future.submission_files (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references future.submissions(id) on delete cascade,

  -- Which deliverable this file belongs to. Mirrors the *_url column names on
  -- future.submissions so the two halves line up when read together.
  slot          text not null check (slot in (
                  'problem_definition',
                  'draft_solution',
                  'final_policy_document',
                  'final_execution_plan',
                  'final_scalability_model',
                  'final_presentation_deck'
                )),

  -- Path inside the private `future-submissions` storage bucket. Never a URL:
  -- reads go through a short-lived signed URL minted server-side, so a leaked
  -- link cannot be replayed forever.
  file_path     text not null unique,
  file_name     text not null,
  size_bytes    bigint not null default 0,
  content_type  text,

  uploaded_at   timestamptz not null default now(),
  uploaded_by_delegate_id uuid references future.delegates(id) on delete set null
);

create index if not exists idx_submission_files_submission
  on future.submission_files (submission_id);
create index if not exists idx_submission_files_slot
  on future.submission_files (submission_id, slot);

-- Deny-all RLS: every read and write goes through a server action that has
-- already proved the caller is on the team (students) or is an admin/jury.
-- Tables created through the Management API get no service_role grant
-- automatically, so it is granted explicitly.
alter table future.submission_files enable row level security;

grant select, insert, delete on future.submission_files to service_role;

-- No UPDATE grant: a file is added or removed, never edited in place. Replacing
-- one means deleting the row (and its object) and uploading again, which keeps
-- file_path and the stored object honest with each other.
