/**
 * Yi Creative Studio OAuth Callback
 *
 * Handles the OAuth callback from Yi Creative Studio after user authorization.
 * Exchanges the authorization code for tokens and creates the connection.
 */

import { NextRequest, NextResponse } from 'next/server'
import { handleYiCreativeOAuthCallback } from '@/app/actions/yi-creative-connections'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://yi-connect-app.vercel.app'
  const settingsUrl = `${baseUrl}/settings/integrations`

  // Handle OAuth errors
  if (error) {
    console.error('[Yi Creative OAuth] Error from provider:', error, errorDescription)
    const errorUrl = new URL(settingsUrl)
    errorUrl.searchParams.set('yi_creative_error', errorDescription || error)
    return NextResponse.redirect(errorUrl)
  }

  // Validate required parameters
  if (!code || !state) {
    console.error('[Yi Creative OAuth] Missing code or state')
    const errorUrl = new URL(settingsUrl)
    errorUrl.searchParams.set('yi_creative_error', 'Missing authorization code or state')
    return NextResponse.redirect(errorUrl)
  }

  // Handle the callback
  const result = await handleYiCreativeOAuthCallback(code, state)

  if (!result.success) {
    console.error('[Yi Creative OAuth] Callback failed:', result.error)
    const errorUrl = new URL(settingsUrl)
    errorUrl.searchParams.set('yi_creative_error', result.error || 'Connection failed')
    return NextResponse.redirect(errorUrl)
  }

  // Success - redirect to settings with success message
  const successUrl = new URL(settingsUrl)
  successUrl.searchParams.set('yi_creative_connected', 'true')
  successUrl.searchParams.set(
    'yi_creative_org',
    result.connection?.organization_name || 'Yi Creative Studio'
  )

  return NextResponse.redirect(successUrl)
}
