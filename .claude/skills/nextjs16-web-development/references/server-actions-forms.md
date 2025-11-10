---

# Next.js 16 Server Actions & Forms

Complete guide to building forms and mutations with Next.js 16 Server Actions - no API routes needed.

## Server Actions Overview

Server Actions are async functions that run on the server and can be called from client or server components:
- Replace traditional API routes for mutations
- Built-in CSRF protection
- Progressive enhancement (works without JavaScript)
- Direct database access
- Automatic form integration

## Basic Server Action Setup

### 1. Define Server Actions

```typescript
// app/actions/users.ts
'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { updateTag } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// Input validation schema
const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.enum(['admin', 'user', 'guest']),
  age: z.coerce.number().min(18).max(120),
})

export async function createUser(formData: FormData) {
  // Parse and validate input
  const validatedFields = CreateUserSchema.safeParse({
    email: formData.get('email'),
    name: formData.get('name'),
    role: formData.get('role'),
    age: formData.get('age'),
  })
  
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Invalid fields. Failed to create user.',
    }
  }
  
  const supabase = await createServerSupabaseClient()
  
  try {
    const { data, error } = await supabase
      .from('users')
      .insert([validatedFields.data])
      .select()
      .single()
    
    if (error) throw error
    
    // Invalidate cache
    updateTag('users')
    
    // Redirect on success
    redirect(`/users/${data.id}`)
  } catch (error) {
    return {
      message: 'Database error: Failed to create user.',
    }
  }
}
```

### 2. Use in Forms

```tsx
// app/users/new/page.tsx
import { createUser } from '@/app/actions/users'

export default function NewUserPage() {
  return (
    <form action={createUser}>
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
      />
      <input
        name="name"
        type="text"
        placeholder="Name"
        required
      />
      <select name="role" required>
        <option value="user">User</option>
        <option value="admin">Admin</option>
        <option value="guest">Guest</option>
      </select>
      <input
        name="age"
        type="number"
        placeholder="Age"
        min="18"
        max="120"
        required
      />
      <button type="submit">Create User</button>
    </form>
  )
}
```

## Advanced Form Patterns

### Pattern 1: Form with Error Handling

```tsx
// app/actions/form-with-errors.ts
'use server'

export type FormState = {
  errors?: {
    email?: string[]
    name?: string[]
    general?: string
  }
  message?: string
  success?: boolean
}

export async function submitForm(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const schema = z.object({
    email: z.string().email('Invalid email address'),
    name: z.string().min(2, 'Name must be at least 2 characters'),
  })
  
  const validatedFields = schema.safeParse({
    email: formData.get('email'),
    name: formData.get('name'),
  })
  
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Please fix the errors below.',
    }
  }
  
  try {
    // Perform mutation
    await saveToDatabase(validatedFields.data)
    
    return {
      success: true,
      message: 'Form submitted successfully!',
    }
  } catch (error) {
    return {
      errors: {
        general: 'Something went wrong. Please try again.',
      },
      message: 'Failed to submit form.',
    }
  }
}
```

```tsx
// app/components/error-form.tsx
'use client'

import { useActionState } from 'react'
import { submitForm } from '@/app/actions/form-with-errors'

export function ErrorForm() {
  const [state, action, pending] = useActionState(submitForm, {})
  
  return (
    <form action={action}>
      {state.errors?.general && (
        <div className="error">{state.errors.general}</div>
      )}
      
      <div>
        <input
          name="email"
          type="email"
          placeholder="Email"
          aria-invalid={!!state.errors?.email}
          aria-describedby="email-error"
        />
        {state.errors?.email && (
          <p id="email-error" className="error">
            {state.errors.email[0]}
          </p>
        )}
      </div>
      
      <div>
        <input
          name="name"
          type="text"
          placeholder="Name"
          aria-invalid={!!state.errors?.name}
          aria-describedby="name-error"
        />
        {state.errors?.name && (
          <p id="name-error" className="error">
            {state.errors.name[0]}
          </p>
        )}
      </div>
      
      <button type="submit" disabled={pending}>
        {pending ? 'Submitting...' : 'Submit'}
      </button>
      
      {state.success && (
        <p className="success">{state.message}</p>
      )}
    </form>
  )
}
```

### Pattern 2: Multi-Step Form

```tsx
// app/actions/multi-step.ts
'use server'

import { cookies } from 'next/headers'

export async function saveStep1(formData: FormData) {
  const data = {
    email: formData.get('email'),
    name: formData.get('name'),
  }
  
  // Store in session/cookie
  const cookieStore = await cookies()
  cookieStore.set('form-step1', JSON.stringify(data), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 3600, // 1 hour
  })
  
  redirect('/form/step2')
}

export async function saveStep2(formData: FormData) {
  const cookieStore = await cookies()
  const step1Data = JSON.parse(cookieStore.get('form-step1')?.value || '{}')
  
  const fullData = {
    ...step1Data,
    address: formData.get('address'),
    phone: formData.get('phone'),
  }
  
  // Save to database
  await saveToDatabase(fullData)
  
  // Clear cookie
  cookieStore.delete('form-step1')
  
  redirect('/form/complete')
}
```

### Pattern 3: Optimistic Updates

```tsx
// app/components/optimistic-list.tsx
'use client'

import { useOptimistic, startTransition } from 'react'
import { deleteItem, toggleItem } from '@/app/actions/items'

type Item = {
  id: string
  title: string
  completed: boolean
}

export function OptimisticList({ items }: { items: Item[] }) {
  const [optimisticItems, updateOptimisticItems] = useOptimistic(
    items,
    (state: Item[], update: { type: string; id: string; value?: any }) => {
      switch (update.type) {
        case 'delete':
          return state.filter(item => item.id !== update.id)
        case 'toggle':
          return state.map(item =>
            item.id === update.id
              ? { ...item, completed: !item.completed }
              : item
          )
        default:
          return state
      }
    }
  )
  
  async function handleDelete(id: string) {
    startTransition(() => {
      updateOptimisticItems({ type: 'delete', id })
    })
    await deleteItem(id)
  }
  
  async function handleToggle(id: string) {
    startTransition(() => {
      updateOptimisticItems({ type: 'toggle', id })
    })
    await toggleItem(id)
  }
  
  return (
    <ul>
      {optimisticItems.map(item => (
        <li key={item.id}>
          <input
            type="checkbox"
            checked={item.completed}
            onChange={() => handleToggle(item.id)}
          />
          <span>{item.title}</span>
          <button onClick={() => handleDelete(item.id)}>
            Delete
          </button>
        </li>
      ))}
    </ul>
  )
}
```

### Pattern 4: File Upload

```typescript
// app/actions/upload.ts
'use server'

import { writeFile } from 'fs/promises'
import { join } from 'path'

export async function uploadFile(formData: FormData) {
  const file = formData.get('file') as File
  
  if (!file || file.size === 0) {
    return { error: 'No file provided' }
  }
  
  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    return { error: 'Invalid file type' }
  }
  
  // Validate file size (5MB limit)
  if (file.size > 5 * 1024 * 1024) {
    return { error: 'File too large' }
  }
  
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  
  // Save to public directory
  const filename = `${Date.now()}-${file.name}`
  const path = join(process.cwd(), 'public/uploads', filename)
  
  try {
    await writeFile(path, buffer)
    return { 
      success: true, 
      url: `/uploads/${filename}` 
    }
  } catch (error) {
    return { error: 'Failed to save file' }
  }
}
```

```tsx
// app/components/file-upload.tsx
'use client'

import { useState } from 'react'
import { uploadFile } from '@/app/actions/upload'

export function FileUpload() {
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  
  async function handleSubmit(formData: FormData) {
    setUploading(true)
    const result = await uploadFile(formData)
    setUploading(false)
    
    if (result.success) {
      setPreview(result.url!)
    } else {
      alert(result.error)
    }
  }
  
  return (
    <form action={handleSubmit}>
      <input
        name="file"
        type="file"
        accept="image/*"
        required
      />
      <button type="submit" disabled={uploading}>
        {uploading ? 'Uploading...' : 'Upload'}
      </button>
      
      {preview && (
        <img src={preview} alt="Preview" width={200} />
      )}
    </form>
  )
}
```

## Form Validation Patterns

### Zod Integration

```typescript
// lib/validations/user.ts
import { z } from 'zod'

export const UserSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .min(5, 'Email too short'),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name too long')
    .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters'),
  age: z
    .coerce
    .number()
    .int('Age must be a whole number')
    .min(18, 'Must be at least 18')
    .max(120, 'Invalid age'),
  bio: z
    .string()
    .max(500, 'Bio too long')
    .optional(),
  website: z
    .string()
    .url('Invalid URL')
    .optional()
    .or(z.literal('')),
  preferences: z.object({
    newsletter: z.boolean().default(false),
    notifications: z.boolean().default(true),
  }),
})

export type UserFormData = z.infer<typeof UserSchema>
```

### Custom Validation

```typescript
// app/actions/custom-validation.ts
'use server'

async function validateUsername(username: string): Promise<string | null> {
  // Check if username exists
  const exists = await checkUsernameExists(username)
  if (exists) {
    return 'Username already taken'
  }
  
  // Check for profanity
  if (containsProfanity(username)) {
    return 'Username contains inappropriate content'
  }
  
  return null
}

export async function createAccount(formData: FormData) {
  const username = formData.get('username') as string
  
  // Custom validation
  const usernameError = await validateUsername(username)
  if (usernameError) {
    return { errors: { username: usernameError } }
  }
  
  // Continue with creation...
}
```

## Loading States & Transitions

### Using useFormStatus

```tsx
// app/components/submit-button.tsx
'use client'

import { useFormStatus } from 'react-dom'

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus()
  
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
    >
      {pending ? (
        <>
          <Spinner />
          Processing...
        </>
      ) : (
        children
      )}
    </button>
  )
}
```

### Using useTransition

```tsx
'use client'

import { useTransition } from 'react'
import { updateProfile } from '@/app/actions/profile'

export function ProfileForm({ user }: { user: User }) {
  const [isPending, startTransition] = useTransition()
  
  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await updateProfile(formData)
    })
  }
  
  return (
    <form action={handleSubmit}>
      <fieldset disabled={isPending}>
        <input name="name" defaultValue={user.name} />
        <input name="email" defaultValue={user.email} />
        <button type="submit">
          {isPending ? 'Saving...' : 'Save'}
        </button>
      </fieldset>
    </form>
  )
}
```

## Security Best Practices

### 1. Authentication & Authorization

```typescript
'use server'

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export async function adminAction(formData: FormData) {
  // Verify authentication
  const session = await auth()
  if (!session) {
    redirect('/login')
  }
  
  // Verify authorization
  if (session.user.role !== 'admin') {
    throw new Error('Unauthorized')
  }
  
  // Proceed with action...
}
```

### 2. Rate Limiting

```typescript
'use server'

import { rateLimit } from '@/lib/rate-limit'

const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500, // Max 500 unique tokens
})

export async function rateLimitedAction(formData: FormData) {
  // Get user IP or session ID
  const identifier = await getUserIdentifier()
  
  try {
    await limiter.check(5, identifier) // Max 5 requests per minute
  } catch {
    return { error: 'Too many requests. Please try again later.' }
  }
  
  // Proceed with action...
}
```

### 3. Input Sanitization

```typescript
'use server'

import DOMPurify from 'isomorphic-dompurify'

export async function saveContent(formData: FormData) {
  const rawContent = formData.get('content') as string
  
  // Sanitize HTML content
  const cleanContent = DOMPurify.sanitize(rawContent, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href'],
  })
  
  // Save sanitized content
  await saveToDatabase({ content: cleanContent })
}
```

## Advanced Patterns

### Debounced Actions

```tsx
'use client'

import { useDebouncedCallback } from 'use-debounce'
import { searchUsers } from '@/app/actions/search'

export function SearchForm() {
  const [results, setResults] = useState([])
  
  const handleSearch = useDebouncedCallback(async (term: string) => {
    const data = await searchUsers(term)
    setResults(data)
  }, 300)
  
  return (
    <input
      type="search"
      onChange={(e) => handleSearch(e.target.value)}
      placeholder="Search users..."
    />
  )
}
```

### Polling with Server Actions

```tsx
'use client'

import { useEffect } from 'react'
import { getLatestData } from '@/app/actions/data'

export function PollingComponent() {
  const [data, setData] = useState(null)
  
  useEffect(() => {
    const interval = setInterval(async () => {
      const latest = await getLatestData()
      setData(latest)
    }, 5000) // Poll every 5 seconds
    
    return () => clearInterval(interval)
  }, [])
  
  return <div>{data}</div>
}
```

### Conditional Actions

```typescript
'use server'

export async function conditionalAction(
  formData: FormData,
  context: { isAdmin: boolean }
) {
  const action = formData.get('action')
  
  switch (action) {
    case 'save':
      return await saveData(formData)
    case 'publish':
      if (!context.isAdmin) {
        throw new Error('Only admins can publish')
      }
      return await publishData(formData)
    case 'delete':
      if (!context.isAdmin) {
        throw new Error('Only admins can delete')
      }
      return await deleteData(formData)
    default:
      throw new Error('Unknown action')
  }
}
```

## Testing Server Actions

```typescript
// __tests__/actions/users.test.ts
import { createUser } from '@/app/actions/users'

describe('User Actions', () => {
  it('should create user with valid data', async () => {
    const formData = new FormData()
    formData.append('email', 'test@example.com')
    formData.append('name', 'Test User')
    formData.append('role', 'user')
    
    const result = await createUser(formData)
    expect(result.success).toBe(true)
  })
  
  it('should return errors for invalid data', async () => {
    const formData = new FormData()
    formData.append('email', 'invalid-email')
    
    const result = await createUser(formData)
    expect(result.errors?.email).toBeDefined()
  })
})
```

## Common Patterns

### CRUD Operations

```typescript
'use server'

// CREATE
export async function create(formData: FormData) {
  const data = Object.fromEntries(formData)
  const result = await db.insert(data)
  updateTag('items')
  redirect(`/items/${result.id}`)
}

// READ (usually in Server Components with caching)
export async function getItem(id: string) {
  'use cache'
  cacheTag(`item-${id}`)
  return await db.findById(id)
}

// UPDATE
export async function update(id: string, formData: FormData) {
  const data = Object.fromEntries(formData)
  await db.update(id, data)
  updateTag(`item-${id}`)
  redirect(`/items/${id}`)
}

// DELETE
export async function remove(id: string) {
  await db.delete(id)
  updateTag('items')
  redirect('/items')
}
```

## Best Practices

### DO:
- ✅ Validate all inputs on the server
- ✅ Use TypeScript for type safety
- ✅ Handle errors gracefully
- ✅ Provide loading states
- ✅ Use optimistic updates for better UX
- ✅ Implement proper authorization checks

### DON'T:
- ❌ Trust client-side validation alone
- ❌ Expose sensitive data in error messages
- ❌ Forget CSRF protection (handled automatically)
- ❌ Use GET requests for mutations
- ❌ Store sensitive data in FormData
