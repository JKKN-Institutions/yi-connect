/**
 * Add Sub-Chapter Members Page (server shell)
 *
 * Resolves the user's sub_chapter_id server-side and passes it
 * to the client form. Replaces the legacy chapter-lead cookie flow.
 */

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { requireRole } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AddMembersForm } from './add-members-form'

export const metadata = {
  title: 'Add Sub-Chapter Members | Yi Connect',
  description: 'Add new students to your sub-chapter',
}

async function getSubChapterIdForUser(userId: string): Promise<string | null> {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .schema('yi_connect')
    .from('sub_chapter_leads')
    .select('sub_chapter_id')
    .eq('member_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  return data?.sub_chapter_id ?? null
}

export default async function AddSubChapterMembersPage() {
  const { user } = await requireRole(['Sub-Chapter Lead', 'Super Admin', 'National Admin'])
  const subChapterId = await getSubChapterIdForUser(user.id)

  if (!subChapterId) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            No active sub-chapter is linked to your account. Ask your Chapter
            Chair to assign you as a Sub-Chapter Lead first.
          </p>
          <Button asChild className="mt-4">
            <Link href="/sub-chapter">Back to Sub-Chapter Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return <AddMembersForm subChapterId={subChapterId} />
}
