/**
 * Chapter Feature Hook
 *
 * Client-side hook to check if a feature is enabled for the current chapter.
 * Uses caching to minimize database calls.
 */

'use client'

import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { useEffect, useState, useCallback } from 'react'
import { FeatureName } from '@/lib/features'

// Cache for feature status (shared across hook instances)
const featureCache = new Map<string, { enabled: boolean; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

interface UseFeatureResult {
  isEnabled: boolean
  isLoading: boolean
  error: Error | null
  refresh: () => void
}

export function useChapterFeature(feature: FeatureName): UseFeatureResult {
  const [isEnabled, setIsEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [chapterId, setChapterId] = useState<string | null>(null)

  // Fetch chapter ID for current user
  useEffect(() => {
    let isMounted = true

    async function fetchChapterId() {
      try {
        const supabase = createBrowserSupabaseClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session?.user) {
          if (isMounted) setChapterId(null)
          return
        }

        const { data: member } = await supabase
          .from('members')
          .select('chapter_id')
          .eq('id', session.user.id)
          .single()

        if (isMounted) {
          setChapterId(member?.chapter_id || null)
        }
      } catch {
        // User not logged in or no member record
        if (isMounted) setChapterId(null)
      }
    }

    fetchChapterId()

    return () => {
      isMounted = false
    }
  }, [])

  // Check feature status
  const checkFeature = useCallback(async () => {
    if (!chapterId) {
      setIsEnabled(false)
      setIsLoading(false)
      return
    }

    const cacheKey = `${chapterId}:${feature}`
    const cached = featureCache.get(cacheKey)

    // Return cached value if still valid
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setIsEnabled(cached.enabled)
      setIsLoading(false)
      return
    }

    try {
      const supabase = createBrowserSupabaseClient()

      // Check if user is National Admin (they have access to all features)
      const { data: isNationalAdmin } = await supabase.rpc('is_national_admin')

      if (isNationalAdmin) {
        setIsEnabled(true)
        featureCache.set(cacheKey, { enabled: true, timestamp: Date.now() })
        setIsLoading(false)
        return
      }

      // Check feature toggle for this chapter
      const { data: featureToggle, error: fetchError } = await supabase
        .from('chapter_feature_toggles')
        .select('is_enabled')
        .eq('chapter_id', chapterId)
        .eq('feature', feature)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 = no rows found
        throw fetchError
      }

      const enabled = featureToggle?.is_enabled ?? false
      setIsEnabled(enabled)
      featureCache.set(cacheKey, { enabled, timestamp: Date.now() })
    } catch (err) {
      console.error('[useChapterFeature] Error:', err)
      setError(err as Error)
      setIsEnabled(false)
    } finally {
      setIsLoading(false)
    }
  }, [chapterId, feature])

  useEffect(() => {
    checkFeature()
  }, [checkFeature])

  const refresh = useCallback(() => {
    if (chapterId) {
      const cacheKey = `${chapterId}:${feature}`
      featureCache.delete(cacheKey)
    }
    setIsLoading(true)
    checkFeature()
  }, [chapterId, feature, checkFeature])

  return { isEnabled, isLoading, error, refresh }
}

/**
 * Hook to get all enabled features for the current chapter
 */
export function useChapterFeatures(): {
  features: FeatureName[]
  isLoading: boolean
  error: Error | null
} {
  const [features, setFeatures] = useState<FeatureName[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let isMounted = true

    async function fetchFeatures() {
      try {
        const supabase = createBrowserSupabaseClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session?.user) {
          if (isMounted) {
            setFeatures([])
            setIsLoading(false)
          }
          return
        }

        // Get user's chapter
        const { data: member } = await supabase
          .from('members')
          .select('chapter_id')
          .eq('id', session.user.id)
          .single()

        if (!member?.chapter_id) {
          if (isMounted) {
            setFeatures([])
            setIsLoading(false)
          }
          return
        }

        // Check if National Admin
        const { data: isNationalAdmin } = await supabase.rpc('is_national_admin')

        if (isNationalAdmin) {
          // National Admin has all features
          const allFeatures: FeatureName[] = [
            'events',
            'communications',
            'stakeholder_crm',
            'session_bookings',
            'opportunities',
            'knowledge_base',
            'awards',
            'finance',
            'analytics',
            'member_intelligence',
            'succession_planning',
            'verticals',
            'sub_chapters',
            'industrial_visits',
          ]
          if (isMounted) {
            setFeatures(allFeatures)
            setIsLoading(false)
          }
          return
        }

        // Get enabled features for chapter
        const { data: enabledFeatures, error: fetchError } = await supabase
          .from('chapter_feature_toggles')
          .select('feature')
          .eq('chapter_id', member.chapter_id)
          .eq('is_enabled', true)

        if (fetchError) throw fetchError

        if (isMounted) {
          setFeatures(
            enabledFeatures?.map((f) => f.feature as FeatureName) || []
          )
        }
      } catch (err) {
        console.error('[useChapterFeatures] Error:', err)
        if (isMounted) {
          setError(err as Error)
          setFeatures([])
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchFeatures()

    return () => {
      isMounted = false
    }
  }, [])

  return { features, isLoading, error }
}

/**
 * Clear the feature cache (call when features are updated)
 */
export function clearFeatureCache(): void {
  featureCache.clear()
}
