---
name: nextjs16-web-development
description: Comprehensive Next.js 16 web development skill covering Cache Components, Server Actions, Turbopack, PPR, and React 19.2 patterns. Use when building full-stack Next.js 16 applications, implementing CRUD features with optimal caching strategies, creating forms with Server Actions, setting up new projects with standardized architecture, or migrating from Next.js 15. Covers complete workflow from database design with Supabase RLS to production deployment with TypeScript, Zod validation, and modern React patterns. Automatically triggers for Next.js 16 project setup, module development, caching optimization, or team workflow standardization.
---

# Next.js 16 Web Development

Complete production-ready workflow for building modern Next.js 16 applications with optimal performance, security, and developer experience.

## Core Paradigm Shift

**Next.js 15**: Static by default → opt into dynamic
**Next.js 16**: Dynamic by default → opt into caching with `use cache`

This fundamental shift provides fine-grained control over caching at the function level rather than page level.

## When to Use This Skill

Use this skill when:

- **Starting a new Next.js 16 project** with proper configuration and structure
- **Building CRUD modules** with optimal caching and Server Actions
- **Implementing forms** with validation, error handling, and optimistic updates
- **Optimizing performance** with Cache Components and PPR
- **Designing database schemas** with Supabase and Row Level Security
- **Migrating from Next.js 15** to Next.js 16 architecture
- **Standardizing team workflows** for consistent Next.js 16 development
- **Creating real-time features** with appropriate cache strategies

## Quick Decision Framework

### Caching Strategy

```
Is the data user-specific?
├─ YES → Is it personalized but cacheable?
│  ├─ YES → 'use cache: private' + appropriate cacheLife
│  └─ NO → Don't cache (use runtime APIs like cookies)
└─ NO → How often does it change?
   ├─ Real-time → No cache
   ├─ Seconds → 'use cache' + cacheLife('realtime' or 'seconds')
   ├─ Minutes → 'use cache' + cacheLife('frequent' or 'minutes')
   ├─ Hours → 'use cache' + cacheLife('moderate' or 'hours')
   ├─ Days → 'use cache' + cacheLife('days')
   └─ Rarely → 'use cache' + cacheLife('weeks' or 'static')
```

### Cache Invalidation Strategy

```
User expects instant update?
├─ YES → updateTag() - Instant invalidation
└─ NO → revalidateTag() - Background refresh
```

- **updateTag**: Use for INSTANT updates when users expect immediate feedback (save, delete, update)
- **revalidateTag**: Use for BACKGROUND updates where slight delays are acceptable (periodic syncs)

### Server Actions vs Route Handlers

```
Need to handle form submission?
├─ YES → Server Action
└─ NO → Building API for external use?
   ├─ YES → Route Handler
   └─ NO → Server Action
```

**Use Server Actions for:**

- Form submissions
- CRUD operations (create/update/delete)
- Mutations with CSRF protection
- Progressive enhancement

**Use Route Handlers for:**

- External webhooks
- REST/GraphQL APIs for external consumers
- File downloads
- Specific HTTP method requirements

## Project Initialization Workflow

### 1. Create Next.js 16 Project

```bash
# Initialize with Turbopack
npx create-next-app@latest project-name --typescript --tailwind --app --turbopack

# Install core dependencies
npm install @supabase/supabase-js @supabase/ssr
npm install zod react-hook-form @hookform/resolvers
npm install date-fns clsx tailwind-merge lucide-react
```

### 2. Configure Next.js 16 (Critical)

Enable Cache Components in `next.config.ts`:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true, // Enable PPR and use cache

  cacheLife: {
    // Predefined profiles
    default: { expire: 3600 },
    seconds: { expire: 5 },
    minutes: { expire: 60 },
    hours: { expire: 3600 },
    days: { expire: 86400 },
    weeks: { expire: 604800 },
    max: { expire: Number.MAX_SAFE_INTEGER },

    // Custom profiles
    realtime: { expire: 1 },
    frequent: { expire: 30 },
    moderate: { expire: 300 },
    stable: { expire: 3600 },
  },
}

export default nextConfig
```

### 3. Standard Project Structure

```
app/
├── (auth)/              # Auth routes group
├── (dashboard)/         # Protected routes group
├── actions/             # Server Actions by module
├── api/                 # API routes (webhooks only)
lib/
├── supabase/           # Supabase clients (server.ts, client.ts)
├── data/               # Cached data fetching functions
├── validations/        # Zod schemas
├── utils/              # Utilities (cn.ts, format.ts)
components/
├── ui/                 # Shadcn/UI components
├── shared/             # Shared components
├── forms/              # Form components
types/                  # TypeScript types
config/                 # App configuration
```

## Core Patterns

### Pattern 1: Cached Data Fetching

```typescript
// lib/data/products.ts
import { cacheTag, cacheLife } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function getProducts(filters?: ProductFilters) {
  'use cache'
  cacheLife('hours')  // or 'minutes', 'days', 'weeks'
  cacheTag('products') // for invalidation

  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('products')
    .select('*, category:categories(name)', { count: 'exact' })

  // Apply filters
  if (filters?.search) {
    query = query.textSearch('name', filters.search)
  }

  const { data, error, count } = await query
  if (error) throw error

  return { data: data || [], total: count || 0 }
}
```

### Pattern 2: Server Actions for Mutations

```typescript
// app/actions/products.ts
'use server'

import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { CreateProductSchema } from '@/types/product'

export async function createProduct(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  // Validate input
  const validation = CreateProductSchema.safeParse({
    name: formData.get('name'),
    price: formData.get('price'),
    stock_quantity: formData.get('stock_quantity'),
  })

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: 'Invalid fields. Please check the form.',
    }
  }

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('products')
    .insert([validation.data])
    .select()
    .single()

  if (error) {
    return { message: 'Database error: Failed to create product.' }
  }

  // Instant cache invalidation
  updateTag('products')

  redirect(`/products/${data.id}`)
}
```

### Pattern 3: Streaming with Suspense

```tsx
// app/(dashboard)/dashboard/page.tsx
import { Suspense } from 'react'

export default async function DashboardPage() {
  return (
    <div>
      {/* Static shell - instant */}
      <DashboardHeader />

      {/* Long-lived cache */}
      <Suspense fallback={<StatsSkeleton />}>
        <StaticStats />
      </Suspense>

      {/* Medium cache */}
      <Suspense fallback={<ChartsSkeleton />}>
        <AnalyticsCharts />
      </Suspense>

      {/* No cache - real-time */}
      <Suspense fallback={<LiveSkeleton />}>
        <LiveMetrics />
      </Suspense>
    </div>
  )
}

async function StaticStats() {
  'use cache'
  cacheLife('days')
  cacheTag('static-stats')

  const stats = await getStaticStatistics()
  return <StatsGrid data={stats} />
}
```

### Pattern 4: Form with Validation & Error Handling

```tsx
// components/forms/product-form.tsx
'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { createProduct } from '@/app/actions/products'

export function ProductForm({ product, categories }) {
  const action = product
    ? updateProduct.bind(null, product.id)
    : createProduct

  const [state, formAction] = useActionState(action, {})

  return (
    <form action={formAction} className="space-y-6">
      {state.message && (
        <div className={state.success ? 'alert-success' : 'alert-error'}>
          {state.message}
        </div>
      )}

      <div>
        <label htmlFor="name">Product Name *</label>
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={product?.name}
          required
          aria-invalid={!!state.errors?.name}
        />
        {state.errors?.name && (
          <p className="error">{state.errors.name[0]}</p>
        )}
      </div>

      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Saving...' : 'Save Product'}
    </button>
  )
}
```

### Pattern 5: Optimistic Updates

```tsx
// components/optimistic-todo-list.tsx
'use client'

import { useOptimistic, startTransition } from 'react'
import { toggleTodo, deleteTodo } from '@/app/actions/todos'

export function OptimisticTodoList({ todos }) {
  const [optimisticTodos, updateOptimisticTodos] = useOptimistic(
    todos,
    (state, action) => {
      switch (action.type) {
        case 'toggle':
          return state.map(todo =>
            todo.id === action.id
              ? { ...todo, completed: !todo.completed }
              : todo
          )
        case 'delete':
          return state.filter(todo => todo.id !== action.id)
        default:
          return state
      }
    }
  )

  const handleToggle = async (id) => {
    startTransition(() => {
      updateOptimisticTodos({ type: 'toggle', id })
    })
    await toggleTodo(id)
  }

  return (
    <ul>
      {optimisticTodos.map(todo => (
        <li key={todo.id}>
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={() => handleToggle(todo.id)}
          />
          <span>{todo.title}</span>
        </li>
      ))}
    </ul>
  )
}
```

## Type Safety with Zod

```typescript
// types/product.ts
import { z } from 'zod'

export const CreateProductSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name is too long'),
  price: z.coerce
    .number({ invalid_type_error: 'Price must be a number' })
    .positive('Price must be positive'),
  stock_quantity: z.coerce
    .number()
    .int('Stock must be a whole number')
    .min(0, 'Stock cannot be negative'),
})

export const UpdateProductSchema = CreateProductSchema.partial()

export type CreateProductInput = z.infer<typeof CreateProductSchema>
```

## Supabase Setup

### Server Client

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerSupabaseClient() {
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
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

### Authentication Utilities

```typescript
// lib/auth.ts
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cache } from 'react'

export const getCurrentUser = cache(async () => {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

export async function requireRole(allowedRoles: string[]) {
  const user = await requireAuth()
  const supabase = await createServerSupabaseClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !allowedRoles.includes(profile.role)) {
    redirect('/unauthorized')
  }

  return { user, role: profile.role }
}
```

## Module Development Workflow

When building a new feature module (e.g., Products, Orders):

1. **Database Schema** - Create table with RLS policies (see `references/database-patterns.md`)
2. **Types** - Define interfaces and Zod schemas (`types/module.ts`)
3. **Data Layer** - Create cached data fetching functions (`lib/data/module.ts`)
4. **Server Actions** - Implement CRUD operations (`app/actions/module.ts`)
5. **UI Components** - Build forms and lists (`components/module/`)
6. **Pages** - Create routes with Suspense boundaries (`app/(dashboard)/module/`)

## Best Practices

### DO:

- ✅ Enable `cacheComponents` in next.config.ts
- ✅ Use Server Actions for all mutations
- ✅ Apply `use cache` to data fetching functions
- ✅ Wrap dynamic content in Suspense boundaries
- ✅ Validate all inputs on server with Zod
- ✅ Use optimistic updates for better UX
- ✅ Implement proper RLS policies
- ✅ Use `updateTag` for instant cache updates
- ✅ Use TypeScript strict mode
- ✅ Handle errors gracefully
- ✅ Add multiple cache tags for granular invalidation
- ✅ Stream UI progressively with PPR

### DON'T:

- ❌ Use runtime APIs (cookies, headers) in cached functions
- ❌ Over-cache frequently changing data
- ❌ Forget Suspense boundaries for streaming
- ❌ Use Route Handlers for simple mutations
- ❌ Trust client-side validation alone
- ❌ Expose sensitive data in error messages
- ❌ Mix cached and uncached data without Suspense
- ❌ Use edge runtime with Cache Components

## Performance Targets

- First Contentful Paint (FCP): < 1.2s
- Largest Contentful Paint (LCP): < 2.5s
- First Input Delay (FID): < 100ms
- Cumulative Layout Shift (CLS): < 0.1
- Time to First Byte (TTFB): < 600ms

## Migration from Next.js 15

### Replace Route Segment Config

```typescript
// BEFORE (Next.js 15)
export const dynamic = 'force-static'
export const revalidate = 3600

// AFTER (Next.js 16)
async function getCachedData() {
  'use cache'
  cacheLife('hours')
  cacheTag('data')
  return await fetchData()
}
```

### Update Async Params

```typescript
// BEFORE (Next.js 15)
export default function Page({ params, searchParams }) {
  const id = params.id
}

// AFTER (Next.js 16)
export default async function Page({ params, searchParams }) {
  const { id } = await params
}
```

See `references/migration-guide.md` for complete migration patterns.

## Resources

This skill includes comprehensive reference documentation and automation tools:

### references/

Detailed patterns and examples loaded as needed:

- `cache-components-patterns.md` - Advanced caching strategies, PPR, invalidation
- `server-actions-forms.md` - Form handling, validation, file uploads, multi-step forms
- `module-builder-patterns.md` - Complete CRUD module development workflows
- `migration-guide.md` - Step-by-step Next.js 15 to 16 migration
- `database-patterns.md` - Supabase schemas, RLS policies, indexes, functions

### scripts/

Automation tools for common tasks:

- `init_project.sh` - Initialize Next.js 16 project with standard structure
- `generate_module.py` - Generate CRUD module boilerplate
- `validate_structure.py` - Validate project follows team standards

### assets/

Templates and boilerplate code:

- `next.config.ts` - Optimized Next.js 16 configuration
- `module-template/` - Complete CRUD module boilerplate
- `supabase-schema/` - Database schema templates

---

Follow these patterns to build production-ready Next.js 16 applications with optimal performance, security, and developer experience. Reference the detailed documentation in `references/` for specific use cases and advanced patterns.
