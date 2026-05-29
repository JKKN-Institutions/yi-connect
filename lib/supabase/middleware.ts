/**
 * Supabase Middleware
 *
 * This middleware runs before every request and handles:
 * 1. Session refresh via Supabase
 * 2. Auth gating for yi-connect (OAuth), YIP (mixed), and YiFuture (mixed)
 *
 * Phase E (Agent M, 2026-05-22): Unified auth gates across nested module
 * mounts. YIP and YiFuture were ported in Phase D from standalone Next.js
 * apps; their original middlewares assumed bare paths (e.g. `/jury`,
 * `/dashboard`), but the routes now live under `/yip/*` and `/yi-future/*`.
 *
 * Four auth surfaces coexist:
 *   - yi-connect (Supabase OAuth)         → /dashboard, /members, /events, /finance, ...
 *   - YIP (mixed)                          → OAuth for /yip/dashboard/*, access-code
 *                                            cookie (`yip_session`) for /yip/jury,
 *                                            /yip/me. Public: /yip, /yip/join,
 *                                            /yip/event/*, /yip/login.
 *   - YiFuture (mixed)                     → OAuth for /yi-future/chapter,
 *                                            /yi-future/host, /yi-future/national/admin.
 *                                            Access-code cookie (`yifuture_session`)
 *                                            for /yi-future/me, /yi-future/mentor,
 *                                            /yi-future/jury, /yi-future/partner.
 *                                            Public: most of the rest.
 *   - YiFi (mixed)                         → OAuth for /yifi/admin/*.
 *                                            Access-code cookie (`yifi_session`)
 *                                            for /yifi/me/*. Public: /yifi,
 *                                            /yifi/join, /yifi/reveal.
 *
 * Cookie collision check: yi-connect uses Supabase SSR default
 * `sb-bkmpbcoxbjyafieabxao-auth-token`; YIP uses `yip_session`; YiFuture
 * uses `yifuture_session`; YiFi uses `yifi_session`. No overlap.
 *
 * Cookie path scoping (Agent C, 2026-05-25, yip-absorption shell):
 *   The yip_session cookie SHOULD be set with `path: "/yip"` (not `/`) so
 *   it doesn't leak into /yi-future, /yifi, or /dashboard. Audit needed in:
 *     - app/yip/actions/yip/test-login.ts  (lines 187+ and 221+)
 *     - app/yip/actions/yip/auth.ts         (lines 59+ and 107+)
 *     - app/actions/yip/test-login.ts       (legacy; may already be deleted)
 *     - app/actions/yip/auth.ts             (legacy; may already be deleted)
 *   All `cookieStore.set("yip_session", ..., { path: "/" })` calls must
 *   become `{ path: "/yip" }`. The matching delete() calls don't require a
 *   path arg as long as the original set path was /yip — but if any legacy
 *   cookie at path=/ exists at rollout, do a one-shot best-effort delete on
 *   both paths to avoid stale sessions.
 *   --> VERIFY THIS AFTER AGENT B'S FILE MOVE LANDS.
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  let user = null
  try {
    const response = await supabase.auth.getUser()
    user = response.data.user
  } catch (error) {
    // If auth check fails (e.g., in TWA or offline), continue without user
    console.error('Auth check failed:', error)
  }

  const { pathname } = request.nextUrl

  // ─── YIP nested mount (/yip/*) ────────────────────────────────────────
  if (pathname.startsWith('/yip')) {
    return handleYipAuth(request, supabaseResponse, user)
  }

  // ─── YiFuture nested mount (/yi-future/*) ─────────────────────────────
  if (pathname.startsWith('/yi-future')) {
    return handleYiFutureAuth(request, supabaseResponse, user)
  }

  // ─── YiFi nested mount (/yifi/*) ─────────────────────────────────────
  if (pathname.startsWith('/yifi')) {
    return handleYiFiAuth(request, supabaseResponse, user)
  }

  // ─── yi-connect main surface ──────────────────────────────────────────

  // Public auth-recovery routes (the (auth) route group). These must stay
  // reachable without a session, and a mid-recovery user (who holds a
  // short-lived recovery session after clicking the email link) must NOT be
  // bounced to /dashboard before they finish setting a new password.
  //   /forgot-password  — request a reset email
  //   /reset-password   — set a new password from the emailed PKCE link
  const publicAuthPrefixes = ['/forgot-password', '/reset-password']
  if (
    publicAuthPrefixes.some(
      path => pathname === path || pathname.startsWith(path + '/')
    )
  ) {
    return supabaseResponse
  }

  const protectedPaths = [
    '/dashboard',
    '/members',
    '/member-requests',
    '/events',
    '/finance',
    '/stakeholders',
    '/coordinator',  // Coordinator pages (folded into main dashboard)
    '/sub-chapter',  // Sub-chapter lead pages (folded into main dashboard)
    '/m', // Mobile/TWA routes - all require authentication
  ]
  const isProtectedPath = protectedPaths.some(path =>
    pathname.startsWith(path)
  )

  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // Auth routes - redirect to dashboard if already authenticated
  const authPaths = ['/login']
  const isAuthPath = authPaths.some(path =>
    pathname.startsWith(path) && !pathname.startsWith('/yip') && !pathname.startsWith('/yi-future')
  )

  if (isAuthPath && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  return supabaseResponse
}

/**
 * YIP auth gate. Routes are mounted at /yip/* in yi-connect.
 *
 * Public (no auth):
 *   /yip                       — landing
 *   /yip/join                  — access-code entry
 *   /yip/login                 — organizer login page (mounted under (auth) group)
 *   /yip/event/[id]            — public event page
 *   /yip/event/[id]/display    — big-screen projector display (no auth)
 *   /yip/test-login            — dev quick-login (kept public for now)
 *
 * OAuth-gated (Supabase session required):
 *   /yip/dashboard/*           — organizer admin
 *
 * Access-code-gated (yip_session cookie required):
 *   /yip/jury/*                — jury scoring panel (type=jury)
 *   /yip/me/*                  — participant dashboard (type=participant)
 */
function handleYipAuth(
  request: NextRequest,
  supabaseResponse: NextResponse,
  user: { id: string } | null
): NextResponse {
  const { pathname } = request.nextUrl

  // Public routes — always allowed.
  const publicYipPrefixes = [
    '/yip/join',
    '/yip/login',
    '/yip/event',
    '/yip/test-login',
    '/yip/jury/login',
  ]
  // Exact match for the landing page.
  if (pathname === '/yip' || pathname === '/yip/') {
    return supabaseResponse
  }
  if (publicYipPrefixes.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return supabaseResponse
  }

  // /yip/dashboard/* — OAuth-gated.
  if (pathname.startsWith('/yip/dashboard')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/yip/login'
      url.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // /yip/jury/* — access-code gated (yip_session cookie, type=jury).
  if (pathname.startsWith('/yip/jury')) {
    return requireAccessCodeCookie(request, supabaseResponse, 'yip_session', 'jury', '/yip/join')
  }

  // /yip/me/* — access-code gated (yip_session cookie, type=participant).
  if (pathname.startsWith('/yip/me')) {
    return requireAccessCodeCookie(
      request,
      supabaseResponse,
      'yip_session',
      'participant',
      '/yip/join'
    )
  }

  return supabaseResponse
}

/**
 * YiFuture auth gate. Routes are mounted at /yi-future/* in yi-connect.
 *
 * Public (no auth):
 *   /yi-future, /yi-future/about, /yi-future/editions, /yi-future/tracks,
 *   /yi-future/problems, /yi-future/chapters, /yi-future/national (NOT /national/admin),
 *   /yi-future/join, /yi-future/login, /yi-future/consent, /yi-future/event/*,
 *   /yi-future/offline, /yi-future/dev
 *
 * OAuth-gated (Supabase session required):
 *   /yi-future/chapter/*
 *   /yi-future/host/*
 *   /yi-future/national/admin/*
 *
 * Access-code-gated (yifuture_session cookie required):
 *   /yi-future/me/*        — type=delegate
 *   /yi-future/mentor/*    — type=mentor
 *   /yi-future/jury/*      — type=jury
 *   /yi-future/partner/*   — type=partner
 */
function handleYiFutureAuth(
  request: NextRequest,
  supabaseResponse: NextResponse,
  user: { id: string } | null
): NextResponse {
  const { pathname } = request.nextUrl

  // Always allow yi-future API routes — they handle their own auth.
  if (pathname.startsWith('/yi-future/api')) {
    return supabaseResponse
  }

  // /yi-future/national/admin is the only protected sub-path of /yi-future/national.
  const isNationalAdmin = pathname.startsWith('/yi-future/national/admin')

  // Public routes — always allowed (excluding /national/admin).
  const publicYfPrefixes = [
    '/yi-future/about',
    '/yi-future/editions',
    '/yi-future/tracks',
    '/yi-future/problems',
    '/yi-future/chapters',
    '/yi-future/join',
    '/yi-future/login',
    '/yi-future/access',
    '/yi-future/consent',
    '/yi-future/event',
    '/yi-future/offline',
    '/yi-future/dev',
    '/yi-future/my-bug-reports',
    '/yi-future/quiz',
  ]
  if (pathname === '/yi-future' || pathname === '/yi-future/') {
    return supabaseResponse
  }
  // /yi-future/national is public, but /yi-future/national/admin is NOT.
  if (
    (pathname === '/yi-future/national' || pathname.startsWith('/yi-future/national/')) &&
    !isNationalAdmin
  ) {
    return supabaseResponse
  }
  if (publicYfPrefixes.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return supabaseResponse
  }

  // OAuth-gated admin paths.
  const adminPaths = ['/yi-future/chapter', '/yi-future/host']
  const isAdminPath =
    adminPaths.some(p => pathname === p || pathname.startsWith(p + '/')) || isNationalAdmin

  if (isAdminPath) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/yi-future/login'
      url.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(url)
    }
    // Note: deeper /national/admin allow-list check (yi.national_admins) is
    // performed by the YiFuture-specific middleware/server helpers when the
    // page or action runs. Keeping the root middleware lean avoids an extra
    // DB round-trip per request.
    return supabaseResponse
  }

  // Access-code-gated paths.
  const accessCodeRoles: Record<string, string> = {
    '/yi-future/me': 'delegate',
    '/yi-future/mentor': 'mentor',
    '/yi-future/jury': 'jury',
    '/yi-future/partner': 'partner',
  }
  for (const [path, expectedType] of Object.entries(accessCodeRoles)) {
    if (pathname === path || pathname.startsWith(path + '/')) {
      return requireAccessCodeCookie(
        request,
        supabaseResponse,
        'yifuture_session',
        expectedType,
        '/yi-future/join'
      )
    }
  }

  return supabaseResponse
}

/**
 * Helper: gate a route on an access-code cookie containing JSON
 * `{ type: <expectedType>, ... }`. Redirects to `joinPath` if missing,
 * malformed, or type mismatch.
 */
const YIFUTURE_ROLE_HOME: Record<string, string> = {
  delegate: '/yi-future/me',
  mentor: '/yi-future/mentor',
  jury: '/yi-future/jury',
  partner: '/yi-future/partner',
}

function requireAccessCodeCookie(
  request: NextRequest,
  supabaseResponse: NextResponse,
  cookieName: string,
  expectedType: string,
  joinPath: string
): NextResponse {
  const session = request.cookies.get(cookieName)?.value
  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone()
    url.pathname = path
    url.search = ''
    return NextResponse.redirect(url)
  }
  const redirectToJoin = () => redirectTo(joinPath)

  if (!session) return redirectToJoin()
  try {
    const parsed = JSON.parse(session)
    if (parsed?.type === expectedType) return supabaseResponse
    // Valid session for a different role — route to that role's home
    // instead of bouncing them to the public registration form.
    if (cookieName === 'yifuture_session' && typeof parsed?.type === 'string') {
      const correctHome = YIFUTURE_ROLE_HOME[parsed.type]
      if (correctHome) return redirectTo(correctHome)
    }
    return redirectToJoin()
  } catch {
    return redirectToJoin()
  }
}

/**
 * YiFi auth gate. Routes are mounted at /yifi/* in yi-connect.
 *
 * Public (no auth):
 *   /yifi                       — landing page
 *   /yifi/join                  — registration + census capture
 *   /yifi/reveal                — live reveal screen (projector display)
 *   /yifi/login                 — admin login
 *
 * OAuth-gated (Supabase session required):
 *   /yifi/admin/*               — architect/national admin
 *
 * Access-code-gated (yifi_session cookie required):
 *   /yifi/me/*                  — member personal dashboard (type=member)
 */
function handleYiFiAuth(
  request: NextRequest,
  supabaseResponse: NextResponse,
  user: { id: string } | null
): NextResponse {
  const { pathname } = request.nextUrl

  // Always allow YiFi API routes.
  if (pathname.startsWith('/yifi/api')) {
    return supabaseResponse
  }

  // Public routes.
  const publicYiFiPrefixes = [
    '/yifi/join',
    '/yifi/reveal',
    '/yifi/login',
  ]
  if (pathname === '/yifi' || pathname === '/yifi/') {
    return supabaseResponse
  }
  if (publicYiFiPrefixes.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return supabaseResponse
  }

  // /yifi/admin/* — OAuth-gated.
  if (pathname.startsWith('/yifi/admin')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/yifi/login'
      url.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // /yifi/me/* — access-code gated (yifi_session cookie, type=member).
  if (pathname.startsWith('/yifi/me')) {
    return requireAccessCodeCookie(
      request,
      supabaseResponse,
      'yifi_session',
      'member',
      '/yifi/join'
    )
  }

  return supabaseResponse
}
