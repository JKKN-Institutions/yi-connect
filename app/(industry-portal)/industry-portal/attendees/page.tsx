/**
 * Attendees Page (Industry Portal)
 * View and export attendee lists for industrial visit slots
 */

import { Suspense } from 'react';
import { Metadata } from 'next';
import { Users, Download, Filter, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { IndustryAttendeesTable } from '@/components/industrial-visits/industry-portal/industry-attendees-table';
import { getAllIndustryAttendees, getMyIndustrySlots } from '@/lib/data/industrial-visits';

export const metadata: Metadata = {
  title: 'Attendees | Industry Portal',
  description: 'View and manage attendees for your industrial visit slots',
};

// Force dynamic rendering since this page uses cookies for authentication
export const dynamic = 'force-dynamic';

// Temporary helper to get industry ID from auth
async function getCurrentIndustryId(): Promise<string | null> {
  return 'placeholder-industry-id';
}

async function AttendeesContent({
  searchParams,
}: {
  searchParams: Promise<{ slot?: string }>;
}) {
  const params = await searchParams;
  const industryId = await getCurrentIndustryId();

  if (!industryId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">
          You need to be authenticated as an industry user to access this page.
        </p>
      </div>
    );
  }

  const [attendees, slots] = await Promise.all([
    getAllIndustryAttendees(industryId),
    getMyIndustrySlots(industryId),
  ]);

  const totalAttendees = attendees.length;
  const upcomingEvents = slots.filter(
    (s) => new Date(s.start_date) > new Date() && s.status !== 'cancelled'
  ).length;
  const familyMembers = attendees.reduce((sum, a) => sum + a.family_count, 0);
  const carpoolRequests = attendees.filter(
    (a) => a.carpool_status === 'need_ride' || a.carpool_status === 'offering_ride'
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendees</h1>
          <p className="text-muted-foreground mt-1">
            View and manage registered participants for your slots
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export All
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold">{totalAttendees}</div>
          <p className="text-xs text-muted-foreground">Total Attendees</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold text-primary">{upcomingEvents}</div>
          <p className="text-xs text-muted-foreground">Upcoming Events</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold text-green-600">{familyMembers}</div>
          <p className="text-xs text-muted-foreground">Family Members</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold text-blue-600">{carpoolRequests}</div>
          <p className="text-xs text-muted-foreground">Carpool Requests</p>
        </div>
      </div>

      {/* Attendees Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registered Participants</CardTitle>
          <CardDescription>
            View and export lists of participants registered for your industrial visits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IndustryAttendeesTable
            slotId={params.slot}
            attendees={attendees}
            slots={slots.map((s) => ({
              id: s.id,
              title: s.title,
              start_date: s.start_date,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function AttendeesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-96 mt-2" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>

      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}

export default function AttendeesPage({
  searchParams,
}: {
  searchParams: Promise<{ slot?: string }>;
}) {
  return (
    <Suspense fallback={<AttendeesLoading />}>
      <AttendeesContent searchParams={searchParams} />
    </Suspense>
  );
}
