'use client'

/**
 * QR Scanner Component
 *
 * Uses html5-qrcode library to scan QR codes for event check-in.
 * Handles camera permissions and provides fallback for manual entry.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Camera,
  CameraOff,
  QrCode,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Keyboard
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { triggerHaptic } from '@/lib/mobile/haptics'
import type { QRScanResult } from '@/types/mobile'

interface QRScannerProps {
  onScan: (result: QRScanResult) => void
  onError?: (error: string) => void
  className?: string
}

export function QRScanner({ onScan, onError, className }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [manualCode, setManualCode] = useState('')

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const startScanner = useCallback(async () => {
    if (!containerRef.current) return

    try {
      setError(null)
      setIsScanning(true)

      // Initialize scanner if not already
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('qr-reader')
      }

      // Check current state
      const state = scannerRef.current.getState()
      if (state === Html5QrcodeScannerState.SCANNING) {
        return
      }

      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1
        },
        (decodedText) => {
          // Success callback
          triggerHaptic('success')
          onScan({
            success: true,
            data: decodedText,
            format: 'QR_CODE'
          })
          stopScanner()
        },
        () => {
          // Error callback (ignore scan errors)
        }
      )

      setHasPermission(true)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Camera access denied'
      setError(errorMessage)
      setHasPermission(false)
      setIsScanning(false)
      onError?.(errorMessage)
    }
  }, [onScan, onError])

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState()
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop()
        }
      } catch (err) {
        console.error('Error stopping scanner:', err)
      }
    }
    setIsScanning(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner()
      if (scannerRef.current) {
        scannerRef.current.clear()
        scannerRef.current = null
      }
    }
  }, [stopScanner])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualCode.trim()) {
      triggerHaptic('light')
      onScan({
        success: true,
        data: manualCode.trim(),
        format: 'MANUAL'
      })
      setManualCode('')
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Scanner View */}
      <Card className='overflow-hidden'>
        <CardContent className='p-0'>
          <div
            ref={containerRef}
            className='relative aspect-square bg-black'
          >
            {/* QR Reader Container */}
            <div id='qr-reader' className='w-full h-full' />

            {/* Overlay when not scanning */}
            {!isScanning && (
              <div className='absolute inset-0 flex flex-col items-center justify-center bg-muted/90'>
                {hasPermission === false ? (
                  <>
                    <CameraOff className='h-12 w-12 text-muted-foreground mb-4' />
                    <p className='text-sm text-muted-foreground text-center px-4 mb-4'>
                      Camera access is required to scan QR codes
                    </p>
                    <Button onClick={startScanner}>
                      <RefreshCw className='h-4 w-4 mr-2' />
                      Try Again
                    </Button>
                  </>
                ) : (
                  <>
                    <QrCode className='h-12 w-12 text-muted-foreground mb-4' />
                    <Button onClick={startScanner}>
                      <Camera className='h-4 w-4 mr-2' />
                      Start Scanner
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Scanning indicator */}
            {isScanning && (
              <div className='absolute inset-0 pointer-events-none'>
                <div className='absolute inset-0 flex items-center justify-center'>
                  <div className='w-64 h-64 border-2 border-primary rounded-lg animate-pulse' />
                </div>
                <div className='absolute bottom-4 left-0 right-0 text-center'>
                  <p className='text-sm text-white bg-black/50 inline-block px-3 py-1 rounded-full'>
                    Point camera at QR code
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <div className='flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm'>
          <XCircle className='h-4 w-4 shrink-0' />
          <span>{error}</span>
        </div>
      )}

      {/* Scanner Controls */}
      {isScanning && (
        <div className='flex gap-2'>
          <Button variant='outline' className='flex-1' onClick={stopScanner}>
            <CameraOff className='h-4 w-4 mr-2' />
            Stop Scanner
          </Button>
        </div>
      )}

      {/* Manual Entry Toggle */}
      <Button
        variant='ghost'
        className='w-full'
        onClick={() => setShowManualEntry(!showManualEntry)}
      >
        <Keyboard className='h-4 w-4 mr-2' />
        {showManualEntry ? 'Hide' : 'Enter code manually'}
      </Button>

      {/* Manual Entry Form */}
      {showManualEntry && (
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='text-sm'>Manual Entry</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleManualSubmit} className='flex gap-2'>
              <Input
                placeholder='Enter check-in code'
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className='flex-1'
              />
              <Button type='submit' disabled={!manualCode.trim()}>
                <CheckCircle2 className='h-4 w-4' />
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
