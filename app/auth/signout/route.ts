/**
 * Sign Out Route Handler
 *
 * Simple GET route to sign out the current user.
 * Useful for users without profiles who can't access the UserMenu.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const supabase = await createServerSupabaseClient();

  await supabase.auth.signOut();

  return NextResponse.redirect(new URL('/login', requestUrl.origin));
}
