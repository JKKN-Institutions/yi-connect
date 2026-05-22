/**
 * Verticals API Route
 *
 * GET /api/verticals - Returns list of verticals for the current user's chapter
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/data/auth'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    // Fetch verticals (chapter filtering handled by RLS)
    const { data, error } = await supabase
      .from('verticals')
      .select('id, name, slug, description, color, icon, is_active')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('Error fetching verticals:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error in verticals API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
