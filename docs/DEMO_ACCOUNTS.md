# Yi Connect — Demo Accounts Reference

**Last updated:** 2026-04-18
**Chapter:** Yi Erode (`1a475942-94cc-478d-ab78-89242a0c3a67`)
**Password for all accounts:** `DemoMember2024!`
**Login:** one-click buttons on `/login` (all 8 accounts listed) OR Google OAuth / Magic Link

## 8 Seeded Demo Accounts

| Email | Role | Level | Auth UID |
|---|---|---|---|
| `demo-super@yi-demo.com` | Super Admin | 7 | `efadc440-39bd-45df-a677-270148494759` |
| `demo-national@yi-demo.com` | National Admin | 6 | `216fac23-d024-452d-82a1-32147a24af2d` |
| `demo-exec@yi-demo.com` | Executive Member | 5 | `3d317828-66f5-4416-ae5a-a764f32a63eb` |
| `demo-chair@yi-demo.com` | Chair | 4 | `a2cebaf8-42cd-450d-925e-5ba178fa1cca` |
| `demo-cochair@yi-demo.com` | Co-Chair | 3 | `cfa1238e-0fe2-472a-b1d1-bc1f2ee20ffb` |
| `demo-ec@yi-demo.com` | EC Member | 2 | `370d1094-aeff-40de-93ab-c14337a64394` |
| `demo-industry@yi-demo.com` | Industry Coordinator | 1 | `46b8d5af-fd55-4fa0-b40e-c19c7775742d` |
| `demo-member@yi-demo.com` | Member | 1 | `3f34e58e-e251-4733-83cb-7bb8ded04478` |

## Workflow Role Coverage

| Workflow | Required Roles | Demo Accounts To Use |
|----------|---------------|---------------------|
| 1. Event Lifecycle | EC → Chair → Member | demo-ec → demo-chair → demo-member |
| 2. Succession Nomination | Member → Evaluator → SC → National Admin | demo-member → demo-exec → demo-chair → demo-national |
| 3. Succession Application | Member → Evaluator → National Admin | demo-member → demo-exec → demo-national |
| 4. Awards Nomination | Chair (cycle) → Member (nominate) → Jury | demo-chair → demo-member → demo-cochair |
| 5. Industrial Visit | Industry Coord → Member | demo-industry → demo-member |
| 6. Opportunities | Industry Coord → Member | demo-industry → demo-member |
| 7. Expense Approval | EC Member → Chair | demo-ec → demo-chair |
| 8. Reimbursement | Member → Chair | demo-member → demo-chair |
| 9. Member Join Request | Public → Chair | public `/apply` → demo-chair |
| 10. User Invitation | Admin → Invitee | demo-national → (new email) |
| 11. Chapter Invitation | Super Admin → Chair | demo-super → (new email) |
| 12. AAA Plan (Pathfinder) | Chair (create) → Mentor (approve) → EC (log) | demo-chair → demo-cochair → demo-ec |
| 13. Vertical Plan | Vertical Chair → Chapter Chair | demo-ec → demo-chair |
| 14. Event Materials | EC (upload) → Chair (review) | demo-ec → demo-chair |
| 15. Best Practice | Member → Chair (review) | demo-member → demo-chair |
| 16. Session Report | Trainer → Coordinator | (needs trainer profile seed) |
| 17. National Version Sync | National System → Chapter Admin | (needs national setup) → demo-national |
| 18. Announcement Broadcast | Chair → Member (recipient) | demo-chair → demo-member |
| 19. Newsletter | Comms (Chair) → Subscriber | demo-chair → demo-member |
| 20. User Impersonation | Super Admin | demo-super |

## Open Gaps for Full E2E Test

Some workflows need DATA seeding, not just accounts:

- **Succession**: no active cycle → workflows 2 & 3 need one created first
- **Awards**: no active cycle → workflow 4 needs cycle + category
- **AAA Plan**: mentor must be assigned to chapter first (workflow 12 step 1)
- **Trainer profile** for `demo-ec` or `demo-cochair` → workflow 16
- **Published IV** → workflow 5 needs data
- **Published opportunity** → workflow 6 needs data
- **Active vertical** → workflow 13 needs one

## Regenerating

```bash
bash scripts/seed-demo-accounts.sh
```
