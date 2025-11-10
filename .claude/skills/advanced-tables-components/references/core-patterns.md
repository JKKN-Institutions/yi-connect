# Core Implementation Patterns

This reference contains the foundational patterns for building server-side data tables with TanStack Table v8 and Supabase.

## Pattern 1: Server-Side Data Table Hook

The `useDataTable` hook manages table state with URL parameters for persistence and shareability.

```tsx
// lib/table/hooks.ts
import { useSearchParams } from 'next/navigation'
import { parseAsInteger, parseAsString, parseAsJson } from 'nuqs'
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
  type PaginationState,
} from '@tanstack/react-table'

interface UseDataTableProps<TData> {
  data: TData[]
  columns: ColumnDef<TData>[]
  pageCount: number
  defaultPerPage?: number
  filterableColumns?: DataTableFilterableColumn<TData>[]
  searchableColumns?: DataTableSearchableColumn<TData>[]
}

export function useDataTable<TData>({
  data,
  columns,
  pageCount,
  defaultPerPage = 10,
  filterableColumns = [],
  searchableColumns = [],
}: UseDataTableProps<TData>) {
  const searchParams = useSearchParams()

  // Parse URL state
  const page = parseAsInteger.withDefault(1).parseServerSide(searchParams.get('page'))
  const perPage = parseAsInteger.withDefault(defaultPerPage).parseServerSide(searchParams.get('per_page'))
  const sort = parseAsJson<SortingState>().withDefault([]).parseServerSide(searchParams.get('sort'))
  const filters = parseAsJson<ColumnFiltersState>().withDefault([]).parseServerSide(searchParams.get('filters'))

  // Local state for client-side features
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: {
      pagination: { pageIndex: page - 1, pageSize: perPage },
      sorting: sort,
      columnFilters: filters,
      columnVisibility,
      rowSelection,
    },
    onPaginationChange: (updater) => {
      const newPagination = typeof updater === 'function'
        ? updater({ pageIndex: page - 1, pageSize: perPage })
        : updater
      // Update URL params
      router.push(`?page=${newPagination.pageIndex + 1}&per_page=${newPagination.pageSize}`)
    },
    onSortingChange: (updater) => {
      const newSort = typeof updater === 'function' ? updater(sort) : updater
      // Update URL params
      router.push(`?sort=${JSON.stringify(newSort)}`)
    },
    onColumnFiltersChange: (updater) => {
      const newFilters = typeof updater === 'function' ? updater(filters) : updater
      // Update URL params
      router.push(`?filters=${JSON.stringify(newFilters)}`)
    },
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  })

  return {
    table,
    searchableColumns,
    filterableColumns,
  }
}
```

**Key Features:**
- URL-based state management for sharing and bookmarking
- Manual pagination, sorting, and filtering for server-side operations
- Client-side state for row selection and column visibility
- Type-safe with generic TData

## Pattern 2: Data Fetching with Supabase

Server-side data fetching with comprehensive filtering, sorting, and pagination support.

```typescript
// lib/data/table-data.ts
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { unstable_cache } from 'next/cache'
import type { TableSearchParams } from '@/types/table'

interface FetchTableDataProps {
  searchParams: TableSearchParams
  userId?: string
}

export const fetchTableData = unstable_cache(
  async ({ searchParams, userId }: FetchTableDataProps) => {
    const supabase = await createServerSupabaseClient()

    const {
      page = 1,
      per_page = 10,
      sort,
      filters,
      search,
    } = searchParams

    // Build base query
    let query = supabase
      .from('items')
      .select('*', { count: 'exact' })

    // Apply search
    if (search) {
      query = query.or(`
        name.ilike.%${search}%,
        description.ilike.%${search}%,
        sku.ilike.%${search}%
      `)
    }

    // Apply filters
    if (filters && Array.isArray(filters)) {
      filters.forEach(filter => {
        const { id, value, operator = 'eq' } = filter

        switch (operator) {
          case 'eq':
            query = query.eq(id, value)
            break
          case 'neq':
            query = query.neq(id, value)
            break
          case 'gt':
            query = query.gt(id, value)
            break
          case 'gte':
            query = query.gte(id, value)
            break
          case 'lt':
            query = query.lt(id, value)
            break
          case 'lte':
            query = query.lte(id, value)
            break
          case 'like':
            query = query.ilike(id, `%${value}%`)
            break
          case 'in':
            query = query.in(id, value)
            break
          case 'contains':
            query = query.contains(id, value)
            break
          case 'between':
            const [min, max] = value
            query = query.gte(id, min).lte(id, max)
            break
        }
      })
    }

    // Apply sorting
    if (sort && Array.isArray(sort)) {
      sort.forEach(({ id, desc }) => {
        query = query.order(id, { ascending: !desc })
      })
    } else {
      // Default sort
      query = query.order('created_at', { ascending: false })
    }

    // Apply pagination
    const from = (page - 1) * per_page
    const to = from + per_page - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) throw error

    return {
      data: data || [],
      pageCount: Math.ceil((count || 0) / per_page),
      totalCount: count || 0,
    }
  },
  ['table-data'],
  {
    revalidate: 60, // Cache for 1 minute
    tags: ['table-data'],
  }
)
```

**Supported Filter Operators:**
- `eq` - Equals
- `neq` - Not equals
- `gt` - Greater than
- `gte` - Greater than or equal
- `lt` - Less than
- `lte` - Less than or equal
- `like` - Text contains (case insensitive)
- `in` - Value in array
- `contains` - Array/JSON contains value
- `between` - Between two values (for ranges)

**Key Features:**
- Comprehensive filter operator support
- Search across multiple columns
- Flexible sorting (multiple columns)
- Efficient pagination with range queries
- Built-in caching with Next.js unstable_cache
- Exact count for pagination

## Pattern 3: Advanced Column Configuration

Define columns with rich metadata for filtering, sorting, and rendering.

```tsx
// components/tables/columns.tsx
import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { DataTableRowActions } from '@/components/data-table/data-table-row-actions'
import { formatDate, formatCurrency } from '@/lib/utils'

export function getColumns<TData>(): ColumnDef<TData>[] {
  return [
    // Selection column
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },

    // Text column with search
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => {
        const name = row.getValue('name') as string
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium">{name}</span>
          </div>
        )
      },
      // Metadata for filtering
      meta: {
        label: 'Name',
        filterVariant: 'text',
        searchable: true,
      },
    },

    // Status column with faceted filter
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = row.getValue('status') as string
        return (
          <Badge variant={getStatusVariant(status)}>
            {status}
          </Badge>
        )
      },
      meta: {
        label: 'Status',
        filterVariant: 'select',
        options: [
          { label: 'Active', value: 'active', icon: CheckCircle },
          { label: 'Pending', value: 'pending', icon: Clock },
          { label: 'Inactive', value: 'inactive', icon: XCircle },
        ],
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },

    // Date column with range filter
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created" />
      ),
      cell: ({ row }) => formatDate(row.getValue('createdAt')),
      meta: {
        label: 'Created Date',
        filterVariant: 'dateRange',
      },
    },

    // Number column with slider filter
    {
      accessorKey: 'price',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Price" />
      ),
      cell: ({ row }) => formatCurrency(row.getValue('price')),
      meta: {
        label: 'Price',
        filterVariant: 'slider',
        min: 0,
        max: 1000,
        step: 10,
      },
    },

    // Actions column
    {
      id: 'actions',
      cell: ({ row }) => <DataTableRowActions row={row} />,
      size: 40,
    },
  ]
}
```

**Filter Variants:**
- `text` - Text input with operators (contains, equals, starts with, ends with)
- `select` - Multi-select dropdown with predefined options
- `dateRange` - Date range picker
- `slider` - Numeric range slider

**Column Metadata:**
- `label` - Display name for filter UI
- `filterVariant` - Type of filter UI to display
- `searchable` - Include in global search
- `options` - For select filters, array of { label, value, icon }
- `min/max/step` - For slider filters

**Key Features:**
- Selection column for bulk operations
- Sortable headers with visual indicators
- Rich cell rendering (badges, formatted dates, currency)
- Comprehensive filter metadata
- Actions column for row-level operations
- Accessibility attributes (aria-labels)
