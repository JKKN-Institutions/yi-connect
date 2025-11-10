/**
 * Avatar Upload Component
 *
 * Allows users to upload a profile picture to Supabase Storage
 */

'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { uploadAvatar } from '@/app/actions/profile'
import { Camera, Loader2, Upload } from 'lucide-react'
import type { ProfileWithRole } from '@/types/profile'

interface AvatarUploadProps {
  profile: ProfileWithRole
}

export function AvatarUpload({ profile }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const initials = profile.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Please upload a JPEG, PNG, or WebP image.')
      return
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      setError('File size too large. Maximum size is 5MB.')
      return
    }

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string)
    }
    reader.readAsDataURL(file)

    // Clear errors
    setError(null)
    setSuccess(null)
  }

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0]
    if (!file) {
      setError('Please select a file first')
      return
    }

    setUploading(true)
    setError(null)
    setSuccess(null)

    try {
      const formData = new FormData()
      formData.append('avatar', file)

      const result = await uploadAvatar(formData)

      if (result.success) {
        setSuccess('Avatar uploaded successfully!')
        setPreviewUrl(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        // Refresh the page to show new avatar
        router.refresh()
      } else {
        setError(result.message || 'Failed to upload avatar')
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Upload error:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Picture</CardTitle>
        <CardDescription>
          Upload a profile picture. Recommended size: 400x400px. Max size: 5MB.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current/Preview Avatar */}
        <div className="flex justify-center">
          <div className="relative">
            <Avatar className="h-32 w-32">
              <AvatarImage
                src={previewUrl || profile.avatar_url || undefined}
                alt={profile.full_name}
              />
              <AvatarFallback className="bg-primary text-primary-foreground text-4xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute bottom-0 right-0 h-10 w-10 rounded-full shadow-lg"
              onClick={handleButtonClick}
              disabled={uploading}
            >
              <Camera className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />

        {/* Error Message */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success Message */}
        {success && (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Upload Button (shown when file is selected) */}
        {previewUrl && (
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="flex-1"
            >
              {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {uploading ? 'Uploading...' : 'Upload Photo'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPreviewUrl(null)
                if (fileInputRef.current) {
                  fileInputRef.current.value = ''
                }
              }}
              disabled={uploading}
            >
              Cancel
            </Button>
          </div>
        )}

        {/* Choose File Button (shown when no file is selected) */}
        {!previewUrl && (
          <Button
            type="button"
            variant="outline"
            onClick={handleButtonClick}
            disabled={uploading}
            className="w-full"
          >
            <Upload className="mr-2 h-4 w-4" />
            Choose Photo
          </Button>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Accepted formats: JPEG, PNG, WebP
        </p>
      </CardContent>
    </Card>
  )
}
