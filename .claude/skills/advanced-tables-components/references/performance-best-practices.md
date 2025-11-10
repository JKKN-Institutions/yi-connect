# Performance Optimization and Best Practices

This reference contains patterns for optimizing table performance, testing strategies, migration guides, and troubleshooting common issues.

## Performance Optimization

### 1. Query Optimization

Optimize database queries for fast data retrieval.

```sql
-- Create indexes for common filters
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_created_at ON items(created_at DESC);
CREATE INDEX idx_items_search ON items USING gin(to_tsvector('english', name || ' ' || description));

-- Composite index for common filter combinations
CREATE INDEX idx_items_status_created ON items(status, created_at DESC);

-- Materialized view for expensive aggregations
CREATE MATERIALIZED VIEW item_statistics AS
SELECT
  status,
  COUNT(*) as count,
  AVG(price) as avg_price,
  MIN(price) as min_price,
  MAX(price) as max_price
FROM items
GROUP BY status;

-- Refresh periodically (can be automated with pg_cron)
REFRESH MATERIALIZED VIEW CONCURRENTLY item_statistics;
```

**Index Strategy:**
- Add indexes on frequently filtered columns
- Use composite indexes for common filter combinations
- Add text search indexes for search functionality
- Monitor query performance with `EXPLAIN ANALYZE`
- Avoid over-indexing (impacts write performance)

**Materialized Views:**
- Use for expensive aggregations (counts, sums, averages)
- Refresh on a schedule or after significant data changes
- CONCURRENTLY option allows queries during refresh
- Great for dashboard statistics

### 2. React Optimization

Optimize React rendering for smooth performance.

```tsx
// Memoize expensive computations
const columns = React.useMemo(
  () => generateColumns(columnConfig),
  [columnConfig]
)

// Memoize filter options
const filterOptions = React.useMemo(
  () => ({
    status: getUniqueValues(data, 'status'),
    category: getUniqueValues(data, 'category'),
  }),
  [data]
)

// Use React.memo for row components
const TableRow = React.memo(({ row, columns }) => {
  return (
    <tr>
      {columns.map(column => (
        <td key={column.id}>
          {flexRender(column.cell, { row })}
        </td>
      ))}
    </tr>
  )
}, (prevProps, nextProps) => {
  // Custom comparison
  return prevProps.row.id === nextProps.row.id &&
         prevProps.row.updated_at === nextProps.row.updated_at
})

// Debounce search input
const [searchValue, setSearchValue] = React.useState('')
const debouncedSearch = useDebounce(searchValue, 300)

React.useEffect(() => {
  // Update URL params with debounced value
  updateSearchParams({ search: debouncedSearch })
}, [debouncedSearch])

// Use transition for non-urgent updates
const [isPending, startTransition] = React.useTransition()

const handleFilterChange = (newFilters) => {
  startTransition(() => {
    setFilters(newFilters)
  })
}
```

**Optimization Techniques:**
- **Memoization**: Prevent recalculating expensive values
- **React.memo**: Skip re-rendering unchanged components
- **Debouncing**: Reduce frequency of search/filter updates
- **Transitions**: Mark non-urgent updates for better UX
- **Code splitting**: Lazy load heavy components
- **Virtualization**: Only render visible rows

**Custom Debounce Hook:**

```tsx
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value)

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
```

### 3. Data Loading Strategies

**Progressive Loading:**
```tsx
// Load initial data immediately, then load additional details
const { data: initialData } = useSWR('/api/items?fields=id,name,status')
const { data: fullData } = useSWR(
  selectedRow ? `/api/items/${selectedRow.id}` : null
)
```

**Prefetching:**
```tsx
// Prefetch next page on hover
const prefetchNextPage = () => {
  queryClient.prefetchQuery({
    queryKey: ['items', page + 1],
    queryFn: () => fetchItems(page + 1),
  })
}

<Button onMouseEnter={prefetchNextPage}>
  Next Page
</Button>
```

**Optimistic Updates:**
```tsx
const updateItem = useMutation({
  mutationFn: updateItemApi,
  onMutate: async (newItem) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['items'] })

    // Snapshot previous value
    const previousItems = queryClient.getQueryData(['items'])

    // Optimistically update
    queryClient.setQueryData(['items'], (old) =>
      old.map(item => item.id === newItem.id ? newItem : item)
    )

    return { previousItems }
  },
  onError: (err, newItem, context) => {
    // Rollback on error
    queryClient.setQueryData(['items'], context.previousItems)
  },
  onSettled: () => {
    // Refetch after error or success
    queryClient.invalidateQueries({ queryKey: ['items'] })
  },
})
```

## Testing Strategy

Comprehensive testing approach for data tables.

```typescript
// __tests__/data-table.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DataTable } from '@/components/data-table'

describe('DataTable', () => {
  it('should render with data', () => {
    render(<DataTable data={mockData} columns={columns} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('should sort when header clicked', async () => {
    const user = userEvent.setup()
    render(<DataTable data={mockData} columns={columns} />)

    const nameHeader = screen.getByText('Name')
    await user.click(nameHeader)

    await waitFor(() => {
      const firstRow = screen.getAllByRole('row')[1]
      expect(firstRow).toHaveTextContent('A-Item')
    })
  })

  it('should filter data', async () => {
    const user = userEvent.setup()
    render(<DataTable data={mockData} columns={columns} />)

    const searchInput = screen.getByPlaceholderText('Search...')
    await user.type(searchInput, 'test')

    await waitFor(() => {
      expect(screen.queryByText('Other Item')).not.toBeInTheDocument()
    })
  })

  it('should select rows', async () => {
    const user = userEvent.setup()
    render(<DataTable data={mockData} columns={columns} />)

    const firstCheckbox = screen.getAllByRole('checkbox')[1]
    await user.click(firstCheckbox)

    expect(firstCheckbox).toBeChecked()
  })

  it('should export selected rows', async () => {
    const user = userEvent.setup()
    const mockExport = jest.fn()
    render(<DataTable data={mockData} columns={columns} onExport={mockExport} />)

    // Select first row
    const firstCheckbox = screen.getAllByRole('checkbox')[1]
    await user.click(firstCheckbox)

    // Click export
    const exportButton = screen.getByText('Export')
    await user.click(exportButton)

    expect(mockExport).toHaveBeenCalledWith([mockData[0]])
  })
})
```

**Test Coverage Areas:**
- Rendering with data
- Sorting functionality
- Filtering (search, faceted, date range)
- Row selection
- Bulk actions
- Export functionality
- Pagination
- Loading states
- Error states
- Accessibility (keyboard navigation, screen readers)

## Migration Guide

### From Client-Side to Server-Side

When migrating from client-side table operations to server-side:

```typescript
// BEFORE: Client-side filtering
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
})

// AFTER: Server-side operations
const table = useReactTable({
  data,
  columns,
  pageCount,
  getCoreRowModel: getCoreRowModel(),
  manualPagination: true,
  manualSorting: true,
  manualFiltering: true,
  onPaginationChange: (updater) => {
    // Update URL params to trigger server fetch
    const newPagination = typeof updater === 'function'
      ? updater(pagination)
      : updater
    router.push(`?page=${newPagination.pageIndex + 1}`)
  },
  onSortingChange: (updater) => {
    // Update URL params to trigger server fetch
    const newSort = typeof updater === 'function' ? updater(sort) : updater
    router.push(`?sort=${JSON.stringify(newSort)}`)
  },
  onColumnFiltersChange: (updater) => {
    // Update URL params to trigger server fetch
    const newFilters = typeof updater === 'function' ? updater(filters) : updater
    router.push(`?filters=${JSON.stringify(newFilters)}`)
  },
})
```

**Migration Checklist:**
- [ ] Add `pageCount` prop from server response
- [ ] Enable manual modes: `manualPagination`, `manualSorting`, `manualFiltering`
- [ ] Implement URL state management for filters/sort/pagination
- [ ] Update server endpoint to handle filtering, sorting, pagination
- [ ] Add database indexes for filtered/sorted columns
- [ ] Update loading states to show during server fetches
- [ ] Test with large dataset to verify performance improvement

### From TanStack Table v7 to v8

Key API changes when upgrading:

```typescript
// v7
import { useTable, usePagination, useSortBy, useFilters } from 'react-table'

const {
  getTableProps,
  getTableBodyProps,
  headerGroups,
  rows,
  prepareRow,
} = useTable({ columns, data }, useFilters, useSortBy, usePagination)

// v8
import { useReactTable, flexRender } from '@tanstack/react-table'

const table = useReactTable({
  columns,
  data,
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
})

// Rendering also changed
table.getHeaderGroups().map(headerGroup => (
  <tr key={headerGroup.id}>
    {headerGroup.headers.map(header => (
      <th key={header.id}>
        {flexRender(header.column.columnDef.header, header.getContext())}
      </th>
    ))}
  </tr>
))
```

## Troubleshooting Common Issues

| Issue                               | Symptom                          | Solution                                                 |
| ----------------------------------- | -------------------------------- | -------------------------------------------------------- |
| Table re-renders on every keystroke | Slow typing in search box        | Use debouncing (300ms) for search inputs                 |
| Slow initial load                   | Long wait before data appears    | Implement server-side pagination, add database indexes   |
| Memory leaks with subscriptions     | Memory usage grows over time     | Always cleanup subscriptions in useEffect return         |
| Filters not persisting              | Filters lost on page refresh     | Store in URL params or localStorage                      |
| Poor mobile experience              | Horizontal scroll, tiny text     | Use responsive design patterns, hide columns on mobile   |
| Export fails for large datasets     | Timeout or memory error          | Use server-side streaming export                         |
| Row selection lost on refetch       | Checkboxes unchecked after fetch | Maintain selection state separately, use stable row IDs  |
| Jumping scroll position             | Page jumps during infinite scroll| Use virtual scrolling with proper size estimation        |
| Slow sorting/filtering              | UI freezes during operations     | Move to server-side operations, use React.useTransition  |
| Blank rows during scroll            | White space while scrolling      | Increase overscan in virtualizer                         |

### Debug Performance Issues

```tsx
// Add React DevTools Profiler
import { Profiler } from 'react'

<Profiler id="DataTable" onRender={onRenderCallback}>
  <DataTable {...props} />
</Profiler>

function onRenderCallback(
  id, phase, actualDuration, baseDuration, startTime, commitTime
) {
  console.log(`${id} (${phase}) took ${actualDuration}ms`)
}

// Log expensive re-renders
useEffect(() => {
  console.log('Table re-rendered', { data, filters, sort })
})

// Check what caused re-render
useWhyDidYouUpdate('DataTable', props)
```

### Common Performance Bottlenecks

1. **Column definitions recreated on every render**
   - Fix: Wrap in `React.useMemo`

2. **Filter options recalculated on every render**
   - Fix: Memoize or fetch from server

3. **Too many rows rendered**
   - Fix: Use pagination or virtual scrolling

4. **Complex cell rendering**
   - Fix: Simplify JSX, use `React.memo` for cells

5. **Unoptimized database queries**
   - Fix: Add indexes, use query planner

6. **Large payloads**
   - Fix: Select only needed columns, implement field selection

## Best Practices Summary

### DO:

- ✅ Use server-side operations for datasets > 1000 rows
- ✅ Implement proper loading states with skeletons
- ✅ Add keyboard navigation (arrow keys, tab, enter)
- ✅ Provide clear empty states with actions
- ✅ Use optimistic updates for better perceived performance
- ✅ Implement proper error boundaries and fallbacks
- ✅ Add accessibility attributes (aria-labels, roles)
- ✅ Cache filter/sort preferences in localStorage
- ✅ Use debouncing for search inputs (300ms)
- ✅ Implement progressive enhancement
- ✅ Add analytics tracking for user interactions
- ✅ Use virtualization for datasets > 10,000 rows
- ✅ Test with realistic data volumes
- ✅ Monitor performance with profiler
- ✅ Add database indexes for filtered columns

### DON'T:

- ❌ Load entire datasets into memory
- ❌ Perform complex calculations in render
- ❌ Use index as key for dynamic rows
- ❌ Forget to handle loading/error states
- ❌ Implement filtering/sorting on client for large datasets
- ❌ Block UI during bulk operations
- ❌ Forget to cleanup subscriptions
- ❌ Use synchronous operations for data mutations
- ❌ Skip accessibility testing
- ❌ Ignore mobile responsiveness
- ❌ Over-engineer for small datasets
- ❌ Forget to validate user permissions for bulk actions
