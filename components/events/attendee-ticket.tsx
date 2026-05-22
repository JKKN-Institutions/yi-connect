'use client';

/**
 * AttendeeTicket — member-facing QR ticket for an event RSVP.
 *
 * Renders a card with the attendee's personal QR code. The QR encodes a
 * URL to the Chair's scanner page with an opaque 128-bit ticket_token.
 * Chairs scan this to mark the attendee checked in via
 * `checkInByTicketToken()`.
 *
 * Usage (wiring — Agent A owns events/[id]/page.tsx):
 *   import { AttendeeTicket } from '@/components/events/attendee-ticket';
 *   <AttendeeTicket
 *     rsvpId={rsvp.id}
 *     eventId={event.id}
 *     ticketToken={rsvp.ticket_token}
 *     eventTitle={event.title}
 *     eventDate={event.start_date}
 *     memberName={profile.full_name}
 *   />
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import { Download, Printer, Ticket, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import toast from 'react-hot-toast';

interface AttendeeTicketProps {
  rsvpId: string;
  eventId: string;
  ticketToken: string;
  eventTitle: string;
  eventDate: string; // ISO
  memberName: string;
  className?: string;
}

export function AttendeeTicket({
  rsvpId,
  eventId,
  ticketToken,
  eventTitle,
  eventDate,
  memberName,
  className
}: AttendeeTicketProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [scanUrl, setScanUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(true);

  // Build scan URL client-side (respects deployment origin)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const origin =
      process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.length > 0
        ? process.env.NEXT_PUBLIC_APP_URL
        : window.location.origin;
    setScanUrl(`${origin}/events/${eventId}/checkin/scan?t=${ticketToken}`);
  }, [eventId, ticketToken]);

  const generateQR = useCallback(async () => {
    if (!canvasRef.current || !scanUrl) return;
    setIsGenerating(true);
    try {
      await QRCode.toCanvas(canvasRef.current, scanUrl, {
        width: 240,
        margin: 2,
        color: { dark: '#0b1220', light: '#FFFFFF' }
      });
      const dataUrl = await QRCode.toDataURL(scanUrl, { width: 800, margin: 2 });
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error('Ticket QR generation failed:', err);
      toast.error('Could not generate ticket QR');
    } finally {
      setIsGenerating(false);
    }
  }, [scanUrl]);

  useEffect(() => {
    if (scanUrl) {
      const t = setTimeout(() => generateQR(), 80);
      return () => clearTimeout(t);
    }
  }, [scanUrl, generateQR]);

  const handleDownload = () => {
    if (!qrDataUrl) {
      toast.error('QR not ready yet');
      return;
    }
    const link = document.createElement('a');
    const safeTitle = eventTitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    link.download = `ticket-${safeTitle}-${rsvpId.slice(0, 8)}.png`;
    link.href = qrDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Ticket downloaded');
  };

  const handlePrint = () => {
    if (!qrDataUrl) {
      toast.error('QR not ready yet');
      return;
    }
    const w = window.open('', '_blank');
    if (!w) {
      toast.error('Allow popups to print your ticket');
      return;
    }
    const prettyDate = new Date(eventDate).toLocaleString('en-IN', {
      dateStyle: 'full',
      timeStyle: 'short'
    });
    w.document.write(`<!DOCTYPE html><html><head><title>${eventTitle} — Ticket</title>
      <style>
        body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5;padding:24px}
        .card{background:#fff;border-radius:16px;padding:32px;max-width:420px;text-align:center;box-shadow:0 4px 16px rgba(0,0,0,.08)}
        .badge{display:inline-block;background:#1e40af;color:#fff;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;margin-bottom:16px}
        h1{font-size:22px;margin:0 0 8px;color:#0f172a}
        .date{font-size:14px;color:#475569;margin-bottom:24px}
        img{max-width:260px;height:auto;padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#fff}
        .name{margin-top:20px;font-size:18px;font-weight:600;color:#0f172a}
        .note{font-size:12px;color:#64748b;margin-top:8px}
        @media print{body{background:#fff;padding:0}.card{box-shadow:none}}
      </style></head><body>
      <div class="card">
        <div class="badge">Yi Connect Ticket</div>
        <h1>${eventTitle}</h1>
        <div class="date">${prettyDate}</div>
        <img src="${qrDataUrl}" alt="Ticket QR" />
        <div class="name">${memberName}</div>
        <div class="note">Show this QR at the door</div>
      </div></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  const prettyDate = new Date(eventDate).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  return (
    <Card className={className}>
      <CardContent className='flex flex-col items-center gap-4 p-6'>
        <div className='flex items-center gap-2 self-start'>
          <Ticket className='h-5 w-5 text-primary' />
          <span className='text-sm font-semibold uppercase tracking-wider text-primary'>
            Your ticket
          </span>
        </div>

        <div className='text-center'>
          <h3 className='text-lg font-semibold leading-tight line-clamp-2'>{eventTitle}</h3>
          <div className='mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground'>
            <CalendarDays className='h-4 w-4' />
            <span>{prettyDate}</span>
          </div>
        </div>

        <div className='rounded-xl border-2 border-border bg-white p-3 shadow-sm'>
          {isGenerating ? (
            <div className='flex h-[240px] w-[240px] items-center justify-center'>
              <div className='h-8 w-8 animate-spin rounded-full border-b-2 border-primary' />
            </div>
          ) : (
            <canvas ref={canvasRef} className='h-[240px] w-[240px]' />
          )}
        </div>

        <div className='text-center'>
          <div className='text-base font-semibold'>{memberName}</div>
          <div className='text-xs text-muted-foreground'>Show this QR at the door</div>
        </div>

        <div className='flex w-full gap-2'>
          <Button
            variant='outline'
            className='flex-1'
            onClick={handlePrint}
            disabled={!qrDataUrl || isGenerating}
          >
            <Printer className='mr-2 h-4 w-4' />
            Print
          </Button>
          <Button
            className='flex-1'
            onClick={handleDownload}
            disabled={!qrDataUrl || isGenerating}
          >
            <Download className='mr-2 h-4 w-4' />
            Download
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
