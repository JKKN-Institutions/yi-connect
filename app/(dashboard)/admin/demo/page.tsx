'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  RefreshCw,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Play,
} from 'lucide-react'
import { seedDemoMembers, cleanupDemoMembers } from '@/app/actions/demo-seed'

export default function DemoAdminPage() {
  const [seedLoading, setSeedLoading] = useState(false)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [result, setResult] = useState<{
    type: 'success' | 'error'
    message: string
    details?: string[]
  } | null>(null)

  const handleSeed = async () => {
    setSeedLoading(true)
    setResult(null)

    try {
      const response = await seedDemoMembers()
      setResult({
        type: response.success ? 'success' : 'error',
        message: response.message,
        details: response.errors.length > 0 ? response.errors : undefined,
      })
    } catch (error) {
      setResult({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to seed demo data',
      })
    } finally {
      setSeedLoading(false)
    }
  }

  const handleCleanup = async () => {
    if (!confirm('Are you sure you want to delete all demo members? This cannot be undone.')) {
      return
    }

    setCleanupLoading(true)
    setResult(null)

    try {
      const response = await cleanupDemoMembers()
      setResult({
        type: response.success ? 'success' : 'error',
        message: response.message,
      })
    } catch (error) {
      setResult({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to cleanup demo data',
      })
    } finally {
      setCleanupLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Demo Environment</h1>
        <p className="text-muted-foreground mt-2">
          Manage demo data for Yi DemoChapter
        </p>
      </div>

      {result && (
        <Alert
          variant={result.type === 'error' ? 'destructive' : 'default'}
          className="mb-6"
        >
          {result.type === 'success' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertTitle>
            {result.type === 'success' ? 'Success' : 'Error'}
          </AlertTitle>
          <AlertDescription>
            {result.message}
            {result.details && result.details.length > 0 && (
              <ul className="mt-2 text-sm list-disc list-inside">
                {result.details.map((detail, i) => (
                  <li key={i}>{detail}</li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Demo Accounts Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Demo Login Accounts
            </CardTitle>
            <CardDescription>
              Use these emails with magic link login
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <code className="text-sm">demo-chair@yi-demo.com</code>
              </div>
              <Badge>Chair</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <code className="text-sm">demo-cochair@yi-demo.com</code>
              </div>
              <Badge variant="secondary">Co-Chair</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <code className="text-sm">demo-ec@yi-demo.com</code>
              </div>
              <Badge variant="outline">EC Member</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Seed Data Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Demo Member Data
            </CardTitle>
            <CardDescription>
              Create 12 sample members for the demo chapter
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleSeed}
              disabled={seedLoading || cleanupLoading}
              className="w-full"
            >
              {seedLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Members...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Seed Demo Members
                </>
              )}
            </Button>

            <Button
              variant="destructive"
              onClick={handleCleanup}
              disabled={seedLoading || cleanupLoading}
              className="w-full"
            >
              {cleanupLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting Members...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Reset Demo Members
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Sample Data Info */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Demo Chapter Contents</CardTitle>
          <CardDescription>
            Pre-populated data in Yi DemoChapter
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-lg">
              <div className="text-2xl font-bold">4</div>
              <div className="text-sm text-muted-foreground">Verticals</div>
              <div className="text-xs mt-1">
                MASOOM, Yuva, Climate Action, Road Safety
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-2xl font-bold">8</div>
              <div className="text-sm text-muted-foreground">Events</div>
              <div className="text-xs mt-1">3 completed, 5 upcoming</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-2xl font-bold">5</div>
              <div className="text-sm text-muted-foreground">Stakeholders</div>
              <div className="text-xs mt-1">3 schools, 2 colleges</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
