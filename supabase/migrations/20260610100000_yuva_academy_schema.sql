-- Yi Youth Academy — schema, enums, tables, indexes, triggers, cert-number function, grants.
-- Spec: docs/yi-youth-academy-spec.md (approved at human gate 2026-06-10).
-- Applied stepwise via Management API (shown to user first, per repo rule).
-- NOTE: PostgREST exposed-schema list must be PATCHed to include `yuva` OUTSIDE this
-- migration (Management API /postgrest config) — precedent: 20260531120000_theknit_archive_schema.sql.

CREATE SCHEMA IF NOT EXISTS yuva;
GRANT USAGE ON SCHEMA yuva TO authenticated, service_role;   -- NOTE: no anon usage. Public pages
-- read via server components using the service client with explicit status filters.
-- This is the strictest reading of the day-one siloing rule (docs/siloed-visibility-note.md).

CREATE TYPE yuva.program_category AS ENUM ('entrepreneurship','innovation','learning',
  'accessibility','climate_change','health','road_safety');  -- 7 categories per the national
  -- Program Creation Template (2026-06-10)
CREATE TYPE yuva.program_status AS ENUM ('draft','approved','archived');
CREATE TYPE yuva.run_status AS ENUM ('draft','published','applications_closed','in_progress',
  'completed','certified','cancelled');
CREATE TYPE yuva.application_status AS ENUM ('pending','accepted','rejected','withdrawn');
CREATE TYPE yuva.enrollment_status AS ENUM ('active','completed','dropped');
CREATE TYPE yuva.session_status AS ENUM ('scheduled','completed','cancelled');
CREATE TYPE yuva.submission_status AS ENUM ('draft','submitted','reviewed');

CREATE TABLE yuva.academies (                     -- created/edited by NATIONAL only; no onboarding
                                                  -- pipeline (SoP/MoU handled offline). Changes are
                                                  -- audit-logged via yuva.audit_log.
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES yi.institutions(id),  -- NULLABLE: the 7 launch academies have no
                                                  -- known partner institution yet; attachable later
  institution_other text,
  chapter text NOT NULL,                          -- yi_chapter value; RLS scope column
  display_name text NOT NULL,                     -- default "Yi {Chapter} Youth Academy" while
                                                  -- institution is unknown; "Yi – {Institution}
                                                  -- Youth Academy" once attached (both editable)
  is_active boolean NOT NULL DEFAULT true,
  logo_storage_path text,                         -- per-academy combo logo, public bucket yuva-public
  coordinator_person_id uuid REFERENCES yi_directory.people(id),
  capacity_norm int NOT NULL DEFAULT 50,
  qualitative_notes text,                         -- free-text qualitative outcomes
  created_by uuid REFERENCES yi_directory.people(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academies_institution_unique UNIQUE (institution_id)  -- one academy per institution
);
CREATE INDEX academies_chapter_idx ON yuva.academies(chapter);
CREATE UNIQUE INDEX academies_coordinator_unique ON yuva.academies(coordinator_person_id)
  WHERE coordinator_person_id IS NOT NULL;        -- one coordinator = one academy

CREATE TABLE yuva.programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category yuva.program_category NOT NULL,
  objective text,                                 -- "Program Objective" (template Part A)
  summary text,                                   -- UI hint: 100–150 words (template Part A)
  takeaways jsonb NOT NULL DEFAULT '[]'::jsonb,
  status yuva.program_status NOT NULL DEFAULT 'draft',
  total_minutes int NOT NULL DEFAULT 0,           -- recomputed by action on session save
  created_by uuid REFERENCES yi_directory.people(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE yuva.program_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES yuva.programs(id) ON DELETE CASCADE,
  seq int NOT NULL,
  name text NOT NULL,
  duration_minutes int NOT NULL CHECK (duration_minutes > 0),
  learning_objective text,                        -- template Part C
  description text,
  document_storage_path text,                     -- national-uploaded session document
                                                  -- (yuva-materials bucket, program/ prefix)
  expects_submission boolean NOT NULL DEFAULT false,
  CONSTRAINT program_sessions_seq_unique UNIQUE (program_id, seq)
);

CREATE TABLE yuva.runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES yuva.programs(id),
  academy_id uuid NOT NULL REFERENCES yuva.academies(id),
  chapter text NOT NULL,                          -- denormalized from academy; RLS scope
  status yuva.run_status NOT NULL DEFAULT 'draft',
  cohort_announce_date date,                      -- shown publicly; required at publish
  apply_open_at timestamptz,
  apply_close_at timestamptz,
  capacity int NOT NULL DEFAULT 50,               -- SOFT cap; template Part B "Expected Participants"
  start_date date,                                -- ENTERED BY CHAPTER (template Part B)
  end_date date,
  published_at timestamptz,
  created_by uuid REFERENCES yi_directory.people(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT runs_apply_window_chk CHECK (apply_open_at IS NULL OR apply_close_at IS NULL
    OR apply_open_at < apply_close_at)
);
CREATE INDEX runs_chapter_idx ON yuva.runs(chapter);
CREATE INDEX runs_status_idx ON yuva.runs(status);
CREATE INDEX runs_academy_idx ON yuva.runs(academy_id);

CREATE TABLE yuva.run_sessions (                  -- SNAPSHOT of template at run creation
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES yuva.runs(id) ON DELETE CASCADE,
  seq int NOT NULL,
  name text NOT NULL,
  duration_minutes int NOT NULL,
  learning_objective text,                        -- snapshotted from template
  description text,
  document_storage_path text,                     -- snapshotted from template
  expects_submission boolean NOT NULL DEFAULT false,
  scheduled_at timestamptz,
  venue text,
  mentor_person_id uuid REFERENCES yi_directory.people(id),
  remarks text,                                   -- chapter-filled "Additional Remarks" (Part C)
  status yuva.session_status NOT NULL DEFAULT 'scheduled',
  CONSTRAINT run_sessions_seq_unique UNIQUE (run_id, seq)
);
CREATE INDEX run_sessions_mentor_idx ON yuva.run_sessions(mentor_person_id, scheduled_at);

CREATE TABLE yuva.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES yuva.runs(id),
  chapter text NOT NULL,                          -- copied from run by trigger; RLS scope
  person_id uuid REFERENCES yi_directory.people(id),  -- set via resolvePerson() at accept time
  email text NOT NULL,
  phone text,
  full_name text NOT NULL,
  dob date,
  institution_id uuid REFERENCES yi.institutions(id),
  institution_other text,
  degree text,
  year_of_study text,
  motivation text NOT NULL,
  yuva_member_claim text NOT NULL CHECK (yuva_member_claim IN ('member','want_to_join')),
  status yuva.application_status NOT NULL DEFAULT 'pending',
  status_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  review_note text,
  reviewed_by uuid REFERENCES yi_directory.people(id),
  reviewed_at timestamptz,
  consent_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX applications_run_email_unique ON yuva.applications(run_id, lower(email));
CREATE INDEX applications_run_status_idx ON yuva.applications(run_id, status);

CREATE TABLE yuva.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES yuva.runs(id),
  chapter text NOT NULL,                          -- trigger-copied; RLS scope
  person_id uuid NOT NULL REFERENCES yi_directory.people(id),
  application_id uuid UNIQUE REFERENCES yuva.applications(id),
  status yuva.enrollment_status NOT NULL DEFAULT 'active',
  access_code text NOT NULL UNIQUE,               -- CSPRNG 8-char; column-level REVOKE in RLS migration
  certificate_id uuid,                            -- back-filled on issue (no FK; circular)
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enrollments_run_person_unique UNIQUE (run_id, person_id)
);
CREATE INDEX enrollments_person_idx ON yuva.enrollments(person_id);

CREATE TABLE yuva.attendance (
  run_session_id uuid NOT NULL REFERENCES yuva.run_sessions(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES yuva.enrollments(id) ON DELETE CASCADE,
  present boolean NOT NULL,
  marked_by uuid REFERENCES yi_directory.people(id),
  marked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_session_id, enrollment_id)
);

CREATE TABLE yuva.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_session_id uuid NOT NULL REFERENCES yuva.run_sessions(id) ON DELETE CASCADE,
  title text NOT NULL,
  storage_path text NOT NULL,                     -- bucket yuva-materials
  uploaded_by uuid REFERENCES yi_directory.people(id),
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE yuva.submissions (                   -- per-session student work (template Part C);
                                                  -- NO separate assignments system
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_session_id uuid NOT NULL REFERENCES yuva.run_sessions(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES yuva.enrollments(id) ON DELETE CASCADE,
  version int NOT NULL DEFAULT 1,
  file_storage_path text,                         -- bucket yuva-submissions
  text_body text,
  status yuva.submission_status NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  is_late boolean NOT NULL DEFAULT false,         -- session date + SUBMISSION_GRACE_DAYS (7)
  feedback text,
  reviewed_by uuid REFERENCES yi_directory.people(id),
  reviewed_at timestamptz,
  CONSTRAINT submissions_version_unique UNIQUE (run_session_id, enrollment_id, version),
  CONSTRAINT submissions_has_content CHECK (file_storage_path IS NOT NULL OR text_body IS NOT NULL)
);

CREATE TABLE yuva.threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL UNIQUE REFERENCES yuva.runs(id) ON DELETE CASCADE,  -- one cohort thread per run
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE yuva.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES yuva.threads(id) ON DELETE CASCADE,
  sender_person_id uuid NOT NULL REFERENCES yi_directory.people(id),
  sender_kind text NOT NULL CHECK (sender_kind IN ('mentor','student','chapter','institution','national')),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_thread_idx ON yuva.messages(thread_id, created_at);

CREATE TABLE yuva.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL UNIQUE REFERENCES yuva.enrollments(id),
  certificate_no text NOT NULL UNIQUE,            -- YYA-{year}-{seq}
  issued_by uuid REFERENCES yi_directory.people(id),
  issued_at timestamptz NOT NULL DEFAULT now(),
  pdf_storage_path text NOT NULL,                 -- bucket yuva-certificates
  attendance_pct numeric,                         -- snapshot at issue time (published fact)
  revoked boolean NOT NULL DEFAULT false
);

CREATE TABLE yuva.certificate_counters ( year int PRIMARY KEY, seq int NOT NULL );
CREATE OR REPLACE FUNCTION yuva.next_certificate_no() RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = yuva AS $$
  INSERT INTO yuva.certificate_counters (year, seq)
  VALUES (EXTRACT(YEAR FROM now())::int, 1)
  ON CONFLICT (year) DO UPDATE SET seq = yuva.certificate_counters.seq + 1
  RETURNING 'YYA-' || year || '-' ||
    CASE WHEN seq > 9999 THEN seq::text ELSE lpad(seq::text, 4, '0') END;
$$;  -- atomic; year derived internally; re-issue (spelling fix) reuses the OLD number

CREATE TABLE yuva.mentor_profiles (
  person_id uuid PRIMARY KEY REFERENCES yi_directory.people(id),
  bio text,
  expertise text[] NOT NULL DEFAULT '{}',
  organization text,
  photo_storage_path text,                        -- public bucket yuva-public
  is_public boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE yuva.login_otps (                    -- student email-OTP fallback
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code_hash text NOT NULL,                        -- sha256(code + YUVA_SESSION_SECRET)
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_otps_email_idx ON yuva.login_otps(email, created_at);

CREATE TABLE yuva.login_attempts (                -- access-code login throttle (per-IP + global);
                                                  -- pruned by the email-drain cron
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,                              -- 'ip:{addr}' | 'email:{addr}' | 'global'
  success boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_key_idx ON yuva.login_attempts(key, attempted_at);

CREATE TABLE yuva.notification_log (              -- durable email queue (yi-future clone)
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,
  email_type text NOT NULL,
  subject text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,     -- { html, ... }
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  dedupe_key text UNIQUE,                         -- e.g. 'acceptance:{run_id}:{person_id}'
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX notification_log_pending_idx ON yuva.notification_log(status, created_at)
  WHERE status = 'pending';

CREATE TABLE yuva.audit_log (                     -- yip lib/yip/audit pattern
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_person_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  chapter text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Scope-integrity triggers: chapter is ALWAYS copied from the run, never trusted from input.
CREATE OR REPLACE FUNCTION yuva.copy_chapter_from_run() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  SELECT chapter INTO NEW.chapter FROM yuva.runs WHERE id = NEW.run_id;
  RETURN NEW;
END $$;
CREATE TRIGGER applications_chapter_trg BEFORE INSERT ON yuva.applications
  FOR EACH ROW EXECUTE FUNCTION yuva.copy_chapter_from_run();
CREATE TRIGGER enrollments_chapter_trg BEFORE INSERT ON yuva.enrollments
  FOR EACH ROW EXECUTE FUNCTION yuva.copy_chapter_from_run();

-- Grants: authenticated gets SELECT only (RLS gates rows); ALL writes go through the
-- service client inside gated server actions. anon gets NOTHING in this schema.
GRANT SELECT ON ALL TABLES IN SCHEMA yuva TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA yuva GRANT SELECT ON TABLES TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA yuva TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA yuva GRANT ALL ON TABLES TO service_role;
