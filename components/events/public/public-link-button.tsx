'use client';

/**
 * PublicLinkButton
 *
 * Small copy-to-clipboard button that surfaces the public `/e/[slug]`
 * URL for a published event. Rendered on the authenticated event detail
 * page alongside the existing Share / QR buttons.
 *
 * Hidden by default when `publicSlug` is null (event not yet published).
 */

import { useState } from 'react';
import { Copy, Check, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

interface PublicLinkButtonProps {
  publicSlug: string | null | undefined;
  size?: 'sm' | 'default' | 'lg';
  variant?:
    | 'default'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link'
    | 'destructive';
}

export function PublicLinkButton({
  publicSlug,
  size = 'sm',
  variant = 'outline',
}: PublicLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  if (!publicSlug) return null;

  const baseUrl =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || '';
  const url = `${baseUrl}/e/${publicSlug}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Public link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select / prompt. For most modern browsers clipboard will just work.
      toast.error('Could not copy — please copy manually');
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleCopy}
      className='shadow-sm'
      title={url}
    >
      {copied ? (
        <Check className='mr-2 h-4 w-4 text-green-600' />
      ) : (
        <Link2 className='mr-2 h-4 w-4' />
      )}
      {copied ? 'Copied' : 'Public link'}
    </Button>
  );
}
