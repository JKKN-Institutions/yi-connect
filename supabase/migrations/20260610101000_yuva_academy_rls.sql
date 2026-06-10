-- Yi Youth Academy — RLS: role-aware siloed visibility (day-one rule, docs/siloed-visibility-note.md).
-- Spec: docs/yi-youth-academy-spec.md §RLS. Patterns:
--   A  chapter-scoped (+ coordinator academy scope)  : academies, runs, applications, enrollments, audit_log
--   B  child via parent (+ mentor session-assignment): run_sessions, attendance, materials, submissions, threads, messages
--   C  national-only (programs also readable when approved): programs, program_sessions,
--      certificate_counters, notification_log, login_otps, login_attempts
--   D  mentor self/public: mentor_profiles
--   deny-all: certificates (service-client reads only)
-- NO INSERT/UPDATE/DELETE policies anywhere: writes are service-client only (gate-first actions).
-- NO anon policies anywhere: public pages render via RSC + service client with explicit filters.

-- ── Helpers ────────────────────────────────────────────────────────────────

-- Current person (auth.uid() → yi_directory.people.id)
CREATE OR REPLACE FUNCTION yuva.current_person_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = yi_directory, public AS $$
  SELECT id FROM yi_directory.people WHERE user_id = auth.uid() AND is_active LIMIT 1;
$$;

-- Role-aware visibility wrapper. The shared primitive yi_directory.current_user_can_see is
-- role-name-AGNOSTIC on its chapter branch (any active app-matching role row with a matching
-- chapter passes), so it MUST NOT be delegated to for the chapter branch — that would grant
-- mentor / institution_coordinator chapter-wide reads. yuva.can_see(p_chapter) passes ONLY:
--   (a) the platform tier, via the locked primitive's platform branch;
--   (b) app='yuva' roles yuva_super_admin / yuva_admin (global);
--   (c) app='yuva' role chapter_admin whose yi_chapter matches p_chapter.
-- It must NOT pass mentor or institution_coordinator — those get narrower clauses below.
CREATE OR REPLACE FUNCTION yuva.can_see(p_chapter text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = yi_directory, yuva, public AS $$
  SELECT yi_directory.current_user_can_see('yuva', NULL, NULL)   -- platform branch only
  OR EXISTS (
    SELECT 1 FROM yi_directory.people pe
    JOIN yi_directory.role_assignments ra ON ra.person_id = pe.id
    WHERE pe.user_id = auth.uid() AND pe.is_active AND ra.is_active AND ra.app = 'yuva'
      AND (ra.role IN ('yuva_super_admin','yuva_admin')
           OR (ra.role = 'chapter_admin' AND ra.yi_chapter = p_chapter))
  );
$$;

CREATE OR REPLACE FUNCTION yuva.is_yuva_national() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = yi_directory, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM yi_directory.people pe
    JOIN yi_directory.role_assignments ra ON ra.person_id = pe.id
    WHERE pe.user_id = auth.uid() AND pe.is_active AND ra.is_active
      AND ((ra.app = 'yuva' AND ra.role IN ('yuva_super_admin','yuva_admin'))
           OR ra.role = 'super_admin')
  );
$$;

-- Coordinator helper: current person is the bound coordinator of the academy
CREATE OR REPLACE FUNCTION yuva.is_academy_coordinator(p_academy_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = yuva, yi_directory, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM yuva.academies a
    WHERE a.id = p_academy_id AND a.coordinator_person_id = yuva.current_person_id()
  );
$$;

-- Mentor helper: current person is assigned to at least one session of the run
CREATE OR REPLACE FUNCTION yuva.is_run_mentor(p_run_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = yuva, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM yuva.run_sessions rs
    WHERE rs.run_id = p_run_id AND rs.mentor_person_id = yuva.current_person_id()
  );
$$;

-- ── Enable RLS on all 19 tables ────────────────────────────────────────────
ALTER TABLE yuva.academies            ENABLE ROW LEVEL SECURITY;
ALTER TABLE yuva.programs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE yuva.program_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE yuva.runs                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE yuva.run_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE yuva.applications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE yuva.enrollments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE yuva.attendance           ENABLE ROW LEVEL SECURITY;
ALTER TABLE yuva.materials            ENABLE ROW LEVEL SECURITY;
ALTER TABLE yuva.submissions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE yuva.threads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE yuva.messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE yuva.certificates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE yuva.certificate_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE yuva.mentor_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE yuva.login_otps           ENABLE ROW LEVEL SECURITY;
ALTER TABLE yuva.login_attempts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE yuva.notification_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE yuva.audit_log            ENABLE ROW LEVEL SECURITY;

-- ── Pattern A: chapter-scoped + coordinator academy scope ──────────────────
CREATE POLICY siloed_read ON yuva.academies FOR SELECT TO authenticated
  USING (yuva.can_see(chapter) OR yuva.is_academy_coordinator(id));

CREATE POLICY siloed_read ON yuva.runs FOR SELECT TO authenticated
  USING (yuva.can_see(chapter) OR yuva.is_academy_coordinator(academy_id)
         -- mentors read ONLY the parent run rows they are assigned to:
         OR yuva.is_run_mentor(id));

-- applications: NO mentor clause — mentors never read applications.
CREATE POLICY siloed_read ON yuva.applications FOR SELECT TO authenticated
  USING (yuva.can_see(chapter) OR yuva.is_academy_coordinator(
           (SELECT r.academy_id FROM yuva.runs r WHERE r.id = run_id)));

-- enrollments: managers + coordinator; mentors reach rosters via child tables.
CREATE POLICY siloed_read ON yuva.enrollments FOR SELECT TO authenticated
  USING (yuva.can_see(chapter) OR yuva.is_academy_coordinator(
           (SELECT r.academy_id FROM yuva.runs r WHERE r.id = run_id))
         OR yuva.is_run_mentor(run_id));

-- audit_log: chapter-scoped via can_see only (null chapter ⇒ national only — fail closed).
CREATE POLICY siloed_read ON yuva.audit_log FOR SELECT TO authenticated
  USING (yuva.can_see(chapter));

-- ── Pattern B: child via parent run (+ mentor session-assignment) ──────────
CREATE POLICY siloed_read ON yuva.run_sessions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM yuva.runs r WHERE r.id = run_id
                 AND (yuva.can_see(r.chapter) OR yuva.is_academy_coordinator(r.academy_id)))
         OR yuva.is_run_mentor(run_id));

CREATE POLICY siloed_read ON yuva.attendance FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM yuva.run_sessions rs JOIN yuva.runs r ON r.id = rs.run_id
                 WHERE rs.id = run_session_id
                 AND (yuva.can_see(r.chapter) OR yuva.is_academy_coordinator(r.academy_id)
                      OR yuva.is_run_mentor(rs.run_id))));

CREATE POLICY siloed_read ON yuva.materials FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM yuva.run_sessions rs JOIN yuva.runs r ON r.id = rs.run_id
                 WHERE rs.id = run_session_id
                 AND (yuva.can_see(r.chapter) OR yuva.is_academy_coordinator(r.academy_id)
                      OR yuva.is_run_mentor(rs.run_id))));

CREATE POLICY siloed_read ON yuva.submissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM yuva.run_sessions rs JOIN yuva.runs r ON r.id = rs.run_id
                 WHERE rs.id = run_session_id
                 AND (yuva.can_see(r.chapter) OR yuva.is_academy_coordinator(r.academy_id)
                      OR yuva.is_run_mentor(rs.run_id))));

CREATE POLICY siloed_read ON yuva.threads FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM yuva.runs r WHERE r.id = run_id
                 AND (yuva.can_see(r.chapter) OR yuva.is_academy_coordinator(r.academy_id)))
         OR yuva.is_run_mentor(run_id));

CREATE POLICY siloed_read ON yuva.messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM yuva.threads t JOIN yuva.runs r ON r.id = t.run_id
                 WHERE t.id = thread_id
                 AND (yuva.can_see(r.chapter) OR yuva.is_academy_coordinator(r.academy_id)
                      OR yuva.is_run_mentor(t.run_id))));

-- ── Pattern C: national-only (approved templates readable by all staff) ────
CREATE POLICY siloed_read ON yuva.programs FOR SELECT TO authenticated
  USING (yuva.is_yuva_national() OR status = 'approved');

CREATE POLICY siloed_read ON yuva.program_sessions FOR SELECT TO authenticated
  USING (yuva.is_yuva_national() OR EXISTS (
           SELECT 1 FROM yuva.programs p WHERE p.id = program_id AND p.status = 'approved'));

CREATE POLICY siloed_read ON yuva.certificate_counters FOR SELECT TO authenticated
  USING (yuva.is_yuva_national());
CREATE POLICY siloed_read ON yuva.notification_log FOR SELECT TO authenticated
  USING (yuva.is_yuva_national());
CREATE POLICY siloed_read ON yuva.login_otps FOR SELECT TO authenticated
  USING (yuva.is_yuva_national());
CREATE POLICY siloed_read ON yuva.login_attempts FOR SELECT TO authenticated
  USING (yuva.is_yuva_national());

-- ── Pattern D: mentor self/public ──────────────────────────────────────────
CREATE POLICY siloed_read ON yuva.mentor_profiles FOR SELECT TO authenticated
  USING (is_public OR person_id = yuva.current_person_id() OR yuva.can_see(NULL));

-- ── certificates: deny-all by design ───────────────────────────────────────
-- RLS enabled, NO SELECT policy: all reads via service client + signed URLs in gated actions.

-- ── Column-level protection ────────────────────────────────────────────────
-- enrollments.access_code is a student LOGIN CREDENTIAL — never readable via RLS.
REVOKE SELECT ON yuva.enrollments FROM authenticated;
GRANT SELECT (id, run_id, chapter, person_id, application_id, status, certificate_id, joined_at)
  ON yuva.enrollments TO authenticated;           -- access_code intentionally omitted

-- applications.status_token is a bearer token for the public status page — same treatment.
REVOKE SELECT ON yuva.applications FROM authenticated;
GRANT SELECT (id, run_id, chapter, person_id, email, phone, full_name, dob, institution_id,
  institution_other, degree, year_of_study, motivation, yuva_member_claim, status,
  review_note, reviewed_by, reviewed_at, consent_at, created_at)
  ON yuva.applications TO authenticated;          -- status_token intentionally omitted
