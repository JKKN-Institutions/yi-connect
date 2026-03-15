import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from 'lucide-react';
import { getNationalEvents } from '@/lib/data/national-integration';
import { NationalEventsPageClient } from '@/components/national/national-events-page-client';
import { requireRole } from '@/lib/auth';

export const metadata = {
  title: 'National Events | Yi Connect',
  description: 'Register for RCMs, Summits, Conclaves, and Training Programs'
};

function EventsPageSkeleton() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

async function NationalEventsContent() {
  const events = await getNationalEvents();

  if (events.length === 0) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">National Events</h1>
          <p className="text-muted-foreground">
            Register for RCMs, Summits, Conclaves, and Training Programs
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Calendar className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No National Events Yet</h3>
            <p className="text-muted-foreground text-center max-w-md">
              National events will appear here once they are synced from the Yi National platform.
              Contact your chapter admin to set up national integration.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <NationalEventsPageClient events={events} />;
}

export default function NationalEventsPage() {
  return (
    <Suspense fallback={<EventsPageSkeleton />}>
      <NationalEventsContent />
    </Suspense>
  );
}
