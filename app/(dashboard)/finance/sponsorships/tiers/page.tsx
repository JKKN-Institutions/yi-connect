import { Suspense } from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { TierList } from '@/components/finance/tier-list';
import { getSponsorshipTiers } from '@/lib/data/finance';
import { getCurrentChapterId, requireRole } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Sponsorship Tiers',
  description: 'Manage sponsorship tiers, benefits and pricing packages.',
};

async function TiersWrapper({ canEdit }: { canEdit: boolean }) {
  const chapterId = await getCurrentChapterId();

  if (!chapterId) {
    return (
      <Card>
        <CardContent className='py-12 text-center'>
          <p className='text-sm text-muted-foreground'>
            Please select a chapter context from the sidebar to manage tiers.
          </p>
        </CardContent>
      </Card>
    );
  }

  const tiers = await getSponsorshipTiers(chapterId);

  return <TierList tiers={tiers} chapterId={chapterId} canEdit={canEdit} />;
}

function TiersSkeleton() {
  return (
    <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className='h-[280px]' />
      ))}
    </div>
  );
}

const EDIT_ROLES = ['Super Admin', 'National Admin', 'Chair', 'Co-Chair'];

export default async function SponsorshipTiersPage() {
  // Chair+ can manage tiers; others (EC Member) can view.
  const { roles } = await requireRole([
    'Super Admin',
    'National Admin',
    'Chair',
    'Co-Chair',
    'Executive Member',
    'EC Member',
  ]);

  const canEdit = roles.some((r: string) => EDIT_ROLES.includes(r));

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-3'>
        <Button variant='ghost' size='icon' asChild>
          <Link href='/finance/sponsorships'>
            <ArrowLeft className='h-5 w-5' />
          </Link>
        </Button>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>
            Sponsorship Tiers
          </h1>
          <p className='text-muted-foreground'>
            Define tier packages, benefits and thresholds. Deals can then be
            linked to a tier.
          </p>
        </div>
      </div>

      <Suspense fallback={<TiersSkeleton />}>
        <TiersWrapper canEdit={canEdit} />
      </Suspense>
    </div>
  );
}
