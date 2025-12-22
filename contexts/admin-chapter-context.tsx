/**
 * Admin Chapter Context
 *
 * Provides chapter selection context for National Admin users.
 * Allows switching between chapters to view their data.
 */

'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

interface Chapter {
  id: string
  name: string
  location: string
  status: string
}

interface AdminChapterContextValue {
  /** Currently selected chapter ID (null = all chapters / national view) */
  activeChapterId: string | null
  /** Set the active chapter */
  setActiveChapter: (chapterId: string | null) => void
  /** Whether user is National Admin */
  isNationalAdmin: boolean
  /** Loading state */
  isLoading: boolean
  /** All available chapters */
  chapters: Chapter[]
  /** Get the active chapter details */
  activeChapter: Chapter | null
}

const AdminChapterContext = createContext<AdminChapterContextValue | null>(null)

const STORAGE_KEY = 'yi_admin_active_chapter'

interface AdminChapterProviderProps {
  children: ReactNode
}

export function AdminChapterProvider({ children }: AdminChapterProviderProps) {
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null)
  const [isNationalAdmin, setIsNationalAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [chapters, setChapters] = useState<Chapter[]>([])

  // Check if user is National Admin and fetch chapters
  useEffect(() => {
    let isMounted = true

    async function initialize() {
      try {
        const supabase = createBrowserSupabaseClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session?.user) {
          if (isMounted) {
            setIsLoading(false)
          }
          return
        }

        // Check if National Admin
        const { data: isAdmin } = await supabase.rpc('is_national_admin')

        if (!isMounted) return

        setIsNationalAdmin(!!isAdmin)

        if (isAdmin) {
          // Fetch all chapters
          const { data: chaptersData } = await supabase
            .from('chapters')
            .select('id, name, location, status')
            .order('name')

          if (isMounted && chaptersData) {
            setChapters(chaptersData)
          }

          // Restore from localStorage
          const saved = localStorage.getItem(STORAGE_KEY)
          if (saved && isMounted) {
            // Verify the saved chapter still exists
            if (chaptersData?.some((c) => c.id === saved)) {
              setActiveChapterId(saved)
            }
          }
        }
      } catch (error) {
        console.error('[AdminChapterContext] Error:', error)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    initialize()

    return () => {
      isMounted = false
    }
  }, [])

  // Handle setting active chapter
  const setActiveChapter = useCallback((chapterId: string | null) => {
    setActiveChapterId(chapterId)
    if (chapterId) {
      localStorage.setItem(STORAGE_KEY, chapterId)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  // Get active chapter details
  const activeChapter = activeChapterId
    ? chapters.find((c) => c.id === activeChapterId) || null
    : null

  return (
    <AdminChapterContext.Provider
      value={{
        activeChapterId,
        setActiveChapter,
        isNationalAdmin,
        isLoading,
        chapters,
        activeChapter,
      }}
    >
      {children}
    </AdminChapterContext.Provider>
  )
}

export function useAdminChapter() {
  const context = useContext(AdminChapterContext)

  if (!context) {
    throw new Error(
      'useAdminChapter must be used within an AdminChapterProvider'
    )
  }

  return context
}

/**
 * Hook to get the chapter ID to use for data fetching.
 * Returns activeChapterId if set, otherwise null (for all chapters).
 * Non-admin users always get their own chapter.
 */
export function useChapterFilter(): string | null {
  const { activeChapterId, isNationalAdmin } = useAdminChapter()

  if (!isNationalAdmin) {
    // Non-admin users don't use this context
    return null
  }

  return activeChapterId
}
