'use client';

/**
 * QRPosterCard — full-width kiosk-size QR for late-comer self check-in.
 * Renders the same check-in URL that <EventQRCode> uses so mobile cameras
 * redirect to `/events/[id]/checkin?qr=true`.
 */

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode } from 'lucide-react';

interface QRPosterCardProps {
  eventId: string;
}

export function QRPosterCard({ eventId }: QRPosterCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (typeof window === 'undefined') return;
    let cancelled = false;

    const url = `${window.location.origin}/events/${eventId}/checkin?qr=true`;

    QRCode.toCanvas(canvasRef.current, url, {
      width: 220,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        /* ignore */
      });

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return (
    <div className='flex h-full flex-col items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur md:p-6'>
      <div className='flex items-center gap-2 self-stretch text-orange-300/80'>
        <QrCode className='h-4 w-4 md:h-5 md:w-5' />
        <p className='text-xs font-semibold uppercase tracking-[0.3em] md:text-sm'>
          Scan to check in
        </p>
      </div>

      <div className='relative rounded-2xl bg-white p-3 shadow-lg'>
        <canvas
          ref={canvasRef}
          className='h-[160px] w-[160px] md:h-[220px] md:w-[220px]'
          aria-label='Event check-in QR code'
        />
        {!ready && (
          <div className='absolute inset-0 flex items-center justify-center rounded-2xl bg-white text-slate-400'>
            <QrCode className='h-8 w-8 animate-pulse' />
          </div>
        )}
      </div>

      <p className='text-center text-xs text-slate-300 md:text-sm'>
        Point your camera here
      </p>
    </div>
  );
}
