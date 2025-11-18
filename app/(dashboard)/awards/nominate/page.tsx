import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getActiveCycles, getAwardCategoryById } from '@/lib/data/awards';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NominationForm } from '@/components/awards';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Trophy, Calendar, Target } from 'lucide-react';

interface NominatePageProps {
  searchParams: Promise<{
    cycle?: string;
    category?: string;
  }>;
}

async function NominationFormSection({ cycleId }: { cycleId: string }) {
  const supabase = await createServerSupabaseClient();

  // Get current user
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get cycle details
  const { data: cycle } = await supabase
    .from('award_cycles')
    .select(
      `
      *,
      category:award_categories(*)
    `
    )
    .eq('id', cycleId)
    .single();

  if (!cycle) {
    return (
      <Alert variant='destructive'>
        <AlertCircle className='h-4 w-4' />
        <AlertDescription>Award cycle not found</AlertDescription>
      </Alert>
    );
  }

  // Check if cycle is open
  if (cycle.status !== 'open') {
    return (
      <Alert>
        <AlertCircle className='h-4 w-4' />
        <AlertDescription>
          This award cycle is not currently accepting nominations.
        </AlertDescription>
      </Alert>
    );
  }

  // Check nomination deadline
  const now = new Date();
  const deadline = new Date(cycle.nomination_deadline);

  if (now > deadline) {
    return (
      <Alert variant='destructive'>
        <AlertCircle className='h-4 w-4' />
        <AlertDescription>
          The nomination deadline for this cycle has passed.
        </AlertDescription>
      </Alert>
    );
  }

  // Get eligible members (all members except self)
  const { data: members } = await supabase
    .from('members')
    .select('id, full_name, avatar_url, company, designation')
    .eq('status', 'active')
    .neq('id', user.id)
    .order('full_name');

  return (
    <div className='space-y-6'>
      {/* Cycle Information */}
      <Card>
        <CardHeader>
          <div className='flex items-start justify-between'>
            <div>
              <CardTitle className='flex items-center gap-2'>
                <Trophy className='h-5 w-5' />
                {cycle.cycle_name}
              </CardTitle>
              <CardDescription className='mt-2'>
                {cycle.category?.name || 'Unknown Category'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          {cycle.description && (
            <p className='text-sm text-muted-foreground'>{cycle.description}</p>
          )}

          <div className='grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t'>
            <div className='flex flex-col'>
              <span className='text-xs text-muted-foreground'>Start Date</span>
              <span className='font-medium text-sm'>
                {new Date(cycle.start_date).toLocaleDateString()}
              </span>
            </div>
            <div className='flex flex-col'>
              <span className='text-xs text-muted-foreground'>End Date</span>
              <span className='font-medium text-sm'>
                {new Date(cycle.end_date).toLocaleDateString()}
              </span>
            </div>
            <div className='flex flex-col'>
              <span className='text-xs text-muted-foreground'>
                Nomination Deadline
              </span>
              <span className='font-medium text-sm'>
                {new Date(cycle.nomination_deadline).toLocaleDateString()}
              </span>
            </div>
            <div className='flex flex-col'>
              <span className='text-xs text-muted-foreground'>
                Jury Deadline
              </span>
              <span className='font-medium text-sm'>
                {new Date(cycle.jury_deadline).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Scoring Criteria */}
          {cycle.category?.scoring_weights && (
            <div className='pt-4 border-t'>
              <p className='text-sm font-medium mb-3'>Scoring Criteria:</p>
              <div className='grid grid-cols-2 md:grid-cols-5 gap-3'>
                <div className='text-center p-3 bg-muted rounded-lg'>
                  <div className='text-2xl font-bold'>
                    {(
                      (cycle.category.scoring_weights as any).impact * 100
                    ).toFixed(0)}
                    %
                  </div>
                  <div className='text-xs text-muted-foreground'>Impact</div>
                </div>
                <div className='text-center p-3 bg-muted rounded-lg'>
                  <div className='text-2xl font-bold'>
                    {(
                      (cycle.category.scoring_weights as any).innovation * 100
                    ).toFixed(0)}
                    %
                  </div>
                  <div className='text-xs text-muted-foreground'>
                    Innovation
                  </div>
                </div>
                <div className='text-center p-3 bg-muted rounded-lg'>
                  <div className='text-2xl font-bold'>
                    {(
                      (cycle.category.scoring_weights as any).participation *
                      100
                    ).toFixed(0)}
                    %
                  </div>
                  <div className='text-xs text-muted-foreground'>
                    Participation
                  </div>
                </div>
                <div className='text-center p-3 bg-muted rounded-lg'>
                  <div className='text-2xl font-bold'>
                    {(
                      (cycle.category.scoring_weights as any).consistency * 100
                    ).toFixed(0)}
                    %
                  </div>
                  <div className='text-xs text-muted-foreground'>
                    Consistency
                  </div>
                </div>
                <div className='text-center p-3 bg-muted rounded-lg'>
                  <div className='text-2xl font-bold'>
                    {(
                      (cycle.category.scoring_weights as any).leadership * 100
                    ).toFixed(0)}
                    %
                  </div>
                  <div className='text-xs text-muted-foreground'>
                    Leadership
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nomination Form */}
      <Card>
        <CardHeader>
          <CardTitle>Submit Nomination</CardTitle>
          <CardDescription>
            Nominate a deserving member for this award. Provide detailed
            justification for your nomination.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NominationForm
            cycleId={cycleId}
            nominatorId={user.id}
            members={members || []}
          />
        </CardContent>
      </Card>
    </div>
  );
}

async function CycleSelector({
  selectedCycleId
}: {
  selectedCycleId?: string;
}) {
  const cycles = await getActiveCycles();

  if (cycles.length === 0) {
    return (
      <Alert>
        <AlertCircle className='h-4 w-4' />
        <AlertDescription>
          No active award cycles are currently accepting nominations.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Award Cycle</CardTitle>
        <CardDescription>
          Choose the award cycle you want to nominate for
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Select
          value={selectedCycleId}
          onValueChange={(value) => {
            window.location.href = `/awards/nominate?cycle=${value}`;
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder='Select an award cycle' />
          </SelectTrigger>
          <SelectContent>
            {cycles.map((cycle) => (
              <SelectItem key={cycle.id} value={cycle.id}>
                <div className='flex flex-col'>
                  <span className='font-medium'>{cycle.cycle_name}</span>
                  <span className='text-sm text-muted-foreground'>
                    {cycle.category?.name} - Deadline:{' '}
                    {new Date(cycle.nomination_deadline).toLocaleDateString()}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

export default async function NominatePage({
  searchParams
}: NominatePageProps) {
  const params = await searchParams;
  const cycleId = params.cycle;

  return (
    <div className='container mx-auto py-8 space-y-6 max-w-9xl'>
      {/* Header */}
      <div>
        <h1 className='text-4xl font-bold'>Nominate for Award</h1>
        <p className='text-muted-foreground mt-2'>
          Submit a nomination for an outstanding member
        </p>
      </div>

      {/* Content */}
      {!cycleId ? (
        <Suspense fallback={<Skeleton className='h-[200px]' />}>
          <CycleSelector />
        </Suspense>
      ) : (
        <Suspense fallback={<Skeleton className='h-[600px]' />}>
          <NominationFormSection cycleId={cycleId} />
        </Suspense>
      )}
    </div>
  );
}
