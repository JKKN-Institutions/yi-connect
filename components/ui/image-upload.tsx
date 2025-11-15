/**
 * Image Upload Component
 *
 * Reusable image upload component with preview
 */

'use client'

import { useState, useRef, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, X, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { uploadImage } from '@/app/actions/upload'
import { toast } from 'react-hot-toast'

interface ImageUploadProps {
  value?: string
  onChange: (url: string) => void
  onFileSelect?: (file: File) => void
  aspectRatio?: string
  maxSizeMB?: number
  label?: string
  description?: string
}

export function ImageUpload({
  value,
  onChange,
  onFileSelect,
  aspectRatio = '21/9',
  maxSizeMB = 5,
  label = 'Image',
  description = 'Upload an image or enter a URL'
}: ImageUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null)
  const [error, setError] = useState<string | null>(null)
  const [uploadMode, setUploadMode] = useState<'url' | 'file'>('file')
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Please upload a JPEG, PNG, or WebP image.')
      return
    }

    // Validate file size
    const maxSize = maxSizeMB * 1024 * 1024
    if (file.size > maxSize) {
      setError(`File size too large. Maximum size is ${maxSizeMB}MB.`)
      return
    }

    // Clear errors
    setError(null)

    // Create preview only (don't upload yet)
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result as string
      setPreviewUrl(dataUrl)
      // Store the data URL - will be uploaded when form is submitted
      onChange(dataUrl)

      if (onFileSelect) {
        onFileSelect(file)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleUrlChange = (url: string) => {
    setPreviewUrl(url)
    onChange(url)
    setError(null)
  }

  const handleRemove = () => {
    setPreviewUrl(null)
    onChange('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className='space-y-4'>
      <div className='space-y-2'>
        <Label>{label}</Label>

        {/* Mode Toggle */}
        <div className='flex gap-2 mb-2'>
          <Button
            type='button'
            variant={uploadMode === 'file' ? 'default' : 'outline'}
            size='sm'
            onClick={() => setUploadMode('file')}
          >
            Upload File
          </Button>
          <Button
            type='button'
            variant={uploadMode === 'url' ? 'default' : 'outline'}
            size='sm'
            onClick={() => setUploadMode('url')}
          >
            Enter URL
          </Button>
        </div>

        {/* Preview */}
        {previewUrl && (
          <div className='relative w-full rounded-lg border overflow-hidden' style={{ aspectRatio }}>
            <Image
              src={previewUrl}
              alt='Preview'
              fill
              className='object-cover'
            />
            <Button
              type='button'
              variant='destructive'
              size='icon'
              className='absolute top-2 right-2 h-8 w-8'
              onClick={handleRemove}
            >
              <X className='h-4 w-4' />
            </Button>
          </div>
        )}

        {/* Upload Mode */}
        {uploadMode === 'file' && !previewUrl && (
          <div className='space-y-2'>
            <input
              ref={fileInputRef}
              type='file'
              accept='image/jpeg,image/jpg,image/png,image/webp'
              onChange={handleFileSelect}
              className='hidden'
              disabled={isPending}
            />
            <Button
              type='button'
              variant='outline'
              onClick={handleButtonClick}
              className='w-full h-32 border-dashed'
            >
              <div className='flex flex-col items-center gap-2'>
                <Upload className='h-8 w-8 text-muted-foreground' />
                <div className='text-sm text-muted-foreground'>
                  Click to upload or drag and drop
                </div>
                <div className='text-xs text-muted-foreground'>
                  JPEG, PNG, WebP up to {maxSizeMB}MB
                </div>
              </div>
            </Button>
          </div>
        )}

        {/* URL Mode */}
        {uploadMode === 'url' && !previewUrl && (
          <Input
            type='url'
            placeholder='https://example.com/image.jpg'
            value={value || ''}
            onChange={(e) => handleUrlChange(e.target.value)}
          />
        )}

        {description && (
          <p className='text-xs text-muted-foreground'>{description}</p>
        )}

        {/* Error Message */}
        {error && (
          <Alert variant='destructive'>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}
