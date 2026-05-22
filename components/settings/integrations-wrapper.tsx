'use client'

/**
 * Integrations Wrapper for National Admin
 *
 * Client component that uses useAdminChapter context to get the selected chapter.
 * This is needed because National Admin users select their chapter via the
 * chapter switcher dropdown, not through direct database assignment.
 */

import { useState, useEffect } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'

import { useAdminChapter } from '@/contexts/admin-chapter-context'
import { YiCreativeSettings } from '@/components/settings/yi-creative-settings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import type { YiCreativeConnection } from '@/types/yi-creative'

interface IntegrationsWrapperProps {
  canManage: boolean
}

export function IntegrationsWrapper({ canManage }: IntegrationsWrapperProps) {
  const { activeChapterId, activeChapter, isLoading, isNationalAdmin } = useAdminChapter()
  const [connection, setConnection] = useState<YiCreativeConnection | null>(null)
  const [isLoadingConnection, setIsLoadingConnection] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch connection when active chapter changes
  useEffect(() => {
    async function fetchConnection() {
      if (!activeChapterId) {
        setConnection(null)
        return
      }

      setIsLoadingConnection(true)
      setError(null)

      try {
        const response = await fetch(`/api/yi-creative/connection?chapterId=${activeChapterId}`)

        if (!response.ok) {
          if (response.status === 404) {
            // No connection exists - that's fine
            setConnection(null)
          } else {
            // Try to get error message from response
            const errorData = await response.json().catch(() => ({}))
            console.error('[IntegrationsWrapper] API error:', response.status, errorData)
            throw new Error(errorData.error || `Failed to fetch connection (${response.status})`)
          }
        } else {
          const data = await response.json()
          setConnection(data.connection)
        }
      } catch (err) {
        console.error('[IntegrationsWrapper] Error fetching connection:', err)
        setError(err instanceof Error ? err.message : 'Failed to load integration status')
        setConnection(null)
      } finally {
        setIsLoadingConnection(false)
      }
    }

    fetchConnection()
  }, [activeChapterId])

  // Still loading context
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // No chapter selected
  if (!activeChapterId || !activeChapter) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No Chapter Selected</AlertTitle>
        <AlertDescription>
          Please select a chapter from the dropdown in the header to manage integrations.
        </AlertDescription>
      </Alert>
    )
  }

  // Loading connection
  if (isLoadingConnection) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Yi Creative Studio
            <span className="text-sm font-normal text-muted-foreground">
              for {activeChapter.name}
            </span>
          </CardTitle>
          <CardDescription>AI-powered poster and creative content generation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading integration status...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  // Render settings component
  return (
    <div className="space-y-4">
      {/* Chapter indicator for National Admin */}
      {isNationalAdmin && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm text-blue-800">
            Managing integrations for: <strong>{activeChapter.name}</strong>
          </p>
        </div>
      )}

      <YiCreativeSettings
        connection={connection}
        chapterId={activeChapterId}
        canManage={canManage}
      />
    </div>
  )
}
