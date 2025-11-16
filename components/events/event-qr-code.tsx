'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Download, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import toast from 'react-hot-toast';

interface EventQRCodeProps {
  eventId: string;
  eventTitle: string;
  trigger?: React.ReactNode;
}

export function EventQRCode({ eventId, eventTitle, trigger }: EventQRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Generate check-in URL
  const checkInUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/events/${eventId}/checkin?qr=true`
    : '';

  const generateQRCode = async () => {
    try {
      if (!canvasRef.current) return;

      await QRCode.toCanvas(canvasRef.current, checkInUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      // Also generate data URL for download
      const dataUrl = await QRCode.toDataURL(checkInUrl, {
        width: 600,
        margin: 2,
      });
      setQrDataUrl(dataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error('Failed to generate QR code');
    }
  };

  useEffect(() => {
    if (canvasRef.current && checkInUrl) {
      generateQRCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkInUrl]);

  const handleDownload = () => {
    if (!qrDataUrl) return;

    const link = document.createElement('a');
    link.download = `${eventTitle.replace(/\s+/g, '-')}-qr-code.png`;
    link.href = qrDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('QR code downloaded!');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print QR code');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${eventTitle} - Check-in QR Code</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
            }
            .container {
              text-align: center;
              max-width: 600px;
            }
            h1 {
              font-size: 24px;
              margin-bottom: 10px;
              color: #1a1a1a;
            }
            p {
              font-size: 14px;
              color: #666;
              margin-bottom: 30px;
            }
            img {
              max-width: 100%;
              height: auto;
              border: 2px solid #e5e5e5;
              padding: 20px;
              border-radius: 8px;
            }
            .instructions {
              margin-top: 30px;
              text-align: left;
              padding: 20px;
              background: #f5f5f5;
              border-radius: 8px;
            }
            .instructions h2 {
              font-size: 18px;
              margin-bottom: 10px;
            }
            .instructions ol {
              padding-left: 20px;
            }
            .instructions li {
              margin-bottom: 8px;
            }
            @media print {
              body {
                padding: 0;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${eventTitle}</h1>
            <p>Event Check-in QR Code</p>
            <img src="${qrDataUrl}" alt="QR Code for ${eventTitle}" />
            <div class="instructions">
              <h2>Check-in Instructions:</h2>
              <ol>
                <li>Scan this QR code using any QR code scanner</li>
                <li>Or navigate to the check-in page directly</li>
                <li>Select your name from the list or enter your details</li>
                <li>Submit to complete check-in</li>
              </ol>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant='outline' size='sm'>
            <QrCode className='mr-2 h-4 w-4' />
            QR Code
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Event Check-in QR Code</DialogTitle>
          <DialogDescription>
            Scan this QR code to check in to the event quickly
          </DialogDescription>
        </DialogHeader>

        <Card>
          <CardHeader>
            <CardTitle className='text-lg'>{eventTitle}</CardTitle>
            <CardDescription>Point your camera at the QR code below</CardDescription>
          </CardHeader>
          <CardContent className='flex flex-col items-center gap-4'>
            {/* QR Code Canvas */}
            <div className='p-4 bg-white rounded-lg border'>
              <canvas ref={canvasRef} />
            </div>

            {/* Check-in URL */}
            <div className='w-full'>
              <p className='text-xs text-muted-foreground text-center break-all'>
                {checkInUrl}
              </p>
            </div>

            {/* Action Buttons */}
            <div className='flex gap-2 w-full'>
              <Button
                variant='outline'
                className='flex-1'
                onClick={handlePrint}
              >
                Print QR Code
              </Button>
              <Button
                variant='default'
                className='flex-1'
                onClick={handleDownload}
                disabled={!qrDataUrl}
              >
                <Download className='mr-2 h-4 w-4' />
                Download PNG
              </Button>
            </div>

            {/* Instructions */}
            <div className='w-full mt-2 p-3 bg-muted rounded-lg'>
              <h4 className='text-sm font-medium mb-2'>How to use:</h4>
              <ol className='text-xs text-muted-foreground space-y-1 list-decimal list-inside'>
                <li>Download or print this QR code</li>
                <li>Display it at the event entrance</li>
                <li>Attendees scan it with their phones</li>
                <li>They&apos;ll be redirected to the check-in page</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
