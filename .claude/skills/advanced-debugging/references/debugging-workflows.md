# Debugging Workflows

## Table of Contents
1. [General Debugging Workflow](#general-debugging-workflow)
2. [Layer-Specific Workflows](#layer-specific-workflows)
3. [Issue Type Workflows](#issue-type-workflows)
4. [Decision Trees](#decision-trees)
5. [Emergency Response](#emergency-response)

---

## General Debugging Workflow

### Step 1: Reproduce the Issue

**Goal**: Create consistent, minimal reproduction steps

```
1. Document exact steps to reproduce
2. Note environment details:
   - Browser/version
   - User role/permissions
   - Institution/program/section
   - Timestamp
3. Capture screenshots/videos
4. Check if reproducible:
   - In incognito mode
   - With different user roles
   - In different browsers
```

**Red Flags:**
- Cannot reproduce → Check environment differences
- Intermittent → Timing/race condition issue
- Role-specific → Permission/RLS issue
- Browser-specific → Browser compatibility issue

### Step 2: Check Logs

**Enhanced Logger Output:**
```typescript
// Open browser console
// Check for errors, warnings
// Look for module-specific logs with [module] prefix

// Check log summary
import { getLogManager } from '@/lib/utils/enhanced-logger';
const manager = getLogManager();
console.log('Log summary:', manager.getSummary());
console.log('Logs by module:', manager.getLogsByModule());
console.log('Critical errors:', manager.getCriticalErrors());
```

**What to Look For:**
- Error messages and stack traces
- Warning patterns (repeated warnings)
- Module with highest error count
- Recent errors in relevant module

### Step 3: Identify the Layer

**Use this checklist to determine which layer has the issue:**

```
UI/Frontend Layer:
□ Issue is visual (layout, styling, rendering)
□ Component state is incorrect
□ Props are not being passed
□ Event handlers not firing

Service Layer:
□ Data transformation is wrong
□ Business logic error
□ Service method throwing error
□ Data validation failing

Database Layer:
□ Query returns no data
□ RLS policy blocking access
□ Foreign key constraint error
□ Timeout on large queries

Network/API Layer:
□ Request failing
□ Response format incorrect
□ CORS errors
□ Rate limiting

Authentication Layer:
□ User not logged in
□ Session expired
□ Permission denied
□ Role-based access failing
```

### Step 4: Apply Specific Debugging Pattern

Based on the identified layer, follow the appropriate workflow below.

### Step 5: Verify the Fix

**Testing Checklist:**
```
□ Original issue resolved
□ No new issues introduced
□ Works for all user roles
□ Works in mobile view
□ Works in dark mode
□ Error states handled
□ Loading states shown
□ Edge cases covered
□ TypeScript types valid
□ No console errors/warnings
```

### Step 6: Document and Share

```
1. Add to common-issues.md if recurring
2. Update relevant service documentation
3. Share findings in team chat
4. Create Jira ticket if needed
5. Add unit test if applicable
```

---

## Layer-Specific Workflows

### Frontend/UI Debugging

#### Workflow: Component Not Rendering

```
1. Check if component is imported correctly
   □ Import statement present
   □ No typos in import path
   □ Default vs named export correct

2. Check if component is being called
   □ JSX syntax correct
   □ Conditional rendering condition met
   □ Component name matches

3. Check component props
   □ Required props provided
   □ Prop types match expected
   □ Props not undefined/null

4. Check component state
   □ useState initialized correctly
   □ State updates triggering re-render
   □ State not mutated directly

5. Check React DevTools
   □ Component in tree
   □ Props showing correctly
   □ Hooks in correct order
```

**Debug Commands:**
```typescript
// Add debug logging
useEffect(() => {
  console.log('Component mounted', { props, state });
  return () => console.log('Component unmounted');
}, []);

// Check render count
const renderCount = useRef(0);
useEffect(() => {
  renderCount.current++;
  console.log('Render count:', renderCount.current);
});

// Log every render
console.log('Rendering ComponentName', { props, state });
```

#### Workflow: React Query Data Issues

```
1. Check query key
   □ Key is array format
   □ Key includes all dependencies
   □ Key is stable (not recreated each render)

2. Check query function
   □ Function is async
   □ Function returns data
   □ Function handles errors
   □ No early returns without data

3. Check query options
   □ staleTime appropriate
   □ cacheTime appropriate
   □ refetchOnWindowFocus set correctly
   □ enabled condition correct

4. Check React Query DevTools
   □ Query in cache
   □ Query status (loading/error/success)
   □ Data structure
   □ Stale/fresh status

5. Force refetch if needed
   □ Use refetch() manually
   □ Invalidate query cache
   □ Reset query if corrupted
```

**Debug Commands:**
```typescript
// Log query state
const query = useQuery({
  queryKey: ['key'],
  queryFn: fetchData
});

console.log('Query state:', {
  data: query.data,
  isLoading: query.isLoading,
  isError: query.isError,
  error: query.error,
  status: query.status,
  fetchStatus: query.fetchStatus
});

// Inspect cache
const cache = queryClient.getQueryCache();
console.log('Query cache:', cache.getAll());

// Force refetch
query.refetch();

// Invalidate
queryClient.invalidateQueries({ queryKey: ['key'] });
```

### Service Layer Debugging

#### Workflow: Service Method Failing

```
1. Check method input
   □ All required parameters provided
   □ Parameter types correct
   □ No undefined/null parameters
   □ Filters/options valid

2. Check Supabase client
   □ Client initialized
   □ User authenticated
   □ Correct database URL
   □ Valid API key

3. Check query construction
   □ Table name correct
   □ Select fields valid
   □ Filters applied correctly
   □ Joins structured properly

4. Check error handling
   □ Try-catch present
   □ Error logged
   □ Error message meaningful
   □ Error re-thrown or handled

5. Check data transformation
   □ Data exists before transform
   □ Transformation logic correct
   □ Null checks in place
   □ Return type matches expected
```

**Debug Commands:**
```typescript
// Add extensive logging
static async getData(filters: Filters) {
  logger.dev('service', 'getData called', { filters });

  try {
    // Log before query
    logger.dev('service', 'Building query');

    const query = this.supabase
      .from('table')
      .select('*')
      .eq('institution_id', filters.institutionId);

    // Log query object
    logger.dev('service', 'Query built', { query });

    const { data, error } = await query;

    // Log result
    logger.dev('service', 'Query executed', {
      hasData: !!data,
      dataCount: data?.length,
      hasError: !!error,
      errorCode: error?.code,
      errorMessage: error?.message
    });

    if (error) {
      logger.error('service', 'Query error', error);
      throw error;
    }

    // Log before transform
    logger.dev('service', 'Transforming data', { dataCount: data.length });

    const transformed = this.transformData(data);

    logger.dev('service', 'Data transformed', {
      transformedCount: transformed.length
    });

    return transformed;
  } catch (error) {
    logger.error('service', 'getData failed', error);
    throw error;
  }
}
```

### Database/Supabase Debugging

#### Workflow: Query Returns No Data

```
1. Check table exists
   □ Table name spelled correctly
   □ Table in correct schema
   □ Table has data (check in Supabase dashboard)

2. Check RLS policies
   □ Policy exists for operation (SELECT)
   □ Policy allows current user
   □ Policy conditions are met
   □ User role has permission

3. Check query filters
   □ institution_id matches user's institution
   □ Foreign key IDs exist
   □ Date filters in correct format
   □ Boolean filters correct

4. Check user authentication
   □ User is logged in
   □ Session is valid
   □ User ID correct
   □ User profile exists

5. Test query directly
   □ Run in Supabase SQL editor
   □ Remove filters one by one
   □ Check with different user
   □ Verify data exists
```

**Debug Commands:**
```typescript
// Test basic query
const { data, error } = await supabase
  .from('table')
  .select('*')
  .limit(1);
console.log('Basic query:', { data, error });

// Test with filters
const { data: filtered, error: filterError } = await supabase
  .from('table')
  .select('*')
  .eq('institution_id', institutionId)
  .limit(10);
console.log('Filtered query:', { filtered, filterError });

// Check current user
const { data: { user } } = await supabase.auth.getUser();
console.log('Current user:', user);

// Check user profile
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', user?.id)
  .single();
console.log('User profile:', profile);

// Test RLS bypass (if you have service role key - BE CAREFUL!)
const { data: bypassData } = await supabaseAdmin
  .from('table')
  .select('*')
  .limit(10);
console.log('RLS bypassed data:', bypassData);
```

#### Workflow: RLS Policy Blocking Access

```
1. Identify which policy is blocking
   □ Check Supabase dashboard policies
   □ Test with service role (bypasses RLS)
   □ Compare working vs non-working queries

2. Check policy conditions
   □ User role condition
   □ Institution ID condition
   □ Custom permission condition
   □ Join conditions if applicable

3. Check user context
   □ auth.uid() returns user ID
   □ User has required role
   □ User has required permission
   □ User belongs to institution

4. Test policy in SQL
   □ Use SET LOCAL to test as user
   □ Run explain analyze
   □ Check policy with sample data

5. Fix policy or query
   □ Update policy conditions
   □ Add missing user context
   □ Adjust query filters
   □ Update user permissions
```

**SQL Debug Commands:**
```sql
-- Test as authenticated user
BEGIN;
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'user-id-here';
SET LOCAL request.jwt.claim.role = 'faculty';

SELECT * FROM table WHERE institution_id = 'institution-id';

ROLLBACK;

-- Check policy definition
SELECT * FROM pg_policies WHERE tablename = 'table_name';

-- Explain query plan
EXPLAIN ANALYZE
SELECT * FROM table WHERE institution_id = 'institution-id';
```

### Authentication/Middleware Debugging

#### Workflow: Middleware Redirect Loop

```
1. Check public paths configuration
   □ Current path in PUBLIC_PATHS_SET
   □ Path matches STATIC_ASSET_PATTERN
   □ No typos in path strings

2. Check authentication state
   □ User is authenticated
   □ Session is valid
   □ Cookies are set correctly
   □ No auth errors

3. Check profile state
   □ Profile exists in database
   □ Profile is active (is_active = true)
   □ Profile completed (profile_completed = true)
   □ Profile cache not stale

4. Check role routing
   □ Role matches allowed routes
   □ Guest/driver not accessing admin routes
   □ Custom role has permissions

5. Check middleware execution
   □ No errors in middleware
   □ Response is being returned
   □ Headers set correctly
   □ No infinite recursion
```

**Debug Commands:**
```typescript
// Add debug logging to middleware
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  console.log('[Middleware] Start', { path });

  try {
    // Check public path
    const isPublic = isPublicPath(path);
    console.log('[Middleware] Public check', { isPublic });

    if (isPublic) {
      console.log('[Middleware] Allowing public path');
      return NextResponse.next();
    }

    // Get user
    const { data: { user }, error } = await supabase.auth.getUser();
    console.log('[Middleware] User check', {
      hasUser: !!user,
      userId: user?.id,
      hasError: !!error
    });

    if (!user) {
      console.log('[Middleware] Redirecting to login');
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    // Get profile
    const profile = await getProfile(user.id);
    console.log('[Middleware] Profile check', {
      hasProfile: !!profile,
      role: profile?.role,
      isActive: profile?.is_active
    });

    console.log('[Middleware] Allowing authenticated path');
    return NextResponse.next();
  } catch (error) {
    console.error('[Middleware] Error', error);
    return NextResponse.redirect(new URL('/error', request.url));
  }
}
```

---

## Issue Type Workflows

### Performance Issues

#### Workflow: Slow Page Load

```
1. Identify bottleneck
   □ Check Network tab (slow requests)
   □ Check Performance tab (long tasks)
   □ Check React DevTools Profiler
   □ Check Lighthouse report

2. Check data fetching
   □ Too many sequential requests
   □ Large response sizes
   □ Missing pagination
   □ Unnecessary data fetched

3. Check rendering
   □ Unnecessary re-renders
   □ Heavy computations in render
   □ Large component trees
   □ Missing memoization

4. Check bundle size
   □ Check next build output
   □ Analyze bundle with webpack analyzer
   □ Check for duplicate dependencies
   □ Check for large libraries

5. Optimize identified issues
   □ Add parallel fetching
   □ Implement pagination
   □ Add React.memo/useMemo
   □ Use dynamic imports
   □ Use optimized service variants
```

#### Workflow: Memory Leak

```
1. Detect the leak
   □ Check Memory tab in DevTools
   □ Take heap snapshots
   □ Compare snapshots over time
   □ Identify growing objects

2. Find the source
   □ Check for event listeners not removed
   □ Check for intervals/timeouts not cleared
   □ Check for subscriptions not unsubscribed
   □ Check for refs holding old data

3. Fix the leak
   □ Add cleanup in useEffect
   □ Clear intervals/timeouts
   □ Unsubscribe from observables
   □ Clear refs when unmounting

4. Verify the fix
   □ Take new heap snapshots
   □ Check memory usage stabilizes
   □ Test for several minutes
   □ Check in production build
```

### Build/Deploy Issues

#### Workflow: TypeScript Error

```
1. Read the error message carefully
   □ Note the file and line number
   □ Understand what type is expected
   □ Understand what type was provided

2. Check the types involved
   □ Check type definitions
   □ Check imported types
   □ Check generated types (if Supabase)
   □ Check type assertions

3. Fix the type mismatch
   □ Update the type definition
   □ Add type assertion (if safe)
   □ Add type guard
   □ Fix the data structure

4. Run type check
   □ npx tsc --noEmit
   □ Check for related errors
   □ Fix cascading errors
   □ Verify in IDE
```

#### Workflow: Build Failure

```
1. Check build logs
   □ Read error message
   □ Note which step failed
   □ Check for stack traces

2. Common build issues
   □ Environment variables missing
   □ TypeScript errors
   □ Module resolution errors
   □ Out of memory errors

3. Try clean build
   □ npm run clean:all
   □ Delete node_modules
   □ npm install
   □ npm run build

4. Check Next.js config
   □ Verify next.config.ts
   □ Check experimental features
   □ Check image domains
   □ Check headers/rewrites

5. Check dependencies
   □ Update outdated packages
   □ Check for breaking changes
   □ Resolve version conflicts
```

---

## Decision Trees

### Quick Issue Diagnosis Tree

```
Is the issue visible in the UI?
├─ YES: Is data displaying incorrectly?
│  ├─ YES: Is data coming from API?
│  │  ├─ YES: Check Service Layer → Check Database
│  │  └─ NO: Check component state/props
│  └─ NO: Is component rendering at all?
│     ├─ YES: Check CSS/styling → Check conditional rendering
│     └─ NO: Check component import → Check React tree
│
└─ NO: Is there a console error?
   ├─ YES: Is it a network error?
   │  ├─ YES: Check API endpoint → Check Supabase connection
   │  └─ NO: Is it a JavaScript error?
   │     ├─ YES: Check stack trace → Fix code error
   │     └─ NO: Is it a TypeScript error?
   │        ├─ YES: Check types → Fix type mismatch
   │        └─ NO: Check warning messages
   │
   └─ NO: Is functionality not working?
      ├─ Authentication issue? → Check middleware → Check RLS
      ├─ Permission issue? → Check role → Check custom permissions
      ├─ Data issue? → Check database → Check service layer
      └─ Unknown? → Follow general workflow
```

### Performance Issue Tree

```
Is the page slow to load?
├─ Initial load slow?
│  ├─ Check Network tab
│  │  ├─ Large JS bundle? → Optimize bundle
│  │  ├─ Slow API calls? → Optimize queries
│  │  └─ Many requests? → Batch or parallelize
│  └─ Check bundle size → Analyze with webpack
│
└─ Interactions slow?
   ├─ Check React DevTools Profiler
   │  ├─ Many re-renders? → Add memoization
   │  ├─ Slow render? → Optimize component
   │  └─ Heavy computation? → Move to service/useMemo
   └─ Check Memory tab
      ├─ Growing memory? → Find memory leak
      └─ High memory usage? → Optimize data structures
```

---

## Emergency Response

### Production is Down

```
1. ASSESS (2 minutes)
   □ Check uptime monitors
   □ Check error rates
   □ Check user reports
   □ Identify impact (all users or subset)

2. COMMUNICATE (1 minute)
   □ Notify team
   □ Update status page
   □ Prepare user communication

3. DIAGNOSE (5-10 minutes)
   □ Check Vercel deployment logs
   □ Check Supabase status
   □ Check recent deployments
   □ Check error logs

4. MITIGATE (5-15 minutes)
   □ Rollback if recent deploy
   □ Apply hotfix if known issue
   □ Scale resources if needed
   □ Enable maintenance mode if needed

5. RESOLVE (Variable)
   □ Fix root cause
   □ Test thoroughly
   □ Deploy fix
   □ Monitor closely

6. POST-MORTEM (After resolution)
   □ Document what happened
   □ Document how it was fixed
   □ Identify prevention measures
   □ Update runbooks
```

### Critical Bug in Production

```
1. REPRODUCE (5 minutes)
   □ Verify in production
   □ Document exact steps
   □ Check error logs
   □ Assess severity

2. PRIORITIZE
   □ Data loss risk? → IMMEDIATE
   □ Security issue? → IMMEDIATE
   □ Core functionality broken? → HIGH
   □ Minor feature broken? → MEDIUM
   □ UI issue? → LOW

3. FIX
   □ Create hotfix branch
   □ Minimal fix for issue
   □ Test thoroughly
   □ Code review (quick)

4. DEPLOY
   □ Deploy to production
   □ Monitor deployment
   □ Verify fix in production
   □ Monitor for side effects

5. FOLLOW-UP
   □ Create proper fix if hotfix was hacky
   □ Add tests to prevent recurrence
   □ Update documentation
   □ Review prevention strategies
```

---

**Version**: 1.0.0
**Last Updated**: 2025-01-16
