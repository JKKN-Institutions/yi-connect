---

# Next.js 16 Advanced Module Builder

Build high-performance modules using Next.js 16's latest features including Cache Components, Server Actions, and optimized data patterns.

## Quick Decision Framework

### When to Use This Skill

Use this skill when you need to:
- Create CRUD modules with optimal caching strategies
- Build features with real-time and cached data requirements
- Implement server-side mutations without API routes
- Optimize performance with Cache Components
- Handle complex data fetching patterns
- Build forms with Server Actions

## Core Architecture Changes in Next.js 16

### 1. Dynamic by Default

Next.js 16 introduces a fundamental shift:
- **Before**: Pages were static by default, you opted into dynamic
- **Now**: Everything is dynamic by default, you opt into caching with `use cache`

### 2. Cache Components Architecture

```typescript
// Enable Cache Components in next.config.ts
const nextConfig: NextConfig = {
  cacheComponents: true, // Enables PPR and use cache
}
```

### 3. Server Actions First

Server Actions are now the preferred method for mutations:
- No separate API routes needed
- Built-in CSRF protection
- Automatic form progressive enhancement
- Direct database access

## Module Development Workflow

### Step 1: Enable Cache Components

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
}

export default nextConfig
```

### Step 2: Database Layer with Caching

```typescript
// lib/data/[module].ts
import { cacheTag, cacheLife } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// Cached data fetching function
export async function getEntities(filters?: EntityFilters) {
  'use cache'
  cacheTag('entities')
  cacheLife('hours') // or 'days', 'weeks', 'months'
  
  const supabase = await createServerSupabaseClient()
  
  let query = supabase
    .from('entities')
    .select('*', { count: 'exact' })
  
  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`)
  }
  
  const { data, error, count } = await query
  
  if (error) throw error
  return { data: data || [], total: count || 0 }
}

// Get single entity - also cached
export async function getEntityById(id: string) {
  'use cache'
  cacheTag('entities', `entity-${id}`)
  cacheLife('hours')
  
  const supabase = await createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('entities')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data
}

// Real-time data that shouldn't be cached
export async function getRealtimeMetrics(entityId: string) {
  // No 'use cache' - always fresh
  const supabase = await createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('entity_metrics')
    .select('*')
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  
  if (error) throw error
  return data
}
```

### Step 3: Server Actions for Mutations

```typescript
// app/actions/[module].ts
'use server'

import { revalidateTag, updateTag } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'

// Schema validation
const CreateEntitySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
})

// CREATE action
export async function createEntity(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  
  // Validate input
  const validatedData = CreateEntitySchema.parse({
    name: formData.get('name'),
    description: formData.get('description'),
    is_active: formData.get('is_active') === 'true',
  })
  
  // Insert into database
  const { data, error } = await supabase
    .from('entities')
    .insert([validatedData])
    .select()
    .single()
  
  if (error) {
    throw new Error(`Failed to create: ${error.message}`)
  }
  
  // Invalidate cache for immediate update
  updateTag('entities') // Use updateTag for instant updates
  
  redirect(`/entities/${data.id}`)
}

// UPDATE action with optimistic updates
export async function updateEntity(id: string, formData: FormData) {
  const supabase = await createServerSupabaseClient()
  
  const validatedData = CreateEntitySchema.partial().parse({
    name: formData.get('name'),
    description: formData.get('description'),
  })
  
  const { error } = await supabase
    .from('entities')
    .update(validatedData)
    .eq('id', id)
  
  if (error) {
    throw new Error(`Failed to update: ${error.message}`)
  }
  
  // Update specific cache entries
  updateTag('entities')
  updateTag(`entity-${id}`)
}

// DELETE action
export async function deleteEntity(id: string) {
  const supabase = await createServerSupabaseClient()
  
  const { error } = await supabase
    .from('entities')
    .delete()
    .eq('id', id)
  
  if (error) {
    throw new Error(`Failed to delete: ${error.message}`)
  }
  
  updateTag('entities')
  redirect('/entities')
}

// BULK operations
export async function bulkUpdateEntities(ids: string[], updates: any) {
  const supabase = await createServerSupabaseClient()
  
  const { error } = await supabase
    .from('entities')
    .update(updates)
    .in('id', ids)
  
  if (error) {
    throw new Error(`Bulk update failed: ${error.message}`)
  }
  
  // Use revalidateTag for background refresh
  revalidateTag('entities', 'max')
}
```

### Step 4: Component Architecture with Streaming

```tsx
// app/(routes)/entities/page.tsx
import { Suspense } from 'react'
import { getEntities } from '@/lib/data/entities'
import { EntityList } from './_components/entity-list'
import { EntityListSkeleton } from './_components/entity-list-skeleton'
import { RealtimeStats } from './_components/realtime-stats'

export default function EntitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>
}) {
  return (
    <div className="container">
      <h1>Entities</h1>
      
      {/* Static shell - pre-rendered */}
      <div className="mb-8">
        <CreateEntityButton />
      </div>
      
      {/* Cached content with suspense */}
      <Suspense fallback={<EntityListSkeleton />}>
        <CachedEntityList searchParams={searchParams} />
      </Suspense>
      
      {/* Real-time content - always fresh */}
      <Suspense fallback={<div>Loading stats...</div>}>
        <RealtimeStats />
      </Suspense>
    </div>
  )
}

// Cached component
async function CachedEntityList({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>
}) {
  const params = await searchParams
  const entities = await getEntities({
    search: params.search,
    page: parseInt(params.page || '1'),
  })
  
  return <EntityList entities={entities} />
}
```

### Step 5: Form Components with Server Actions

```tsx
// app/(routes)/entities/_components/entity-form.tsx
import { createEntity, updateEntity } from '@/app/actions/entities'

interface EntityFormProps {
  entity?: Entity
}

export function EntityForm({ entity }: EntityFormProps) {
  // Bind the action with entity ID for updates
  const action = entity 
    ? updateEntity.bind(null, entity.id)
    : createEntity
  
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="name">Name</label>
        <input
          type="text"
          name="name"
          id="name"
          defaultValue={entity?.name}
          required
        />
      </div>
      
      <div>
        <label htmlFor="description">Description</label>
        <textarea
          name="description"
          id="description"
          defaultValue={entity?.description}
        />
      </div>
      
      <SubmitButton />
    </form>
  )
}

// Client component for loading state
'use client'

import { useFormStatus } from 'react-dom'

function SubmitButton() {
  const { pending } = useFormStatus()
  
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Saving...' : 'Save'}
    </button>
  )
}
```

### Step 6: Advanced Caching Patterns

```typescript
// lib/data/advanced-patterns.ts

// Pattern 1: Nested caching with different durations
export async function getDashboard() {
  'use cache'
  cacheLife('hours') // Main dashboard cached for hours
  
  return {
    title: 'Dashboard',
    sections: await Promise.all([
      getStaticContent(),     // Cached for days
      getDynamicMetrics(),     // Cached for minutes
      getUserSpecificData(),   // Not cached
    ])
  }
}

async function getStaticContent() {
  'use cache'
  cacheLife('days')
  cacheTag('static-content')
  
  // Fetch rarely changing content
  return await fetchStaticData()
}

async function getDynamicMetrics() {
  'use cache'
  cacheLife('seconds') // Very short cache
  cacheTag('metrics')
  
  // Fetch frequently changing metrics
  return await fetchMetrics()
}

// Pattern 2: Private caching for user-specific data
export async function getUserDashboard(userId: string) {
  'use cache: private'
  cacheTag(`user-${userId}`)
  
  // User-specific cached data
  return await fetchUserData(userId)
}

// Pattern 3: Remote caching for heavy computations
export async function getComputedAnalytics(params: AnalyticsParams) {
  'use cache: remote'
  cacheTag('analytics')
  cacheLife({ expire: 3600 }) // 1 hour
  
  // Heavy computation cached remotely
  return await computeAnalytics(params)
}
```

### Step 7: Optimistic Updates Pattern

```tsx
// app/(routes)/entities/_components/optimistic-entity-list.tsx
'use client'

import { useOptimistic, startTransition } from 'react'
import { deleteEntity } from '@/app/actions/entities'

export function OptimisticEntityList({ entities }: { entities: Entity[] }) {
  const [optimisticEntities, addOptimisticUpdate] = useOptimistic(
    entities,
    (state, deletedId: string) => 
      state.filter(entity => entity.id !== deletedId)
  )
  
  const handleDelete = async (id: string) => {
    startTransition(() => {
      addOptimisticUpdate(id)
    })
    await deleteEntity(id)
  }
  
  return (
    <ul>
      {optimisticEntities.map(entity => (
        <li key={entity.id}>
          {entity.name}
          <button onClick={() => handleDelete(entity.id)}>
            Delete
          </button>
        </li>
      ))}
    </ul>
  )
}
```

## Caching Strategy Decision Tree

```
Is the data user-specific?
├─ YES → Is it personalized but cacheable?
│  ├─ YES → use cache: private
│  └─ NO → Don't cache (runtime APIs)
└─ NO → How often does it change?
   ├─ Seconds/Minutes → use cache + cacheLife('seconds')
   ├─ Hours → use cache + cacheLife('hours')
   ├─ Days → use cache + cacheLife('days')
   └─ Rarely → use cache + cacheLife('weeks'/'months')
```

## Server Action vs Route Handler Decision

### Use Server Actions when:
- Handling form submissions
- Performing mutations (create/update/delete)
- Need progressive enhancement
- Want automatic CSRF protection
- Direct database access is acceptable

### Use Route Handlers when:
- Building REST/GraphQL APIs for external consumers
- Need specific HTTP methods (not just POST)
- Handling webhooks
- File uploads/downloads
- Complex streaming responses

## Performance Optimization Checklist

- [ ] Enable cacheComponents in next.config.ts
- [ ] Add 'use cache' to data fetching functions
- [ ] Configure appropriate cacheLife for each data type
- [ ] Use cacheTag for granular invalidation
- [ ] Wrap dynamic content in Suspense boundaries
- [ ] Use Server Actions for all mutations
- [ ] Implement optimistic updates for better UX
- [ ] Use updateTag for instant updates, revalidateTag for background
- [ ] Stream dynamic content while serving cached shells
- [ ] Avoid cookies/headers in cached functions

## Common Pitfalls to Avoid

1. **Don't use runtime APIs in cached functions**
   - cookies(), headers(), searchParams won't work with 'use cache'
   
2. **Don't over-cache dynamic data**
   - User-specific data usually shouldn't be cached
   - Real-time metrics need very short or no caching
   
3. **Don't forget Suspense boundaries**
   - Required for streaming and PPR to work properly
   
4. **Don't use Route Handlers for mutations**
   - Server Actions are simpler and more secure

## Migration from Next.js 15

### Replace route segment config:
```typescript
// Before (Next.js 15)
export const dynamic = 'force-dynamic'
export const revalidate = 3600

// After (Next.js 16)
'use cache'
cacheLife('hours')
```

### Replace API routes with Server Actions:
```typescript
// Before: pages/api/entities.ts
export async function POST(req: Request) {
  const data = await req.json()
  // ... mutation logic
}

// After: app/actions/entities.ts
'use server'
export async function createEntity(formData: FormData) {
  // ... mutation logic
}
```

## Testing Strategy

```typescript
// __tests__/entities.test.ts
import { createEntity, getEntities } from '@/app/actions/entities'
import { render, screen } from '@testing-library/react'

describe('Entity Module', () => {
  it('should create entity with server action', async () => {
    const formData = new FormData()
    formData.append('name', 'Test Entity')
    
    await createEntity(formData)
    
    const entities = await getEntities()
    expect(entities.data).toContainEqual(
      expect.objectContaining({ name: 'Test Entity' })
    )
  })
})
```

## Complete Module File Structure

```
app/
├── (routes)/
│   └── entities/
│       ├── page.tsx                    # List view with streaming
│       ├── new/
│       │   └── page.tsx                # Create form
│       ├── [id]/
│       │   ├── page.tsx                # Detail view
│       │   └── edit/
│       │       └── page.tsx            # Edit form
│       └── _components/
│           ├── entity-list.tsx         # List component
│           ├── entity-form.tsx         # Form component
│           ├── entity-filters.tsx      # Filter controls
│           └── entity-list-skeleton.tsx # Loading state
├── actions/
│   └── entities.ts                     # Server Actions
└── lib/
    └── data/
        └── entities.ts                  # Cached data fetching
```

This architecture leverages Next.js 16's strengths:
- Dynamic by default with opt-in caching
- Server Actions for mutations
- Fine-grained cache control
- Streaming for optimal UX
- Progressive enhancement
