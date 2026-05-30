import { Suspense } from 'react';
import { redirect, notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { JuryScoringForm } from '@/components/awards';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface JuryScorePageProps {
  params: Promise<{
    nominationId: string;
  }>;
}

async function PageContent({
  paramsPromise
}: {
  paramsPromise: Promise<{ nominationId: string }>
}) {
  const { nominationId } = await paramsPromise;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get the nomination with full details
  const { data: nomination, error } = await supabase
    .schema('yi_connect').from('nominations')
    .select(
      `
      *,
      cycle:award_cycles(
        *,
        category:award_categories(*)
      ),
      nominee:members!nominations_nominee_member_id_fkey(
        id, full_name, avatar_url, company, designation
      ),
      nominator:profiles!nominations_nominator_id_fkey(
        id, full_name, avatar_url
      )
    `
    )
    .eq('id', nominationId)
    .single();

  if (error || !nomination) {
    notFound();
  }

  // jury_members removed — check via jury_panel_members joined through jury_panels for cycle
  const { data: juryMember } = await supabase
    .schema('yi_connect').from('jury_panel_members')
    .select('id, panel:jury_panels!inner(cycle_id)')
    .eq('jury_panels.cycle_id', nomination.cycle_id)
    .eq('juror_id', user.id)
    .eq('is_active', true)
    .single();

  if (!juryMember) {
    return (
      <Alert variant='destructive'>
        <AlertCircle className='h-4 w-4' />
        <AlertDescription>
          You are not assigned as a jury member for this nomination&apos;s award
          cycle.
        </AlertDescription>
      </Alert>
    );
  }

  // Check if nomination is verified
  if (nomination.status !== 'verified') {
    return (
      <Alert>
        <AlertCircle className='h-4 w-4' />
        <AlertDescription>
          This nomination is not yet ready for judging. Status:{' '}
          {nomination.status}
        </AlertDescription>
      </Alert>
    );
  }

  // jury_scores.jury_member_id renamed to juror_id; filter by user's profile id directly
  const { data: existingScore } = await supabase
    .schema('yi_connect').from('jury_scores')
    .select('*')
    .eq('nomination_id', nominationId)
    .eq('juror_id', user.id)
    .single();

  return (
    <JuryScoringForm
      nomination={nomination as any}
      juryMemberId={juryMember.id}
      defaultValues={
        existingScore
          ? {
              id: existingScore.id,
              impact_score: existingScore.impact_score,
              innovation_score: existingScore.innovation_score,
              participation_score: existingScore.participation_score,
              consistency_score: existingScore.consistency_score,
              leadership_score: existingScore.leadership_score,
              comments: existingScore.comments || undefined
            }
          : undefined
      }
    />
  );
}

export default async function JuryScorePage({ params }: JuryScorePageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member'])

  return (
    <div className='container mx-auto py-8 space-y-6 max-w-4xl'>
      {/* Header */}
      <div>
        <h1 className='text-4xl font-bold'>Score Nomination</h1>
        <p className='text-muted-foreground mt-2'>
          Evaluate this nomination based on the scoring criteria
        </p>
      </div>

      {/* Scoring Form */}
      <Suspense fallback={<Skeleton className='h-[800px]' />}>
        <PageContent paramsPromise={params} />
      </Suspense>
    </div>
  );
}
