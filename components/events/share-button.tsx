'use client';

import { useState } from 'react';
import { Share2, Copy, Check, Facebook, Twitter, Mail, Download, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';

interface ShareButtonProps {
  eventId: string;
  eventTitle: string;
  eventDescription?: string;
  eventDate?: string;
  eventTime?: string;
  eventVenue?: string;
  eventImageUrl?: string;
}

export function ShareButton({
  eventId,
  eventTitle,
  eventDescription,
  eventDate,
  eventTime,
  eventVenue,
  eventImageUrl,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const eventUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/events/${eventId}`
    : '';

  // Format WhatsApp message with event details
  const formatWhatsAppMessage = () => {
    let message = `🎉 *${eventTitle}*\n\n`;

    if (eventDescription) {
      // Truncate description to first 200 chars
      const shortDesc = eventDescription.length > 200
        ? eventDescription.substring(0, 200) + '...'
        : eventDescription;
      message += `${shortDesc}\n\n`;
    }

    if (eventDate) {
      message += `📅 *Date:* ${eventDate}\n`;
    }

    if (eventTime) {
      message += `⏰ *Time:* ${eventTime}\n`;
    }

    if (eventVenue) {
      message += `📍 *Venue:* ${eventVenue}\n`;
    }

    message += `\n🔗 *Register Now:*\n${eventUrl}`;

    return message;
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(eventUrl);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const handleCopyFullDetails = async () => {
    try {
      const message = formatWhatsAppMessage().replace(/\*/g, ''); // Remove markdown
      await navigator.clipboard.writeText(message);
      toast.success('Event details copied!');
    } catch (error) {
      toast.error('Failed to copy details');
    }
  };

  // Native share with image (if supported)
  const handleNativeShare = async () => {
    if (!navigator.share) {
      toast.error('Native sharing not supported on this device');
      return;
    }

    try {
      const shareData: ShareData = {
        title: eventTitle,
        text: formatWhatsAppMessage().replace(/\*/g, ''),
        url: eventUrl,
      };

      // Try to share with image if available
      if (eventImageUrl && navigator.canShare) {
        try {
          const response = await fetch(eventImageUrl);
          const blob = await response.blob();
          const file = new File([blob], 'event-poster.jpg', { type: blob.type });

          if (navigator.canShare({ files: [file] })) {
            shareData.files = [file];
          }
        } catch (e) {
          console.log('Could not fetch image for sharing:', e);
        }
      }

      await navigator.share(shareData);
      toast.success('Shared successfully!');
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        toast.error('Failed to share');
      }
    }
  };

  const handleShare = (platform: string) => {
    const message = formatWhatsAppMessage();
    const encodedMessage = encodeURIComponent(message);
    const encodedTitle = encodeURIComponent(eventTitle);
    const encodedUrl = encodeURIComponent(eventUrl);

    let shareUrl = '';

    switch (platform) {
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedTitle}`;
        break;
      case 'twitter':
        // Twitter has character limits, so use shorter message
        const twitterMessage = `🎉 ${eventTitle}${eventDate ? `\n📅 ${eventDate}` : ''}\n\n🔗 ${eventUrl}`;
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterMessage)}`;
        break;
      case 'email':
        const emailBody = formatWhatsAppMessage().replace(/\*/g, '').replace(/\n/g, '%0D%0A');
        shareUrl = `mailto:?subject=${encodedTitle}&body=${emailBody}`;
        break;
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodedMessage}`;
        break;
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
    }
  };

  // Download poster image
  const handleDownloadPoster = async () => {
    if (!eventImageUrl) {
      toast.error('No poster image available');
      return;
    }

    try {
      toast.loading('Downloading poster...', { id: 'download-poster' });
      const response = await fetch(eventImageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${eventTitle.replace(/[^a-z0-9]/gi, '_')}_poster.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Poster downloaded!', { id: 'download-poster' });
    } catch (error) {
      toast.error('Failed to download poster', { id: 'download-poster' });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='outline' size='icon' className='shadow-sm'>
          <Share2 className='h-4 w-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-56'>
        <DropdownMenuLabel>Share Event</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Native Share (Mobile-friendly with image) */}
        {typeof window !== 'undefined' && 'share' in navigator && (
          <DropdownMenuItem onClick={handleNativeShare} className='text-primary'>
            <Smartphone className='mr-2 h-4 w-4' />
            Share with Image
          </DropdownMenuItem>
        )}

        {/* WhatsApp */}
        <DropdownMenuItem onClick={() => handleShare('whatsapp')}>
          <svg className='mr-2 h-4 w-4 text-green-600' fill='currentColor' viewBox='0 0 24 24'>
            <path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z'/>
          </svg>
          WhatsApp
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Copy Options */}
        <DropdownMenuItem onClick={handleCopyLink}>
          {copied ? (
            <Check className='mr-2 h-4 w-4 text-green-600' />
          ) : (
            <Copy className='mr-2 h-4 w-4' />
          )}
          Copy Link
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleCopyFullDetails}>
          <Copy className='mr-2 h-4 w-4' />
          Copy Full Details
        </DropdownMenuItem>

        {/* Download Poster */}
        {eventImageUrl && (
          <DropdownMenuItem onClick={handleDownloadPoster}>
            <Download className='mr-2 h-4 w-4' />
            Download Poster
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {/* Other Platforms */}
        <DropdownMenuItem onClick={() => handleShare('facebook')}>
          <Facebook className='mr-2 h-4 w-4 text-blue-600' />
          Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleShare('twitter')}>
          <Twitter className='mr-2 h-4 w-4 text-sky-500' />
          Twitter
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleShare('email')}>
          <Mail className='mr-2 h-4 w-4 text-orange-500' />
          Email
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
