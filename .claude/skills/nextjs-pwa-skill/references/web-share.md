# Web Share API Implementation

## Basic Web Share

### Share Button Component

```typescript
// components/share-button.tsx
'use client'

import { useState } from 'react'

interface ShareData {
  title?: string
  text?: string
  url?: string
  files?: File[]
}

export function ShareButton({ 
  shareData,
  children,
  fallbackComponent
}: {
  shareData: ShareData
  children?: React.ReactNode
  fallbackComponent?: React.ReactNode
}) {
  const [isSupported, setIsSupported] = useState(false)
  
  useEffect(() => {
    setIsSupported('share' in navigator)
  }, [])
  
  async function handleShare() {
    try {
      // Check if sharing files is supported
      if (shareData.files && !navigator.canShare({ files: shareData.files })) {
        // Fallback for file sharing
        await shareWithoutFiles()
        return
      }
      
      await navigator.share(shareData)
      
      // Track successful share
      trackShare('native')
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Share cancelled')
      } else {
        console.error('Share failed:', error)
        showFallbackShare()
      }
    }
  }
  
  async function shareWithoutFiles() {
    const { files, ...dataWithoutFiles } = shareData
    await navigator.share(dataWithoutFiles)
  }
  
  function showFallbackShare() {
    // Show custom share dialog
    if (fallbackComponent) {
      // Render fallback component
    }
  }
  
  if (!isSupported) {
    return fallbackComponent || <FallbackShare {...shareData} />
  }
  
  return (
    <button onClick={handleShare}>
      {children || 'Share'}
    </button>
  )
}
```

## Advanced Share Features

### Share Target Implementation

```typescript
// manifest.ts - Configure as share target
export default function manifest(): MetadataRoute.Manifest {
  return {
    // ... other manifest properties
    share_target: {
      action: '/share-target',
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        title: 'title',
        text: 'text',
        url: 'url',
        files: [
          {
            name: 'media',
            accept: ['image/*', 'video/*', 'audio/*']
          }
        ]
      }
    }
  }
}
```

### Share Target Handler

```typescript
// app/share-target/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  
  const title = formData.get('title') as string
  const text = formData.get('text') as string
  const url = formData.get('url') as string
  const files = formData.getAll('media') as File[]
  
  // Process shared content
  const sharedContent = {
    title,
    text,
    url,
    files: await processFiles(files),
    timestamp: new Date().toISOString()
  }
  
  // Store in database or session
  await storeSharedContent(sharedContent)
  
  // Redirect to appropriate page
  return NextResponse.redirect(new URL('/shared', request.url))
}

async function processFiles(files: File[]) {
  const processed = []
  
  for (const file of files) {
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    
    processed.push({
      name: file.name,
      type: file.type,
      size: file.size,
      data: base64
    })
  }
  
  return processed
}
```

## Fallback Share Options

### Custom Share Dialog

```typescript
// components/fallback-share.tsx
import { useState } from 'react'
import { 
  Twitter, 
  Facebook, 
  Linkedin, 
  Mail, 
  Copy, 
  Whatsapp,
  Telegram
} from 'lucide-react'

export function FallbackShare({ 
  title, 
  text, 
  url 
}: { 
  title?: string
  text?: string
  url?: string
}) {
  const [copied, setCopied] = useState(false)
  const shareUrl = url || window.location.href
  const shareText = text || title || ''
  
  const shareLinks = {
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
    email: `mailto:?subject=${encodeURIComponent(title || '')}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`
  }
  
  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      // Fallback for older browsers
      const input = document.createElement('input')
      input.value = shareUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
    }
  }
  
  return (
    <div className="share-dialog">
      <h3>Share</h3>
      
      <div className="share-options">
        <a 
          href={shareLinks.twitter} 
          target="_blank" 
          rel="noopener noreferrer"
          aria-label="Share on Twitter"
        >
          <Twitter />
        </a>
        
        <a 
          href={shareLinks.facebook} 
          target="_blank" 
          rel="noopener noreferrer"
          aria-label="Share on Facebook"
        >
          <Facebook />
        </a>
        
        <a 
          href={shareLinks.linkedin} 
          target="_blank" 
          rel="noopener noreferrer"
          aria-label="Share on LinkedIn"
        >
          <Linkedin />
        </a>
        
        <a 
          href={shareLinks.whatsapp} 
          target="_blank" 
          rel="noopener noreferrer"
          aria-label="Share on WhatsApp"
        >
          <Whatsapp />
        </a>
        
        <a 
          href={shareLinks.telegram} 
          target="_blank" 
          rel="noopener noreferrer"
          aria-label="Share on Telegram"
        >
          <Telegram />
        </a>
        
        <a 
          href={shareLinks.email}
          aria-label="Share via Email"
        >
          <Mail />
        </a>
        
        <button 
          onClick={copyToClipboard}
          aria-label="Copy link"
        >
          {copied ? 'Copied!' : <Copy />}
        </button>
      </div>
      
      <div className="share-url">
        <input 
          type="text" 
          value={shareUrl} 
          readOnly 
          onClick={(e) => e.currentTarget.select()}
        />
      </div>
    </div>
  )
}
```

## Share with Files

### Image Share Component

```typescript
// components/image-share.tsx
export function ImageShare({ imageSrc }: { imageSrc: string }) {
  async function shareImage() {
    try {
      // Fetch image and convert to File
      const response = await fetch(imageSrc)
      const blob = await response.blob()
      const file = new File([blob], 'image.png', { type: blob.type })
      
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Check out this image',
          files: [file]
        })
      } else {
        // Fallback to sharing URL
        await navigator.share({
          title: 'Check out this image',
          url: imageSrc
        })
      }
    } catch (error) {
      console.error('Failed to share image:', error)
    }
  }
  
  return (
    <button onClick={shareImage}>
      Share Image
    </button>
  )
}
```

### Canvas Share

```typescript
// components/canvas-share.tsx
export function CanvasShare({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement> }) {
  async function shareCanvas() {
    if (!canvasRef.current) return
    
    try {
      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvasRef.current!.toBlob((blob) => {
          resolve(blob!)
        }, 'image/png')
      })
      
      // Create file from blob
      const file = new File([blob], 'canvas-image.png', { 
        type: 'image/png' 
      })
      
      // Check if file sharing is supported
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'My Canvas Creation',
          text: 'Check out what I created!',
          files: [file]
        })
      } else {
        // Fallback: Create data URL and share as text
        const dataUrl = canvasRef.current.toDataURL('image/png')
        await navigator.share({
          title: 'My Canvas Creation',
          text: 'Check out what I created!',
          url: dataUrl
        })
      }
    } catch (error) {
      console.error('Failed to share canvas:', error)
      // Show fallback UI
    }
  }
  
  return (
    <button onClick={shareCanvas}>
      Share Canvas
    </button>
  )
}
```

## QR Code Share

```typescript
// components/qr-share.tsx
import QRCode from 'qrcode'

export function QRShare({ url }: { url: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  
  useEffect(() => {
    generateQR()
  }, [url])
  
  async function generateQR() {
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      })
      setQrDataUrl(dataUrl)
    } catch (error) {
      console.error('Failed to generate QR code:', error)
    }
  }
  
  async function shareQR() {
    if (!qrDataUrl) return
    
    try {
      // Convert data URL to blob
      const response = await fetch(qrDataUrl)
      const blob = await response.blob()
      const file = new File([blob], 'qr-code.png', { type: 'image/png' })
      
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'QR Code',
          text: `QR Code for ${url}`,
          files: [file]
        })
      }
    } catch (error) {
      console.error('Failed to share QR code:', error)
    }
  }
  
  return (
    <div className="qr-share">
      {qrDataUrl && (
        <>
          <img src={qrDataUrl} alt="QR Code" />
          <button onClick={shareQR}>Share QR Code</button>
        </>
      )}
    </div>
  )
}
```

## Analytics Integration

```typescript
// lib/share-analytics.ts
export function trackShare(method: string, content?: any) {
  // Google Analytics
  if (typeof gtag !== 'undefined') {
    gtag('event', 'share', {
      method: method,
      content_type: content?.type || 'page',
      item_id: content?.id || window.location.pathname
    })
  }
  
  // Custom analytics
  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'share',
      method,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      ...content
    })
  }).catch(console.error)
}
```

## Share Permissions

```typescript
// hooks/useSharePermission.ts
export function useSharePermission() {
  const [permission, setPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt')
  
  useEffect(() => {
    checkPermission()
  }, [])
  
  async function checkPermission() {
    if (!('permissions' in navigator)) return
    
    try {
      // Note: Web Share API doesn't require permission
      // This is for demonstration of permission pattern
      const result = await navigator.permissions.query({ 
        name: 'clipboard-write' as PermissionName 
      })
      
      setPermission(result.state)
      
      result.addEventListener('change', () => {
        setPermission(result.state)
      })
    } catch (error) {
      console.error('Permission check failed:', error)
    }
  }
  
  return permission
}
```
