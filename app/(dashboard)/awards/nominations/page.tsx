import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NominationStatusCard } from '@/components/awards'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, FileText, Trophy, Users } from 'lucide-react'

async function MyNominationsSection({ userId }: { userId: string }) {
  const supabase = await createServerSupabaseClient()

  // Get nominations where user is the nominator
  const { data: myNominations } = await supabase
    .from('nominations')
    .select(`
      *,
      cycle:award_cycles(*,
        category:award_categories(*),
        _count:nominations(count)
      ),
      nominee:members!nominations_nominee_id_fkey(
        id, full_name, avatar_url, company, designation
      ),
      jury_scores(count),
      winner:award_winners(*)
    `)
    .eq('nominator_id', userId)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-4">
      {!myNominations || myNominations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              No nominations yet
            </p>
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
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {myNominations.map((nomination: any) => (
            <NominationStatusCard
              key={nomination.id}
              nomination={nomination}
              viewAs="nominator"
            />
          ))}
        </div>
      )}
    </div>
  )
}

async function NominatedMeSection({ userId }: { userId: string }) {
  const supabase = await createServerSupabaseClient()

  // Get nominations where user is the nominee
  const { data: nominationsReceived } = await supabase
    .from('nominations')
    .select(`
      *,
      cycle:award_cycles(*,
        category:award_categories(*),
        _count:nominations(count)
      ),
      nominator:members!nominations_nominator_id_fkey(
        id, full_name, avatar_url
      ),
      jury_scores(count),
      winner:award_winners(*)
    `)
    .eq('nominee_id', userId)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-4">
      {!nominationsReceived || nominationsReceived.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              No nominations received
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Keep up the great work! Nominations will appear here when others recognize your contributions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {nominationsReceived.map((nomination: any) => (
            <NominationStatusCard
              key={nomination.id}
              nomination={nomination}
              viewAs="nominee"
            />
          ))}
        </div>
      )}
    </div>
  )
}

async function AllNominationsSection({ userId }: { userId: string }) {
  const supabase = await createServerSupabaseClient()

  // Get all submitted nominations (public view)
  const { data: allNominations } = await supabase
    .from('nominations')
    .select(`
      *,
      cycle:award_cycles(*,
        category:award_categories(*),
        _count:nominations(count)
      ),
      nominee:members!nominations_nominee_id_fkey(
        id, full_name, avatar_url, company, designation
      ),
      nominator:members!nominations_nominator_id_fkey(
        id, full_name, avatar_url
      ),
      jury_scores(count),
      winner:award_winners(*)
    `)
    .neq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-4">
      {!allNominations || allNominations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              No public nominations yet
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Submitted nominations will appear here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {allNominations.map((nomination: any) => (
            <NominationStatusCard
              key={nomination.id}
              nomination={nomination}
              viewAs="admin"
            />
          ))}
        </div>
      )}
    </div>
  )
}

async function NominationsContent({ userId }: { userId: string }) {
  return (
    <Tabs defaultValue="my-nominations" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="my-nominations">
          <FileText className="mr-2 h-4 w-4" />
          My Nominations
        </TabsTrigger>
        <TabsTrigger value="nominated-me">
          <Trophy className="mr-2 h-4 w-4" />
          Nominated Me
        </TabsTrigger>
        <TabsTrigger value="all-nominations">
          <Users className="mr-2 h-4 w-4" />
          All Nominations
        </TabsTrigger>
      </TabsList>

      <TabsContent value="my-nominations" className="mt-6">
        <Suspense
          fallback={
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-[300px]" />
              <Skeleton className="h-[300px]" />
            </div>
          }
        >
          <MyNominationsSection userId={userId} />
        </Suspense>
      </TabsContent>

      <TabsContent value="nominated-me" className="mt-6">
        <Suspense
          fallback={
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-[300px]" />
              <Skeleton className="h-[300px]" />
            </div>
          }
        >
          <NominatedMeSection userId={userId} />
        </Suspense>
      </TabsContent>

      <TabsContent value="all-nominations" className="mt-6">
        <Suspense
          fallback={
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-[300px]" />
              <Skeleton className="h-[300px]" />
            </div>
          }
        >
          <AllNominationsSection userId={userId} />
        </Suspense>
      </TabsContent>
    </Tabs>
  )
}

export default async function NominationsPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member', 'Member'])

  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Award Nominations</h1>
          <p className="text-muted-foreground mt-2">
            View and manage award nominations
          </p>
        </div>
        <Button asChild>
          <Link href="/awards/nominate">
            <Plus className="mr-2 h-4 w-4" />
            New Nomination
          </Link>
        </Button>
      </div>

      {/* Tabs Content */}
      <NominationsContent userId={user.id} />
    </div>
  )
}
