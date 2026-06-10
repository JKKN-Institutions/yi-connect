# Yi Youth Academy — dev seeds (Phase 5 task 1)

Seeded live on 2026-06-10 (idempotent INSERT … WHERE NOT EXISTS):

| person_id | email | app | role | yi_year | note |
|---|---|---|---|---|---|
| 65d15c38-3f60-4b36-b678-5de465527a37 | director@jkkn.ac.in | yuva | yuva_super_admin | 2026 | Dev seed — national-tier testing during build |

Still to seed (Phase 18 verification needs them):
- [ ] A `chapter_admin` (app=yuva, yi_chapter='Erode') test account — needed for the scoped-access browser probes (own-chapter allow / other-chapter deny).
- [ ] A `mentor` test account assigned to one run session — for the mentor-portal + RLS probes.
- [ ] An `institution_coordinator` bound to one academy — for the coordinator-scope probes.

LAUNCH grants (Phase 17 — real, NOT dev): piyush.garg@powertekengg.com, vedant@wrs.energy, mayank.jain@cii.in → app='yuva', role='yuva_super_admin' (Director-provided 2026-06-10).
