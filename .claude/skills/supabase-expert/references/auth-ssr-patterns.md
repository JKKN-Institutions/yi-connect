# Auth SSR Patterns Reference

Complete authentication SSR implementation patterns for Next.js 14+ with Supabase.

## Critical Rules

### ⛔ NEVER USE (DEPRECATED - BREAKS APPLICATION)

```typescript
// ❌ DEPRECATED - Individual cookie methods
cookies: {
  get(name: string) { ... },      // ❌ BREAKS
  set(name: string, value: string) { ... },  // ❌ BREAKS
  remove(name: string) { ... }     // ❌ BREAKS
}

// ❌ DEPRECATED - Auth helpers package
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
```

### ✅ ALWAYS USE

```typescript
// ✅ CORRECT - SSR package
import { createBrowserClient, createServerClient } from '@supabase/ssr'

// ✅ CORRECT - Cookie methods
cookies: {
  getAll() { ... },    // ✅ ONLY THIS
  setAll() { ... }     // ✅ ONLY THIS
}
```

## Browser Client Pattern

**File:** `lib/supabase/client.ts`

**Use for:** Client components, browser-side operations

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Usage in Client Components:**

```typescript
'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export default function ClientComponent() {
  const [user, setUser] = useState(null)
  const supabase = createClient()

  useEffect(() => {
    // Get initial user
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  if (!user) {
    return <div>Please log in</div>
  }

  return <div>Hello, {user.email}</div>
}
```

## Server Client Pattern

**File:** `lib/supabase/server.ts`

**Use for:** Server Components, Server Actions, API Routes

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore if called from Server Component
            // This can happen during static rendering
          }
        },
      },
    }
  )
}
```

**Usage in Server Components:**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ProtectedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch data
  const { data: students } = await supabase
    .from('students')
    .select('*')
    .eq('institution_id', user.user_metadata.institution_id)

  return (
    <div>
      <h1>Welcome, {user.email}</h1>
      <StudentList students={students} />
    </div>
  )
}
```

## Middleware Pattern

**File:** `middleware.ts`

**Use for:** Authentication checks, session refresh, route protection

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
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

  // CRITICAL: Must call getUser() to refresh session
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect to login if not authenticated
  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect to dashboard if already logged in
  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse  // MUST return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

## Server Action Pattern

**File:** `app/(routes)/some-feature/actions.ts`

**Use for:** Form submissions, mutations, server-side operations

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createStudent(formData: FormData) {
  const supabase = await createClient()

  // Check auth
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Extract form data
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string

  // Insert data
  const { data, error } = await supabase
    .from('students')
    .insert({
      first_name: firstName,
      last_name: lastName,
      institution_id: user.user_metadata.institution_id,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create student: ${error.message}`)
  }

  // Revalidate and redirect
  revalidatePath('/students')
  redirect('/students')
}

export async function updateStudent(id: string, formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { error } = await supabase
    .from('students')
    .update({
      first_name: formData.get('firstName') as string,
      last_name: formData.get('lastName') as string,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to update student: ${error.message}`)
  }

  revalidatePath('/students')
}

export async function deleteStudent(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { error } = await supabase
    .from('students')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to delete student: ${error.message}`)
  }

  revalidatePath('/students')
}
```

## API Route Pattern

**File:** `app/api/students/route.ts`

**Use for:** REST API endpoints

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()

  // Check auth
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Get query params
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  // Query data
  let query = supabase
    .from('students')
    .select('*')
    .eq('institution_id', user.user_metadata.institution_id)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const body = await request.json()

  const { data, error } = await supabase
    .from('students')
    .insert({
      ...body,
      institution_id: user.user_metadata.institution_id,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ data }, { status: 201 })
}
```

## Login/Signup Patterns

**File:** `app/login/page.tsx`

```typescript
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('Login error:', error.message)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      console.error('Signup error:', error.message)
      return
    }

    // Optionally redirect to email verification page
    router.push('/verify-email')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
        />
        <button type="submit">Log In</button>
        <button type="button" onClick={handleSignup}>
          Sign Up
        </button>
      </form>
    </div>
  )
}
```

## OAuth Login Pattern

```typescript
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function OAuthLogin() {
  const supabase = createClient()
  const router = useRouter()

  const handleGoogleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      console.error('OAuth error:', error.message)
    }
  }

  return (
    <button onClick={handleGoogleLogin}>
      Sign in with Google
    </button>
  )
}
```

**OAuth Callback Route:** `app/auth/callback/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Redirect to dashboard after OAuth login
  return NextResponse.redirect(`${requestUrl.origin}/dashboard`)
}
```

## Role-Based Access Pattern

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check user role from JWT
  const role = user.user_metadata?.role || 'user'

  if (!['admin', 'super_admin'].includes(role)) {
    redirect('/unauthorized')
  }

  return <div>Admin Content</div>
}
```

## Session Management Patterns

### Check if User is Authenticated

```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()

if (user) {
  // User is authenticated
  console.log('Logged in as:', user.email)
} else {
  // User is not authenticated
  redirect('/login')
}
```

### Get User Metadata

```typescript
const { data: { user } } = await supabase.auth.getUser()

if (user) {
  const institutionId = user.user_metadata?.institution_id
  const role = user.user_metadata?.role
  const email = user.email
}
```

### Refresh Session

```typescript
// This happens automatically in middleware
// Manual refresh if needed:
const { data, error } = await supabase.auth.refreshSession()
```

## Common Patterns Checklist

- [ ] Using `@supabase/ssr` package (NOT auth-helpers)
- [ ] Using ONLY `getAll()` and `setAll()` methods
- [ ] NEVER using `get()`, `set()`, or `remove()` methods
- [ ] Middleware calls `getUser()` to refresh session
- [ ] Middleware returns `supabaseResponse` object
- [ ] Server client has try-catch for `setAll`
- [ ] Client components use `createBrowserClient`
- [ ] Server components use `createServerClient`
- [ ] Auth state changes handled with `onAuthStateChange`

## Troubleshooting

### Session Not Persisting

**Problem:** User gets logged out on refresh

**Solution:**
```typescript
// Ensure middleware is returning supabaseResponse
return supabaseResponse  // NOT NextResponse.next()

// Ensure middleware calls getUser()
await supabase.auth.getUser()
```

### Cookies Not Setting

**Problem:** Auth cookies not being set

**Solution:**
```typescript
// Ensure using setAll, not set
cookies: {
  setAll(cookiesToSet) {  // ✅ CORRECT
    cookiesToSet.forEach(({ name, value, options }) =>
      cookieStore.set(name, value, options)
    )
  }
}
```

### Middleware Errors

**Problem:** Middleware throws errors

**Solution:**
```typescript
// Add try-catch in server client setAll
cookies: {
  setAll(cookiesToSet) {
    try {
      cookiesToSet.forEach(({ name, value, options }) =>
        cookieStore.set(name, value, options)
      )
    } catch {
      // Ignore if called from Server Component
    }
  }
}
```
