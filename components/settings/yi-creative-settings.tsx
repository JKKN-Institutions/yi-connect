'use client'

/**
 * Yi Creative Studio Settings Component
 *
 * Client component for managing Yi Creative Studio connection.
 * Shows connection status, allows connecting/disconnecting.
 */

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Palette,
  ExternalLink,
  Check,
  X,
  RefreshCw,
  Copy,
  Key,
  Link2,
  HelpCircle,
  AlertCircle,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

import {
  connectYiCreativeManual,
  disconnectYiCreativeAction,
  getYiCreativePublicKey,
} from '@/app/actions/yi-creative-connections'
import type { YiCreativeConnection } from '@/types/yi-creative'

interface YiCreativeSettingsProps {
  connection: YiCreativeConnection | null
  chapterId: string
  canManage: boolean
}

export function YiCreativeSettings({
  connection,
  chapterId,
  canManage,
}: YiCreativeSettingsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [isLoadingPublicKey, setIsLoadingPublicKey] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [showPublicKey, setShowPublicKey] = useState(false)
  const [showConnectDialog, setShowConnectDialog] = useState(false)
  const [organizationId, setOrganizationId] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [organizationIdError, setOrganizationIdError] = useState<string | null>(null)
  const [connectionError, setConnectionError] = useState<{
    message: string
    canRetry: boolean
  } | null>(null)

  // Handle OAuth callback messages (keep for backwards compatibility)
  useEffect(() => {
    const error = searchParams.get('yi_creative_error')
    const connected = searchParams.get('yi_creative_connected')
    const orgName = searchParams.get('yi_creative_org')

    if (error) {
      toast.error(`Connection failed: ${error}`)
      // Clear URL params
      router.replace('/settings/integrations')
    } else if (connected === 'true') {
      toast.success(`Successfully connected to ${orgName || 'Yi Creative Studio'}!`)
      router.replace('/settings/integrations')
      router.refresh()
    }
  }, [searchParams, router])

  const handleConnect = async () => {
    // Clear previous errors
    setOrganizationIdError(null)
    setConnectionError(null)

    // Validate Organization ID
    const trimmedId = organizationId.trim()
    if (!trimmedId) {
      setOrganizationIdError('Organization ID is required')
      return
    }

    // UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(trimmedId)) {
      setOrganizationIdError('Please enter a valid Organization ID (UUID format)')
      return
    }

    setIsConnecting(true)
    try {
      const result = await connectYiCreativeManual(
        chapterId,
        trimmedId,
        organizationName.trim() || undefined
      )

      if (result.success) {
        toast.success('Successfully connected to Yi Creative Studio!', {
          description: 'You can now create posters from any event page.',
          duration: 5000,
        })
        setShowConnectDialog(false)
        setOrganizationId('')
        setOrganizationName('')
        setConnectionError(null)
        router.refresh()
      } else {
        // Map server errors to user-friendly messages
        const errorMessages: Record<string, { title: string; description: string }> = {
          'Not authenticated': {
            title: 'Session expired',
            description: 'Please refresh the page and sign in again.',
          },
          'No chapter assigned': {
            title: 'No chapter found',
            description: 'You must be assigned to a chapter to connect Yi Creative.',
          },
          'Insufficient permissions. Chapter Chair or higher required.': {
            title: 'Permission denied',
            description: 'Chapter Chair or higher role is required to manage integrations.',
          },
          'Chapter is already connected to Yi Creative Studio': {
            title: 'Already connected',
            description: 'This chapter already has an active Yi Creative connection.',
          },
        }

        const errorKey = result.error || 'Unknown error'
        const errorInfo = errorMessages[errorKey] || {
          title: result.error || 'Connection failed',
          description: 'Please verify your Organization ID and try again.',
        }

        setConnectionError({
          message: errorInfo.description,
          canRetry: !errorKey.includes('already connected') && !errorKey.includes('permission'),
        })
        toast.error(errorInfo.title, { description: errorInfo.description })
      }
    } catch (error) {
      console.error('[Yi Creative] Connect error:', error)
      setConnectionError({
        message: 'Please check your Organization ID and network connection.',
        canRetry: true,
      })
      toast.error('Connection failed', {
        description: 'Please check your Organization ID and try again.',
      })
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    try {
      // Pass the chapterId for National Admin users who select chapter from dropdown
      const result = await disconnectYiCreativeAction(chapterId)

      if (result.success) {
        toast.success('Disconnected from Yi Creative Studio', {
          description: 'You can reconnect at any time.',
        })
        router.refresh()
      } else {
        toast.error('Failed to disconnect', {
          description: result.error || 'Please try again or contact support.',
        })
      }
    } catch (error) {
      console.error('[Yi Creative] Disconnect error:', error)
      toast.error('Failed to disconnect', {
        description: 'Please try again or contact support if the issue continues.',
      })
    } finally {
      setIsDisconnecting(false)
    }
  }

  const handleShowPublicKey = async () => {
    if (publicKey) {
      setShowPublicKey(!showPublicKey)
      return
    }

    setIsLoadingPublicKey(true)
    try {
      // Pass the chapterId for National Admin users who select chapter from dropdown
      const result = await getYiCreativePublicKey(chapterId)
      if (result.success && result.publicKey) {
        setPublicKey(result.publicKey)
        setShowPublicKey(true)
      } else {
        toast.error('Failed to retrieve public key', {
          description: result.error || 'Please try again.',
        })
      }
    } catch (error) {
      console.error('[Yi Creative] Public key fetch error:', error)
      toast.error('Failed to retrieve public key', {
        description: 'Please check your connection and try again.',
      })
    } finally {
      setIsLoadingPublicKey(false)
    }
  }

  const copyPublicKey = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey)
      toast.success('Public key copied!', {
        description: 'Share this with the Yi Creative Studio team.',
      })
    }
  }

  const isConnected = connection?.status === 'active'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600">
              <Palette className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Yi Creative Studio
                {isConnected ? (
                  <Badge variant="default" className="bg-green-500">
                    <Check className="mr-1 h-3 w-3" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <X className="mr-1 h-3 w-3" />
                    Not Connected
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                AI-powered poster and creative content generation
              </CardDescription>
            </div>
          </div>

          <a
            href="https://yi-creative-studio.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isConnected && connection ? (
          <>
            {/* Connection Details */}
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="grid gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Organization</span>
                  <span className="font-medium">
                    {connection.organization_name || connection.organization_id}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Connected</span>
                  <span className="font-medium">
                    {format(new Date(connection.connected_at), 'MMM d, yyyy')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium capitalize">{connection.status}</span>
                </div>
              </div>
            </div>

            {/* Public Key Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShowPublicKey}
                  disabled={isLoadingPublicKey}
                  className="flex-1 justify-start"
                >
                  {isLoadingPublicKey ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Key className="mr-2 h-4 w-4" />
                  )}
                  {showPublicKey ? 'Hide' : 'Show'} SSO Public Key
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex text-muted-foreground hover:text-foreground"
                      aria-label="What is SSO Public Key?"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p>
                      This cryptographic key enables Single Sign-On (SSO) between Yi Connect
                      and Yi Creative Studio. Share this with the Yi Creative team to complete
                      the integration.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>

              {showPublicKey && publicKey && (
                <div className="relative rounded-lg border bg-muted p-3">
                  <pre className="overflow-x-auto text-xs">
                    {Buffer.from(publicKey, 'base64').toString('utf-8')}
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-2"
                    onClick={copyPublicKey}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Share this public key with the Yi Creative Studio team to enable SSO.
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                You can create posters directly from event pages.
              </p>

              {canManage && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={isDisconnecting}>
                      {isDisconnecting ? (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Disconnect
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect Yi Creative Studio?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will disable the "Create Poster" feature for your chapter.
                        You can reconnect at any time.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDisconnect}>
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Not Connected State */}
            <div className="rounded-lg border border-dashed p-6 text-center">
              <Palette className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 font-medium">Connect Yi Creative Studio</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Enable AI-powered poster generation for your events. Create stunning
                promotional materials with just a few clicks.
              </p>

              {canManage && (
                <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
                  <DialogTrigger asChild>
                    <Button className="mt-4">
                      <Link2 className="mr-2 h-4 w-4" />
                      Connect Yi Creative Studio
                    </Button>
                  </DialogTrigger>
                  <DialogContent aria-describedby="connect-dialog-description">
                    <DialogHeader>
                      <DialogTitle>Connect Yi Creative Studio</DialogTitle>
                      <DialogDescription id="connect-dialog-description">
                        Enter your Yi Creative Studio organization details to enable
                        AI-powered poster generation for your chapter.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                          <Label htmlFor="organizationId">Organization ID *</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="inline-flex text-muted-foreground hover:text-foreground"
                                aria-label="What is Organization ID?"
                              >
                                <HelpCircle className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p>
                                A unique identifier for your organization in Yi Creative Studio.
                                You can find this in your Yi Creative Studio dashboard under
                                Settings → Organization.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          id="organizationId"
                          placeholder="e.g., bd21dd9d-2f08-478f-a457-74f014d5d6d1"
                          value={organizationId}
                          onChange={(e) => {
                            setOrganizationId(e.target.value)
                            setOrganizationIdError(null) // Clear error on change
                            setConnectionError(null)
                          }}
                          disabled={isConnecting}
                          aria-invalid={!!organizationIdError}
                          aria-describedby="organizationId-error organizationId-description"
                          className={cn(organizationIdError && 'border-destructive')}
                        />
                        <p id="organizationId-description" className="text-xs text-muted-foreground">
                          Find this in Yi Creative Studio → Settings → Organization
                        </p>
                        {organizationIdError && (
                          <p id="organizationId-error" className="text-sm text-destructive">
                            {organizationIdError}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="organizationName">Organization Name (optional)</Label>
                        <Input
                          id="organizationName"
                          placeholder="e.g., Yi Erode"
                          value={organizationName}
                          onChange={(e) => setOrganizationName(e.target.value)}
                          disabled={isConnecting}
                        />
                      </div>

                      {/* Connection Error with Retry */}
                      {connectionError && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Connection Failed</AlertTitle>
                          <AlertDescription className="flex flex-col gap-2">
                            <span>{connectionError.message}</span>
                            {connectionError.canRetry && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleConnect}
                                disabled={isConnecting}
                                className="w-fit"
                              >
                                <RefreshCw className={cn('mr-2 h-4 w-4', isConnecting && 'animate-spin')} />
                                Try Again
                              </Button>
                            )}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowConnectDialog(false)
                          setOrganizationIdError(null)
                          setConnectionError(null)
                        }}
                        disabled={isConnecting}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleConnect} disabled={isConnecting || !organizationId.trim()}>
                        {isConnecting ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <Link2 className="mr-2 h-4 w-4" />
                            Connect
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Features List */}
            <div className="grid gap-2 text-sm">
              <div className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-green-500" />
                <span>Generate professional event posters in seconds</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-green-500" />
                <span>Multiple design styles and templates</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-green-500" />
                <span>Event details auto-filled from Yi Connect</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-green-500" />
                <span>Single sign-on - no separate login needed</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
