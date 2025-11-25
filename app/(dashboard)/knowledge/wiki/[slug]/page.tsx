import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { getWikiPageBySlug } from '@/lib/data/knowledge';
import { getCurrentUserChapter } from '@/lib/data/members';
import { requireRole } from '@/lib/auth';
import {
  ArrowLeft,
  Calendar,
  Edit,
  Eye,
  FileText,
  Globe,
  Lock,
  User,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';

const CATEGORY_LABELS: Record<string, string> = {
  sop: 'SOP',
  best_practice: 'Best Practice',
  process_note: 'Process Note',
  general: 'General',
};

const VISIBILITY_CONFIG: Record<string, { label: string; color: string; icon: typeof Globe }> = {
  public: { label: 'Public', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: Globe },
  chapter: { label: 'Chapter', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: Users },
  ec_only: { label: 'EC Only', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', icon: Lock },
  chair_only: { label: 'Chair Only', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: Lock },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function WikiPageContent({ slug }: { slug: string }) {
  const chapter = await getCurrentUserChapter();
  if (!chapter) {
    notFound();
  }

  const wikiPage = await getWikiPageBySlug(chapter.id, slug);

  if (!wikiPage) {
    notFound();
  }

  const visibilityConfig = VISIBILITY_CONFIG[wikiPage.visibility] || VISIBILITY_CONFIG.chapter;
  const VisibilityIcon = visibilityConfig.icon;
  const categoryLabel = CATEGORY_LABELS[wikiPage.category] || wikiPage.category;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline">{categoryLabel}</Badge>
            <Badge className={visibilityConfig.color}>
              <VisibilityIcon className="h-3 w-3 mr-1" />
              {visibilityConfig.label}
            </Badge>
            {wikiPage.is_locked && (
              <Badge variant="secondary">
                <Lock className="h-3 w-3 mr-1" />
                Locked
              </Badge>
            )}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{wikiPage.title}</h1>
          {wikiPage.summary && (
            <p className="text-muted-foreground mt-2">{wikiPage.summary}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/knowledge/wiki/${slug}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Main Content */}
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="pt-6">
              <div className="prose prose-slate dark:prose-invert max-w-none">
                {/* For now, render as plain text with line breaks.
                    In production, you'd use a Markdown renderer like react-markdown */}
                <div className="whitespace-pre-wrap">{wikiPage.content}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Page Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Page Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Version
                </span>
                <Badge variant="outline">v{wikiPage.version}</Badge>
              </div>

              <Separator />

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Created
                </span>
                <span className="font-medium">
                  {format(new Date(wikiPage.created_at), 'MMM d, yyyy')}
                </span>
              </div>

              <Separator />

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Last Updated
                </span>
                <span className="font-medium">
                  {format(new Date(wikiPage.updated_at), 'MMM d, yyyy')}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default async function WikiPageDetailPage({ params }: PageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member', 'Member']);

  const { slug } = await params;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/knowledge/wiki">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Wiki Pages
        </Link>
      </Button>

      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex gap-2">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-20" />
              </div>
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
        <WikiPageContent slug={slug} />
      </Suspense>
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const chapter = await getCurrentUserChapter();

  if (!chapter) {
    return { title: 'Wiki Page Not Found' };
  }

  const wikiPage = await getWikiPageBySlug(chapter.id, slug);

  if (!wikiPage) {
    return { title: 'Wiki Page Not Found' };
  }

  return {
    title: wikiPage.title,
    description: wikiPage.summary || `Wiki page: ${wikiPage.title}`,
  };
}
