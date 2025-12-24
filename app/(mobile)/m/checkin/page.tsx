/**
 * Mobile Check-in Page
 *
 * QR code scanner for event check-in with fallback to manual entry.
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MobileHeader } from '@/components/mobile/mobile-header'
import { QRScanner } from '@/components/mobile/qr-scanner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Calendar, MapPin, Clock } from 'lucide-react'
import { triggerHaptic } from '@/lib/mobile/haptics'
import { selfCheckIn } from '@/app/actions/events'
import type { QRScanResult } from '@/types/mobile'

type CheckInStatus = 'idle' | 'loading' | 'success' | 'error'

interface CheckInResult {
  eventId: string
  eventTitle: string
  venue?: string | null
  checkInTime: string
  message: string
}

export default function MobileCheckInPage() {
  const router = useRouter()
  const [status, setStatus] = useState<CheckInStatus>('idle')
  const [result, setResult] = useState<CheckInResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleScan = async (scanResult: QRScanResult) => {
    if (!scanResult.success || !scanResult.data) {
      return
    }

    setStatus('loading')
    setError(null)

    try {
      // Parse the QR code data
      // Expected format: yi-event:eventId or just eventId
      let eventId = scanResult.data
      if (eventId.startsWith('yi-event:')) {
        eventId = eventId.replace('yi-event:', '')
      }

      // Call the check-in API
      const response = await selfCheckIn(eventId)

      if (!response.success || !response.data) {
        setStatus('error')
        setError(response.error || 'Check-in failed')
        triggerHaptic('error')
        return
      }

      const checkInResult: CheckInResult = {
        eventId: response.data.eventId,
        eventTitle: response.data.eventTitle,
        venue: response.data.venue,
        checkInTime: response.data.checkInTime,
        message: 'Successfully checked in!'
      }

      setResult(checkInResult)
      setStatus('success')
      triggerHaptic('success')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Check-in failed')
      triggerHaptic('error')
    }
  }

  const handleScanError = (errorMessage: string) => {
    console.error('Scan error:', errorMessage)
  }

  const resetScanner = () => {
    setStatus('idle')
    setResult(null)
    setError(null)
  }

  return (
    <div className='min-h-screen bg-background'>
      <MobileHeader title='Check-in' showBack />

      <div className='p-4'>
        {status === 'idle' && (
          <>
            <div className='text-center mb-4'>
              <h2 className='text-lg font-semibold mb-1'>Event Check-in</h2>
              <p className='text-sm text-muted-foreground'>
                Scan the event QR code or enter the code manually
              </p>
            </div>

            <QRScanner onScan={handleScan} onError={handleScanError} />
          </>
        )}

        {status === 'loading' && (
          <Card>
            <CardContent className='flex flex-col items-center justify-center py-16'>
              <div className='h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4' />
              <p className='text-sm text-muted-foreground'>Checking in...</p>
            </CardContent>
          </Card>
        )}

        {status === 'success' && result && (
          <Card className='border-green-500/20 bg-green-50 dark:bg-green-950/20'>
            <CardContent className='flex flex-col items-center py-8'>
              <div className='h-16 w-16 rounded-full bg-green-500 flex items-center justify-center mb-4'>
                <CheckCircle2 className='h-8 w-8 text-white' />
              </div>

              <h2 className='text-xl font-bold text-green-700 dark:text-green-400 mb-2'>
                Check-in Successful!
              </h2>

              <p className='text-sm text-muted-foreground mb-6'>
                {result.message}
              </p>

              <Card className='w-full'>
                <CardContent className='p-4 space-y-3'>
                  <div className='flex items-center gap-3'>
                    <Calendar className='h-5 w-5 text-muted-foreground' />
                    <div>
                      <p className='text-sm font-medium'>{result.eventTitle}</p>
                      <p className='text-xs text-muted-foreground'>Event</p>
                    </div>
                  </div>

                  {result.venue && (
                    <div className='flex items-center gap-3'>
                      <MapPin className='h-5 w-5 text-muted-foreground' />
                      <div>
                        <p className='text-sm font-medium'>{result.venue}</p>
                        <p className='text-xs text-muted-foreground'>Venue</p>
                      </div>
                    </div>
                  )}

                  <div className='flex items-center gap-3'>
                    <Clock className='h-5 w-5 text-muted-foreground' />
                    <div>
                      <p className='text-sm font-medium'>{result.checkInTime}</p>
                      <p className='text-xs text-muted-foreground'>Check-in Time</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className='flex gap-2 mt-6 w-full'>
                <Button variant='outline' className='flex-1' onClick={resetScanner}>
                  Scan Another
                </Button>
                <Button className='flex-1' onClick={() => router.push('/m/events')}>
                  View Events
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {status === 'error' && (
          <Card className='border-destructive/20 bg-destructive/5'>
            <CardContent className='flex flex-col items-center py-8'>
              <div className='h-16 w-16 rounded-full bg-destructive flex items-center justify-center mb-4'>
                <XCircle className='h-8 w-8 text-white' />
              </div>

              <h2 className='text-xl font-bold text-destructive mb-2'>
                Check-in Failed
              </h2>

              <p className='text-sm text-muted-foreground text-center mb-6'>
                {error || 'Unable to complete check-in. Please try again.'}
              </p>

              <Button onClick={resetScanner} className='w-full'>
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
