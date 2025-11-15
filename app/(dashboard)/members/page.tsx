/**
 * Members List Page - Redirects to Table View
 *
 * Default members page redirects to the table view.
 */

import { redirect } from 'next/navigation'

export default function MembersPage() {
  redirect('/members/table')
}
