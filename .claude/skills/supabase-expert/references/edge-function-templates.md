# Edge Function Templates Reference

Complete templates for Supabase Edge Functions with Deno runtime.

## Core Principles

### ✅ ALWAYS USE:
1. **Web APIs and Deno Core APIs**
   - `fetch` instead of Axios
   - WebSockets API instead of node-ws
   - `Deno.serve` instead of std@http/server

2. **Proper Import Specifiers**
   ```typescript
   // ✅ CORRECT
   import express from "npm:express@4.18.2"
   import { createClient } from "npm:@supabase/supabase-js@2"
   import process from "node:process"

   // ❌ WRONG
   import express from "express"  // No bare specifiers!
   ```

3. **Shared Utilities**
   - Place in `supabase/functions/_shared/`
   - Import with relative paths
   - NO cross-dependencies between functions

4. **Pre-populated Environment Variables**
   ```typescript
   // These are automatically available:
   Deno.env.get('SUPABASE_URL')
   Deno.env.get('SUPABASE_ANON_KEY')
   Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
   Deno.env.get('SUPABASE_DB_URL')
   ```

### ❌ NEVER USE:
- Bare specifiers without npm:/jsr:/node: prefix
- Imports without version numbers
- Cross-dependencies between Edge Functions
- File writes outside `/tmp` directory
- Old `serve` from deno.land/std

## Template 1: Basic Function Structure

**Use when:** Simple API endpoint with CORS support

**File:** `supabase/functions/hello-world/index.ts`

```typescript
interface RequestPayload {
  name?: string
  message?: string
}

console.info('Function hello-world started')

Deno.serve(async (req: Request) => {
  // CORS headers for browser requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }

  try {
    const payload: RequestPayload = await req.json()

    // Your logic here
    const result = {
      message: `Hello, ${payload.name || 'World'}!`,
      timestamp: new Date().toISOString(),
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})
```

## Template 2: Function with Supabase Client

**Use when:** Need to query/modify Supabase database

**File:** `supabase/functions/get-students/index.ts`

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'

interface RequestPayload {
  institution_id: string
  status?: string
}

console.info('Function get-students started')

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }

  try {
    // Get auth header
    const authHeader = req.headers.get('Authorization')

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401 }
      )
    }

    // Create Supabase client with user's auth
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    )

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      )
    }

    // Parse request
    const payload: RequestPayload = await req.json()

    // Query database
    let query = supabase
      .from('students')
      .select('*')
      .eq('institution_id', payload.institution_id)

    if (payload.status) {
      query = query.eq('status', payload.status)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})
```

## Template 3: Function with Service Role (Admin)

**Use when:** Need elevated permissions (bypass RLS)

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  try {
    // Verify admin user first
    const authHeader = req.headers.get('Authorization')
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: { Authorization: authHeader! }
        }
      }
    )

    const { data: { user }, error } = await supabaseUser.auth.getUser()

    if (error || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      )
    }

    // Check if user is admin
    if (user.user_metadata?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403 }
      )
    }

    // Create admin client (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Perform admin operation
    const { data, error: adminError } = await supabaseAdmin
      .from('students')
      .select('*')  // Access all data, bypassing RLS

    if (adminError) {
      throw adminError
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
})
```

## Template 4: Function with Express (Multiple Routes)

**Use when:** Need multiple endpoints in one function

**File:** `supabase/functions/api-handler/index.ts`

```typescript
import express from "npm:express@4.18.2"
import { Application } from "npm:express@4.18.2"

const app: Application = express()
app.use(express.json())

// IMPORTANT: Routes must be prefixed with function name
const FUNCTION_NAME = 'api-handler'

app.get(`/${FUNCTION_NAME}/health`, (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() })
})

app.get(`/${FUNCTION_NAME}/students`, async (req, res) => {
  try {
    // Your logic here
    res.json({ success: true, data: [] })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post(`/${FUNCTION_NAME}/students`, async (req, res) => {
  try {
    const { name, email } = req.body

    // Validation
    if (!name || !email) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Your logic here
    res.status(201).json({ success: true, data: { name, email } })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.put(`/${FUNCTION_NAME}/students/:id`, async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    // Your logic here
    res.json({ success: true, data: { id, ...updates } })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.delete(`/${FUNCTION_NAME}/students/:id`, async (req, res) => {
  try {
    const { id } = req.params

    // Your logic here
    res.json({ success: true, message: 'Deleted' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.listen(8000)
console.info('Express server listening on port 8000')
```

## Template 5: Function with Background Tasks

**Use when:** Need to respond immediately but process in background

```typescript
Deno.serve(async (req: Request) => {
  try {
    const { task, data } = await req.json()

    // Validate request
    if (!task) {
      return new Response(
        JSON.stringify({ error: 'Missing task parameter' }),
        { status: 400 }
      )
    }

    // Respond immediately
    const response = new Response(
      JSON.stringify({
        message: 'Task queued',
        task_id: crypto.randomUUID(),
      }),
      { status: 202 }
    )

    // Run long task in background
    EdgeRuntime.waitUntil(
      performLongRunningTask(task, data)
        .then(result => {
          console.log('Task completed:', result)
        })
        .catch(error => {
          console.error('Task failed:', error)
        })
    )

    return response
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
})

async function performLongRunningTask(task: string, data: any) {
  // Simulate long operation
  await new Promise(resolve => setTimeout(resolve, 5000))

  // Your actual long-running logic here
  console.log('Processing task:', task)

  return { completed: true, task, data }
}
```

## Template 6: Function with File Operations

**Use when:** Need to create/read temporary files

```typescript
import { writeFile, readFile } from "node:fs/promises"
import { join } from "node:path"

Deno.serve(async (req: Request) => {
  try {
    const { content, filename } = await req.json()

    if (!filename || !content) {
      return new Response(
        JSON.stringify({ error: 'Missing filename or content' }),
        { status: 400 }
      )
    }

    // ONLY /tmp is writable
    const filepath = join('/tmp', filename)

    // Write file
    await writeFile(filepath, content, 'utf-8')

    // Read file back
    const data = await readFile(filepath, 'utf-8')

    return new Response(
      JSON.stringify({
        success: true,
        saved: true,
        content: data,
        path: filepath,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
})
```

## Template 7: Function with External API Call

**Use when:** Need to call external services

```typescript
interface WeatherResponse {
  temperature: number
  condition: string
  location: string
}

Deno.serve(async (req: Request) => {
  try {
    const { city } = await req.json()

    if (!city) {
      return new Response(
        JSON.stringify({ error: 'Missing city parameter' }),
        { status: 400 }
      )
    }

    // Call external API
    const apiKey = Deno.env.get('WEATHER_API_KEY')
    const response = await fetch(
      `https://api.weather.com/v1/current?city=${city}&key=${apiKey}`
    )

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.statusText}`)
    }

    const weatherData: WeatherResponse = await response.json()

    return new Response(
      JSON.stringify({ success: true, data: weatherData }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error fetching weather:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
})
```

## Template 8: Function with AI Embeddings

**Use when:** Need to generate embeddings for vector search

```typescript
const model = new Supabase.ai.Session('gte-small')

Deno.serve(async (req: Request) => {
  try {
    const { text } = await req.json()

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Missing text parameter' }),
        { status: 400 }
      )
    }

    // Generate embeddings
    const embeddings = await model.run(text, {
      mean_pool: true,
      normalize: true
    })

    // Store in database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data, error } = await supabase
      .from('documents')
      .insert({
        content: text,
        embedding: embeddings
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({
        success: true,
        data,
        embedding_length: embeddings.length
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
})
```

## Template 9: Scheduled Function (Cron)

**Use when:** Need to run function on schedule

**File:** `supabase/functions/daily-report/index.ts`

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  try {
    // Verify this is a scheduled invocation
    const authHeader = req.headers.get('Authorization')
    const cronSecret = Deno.env.get('CRON_SECRET')

    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      )
    }

    console.log('Running daily report...')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Generate report
    const { data, error } = await supabase
      .rpc('generate_daily_report')

    if (error) {
      throw error
    }

    console.log('Report generated:', data)

    return new Response(
      JSON.stringify({ success: true, report: data }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Cron job error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
})
```

## Shared Utilities Pattern

**File:** `supabase/functions/_shared/auth.ts`

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'

export async function verifyUser(authHeader: string | null) {
  if (!authHeader) {
    throw new Error('Missing authorization header')
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: {
        headers: { Authorization: authHeader }
      }
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('Unauthorized')
  }

  return { user, supabase }
}

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}
```

**Usage in function:**

```typescript
import { verifyUser, corsHeaders } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const { user, supabase } = await verifyUser(authHeader)

    // Your logic here

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 401 }
    )
  }
})
```

## Deployment Commands

```bash
# Deploy single function
supabase functions deploy function-name

# Deploy all functions
supabase functions deploy

# Set secrets
supabase secrets set --env-file ./supabase/.env.local

# Test locally
supabase functions serve function-name --env-file ./supabase/.env.local

# Invoke function locally
curl -i --location --request POST \
  'http://localhost:54321/functions/v1/function-name' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"key":"value"}'
```

## Edge Functions Checklist

- [ ] Using Deno.serve (not old serve import)
- [ ] All imports have npm:/jsr:/node: prefix
- [ ] All npm packages have version numbers
- [ ] Shared code in _shared folder
- [ ] No cross-function dependencies
- [ ] File operations only in /tmp
- [ ] CORS headers for browser requests
- [ ] Error handling with try-catch
- [ ] Using EdgeRuntime.waitUntil for background tasks
- [ ] Proper authentication checks
- [ ] Environment variables loaded correctly

## Troubleshooting

### Import Errors

```typescript
// ❌ WRONG
import { createClient } from '@supabase/supabase-js'

// ✅ CORRECT
import { createClient } from 'npm:@supabase/supabase-js@2'
```

### CORS Errors

```typescript
// Always include CORS headers
return new Response(data, {
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  }
})
```

### File Write Errors

```typescript
// ❌ WRONG - Not allowed
await writeFile('/home/file.txt', content)

// ✅ CORRECT - Only /tmp is writable
await writeFile('/tmp/file.txt', content)
```
