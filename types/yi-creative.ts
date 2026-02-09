/**
 * Yi Creative Studio Integration Types
 *
 * Types for managing Yi Creative Studio connections per chapter.
 */

// ============================================================================
// Database Types
// ============================================================================

/**
 * Yi Creative connection status
 */
export type YiCreativeConnectionStatus = 'active' | 'disconnected' | 'expired'

/**
 * Yi Creative connection stored in database
 */
export interface YiCreativeConnection {
  id: string
  chapter_id: string
  organization_id: string
  organization_name: string | null
  status: YiCreativeConnectionStatus
  connected_by: string
  connected_at: string
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
  webhook_secret: string | null
  sso_private_key: string | null
  sso_public_key: string | null
  created_at: string
  updated_at: string
}

/**
 * Yi Creative connection with related data
 */
export interface YiCreativeConnectionWithDetails extends YiCreativeConnection {
  chapter?: {
    id: string
    name: string
    location: string
  }
  connected_by_profile?: {
    id: string
    full_name: string
    email: string
  }
}

// ============================================================================
// OAuth Types
// ============================================================================

/**
 * OAuth state stored during authorization flow
 */
export interface YiCreativeOAuthState {
  chapter_id: string
  user_id: string
  nonce: string
  redirect_uri: string
  created_at: number
}

/**
 * OAuth authorization response from Yi Creative
 */
export interface YiCreativeAuthResponse {
  code: string
  state: string
}

/**
 * OAuth token response from Yi Creative
 */
export interface YiCreativeTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope?: string
}

/**
 * Organization info from Yi Creative API
 */
export interface YiCreativeOrganization {
  id: string
  name: string
  email?: string
  logo_url?: string
  created_at: string
}

// ============================================================================
// Action Types
// ============================================================================

/**
 * Result of initiating OAuth flow
 */
export interface InitiateConnectResult {
  success: boolean
  redirect_url?: string
  error?: string
}

/**
 * Result of manual connection (Simple API Key Exchange)
 */
export interface ManualConnectResult {
  success: boolean
  connection?: YiCreativeConnection
  error?: string
}

/**
 * Result of OAuth callback handling
 */
export interface OAuthCallbackResult {
  success: boolean
  connection?: YiCreativeConnection
  error?: string
}

/**
 * Result of disconnect action
 */
export interface DisconnectResult {
  success: boolean
  error?: string
}

/**
 * Data needed to create a connection
 */
export interface CreateConnectionData {
  chapter_id: string
  organization_id: string
  organization_name?: string
  connected_by: string
  access_token?: string
  refresh_token?: string
  token_expires_at?: string
  webhook_secret?: string
  sso_private_key?: string
  sso_public_key?: string
}

/**
 * Data for updating a connection
 */
export interface UpdateConnectionData {
  organization_name?: string
  status?: YiCreativeConnectionStatus
  access_token?: string
  refresh_token?: string
  token_expires_at?: string
  webhook_secret?: string
  sso_private_key?: string
  sso_public_key?: string
}

// ============================================================================
// UI Types
// ============================================================================

/**
 * Connection status for UI display
 */
export interface YiCreativeConnectionUIStatus {
  isConnected: boolean
  status: YiCreativeConnectionStatus | 'not_connected'
  organizationName: string | null
  connectedBy: string | null
  connectedAt: Date | null
  canConnect: boolean
  canDisconnect: boolean
}
