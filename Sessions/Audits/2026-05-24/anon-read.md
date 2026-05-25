| Table | HTTP | Rows | Verdict |
|---|---|---|---|
| chapters | 200 | 1 | **LEAK — anon read 1 row(s)** |
| profiles | 200 | 1 | **LEAK — anon read 1 row(s)** |
| members | 200 | 1 | **LEAK — anon read 1 row(s)** |
| member_requests | 200 | 0 | OK (RLS filtered to 0 rows) |
| events | 200 | 1 | **LEAK — anon read 1 row(s)** |
| chapter_invitations | 200 | 0 | OK (RLS filtered to 0 rows) |
| awards | 404 | n/a | 404 (not exposed via PostgREST) |
| budgets | 200 | 0 | OK (RLS filtered to 0 rows) |
| expenses | 200 | 0 | OK (RLS filtered to 0 rows) |
| communications | 404 | n/a | 404 (not exposed via PostgREST) |
| impersonation_audit | 404 | n/a | 404 (not exposed via PostgREST) |
| audit_logs | 404 | n/a | 404 (not exposed via PostgREST) |
| award_winners | 404 | n/a | 404 (not exposed via PostgREST) |
| best_practices | 200 | 0 | OK (RLS filtered to 0 rows) |
| stakeholder_contacts | 200 | 0 | OK (RLS filtered to 0 rows) |
| sponsorships | 404 | n/a | 404 (not exposed via PostgREST) |
| expense_reimbursements | 404 | n/a | 404 (not exposed via PostgREST) |
| stakeholders | 404 | n/a | 404 (not exposed via PostgREST) |
| relationships | 404 | n/a | 404 (not exposed via PostgREST) |
| notifications | 200 | 0 | OK (RLS filtered to 0 rows) |
| event_templates | 200 | 0 | OK (RLS filtered to 0 rows) |
| booking_restrictions | 200 | 1 | **LEAK — anon read 1 row(s)** |
| relationship_health_scores | 200 | 0 | OK (RLS filtered to 0 rows) |
| session_booking_history | 200 | 0 | OK (RLS filtered to 0 rows) |
| stakeholder_documents | 200 | 0 | OK (RLS filtered to 0 rows) |
| announcement_templates | 404 | n/a | 404 (not exposed via PostgREST) |
| approved_emails | 200 | 0 | OK (RLS filtered to 0 rows) |
| certifications | 200 | 0 | OK (RLS filtered to 0 rows) |
| chapter_settings | 200 | 0 | OK (RLS filtered to 0 rows) |
| chapter_reports | 200 | 0 | OK (RLS filtered to 0 rows) |
| cmp_progress | 200 | 0 | OK (RLS filtered to 0 rows) |

### Corrected names (PGRST205 hints)

| Table | HTTP | Rows | Verdict |
|---|---|---|---|
| impersonation_sessions | 200 | 0 | OK (RLS filtered to 0 rows) |
| financial_audit_logs | 200 | 0 | OK (RLS filtered to 0 rows) |
| award_cycles | 200 | 0 | OK (RLS filtered to 0 rows) |
| award_categories | 200 | 0 | OK (RLS filtered to 0 rows) |
| announcement_drafts | 404 | n/a | 404 |
| admin_recent_impersonations | 200 | 0 | OK (RLS filtered to 0 rows) |
