# Supabase Debugging Guide

## Quick Reference

### Testing Database Connectivity

```typescript
// Test basic connection
const { data, error } = await supabase
  .from('profiles')
  .select('count')
  .limit(1);

console.log('Connected:', !error);
```

### RLS Policy Debugging

```sql
-- Check all policies for a table
SELECT * FROM pg_policies WHERE tablename = 'your_table';

-- Test as specific user (in Supabase SQL Editor)
BEGIN;
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'user-uuid-here';

SELECT * FROM your_table WHERE institution_id = 'institution-uuid';

ROLLBACK;
```

### Query Performance Analysis

```typescript
// Enable query explain
const { data, error } = await supabase
  .from('table')
  .select('*')
  .explain({ analyze: true, verbose: true });

console.log('Query plan:', data);
```

### Common RLS Patterns

```sql
-- Basic user access
CREATE POLICY "Users can read own data"
ON table FOR SELECT
USING (auth.uid() = user_id);

-- Institution-based access
CREATE POLICY "Institution members can read"
ON table FOR SELECT
USING (
  institution_id IN (
    SELECT institution_id
    FROM user_institution_access
    WHERE user_id = auth.uid()
  )
);

-- Role-based access
CREATE POLICY "Admins can do anything"
ON table FOR ALL
USING (
  auth.jwt() ->> 'role' IN ('super_admin', 'administrator')
);
```

### Testing Auth State

```typescript
// Check current session
const { data: { session } } = await supabase.auth.getSession();
console.log('Session:', session);

// Check current user
const { data: { user } } = await supabase.auth.getUser();
console.log('User:', user);

// Verify JWT claims
console.log('JWT claims:', user?.user_metadata);
```

### Debugging Service Role Queries

```typescript
// Create service role client (server-side only!)
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Secret! Never expose
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Test query bypassing RLS
const { data } = await supabaseAdmin
  .from('table')
  .select('*');

console.log('Data exists (RLS bypassed):', data?.length);
```

### Connection Timeout Handling

```typescript
// lib/supabase/client-with-timeout.ts already exists
import { createClientWithTimeout } from '@/lib/supabase/client-with-timeout';

const supabase = createClientWithTimeout(5000); // 5 second timeout
```

### Realtime Subscription Debugging

```typescript
const channel = supabase
  .channel('table-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'table'
  }, (payload) => {
    console.log('Change received:', payload);
  })
  .subscribe((status) => {
    console.log('Subscription status:', status);
  });

// Cleanup
channel.unsubscribe();
```

### Storage Debugging

```typescript
// Test file upload
const file = new File(['test'], 'test.txt');
const { data, error } = await supabase.storage
  .from('bucket')
  .upload('path/test.txt', file);

console.log('Upload result:', { data, error });

// Check bucket permissions
const { data: buckets } = await supabase.storage.listBuckets();
console.log('Available buckets:', buckets);

// Get public URL
const { data: publicUrl } = supabase.storage
  .from('bucket')
  .getPublicUrl('path/file.txt');

console.log('Public URL:', publicUrl);
```

---

**Version**: 1.0.0
