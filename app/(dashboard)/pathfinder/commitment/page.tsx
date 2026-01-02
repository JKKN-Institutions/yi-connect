/**
 * Commitment Card Page
 *
 * Sign your personal commitment card for Pathfinder.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, FileSignature } from 'lucide-react'
import { requireRole, getCurrentUser } from '@/lib/auth'
import { getCurrentFiscalYear, getCommitmentCardByMember } from '@/lib/data/aaa'
import { getMyCommitmentCard } from '@/app/actions/aaa'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CommitmentCardForm } from '@/components/pathfinder/commitment-card-form'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Commitment Card',
  description: 'Sign your Pathfinder commitment card',
}

export default async function CommitmentCardPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'EC Member'])

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/pathfinder">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-100 rounded-full">
            <FileSignature className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Commitment Card</h1>
            <p className="text-muted-foreground">
              Sign your personal commitments for Pathfinder {getCurrentFiscalYear()}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <Suspense fallback={<FormSkeleton />}>
        <CommitmentContent />
      </Suspense>
    </div>
  )
}

async function CommitmentContent() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  // Get user's member profile
  const { data: member } = await supabase
    .from('members')
    .select('id, full_name, chapter_id')
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          You need to be a member to sign a commitment card.
        </p>
      </div>
    )
  }

  if (!member.chapter_id) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          You need to be associated with a chapter to sign a commitment card.
        </p>
      </div>
    )
  }

  const fiscalYear = getCurrentFiscalYear()

  // Get existing commitment card
  const existingCard = await getCommitmentCardByMember(member.id, fiscalYear)

  // Get user's AAA plan if they're an EC Chair
  const { data: aaaPlan } = await supabase
    .from('aaa_plans')
    .select('id')
    .eq('created_by', member.id)
    .eq('fiscal_year', fiscalYear)
    .single()

  return (
    <CommitmentCardForm
      memberId={member.id}
      memberName={member.full_name}
      chapterId={member.chapter_id}
      pathfinderYear={fiscalYear}
      aaaPlanId={aaaPlan?.id}
      existingCard={existingCard || undefined}
    />
  )
}

function FormSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[250px] rounded-lg" />
      <Skeleton className="h-[400px] rounded-lg" />
      <Skeleton className="h-[200px] rounded-lg" />
    </div>
  )
}
