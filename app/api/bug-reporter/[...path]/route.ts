/**
 * Bug Reporter API Proxy
 *
 * Proxies requests to the JKKN Bug Reporter API to bypass CORS restrictions.
 * This is needed because the browser blocks cross-origin requests from localhost.
 *
 * All requests to /api/bug-reporter/* are forwarded to the Bug Reporter API.
 *
 * Hardened 2026-05-24 (BUG-SWEEP-2026-05-24):
 * - Upstream host is locked to the JKKN Centralized Bug Reporter; any override
 *   pointing elsewhere is rejected so this can never be used as an open proxy.
 * - Authorization and Cookie headers from the incoming request are dropped
 *   before forwarding so logged-in Yi Connect session cookies / bearer tokens
 *   are not leaked to the upstream.
 * - Only GET, POST, and OPTIONS are allowed (matches what the SDK actually
 *   uses); PUT/DELETE are removed.
 */

import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_UPSTREAM = 'https://jkkn-centralized-bug-reporter.vercel.app'

// Allow-list of upstream hostnames this proxy is permitted to forward to.
const ALLOWED_UPSTREAM_HOSTS = new Set<string>([
  'jkkn-centralized-bug-reporter.vercel.app',
])

function resolveUpstreamBase(): string | null {
  const candidate =
    process.env.NEXT_PUBLIC_BUG_REPORTER_API_URL || DEFAULT_UPSTREAM
  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'https:') return null
    if (!ALLOWED_UPSTREAM_HOSTS.has(parsed.host)) return null
    // Strip any path/query the env may have appended — we only want origin.
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return null
  }
}

// Headers we will NEVER forward upstream. Authorization and Cookie are dropped
// so caller credentials cannot leak; standard hop-by-hop headers are also
// removed since fetch handles them on its own.
const HEADERS_BLOCKED_FROM_FORWARDING = new Set<string>([
  'host',
  'connection',
  'content-length',
  'authorization',
  'cookie',
  'proxy-authorization',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-real-ip',
])

async function proxyRequest(request: NextRequest, path: string[]) {
  const upstreamBase = resolveUpstreamBase()
  if (!upstreamBase) {
    return NextResponse.json(
      { error: 'Bug Reporter upstream host is not configured or not allowed.' },
      { status: 400 }
    )
  }

  const targetPath = path.join('/')
  // The SDK calls {apiUrl}/api/v1/... so path already includes 'api'
  // Forward directly without adding /api/ prefix
  const targetUrl = `${upstreamBase}/${targetPath}`

  // Get the request body if present
  let body: string | null = null
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      body = await request.text()
    } catch {
      // No body
    }
  }

  // Forward headers, but drop anything that could leak credentials or break
  // the upstream connection.
  const headers = new Headers()
  request.headers.forEach((value, key) => {
    if (!HEADERS_BLOCKED_FROM_FORWARDING.has(key.toLowerCase())) {
      headers.set(key, value)
    }
  })

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: body || undefined,
    })

    // Get response body
    const responseBody = await response.text()

    // Create response with CORS headers
    const proxyResponse = new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
    })

    // Copy response headers
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase()
      if (
        lowerKey !== 'content-encoding' &&
        lowerKey !== 'transfer-encoding'
      ) {
        proxyResponse.headers.set(key, value)
      }
    })

    // Add CORS headers
    proxyResponse.headers.set('Access-Control-Allow-Origin', '*')
    proxyResponse.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, OPTIONS'
    )
    proxyResponse.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, X-API-Key'
    )

    return proxyResponse
  } catch (error) {
    console.error('Proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to proxy request to Bug Reporter API' },
      { status: 502 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return proxyRequest(request, path)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return proxyRequest(request, path)
}

export async function OPTIONS() {
  // Handle preflight requests
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
      'Access-Control-Max-Age': '86400',
    },
  })
}
