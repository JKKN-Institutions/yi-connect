# BUG-08: Mentor Messages — team thread link missing /yi-future/ prefix

**Role:** Mentor (64SZSM), and Captain/Member (same component used at /yi-future/me/messages)
**Severity:** CRITICAL — mentor cannot open any team thread, blocking mentor-team communication
**Found:** 2026-05-23 production sweep

## Repro
1. Unlock with mentor code `64SZSM`
2. Direct-navigate to /yi-future/mentor/messages (since BUG-07 — no nav)
3. See team list with "The Smart Warriors" entry
4. Click the team → URL goes to `/mentor/messages?thread=<uuid>` → **404**

## Source (grep'd earlier)
`app/yi-future/me/messages/page.tsx:124`:
```
href={`/me/messages?thread=${t.id}`}
```

Same component likely shared between mentor/me/host messages contexts. Either:
- Component should infer its parent route from session role, or
- Each consumer needs to pass the correct prefix.

## Verified
- Broken: `/mentor/messages?thread=a16ca2fc-...` → 404
- Working: `/yi-future/mentor/messages?thread=a16ca2fc-...` → renders thread, Send button enabled

## Fix
1. In `app/yi-future/me/messages/page.tsx:124`, prepend `/yi-future` — but check if this component is reused for mentor (likely yes).
2. Better: refactor href construction to use `usePathname()` parent-aware prefix, or pass `basePath` prop from each consumer.
