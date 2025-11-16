/**
 * Industrial Visits Marketplace Page
 * Browse and book available industrial visits
 */

import { Suspense } from 'react';
import { Metadata } from 'next';
import { Calendar, Grid, List, Filter } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { IVMarketplaceCard } from '@/components/industrial-visits/iv-marketplace-card';
import { IVDataTable } from '@/components/industrial-visits/iv-data-table/iv-data-table';
import { ivColumns } from '@/components/industrial-visits/iv-data-table/columns';
import { getAvailableIVs } from '@/lib/data/industrial-visits';
import { getCurrentUserChapter } from '@/lib/data/members';

export const metadata: Metadata = {
  title: 'Industrial Visits Marketplace | Yi Connect',
  description: 'Browse and book industrial visits organized by your chapter',
};

async function IVMarketplaceContent() {
  // Get current user's chapter
  const chapter = await getCurrentUserChapter();

  if (!chapter) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">
          You need to be a member of a chapter to view industrial visits.
        </p>
      </div>
    );
  }

  // Fetch available industrial visits
  const ivs = await getAvailableIVs(chapter.id);

  // Extract unique industry sectors for filters
  const industrySectors = Array.from(
    new Set(
      ivs
        .map((iv) => iv.industry_sector)
        .filter((sector): sector is string => sector !== null)
    )
  ).sort();

  const upcomingCount = ivs.filter(
    (iv) => new Date(iv.start_date) > new Date()
  ).length;
  const availableCount = ivs.filter((iv) => iv.has_capacity).length;
  const carpoolCount = ivs.filter((iv) => iv.carpool_drivers_count > 0).length;

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Industrial Visits Marketplace
          </h1>
          <p className="text-muted-foreground mt-1">
            Discover and book industrial visits organized by your chapter
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Advanced Filters
          </Button>
          <Button variant="outline" size="sm">
            <Calendar className="mr-2 h-4 w-4" />
            Calendar View
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold">{ivs.length}</div>
          <p className="text-xs text-muted-foreground">Total Industrial Visits</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold text-primary">{upcomingCount}</div>
          <p className="text-xs text-muted-foreground">Upcoming Events</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold text-green-600">{availableCount}</div>
          <p className="text-xs text-muted-foreground">Spots Available</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold text-blue-600">{carpoolCount}</div>
          <p className="text-xs text-muted-foreground">Carpool Options</p>
        </div>
      </div>

      {/* View Toggle */}
      <Tabs defaultValue="grid" className="w-full">
        <TabsList>
          <TabsTrigger value="grid">
            <Grid className="mr-2 h-4 w-4" />
            Grid View
          </TabsTrigger>
          <TabsTrigger value="list">
            <List className="mr-2 h-4 w-4" />
            Table View
          </TabsTrigger>
        </TabsList>

        {/* Grid View */}
        <TabsContent value="grid" className="mt-6">
          {ivs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                No industrial visits available
              </h3>
              <p className="text-muted-foreground max-w-md">
                There are currently no industrial visits scheduled. Check back
                later or contact your chapter leadership to organize one.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {ivs.map((iv) => (
                <IVMarketplaceCard key={iv.id} iv={iv} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Table View */}
        <TabsContent value="list" className="mt-6">
          <IVDataTable
            columns={ivColumns}
            data={ivs}
            industrySectors={industrySectors}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function IVMarketplaceLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Skeleton className="h-9 w-[400px]" />
          <Skeleton className="h-4 w-[500px] mt-2" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-[150px]" />
          <Skeleton className="h-9 w-[150px]" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-[400px] rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function IVMarketplacePage() {
  return (
    <Suspense fallback={<IVMarketplaceLoading />}>
      <IVMarketplaceContent />
    </Suspense>
  );
}
