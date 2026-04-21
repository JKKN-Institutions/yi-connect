# Yi Connect — Stutzee-Inspired Feature Roadmap

**Date:** 2026-04-18
**Source:** [Stutzee.com](https://www.stutzee.com) event management platform gap analysis
**Planning agents:** 4 parallel project-architect subagents

## Quick reference

| Cluster | Features | Hours | File |
|---------|----------|-------|------|
| **1 — Event Structure** | Multi-session agenda, Speaker profiles, Custom form builder | **21.25h** | [stutzee-1-event-structure.md](./stutzee-1-event-structure.md) |
| **2 — Event Experience** | QR tickets, Public landing page, Live dashboard | **27h** | [stutzee-2-event-experience.md](./stutzee-2-event-experience.md) |
| **3 — Monetization** | Sponsorship tiers, Ticket pricing, Razorpay gateway, Lead capture | **33h** | [stutzee-3-monetization.md](./stutzee-3-monetization.md) |
| **4 — Engagement** | Networking (scan-to-connect), Gamification + badges + leaderboard | **34h** | [stutzee-4-engagement.md](./stutzee-4-engagement.md) |
| | **TOTAL** | **115.25h** | |

## What the 4 agents found (key audits)

### Reusable foundations (40-60% of each cluster already exists)

| Finding | Cluster |
|---------|---------|
| `speakers` table in stakeholders CRM has 90% of Stutzee speaker fields | 1B |
| But ~15 columns exist in TS types and NOT in DB schema (silent drift) | 1B — fix in migration |
| `event_checkins` + `html5-qrcode` + `qrcode` packages + HMAC lib all present | 2A |
| `/rsvp/[token]` public route + anon RLS + `GuestRSVPForm` already built | 2B |
| Supabase Realtime `postgres_changes` pattern proven in `notification-bell.tsx` | 2C |
| `sponsorship_tiers` + `sponsorship_deals` + `sponsorship_payments` tables all exist | 3A |
| `sponsorship_deals.event_id` FK means **no junction table needed** | 3A |
| `engagement_score` live with 50/30/15/5 chapter-configurable weights | 4B |
| `chapter_settings` has extensible JSONB pattern | 4B |

### Greenfield (nothing exists)

| Gap | Cluster |
|-----|---------|
| Per-attendee QR (only event-wide QR exists) | 2A |
| `public_slug` column + `/e/[slug]` short URL for posters | 2B |
| `/events/[id]/live` big-screen dashboard | 2C |
| Razorpay integration (no payment gateway exists anywhere) | 3C |
| `event_ticket_tiers` + pricing + `event_payments` | 3B |
| `sponsor_leads` table | 3D |
| `member_connections` (existing `member_networks` is stakeholder-only) | 4A |
| `profile_qr_token` on members | 4A |
| `member_points_log` + `badges` + `member_badges` | 4B |

## Recommended build order (by priority × independence)

### Phase 1 — Foundation (Week 1-2, ~30h)
1. **1B Speaker extensions** — closes type/schema drift, unblocks 1A (5.5h)
2. **2A QR per-attendee tickets** — foundation for 2C + 3D + 4A (8h)
3. **4B Gamification schema + top-priority hooks** — delivers visible leaderboard (10h)
4. **3A Sponsorship tier UI** — standalone, immediate ROI visible to sponsors (6h)

### Phase 2 — Experience (Week 3-4, ~35h)
5. **1A Multi-session agenda** — unblocks 2B/2C conditional sections (8h)
6. **2B Public landing page** — shareable URLs for WhatsApp (9h)
7. **2C Live event dashboard** — event-day operational UX (10h)
8. **4A Attendee networking** — scan-to-connect + address book (13h — but independent)

### Phase 3 — Monetization (Week 5-6, ~27h)
9. **3C Razorpay gateway** — **build BEFORE 3B** (12h — highest risk)
10. **3B Ticket pricing tiers** — requires 3C working end-to-end (8h)
11. **3D Lead capture** — reuses existing QR scanner (7h)

### Phase 4 — Polish (Week 7, ~23h)
12. **1C Custom form builder** — per-event custom registration fields (7.75h)
13. **4B remaining hooks + badges + Take Pride integration** — full gamification (11h)
14. **Cron job for leaderboard refresh + reconciliation** (4h)

**Total calendar time with 2 engineers in parallel: ~7 weeks**
**Sequential single engineer: ~12 weeks**

## Critical-path dependencies

```
1B (speakers) ──▶ 1A (sessions) ──▶ 2B (public page agenda section)
                                └──▶ 2C (NextSessionCard)
2A (QR tickets) ──▶ 2C (live dashboard LatestArrivals)
                └──▶ 3D (sponsor lead scanning)
3C (Razorpay) ──▶ 3B (paid ticket tiers)
4A and 4B are mostly independent of 1-3
```

## Risks across all clusters

| Risk | Affects | Mitigation |
|------|---------|-----------|
| Migration column drift between TS types and DB | 1B | Agent 1's migration closes the gap for `speakers` |
| QR token spoofing | 2A, 4A | Idempotency + RLS; `/connect` requires auth |
| Payment webhook failures | 3C | Nightly reconciliation job |
| GST on paid events | 3B, 3C | Yi is Section 8 non-profit — confirm with CA before launch |
| Gamification gaming | 4B | Daily 50pt cap + quality gates + weighted values |
| Realtime subscription stale on kiosk mode | 2C | Heartbeat server action every 45min |

## Decisions pending user input before build starts

1. **Does Yi run paid events?** If no, skip 3B+3C entirely. Saves 20h.
2. **Multi-timezone chapter support?** Currently hardcoded `Asia/Kolkata`. If chapters outside India exist, add `chapters.timezone` column.
3. **Bidirectional vs one-way connections (4A)?** Plan assumes one-way. Mutual-required is a later upgrade.
4. **Gamification opt-in per chapter?** `chapter_settings.gamification_config.enabled` flag controls. Default on.
5. **Session-level RSVPs (1A)?** Plan assumes event-level RSVP + per-session "interest" only. Strict capacity enforcement per session is deferred.
