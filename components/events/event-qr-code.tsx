'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import { Download, QrCode, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import toast from 'react-hot-toast';

interface EventQRCodeProps {
  eventId: string;
  eventTitle: string;
  trigger?: React.ReactNode;
}

export function EventQRCode({ eventId, eventTitle, trigger }: EventQRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [checkInUrl, setCheckInUrl] = useState<string>('');

  // Set check-in URL on client side only
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCheckInUrl(`${window.location.origin}/events/${eventId}/checkin?qr=true`);
    }
  }, [eventId]);

  const generateQRCode = useCallback(async () => {
    if (!canvasRef.current || !checkInUrl) return;

    setIsGenerating(true);
    try {
      // Clear the canvas first
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }

      // Generate QR code on canvas
      await QRCode.toCanvas(canvasRef.current, checkInUrl, {
        width: 250,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      // Also generate data URL for download (higher resolution)
      const dataUrl = await QRCode.toDataURL(checkInUrl, {
        width: 600,
        margin: 2,
      });
      setQrDataUrl(dataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error('Failed to generate QR code');
    } finally {
      setIsGenerating(false);
    }
  }, [checkInUrl]);

  // Generate QR code when dialog opens and URL is ready
  useEffect(() => {
    if (isOpen && checkInUrl) {
      // Small delay to ensure canvas is mounted
      const timer = setTimeout(() => {
        generateQRCode();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, checkInUrl, generateQRCode]);

  const handleDownload = () => {
    if (!qrDataUrl) {
      toast.error('QR code not ready yet');
      return;
    }

    const link = document.createElement('a');
    link.download = `${eventTitle.replace(/\s+/g, '-')}-qr-code.png`;
    link.href = qrDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('QR code downloaded!');
  };

  const handlePrint = () => {
    if (!qrDataUrl) {
      toast.error('QR code not ready yet');
      return;
    }

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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant='outline' size='icon'>
            <QrCode className='h-4 w-4' />
            <span className='sr-only'>QR Code</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className='w-[95vw] max-w-[400px] sm:max-w-[425px] max-h-[90vh] p-0 flex flex-col'>
        <DialogHeader className='space-y-1 p-4 sm:p-6 pb-0 sm:pb-0 shrink-0'>
          <DialogTitle className='text-lg sm:text-xl'>Event Check-in QR Code</DialogTitle>
          <DialogDescription className='text-sm'>
            Scan this QR code to check in to the event
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-col items-center gap-4 p-4 sm:p-6 pt-4 overflow-y-auto'>
          {/* Event Title */}
          <div className='text-center'>
            <h3 className='font-semibold text-base sm:text-lg line-clamp-2'>{eventTitle}</h3>
            <p className='text-xs sm:text-sm text-muted-foreground mt-1'>
              Point your camera at the QR code
            </p>
          </div>

          {/* QR Code Canvas */}
          <div className='p-3 sm:p-4 bg-white rounded-lg border-2 border-border shadow-sm'>
            {isGenerating ? (
              <div className='w-[200px] h-[200px] sm:w-[250px] sm:h-[250px] flex items-center justify-center'>
                <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                className='w-[200px] h-[200px] sm:w-[250px] sm:h-[250px]'
              />
            )}
          </div>

          {/* Check-in URL */}
          <div className='w-full px-2'>
            <p className='text-[10px] sm:text-xs text-muted-foreground text-center break-all bg-muted p-2 rounded'>
              {checkInUrl || 'Loading...'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className='flex flex-col sm:flex-row gap-2 w-full'>
            <Button
              variant='outline'
              className='flex-1 h-10'
              onClick={handlePrint}
              disabled={!qrDataUrl || isGenerating}
            >
              <Printer className='mr-2 h-4 w-4' />
              Print
            </Button>
            <Button
              variant='default'
              className='flex-1 h-10'
              onClick={handleDownload}
              disabled={!qrDataUrl || isGenerating}
            >
              <Download className='mr-2 h-4 w-4' />
              Download
            </Button>
          </div>

          {/* Instructions */}
          <div className='w-full p-3 bg-muted/50 rounded-lg border'>
            <h4 className='text-xs sm:text-sm font-medium mb-2'>How to use:</h4>
            <ol className='text-[10px] sm:text-xs text-muted-foreground space-y-1 list-decimal list-inside'>
              <li>Download or print this QR code</li>
              <li>Display it at the event entrance</li>
              <li>Attendees scan it with their phones</li>
              <li>They&apos;ll be redirected to check-in</li>
            </ol>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
