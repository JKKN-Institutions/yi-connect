-- =========================================================================
-- Phase E cleanup: rewrite yi_connect RLS to drop auth.users joins +
-- collapse the members-hop transitive walk.
-- =========================================================================
-- Replaces three problematic Phase D patterns inherited from the port:
--
-- (B1) JOIN auth.users in 24 policies (verticals_*, vertical_*, awards_*,
--      jury_*, nominations_*, member_requests, approved_emails, roles,
--      nomination_attachments). Previously unblocked by a temporary
--      GRANT SELECT ON auth.users TO authenticated (20260522150000) which
--      leaks encrypted_password / last_sign_in_at / raw_user_meta_data.
--      Fix: use auth.jwt() ->> 'email' or auth.uid() directly so no grant
--      on auth.users is required. The grant is REVOKEd at the bottom.
--
-- (B3) ~100 policies on ~48 tables walk through yi_connect.members to find
--      the requesting user's chapter_id. Each read fires: query →
--      table_policy → members RLS → profiles RLS (transitive walk). Fix:
--      query yi_connect.profiles directly (members.id == profiles.id ==
--      auth.uid(), and profiles.chapter_id == members.chapter_id for the
--      user's own row). Profiles RLS is USING (true) for SELECT so no
--      additional hop.
--
-- The user_roles `*` policy was already rewritten in 20260522140000 and is
-- NOT touched here.
--
-- All `DROP POLICY IF EXISTS` first so this migration is idempotent.
-- =========================================================================

SET search_path TO yi_connect, public, extensions;

-- =========================================================================
-- B1: drop auth.users joins (24 policies)
-- =========================================================================

-- ---- approved_emails ----
DROP POLICY IF EXISTS "Users can view their own approved email" ON yi_connect.approved_emails;
CREATE POLICY "Users can view their own approved email"
ON yi_connect.approved_emails
FOR SELECT
TO authenticated
USING (email = (auth.jwt() ->> 'email'));

-- ---- member_requests ----
DROP POLICY IF EXISTS "Users can view their own requests" ON yi_connect.member_requests;
CREATE POLICY "Users can view their own requests"
ON yi_connect.member_requests
FOR SELECT
TO authenticated
USING (email = (auth.jwt() ->> 'email'));

-- ---- award_announcements ----
DROP POLICY IF EXISTS award_announcements_write_national_admins ON yi_connect.award_announcements;
CREATE POLICY award_announcements_write_national_admins
ON yi_connect.award_announcements
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM yi.national_admins WHERE email = (auth.jwt() ->> 'email'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM yi.national_admins WHERE email = (auth.jwt() ->> 'email'))
);

-- ---- award_categories ----
DROP POLICY IF EXISTS award_categories_write_national_admins ON yi_connect.award_categories;
CREATE POLICY award_categories_write_national_admins
ON yi_connect.award_categories
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM yi.national_admins WHERE email = (auth.jwt() ->> 'email'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM yi.national_admins WHERE email = (auth.jwt() ->> 'email'))
);

-- ---- award_certificates ----
DROP POLICY IF EXISTS award_certificates_write_national_admins ON yi_connect.award_certificates;
CREATE POLICY award_certificates_write_national_admins
ON yi_connect.award_certificates
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM yi.national_admins WHERE email = (auth.jwt() ->> 'email'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM yi.national_admins WHERE email = (auth.jwt() ->> 'email'))
);

-- ---- award_cycles ----
DROP POLICY IF EXISTS award_cycles_write_national_admins ON yi_connect.award_cycles;
CREATE POLICY award_cycles_write_national_admins
ON yi_connect.award_cycles
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM yi.national_admins WHERE email = (auth.jwt() ->> 'email'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM yi.national_admins WHERE email = (auth.jwt() ->> 'email'))
);

-- ---- award_history ----
DROP POLICY IF EXISTS award_history_write_national_admins ON yi_connect.award_history;
CREATE POLICY award_history_write_national_admins
ON yi_connect.award_history
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM yi.national_admins WHERE email = (auth.jwt() ->> 'email'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM yi.national_admins WHERE email = (auth.jwt() ->> 'email'))
);

-- ---- jury_panel_members ----
DROP POLICY IF EXISTS jury_panel_members_write_national_admins ON yi_connect.jury_panel_members;
CREATE POLICY jury_panel_members_write_national_admins
ON yi_connect.jury_panel_members
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM yi.national_admins WHERE email = (auth.jwt() ->> 'email'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM yi.national_admins WHERE email = (auth.jwt() ->> 'email'))
);

-- ---- jury_panels ----
DROP POLICY IF EXISTS jury_panels_write_national_admins ON yi_connect.jury_panels;
CREATE POLICY jury_panels_write_national_admins
ON yi_connect.jury_panels
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM yi.national_admins WHERE email = (auth.jwt() ->> 'email'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM yi.national_admins WHERE email = (auth.jwt() ->> 'email'))
);

-- ---- jury_scores ----
DROP POLICY IF EXISTS jury_scores_delete_admin_only ON yi_connect.jury_scores;
CREATE POLICY jury_scores_delete_admin_only
ON yi_connect.jury_scores
FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM yi.national_admins WHERE email = (auth.jwt() ->> 'email'))
);

DROP POLICY IF EXISTS jury_scores_update_own_or_admin ON yi_connect.jury_scores;
CREATE POLICY jury_scores_update_own_or_admin
ON yi_connect.jury_scores
FOR UPDATE
TO authenticated
USING (
  juror_id = auth.uid()
  OR EXISTS (SELECT 1 FROM yi.national_admins WHERE email = (auth.jwt() ->> 'email'))
);

-- ---- nomination_attachments ----
DROP POLICY IF EXISTS nomination_attachments_write_uploader_or_admin ON yi_connect.nomination_attachments;
CREATE POLICY nomination_attachments_write_uploader_or_admin
ON yi_connect.nomination_attachments
FOR ALL
TO authenticated
USING (
  uploaded_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM yi_connect.nominations n
    WHERE n.id = nomination_attachments.nomination_id
      AND n.nominator_id = auth.uid()
  )
  OR EXISTS (SELECT 1 FROM yi.national_admins WHERE email = (auth.jwt() ->> 'email'))
)
WITH CHECK (
  uploaded_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM yi_connect.nominations n
    WHERE n.id = nomination_attachments.nomination_id
      AND n.nominator_id = auth.uid()
  )
  OR EXISTS (SELECT 1 FROM yi.national_admins WHERE email = (auth.jwt() ->> 'email'))
);

-- ---- nominations ----
DROP POLICY IF EXISTS nominations_delete_own_or_admin ON yi_connect.nominations;
CREATE POLICY nominations_delete_own_or_admin
ON yi_connect.nominations
FOR DELETE
TO authenticated
USING (
  nominator_id = auth.uid()
  OR EXISTS (SELECT 1 FROM yi.national_admins WHERE email = (auth.jwt() ->> 'email'))
);

DROP POLICY IF EXISTS nominations_update_own_or_admin ON yi_connect.nominations;
CREATE POLICY nominations_update_own_or_admin
ON yi_connect.nominations
FOR UPDATE
TO authenticated
USING (
  nominator_id = auth.uid()
  OR EXISTS (SELECT 1 FROM yi.national_admins WHERE email = (auth.jwt() ->> 'email'))
);

-- ---- roles ----
DROP POLICY IF EXISTS roles_manage_national_admins ON yi_connect.roles;
CREATE POLICY roles_manage_national_admins
ON yi_connect.roles
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM yi.national_admins WHERE email = (auth.jwt() ->> 'email'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM yi.national_admins WHERE email = (auth.jwt() ->> 'email'))
);

-- =========================================================================
-- B1 + B3 combined: verticals_* / vertical_*
-- These had BOTH the auth.users join AND the members hop. Rewrite both.
-- They were created with no explicit role (PUBLIC). Preserve that.
-- =========================================================================

DROP POLICY IF EXISTS verticals_select_policy ON yi_connect.verticals;
CREATE POLICY verticals_select_policy
ON yi_connect.verticals
FOR SELECT
USING (
  chapter_id IN (
    SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid()
  )
);

DROP POLICY IF EXISTS vertical_achievements_select_policy ON yi_connect.vertical_achievements;
CREATE POLICY vertical_achievements_select_policy
ON yi_connect.vertical_achievements
FOR SELECT
USING (
  vertical_id IN (
    SELECT v.id FROM yi_connect.verticals v
    WHERE v.chapter_id IN (
      SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS vertical_activities_select_policy ON yi_connect.vertical_activities;
CREATE POLICY vertical_activities_select_policy
ON yi_connect.vertical_activities
FOR SELECT
USING (
  vertical_id IN (
    SELECT v.id FROM yi_connect.verticals v
    WHERE v.chapter_id IN (
      SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS vertical_chairs_select_policy ON yi_connect.vertical_chairs;
CREATE POLICY vertical_chairs_select_policy
ON yi_connect.vertical_chairs
FOR SELECT
USING (
  vertical_id IN (
    SELECT v.id FROM yi_connect.verticals v
    WHERE v.chapter_id IN (
      SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS vertical_kpi_actuals_select_policy ON yi_connect.vertical_kpi_actuals;
CREATE POLICY vertical_kpi_actuals_select_policy
ON yi_connect.vertical_kpi_actuals
FOR SELECT
USING (
  kpi_id IN (
    SELECT vk.id
    FROM yi_connect.vertical_kpis vk
    JOIN yi_connect.vertical_plans vp ON vk.plan_id = vp.id
    JOIN yi_connect.verticals v ON vp.vertical_id = v.id
    WHERE v.chapter_id IN (
      SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS vertical_kpis_select_policy ON yi_connect.vertical_kpis;
CREATE POLICY vertical_kpis_select_policy
ON yi_connect.vertical_kpis
FOR SELECT
USING (
  plan_id IN (
    SELECT vp.id FROM yi_connect.vertical_plans vp
    WHERE vp.vertical_id IN (
      SELECT v.id FROM yi_connect.verticals v
      WHERE v.chapter_id IN (
        SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid()
      )
    )
  )
);

DROP POLICY IF EXISTS vertical_members_select_policy ON yi_connect.vertical_members;
CREATE POLICY vertical_members_select_policy
ON yi_connect.vertical_members
FOR SELECT
USING (
  vertical_id IN (
    SELECT v.id FROM yi_connect.verticals v
    WHERE v.chapter_id IN (
      SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS vertical_reviews_select_policy ON yi_connect.vertical_performance_reviews;
CREATE POLICY vertical_reviews_select_policy
ON yi_connect.vertical_performance_reviews
FOR SELECT
USING (
  vertical_id IN (
    SELECT v.id FROM yi_connect.verticals v
    WHERE v.chapter_id IN (
      SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS vertical_plans_select_policy ON yi_connect.vertical_plans;
CREATE POLICY vertical_plans_select_policy
ON yi_connect.vertical_plans
FOR SELECT
USING (
  vertical_id IN (
    SELECT v.id FROM yi_connect.verticals v
    WHERE v.chapter_id IN (
      SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid()
    )
  )
);

-- =========================================================================
-- B3: collapse members-hop on ~100 policies. All rewrites swap
--      yi_connect.members → yi_connect.profiles.
--      profiles.chapter_id mirrors members.chapter_id for the user's own
--      row (the only row queried, since both keyed by auth.uid()).
-- =========================================================================

-- ---- aaa_plans ----
DROP POLICY IF EXISTS "EC and above can insert AAA plans" ON yi_connect.aaa_plans;
CREATE POLICY "EC and above can insert AAA plans"
ON yi_connect.aaa_plans
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM yi_connect.profiles p
    WHERE p.id = auth.uid()
      AND p.chapter_id = aaa_plans.chapter_id
      AND yi_connect.get_user_hierarchy_level(p.id) >= 3
  )
);

DROP POLICY IF EXISTS "EC and above can update AAA plans" ON yi_connect.aaa_plans;
CREATE POLICY "EC and above can update AAA plans"
ON yi_connect.aaa_plans
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM yi_connect.profiles p
    WHERE p.id = auth.uid()
      AND p.chapter_id = aaa_plans.chapter_id
      AND yi_connect.get_user_hierarchy_level(p.id) >= 3
  )
);

DROP POLICY IF EXISTS "Members can view chapter AAA plans" ON yi_connect.aaa_plans;
CREATE POLICY "Members can view chapter AAA plans"
ON yi_connect.aaa_plans
FOR SELECT
USING (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
);

-- ---- availability ----
DROP POLICY IF EXISTS "Members can view availability of members in their chapter" ON yi_connect.availability;
CREATE POLICY "Members can view availability of members in their chapter"
ON yi_connect.availability
FOR SELECT
TO authenticated
USING (
  member_id IN (
    SELECT m.id FROM yi_connect.members m
    WHERE m.chapter_id IN (
      SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid()
    )
  )
);

-- ---- best_practice_upvotes ----
DROP POLICY IF EXISTS "Users can view upvotes" ON yi_connect.best_practice_upvotes;
CREATE POLICY "Users can view upvotes"
ON yi_connect.best_practice_upvotes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM yi_connect.best_practices bp
    WHERE bp.id = best_practice_upvotes.best_practice_id
      AND bp.chapter_id = (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  )
);

-- ---- best_practices ----
DROP POLICY IF EXISTS "Members can submit best practices" ON yi_connect.best_practices;
CREATE POLICY "Members can submit best practices"
ON yi_connect.best_practices
FOR INSERT
WITH CHECK (
  chapter_id = (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  AND submitted_by = auth.uid()
);

DROP POLICY IF EXISTS "Users can delete their own drafts" ON yi_connect.best_practices;
CREATE POLICY "Users can delete their own drafts"
ON yi_connect.best_practices
FOR DELETE
USING (
  chapter_id = (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  AND submitted_by = auth.uid()
  AND status::text = 'draft'
);

DROP POLICY IF EXISTS "Users can update their own drafts" ON yi_connect.best_practices;
CREATE POLICY "Users can update their own drafts"
ON yi_connect.best_practices
FOR UPDATE
USING (
  chapter_id = (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  AND (
    (submitted_by = auth.uid() AND status::text = 'draft')
    OR EXISTS (
      SELECT 1 FROM yi_connect.user_roles ur
      JOIN yi_connect.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name = ANY (ARRAY['EC Member', 'Chair', 'Co-Chair', 'Executive Member', 'Super Admin'])
    )
  )
);

DROP POLICY IF EXISTS "Users can view published best practices" ON yi_connect.best_practices;
CREATE POLICY "Users can view published best practices"
ON yi_connect.best_practices
FOR SELECT
USING (
  chapter_id = (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  AND (
    status::text = 'published'
    OR submitted_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM yi_connect.user_roles ur
      JOIN yi_connect.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name = ANY (ARRAY['EC Member', 'Chair', 'Co-Chair', 'Executive Member', 'Super Admin'])
    )
  )
);

-- ---- budget_allocations ----
DROP POLICY IF EXISTS "Users can view budget allocations" ON yi_connect.budget_allocations;
CREATE POLICY "Users can view budget allocations"
ON yi_connect.budget_allocations
FOR SELECT
USING (
  budget_id IN (
    SELECT b.id FROM yi_connect.budgets b
    WHERE b.chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  )
);

-- ---- budgets ----
DROP POLICY IF EXISTS "Users can view budgets in their chapter" ON yi_connect.budgets;
CREATE POLICY "Users can view budgets in their chapter"
ON yi_connect.budgets
FOR SELECT
USING (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
);

-- ---- chapter_settings ----
DROP POLICY IF EXISTS "Chair+ can modify chapter settings" ON yi_connect.chapter_settings;
CREATE POLICY "Chair+ can modify chapter settings"
ON yi_connect.chapter_settings
FOR ALL
USING (
  yi_connect.get_user_hierarchy_level() >= 4
  AND chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
);

DROP POLICY IF EXISTS "Members can view own chapter settings" ON yi_connect.chapter_settings;
CREATE POLICY "Members can view own chapter settings"
ON yi_connect.chapter_settings
FOR SELECT
USING (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
);

-- ---- cmp_targets ----
DROP POLICY IF EXISTS "Members can view chapter CMP targets" ON yi_connect.cmp_targets;
CREATE POLICY "Members can view chapter CMP targets"
ON yi_connect.cmp_targets
FOR SELECT
TO authenticated
USING (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
);

-- ---- commitment_cards ----
DROP POLICY IF EXISTS "Members can insert own commitment cards" ON yi_connect.commitment_cards;
CREATE POLICY "Members can insert own commitment cards"
ON yi_connect.commitment_cards
FOR INSERT
WITH CHECK (
  member_id = auth.uid()
);

DROP POLICY IF EXISTS "Members can update own commitment cards" ON yi_connect.commitment_cards;
CREATE POLICY "Members can update own commitment cards"
ON yi_connect.commitment_cards
FOR UPDATE
USING (
  member_id = auth.uid()
);

DROP POLICY IF EXISTS "Members can view own commitment cards" ON yi_connect.commitment_cards;
CREATE POLICY "Members can view own commitment cards"
ON yi_connect.commitment_cards
FOR SELECT
USING (
  member_id = auth.uid()
  OR (
    chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
    AND yi_connect.get_user_hierarchy_level() >= 4
  )
);

-- ---- engagement_metrics ----
DROP POLICY IF EXISTS "Members can view engagement metrics in their chapter" ON yi_connect.engagement_metrics;
CREATE POLICY "Members can view engagement metrics in their chapter"
ON yi_connect.engagement_metrics
FOR SELECT
TO authenticated
USING (
  member_id IN (
    SELECT m.id FROM yi_connect.members m
    WHERE m.chapter_id IN (
      SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid()
    )
  )
);

-- ---- event_feedback ----
DROP POLICY IF EXISTS "Members can submit feedback for events they attended" ON yi_connect.event_feedback;
CREATE POLICY "Members can submit feedback for events they attended"
ON yi_connect.event_feedback
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM yi_connect.event_rsvps
    WHERE event_rsvps.event_id = event_feedback.event_id
      AND event_rsvps.member_id = auth.uid()
      AND event_rsvps.status = 'attended'::yi_connect.rsvp_status
  )
);

DROP POLICY IF EXISTS "Members can view non-anonymous feedback" ON yi_connect.event_feedback;
CREATE POLICY "Members can view non-anonymous feedback"
ON yi_connect.event_feedback
FOR SELECT
USING (
  is_anonymous = false
  OR member_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM yi_connect.user_roles ur
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3
  )
);

-- ---- event_rsvps ----
DROP POLICY IF EXISTS "Members can manage their own RSVPs" ON yi_connect.event_rsvps;
CREATE POLICY "Members can manage their own RSVPs"
ON yi_connect.event_rsvps
FOR ALL
USING (
  member_id = auth.uid()
);

DROP POLICY IF EXISTS "Members can view RSVPs for events they can see" ON yi_connect.event_rsvps;
CREATE POLICY "Members can view RSVPs for events they can see"
ON yi_connect.event_rsvps
FOR SELECT
USING (
  member_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM yi_connect.events e
    WHERE e.id = event_rsvps.event_id
      AND (
        e.organizer_id = auth.uid()
        OR auth.uid() = ANY (e.co_organizers)
        OR EXISTS (
          SELECT 1 FROM yi_connect.user_roles ur
          JOIN yi_connect.roles r ON ur.role_id = r.id
          WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3
        )
      )
  )
);

-- ---- event_volunteers ----
DROP POLICY IF EXISTS "Members can view volunteer assignments" ON yi_connect.event_volunteers;
CREATE POLICY "Members can view volunteer assignments"
ON yi_connect.event_volunteers
FOR SELECT
USING (
  member_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM yi_connect.events e
    WHERE e.id = event_volunteers.event_id
      AND (
        e.organizer_id = auth.uid()
        OR auth.uid() = ANY (e.co_organizers)
        OR EXISTS (
          SELECT 1 FROM yi_connect.user_roles ur
          JOIN yi_connect.roles r ON ur.role_id = r.id
          WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3
        )
      )
  )
);

DROP POLICY IF EXISTS "Volunteers can update their own status" ON yi_connect.event_volunteers;
CREATE POLICY "Volunteers can update their own status"
ON yi_connect.event_volunteers
FOR UPDATE
USING (
  member_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM yi_connect.events e
    WHERE e.id = event_volunteers.event_id
      AND (e.organizer_id = auth.uid() OR auth.uid() = ANY (e.co_organizers))
  )
);

-- ---- expense_categories ----
DROP POLICY IF EXISTS "Users can view expense categories" ON yi_connect.expense_categories;
CREATE POLICY "Users can view expense categories"
ON yi_connect.expense_categories
FOR SELECT
USING (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  OR chapter_id IS NULL
);

-- ---- expense_receipts ----
DROP POLICY IF EXISTS "Users can view receipts for expenses they can see" ON yi_connect.expense_receipts;
CREATE POLICY "Users can view receipts for expenses they can see"
ON yi_connect.expense_receipts
FOR SELECT
USING (
  expense_id IN (
    SELECT e.id FROM yi_connect.expenses e
    WHERE e.chapter_id IN (
      SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid()
    )
  )
);

-- ---- expenses ----
DROP POLICY IF EXISTS "Users can create their own expenses" ON yi_connect.expenses;
CREATE POLICY "Users can create their own expenses"
ON yi_connect.expenses
FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
);

DROP POLICY IF EXISTS "Users can view expenses in their chapter" ON yi_connect.expenses;
CREATE POLICY "Users can view expenses in their chapter"
ON yi_connect.expenses
FOR SELECT
USING (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
);

-- ---- generated_reports ----
DROP POLICY IF EXISTS "Users can view own reports" ON yi_connect.generated_reports;
CREATE POLICY "Users can view own reports"
ON yi_connect.generated_reports
FOR SELECT
USING (
  generated_by = auth.uid()
  OR chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  OR yi_connect.get_user_hierarchy_level() >= 4
);

-- ---- health_card_entries ----
DROP POLICY IF EXISTS "Chairs can delete health cards" ON yi_connect.health_card_entries;
CREATE POLICY "Chairs can delete health cards"
ON yi_connect.health_card_entries
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM yi_connect.profiles p
    JOIN yi_connect.user_roles ur ON ur.user_id = p.id
    JOIN yi_connect.roles r ON r.id = ur.role_id
    WHERE p.id = auth.uid()
      AND p.chapter_id = health_card_entries.chapter_id
      AND r.hierarchy_level >= 4
  )
);

DROP POLICY IF EXISTS "Members can submit health cards" ON yi_connect.health_card_entries;
CREATE POLICY "Members can submit health cards"
ON yi_connect.health_card_entries
FOR INSERT
TO authenticated
WITH CHECK (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
);

DROP POLICY IF EXISTS "Members can view chapter health cards" ON yi_connect.health_card_entries;
CREATE POLICY "Members can view chapter health cards"
ON yi_connect.health_card_entries
FOR SELECT
TO authenticated
USING (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
);

DROP POLICY IF EXISTS "Users can update own health cards" ON yi_connect.health_card_entries;
CREATE POLICY "Users can update own health cards"
ON yi_connect.health_card_entries
FOR UPDATE
TO authenticated
USING (
  member_id = auth.uid()
);

-- ---- knowledge_categories ----
DROP POLICY IF EXISTS "EC can manage categories" ON yi_connect.knowledge_categories;
CREATE POLICY "EC can manage categories"
ON yi_connect.knowledge_categories
FOR ALL
USING (
  chapter_id = (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM yi_connect.user_roles ur
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = ANY (ARRAY['EC Member', 'Chair', 'Co-Chair', 'Executive Member', 'Super Admin'])
  )
);

DROP POLICY IF EXISTS "Users can view categories in their chapter" ON yi_connect.knowledge_categories;
CREATE POLICY "Users can view categories in their chapter"
ON yi_connect.knowledge_categories
FOR SELECT
USING (
  chapter_id = (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
);

-- ---- knowledge_document_tags ----
DROP POLICY IF EXISTS "System can manage document tags" ON yi_connect.knowledge_document_tags;
CREATE POLICY "System can manage document tags"
ON yi_connect.knowledge_document_tags
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM yi_connect.knowledge_documents kd
    WHERE kd.id = knowledge_document_tags.document_id
      AND kd.chapter_id = (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can view document tags" ON yi_connect.knowledge_document_tags;
CREATE POLICY "Users can view document tags"
ON yi_connect.knowledge_document_tags
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM yi_connect.knowledge_documents kd
    WHERE kd.id = knowledge_document_tags.document_id
      AND kd.chapter_id = (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  )
);

-- ---- knowledge_document_versions ----
DROP POLICY IF EXISTS "System can manage versions" ON yi_connect.knowledge_document_versions;
CREATE POLICY "System can manage versions"
ON yi_connect.knowledge_document_versions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM yi_connect.knowledge_documents kd
    WHERE kd.id = knowledge_document_versions.document_id
      AND kd.chapter_id = (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can view document versions" ON yi_connect.knowledge_document_versions;
CREATE POLICY "Users can view document versions"
ON yi_connect.knowledge_document_versions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM yi_connect.knowledge_documents kd
    WHERE kd.id = knowledge_document_versions.document_id
      AND kd.chapter_id = (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  )
);

-- ---- knowledge_documents ----
DROP POLICY IF EXISTS "Members can upload documents to their chapter" ON yi_connect.knowledge_documents;
CREATE POLICY "Members can upload documents to their chapter"
ON yi_connect.knowledge_documents
FOR INSERT
WITH CHECK (
  chapter_id = (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  AND uploaded_by = auth.uid()
);

DROP POLICY IF EXISTS "Only uploader or Chair can delete documents" ON yi_connect.knowledge_documents;
CREATE POLICY "Only uploader or Chair can delete documents"
ON yi_connect.knowledge_documents
FOR DELETE
USING (
  chapter_id = (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  AND (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM yi_connect.user_roles ur
      JOIN yi_connect.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name = ANY (ARRAY['Chair', 'Co-Chair', 'Executive Member', 'Super Admin'])
    )
  )
);

DROP POLICY IF EXISTS "Users can update their own documents or EC can edit" ON yi_connect.knowledge_documents;
CREATE POLICY "Users can update their own documents or EC can edit"
ON yi_connect.knowledge_documents
FOR UPDATE
USING (
  chapter_id = (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  AND (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM yi_connect.user_roles ur
      JOIN yi_connect.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name = ANY (ARRAY['EC Member', 'Chair', 'Co-Chair', 'Executive Member', 'Super Admin'])
    )
  )
);

DROP POLICY IF EXISTS "Users can view documents based on visibility" ON yi_connect.knowledge_documents;
CREATE POLICY "Users can view documents based on visibility"
ON yi_connect.knowledge_documents
FOR SELECT
USING (
  chapter_id = (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  AND (
    visibility::text = 'public'
    OR visibility::text = 'chapter'
    OR (
      visibility::text = 'ec_only'
      AND EXISTS (
        SELECT 1 FROM yi_connect.user_roles ur
        JOIN yi_connect.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
          AND r.name = ANY (ARRAY['EC Member', 'Chair', 'Co-Chair', 'Executive Member', 'Super Admin'])
      )
    )
    OR (
      visibility::text = 'chair_only'
      AND EXISTS (
        SELECT 1 FROM yi_connect.user_roles ur
        JOIN yi_connect.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
          AND r.name = ANY (ARRAY['Chair', 'Co-Chair', 'Executive Member', 'Super Admin'])
      )
    )
  )
);

-- ---- knowledge_tags ----
DROP POLICY IF EXISTS "System can manage tags" ON yi_connect.knowledge_tags;
CREATE POLICY "System can manage tags"
ON yi_connect.knowledge_tags
FOR ALL
USING (
  chapter_id = (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
);

DROP POLICY IF EXISTS "Users can view tags in their chapter" ON yi_connect.knowledge_tags;
CREATE POLICY "Users can view tags in their chapter"
ON yi_connect.knowledge_tags
FOR SELECT
USING (
  chapter_id = (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
);

-- ---- leadership_assessments ----
DROP POLICY IF EXISTS "Members can view leadership assessments in their chapter" ON yi_connect.leadership_assessments;
CREATE POLICY "Members can view leadership assessments in their chapter"
ON yi_connect.leadership_assessments
FOR SELECT
TO authenticated
USING (
  member_id IN (
    SELECT m.id FROM yi_connect.members m
    WHERE m.chapter_id IN (
      SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid()
    )
  )
);

-- ---- member_certifications ----
DROP POLICY IF EXISTS "Members can view certifications of members in their chapter" ON yi_connect.member_certifications;
CREATE POLICY "Members can view certifications of members in their chapter"
ON yi_connect.member_certifications
FOR SELECT
TO authenticated
USING (
  member_id IN (
    SELECT m.id FROM yi_connect.members m
    WHERE m.chapter_id IN (
      SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid()
    )
  )
);

-- ---- member_networks ----
DROP POLICY IF EXISTS "Admins can manage networks in their chapter" ON yi_connect.member_networks;
CREATE POLICY "Admins can manage networks in their chapter"
ON yi_connect.member_networks
FOR ALL
TO authenticated
USING (
  member_id IN (
    SELECT m.id FROM yi_connect.members m
    WHERE m.chapter_id IN (
      SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid()
    )
  )
  AND EXISTS (
    SELECT 1 FROM yi_connect.user_roles ur
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3
  )
)
WITH CHECK (
  member_id IN (
    SELECT m.id FROM yi_connect.members m
    WHERE m.chapter_id IN (
      SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid()
    )
  )
  AND EXISTS (
    SELECT 1 FROM yi_connect.user_roles ur
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3
  )
);

DROP POLICY IF EXISTS "Users can view member networks in their chapter" ON yi_connect.member_networks;
CREATE POLICY "Users can view member networks in their chapter"
ON yi_connect.member_networks
FOR SELECT
TO authenticated
USING (
  member_id IN (
    SELECT m.id FROM yi_connect.members m
    WHERE m.chapter_id IN (
      SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid()
    )
  )
);

-- ---- member_skills ----
DROP POLICY IF EXISTS "Members can view skills of members in their chapter" ON yi_connect.member_skills;
CREATE POLICY "Members can view skills of members in their chapter"
ON yi_connect.member_skills
FOR SELECT
TO authenticated
USING (
  member_id IN (
    SELECT m.id FROM yi_connect.members m
    WHERE m.chapter_id IN (
      SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid()
    )
  )
);

-- ---- mentor_assignments ----
DROP POLICY IF EXISTS "Chair can manage mentor assignments" ON yi_connect.mentor_assignments;
CREATE POLICY "Chair can manage mentor assignments"
ON yi_connect.mentor_assignments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM yi_connect.profiles p
    WHERE p.id = auth.uid()
      AND p.chapter_id = mentor_assignments.chapter_id
      AND yi_connect.get_user_hierarchy_level(p.id) >= 4
  )
);

DROP POLICY IF EXISTS "Members can view chapter mentor assignments" ON yi_connect.mentor_assignments;
CREATE POLICY "Members can view chapter mentor assignments"
ON yi_connect.mentor_assignments
FOR SELECT
USING (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
);

-- ---- national_benchmarks ----
DROP POLICY IF EXISTS "Members can read own chapter benchmarks" ON yi_connect.national_benchmarks;
CREATE POLICY "Members can read own chapter benchmarks"
ON yi_connect.national_benchmarks
FOR SELECT
TO authenticated
USING (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
);

-- ---- national_broadcast_receipts ----
DROP POLICY IF EXISTS "Members can create own broadcast receipts" ON yi_connect.national_broadcast_receipts;
CREATE POLICY "Members can create own broadcast receipts"
ON yi_connect.national_broadcast_receipts
FOR INSERT
TO authenticated
WITH CHECK (
  member_id = auth.uid()
);

DROP POLICY IF EXISTS "Members can read own broadcast receipts" ON yi_connect.national_broadcast_receipts;
CREATE POLICY "Members can read own broadcast receipts"
ON yi_connect.national_broadcast_receipts
FOR SELECT
TO authenticated
USING (
  member_id = auth.uid()
);

DROP POLICY IF EXISTS "Members can update own broadcast receipts" ON yi_connect.national_broadcast_receipts;
CREATE POLICY "Members can update own broadcast receipts"
ON yi_connect.national_broadcast_receipts
FOR UPDATE
TO authenticated
USING (
  member_id = auth.uid()
)
WITH CHECK (
  member_id = auth.uid()
);

-- ---- national_data_conflicts ----
DROP POLICY IF EXISTS conflicts_insert ON yi_connect.national_data_conflicts;
CREATE POLICY conflicts_insert
ON yi_connect.national_data_conflicts
FOR INSERT
TO authenticated
WITH CHECK (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
);

DROP POLICY IF EXISTS conflicts_select ON yi_connect.national_data_conflicts;
CREATE POLICY conflicts_select
ON yi_connect.national_data_conflicts
FOR SELECT
TO authenticated
USING (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
);

DROP POLICY IF EXISTS conflicts_update ON yi_connect.national_data_conflicts;
CREATE POLICY conflicts_update
ON yi_connect.national_data_conflicts
FOR UPDATE
TO authenticated
USING (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
);

-- ---- national_event_registrations ----
DROP POLICY IF EXISTS event_reg_select_chapter ON yi_connect.national_event_registrations;
CREATE POLICY event_reg_select_chapter
ON yi_connect.national_event_registrations
FOR SELECT
TO authenticated
USING (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
);

-- ---- national_sync_config ----
DROP POLICY IF EXISTS sync_config_insert ON yi_connect.national_sync_config;
CREATE POLICY sync_config_insert
ON yi_connect.national_sync_config
FOR INSERT
TO authenticated
WITH CHECK (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
);

DROP POLICY IF EXISTS sync_config_select ON yi_connect.national_sync_config;
CREATE POLICY sync_config_select
ON yi_connect.national_sync_config
FOR SELECT
TO authenticated
USING (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
);

DROP POLICY IF EXISTS sync_config_update ON yi_connect.national_sync_config;
CREATE POLICY sync_config_update
ON yi_connect.national_sync_config
FOR UPDATE
TO authenticated
USING (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
);

-- ---- national_sync_logs ----
DROP POLICY IF EXISTS sync_logs_insert ON yi_connect.national_sync_logs;
CREATE POLICY sync_logs_insert
ON yi_connect.national_sync_logs
FOR INSERT
TO authenticated
WITH CHECK (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
);

DROP POLICY IF EXISTS sync_logs_select ON yi_connect.national_sync_logs;
CREATE POLICY sync_logs_select
ON yi_connect.national_sync_logs
FOR SELECT
TO authenticated
USING (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
);

-- ---- payment_methods ----
DROP POLICY IF EXISTS "Users can view payment methods in their chapter" ON yi_connect.payment_methods;
CREATE POLICY "Users can view payment methods in their chapter"
ON yi_connect.payment_methods
FOR SELECT
USING (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
);

-- ---- planned_activities ----
DROP POLICY IF EXISTS "Chairs can delete chapter planned activities" ON yi_connect.planned_activities;
CREATE POLICY "Chairs can delete chapter planned activities"
ON yi_connect.planned_activities
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM yi_connect.profiles p
    JOIN yi_connect.user_roles ur ON ur.user_id = p.id
    JOIN yi_connect.roles r ON r.id = ur.role_id
    WHERE p.id = auth.uid()
      AND p.chapter_id = planned_activities.chapter_id
      AND r.hierarchy_level >= 4
  )
);

DROP POLICY IF EXISTS "Chairs can update chapter planned activities" ON yi_connect.planned_activities;
CREATE POLICY "Chairs can update chapter planned activities"
ON yi_connect.planned_activities
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM yi_connect.profiles p
    JOIN yi_connect.user_roles ur ON ur.user_id = p.id
    JOIN yi_connect.roles r ON r.id = ur.role_id
    WHERE p.id = auth.uid()
      AND p.chapter_id = planned_activities.chapter_id
      AND r.hierarchy_level >= 4
  )
);

DROP POLICY IF EXISTS "Members can create planned activities" ON yi_connect.planned_activities;
CREATE POLICY "Members can create planned activities"
ON yi_connect.planned_activities
FOR INSERT
TO authenticated
WITH CHECK (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  AND created_by = auth.uid()
);

DROP POLICY IF EXISTS "Members can view chapter planned activities" ON yi_connect.planned_activities;
CREATE POLICY "Members can view chapter planned activities"
ON yi_connect.planned_activities
FOR SELECT
TO authenticated
USING (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
);

-- ---- report_configurations ----
DROP POLICY IF EXISTS "Users can view own chapter reports" ON yi_connect.report_configurations;
CREATE POLICY "Users can view own chapter reports"
ON yi_connect.report_configurations
FOR SELECT
USING (
  created_by = auth.uid()
  OR chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  OR yi_connect.get_user_hierarchy_level() >= 4
);

-- ---- sponsors ----
DROP POLICY IF EXISTS "Users can view sponsors in their chapter" ON yi_connect.sponsors;
CREATE POLICY "Users can view sponsors in their chapter"
ON yi_connect.sponsors
FOR SELECT
USING (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
);

-- ---- sponsorship_deals ----
DROP POLICY IF EXISTS "Users can view deals in their chapter" ON yi_connect.sponsorship_deals;
CREATE POLICY "Users can view deals in their chapter"
ON yi_connect.sponsorship_deals
FOR SELECT
USING (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
);

-- ---- sponsorship_payments ----
DROP POLICY IF EXISTS "Users can view payments for deals they can see" ON yi_connect.sponsorship_payments;
CREATE POLICY "Users can view payments for deals they can see"
ON yi_connect.sponsorship_payments
FOR SELECT
USING (
  deal_id IN (
    SELECT sd.id FROM yi_connect.sponsorship_deals sd
    WHERE sd.chapter_id IN (
      SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid()
    )
  )
);

-- ---- sponsorship_tiers ----
DROP POLICY IF EXISTS "Users can view sponsorship tiers" ON yi_connect.sponsorship_tiers;
CREATE POLICY "Users can view sponsorship tiers"
ON yi_connect.sponsorship_tiers
FOR SELECT
USING (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
);

-- ---- whatsapp_connections ----
DROP POLICY IF EXISTS whatsapp_connections_insert ON yi_connect.whatsapp_connections;
CREATE POLICY whatsapp_connections_insert
ON yi_connect.whatsapp_connections
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM yi_connect.profiles p
    JOIN yi_connect.user_roles ur ON p.id = ur.user_id
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE p.id = auth.uid()
      AND p.chapter_id = whatsapp_connections.chapter_id
      AND r.name = ANY (ARRAY['Chair', 'Co-Chair'])
  )
  OR EXISTS (
    SELECT 1 FROM yi_connect.user_roles ur
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = ANY (ARRAY['Super Admin', 'National Admin'])
  )
);

DROP POLICY IF EXISTS whatsapp_connections_select ON yi_connect.whatsapp_connections;
CREATE POLICY whatsapp_connections_select
ON yi_connect.whatsapp_connections
FOR SELECT
TO authenticated
USING (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM yi_connect.user_roles ur
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = ANY (ARRAY['Super Admin', 'National Admin'])
  )
);

DROP POLICY IF EXISTS whatsapp_connections_update ON yi_connect.whatsapp_connections;
CREATE POLICY whatsapp_connections_update
ON yi_connect.whatsapp_connections
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM yi_connect.profiles p
    JOIN yi_connect.user_roles ur ON p.id = ur.user_id
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE p.id = auth.uid()
      AND p.chapter_id = whatsapp_connections.chapter_id
      AND r.name = ANY (ARRAY['Chair', 'Co-Chair'])
  )
  OR EXISTS (
    SELECT 1 FROM yi_connect.user_roles ur
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = ANY (ARRAY['Super Admin', 'National Admin'])
  )
);

-- ---- whatsapp_groups ----
DROP POLICY IF EXISTS whatsapp_groups_delete ON yi_connect.whatsapp_groups;
CREATE POLICY whatsapp_groups_delete
ON yi_connect.whatsapp_groups
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM yi_connect.profiles p
    JOIN yi_connect.user_roles ur ON p.id = ur.user_id
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE p.id = auth.uid()
      AND p.chapter_id = whatsapp_groups.chapter_id
      AND r.name = ANY (ARRAY['Chair', 'Co-Chair'])
  )
  OR EXISTS (
    SELECT 1 FROM yi_connect.user_roles ur
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = ANY (ARRAY['Super Admin', 'National Admin'])
  )
);

DROP POLICY IF EXISTS whatsapp_groups_insert ON yi_connect.whatsapp_groups;
CREATE POLICY whatsapp_groups_insert
ON yi_connect.whatsapp_groups
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM yi_connect.profiles p
    JOIN yi_connect.user_roles ur ON p.id = ur.user_id
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE p.id = auth.uid()
      AND p.chapter_id = whatsapp_groups.chapter_id
      AND r.name = ANY (ARRAY['Chair', 'Co-Chair'])
  )
  OR EXISTS (
    SELECT 1 FROM yi_connect.user_roles ur
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = ANY (ARRAY['Super Admin', 'National Admin'])
  )
);

DROP POLICY IF EXISTS whatsapp_groups_select ON yi_connect.whatsapp_groups;
CREATE POLICY whatsapp_groups_select
ON yi_connect.whatsapp_groups
FOR SELECT
TO authenticated
USING (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM yi_connect.user_roles ur
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = ANY (ARRAY['Super Admin', 'National Admin'])
  )
);

DROP POLICY IF EXISTS whatsapp_groups_update ON yi_connect.whatsapp_groups;
CREATE POLICY whatsapp_groups_update
ON yi_connect.whatsapp_groups
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM yi_connect.profiles p
    JOIN yi_connect.user_roles ur ON p.id = ur.user_id
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE p.id = auth.uid()
      AND p.chapter_id = whatsapp_groups.chapter_id
      AND r.name = ANY (ARRAY['Chair', 'Co-Chair'])
  )
  OR EXISTS (
    SELECT 1 FROM yi_connect.user_roles ur
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = ANY (ARRAY['Super Admin', 'National Admin'])
  )
);

-- ---- whatsapp_message_logs ----
DROP POLICY IF EXISTS whatsapp_message_logs_insert ON yi_connect.whatsapp_message_logs;
CREATE POLICY whatsapp_message_logs_insert
ON yi_connect.whatsapp_message_logs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM yi_connect.profiles p
    JOIN yi_connect.user_roles ur ON p.id = ur.user_id
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE p.id = auth.uid()
      AND p.chapter_id = whatsapp_message_logs.chapter_id
      AND r.name = ANY (ARRAY['Chair', 'Co-Chair', 'EC Member'])
  )
  OR EXISTS (
    SELECT 1 FROM yi_connect.user_roles ur
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = ANY (ARRAY['Super Admin', 'National Admin'])
  )
);

DROP POLICY IF EXISTS whatsapp_message_logs_select ON yi_connect.whatsapp_message_logs;
CREATE POLICY whatsapp_message_logs_select
ON yi_connect.whatsapp_message_logs
FOR SELECT
TO authenticated
USING (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM yi_connect.user_roles ur
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = ANY (ARRAY['Super Admin', 'National Admin'])
  )
);

-- ---- whatsapp_templates ----
DROP POLICY IF EXISTS whatsapp_templates_delete ON yi_connect.whatsapp_templates;
CREATE POLICY whatsapp_templates_delete
ON yi_connect.whatsapp_templates
FOR DELETE
TO authenticated
USING (
  (chapter_id IS NULL AND EXISTS (
    SELECT 1 FROM yi_connect.user_roles ur
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = ANY (ARRAY['Super Admin', 'National Admin'])
  ))
  OR (chapter_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM yi_connect.profiles p
    JOIN yi_connect.user_roles ur ON p.id = ur.user_id
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE p.id = auth.uid()
      AND p.chapter_id = whatsapp_templates.chapter_id
      AND r.name = ANY (ARRAY['Chair', 'Co-Chair'])
  ))
  OR EXISTS (
    SELECT 1 FROM yi_connect.user_roles ur
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = ANY (ARRAY['Super Admin', 'National Admin'])
  )
);

DROP POLICY IF EXISTS whatsapp_templates_insert ON yi_connect.whatsapp_templates;
CREATE POLICY whatsapp_templates_insert
ON yi_connect.whatsapp_templates
FOR INSERT
TO authenticated
WITH CHECK (
  (chapter_id IS NULL AND EXISTS (
    SELECT 1 FROM yi_connect.user_roles ur
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = ANY (ARRAY['Super Admin', 'National Admin'])
  ))
  OR (chapter_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM yi_connect.profiles p
    JOIN yi_connect.user_roles ur ON p.id = ur.user_id
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE p.id = auth.uid()
      AND p.chapter_id = whatsapp_templates.chapter_id
      AND r.name = ANY (ARRAY['Chair', 'Co-Chair'])
  ))
  OR EXISTS (
    SELECT 1 FROM yi_connect.user_roles ur
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = ANY (ARRAY['Super Admin', 'National Admin'])
  )
);

DROP POLICY IF EXISTS whatsapp_templates_select ON yi_connect.whatsapp_templates;
CREATE POLICY whatsapp_templates_select
ON yi_connect.whatsapp_templates
FOR SELECT
TO authenticated
USING (
  chapter_id IS NULL
  OR chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM yi_connect.user_roles ur
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = ANY (ARRAY['Super Admin', 'National Admin'])
  )
);

DROP POLICY IF EXISTS whatsapp_templates_update ON yi_connect.whatsapp_templates;
CREATE POLICY whatsapp_templates_update
ON yi_connect.whatsapp_templates
FOR UPDATE
TO authenticated
USING (
  (chapter_id IS NULL AND EXISTS (
    SELECT 1 FROM yi_connect.user_roles ur
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = ANY (ARRAY['Super Admin', 'National Admin'])
  ))
  OR (chapter_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM yi_connect.profiles p
    JOIN yi_connect.user_roles ur ON p.id = ur.user_id
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE p.id = auth.uid()
      AND p.chapter_id = whatsapp_templates.chapter_id
      AND r.name = ANY (ARRAY['Chair', 'Co-Chair'])
  ))
  OR EXISTS (
    SELECT 1 FROM yi_connect.user_roles ur
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = ANY (ARRAY['Super Admin', 'National Admin'])
  )
);

-- ---- wiki_contributors ----
DROP POLICY IF EXISTS "System can manage contributors" ON yi_connect.wiki_contributors;
CREATE POLICY "System can manage contributors"
ON yi_connect.wiki_contributors
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM yi_connect.wiki_pages wp
    WHERE wp.id = wiki_contributors.wiki_page_id
      AND wp.chapter_id = (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can view wiki contributors" ON yi_connect.wiki_contributors;
CREATE POLICY "Users can view wiki contributors"
ON yi_connect.wiki_contributors
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM yi_connect.wiki_pages wp
    WHERE wp.id = wiki_contributors.wiki_page_id
      AND wp.chapter_id = (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  )
);

-- ---- wiki_page_versions ----
DROP POLICY IF EXISTS "System can manage wiki versions" ON yi_connect.wiki_page_versions;
CREATE POLICY "System can manage wiki versions"
ON yi_connect.wiki_page_versions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM yi_connect.wiki_pages wp
    WHERE wp.id = wiki_page_versions.wiki_page_id
      AND wp.chapter_id = (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can view wiki versions" ON yi_connect.wiki_page_versions;
CREATE POLICY "Users can view wiki versions"
ON yi_connect.wiki_page_versions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM yi_connect.wiki_pages wp
    WHERE wp.id = wiki_page_versions.wiki_page_id
      AND wp.chapter_id = (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  )
);

-- ---- wiki_pages ----
DROP POLICY IF EXISTS "Chair can delete wiki pages" ON yi_connect.wiki_pages;
CREATE POLICY "Chair can delete wiki pages"
ON yi_connect.wiki_pages
FOR DELETE
USING (
  chapter_id = (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM yi_connect.user_roles ur
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = ANY (ARRAY['Chair', 'Co-Chair', 'Executive Member', 'Super Admin'])
  )
);

DROP POLICY IF EXISTS "Members can create wiki pages" ON yi_connect.wiki_pages;
CREATE POLICY "Members can create wiki pages"
ON yi_connect.wiki_pages
FOR INSERT
WITH CHECK (
  chapter_id = (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  AND created_by = auth.uid()
  AND NOT is_locked
);

DROP POLICY IF EXISTS "Members can edit unlocked wiki pages" ON yi_connect.wiki_pages;
CREATE POLICY "Members can edit unlocked wiki pages"
ON yi_connect.wiki_pages
FOR UPDATE
USING (
  chapter_id = (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  AND NOT is_locked
);

DROP POLICY IF EXISTS "Users can view wiki pages based on visibility" ON yi_connect.wiki_pages;
CREATE POLICY "Users can view wiki pages based on visibility"
ON yi_connect.wiki_pages
FOR SELECT
USING (
  chapter_id = (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  AND (
    visibility::text = 'public'
    OR visibility::text = 'chapter'
    OR (
      visibility::text = 'ec_only'
      AND EXISTS (
        SELECT 1 FROM yi_connect.user_roles ur
        JOIN yi_connect.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
          AND r.name = ANY (ARRAY['EC Member', 'Chair', 'Co-Chair', 'Executive Member', 'Super Admin'])
      )
    )
    OR (
      visibility::text = 'chair_only'
      AND EXISTS (
        SELECT 1 FROM yi_connect.user_roles ur
        JOIN yi_connect.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
          AND r.name = ANY (ARRAY['Chair', 'Co-Chair', 'Executive Member', 'Super Admin'])
      )
    )
  )
);

-- ---- yi_creative_connections ----
DROP POLICY IF EXISTS "Chapter admins can view own connection" ON yi_connect.yi_creative_connections;
CREATE POLICY "Chapter admins can view own connection"
ON yi_connect.yi_creative_connections
FOR SELECT
USING (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  AND yi_connect.get_user_hierarchy_level(auth.uid()) >= 4
);

DROP POLICY IF EXISTS "Chapter chair can create connection" ON yi_connect.yi_creative_connections;
CREATE POLICY "Chapter chair can create connection"
ON yi_connect.yi_creative_connections
FOR INSERT
WITH CHECK (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  AND yi_connect.get_user_hierarchy_level(auth.uid()) >= 4
);

DROP POLICY IF EXISTS "Chapter chair can delete connection" ON yi_connect.yi_creative_connections;
CREATE POLICY "Chapter chair can delete connection"
ON yi_connect.yi_creative_connections
FOR DELETE
USING (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  AND yi_connect.get_user_hierarchy_level(auth.uid()) >= 4
);

DROP POLICY IF EXISTS "Chapter chair can update connection" ON yi_connect.yi_creative_connections;
CREATE POLICY "Chapter chair can update connection"
ON yi_connect.yi_creative_connections
FOR UPDATE
USING (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  AND yi_connect.get_user_hierarchy_level(auth.uid()) >= 4
)
WITH CHECK (
  chapter_id IN (SELECT p.chapter_id FROM yi_connect.profiles p WHERE p.id = auth.uid())
  AND yi_connect.get_user_hierarchy_level(auth.uid()) >= 4
);

-- =========================================================================
-- Final step: revoke the temporary GRANT installed by 20260522150000.
-- Authenticated role no longer needs SELECT on auth.users — every B1 policy
-- now reads identity from auth.uid() / auth.jwt() instead.
-- =========================================================================

REVOKE SELECT ON auth.users FROM authenticated;
