/**
 * Bulk Upload Progress Component
 *
 * Shows real-time progress during bulk member upload.
 */

'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  User,
  Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BulkUploadRowResult } from '@/lib/validations/bulk-member'

interface BulkUploadProgressProps {
  totalRows: number
  processedRows: number
  currentResults: BulkUploadRowResult[]
  isComplete: boolean
  startTime?: Date
}

export function BulkUploadProgress({
  totalRows,
  processedRows,
  currentResults,
  isComplete,
  startTime
}: BulkUploadProgressProps) {
  const [elapsedTime, setElapsedTime] = useState(0)

  // Track elapsed time
  useEffect(() => {
    if (!startTime || isComplete) return

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime.getTime()) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [startTime, isComplete])

  const progressPercent = totalRows > 0 ? (processedRows / totalRows) * 100 : 0

  // Calculate stats from current results
  const successCount = currentResults.filter(r => r.status === 'success').length
  const skippedCount = currentResults.filter(r => r.status === 'skipped').length
  const errorCount = currentResults.filter(r => r.status === 'error').length
  const updatedCount = currentResults.filter(r => r.status === 'updated').length

  // Format elapsed time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  // Estimate remaining time
  const estimatedRemaining = processedRows > 0
    ? Math.round((elapsedTime / processedRows) * (totalRows - processedRows))
    : 0

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'skipped':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'updated':
        return <CheckCircle2 className="h-4 w-4 text-blue-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />
      default:
        return <Loader2 className="h-4 w-4 animate-spin" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600'
      case 'skipped':
        return 'text-yellow-600'
      case 'updated':
        return 'text-blue-600'
      case 'error':
        return 'text-destructive'
      default:
        return 'text-muted-foreground'
    }
  }

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              {!isComplete && <Loader2 className="h-5 w-5 animate-spin" />}
              {isComplete && <CheckCircle2 className="h-5 w-5 text-green-500" />}
              {isComplete ? 'Upload Complete' : 'Processing Members...'}
            </CardTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {processedRows} / {totalRows}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatTime(elapsedTime)}
              </span>
            </div>
          </div>
          <CardDescription>
            {!isComplete && estimatedRemaining > 0 && (
              <span>Estimated time remaining: ~{formatTime(estimatedRemaining)}</span>
            )}
            {isComplete && (
              <span>Completed in {formatTime(elapsedTime)}</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={progressPercent} className="h-3" />
        </CardContent>
      </Card>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold text-green-600">{successCount}</div>
                <p className="text-xs text-muted-foreground">Created</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 dark:border-blue-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold text-blue-600">{updatedCount}</div>
                <p className="text-xs text-muted-foreground">Updated</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div>
                <div className="text-2xl font-bold text-yellow-600">{skippedCount}</div>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              <div>
                <div className="text-2xl font-bold text-destructive">{errorCount}</div>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Results Log */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Processing Log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[300px]">
            <div className="p-4 space-y-2">
              {currentResults.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Waiting for results...
                </p>
              ) : (
                [...currentResults].reverse().map((result, idx) => (
                  <div
                    key={`${result.rowNumber}-${idx}`}
                    className={cn(
                      'flex items-start gap-3 p-2 rounded-md text-sm',
                      result.status === 'success' && 'bg-green-50 dark:bg-green-900/20',
                      result.status === 'updated' && 'bg-blue-50 dark:bg-blue-900/20',
                      result.status === 'skipped' && 'bg-yellow-50 dark:bg-yellow-900/20',
                      result.status === 'error' && 'bg-destructive/10'
                    )}
                  >
                    {getStatusIcon(result.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          Row {result.rowNumber}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn('text-xs', getStatusColor(result.status))}
                        >
                          {result.status}
                        </Badge>
                      </div>
                      <p className="font-medium truncate">{result.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">{result.email}</p>
                      <p className={cn('text-xs mt-1', getStatusColor(result.status))}>
                        {result.message}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
