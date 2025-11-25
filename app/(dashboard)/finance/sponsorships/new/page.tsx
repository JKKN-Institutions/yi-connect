import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getCurrentChapterId, requireRole } from '@/lib/auth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { SponsorshipDealForm } from '@/components/finance/sponsorship-deal-form';
import { getSponsorsForDropdown, getSponsorshipTiers } from '@/lib/data/finance';

export const metadata = {
  title: 'Create Sponsorship Deal',
  description:
    'Create a new sponsorship deal and track its progress through the pipeline'
};

async function NewDealFormWrapper() {
  const chapterId = await getCurrentChapterId();

  // Fetch sponsors and tiers for the form
  const [sponsors, tiers] = await Promise.all([
    getSponsorsForDropdown(chapterId),
    getSponsorshipTiers(chapterId)
  ]);

  // If no chapter ID (super admin), show a warning but still allow the form
  if (!chapterId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Create Sponsorship Deal</CardTitle>
          <CardDescription>
            Track a new sponsorship opportunity from prospect to payment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='rounded-lg border border-amber-200 bg-amber-50 p-4 mb-6'>
            <p className='text-sm text-amber-800'>
              As a super admin, you need to select a chapter context first to create sponsorship deals.
            </p>
          </div>
          <div className='rounded-lg border-2 border-dashed p-12 text-center'>
            <p className='text-muted-foreground'>
              Please select a chapter from the sidebar to proceed with creating a sponsorship deal.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Sponsorship Deal</CardTitle>
        <CardDescription>
          Track a new sponsorship opportunity from prospect to payment
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sponsors.length === 0 ? (
          <div className='rounded-lg border-2 border-dashed p-12 text-center'>
            <h3 className='text-lg font-semibold mb-2'>No Sponsors Found</h3>
            <p className='text-muted-foreground mb-4'>
              You need to add sponsors before creating sponsorship deals.
            </p>
            <Button asChild>
              <Link href='/finance/sponsorships/sponsors/new'>Add Sponsor</Link>
            </Button>
          </div>
        ) : (
          <SponsorshipDealForm
            chapterId={chapterId}
            sponsors={sponsors}
            tiers={tiers}
          />
        )}
      </CardContent>
    </Card>
  );
}

function FormSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-8 w-[250px]' />
        <Skeleton className='h-4 w-[400px]' />
      </CardHeader>
      <CardContent className='space-y-4'>
        {[...Array(6)].map((_, i) => (
          <div key={i} className='space-y-2'>
            <Skeleton className='h-4 w-[100px]' />
            <Skeleton className='h-10 w-full' />
          </div>
        ))}
        <Skeleton className='h-10 w-[120px]' />
      </CardContent>
    </Card>
  );
}

export default async function NewSponsorshipDealPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']);

  return (
    <div className='flex flex-col gap-8 max-w-9xl mx-auto'>
      <div className='flex items-center gap-4'>
        <Button variant='ghost' size='icon' asChild>
          <Link href='/finance/sponsorships'>
            <ArrowLeft className='h-5 w-5' />
          </Link>
        </Button>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>
            Create Sponsorship Deal
          </h1>
          <p className='text-muted-foreground'>
            Add a new sponsorship opportunity to your pipeline
          </p>
        </div>
      </div>

      <Suspense fallback={<FormSkeleton />}>
        <NewDealFormWrapper />
      </Suspense>
    </div>
  );
}
