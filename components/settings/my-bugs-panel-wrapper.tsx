'use client'

/**
 * My Bugs Panel Wrapper
 *
 * Client-side wrapper for the MyBugsPanel component from the Bug Reporter SDK.
 * Allows users to view and track their submitted bug reports.
 */

import { MyBugsPanel } from '@boobalan_jkkn/bug-reporter-sdk'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Bug } from 'lucide-react'

export function MyBugsPanelWrapper() {
  const apiKey = process.env.NEXT_PUBLIC_BUG_REPORTER_API_KEY
  const apiUrl = process.env.NEXT_PUBLIC_BUG_REPORTER_API_URL

  // Don't render if not configured
  if (!apiKey || !apiUrl || apiKey === 'app_your_api_key_here') {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Bug className='h-5 w-5' />
          My Bug Reports
        </CardTitle>
        <CardDescription>
          View and track bug reports you have submitted
        </CardDescription>
      </CardHeader>
      <CardContent>
        <MyBugsPanel />
      </CardContent>
    </Card>
  )
}
