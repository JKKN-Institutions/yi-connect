'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

interface SponsorLogoUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
};

export function SponsorLogoUpload({
  value,
  onChange,
  disabled = false,
}: SponsorLogoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (accepted: File[], rejected: any[]) => {
      setError(null);
      if (rejected?.length) {
        const code = rejected[0]?.errors?.[0]?.code;
        if (code === 'file-too-large') {
          setError('File is too large. Maximum size is 2 MB.');
        } else if (code === 'file-invalid-type') {
          setError('Invalid file type. Upload PNG, JPG, WebP or SVG.');
        } else {
          setError('Could not accept this file. Please try another.');
        }
        return;
      }

      const file = accepted?.[0];
      if (!file) return;

      setUploading(true);
      try {
        const supabase = createBrowserSupabaseClient();
        const ext = file.name.split('.').pop() || 'png';
        const filePath = `${crypto.randomUUID()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from('sponsor-logos')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
          });

        if (uploadErr) {
          console.error('Logo upload error:', uploadErr);
          setError(uploadErr.message || 'Upload failed.');
          toast.error('Failed to upload logo');
          return;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from('sponsor-logos').getPublicUrl(filePath);

        onChange(publicUrl);
        toast.success('Logo uploaded');
      } catch (err: any) {
        console.error(err);
        setError(err?.message || 'Upload failed.');
        toast.error('Failed to upload logo');
      } finally {
        setUploading(false);
      }
    },
    [onChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxSize: MAX_FILE_SIZE,
    maxFiles: 1,
    disabled: disabled || uploading,
  });

  const handleClear = () => {
    onChange(null);
    setError(null);
  };

  return (
    <div className='space-y-2'>
      {value ? (
        <div className='flex items-center gap-4 rounded-md border p-3'>
          <div className='flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border bg-muted/30'>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt='Sponsor logo preview'
              className='max-h-full max-w-full object-contain'
            />
          </div>
          <div className='flex-1 min-w-0'>
            <p className='text-xs text-muted-foreground truncate'>
              Logo uploaded
            </p>
            <p className='text-xs truncate'>{value}</p>
          </div>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            onClick={handleClear}
            disabled={disabled || uploading}
            aria-label='Remove logo'
          >
            <X className='h-4 w-4' />
          </Button>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center cursor-pointer transition-colors',
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/30 hover:border-primary/50',
            (disabled || uploading) && 'cursor-not-allowed opacity-60'
          )}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <>
              <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
              <p className='text-sm text-muted-foreground'>Uploading…</p>
            </>
          ) : (
            <>
              <div className='flex h-10 w-10 items-center justify-center rounded-full bg-muted'>
                {isDragActive ? (
                  <Upload className='h-5 w-5' />
                ) : (
                  <ImageIcon className='h-5 w-5 text-muted-foreground' />
                )}
              </div>
              <p className='text-sm font-medium'>
                {isDragActive
                  ? 'Drop the logo here'
                  : 'Drop a logo here or click to browse'}
              </p>
              <p className='text-xs text-muted-foreground'>
                PNG, JPG, WebP or SVG · max 2 MB
              </p>
            </>
          )}
        </div>
      )}
      {error && (
        <p className='text-xs text-destructive' role='alert'>
          {error}
        </p>
      )}
    </div>
  );
}
