/**
 * Bug Reporter API Proxy
 *
 * Proxies requests to the JKKN Bug Reporter API to bypass CORS restrictions.
 * This is needed because the browser blocks cross-origin requests from localhost.
 *
 * All requests to /api/bug-reporter/* are forwarded to the Bug Reporter API.
 */

import { NextRequest, NextResponse } from 'next/server'

const BUG_REPORTER_API_URL =
  process.env.NEXT_PUBLIC_BUG_REPORTER_API_URL || 'https://jkkn-centralized-bug-reporter.vercel.app'

async function proxyRequest(request: NextRequest, path: string[]) {
  const targetPath = path.join('/')
  // The SDK calls {apiUrl}/api/v1/... so path already includes 'api'
  // Forward directly without adding /api/ prefix
  const targetUrl = `${BUG_REPORTER_API_URL}/${targetPath}`

  // Get the request body if present
  let body: string | null = null
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      body = await request.text()
    } catch {
      // No body
    }
  }

  // Forward headers (excluding host and other problematic headers)
  const headers = new Headers()
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase()
    if (
      lowerKey !== 'host' &&
      lowerKey !== 'connection' &&
      lowerKey !== 'content-length'
    ) {
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
      'GET, POST, PUT, DELETE, OPTIONS'
    )
    proxyResponse.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-API-Key'
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return proxyRequest(request, path)
}

export async function DELETE(
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
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Max-Age': '86400',
    },
  })
}
