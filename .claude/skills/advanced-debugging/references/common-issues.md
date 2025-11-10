# Common Issues and Solutions

## Table of Contents
1. [Authentication Issues](#authentication-issues)
2. [Database/Supabase Issues](#databasesupabase-issues)
3. [React Query Issues](#react-query-issues)
4. [TypeScript Issues](#typescript-issues)
5. [Build/Deploy Issues](#builddeploy-issues)
6. [Performance Issues](#performance-issues)
7. [UI/Component Issues](#uicomponent-issues)
8. [Service Layer Issues](#service-layer-issues)

---

## Authentication Issues

### Issue: Middleware Redirect Loop

**Symptoms:**
- Page keeps redirecting endlessly
- Browser shows "too many redirects" error
- Cannot access any page

**Causes:**
- Public path not configured correctly
- User session invalid but not caught
- Profile cache stale
- Middleware logic error

**Solution:**
```typescript
// 1. Check if path should be public
const PUBLIC_PATHS_SET = new Set([
  '/',
  '/auth/login',
  '/auth/callback',
  // Add your path here if it should be public
]);

// 2. Clear profile cache
import { profileCache } from '@/lib/auth/profile-cache';
profileCache.invalidate(userId);

// 3. Check middleware logs
// Add console.log in middleware to see execution flow

// 4. Verify user session
const { data: { user } } = await supabase.auth.getUser();
console.log('Session valid:', !!user);
```

**Prevention:**
- Always test auth flows after middleware changes
- Add paths to public set when adding new public routes
- Clear profile cache on auth errors

### Issue: Session Expires Unexpectedly

**Symptoms:**
- User gets logged out randomly
- "Session expired" errors
- Have to login frequently

**Causes:**
- Token expiry too short
- Cookies not persisting
- Browser clearing cookies
- Server time mismatch

**Solution:**
```typescript
// 1. Check token expiry in Supabase dashboard
// Auth > Settings > JWT expiry (default: 3600 seconds)

// 2. Verify cookies are set
console.log('Cookies:', document.cookie);

// 3. Check cookie settings
// Ensure SameSite=Lax or None for cross-origin

// 4. Refresh session before expiry
const { data, error } = await supabase.auth.refreshSession();
```

**Prevention:**
- Set appropriate JWT expiry in Supabase
- Implement auto-refresh before expiry
- Use SameSite=Lax for cookies

### Issue: RLS Policy Denying Access

**Symptoms:**
- Query returns empty array despite data existing
- "permission denied" errors
- Works with service role, fails with user token

**Causes:**
- User doesn't meet policy conditions
- Policy uses wrong user attribute
- Institution ID mismatch
- Custom role permissions not set

**Solution:**
```typescript
// 1. Check user context
const { data: { user } } = await supabase.auth.getUser();
console.log('User:', user);

// 2. Check profile
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', user.id)
  .single();
console.log('Profile:', profile);

// 3. Test query with service role (temporarily)
const { data } = await supabaseAdmin
  .from('table')
  .select('*');
console.log('Data exists:', data?.length);

// 4. Check policy in Supabase dashboard
// SQL Editor > Run: SELECT * FROM pg_policies WHERE tablename = 'table_name';

// 5. Fix common policy issues:
// - Add institution_id check: AND institution_id = auth.jwt() ->> 'institution_id'
// - Add role check: AND auth.jwt() ->> 'role' IN ('admin', 'faculty')
// - Add user ID check: AND created_by = auth.uid()
```

**Prevention:**
- Always test RLS policies with actual user tokens
- Document RLS policies in SQL comments
- Use consistent institution_id filtering

---

## Database/Supabase Issues

### Issue: Query Timeout

**Symptoms:**
- Request takes > 30 seconds
- "timeout" or "connection reset" errors
- Browser shows pending request

**Causes:**
- Missing indexes on filter columns
- N+1 query pattern
- Fetching too much data at once
- Complex joins without optimization

**Solution:**
```typescript
// 1. Use optimized service variant
import { BillingInvoiceServiceOptimized } from '@/lib/services/billing/invoices/billing-invoice-service-optimized';

// 2. Add pagination
const { data } = await supabase
  .from('table')
  .select('*')
  .range(0, 49) // Fetch 50 at a time
  .order('created_at', { ascending: false });

// 3. Limit selected columns
const { data } = await supabase
  .from('table')
  .select('id, name, created_at') // Only needed columns
  .limit(100);

// 4. Add index in Supabase SQL Editor
CREATE INDEX idx_table_institution_id ON table(institution_id);
CREATE INDEX idx_table_created_at ON table(created_at);

// 5. Use client with timeout
import { createClientWithTimeout } from '@/lib/supabase/client-with-timeout';
const supabase = createClientWithTimeout(10000); // 10 second timeout
```

**Prevention:**
- Always use pagination for lists
- Add indexes on frequently filtered columns
- Use optimized services for large datasets
- Limit select to needed columns only

### Issue: Foreign Key Constraint Violation

**Symptoms:**
- "violates foreign key constraint" error
- Cannot insert/update record
- Error mentions specific constraint name

**Causes:**
- Referenced record doesn't exist
- ID is null or undefined
- ID format incorrect (UUID vs integer)
- Cascading delete not configured

**Solution:**
```typescript
// 1. Verify referenced record exists
const { data: student } = await supabase
  .from('students')
  .select('id')
  .eq('id', studentId)
  .single();

if (!student) {
  throw new Error('Student not found');
}

// 2. Check ID format
console.log('Student ID:', studentId, typeof studentId);
// Should be: string (UUID format)

// 3. Add null check
if (!studentId || !institutionId) {
  throw new Error('Required IDs missing');
}

// 4. Validate UUID format
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuidRegex.test(studentId)) {
  throw new Error('Invalid UUID format');
}
```

**Prevention:**
- Always validate IDs before insert/update
- Use TypeScript types to ensure correct ID format
- Add existence checks for referenced records
- Handle cascading deletes appropriately

### Issue: Duplicate Key Error

**Symptoms:**
- "duplicate key value violates unique constraint"
- Error on insert
- Constraint name in error message

**Causes:**
- Record with same unique field already exists
- Not checking for existing record before insert
- Trying to insert same data twice
- Race condition on concurrent inserts

**Solution:**
```typescript
// 1. Check if record exists first
const { data: existing } = await supabase
  .from('table')
  .select('id')
  .eq('unique_field', value)
  .single();

if (existing) {
  // Update instead of insert
  return await supabase
    .from('table')
    .update(data)
    .eq('id', existing.id);
}

// 2. Use upsert for idempotency
const { data, error } = await supabase
  .from('table')
  .upsert(
    { id: recordId, ...data },
    { onConflict: 'id' }
  );

// 3. Handle unique constraint properly
try {
  const { data, error } = await supabase
    .from('table')
    .insert(data);

  if (error?.code === '23505') { // Duplicate key error code
    console.log('Record already exists');
    // Handle appropriately
  }
} catch (error) {
  // Handle error
}
```

**Prevention:**
- Check for existing records before insert
- Use upsert when appropriate
- Handle concurrent inserts with proper error handling
- Add unique constraints at database level

---

## React Query Issues

### Issue: Stale Data Not Refetching

**Symptoms:**
- Data doesn't update after mutation
- Old data still showing
- Manual refresh required

**Causes:**
- Query not invalidated after mutation
- staleTime set too high
- refetchOnWindowFocus disabled
- Wrong query key

**Solution:**
```typescript
// 1. Invalidate query after mutation
const mutation = useMutation({
  mutationFn: updateData,
  onSuccess: () => {
    // Invalidate and refetch
    queryClient.invalidateQueries({ queryKey: ['data'] });
  }
});

// 2. Adjust staleTime
const { data } = useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  staleTime: 0, // Always fetch fresh data
  // or
  staleTime: 1000 * 60 * 5, // 5 minutes
});

// 3. Force refetch
const { data, refetch } = useQuery({ ... });
// Call when needed:
refetch();

// 4. Use correct query key
// Include all dependencies in key
const { data } = useQuery({
  queryKey: ['students', institutionId, programId], // All filters in key
  queryFn: () => fetchStudents(institutionId, programId)
});
```

**Prevention:**
- Always invalidate related queries after mutations
- Set appropriate staleTime based on data volatility
- Include all filter parameters in query key
- Document query key structure

### Issue: Infinite Query Loading

**Symptoms:**
- Loading spinner never stops
- Query in "loading" state forever
- No data returned
- No error shown

**Causes:**
- Query function not returning data
- Query function throws unhandled error
- Promise never resolves
- Network request stuck

**Solution:**
```typescript
// 1. Add proper error handling
const { data, isLoading, isError, error } = useQuery({
  queryKey: ['data'],
  queryFn: async () => {
    try {
      const result = await fetchData();
      return result; // Ensure return
    } catch (error) {
      console.error('Query error:', error);
      throw error; // Re-throw for React Query
    }
  },
  retry: 3,
  retryDelay: 1000
});

// 2. Add timeout
const { data } = useQuery({
  queryKey: ['data'],
  queryFn: () => Promise.race([
    fetchData(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 10000)
    )
  ])
});

// 3. Log query state
console.log('Query state:', {
  isLoading,
  isError,
  error,
  data,
  status: query.status
});

// 4. Check React Query DevTools
// Look for query status and error details
```

**Prevention:**
- Always return data from queryFn
- Add proper error handling and logging
- Implement timeouts for network requests
- Test query functions independently

### Issue: Query Cache Growing Too Large

**Symptoms:**
- High memory usage
- Browser becomes slow
- DevTools shows many cached queries

**Causes:**
- cacheTime set too high
- Too many unique query keys
- Large data sets in cache
- Not garbage collecting old queries

**Solution:**
```typescript
// 1. Set appropriate cacheTime
const { data } = useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  cacheTime: 1000 * 60 * 5, // 5 minutes (default)
  // or shorter for large data
  cacheTime: 1000 * 60, // 1 minute
});

// 2. Remove unused queries
queryClient.removeQueries({ queryKey: ['old-data'] });

// 3. Clear entire cache if needed
queryClient.clear();

// 4. Use pagination for large lists
const { data } = useInfiniteQuery({
  queryKey: ['data'],
  queryFn: ({ pageParam = 0 }) => fetchData(pageParam),
  getNextPageParam: (lastPage) => lastPage.nextPage,
});

// 5. Optimize query keys
// Avoid dynamic keys that create many cache entries
// BAD: ['data', new Date().toString()]
// GOOD: ['data', dateString]
```

**Prevention:**
- Set reasonable cacheTime
- Use stable query keys
- Implement pagination for large datasets
- Periodically clear unused cache

---

## TypeScript Issues

### Issue: Type 'X' is not assignable to type 'Y'

**Symptoms:**
- TypeScript error in IDE
- Build fails with type error
- Red squiggly lines in code

**Causes:**
- Type mismatch between expected and actual
- Missing properties on object
- Null/undefined not handled
- Supabase generated types outdated

**Solution:**
```typescript
// 1. Check the types involved
type Expected = { id: string; name: string; };
type Actual = { id: string; }; // Missing 'name'

// 2. Add missing properties
const data: Expected = {
  id: '123',
  name: 'Test', // Add missing property
};

// 3. Handle null/undefined
const data: Expected | null = getdata();
if (!data) {
  return; // Handle null case
}
// Now data is Expected type

// 4. Update Supabase types
// Run: npx supabase gen types typescript --project-id your-project-id > types/supabase.ts

// 5. Use type assertion (carefully)
const data = response as Expected;

// 6. Use type guard
function isExpected(data: any): data is Expected {
  return data && typeof data.id === 'string' && typeof data.name === 'string';
}

if (isExpected(data)) {
  // data is Expected type here
}
```

**Prevention:**
- Keep Supabase types up to date
- Use strict TypeScript config
- Add proper types to all functions
- Use type guards for runtime checks

### Issue: Property does not exist on type 'never'

**Symptoms:**
- Cannot access property on variable
- Type is inferred as 'never'
- TypeScript shows error

**Causes:**
- Empty array typed as never[]
- Union type narrowed incorrectly
- Type guard failed
- Conditional type resolved to never

**Solution:**
```typescript
// 1. Provide explicit type for empty array
const items: Item[] = []; // Instead of const items = [];

// 2. Use type assertion
const data = response as Item[];

// 3. Add type guard
if (Array.isArray(data) && data.length > 0) {
  data[0].property; // Now accessible
}

// 4. Initialize with proper type
const [items, setItems] = useState<Item[]>([]);

// 5. Check for never type
// Hover over variable to see if it's never
// Fix the type inference issue
```

**Prevention:**
- Always provide types for empty arrays/objects
- Use explicit type annotations
- Check type inference in IDE
- Use type guards for unions

---

## Build/Deploy Issues

### Issue: Windows EPERM Error During Build

**Symptoms:**
- Build fails with EPERM error
- "operation not permitted" message
- Error on Windows machines
- Works on Mac/Linux

**Causes:**
- File system locking on Windows
- Antivirus scanning build files
- Node worker threads issue

**Solution (Already Applied):**
```typescript
// next.config.ts
const nextConfig: NextConfig = {
  experimental: {
    workerThreads: false, // Disable worker threads
    cpus: 1 // Use single CPU
  },
};
```

**Alternative Solutions:**
```bash
# 1. Clean build
npm run clean:all
npm install
npm run build

# 2. Exclude .next from antivirus
# Add .next/ to antivirus exclusion list

# 3. Close file watchers
# Close VS Code, other IDEs watching files

# 4. Run as administrator (last resort)
```

**Prevention:**
- Keep worker threads disabled on Windows
- Regularly clean build cache
- Exclude build directories from antivirus

### Issue: Module Not Found Error

**Symptoms:**
- "Cannot find module" error
- Import path shows red underline
- Build or dev server fails

**Causes:**
- Incorrect import path
- Missing dependency
- Case sensitivity issue (Windows vs Linux)
- Path alias not configured

**Solution:**
```typescript
// 1. Check import path
import { Component } from '@/components/Component'; // Correct
// vs
import { Component } from './components/component'; // Wrong case

// 2. Install missing dependency
npm install package-name

// 3. Check path aliases in tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}

// 4. Use correct case (case-sensitive on Linux)
// File: Component.tsx
import { Component } from './Component'; // Correct
import { Component } from './component'; // Wrong (fails on Linux)

// 5. Clear module cache
rm -rf node_modules
npm install
```

**Prevention:**
- Use consistent casing for files/imports
- Use @ path alias for project imports
- Test builds on Linux before deploying
- Keep dependencies up to date

### Issue: Out of Memory During Build

**Symptoms:**
- "JavaScript heap out of memory" error
- Build process killed
- System runs out of RAM

**Causes:**
- Large bundle size
- Too many dependencies
- Memory leak in build process
- Insufficient node memory

**Solution:**
```bash
# 1. Increase Node memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run build

# 2. Clear caches
npm run clean:all
rm -rf node_modules/.cache

# 3. Check bundle size
npm run build # Check output size

# 4. Analyze bundle
npm install -D @next/bundle-analyzer

# 5. Use dynamic imports for large components
const LargeComponent = dynamic(() => import('./LargeComponent'));
```

**Prevention:**
- Keep bundle size reasonable (<500KB)
- Use dynamic imports for large components
- Regularly audit dependencies
- Remove unused dependencies

---

## Performance Issues

### Issue: Slow Initial Page Load

**Symptoms:**
- First page load takes >3 seconds
- Large JavaScript bundle
- Lighthouse score <50

**Causes:**
- Large bundle size
- No code splitting
- Too many dependencies
- Unoptimized images

**Solution:**
```typescript
// 1. Use dynamic imports
const Dashboard = dynamic(() => import('./Dashboard'), {
  loading: () => <Spinner />
});

// 2. Optimize images
import Image from 'next/image';
<Image
  src="/image.jpg"
  width={500}
  height={300}
  alt="Description"
  priority // For above-fold images
/>

// 3. Implement route-based code splitting
// Next.js does this automatically for pages

// 4. Remove unused dependencies
npm uninstall unused-package

// 5. Check bundle size
npm run build
# Look for large chunks

// 6. Use React.lazy for components
const Component = React.lazy(() => import('./Component'));
```

**Prevention:**
- Keep dependencies minimal
- Use dynamic imports for large components
- Optimize images with Next.js Image
- Regular bundle size audits

### Issue: Unnecessary Re-renders

**Symptoms:**
- Component renders multiple times
- Slow interactions
- React DevTools Profiler shows many renders

**Causes:**
- Inline functions in JSX
- Object/array created every render
- Props changing unnecessarily
- Missing memoization

**Solution:**
```typescript
// 1. Memoize component
const MemoizedComponent = React.memo(Component);

// 2. Use useCallback for functions
const handleClick = useCallback(() => {
  // Handler logic
}, [dependencies]);

// 3. Use useMemo for expensive computations
const filtered = useMemo(() => {
  return data.filter(item => item.active);
}, [data]);

// 4. Avoid inline object/array creation
// BAD:
<Component config={{ option: true }} />

// GOOD:
const config = useMemo(() => ({ option: true }), []);
<Component config={config} />

// 5. Use React DevTools Profiler
// Profile component to find unnecessary renders
```

**Prevention:**
- Memoize expensive components
- Use useCallback for event handlers
- Avoid creating objects/arrays in render
- Profile components regularly

---

## UI/Component Issues

### Issue: Component Not Updating After State Change

**Symptoms:**
- State changes but UI doesn't update
- Console shows correct state
- Manual refresh shows update

**Causes:**
- State mutation instead of setting new state
- Stale closure
- Asynchronous state update not handled
- React not detecting change

**Solution:**
```typescript
// 1. Don't mutate state
// BAD:
items.push(newItem);
setItems(items);

// GOOD:
setItems([...items, newItem]);

// 2. Use functional update for dependent state
setCount(prev => prev + 1); // Instead of setCount(count + 1)

// 3. Handle async properly
const handleUpdate = async () => {
  const newData = await fetchData();
  setData(newData); // This works
};

// 4. Force re-render if needed (last resort)
const [, forceUpdate] = useReducer(x => x + 1, 0);
// Call forceUpdate() to force re-render

// 5. Check object reference
setData({ ...data }); // Create new reference
```

**Prevention:**
- Never mutate state directly
- Use functional state updates
- Create new object references
- Understand React re-render triggers

### Issue: Hydration Mismatch Error

**Symptoms:**
- "Text content does not match" warning
- UI flickers on load
- Content looks different briefly

**Causes:**
- Server and client render different content
- Date/time without timezone
- Random values without seed
- Browser-only APIs used during SSR

**Solution:**
```typescript
// 1. Suppress hydration warning (if intentional)
<div suppressHydrationWarning>
  {new Date().toLocaleString()}
</div>

// 2. Use useEffect for client-only content
const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true);
}, []);

if (!mounted) return null;

return <ClientOnlyComponent />;

// 3. Ensure consistent date formatting
const date = new Date().toISOString(); // Consistent

// 4. Use dynamic import with ssr: false
const ClientComponent = dynamic(() => import('./ClientComponent'), {
  ssr: false
});
```

**Prevention:**
- Avoid browser APIs during SSR
- Use consistent date/time handling
- Test server and client renders match
- Use dynamic imports for client-only code

---

## Service Layer Issues

### Issue: Service Returning Undefined

**Symptoms:**
- Service method returns undefined
- No error thrown
- Data exists in database

**Causes:**
- Missing return statement
- Early return without value
- Async function not awaited
- Transformation returning undefined

**Solution:**
```typescript
// 1. Check for return statement
static async getData() {
  const { data } = await supabase.from('table').select('*');
  return data; // Ensure return!
}

// 2. Check early returns
static async getData() {
  if (!id) {
    return null; // Explicit return
  }
  // ...
  return data;
}

// 3. Await async calls
// BAD:
const data = this.transformData(rawData);

// GOOD:
const data = await this.transformData(rawData);

// 4. Check transformation
private static transformData(data: any[]) {
  if (!data) return []; // Handle null
  return data.map(item => ({
    // transformation
  }));
}
```

**Prevention:**
- Always explicitly return from methods
- Handle null/undefined cases
- Await all async operations
- Add TypeScript return types

### Issue: Service Method Throwing Generic Error

**Symptoms:**
- Error message is "Error: An error occurred"
- No specific error details
- Hard to debug

**Causes:**
- Error not logged properly
- Error caught and re-thrown without context
- Generic error message
- Stack trace lost

**Solution:**
```typescript
// 1. Log error with context
static async getData(filters: Filters) {
  try {
    // ... query logic
  } catch (error) {
    logger.error('service', 'getData failed', {
      error,
      filters,
      userId: 'user-id'
    });
    throw error; // Or throw new error with context
  }
}

// 2. Create specific error messages
if (!data) {
  throw new Error(`No data found for institution ${institutionId}`);
}

// 3. Use custom error classes
class ServiceError extends Error {
  constructor(message: string, public code: string, public details: any) {
    super(message);
    this.name = 'ServiceError';
  }
}

throw new ServiceError('Data fetch failed', 'DATA_FETCH_ERROR', { filters });

// 4. Preserve original error
try {
  // logic
} catch (error) {
  throw new Error(`Operation failed: ${error.message}`, { cause: error });
}
```

**Prevention:**
- Always log errors with context
- Use specific error messages
- Include relevant data in error
- Preserve original error information

---

**Version**: 1.0.0
**Last Updated**: 2025-01-16
**For More Help**: Check debugging-workflows.md for systematic approaches
