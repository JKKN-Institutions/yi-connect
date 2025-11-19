import { Suspense } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getCategories, getKnowledgeAnalytics } from '@/lib/data/knowledge';
import { getCurrentUserChapter } from '@/lib/data/members';
import {
  FileText,
  BookOpen,
  Lightbulb,
  FolderOpen,
  Plus,
  TrendingUp,
  Users,
  Download,
  Eye
} from 'lucide-react';

export const metadata = {
  title: 'Knowledge Management',
  description: 'Access documents, wiki pages, and best practices'
};

async function KnowledgeStats() {
  const chapter = await getCurrentUserChapter();
  if (!chapter) return null;

  const analytics = await getKnowledgeAnalytics(chapter.id);
  if (!analytics) return null;

  const stats = [
    {
      title: 'Total Documents',
      value: analytics.total_documents,
      icon: FileText,
      description: 'Documents in library',
      color: 'text-blue-500'
    },
    {
      title: 'Wiki Pages',
      value: analytics.total_wiki_pages,
      icon: BookOpen,
      description: 'Collaborative pages',
      color: 'text-green-500'
    },
    {
      title: 'Best Practices',
      value: analytics.total_best_practices,
      icon: Lightbulb,
      description: 'Published practices',
      color: 'text-yellow-500'
    },
    {
      title: 'Total Views',
      value: analytics.total_views,
      icon: Eye,
      description: 'Content views',
      color: 'text-purple-500'
    }
  ];

  return (
    <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title}>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                {stat.title}
              </CardTitle>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{stat.value}</div>
              <p className='text-xs text-muted-foreground'>
                {stat.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

async function CategoriesSection() {
  const chapter = await getCurrentUserChapter();
  if (!chapter) return null;

  const categories = await getCategories(chapter.id);

  if (categories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
          <CardDescription>Organize your knowledge base</CardDescription>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground'>
            No categories yet. Create one to start organizing your documents.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Categories</CardTitle>
        <CardDescription>Browse by category</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='grid gap-2 md:grid-cols-2 lg:grid-cols-3'>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/knowledge/documents?category=${category.id}`}
              className='flex items-center gap-3 rounded-lg border p-3 hover:bg-accent transition-colors'
            >
              <div
                className='flex h-10 w-10 items-center justify-center rounded-md'
                style={{ backgroundColor: category.color || '#3b82f6' }}
              >
                <FolderOpen className='h-5 w-5 text-white' />
              </div>
              <div className='flex-1'>
                <p className='font-medium text-sm'>{category.name}</p>
                <p className='text-xs text-muted-foreground'>
                  {category.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function KnowledgePage() {
  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>
            Knowledge Management
          </h1>
          <p className='text-muted-foreground'>
            Access and manage your chapter&apos;s knowledge repository
          </p>
        </div>
        <div className='flex gap-2'>
          <Button asChild>
            <Link href='/knowledge/documents/upload'>
              <Plus className='mr-2 h-4 w-4' />
              Upload Document
            </Link>
          </Button>
          <Button asChild variant='outline'>
            <Link href='/knowledge/wiki/new'>
              <Plus className='mr-2 h-4 w-4' />
              New Wiki Page
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <Suspense
        fallback={
          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className='h-4 w-24' />
                </CardHeader>
                <CardContent>
                  <Skeleton className='h-8 w-16' />
                </CardContent>
              </Card>
            ))}
          </div>
        }
      >
        <KnowledgeStats />
      </Suspense>

      {/* Quick Access Cards */}
      <div className='grid gap-4 md:grid-cols-3'>
        <Card className='hover:shadow-lg transition-shadow'>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <FileText className='h-5 w-5 text-blue-500' />
              <CardTitle>Documents</CardTitle>
            </div>
            <CardDescription>Browse and download documents</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className='w-full'>
              <Link href='/knowledge/documents'>View Documents</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className='hover:shadow-lg transition-shadow'>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <BookOpen className='h-5 w-5 text-green-500' />
              <CardTitle>Wiki Pages</CardTitle>
            </div>
            <CardDescription>Collaborative knowledge pages</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className='w-full'>
              <Link href='/knowledge/wiki'>View Wiki</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className='hover:shadow-lg transition-shadow'>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <Lightbulb className='h-5 w-5 text-yellow-500' />
              <CardTitle>Best Practices</CardTitle>
            </div>
            <CardDescription>Learn from shared experiences</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className='w-full'>
              <Link href='/knowledge/best-practices'>View Best Practices</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Categories Section */}
      <Suspense
        fallback={
          <Card>
            <CardHeader>
              <Skeleton className='h-6 w-32' />
            </CardHeader>
            <CardContent>
              <Skeleton className='h-24 w-full' />
            </CardContent>
          </Card>
        }
      >
        <CategoriesSection />
      </Suspense>
    </div>
  );
}
