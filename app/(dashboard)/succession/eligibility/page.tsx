import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { createClient } from '@/lib/supabase/server';
import {
  getCurrentActiveCycle,
  getMemberEligibilityForCycle
} from '@/lib/data/succession';
import { CheckCircle2, XCircle, TrendingUp, Award } from 'lucide-react';

export const metadata = {
  title: 'My Eligibility | Succession',
  description: 'View your eligibility for leadership positions'
};

async function EligibilityContent() {
  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const activeCycle = await getCurrentActiveCycle();

  if (!activeCycle) {
    return (
      <Card>
        <CardContent className='py-12'>
          <div className='text-center text-muted-foreground'>
            <Award className='h-12 w-12 mx-auto mb-4 opacity-50' />
            <p className='text-lg font-medium'>No Active Succession Cycle</p>
            <p className='text-sm mt-2'>
              There are currently no active succession cycles. Check back later
              for opportunities.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const eligibility = await getMemberEligibilityForCycle(
    user.id,
    activeCycle.id
  );

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>Active Succession Cycle</CardTitle>
          <CardDescription>
            {activeCycle.cycle_name} - {activeCycle.year}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeCycle.description && (
            <p className='text-sm text-muted-foreground'>
              {activeCycle.description}
            </p>
          )}
          {activeCycle.start_date && activeCycle.end_date && (
            <div className='mt-4 flex items-center gap-2 text-sm'>
              <span className='text-muted-foreground'>Timeline:</span>
              <span>
                {new Date(activeCycle.start_date).toLocaleDateString()} -{' '}
                {new Date(activeCycle.end_date).toLocaleDateString()}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Eligibility Status</CardTitle>
          <CardDescription>
            Positions you&apos;re eligible to apply for in this cycle
          </CardDescription>
        </CardHeader>
        <CardContent>
          {eligibility.length === 0 ? (
            <div className='text-center py-8 text-muted-foreground'>
              <XCircle className='h-12 w-12 mx-auto mb-4 opacity-50' />
              <p className='text-lg font-medium'>No Eligible Positions</p>
              <p className='text-sm mt-2'>
                You don&apos;t currently meet the eligibility criteria for any
                positions in this cycle.
              </p>
              <p className='text-sm mt-1'>
                Continue participating in events and developing your skills to
                improve your eligibility.
              </p>
            </div>
          ) : (
            <div className='space-y-6'>
              {eligibility.map((record: any) => {
                const breakdown = record.score_breakdown;
                return (
                  <div
                    key={record.id}
                    className='border rounded-lg p-6 space-y-4'
                  >
                    <div className='flex items-start justify-between'>
                      <div>
                        <div className='flex items-center gap-2'>
                          <h3 className='text-lg font-semibold'>
                            {record.position.title}
                          </h3>
                          <Badge className='bg-green-500'>
                            <CheckCircle2 className='h-3 w-3 mr-1' />
                            Eligible
                          </Badge>
                        </div>
                        {record.position.description && (
                          <p className='text-sm text-muted-foreground mt-1'>
                            {record.position.description}
                          </p>
                        )}
                        <div className='flex items-center gap-4 mt-2 text-sm'>
                          <span className='text-muted-foreground'>
                            Level {record.position.hierarchy_level}
                          </span>
                          <span className='text-muted-foreground'>•</span>
                          <span className='text-muted-foreground'>
                            {record.position.number_of_openings} opening
                            {record.position.number_of_openings > 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div className='text-right'>
                        <div className='text-3xl font-bold text-green-600'>
                          {Math.round(record.eligibility_score)}%
                        </div>
                        <div className='text-xs text-muted-foreground mt-1'>
                          Eligibility Score
                        </div>
                      </div>
                    </div>

                    {breakdown && (
                      <div className='space-y-3 pt-4 border-t'>
                        <div className='text-sm font-medium mb-3'>
                          Score Breakdown:
                        </div>

                        {breakdown.tenure && breakdown.tenure.weight > 0 && (
                          <div className='space-y-1'>
                            <div className='flex items-center justify-between text-sm'>
                              <div className='flex items-center gap-2'>
                                <TrendingUp className='h-4 w-4 text-blue-500' />
                                <span>Tenure</span>
                                <span className='text-muted-foreground'>
                                  ({breakdown.tenure.value?.toFixed(1)} years)
                                </span>
                              </div>
                              <span className='font-medium'>
                                {Math.round(breakdown.tenure.score)}%
                              </span>
                            </div>
                            <Progress
                              value={breakdown.tenure.score}
                              className='h-2'
                            />
                          </div>
                        )}

                        {breakdown.events && breakdown.events.weight > 0 && (
                          <div className='space-y-1'>
                            <div className='flex items-center justify-between text-sm'>
                              <div className='flex items-center gap-2'>
                                <Award className='h-4 w-4 text-purple-500' />
                                <span>Events Participation</span>
                                <span className='text-muted-foreground'>
                                  ({breakdown.events.value} events)
                                </span>
                              </div>
                              <span className='font-medium'>
                                {Math.round(breakdown.events.score)}%
                              </span>
                            </div>
                            <Progress
                              value={breakdown.events.score}
                              className='h-2'
                            />
                          </div>
                        )}

                        {breakdown.leadership &&
                          breakdown.leadership.weight > 0 && (
                            <div className='space-y-1'>
                              <div className='flex items-center justify-between text-sm'>
                                <div className='flex items-center gap-2'>
                                  <CheckCircle2 className='h-4 w-4 text-green-500' />
                                  <span>Leadership Experience</span>
                                  <span className='text-muted-foreground'>
                                    ({breakdown.leadership.value ? 'Yes' : 'No'}
                                    )
                                  </span>
                                </div>
                                <span className='font-medium'>
                                  {Math.round(breakdown.leadership.score)}%
                                </span>
                              </div>
                              <Progress
                                value={breakdown.leadership.score}
                                className='h-2'
                              />
                            </div>
                          )}

                        {breakdown.skills && breakdown.skills.weight > 0 && (
                          <div className='space-y-1'>
                            <div className='flex items-center justify-between text-sm'>
                              <div className='flex items-center gap-2'>
                                <Award className='h-4 w-4 text-orange-500' />
                                <span>Skills Match</span>
                                <span className='text-muted-foreground'>
                                  ({breakdown.skills.matched?.length || 0}/
                                  {breakdown.skills.required?.length || 0})
                                </span>
                              </div>
                              <span className='font-medium'>
                                {Math.round(breakdown.skills.score)}%
                              </span>
                            </div>
                            <Progress
                              value={breakdown.skills.score}
                              className='h-2'
                            />
                            {breakdown.skills.matched &&
                              breakdown.skills.matched.length > 0 && (
                                <div className='flex flex-wrap gap-1 mt-2'>
                                  {breakdown.skills.matched.map(
                                    (skill: string) => (
                                      <Badge
                                        key={skill}
                                        variant='secondary'
                                        className='text-xs'
                                      >
                                        {skill}
                                      </Badge>
                                    )
                                  )}
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EligibilityLoading() {
  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <Skeleton className='h-6 w-64' />
          <Skeleton className='h-4 w-48 mt-2' />
        </CardHeader>
        <CardContent>
          <Skeleton className='h-24 w-full' />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className='h-6 w-64' />
          <Skeleton className='h-4 w-96 mt-2' />
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            <Skeleton className='h-32 w-full' />
            <Skeleton className='h-32 w-full' />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MemberEligibilityPage() {
  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>
          My Succession Eligibility
        </h1>
        <p className='text-muted-foreground mt-2'>
          View your eligibility status for leadership positions in the active
          succession cycle
        </p>
      </div>

      <Suspense fallback={<EligibilityLoading />}>
        <EligibilityContent />
      </Suspense>
    </div>
  );
}
