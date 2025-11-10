/**
 * Table Types
 *
 * TypeScript definitions for data tables.
 */

import type { Column } from '@tanstack/react-table'

export interface DataTableFilterField<TData> {
  label: string
  value: keyof TData
  placeholder?: string
  options?: Array<{
    label: string
    value: string
    icon?: React.ComponentType<{ className?: string }>
  }>
}

export interface DataTableFilterOption<TData> {
  id: string
  label: string
  value: keyof TData
  options: Array<{
    label: string
    value: string
    icon?: React.ComponentType<{ className?: string }>
    count?: number
  }>
  filterValues?: string[]
  filterOperator?: string
  isMulti?: boolean
}

export interface SearchParams {
  [key: string]: string | string[] | undefined
}

export interface Option {
  label: string
  value: string
  icon?: React.ComponentType<{ className?: string }>
  count?: number
}

export interface DataTableConfig<TData> {
  filterFields?: DataTableFilterField<TData>[]
  enableAdvancedFilter?: boolean
  enableRowSelection?: boolean
  enableBulkActions?: boolean
  enableExport?: boolean
  enableColumnVisibility?: boolean
}

export interface FeatureFlagValue<TData = unknown> {
  label: string
  value: keyof TData | string
  options: Option[]
  filterValues?: string[]
  filterOperator?: string
  isMulti?: boolean
}
