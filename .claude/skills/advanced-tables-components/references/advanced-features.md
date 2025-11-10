# Advanced Table Features

This reference contains patterns for implementing advanced table features including virtual scrolling, column management, inline editing, and real-time updates.

## Pattern 7: Real-time Updates with Supabase

Implement live data updates using Supabase real-time subscriptions.

```tsx
// hooks/use-realtime-table.ts
import { useEffect } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface UseRealtimeTableProps {
  table: string
  onInsert?: (payload: any) => void
  onUpdate?: (payload: any) => void
  onDelete?: (payload: any) => void
  filter?: string
}

export function useRealtimeTable({
  table,
  onInsert,
  onUpdate,
  onDelete,
  filter,
}: UseRealtimeTableProps) {
  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    let channel: RealtimeChannel

    const setupRealtimeSubscription = () => {
      channel = supabase
        .channel(`table-${table}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table,
            filter,
          },
          (payload) => onInsert?.(payload)
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table,
            filter,
          },
          (payload) => onUpdate?.(payload)
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table,
            filter,
          },
          (payload) => onDelete?.(payload)
        )
        .subscribe()
    }

    setupRealtimeSubscription()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [table, filter, onInsert, onUpdate, onDelete])
}

// Usage in table component
export function RealtimeDataTable() {
  const [data, setData] = React.useState([])

  useRealtimeTable({
    table: 'items',
    onInsert: (payload) => {
      setData(prev => [payload.new, ...prev])
      toast.info('New item added')
    },
    onUpdate: (payload) => {
      setData(prev => prev.map(item =>
        item.id === payload.new.id ? payload.new : item
      ))
      toast.info('Item updated')
    },
    onDelete: (payload) => {
      setData(prev => prev.filter(item => item.id !== payload.old.id))
      toast.info('Item deleted')
    },
  })

  return <DataTable data={data} />
}
```

**Key Features:**
- Subscribe to INSERT, UPDATE, DELETE events
- Optional row-level filtering
- Automatic cleanup on unmount
- Toast notifications for changes
- Optimistic state updates

**Setup Requirements:**

1. Enable real-time on Supabase table:
```sql
ALTER TABLE items REPLICA IDENTITY FULL;
```

2. Configure RLS policies to allow subscriptions:
```sql
CREATE POLICY "Enable realtime for authenticated users"
ON items FOR SELECT
TO authenticated
USING (true);
```

**Best Practices:**
- Always cleanup subscriptions in useEffect return
- Use row-level filters to reduce bandwidth
- Show visual indicators for real-time updates
- Handle connection drops gracefully
- Consider throttling updates for high-frequency changes

## Pattern 8: Inline Editing

Enable inline editing of table cells with optimistic updates.

```tsx
// components/data-table/data-table-editable-cell.tsx
'use client'

import * as React from 'react'
import { Check, X, Edit2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { updateRow } from '@/app/actions/table'

interface EditableCellProps {
  value: string
  row: any
  column: string
  onUpdate?: (value: string) => Promise<void>
}

export function EditableCell({
  value: initialValue,
  row,
  column,
  onUpdate,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [value, setValue] = React.useState(initialValue)
  const [isUpdating, setIsUpdating] = React.useState(false)

  const handleSave = async () => {
    if (value === initialValue) {
      setIsEditing(false)
      return
    }

    setIsUpdating(true)
    try {
      if (onUpdate) {
        await onUpdate(value)
      } else {
        await updateRow(row.id, { [column]: value })
      }
      setIsEditing(false)
      toast.success('Updated successfully')
    } catch (error) {
      toast.error('Failed to update')
      setValue(initialValue)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCancel = () => {
    setValue(initialValue)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') handleCancel()
          }}
          disabled={isUpdating}
          className="h-7"
          autoFocus
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleSave}
          disabled={isUpdating}
        >
          <Check className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleCancel}
          disabled={isUpdating}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    )
  }

  return (
    <div
      className="group flex items-center justify-between cursor-pointer"
      onClick={() => setIsEditing(true)}
    >
      <span>{value}</span>
      <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-50" />
    </div>
  )
}
```

**Key Features:**
- Click to edit with visual feedback
- Enter to save, Escape to cancel
- Check/X buttons for explicit save/cancel
- Loading state during update
- Error handling with rollback
- Toast notifications
- Keyboard shortcuts

**Usage in Column Definition:**

```tsx
{
  accessorKey: 'name',
  header: 'Name',
  cell: ({ row }) => (
    <EditableCell
      value={row.getValue('name')}
      row={row.original}
      column="name"
    />
  ),
}
```

## Virtual Scrolling for Large Datasets

Efficiently render large datasets by only rendering visible rows.

```tsx
// components/data-table/data-table-virtual.tsx
import { useVirtualizer } from '@tanstack/react-virtual'

export function VirtualDataTable<TData>({
  data,
  columns
}: VirtualDataTableProps<TData>) {
  const parentRef = React.useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // Estimated row height
    overscan: 10, // Number of items to render outside viewport
  })

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div style={{ height: rowVirtualizer.getTotalSize() }}>
        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
          const row = data[virtualItem.index]
          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <TableRow data={row} columns={columns} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

**When to Use:**
- Datasets with 10,000+ rows
- Smooth scrolling is critical
- Client-side pagination not feasible

**Key Configuration:**
- `estimateSize`: Expected row height (adjust based on content)
- `overscan`: Number of extra rows to render (prevents white space during scroll)
- `count`: Total number of rows
- `getScrollElement`: Reference to scrollable container

**Performance Characteristics:**
- Only renders visible rows + overscan
- Maintains scroll position during data updates
- Handles variable row heights
- Smooth 60fps scrolling

## Column Resizing and Reordering

Enable users to customize column widths and order.

```tsx
// components/data-table/data-table-resizable.tsx
import {
  useReactTable,
  ColumnResizeMode,
} from '@tanstack/react-table'

export function ResizableDataTable() {
  const [columnResizeMode] = React.useState<ColumnResizeMode>('onChange')

  const table = useReactTable({
    // ... other options
    columnResizeMode,
    enableColumnResizing: true,
    defaultColumn: {
      minSize: 50,
      maxSize: 500,
    },
  })

  return (
    <Table style={{ width: table.getCenterTotalSize() }}>
      <TableHeader>
        {table.getHeaderGroups().map(headerGroup => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map(header => (
              <TableHead
                key={header.id}
                style={{ width: header.getSize() }}
                className="relative"
              >
                {flexRender(
                  header.column.columnDef.header,
                  header.getContext()
                )}
                <div
                  onMouseDown={header.getResizeHandler()}
                  onTouchStart={header.getResizeHandler()}
                  className={cn(
                    'absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none',
                    header.column.getIsResizing() && 'bg-primary'
                  )}
                />
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
    </Table>
  )
}
```

**Column Resize Modes:**
- `onChange`: Updates immediately during drag
- `onEnd`: Updates only after drag completes (better performance)

**Key Features:**
- Drag column borders to resize
- Visual indicator during resize
- Min/max size constraints
- Touch support for mobile
- Persists sizes in state

**Persisting Column Sizes:**

```tsx
const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})

// Load from localStorage on mount
React.useEffect(() => {
  const saved = localStorage.getItem('table-column-sizing')
  if (saved) setColumnSizing(JSON.parse(saved))
}, [])

// Save to localStorage on change
React.useEffect(() => {
  localStorage.setItem('table-column-sizing', JSON.stringify(columnSizing))
}, [columnSizing])

const table = useReactTable({
  state: { columnSizing },
  onColumnSizingChange: setColumnSizing,
  // ...
})
```

**Column Reordering:**

```tsx
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'

export function ReorderableColumns() {
  const [columnOrder, setColumnOrder] = React.useState<string[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (active.id !== over.id) {
      setColumnOrder((items) => {
        const oldIndex = items.indexOf(active.id)
        const newIndex = items.indexOf(over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={columnOrder}
        strategy={horizontalListSortingStrategy}
      >
        {/* Table headers */}
      </SortableContext>
    </DndContext>
  )
}
```

**Key Features:**
- Drag and drop column headers to reorder
- Keyboard support for accessibility
- Visual feedback during drag
- Persists order in state
- Works with column pinning
