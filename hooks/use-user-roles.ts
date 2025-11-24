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
}

export function useUserRoles() {
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchRoles() {
      try {
        const supabase = createBrowserSupabaseClient();

        // Get current user
        const {
          data: { user },
          error: userError
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) {
          setRoles([]);
          setLoading(false);
          return;
        }

        // Fetch user roles using the secure RPC function
        const { data: userRoles, error: rolesError } = await supabase.rpc(
          'get_user_roles',
          {
            p_user_id: user.id
          }
        );

        if (rolesError) throw rolesError;

        const roleNames =
          userRoles?.map((ur: UserRole) => ur.role_name) || [];
        setRoles(roleNames);
      } catch (err) {
        console.error('Error fetching user roles:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchRoles();
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
