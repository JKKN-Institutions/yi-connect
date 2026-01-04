/**
 * User Roles Hook
 *
 * Client-side hook to fetch and cache the current user's roles
 */

'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

export interface UserRole {
  role_name: string;
  hierarchy_level?: number; // Optional since we don't always use it
}

export function useUserRoles() {
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchRoles() {
      try {
        console.log('[useUserRoles] Starting to fetch roles...');

        // Create timeout promise wrapper
        const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> => {
          return Promise.race([
            promise,
            new Promise<T>((_, reject) =>
              setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
            )
          ]);
        };

        const supabase = createBrowserSupabaseClient();

        if (!supabase) {
          throw new Error('Failed to create Supabase client');
        }

        // Get session with timeout
        console.log('[useUserRoles] Fetching session...');
        const sessionPromise = supabase.auth.getSession();
        const {
          data: { session },
          error: sessionError
        } = await withTimeout(sessionPromise, 5000, 'getSession');

        console.log('[useUserRoles] Session fetch completed');

        if (sessionError) {
          console.error('[useUserRoles] Session error:', sessionError);
          throw sessionError;
        }

        if (!session?.user) {
          console.log('[useUserRoles] No user session found');
          if (isMounted) {
            setRoles([]);
            setLoading(false);
          }
          return;
        }

        console.log('[useUserRoles] User found:', session.user.id);

        // Fetch user roles with timeout
        console.log('[useUserRoles] Fetching roles via RPC...');
        const result = await withTimeout(
          (async () => {
            return await supabase.rpc('get_user_roles_detailed', {
              p_user_id: session.user.id
            });
          })(),
          5000,
          'get_user_roles_detailed RPC'
        );

        const { data: userRoles, error: rolesError } = result;

        console.log('[useUserRoles] RPC fetch completed');

        if (rolesError) {
          console.error('[useUserRoles] Roles error:', rolesError);
          throw rolesError;
        }

        console.log('[useUserRoles] Roles fetched:', userRoles);

        const roleNames = userRoles?.map((ur: UserRole) => ur.role_name) || [];

        console.log('[useUserRoles] Processed role names:', roleNames);

        if (isMounted) {
          setRoles(roleNames);
        }
      } catch (err) {
        console.error('[useUserRoles] Error fetching user roles:', err);
        if (isMounted) {
          setError(err as Error);
          setRoles([]);
        }
      } finally {
        console.log('[useUserRoles] Finally block - setting loading to false');
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchRoles();

    return () => {
      isMounted = false;
    };
  }, []);

  return { roles, loading, error };
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(userRoles: string[], requiredRoles: string[]): boolean {
  // Super Admin and National Admin have access to everything
  if (
    userRoles.includes('Super Admin') ||
    userRoles.includes('National Admin')
  ) {
    return true;
  }

  // Check if user has any of the required roles
  return requiredRoles.some((role) => userRoles.includes(role));
}

/**
 * Check if user has all of the specified roles
 */
export function hasAllRoles(userRoles: string[], requiredRoles: string[]): boolean {
  // Super Admin and National Admin have access to everything
  if (
    userRoles.includes('Super Admin') ||
    userRoles.includes('National Admin')
  ) {
    return true;
  }

  // Check if user has all required roles
  return requiredRoles.every((role) => userRoles.includes(role));
}
