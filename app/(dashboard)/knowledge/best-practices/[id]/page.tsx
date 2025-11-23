import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { getBestPracticeById } from '@/lib/data/knowledge';
import { getCurrentUser } from '@/lib/data/auth';
import { hasUserUpvotedBestPractice } from '@/app/actions/knowledge';
import { BestPracticeActions } from '@/components/knowledge/best-practice-actions';
import { BestPracticeViewTracker } from '@/components/knowledge/best-practice-view-tracker';
import { BestPracticeUpvoteButton } from '@/components/knowledge/best-practice-upvote-button';
import {
  ArrowLeft,
  Calendar,
  Edit,
  Eye,
  Users,
  Clock,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock3,
} from 'lucide-react';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/server';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200', icon: Clock3 },
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: Clock },
  under_review: { label: 'Under Review', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', icon: Clock },
  published: { label: 'Published', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: XCircle },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

async function BestPracticeContent({ practiceId }: { practiceId: string }) {
  const bestPractice = await getBestPracticeById(practiceId);

  if (!bestPractice) {
    notFound();
  }

  // Get current user and check permissions
  const user = await getCurrentUser();
  const isOwner = user?.id === bestPractice.submitted_by;

  // Check if user has upvoted (only for logged-in users)
  const hasUpvoted = user ? await hasUserUpvotedBestPractice(practiceId) : false;

  // Check if user can review (EC members and above can review - hierarchy_level >= 2)
  let canReview = false;
  if (user) {
    const supabase = await createClient();
    // Get user's highest role hierarchy level using a raw query approach
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select(`
        role_id,
        roles!inner (
          hierarchy_level
        )
      `)
      .eq('user_id', user.id);

    // Get highest hierarchy level from user's roles
    // EC Member (level 2) and above can review best practices
    const highestLevel = userRoles?.reduce((max, ur) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const roles = ur.roles as any;
      const level = roles?.hierarchy_level ?? 0;
      return Math.max(max, level);
    }, 0) ?? 0;
    canReview = highestLevel >= 2;
  }

  const statusConfig = STATUS_CONFIG[bestPractice.status] || STATUS_CONFIG.draft;
  const StatusIcon = statusConfig.icon;

  const hasImpactMetrics = bestPractice.impact_metrics && (
    bestPractice.impact_metrics.beneficiaries ||
    bestPractice.impact_metrics.cost_saved ||
    bestPractice.impact_metrics.time_saved_hours
  );

  // Only show edit button if owner and status is draft or rejected
  const canEdit = isOwner && (bestPractice.status === 'draft' || bestPractice.status === 'rejected');

  // Only show upvote button for published best practices
  const canUpvote = user && bestPractice.status === 'published';

  return (
    <div className="space-y-6">
      {/* Track view */}
      <BestPracticeViewTracker practiceId={practiceId} />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge className={statusConfig.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{bestPractice.title}</h1>
          <p className="text-muted-foreground mt-2">{bestPractice.description}</p>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <Button variant="outline" asChild>
              <Link href={`/knowledge/best-practices/${practiceId}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
          )}
          <BestPracticeActions
            bestPractice={bestPractice}
            isOwner={isOwner}
            canReview={canReview}
          />
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Full Content */}
          {bestPractice.full_content && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap">{bestPractice.full_content}</div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Impact Metrics */}
          {hasImpactMetrics && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Impact Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {bestPractice.impact_metrics.beneficiaries && (
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                      <Users className="h-8 w-8 text-blue-500" />
                      <div>
                        <p className="text-2xl font-bold">{bestPractice.impact_metrics.beneficiaries.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">Beneficiaries</p>
                      </div>
                    </div>
                  )}
                  {bestPractice.impact_metrics.cost_saved && (
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                      <DollarSign className="h-8 w-8 text-green-500" />
                      <div>
                        <p className="text-2xl font-bold">₹{bestPractice.impact_metrics.cost_saved.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">Cost Saved</p>
                      </div>
                    </div>
                  )}
                  {bestPractice.impact_metrics.time_saved_hours && (
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                      <Clock className="h-8 w-8 text-orange-500" />
                      <div>
                        <p className="text-2xl font-bold">{bestPractice.impact_metrics.time_saved_hours}</p>
                        <p className="text-sm text-muted-foreground">Hours Saved</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Review Notes */}
          {bestPractice.review_notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Review Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{bestPractice.review_notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Engagement Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Engagement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {canUpvote ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Upvote this practice</span>
                  <BestPracticeUpvoteButton
                    practiceId={practiceId}
                    initialUpvoteCount={bestPractice.upvote_count}
                    initialHasUpvoted={hasUpvoted}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Upvotes</span>
                  <span className="font-medium">{bestPractice.upvote_count}</span>
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Views
                </span>
                <span className="font-medium">{bestPractice.view_count}</span>
              </div>
            </CardContent>
          </Card>

          {/* Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Created
                </span>
                <span className="font-medium">
                  {format(new Date(bestPractice.created_at), 'MMM d, yyyy')}
                </span>
              </div>

              {bestPractice.published_at && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Published
                    </span>
                    <span className="font-medium">
                      {format(new Date(bestPractice.published_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                </>
              )}

              {bestPractice.reviewed_at && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Reviewed
                    </span>
                    <span className="font-medium">
                      {format(new Date(bestPractice.reviewed_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default async function BestPracticeDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/knowledge/best-practices">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Best Practices
        </Link>
      </Button>

      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-10 w-96" />
              <Skeleton className="h-5 w-64" />
            </div>
            <div className="grid gap-6 lg:grid-cols-4">
              <div className="lg:col-span-3">
                <Card>
                  <CardContent className="pt-6">
                    <Skeleton className="h-64 w-full" />
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-4 w-full" />
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        }
      >
        <BestPracticeContent practiceId={id} />
      </Suspense>
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const bestPractice = await getBestPracticeById(id);

  if (!bestPractice) {
    return { title: 'Best Practice Not Found' };
  }

  return {
    title: bestPractice.title,
    description: bestPractice.description,
  };
}
