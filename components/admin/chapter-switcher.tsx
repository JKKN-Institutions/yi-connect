/**
 * Chapter Switcher Component
 *
 * Dropdown for National Admin to switch between viewing different chapters.
 * Shows in the header when user is National Admin.
 */

'use client'

import { useAdminChapter } from '@/contexts/admin-chapter-context'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Globe, MapPin, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function ChapterSwitcher() {
  const {
    activeChapterId,
    setActiveChapter,
    isNationalAdmin,
    isLoading,
    chapters,
    activeChapter,
  } = useAdminChapter()

  // Don't render if not National Admin
  if (!isNationalAdmin) {
    return null
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading...</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="text-xs font-normal">
        National Admin
      </Badge>

      <Select
        value={activeChapterId || 'all'}
        onValueChange={(value) =>
          setActiveChapter(value === 'all' ? null : value)
        }
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue>
            {activeChapter ? (
              <span className="flex items-center gap-2">
                <MapPin className="h-3 w-3" />
                {activeChapter.name}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Globe className="h-3 w-3" />
                All Chapters
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <span className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              All Chapters (National View)
            </span>
          </SelectItem>

          <SelectSeparator />

          {chapters.map((chapter) => (
            <SelectItem key={chapter.id} value={chapter.id}>
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{chapter.name}</span>
                <span className="text-muted-foreground text-xs">
                  - {chapter.location}
                </span>
              </span>
            </SelectItem>
          ))}

          {chapters.length === 0 && (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              No chapters available
            </div>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}

/**
 * Compact version for sidebar
 */
export function ChapterSwitcherCompact() {
  const {
    activeChapterId,
    setActiveChapter,
    isNationalAdmin,
    isLoading,
    chapters,
    activeChapter,
  } = useAdminChapter()

  if (!isNationalAdmin) {
    return null
  }

  if (isLoading) {
    return null
  }

  return (
    <Select
      value={activeChapterId || 'all'}
      onValueChange={(value) =>
        setActiveChapter(value === 'all' ? null : value)
      }
    >
      <SelectTrigger className="w-full">
        <SelectValue>
          {activeChapter ? (
            <span className="flex items-center gap-2 truncate">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{activeChapter.name}</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Globe className="h-3 w-3 shrink-0" />
              <span>All Chapters</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          <span className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            All Chapters
          </span>
        </SelectItem>
        <SelectSeparator />
        {chapters.map((chapter) => (
          <SelectItem key={chapter.id} value={chapter.id}>
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {chapter.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
