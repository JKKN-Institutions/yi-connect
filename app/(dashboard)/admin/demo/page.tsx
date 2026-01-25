/**
 * Admin Demo Page
 *
 * Page for managing demo data in the Yi Connect demo environment.
 * Restricted to Super Admin and National Admin only.
 */

import { requireRole } from '@/lib/auth'
import { DemoAdminClient } from './demo-client'

export default async function DemoAdminPage() {
  // SECURITY: Require Super Admin or National Admin role
  // Demo seeding functions should not be accessible to regular users
  await requireRole(['Super Admin', 'National Admin'])

  return <DemoAdminClient />
}
