/**
 * Edit Member Page
 *
 * Edit existing member profile.
 */

import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { getMemberWithProfile } from '@/lib/data/members'
import { getAllChapters } from '@/lib/data/chapters'
import { MemberForm } from '@/components/members'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft } from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

// Provide placeholder ID for build-time validation with Cache Components
export async function generateStaticParams() {
  return [
    { id: '00000000-0000-0000-0000-000000000000' } // Placeholder UUID
  ];
}

// Loading skeleton
function FormSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// Form wrapper component (Server Component)
async function EditMemberForm({ memberId }: { memberId: string }) {
  // Fetch member and chapters in parallel
  const [member, chapters] = await Promise.all([
    getMemberWithProfile(memberId),
    getAllChapters(),
  ])

  if (!member) {
    notFound()
  }

  return <MemberForm member={member} chapters={chapters} />
}

// Main page component
export default async function EditMemberPage({ params }: PageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member'])

  const resolvedParams = await params

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link href={`/members/${resolvedParams.id}`}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Profile
        </Link>
      </Button>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Member Profile</h1>
        <p className="text-muted-foreground">Update member information and preferences</p>
      </div>

      {/* Form with Suspense */}
      <Suspense fallback={<FormSkeleton />}>
        <EditMemberForm memberId={resolvedParams.id} />
      </Suspense>
    </div>
  )
}

// Generate metadata
export async function generateMetadata({ params }: PageProps) {
  const resolvedParams = await params
  // TODO: Fetch member for dynamic metadata
  // const member = await getMemberWithProfile(resolvedParams.id)

  return {
    title: `Edit Member - Yi Connect`,
    description: 'Edit member profile information',
  }
}
