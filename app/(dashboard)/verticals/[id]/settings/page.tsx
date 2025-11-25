/**
 * Vertical Settings Page
 *
 * Manage vertical settings and configuration
 * Module 9: Vertical Performance Tracker
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { ArrowLeft, Settings, Trash2, AlertTriangle } from 'lucide-react';
import { getCurrentUser, requireRole } from '@/lib/auth';
import { getVerticalById } from '@/lib/data/vertical';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const metadata = {
  title: 'Vertical Settings',
  description: 'Manage vertical settings and configuration'
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VerticalSettingsPage({ params }: PageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member'])
  return (
    <div className='flex flex-col gap-8 max-w-9xl mx-auto'>
      {/* Header */}
      <Suspense fallback={<HeaderSkeleton />}>
        <SettingsHeader params={params} />
      </Suspense>

      {/* Content */}
      <Suspense fallback={<ContentSkeleton />}>
        <SettingsContent params={params} />
      </Suspense>
    </div>
  );
}

async function SettingsHeader({ params }: PageProps) {
  const { id } = await params;
  const vertical = await getVerticalById(id);

  if (!vertical) notFound();

  return (
    <div className='flex items-center justify-between'>
      <div>
        <div className='flex items-center gap-2 mb-2'>
          <Button variant='ghost' size='sm' asChild>
            <Link href={`/verticals/${id}`}>
              <ArrowLeft className='h-4 w-4 mr-1' />
              Back to {vertical.name}
            </Link>
          </Button>
        </div>
        <h1 className='text-3xl font-bold tracking-tight flex items-center gap-2'>
          <Settings className='h-8 w-8' />
          Settings
        </h1>
        <p className='text-muted-foreground mt-1'>
          Manage settings for {vertical.name}
        </p>
      </div>
    </div>
  );
}

async function SettingsContent({ params }: PageProps) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const vertical = await getVerticalById(id);
  if (!vertical) notFound();

  return (
    <div className='space-y-6'>
      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>
            Basic vertical information and configuration
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div>
              <label className='text-sm font-medium text-muted-foreground'>
                Name
              </label>
              <p className='text-lg font-medium'>{vertical.name}</p>
            </div>
            <div>
              <label className='text-sm font-medium text-muted-foreground'>
                Slug
              </label>
              <p className='text-lg font-medium'>{vertical.slug}</p>
            </div>
            <div>
              <label className='text-sm font-medium text-muted-foreground'>
                Status
              </label>
              <div className='mt-1'>
                <Badge variant={vertical.is_active ? 'default' : 'secondary'}>
                  {vertical.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
            <div>
              <label className='text-sm font-medium text-muted-foreground'>
                Color
              </label>
              <div className='flex items-center gap-2 mt-1'>
                <div
                  className='w-6 h-6 rounded-full border'
                  style={{ backgroundColor: vertical.color || '#6b7280' }}
                />
                <span className='text-sm'>{vertical.color || 'Default'}</span>
              </div>
            </div>
          </div>

          {vertical.description && (
            <div>
              <label className='text-sm font-medium text-muted-foreground'>
                Description
              </label>
              <p className='text-sm mt-1'>{vertical.description}</p>
            </div>
          )}

          <Separator />

          <div className='flex justify-end'>
            <Button asChild>
              <Link href={`/verticals/${id}/edit`}>Edit Vertical</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Team Management */}
      <Card>
        <CardHeader>
          <CardTitle>Team Management</CardTitle>
          <CardDescription>
            Manage vertical chair and team members
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center justify-between p-4 rounded-lg border'>
            <div>
              <h4 className='font-medium'>Chair & Co-Chair</h4>
              <p className='text-sm text-muted-foreground'>
                Assign or update vertical leadership
              </p>
            </div>
            <Button variant='outline' asChild>
              <Link href={`/verticals/${id}/members`}>Manage</Link>
            </Button>
          </div>
          <div className='flex items-center justify-between p-4 rounded-lg border'>
            <div>
              <h4 className='font-medium'>Team Members</h4>
              <p className='text-sm text-muted-foreground'>
                Add or remove team members
              </p>
            </div>
            <Button variant='outline' asChild>
              <Link href={`/verticals/${id}/members`}>Manage</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Plan & KPIs */}
      <Card>
        <CardHeader>
          <CardTitle>Planning & Performance</CardTitle>
          <CardDescription>
            Manage annual plans and key performance indicators
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center justify-between p-4 rounded-lg border'>
            <div>
              <h4 className='font-medium'>Annual Plan</h4>
              <p className='text-sm text-muted-foreground'>
                Create or edit the annual plan
              </p>
            </div>
            <Button variant='outline' asChild>
              <Link href={`/verticals/${id}/plan`}>Manage</Link>
            </Button>
          </div>
          <div className='flex items-center justify-between p-4 rounded-lg border'>
            <div>
              <h4 className='font-medium'>KPI Management</h4>
              <p className='text-sm text-muted-foreground'>
                Configure and track KPIs
              </p>
            </div>
            <Button variant='outline' asChild>
              <Link href={`/verticals/${id}/kpis`}>Manage</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className='border-destructive'>
        <CardHeader>
          <CardTitle className='text-destructive flex items-center gap-2'>
            <AlertTriangle className='h-5 w-5' />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions for this vertical
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant='destructive'>
            <AlertTriangle className='h-4 w-4' />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              Deleting this vertical will permanently remove all associated
              plans, KPIs, activities, and achievements. This action cannot be
              undone.
            </AlertDescription>
          </Alert>
          <div className='flex justify-end mt-4'>
            <Button variant='destructive' disabled>
              <Trash2 className='h-4 w-4 mr-2' />
              Delete Vertical
            </Button>
          </div>
          <p className='text-xs text-muted-foreground text-right mt-2'>
            Contact an administrator to delete this vertical
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div className='flex items-center justify-between'>
      <div>
        <Skeleton className='h-9 w-32 mb-2' />
        <Skeleton className='h-9 w-48 mb-1' />
        <Skeleton className='h-5 w-64' />
      </div>
    </div>
  );
}

function ContentSkeleton() {
  return (
    <div className='space-y-6'>
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className='h-6 w-48 mb-2' />
            <Skeleton className='h-4 w-64' />
          </CardHeader>
          <CardContent>
            <Skeleton className='h-24 w-full' />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
