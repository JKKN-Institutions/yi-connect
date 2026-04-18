/**
 * New Industrial Visit Page
 *
 * Chair / Co-Chair / Executive Member entry point for creating a new IV.
 * Industrial Visits are stored in the shared `events` table with
 * `category = 'industrial_visit'`, so this page forwards into the standard
 * event-creation flow with the category pre-selected.
 *
 * This page exists to prevent the "Something went wrong" error that happened
 * when users clicked "Create IV" links targeting `/industrial-visits/new`
 * (which previously had no route file).
 */

import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'

export const metadata = {
  title: 'Create Industrial Visit | Yi Connect',
  description: 'Create a new industrial visit for your chapter',
}

export default async function NewIndustrialVisitPage() {
  // Only chapter leadership can create IVs
  await requireRole([
    'Super Admin',
    'National Admin',
    'Chair',
    'Co-Chair',
    'Executive Member',
  ])

  // Forward to the unified event-creation form with the IV category
  // pre-selected. Keeps a single source of truth for event creation.
  redirect('/events/new?category=industrial_visit')
}
