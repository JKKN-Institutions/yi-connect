'use client';

/**
 * MemberQR — renders the current member's permanent networking QR.
 *
 * Encodes a URL like:
 *   https://<domain>/connect?token=<profile_qr_token>[&event=<event_id>]
 *
 * Anyone who scans this URL (and is logged in) lands on the scan page and
 * can add the card-holder to their own connections list. The opt-out flag
 * (`allow_networking_qr`) lets a member disable scans entirely.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import QRCode from 'qrcode';
import { Download, Printer, QrCode, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import toast from 'react-hot-toast';
import {
  resetMyProfileQrToken,
  toggleNetworkingOptOut,
} from '@/app/actions/connections';

interface MemberQRProps {
  initialToken: string;
  initialAllow: boolean;
  memberName: string;
  eventId?: string | null;
  className?: string;
  /** When true, hides the opt-out switch + reset button (for embedding elsewhere). */
  readOnly?: boolean;
}

export function MemberQR({
  initialToken,
  initialAllow,
  memberName,
  eventId = null,
  className,
  readOnly = false,
}: MemberQRProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [token, setToken] = useState(initialToken);
  const [allow, setAllow] = useState(initialAllow);
  const [scanUrl, setScanUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Build scan URL client-side (respects deployment origin + PWA domain)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const origin =
      process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.length > 0
        ? process.env.NEXT_PUBLIC_APP_URL
        : window.location.origin;
    const params = new URLSearchParams({ token });
    if (eventId) params.set('event', eventId);
    setScanUrl(`${origin}/connect?${params.toString()}`);
  }, [token, eventId]);

  const generateQR = useCallback(async () => {
    if (!canvasRef.current || !scanUrl) return;
    setIsGenerating(true);
    try {
      await QRCode.toCanvas(canvasRef.current, scanUrl, {
        width: 240,
        margin: 2,
        color: { dark: '#0b1220', light: '#FFFFFF' },
      });
      const dataUrl = await QRCode.toDataURL(scanUrl, { width: 800, margin: 2 });
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error('Profile QR generation failed:', err);
      toast.error('Could not generate QR');
    } finally {
      setIsGenerating(false);
    }
  }, [scanUrl]);

  useEffect(() => {
    if (scanUrl) {
      const t = setTimeout(() => generateQR(), 60);
      return () => clearTimeout(t);
    }
  }, [scanUrl, generateQR]);

  const handleDownload = () => {
    if (!qrDataUrl) return toast.error('QR not ready');
    const link = document.createElement('a');
    const safeName = memberName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    link.download = `yi-connect-${safeName}.png`;
    link.href = qrDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('QR downloaded');
  };

  const handlePrint = () => {
    if (!qrDataUrl) return toast.error('QR not ready');
    const w = window.open('', '_blank');
    if (!w) return toast.error('Allow popups to print');
    w.document.write(`<!DOCTYPE html><html><head><title>${memberName} — Yi Connect QR</title>
      <style>
        body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5;padding:24px}
        .card{background:#fff;border-radius:16px;padding:32px;max-width:420px;text-align:center;box-shadow:0 4px 16px rgba(0,0,0,.08)}
        .badge{display:inline-block;background:#1e40af;color:#fff;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;margin-bottom:16px}
        h1{font-size:22px;margin:0 0 8px;color:#0f172a}
        img{max-width:260px;height:auto;padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#fff}
        .name{margin-top:20px;font-size:18px;font-weight:600;color:#0f172a}
        .note{font-size:12px;color:#64748b;margin-top:8px}
        @media print{body{background:#fff;padding:0}.card{box-shadow:none}}
      </style></head><body>
      <div class="card">
        <div class="badge">Yi Connect</div>
        <h1>${memberName}</h1>
        <img src="${qrDataUrl}" alt="Networking QR" />
        <div class="name">Scan to connect</div>
        <div class="note">Yi Connect members who scan this code will see my profile.</div>
      </div></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  const handleReset = () => {
    startTransition(async () => {
      const res = await resetMyProfileQrToken();
      if (!res.success || !res.data) {
        toast.error(res.error ?? 'Could not reset QR');
        return;
      }
      setToken(res.data.token);
      toast.success('QR token rotated. Old QRs will stop working.');
    });
  };

  const handleToggle = (next: boolean) => {
    // Optimistic
    setAllow(next);
    startTransition(async () => {
      const res = await toggleNetworkingOptOut(next);
      if (!res.success) {
        setAllow(!next);
        toast.error(res.error ?? 'Could not save preference');
        return;
      }
      toast.success(next ? 'Networking QR enabled' : 'Networking QR disabled');
    });
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <QrCode className='h-5 w-5 text-primary' />
          My Networking QR
        </CardTitle>
        <CardDescription>
          Show this at Yi events. Anyone who scans it can add you to their contacts.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        {allow ? (
          <>
            <div className='flex justify-center'>
              <div className='rounded-xl border-2 border-border bg-white p-3 shadow-sm'>
                {isGenerating ? (
                  <div className='flex h-[240px] w-[240px] items-center justify-center'>
                    <div className='h-8 w-8 animate-spin rounded-full border-b-2 border-primary' />
                  </div>
                ) : (
                  <canvas ref={canvasRef} className='h-[240px] w-[240px]' />
                )}
              </div>
            </div>
            <div className='text-center'>
              <div className='text-base font-semibold'>{memberName}</div>
            </div>
            <div className='flex gap-2'>
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
          </>
        ) : (
          <div className='rounded-lg border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground'>
            Your networking QR is disabled. Other members cannot add you until you
            re-enable it below.
          </div>
        )}

        {!readOnly && (
          <div className='space-y-4 border-t pt-4'>
            <div className='flex items-center justify-between gap-3'>
              <div className='space-y-0.5'>
                <Label htmlFor='networking-toggle' className='text-sm font-medium'>
                  Allow others to scan my QR
                </Label>
                <p className='text-xs text-muted-foreground'>
                  Turn off to hide your profile from new scans.
                </p>
              </div>
              <Switch
                id='networking-toggle'
                checked={allow}
                onCheckedChange={handleToggle}
                disabled={isPending}
              />
            </div>

            <div className='flex items-center justify-between gap-3'>
              <div className='space-y-0.5'>
                <Label className='text-sm font-medium'>Reset QR token</Label>
                <p className='text-xs text-muted-foreground'>
                  Rotate the code. Any printed QR will stop working.
                </p>
              </div>
              <Button
                variant='outline'
                size='sm'
                onClick={handleReset}
                disabled={isPending}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
                Reset
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
