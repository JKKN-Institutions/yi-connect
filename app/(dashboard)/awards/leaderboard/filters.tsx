'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { AwardCategory } from '@/types/award'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface LeaderboardFiltersProps {
  categoryId?: string
  year?: string
  categories: AwardCategory[]
}

export function LeaderboardFilters({ categoryId, year, categories }: LeaderboardFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i)

  const handleCategoryChange = (value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value !== 'all') {
      params.set('category', value)
    } else {
      params.delete('category')
    }
    router.push(`/awards/leaderboard?${params.toString()}`)
  }

  const handleYearChange = (value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value !== 'all') {
      params.set('year', value)
    } else {
      params.delete('year')
    }
    router.push(`/awards/leaderboard?${params.toString()}`)
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {/* Category Filter */}
      <div className="flex-1">
        <label className="text-sm font-medium mb-2 block">Filter by Category</label>
        <Select value={categoryId || 'all'} onValueChange={handleCategoryChange}>
          <SelectTrigger>
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Year Filter */}
      <div className="flex-1">
        <label className="text-sm font-medium mb-2 block">Filter by Year</label>
        <Select value={year || 'all'} onValueChange={handleYearChange}>
          <SelectTrigger>
            <SelectValue placeholder="All Years" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y.toString()}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
