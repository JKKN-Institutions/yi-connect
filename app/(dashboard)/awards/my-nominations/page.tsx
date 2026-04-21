import { Suspense } from 'react'
import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NominationStatusCard } from '@/components/awards'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, FileText } from 'lucide-react'

export const metadata = {
  title: 'My Nominations | Awards',
  description: 'View nominations you have submitted',
}

async function MyNominationsSection({ userId }: { userId: string }) {
  const supabase = await createServerSupabaseClient()

  const { data: nominations } = await supabase
    .from('nominations')
    .select(`
      *,
      cycle:award_cycles(*, category:award_categories(*)),
      nominee:members!nominations_nominee_id_fkey(id, full_name, avatar_url, company, designation),
      jury_scores(count),
      winner:award_winners(*)
    `)
    .eq('nominator_id', userId)
    .order('created_at', { ascending: false })

  if (!nominations || nominations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">No nominations yet</p>
          <p className="text-sm text-muted-foreground mt-2 mb-4">
            Start by nominating a deserving member for an award
          </p>
          <Button asChild>
            <Link href="/awards/nominate">
              <Plus className="mr-2 h-4 w-4" />
              Create Nomination
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {nominations.map((n: any) => (
        <NominationStatusCard key={n.id} nomination={n} />
      ))}
    </div>
  )
}

export default async function MyNominationsPage() {
  const user = await requireAuth()

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">My Nominations</h1>
          <p className="text-muted-foreground mt-2">
            Track nominations you have submitted for chapter awards
          </p>
        </div>
        <Button asChild>
          <Link href="/awards/nominate">
            <Plus className="mr-2 h-4 w-4" />
            New Nomination
          </Link>
        </Button>
      </div>
      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-[200px]" />
            <Skeleton className="h-[200px]" />
          </div>
        }
      >
        <MyNominationsSection userId={user.id} />
      </Suspense>
    </div>
  )
}
