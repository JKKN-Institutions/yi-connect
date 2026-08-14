/**
 * Toast Hook
 * Wrapper around sonner for consistent toast notifications
 */

import { toast } from 'sonner'

export interface ToastOptions {
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
  duration?: number
}

export function useToast() {
  return {
    toast: ({ title, description, variant = 'default', duration = 3000 }: ToastOptions) => {
      const message = description || title || ''

      if (variant === 'destructive') {
        return toast.error(message, { duration })
      }

      return toast.success(message, { duration })
    },
  }
}
