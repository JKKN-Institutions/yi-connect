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
        const sessionPromise = supabase.auth.getSession();
        const {
          data: { session },
          error: sessionError
        } = await withTimeout(sessionPromise, 5000, 'getSession');

        if (sessionError) {
          throw sessionError;
        }

        if (!session?.user) {
          if (isMounted) {
            setRoles([]);
            setLoading(false);
          }
          return;
        }

        // Fetch user roles with timeout
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

        if (rolesError) {
          throw rolesError;
        }

        const roleNames = userRoles?.map((ur: UserRole) => ur.role_name) || [];

        if (isMounted) {
          setRoles(roleNames);
        }
      } catch (err) {
        if (isMounted) {
          setError(err as Error);
          setRoles([]);
        }
      } finally {
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
