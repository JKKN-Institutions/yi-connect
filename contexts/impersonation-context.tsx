'use client'

/**
 * Impersonation Context
 *
 * Provides impersonation state and actions to client components.
 * Syncs with server state via polling when active.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import {
  startImpersonation as startImpersonationAction,
  endImpersonation as endImpersonationAction,
  getImpersonationSession,
} from '@/app/actions/impersonation'
import type {
  ImpersonationContextValue,
  ImpersonationState,
  ActiveImpersonationSession,
  ImpersonationTimeout,
} from '@/types/impersonation'
import { useRouter } from 'next/navigation'

// Default state
const defaultState: ImpersonationState = {
  isImpersonating: false,
  session: null,
  adminUserId: null,
}

// Create context
const ImpersonationContext = createContext<ImpersonationContextValue | null>(null)

interface ImpersonationProviderProps {
  children: ReactNode
  initialSession?: ActiveImpersonationSession | null
  adminUserId?: string | null
}

export function ImpersonationProvider({
  children,
  initialSession = null,
  adminUserId = null,
}: ImpersonationProviderProps) {
  const router = useRouter()
  const [state, setState] = useState<ImpersonationState>({
    isImpersonating: !!initialSession,
    session: initialSession,
    adminUserId,
  })

  // Refresh session state from server
  const refreshSession = useCallback(async () => {
    try {
      const sessionData = await getImpersonationSession()

      if (sessionData) {
        // Fetch full session details if we have a cookie
        // For now, just update from cookie data
        setState((prev) => ({
          ...prev,
          isImpersonating: true,
          session: prev.session, // Keep existing session data
        }))
      } else {
        setState((prev) => ({
          ...prev,
          isImpersonating: false,
          session: null,
        }))
      }
    } catch (error) {
      console.error('Failed to refresh impersonation session:', error)
    }
  }, [])

  // Poll for session updates when impersonating
  useEffect(() => {
    if (!state.isImpersonating) return

    // Update remaining time every minute
    const interval = setInterval(() => {
      if (state.session) {
        const remaining = state.session.remaining_minutes - 1

        if (remaining <= 0) {
          // Session expired
          setState((prev) => ({
            ...prev,
            isImpersonating: false,
            session: null,
          }))
          router.refresh()
        } else {
          setState((prev) => ({
            ...prev,
            session: prev.session
              ? { ...prev.session, remaining_minutes: remaining }
              : null,
          }))
        }
      }
    }, 60000) // Every minute

    return () => clearInterval(interval)
  }, [state.isImpersonating, state.session, router])

  // Start impersonation
  const startImpersonation = useCallback(
    async (
      targetUserId: string,
      reason?: string,
      timeoutMinutes: ImpersonationTimeout = 30
    ): Promise<boolean> => {
      const result = await startImpersonationAction(targetUserId, reason, timeoutMinutes)

      if (result.success) {
        // Refresh to get the full session data
        router.refresh()
        return true
      }

      return false
    },
    [router]
  )

  // End impersonation
  const endImpersonation = useCallback(async (): Promise<boolean> => {
    const result = await endImpersonationAction()

    if (result.success) {
      setState({
        isImpersonating: false,
        session: null,
        adminUserId: state.adminUserId,
      })
      router.refresh()
      return true
    }

    return false
  }, [router, state.adminUserId])

  const value: ImpersonationContextValue = {
    ...state,
    startImpersonation,
    endImpersonation,
    refreshSession,
  }

  return (
    <ImpersonationContext.Provider value={value}>
      {children}
    </ImpersonationContext.Provider>
  )
}

/**
 * Hook to access impersonation context
 */
export function useImpersonation(): ImpersonationContextValue {
  const context = useContext(ImpersonationContext)

  if (!context) {
    throw new Error('useImpersonation must be used within an ImpersonationProvider')
  }

  return context
}

/**
 * Hook to check if currently impersonating (safe to use outside provider)
 */
export function useIsImpersonating(): boolean {
  const context = useContext(ImpersonationContext)
  return context?.isImpersonating ?? false
}
