# Varnam Vizha — P5 Polish Notes

Status of the P5 polish pass and **deferred** follow-up items. The items below are
documented, **not implemented** in this branch. Each has a concrete how-to so a
future session can pick it up without re-discovery.

## What P5 shipped (this branch)

- **Bilingual public pages.** Tamil shown inline alongside English on the public
  pages (hero tagline, primary CTA, the Programme heading, and the event date/venue
  section header). No language toggle / i18n framework — both languages render
  inline. Tamil text is wrapped in `<span lang="ta">…</span>` and rendered with the
  Tamil-subset fonts already loaded by `app/varnam-vizha/layout.tsx`.
- **Scoped PWA manifest.** `public/varnam-vizha/manifest.webmanifest` (scope
  `/varnam-vizha`) + `public/varnam-vizha/icon.svg`, linked from the varnam layout
  metadata only.

### Tamil strings added — NEED NATIVE REVIEW

The festival name **வர்ணம் விழா** (Varnam Vizha) and **ஈரோடு** (Erode) are verified.
Everything else below was AI-generated and is flagged with
`{/* TAMIL: needs native review */}` at each call site:

| String | Intended meaning | Location |
| --- | --- | --- |
| `வண்ணங்களின் திருவிழா · ஈரோடு` | festival of colours · Erode | `app/varnam-vizha/page.tsx` (hero tagline) |
| `நிகழ்ச்சி நிரல்` | programme | `app/varnam-vizha/page.tsx` (primary CTA) and `app/varnam-vizha/events/page.tsx` (heading subtitle) |
| `நாள் & இடம்` | date & venue | `app/varnam-vizha/events/[slug]/page.tsx` (section header) |

A native Tamil reviewer should confirm spelling, spacing, and natural phrasing
before the public launch.

---

## Deferred item 1 — Custom domain

When the marketing domain name is decided (e.g. `varnamvizha.org`), route it to the
`/varnam-vizha` segment with a host-based rewrite in the **shared** `middleware.ts`.

> ⚠️ This edits `middleware.ts`, which is shared by the whole app. Handle with care:
> scope the match tightly to the varnam host only, keep all existing matcher/logic
> intact, and verify other verticals (yip, root) are unaffected after the change.

Sketch of the rewrite to add inside the existing middleware function:

```ts
const host = request.headers.get("host");
const { pathname } = request.nextUrl;

if (host?.startsWith("varnamvizha")) {
  return NextResponse.rewrite(
    new URL("/varnam-vizha" + pathname, request.url)
  );
}
```

Then add the domain in the Vercel project (Settings → Domains) and point DNS at
Vercel. Confirm the manifest `scope`/`start_url` still resolve under the new host
(they are root-relative `/varnam-vizha`, so they continue to work after the rewrite).

## Deferred item 2 — Suppress the shared "Install Yi Connect" PWA prompt on varnam routes

The "Install Yi Connect" PWA install prompt currently appears on `/varnam-vizha`
routes too. It is rendered by the **root** `app/layout.tsx` (shared across the whole
app), not by the varnam layout — so it is out of scope for this branch.

Follow-up: make that prompt route-aware so it is suppressed on `/varnam-vizha/*`
(e.g. read the current pathname in the prompt component via `usePathname()` and
return `null` when it starts with `/varnam-vizha`, or gate it at the root layout).
This touches shared code, so coordinate with anyone else working on `app/layout.tsx`.

## Deferred item 3 — Full i18n toggle (next-intl)

The current approach is **inline bilingual** (Tamil + English shown together), which
is intentional and sufficient for launch. A future upgrade could introduce a real
language toggle with `next-intl`:

- Extract strings into `en` / `ta` message catalogs.
- Wrap the varnam segment in a `NextIntlClientProvider` (or use the App Router
  server-side `getTranslations`).
- Add a header toggle that switches the active locale (persisted in a cookie).

This is a larger change than P5; keep the inline-bilingual pages until there's a
clear need for a single-language view.

## Deferred item 4 — PNG app icons (192 / 512 / maskable)

The manifest currently ships a single scalable `icon.svg` (`sizes: "any"`), which
covers most installs. For maximum compatibility (older Android, maskable adaptive
icons), add raster PNGs as a follow-up:

- `public/varnam-vizha/icon-192.png` (192×192, `purpose: "any"`)
- `public/varnam-vizha/icon-512.png` (512×512, `purpose: "any"`)
- `public/varnam-vizha/icon-maskable-512.png` (512×512, `purpose: "maskable"`,
  with safe-zone padding so the "வ" mark isn't clipped by adaptive masks)

Then add these entries to the `icons` array in `manifest.webmanifest`. They can be
rendered from `icon.svg` with any SVG→PNG tool.
