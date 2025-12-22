/**
 * Feature Gate Component
 *
 * Conditionally renders children based on feature toggle status.
 * Use this to hide/show features based on chapter settings.
 */

'use client'

import { useChapterFeature } from '@/hooks/use-feature'
import { FeatureName, CHAPTER_FEATURES } from '@/lib/features'
import { ReactNode } from 'react'
import { Lock, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface FeatureGateProps {
  /** The feature to check */
  feature: FeatureName
  /** Content to show when feature is enabled */
  children: ReactNode
  /** Content to show when feature is disabled (optional) */
  fallback?: ReactNode
  /** Show a "feature disabled" message instead of fallback */
  showDisabledMessage?: boolean
  /** Show loading spinner while checking (default: false to prevent flash) */
  showLoading?: boolean
}

/**
 * FeatureGate - Wrap content that should only be visible when a feature is enabled
 *
 * @example
 * ```tsx
 * <FeatureGate feature="finance">
 *   <FinanceDashboard />
 * </FeatureGate>
 * ```
 */
export function FeatureGate({
  feature,
  children,
  fallback,
  showDisabledMessage = false,
  showLoading = false,
}: FeatureGateProps) {
  const { isEnabled, isLoading } = useChapterFeature(feature)

  if (isLoading && showLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (isLoading) {
    // Don't show anything while loading to prevent flash
    return null
  }

  if (!isEnabled) {
    if (showDisabledMessage) {
      return <FeatureDisabledMessage feature={feature} />
    }
    return fallback ? <>{fallback}</> : null
  }

  return <>{children}</>
}

/**
 * FeatureDisabledMessage - Standard message when a feature is not enabled
 */
interface FeatureDisabledMessageProps {
  feature: FeatureName
}

export function FeatureDisabledMessage({
  feature,
}: FeatureDisabledMessageProps) {
  const featureInfo = CHAPTER_FEATURES[feature]

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Lock className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Feature Not Available</h2>
      <p className="text-muted-foreground max-w-md mb-6">
        The <strong>{featureInfo.name}</strong> feature is not enabled for your
        chapter. Contact your chapter administrator to enable this feature.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" asChild>
          <Link href="/">Go to Dashboard</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Link>
        </Button>
      </div>
    </div>
  )
}

/**
 * FeatureGuardPage - Full page component to protect routes
 */
interface FeatureGuardPageProps {
  feature: FeatureName
  children: ReactNode
}

export function FeatureGuardPage({ feature, children }: FeatureGuardPageProps) {
  const { isEnabled, isLoading } = useChapterFeature(feature)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!isEnabled) {
    return <FeatureDisabledMessage feature={feature} />
  }

  return <>{children}</>
}

/**
 * useFeatureEnabled - Hook version for more control
 */
export { useChapterFeature as useFeatureEnabled } from '@/hooks/use-feature'
