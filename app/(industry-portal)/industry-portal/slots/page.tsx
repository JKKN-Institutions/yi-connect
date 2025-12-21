/**
 * My Slots Page (Industry Portal)
 * View and manage industrial visit slots created by the industry
 */

import { Suspense } from 'react';
import { Metadata } from 'next';
import { CalendarPlus, Calendar, Users, TrendingUp, Edit, Trash2, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

import { getMyIndustrySlots } from '@/lib/data/industrial-visits';

// Temporary helper to get industry ID from auth
// TODO: Replace with proper industry authentication
async function getCurrentIndustryId(): Promise<string | null> {
  return 'placeholder-industry-id';
}

export const metadata: Metadata = {
  title: 'My Slots | Industry Portal',
  description: 'Manage your industrial visit slots',
};

// Force dynamic rendering since this page uses cookies for authentication
export const dynamic = 'force-dynamic';

async function MySlotsContent() {
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

  const slots = await getMyIndustrySlots(industryId);

  const upcomingSlots = slots.filter(
    (s) => new Date(s.start_date) > new Date() && s.status !== 'cancelled'
  );
  const pastSlots = slots.filter(
    (s) => new Date(s.start_date) <= new Date() && s.status !== 'cancelled'
  );
  const draftSlots = slots.filter((s) => s.status === 'draft');
  const cancelledSlots = slots.filter((s) => s.status === 'cancelled');

  const totalParticipants = slots.reduce((sum, slot) => sum + slot.current_registrations, 0);
  const avgUtilization = slots.length > 0
    ? Math.round(
        slots.reduce(
          (sum, slot) => sum + (slot.current_registrations / slot.max_capacity) * 100,
          0
        ) / slots.length
      )
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Slots</h1>
          <p className="text-muted-foreground mt-1">
            Manage your industrial visit opportunities
          </p>
        </div>
        <Button asChild>
          <Link href="/industry-portal/slots/new">
            <CalendarPlus className="mr-2 h-4 w-4" />
            Create New Slot
          </Link>
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold">{slots.length}</div>
          <p className="text-xs text-muted-foreground">Total Slots</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold text-primary">{upcomingSlots.length}</div>
          <p className="text-xs text-muted-foreground">Upcoming</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold text-green-600">{totalParticipants}</div>
          <p className="text-xs text-muted-foreground">Total Participants</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold text-blue-600">{avgUtilization}%</div>
          <p className="text-xs text-muted-foreground">Avg. Utilization</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList>
          <TabsTrigger value="upcoming">
            Upcoming
            {upcomingSlots.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {upcomingSlots.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
          <TabsTrigger value="draft">
            Drafts
            {draftSlots.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {draftSlots.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>

        {/* Upcoming Slots */}
        <TabsContent value="upcoming" className="mt-6">
          {upcomingSlots.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No upcoming slots</h3>
                <p className="text-muted-foreground text-center max-w-md mb-4">
                  Create your first industrial visit slot to start hosting Yi members
                </p>
                <Button asChild>
                  <Link href="/industry-portal/slots/new">
                    <CalendarPlus className="mr-2 h-4 w-4" />
                    Create New Slot
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {upcomingSlots.map((slot) => {
                const capacityPercentage = Math.round(
                  (slot.current_registrations / slot.max_capacity) * 100
                );
                const spotsRemaining = slot.max_capacity - slot.current_registrations;
                const startDate = new Date(slot.start_date);
                const endDate = new Date(slot.end_date);

                return (
                  <Card key={slot.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-lg line-clamp-2">
                            {slot.title}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {format(startDate, 'EEEE, MMMM d, yyyy')}
                          </CardDescription>
                        </div>
                        <Badge variant={slot.status === 'published' ? 'default' : 'secondary'}>
                          {slot.status}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {slot.current_registrations} / {slot.max_capacity} registered
                          </span>
                        </div>
                        {spotsRemaining > 0 ? (
                          <span className="text-xs font-medium text-primary">
                            {spotsRemaining} spots left
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-destructive">
                            Full
                          </span>
                        )}
                      </div>

                      <Progress value={capacityPercentage} className="h-2" />

                      {slot.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 pt-2 border-t">
                          {slot.description}
                        </p>
                      )}
                    </CardContent>

                    <CardFooter className="flex gap-2">
                      <Button asChild variant="outline" size="sm" className="flex-1">
                        <Link href={`/industry-portal/slots/${slot.id}`}>
                          View Details
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/industry-portal/attendees?slot=${slot.id}`}>
                          <Users className="h-4 w-4" />
                        </Link>
                      </Button>
                      {spotsRemaining === 0 && (
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/industry-portal/slots/${slot.id}/increase-capacity`}>
                            <PlusCircle className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Past Slots */}
        <TabsContent value="past" className="mt-6">
          {pastSlots.length === 0 ? (
            <Alert>
              <Calendar className="h-4 w-4" />
              <AlertDescription>
                You don&apos;t have any past industrial visit slots yet.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {pastSlots.map((slot) => {
                const startDate = new Date(slot.start_date);

                return (
                  <Card key={slot.id} className="opacity-75">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-lg line-clamp-2">
                            {slot.title}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {format(startDate, 'MMMM d, yyyy')}
                          </CardDescription>
                        </div>
                        <Badge variant="secondary">Completed</Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {slot.current_registrations} participants attended
                        </span>
                      </div>
                    </CardContent>

                    <CardFooter>
                      <Button asChild variant="outline" size="sm" className="w-full">
                        <Link href={`/industry-portal/slots/${slot.id}`}>
                          View Details
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Draft Slots */}
        <TabsContent value="draft" className="mt-6">
          {draftSlots.length === 0 ? (
            <Alert>
              <AlertDescription>You don&apos;t have any draft slots.</AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {draftSlots.map((slot) => (
                <Card key={slot.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg line-clamp-2">
                          {slot.title}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          Created {format(new Date(slot.created_at), 'MMM d, yyyy')}
                        </CardDescription>
                      </div>
                      <Badge variant="outline">Draft</Badge>
                    </div>
                  </CardHeader>

                  <CardFooter className="flex gap-2">
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link href={`/industry-portal/slots/${slot.id}/edit`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Link>
                    </Button>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Cancelled Slots */}
        <TabsContent value="cancelled" className="mt-6">
          {cancelledSlots.length === 0 ? (
            <Alert>
              <AlertDescription>You don&apos;t have any cancelled slots.</AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {cancelledSlots.map((slot) => {
                const startDate = new Date(slot.start_date);

                return (
                  <Card key={slot.id} className="opacity-60">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-lg line-clamp-2">
                            {slot.title}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            Was scheduled for {format(startDate, 'MMM d, yyyy')}
                          </CardDescription>
                        </div>
                        <Badge variant="destructive">Cancelled</Badge>
                      </div>
                    </CardHeader>

                    <CardFooter>
                      <Button asChild variant="outline" size="sm" className="w-full">
                        <Link href={`/industry-portal/slots/${slot.id}`}>
                          View Details
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MySlotsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function MySlotsPage() {
  return (
    <Suspense fallback={<MySlotsLoading />}>
      <MySlotsContent />
    </Suspense>
  );
}
