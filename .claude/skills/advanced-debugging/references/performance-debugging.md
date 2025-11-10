# Performance Debugging Guide

## React Query Optimization

```typescript
// Use appropriate staleTime
const { data } = useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  staleTime: 1000 * 60 * 5, // 5 minutes for stable data
  // staleTime: 0, // For real-time data
});

// Prefetch for better UX
queryClient.prefetchQuery({
  queryKey: ['next-page'],
  queryFn: () => fetchNextPage()
});

// Use suspense for better loading states
const { data } = useSuspenseQuery({
  queryKey: ['data'],
  queryFn: fetchData
});
```

## Service Layer Optimization

```typescript
// Use _optimized services for large datasets
import { BillingInvoiceServiceOptimized } from '@/lib/services/billing/invoices/billing-invoice-service-optimized';

// Always paginate large lists
const PAGE_SIZE = 50;
const { data } = await supabase
  .from('table')
  .select('*')
  .range(offset, offset + PAGE_SIZE - 1);

// Select only needed columns
const { data } = await supabase
  .from('students')
  .select('id, name, roll_number') // Not *
  .limit(100);
```

## Component Optimization

```typescript
// Memoize expensive components
const ExpensiveComponent = React.memo(Component);

// Use useCallback for event handlers
const handleClick = useCallback(() => {
  // Handler
}, [deps]);

// Use useMemo for expensive calculations
const filtered = useMemo(() =>
  data.filter(item => item.active),
  [data]
);

// Virtualize long lists
import { useVirtualizer } from '@tanstack/react-virtual';
```

## Bundle Size Optimization

```bash
# Analyze bundle
npm run build

# Use dynamic imports
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Spinner />
});

# Check for duplicate dependencies
npm ls package-name
```

## Database Query Optimization

```sql
-- Add indexes for frequently filtered columns
CREATE INDEX idx_table_institution_id ON table(institution_id);
CREATE INDEX idx_table_created_at ON table(created_at DESC);

-- Composite index for common filter combinations
CREATE INDEX idx_students_institution_program
ON students(institution_id, program_id);
```

## Monitoring Tools

```typescript
// React Query DevTools
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
<ReactQueryDevtools initialIsOpen={false} />

// Next.js Speed Insights (already installed)
import { SpeedInsights } from '@vercel/speed-insights/next';
<SpeedInsights />
```

---

**Version**: 1.0.0
