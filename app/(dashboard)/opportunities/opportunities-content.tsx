'use client'

/**
 * Opportunities Content Component
 *
 * Client component for opportunity filtering, search, and display.
 */

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Search,
  Filter,
  LayoutGrid,
  List,
  SlidersHorizontal,
  Bookmark,
  MapPin,
  Calendar,
  Clock,
} from 'lucide-react'
import { OpportunityCard } from '@/components/industry-opportunities/opportunity-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { format, differenceInDays } from 'date-fns'
interface OpportunitiesContentProps {
  opportunities: Array<{
    id: string
    title: string
    description: string
    type?: string
    status?: string
    deadline?: string | null
    is_remote?: boolean
    location?: string | null
    created_at?: string
    stakeholder?: {
      id?: string
      name?: string
      city?: string | null
      logo_url?: string | null
      industry_type?: string | null
    } | null
    match_score?: number
    match_breakdown?: {
      industry: number
      skills: number
      experience: number
      engagement: number
    }
  }>
  categories: { industry: string; count: number }[]
  currentFilters: {
    type?: string
    industry?: string
    search?: string
  }
}

export function OpportunitiesContent({
  opportunities,
  categories,
  currentFilters,
}: OpportunitiesContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState(currentFilters.search || '')
  const [sortBy, setSortBy] = useState<'match' | 'deadline' | 'recent'>('match')
  const [showBookmarked, setShowBookmarked] = useState(false)
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>(
    currentFilters.industry ? [currentFilters.industry] : []
  )

  // Filter and sort opportunities
  const filteredOpportunities = useMemo(() => {
    let filtered = [...opportunities]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (o) =>
          o.title.toLowerCase().includes(query) ||
          o.description?.toLowerCase().includes(query) ||
          o.stakeholder?.name?.toLowerCase().includes(query)
      )
    }

    // Industry filter
    if (selectedIndustries.length > 0) {
      filtered = filtered.filter((o) =>
        selectedIndustries.includes(o.stakeholder?.industry_type || '')
      )
    }

    // Sort
    switch (sortBy) {
      case 'match':
        filtered.sort((a, b) => (b.match_score || 0) - (a.match_score || 0))
        break
      case 'deadline':
        filtered.sort((a, b) => {
          const dateA = new Date(a.deadline || '9999-12-31')
          const dateB = new Date(b.deadline || '9999-12-31')
          return dateA.getTime() - dateB.getTime()
        })
        break
      case 'recent':
        filtered.sort(
          (a, b) =>
            new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        )
        break
    }

    return filtered
  }, [opportunities, searchQuery, selectedIndustries, sortBy])

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString())
    if (searchQuery) {
      params.set('search', searchQuery)
    } else {
      params.delete('search')
    }
    router.push(`/opportunities?${params.toString()}`)
  }

  const handleIndustryToggle = (industry: string) => {
    setSelectedIndustries((prev) =>
      prev.includes(industry)
        ? prev.filter((i) => i !== industry)
        : [...prev, industry]
    )
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedIndustries([])
    router.push('/opportunities')
  }

  const activeFilterCount =
    (currentFilters.type ? 1 : 0) +
    selectedIndustries.length +
    (searchQuery ? 1 : 0)

  return (
    <div className="space-y-4">
      {/* Search and Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search opportunities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={handleSearch}>
            Search
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Sort */}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="match">Best Match</SelectItem>
              <SelectItem value="deadline">Deadline</SelectItem>
              <SelectItem value="recent">Most Recent</SelectItem>
            </SelectContent>
          </Select>

          {/* View Toggle */}
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {/* Filter Sheet */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filter Opportunities</SheetTitle>
                <SheetDescription>
                  Narrow down opportunities based on your preferences
                </SheetDescription>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-180px)] mt-6 pr-4">
                <div className="space-y-6">
                  {/* Industry Filter */}
                  <div>
                    <h4 className="font-medium mb-3">Industry</h4>
                    <div className="space-y-2">
                      {categories.map((cat) => (
                        <div key={cat.industry} className="flex items-center space-x-2">
                          <Checkbox
                            id={`industry-${cat.industry}`}
                            checked={selectedIndustries.includes(cat.industry)}
                            onCheckedChange={() => handleIndustryToggle(cat.industry)}
                          />
                          <Label
                            htmlFor={`industry-${cat.industry}`}
                            className="flex-1 flex items-center justify-between cursor-pointer"
                          >
                            <span>{cat.industry}</span>
                            <Badge variant="secondary">{cat.count}</Badge>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Quick Filters */}
                  <div>
                    <h4 className="font-medium mb-3">Quick Filters</h4>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="urgent"
                          checked={false}
                          onCheckedChange={() => {}}
                        />
                        <Label htmlFor="urgent" className="cursor-pointer">
                          <span className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-red-500" />
                            Closing Soon (7 days)
                          </span>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="remote"
                          checked={false}
                          onCheckedChange={() => {}}
                        />
                        <Label htmlFor="remote" className="cursor-pointer">
                          <span className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Remote Friendly
                          </span>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="paid"
                          checked={false}
                          onCheckedChange={() => {}}
                        />
                        <Label htmlFor="paid" className="cursor-pointer">
                          Paid Opportunities
                        </Label>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <Button variant="outline" onClick={clearFilters} className="w-full">
                    Clear All Filters
                  </Button>
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Active Filters */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {currentFilters.type && (
            <Badge variant="secondary" className="gap-1">
              Type: {currentFilters.type}
              <button
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString())
                  params.delete('type')
                  router.push(`/opportunities?${params.toString()}`)
                }}
                className="ml-1 hover:text-destructive"
              >
                ×
              </button>
            </Badge>
          )}
          {selectedIndustries.map((ind) => (
            <Badge key={ind} variant="secondary" className="gap-1">
              {ind}
              <button
                onClick={() => handleIndustryToggle(ind)}
                className="ml-1 hover:text-destructive"
              >
                ×
              </button>
            </Badge>
          ))}
          {searchQuery && (
            <Badge variant="secondary" className="gap-1">
              Search: {searchQuery}
              <button
                onClick={() => {
                  setSearchQuery('')
                  handleSearch()
                }}
                className="ml-1 hover:text-destructive"
              >
                ×
              </button>
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Results */}
      {filteredOpportunities.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">No opportunities found</p>
            <p className="text-muted-foreground mt-1">
              Try adjusting your filters or search query
            </p>
            <Button variant="outline" onClick={clearFilters} className="mt-4">
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredOpportunities.map((opportunity) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              matchScore={opportunity.match_score}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOpportunities.map((opportunity) => (
            <Card key={opportunity.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant="outline"
                        className={
                          opportunity.type === 'internship'
                            ? 'bg-blue-50 text-blue-700'
                            : opportunity.type === 'project'
                            ? 'bg-purple-50 text-purple-700'
                            : opportunity.type === 'mentorship'
                            ? 'bg-green-50 text-green-700'
                            : opportunity.type === 'job'
                            ? 'bg-orange-50 text-orange-700'
                            : 'bg-gray-50 text-gray-700'
                        }
                      >
                        {opportunity.type}
                      </Badge>
                      {opportunity.match_score && opportunity.match_score >= 70 && (
                        <Badge className="bg-green-100 text-green-700">
                          {opportunity.match_score}% match
                        </Badge>
                      )}
                    </div>
                    <Link href={`/opportunities/${opportunity.id}`}>
                      <h3 className="font-semibold hover:text-primary">
                        {opportunity.title}
                      </h3>
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {opportunity.stakeholder?.name || 'Industry Partner'}
                    </p>
                    <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                      {opportunity.description}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    {opportunity.deadline && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {differenceInDays(new Date(opportunity.deadline), new Date())} days left
                        </span>
                      </div>
                    )}
                    {opportunity.location && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3" />
                        <span>{opportunity.location}</span>
                      </div>
                    )}
                    <Button asChild size="sm" className="mt-2">
                      <Link href={`/opportunities/${opportunity.id}`}>View</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Results Count */}
      <div className="text-center text-sm text-muted-foreground">
        Showing {filteredOpportunities.length} of {opportunities.length} opportunities
      </div>
    </div>
  )
}
