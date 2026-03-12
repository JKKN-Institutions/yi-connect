# Yi Creative Studio Integration Guide

## For Yi Creative Studio Development Team

**Document Version:** 2.0
**Last Updated:** February 9, 2026
**From:** Yi Connect Development Team

---

## Table of Contents

1. [Overview](#overview)
2. [Integration Architecture](#integration-architecture)
3. [OAuth 2.0 Implementation](#oauth-20-implementation)
4. [SSO Token Verification](#sso-token-verification)
5. [Webhook Integration](#webhook-integration)
6. [API Endpoints Required](#api-endpoints-required)
7. [Data Schemas](#data-schemas)
8. [Security Considerations](#security-considerations)
9. [Testing & Verification](#testing--verification)

---

## Overview

Yi Connect is implementing a **dynamic, self-service integration** that allows each Yi Chapter to connect their own Yi Creative Studio organization. This replaces the previous single-tenant, hardcoded configuration.

### What's Changing

| Before | After |
|--------|-------|
| Single hardcoded organization | Multiple organizations (per chapter) |
| Admin-only configuration | Chapter admins can self-connect |
| Environment variable credentials | Database-stored credentials |
| Shared SSO keys | Per-chapter RSA key pairs |

### Integration Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     COMPLETE INTEGRATION FLOW                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. OAUTH CONNECTION (One-time setup)                                   │
│     Yi Connect Admin → Yi Creative OAuth → Store credentials            │
│                                                                          │
│  2. SSO LOGIN (Per poster creation)                                     │
│     User clicks "Create Poster" → JWT token → Yi Creative verifies      │
│                                                                          │
│  3. WEBHOOK SYNC (Background)                                           │
│     Yi Connect events → Webhook → Yi Creative synced_events             │
│                                                                          │
│  4. POSTER CALLBACK (After creation)                                    │
│     Yi Creative → Webhook → Yi Connect updates event banner             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Integration Architecture

### System Diagram

```
┌──────────────────────────┐         ┌──────────────────────────┐
│       Yi Connect         │         │    Yi Creative Studio    │
│    (Identity Provider)   │         │    (Service Provider)    │
├──────────────────────────┤         ├──────────────────────────┤
│                          │         │                          │
│  ┌────────────────────┐  │         │  ┌────────────────────┐  │
│  │ yi_creative_       │  │         │  │ organizations      │  │
│  │ connections        │  │         │  │ (existing table)   │  │
│  │ ─────────────────  │  │         │  │ ─────────────────  │  │
│  │ chapter_id         │  │         │  │ id                 │  │
│  │ organization_id ───┼──┼─────────┼──┼─► id               │  │
│  │ sso_private_key    │  │         │  │ name               │  │
│  │ sso_public_key ────┼──┼─────────┼──┼─► public_key       │  │
│  │ webhook_secret ────┼──┼─────────┼──┼─► webhook_secret   │  │
│  └────────────────────┘  │         │  └────────────────────┘  │
│                          │         │                          │
│  ┌────────────────────┐  │         │  ┌────────────────────┐  │
│  │ Server Actions     │  │  OAuth  │  │ OAuth Endpoints    │  │
│  │ ─────────────────  │  │◄───────►│  │ ─────────────────  │  │
│  │ initiateConnect()  │  │         │  │ /oauth/authorize   │  │
│  │ handleCallback()   │  │         │  │ /oauth/token       │  │
│  └────────────────────┘  │         │  └────────────────────┘  │
│                          │         │                          │
│  ┌────────────────────┐  │   SSO   │  ┌────────────────────┐  │
│  │ SSO Module         │  │  Token  │  │ SSO Verification   │  │
│  │ ─────────────────  │  │────────►│  │ ─────────────────  │  │
│  │ generateSSOToken() │  │  (JWT)  │  │ /api/auth/sso      │  │
│  │ Signs with         │  │         │  │ Verifies with      │  │
│  │ PRIVATE key        │  │         │  │ PUBLIC key         │  │
│  └────────────────────┘  │         │  └────────────────────┘  │
│                          │         │                          │
└──────────────────────────┘         └──────────────────────────┘
```

---

## OAuth 2.0 Implementation

Yi Creative Studio needs to implement OAuth 2.0 Authorization Code flow.

### Required Endpoints

#### 1. Authorization Endpoint

```
GET /oauth/authorize
```

**Query Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `client_id` | Yes | Always `yi-connect` |
| `redirect_uri` | Yes | `https://yi-connect-app.vercel.app/api/yi-creative/callback` |
| `response_type` | Yes | Always `code` |
| `scope` | Yes | `organization:read` |
| `state` | Yes | Base64-encoded JSON with chapter info |

**State Parameter Structure:**
```json
{
  "chapter_id": "uuid-of-yi-connect-chapter",
  "user_id": "uuid-of-yi-connect-user",
  "nonce": "random-32-byte-hex-string",
  "redirect_uri": "https://yi-connect-app.vercel.app/api/yi-creative/callback",
  "created_at": 1707472800000
}
```

**Flow:**
1. Show login page if user not authenticated
2. Show authorization consent screen
3. On approval, redirect to `redirect_uri` with `code` and `state`

**Success Redirect:**
```
https://yi-connect-app.vercel.app/api/yi-creative/callback?code=AUTH_CODE&state=BASE64_STATE
```

**Error Redirect:**
```
https://yi-connect-app.vercel.app/api/yi-creative/callback?error=access_denied&error_description=User%20denied%20access
```

---

#### 2. Token Endpoint

```
POST /api/oauth/token
Content-Type: application/json
```

**Request Body:**
```json
{
  "grant_type": "authorization_code",
  "code": "AUTH_CODE_FROM_AUTHORIZE",
  "client_id": "yi-connect",
  "redirect_uri": "https://yi-connect-app.vercel.app/api/yi-creative/callback"
}
```

**Success Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
  "expires_in": 3600,
  "token_type": "Bearer",
  "scope": "organization:read"
}
```

**Error Response (400):**
```json
{
  "error": "invalid_grant",
  "error_description": "Authorization code expired or invalid"
}
```

---

#### 3. Organization Info Endpoint

```
GET /api/organizations/me
Authorization: Bearer ACCESS_TOKEN
```

**Success Response (200):**
```json
{
  "id": "bd21dd9d-2f08-478f-a457-74f014d5d6d1",
  "name": "JKKN Institutions",
  "email": "automation@jkkn.ac.in",
  "logo_url": "https://yi-creative-studio.vercel.app/logos/jkkn.png",
  "created_at": "2026-01-08T10:30:00Z"
}
```

---

#### 4. Register Keys Endpoint (NEW)

After OAuth connection, Yi Connect will register its public key for SSO verification.

```
POST /api/oauth/register-keys
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json
```

**Request Body:**
```json
{
  "chapter_id": "yi-connect-chapter-uuid",
  "chapter_name": "Yi Chennai",
  "public_key": "LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0K...",
  "webhook_secret": "shared-webhook-secret-hex-string"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Keys registered successfully"
}
```

**Error Response (401):**
```json
{
  "error": "unauthorized",
  "message": "Invalid or expired access token"
}
```

---

### OAuth Client Registration

Yi Creative Studio should register Yi Connect as an OAuth client:

```json
{
  "client_id": "yi-connect",
  "client_name": "Yi Connect - Chapter Management System",
  "redirect_uris": [
    "https://yi-connect-app.vercel.app/api/yi-creative/callback",
    "http://localhost:3000/api/yi-creative/callback"
  ],
  "scopes": ["organization:read"],
  "token_endpoint_auth_method": "none"
}
```

---

## SSO Token Verification

When users click "Create Poster" in Yi Connect, they are redirected to Yi Creative with a signed JWT token.

### SSO Endpoint

```
GET /api/auth/sso?token=JWT_TOKEN
```

### Token Structure

**Header:**
```json
{
  "alg": "RS256",
  "typ": "JWT"
}
```

**Payload:**
```json
{
  "sub": "user-uuid-from-yi-connect",
  "email": "user@example.com",
  "name": "John Doe",
  "avatar_url": "https://example.com/avatar.jpg",
  "chapters": [
    {
      "chapter_id": "chapter-uuid",
      "chapter_name": "Yi Chennai",
      "chapter_location": "Chennai",
      "role": "chapter_chair",
      "hierarchy_level": 4
    }
  ],
  "event_id": "event-uuid-if-creating-poster",
  "event_data": {
    "id": "event-uuid",
    "name": "Annual Conference 2026",
    "date": "2026-02-15",
    "startTime": "10:00",
    "endTime": "17:00",
    "venue": "City Center",
    "venueAddress": "123 Main Street",
    "city": "Chennai",
    "description": "Join us for...",
    "bannerImageUrl": null,
    "eventType": "conference",
    "chapterId": "chapter-uuid",
    "chapterName": "Yi Chennai",
    "chapterLocation": "Chennai",
    "isVirtual": false,
    "virtualMeetingLink": null
  },
  "redirect_to": "/create",
  "iss": "yi-connect",
  "aud": "yi-creative",
  "iat": 1707472800,
  "exp": 1707473100
}
```

### Verification Process

```typescript
// Pseudo-code for SSO verification

async function verifySSOToken(token: string): Promise<SSOPayload | null> {
  try {
    // 1. Decode token header to check algorithm
    const header = decodeJWTHeader(token);
    if (header.alg !== 'RS256') {
      throw new Error('Invalid algorithm');
    }

    // 2. Decode payload to get chapter info
    const unverifiedPayload = decodeJWTPayload(token);

    // 3. Get the public key for this chapter's organization
    //    Yi Connect will send their public key during OAuth connection
    const publicKey = await getPublicKeyForChapter(unverifiedPayload.chapters[0]?.chapter_id);

    if (!publicKey) {
      throw new Error('No public key found for chapter');
    }

    // 4. Verify token signature with public key
    const payload = await jose.jwtVerify(token, publicKey, {
      issuer: 'yi-connect',
      audience: 'yi-creative',
    });

    // 5. Check expiration (tokens are valid for 5 minutes)
    if (payload.exp < Date.now() / 1000) {
      throw new Error('Token expired');
    }

    return payload;
  } catch (error) {
    console.error('SSO verification failed:', error);
    return null;
  }
}
```

### Public Key Storage

When a Yi Connect chapter connects via OAuth, Yi Connect will provide a **public key** that should be stored:

```sql
-- Add to your organizations table or create a new table
ALTER TABLE organizations ADD COLUMN yi_connect_public_key TEXT;
ALTER TABLE organizations ADD COLUMN yi_connect_chapter_id UUID;
```

**Or create a dedicated table:**

```sql
CREATE TABLE yi_connect_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  chapter_id UUID NOT NULL,  -- Yi Connect chapter UUID
  public_key TEXT NOT NULL,  -- RSA public key (PEM format, base64 encoded)
  webhook_secret TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id)
);
```

### Public Key Format

The public key is sent as **base64-encoded PEM**:

```
LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0K...
```

**Decoded:**
```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAt4gz1P1+HZxWC9NYpzRQ
52EiRIX5CAZoae2pt58Icpq0DECjgHto6Gpa4cbrY8LFdZsXPzsOH6sOKs6LbNEX
...
-----END PUBLIC KEY-----
```

---

## Webhook Integration

### Event Sync Webhook (Yi Connect → Yi Creative)

Yi Connect sends event updates to Yi Creative.

```
POST /api/webhooks/events
Content-Type: application/json
X-Source-App-Id: yi-connect
X-Webhook-Secret: SHARED_SECRET
```

**Request Body:**
```json
{
  "action": "create" | "update" | "delete",
  "organization_id": "yi-creative-org-uuid",
  "event": {
    "id": "yi-connect-event-uuid",
    "name": "Annual Conference 2026",
    "date": "2026-02-15",
    "startTime": "10:00",
    "endTime": "17:00",
    "venue": "City Center",
    "venueAddress": "123 Main Street",
    "city": "Chennai",
    "status": "published",
    "createdAt": "2026-01-15T10:00:00Z",
    "updatedAt": "2026-02-09T14:30:00Z",
    "chapterName": "Yi Chennai",
    "chapterLocation": "Chennai",
    "isVirtual": false,
    "bannerImageUrl": "https://..."
  }
}
```

---

### Poster Created Webhook (Yi Creative → Yi Connect)

When a poster is created/updated in Yi Creative, notify Yi Connect.

```
POST https://yi-connect-app.vercel.app/api/webhooks/yi-creative
Content-Type: application/json
X-Webhook-Secret: SHARED_SECRET
```

**Request Body:**
```json
{
  "action": "poster_created" | "poster_updated",
  "event_id": "yi-connect-event-uuid",
  "poster": {
    "id": "poster-uuid",
    "url": "https://yi-creative-studio.vercel.app/posters/abc123.png",
    "thumbnail_url": "https://yi-creative-studio.vercel.app/posters/abc123-thumb.png",
    "created_at": "2026-02-09T15:00:00Z",
    "created_by": "user-uuid"
  }
}
```

---

## API Endpoints Required

### Summary of All Endpoints

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/oauth/authorize` | GET | Start OAuth flow (consent screen) | ✅ Implemented |
| `/api/oauth/token` | POST | Exchange code for tokens | ✅ Implemented |
| `/api/organizations/me` | GET | Get org info (with Bearer token) | ✅ Implemented |
| `/api/oauth/register-keys` | POST | Store public key for SSO | ✅ Implemented |
| `/api/auth/sso` | GET | Verify SSO token, create session | ✅ Implemented |
| `/api/webhooks/events` | POST | Receive event sync from Yi Connect | ✅ Implemented |

### Allowed Redirect URIs (Configured in Yi Creative)

```
https://yi-connect-app.vercel.app/api/yi-creative/callback
http://localhost:3000/api/yi-creative/callback
http://localhost:3001/api/yi-creative/callback
```

---

## Data Schemas

### Event Data Schema (SSO Token)

```typescript
interface EventData {
  // Required
  id: string              // Yi Connect event UUID
  name: string            // Event title
  date: string            // ISO date: "2026-02-15"
  startTime: string       // 24h format: "10:00"
  endTime: string         // 24h format: "17:00"
  eventType: string       // "conference", "workshop", etc.
  chapterId: string       // Yi Connect chapter UUID
  chapterName: string     // "Yi Chennai"
  chapterLocation: string // "Chennai"
  isVirtual: boolean

  // Optional
  venue: string | null
  venueAddress: string | null
  city: string | null
  description: string | null
  bannerImageUrl: string | null
  virtualMeetingLink: string | null
}
```

### User Data Schema (SSO Token)

```typescript
interface SSOPayload {
  sub: string           // User UUID
  email: string         // User email
  name: string          // Full name
  avatar_url?: string   // Avatar URL
  chapters: Array<{
    chapter_id: string
    chapter_name: string
    chapter_location: string
    role: string        // "chapter_chair", "member", etc.
    hierarchy_level: number  // 1-6
  }>
  event_id?: string     // If creating poster for specific event
  event_data?: EventData
  redirect_to?: string  // Where to redirect after SSO

  // JWT standard claims
  iss: "yi-connect"
  aud: "yi-creative"
  iat: number
  exp: number
}
```

---

## Security Considerations

### 1. Token Security

- SSO tokens expire in **5 minutes**
- Tokens are signed with **RS256** (RSA + SHA-256)
- Each chapter has their own RSA key pair
- Verify `iss` (issuer) is `yi-connect`
- Verify `aud` (audience) is `yi-creative`

### 2. Webhook Security

- Verify `X-Webhook-Secret` header matches stored secret
- Use HTTPS only
- Implement request timeout (30 seconds max)

### 3. OAuth Security

- Validate `redirect_uri` against whitelist
- Authorization codes should expire in 10 minutes
- Access tokens should expire in 1 hour
- Store refresh tokens securely (encrypted)

### 4. Public Key Management

- Store public keys per organization
- Public keys can be rotated (Yi Connect will update via OAuth re-connect)
- Don't expose private keys (Yi Connect keeps those)

---

## Testing & Verification

### Test OAuth Flow

```bash
# 1. Start OAuth flow (opens in browser)
open "https://yi-creative-studio.vercel.app/oauth/authorize?\
client_id=yi-connect&\
redirect_uri=https://yi-connect-app.vercel.app/api/yi-creative/callback&\
response_type=code&\
scope=organization:read&\
state=eyJjaGFwdGVyX2lkIjoiMTIzIn0"

# 2. Exchange code for token
curl -X POST https://yi-creative-studio.vercel.app/api/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "code": "AUTH_CODE",
    "client_id": "yi-connect",
    "redirect_uri": "https://yi-connect-app.vercel.app/api/yi-creative/callback"
  }'

# 3. Get organization info
curl https://yi-creative-studio.vercel.app/api/organizations/me \
  -H "Authorization: Bearer ACCESS_TOKEN"

# 4. Register public key for SSO
curl -X POST https://yi-creative-studio.vercel.app/api/oauth/register-keys \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "chapter_id": "yi-connect-chapter-uuid",
    "chapter_name": "Yi Chennai",
    "public_key": "BASE64_ENCODED_PEM_PUBLIC_KEY",
    "webhook_secret": "shared-webhook-secret"
  }'
```

### Test SSO Verification

```bash
# Test SSO endpoint
curl "https://yi-creative-studio.vercel.app/api/auth/sso?token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Verify Webhook

```bash
# Test webhook endpoint
curl -X POST https://yi-creative-studio.vercel.app/api/webhooks/events \
  -H "Content-Type: application/json" \
  -H "X-Source-App-Id: yi-connect" \
  -H "X-Webhook-Secret: test-secret" \
  -d '{
    "action": "create",
    "organization_id": "test-org-id",
    "event": {
      "id": "test-event",
      "name": "Test Event",
      "date": "2026-03-01",
      "status": "published",
      "createdAt": "2026-02-09T10:00:00Z",
      "updatedAt": "2026-02-09T10:00:00Z"
    }
  }'
```

---

## Implementation Checklist

### Yi Creative Studio Team (COMPLETED)

- [x] **OAuth Endpoints**
  - [x] `GET /oauth/authorize` - Authorization page
  - [x] `POST /api/oauth/token` - Token exchange
  - [x] `POST /api/oauth/register-keys` - Store public keys
  - [x] Register `yi-connect` as OAuth client

- [x] **Organization API**
  - [x] `GET /api/organizations/me` - Return org info with Bearer token

- [x] **SSO Verification**
  - [x] `GET /api/auth/sso` - Verify JWT, create session
  - [x] Store public keys per organization
  - [ ] Pre-fill poster form with `event_data` from token

- [x] **Database Changes**
  - [x] Add `yi_connect_public_key` column or create integration table
  - [x] Add `yi_connect_chapter_id` for mapping

- [x] **Webhook**
  - [x] Receive events from Yi Connect
  - [ ] Send poster created webhook to Yi Connect

### Yi Connect Team (IN PROGRESS)

- [x] **OAuth Flow**
  - [x] `initiateYiCreativeConnect()` - Start OAuth
  - [x] `/api/yi-creative/callback` - Handle OAuth callback
  - [x] Store connection in `yi_creative_connections` table

- [x] **SSO Token Generation**
  - [x] Generate RS256 signed JWT tokens
  - [x] Include event_data in token payload
  - [x] Support per-chapter RSA key pairs

- [ ] **Testing**
  - [ ] Run database migration: `npx supabase db push`
  - [ ] Test OAuth connection flow
  - [ ] Test SSO with "Create Poster" button
  - [ ] Test poster created webhook

---

## Contact

For questions or issues:

- **Yi Connect Team**: [development@yichapter.org]
- **GitHub Issues**: [yi-connect repository]

---

## Appendix: Sample Public Key

For testing, you can use this sample public key:

```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAt4gz1P1+HZxWC9NYpzRQ
52EiRIX5CAZoae2pt58Icpq0DECjgHto6Gpa4cbrY8LFdZsXPzsOH6sOKs6LbNEX
UNxddW2LVTtaQeMDk4DNIKSLfdUpRAW1LVxCIjxu23hSAXx7xQBFX5aeTx1DueD0
6/MsymoOK5XpAWEJSSw6xDuyqlH59xseVcmD5IPmmEJq72I271K62xBHXkYEqnM3
lUNvFcPp10rTAKWoRGW9iPc1yB9joRsgw5YZGV0BlnBx3hKDkI8qPsMy95+krq73
Nd9U8LyARSsi8qME4IuC7vE1Mmv8dn96ywSGqdbGVI3xQxnYS+zXyMx4c9vHmbbw
UQIDAQAB
-----END PUBLIC KEY-----
```

**Base64 Encoded:**
```
LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FROEFNSUlCQ2dLQ0FRRUF0NGd6MVAxK0haeFdDOU5ZcHpSUQo1MkVpUklYNUNBWm9hZTJwdDU4SWNwcTBERUNqZ0h0bzZHcGE0Y2JyWThMRmRac1hQenNPSDZzT0tzNkxiTkVYClVOeGRkVzJMVlR0YVFlTURrNEROSUtTTGZkVXBSQVcxTFZ4Q0lqeHUyM2hTQVh4N3hRQkZYNWFlVHgxRHVlRDAKNi9Nc3ltb09LNVhwQVdFSlNTdzZ4RHV5cWxINTl4c2VWY21ENUlQbW1FSnE3MkkyNzFLNjJ4QkhYa1lFcW5NMwpsVU52RmNQcDEwclRBS1dvUkdXOWlQYzF5Qjlqb1JzZ3c1WVpHVjBCbG5CeDNoS0RrSThxUHNNeTk1K2tycTczCk5kOVU4THlBUlNzaThxTUU0SXVDN3ZFMU1tdjhkbjk2eXdTR3FkYkdWSTN4UXhuWVMrelh5TXg0Yzl2SG1iYncKVVFJREFRQUIKLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0tCg==
```
