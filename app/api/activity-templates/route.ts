/**
 * Activity Templates API
 * GET - Fetch templates with optional filters
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const classification = searchParams.get('classification')
    const verticalId = searchParams.get('vertical_id')
    const search = searchParams.get('search')

    // Build query
    let query = supabase
      .from('activity_templates')
      .select(
        `
        *,
        vertical:verticals(id, name, color)
      `
      )
      .eq('is_active', true)
      .order('usage_count', { ascending: false })
      .order('name', { ascending: true })

    // Apply filters
    if (classification && classification !== 'all') {
      query = query.eq('default_aaa_classification', classification)
    }

    if (verticalId && verticalId !== 'all') {
      query = query.eq('vertical_id', verticalId)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      // Handle case where table doesn't exist yet
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Activity templates table not found')
        return NextResponse.json({ templates: [], message: 'Templates not yet configured' })
      }
      console.error('Error fetching templates:', error)
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
    }

    return NextResponse.json({ templates: data || [] })
  } catch (err) {
    console.error('Unexpected error in activity-templates API:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
