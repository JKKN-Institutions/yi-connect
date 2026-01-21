/**
 * Industrial Visits Hub Page
 * Main landing page with overview stats and navigation to sub-sections
 */

import { Suspense } from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import {
  Factory,
  Calendar,
  Users,
  BookOpen,
  BarChart3,
  Settings,
  ArrowRight,
  Clock,
  MapPin,
  Car,
  TrendingUp,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { requireRole, getCurrentChapterId } from '@/lib/auth';
import { getAvailableIVs, getMyIVBookings } from '@/lib/data/industrial-visits';
import { getCurrentUser } from '@/lib/data/auth';
import { format } from 'date-fns';

export const metadata: Metadata = {
  title: 'Industrial Visits | Yi Connect',
  description: 'Explore and book industrial visits organized by your chapter',
};

// Quick navigation sections
const navigationSections = [
  {
    title: 'Browse Marketplace',
    description: 'Discover and book available industrial visits',
    href: '/industrial-visits/marketplace',
    icon: Factory,
    color: 'bg-blue-500',
  },
  {
    title: 'My Bookings',
    description: 'View your registered industrial visits',
    href: '/industrial-visits/my-bookings',
    icon: BookOpen,
    color: 'bg-green-500',
  },
  {
    title: 'Analytics',
    description: 'View insights and performance metrics',
    href: '/industrial-visits/analytics',
    icon: BarChart3,
    color: 'bg-purple-500',
  },
];

const adminSection = {
  title: 'Manage Visits',
  description: 'Create and manage industrial visits',
  href: '/industrial-visits/admin',
  icon: Settings,
  color: 'bg-orange-500',
};

async function IVHubContent() {
  // All authenticated users can view the hub
  const user = await requireRole([
    'Super Admin',
    'National Admin',
    'Chair',
    'Co-Chair',
    'Executive Member',
    'EC Member',
    'Member',
  ]);

  const chapterId = await getCurrentChapterId();

  if (!chapterId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Factory className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">
          You need to be a member of a chapter to access industrial visits.
        </p>
      </div>
    );
  }

  // Fetch data in parallel
  const [availableIVs, myBookings] = await Promise.all([
    getAvailableIVs(chapterId),
    getMyIVBookings(),
  ]);

  // Calculate stats
  const upcomingIVs = availableIVs.filter(
    (iv) => new Date(iv.start_date) > new Date()
  );
  const spotsAvailable = availableIVs.filter((iv) => iv.has_capacity);
  const carpoolOptions = availableIVs.filter((iv) => iv.carpool_drivers_count > 0);

  // Check if user is admin
  const currentUser = await getCurrentUser();
  const isAdmin = currentUser?.role && [
    'Super Admin',
    'National Admin',
    'Chair',
    'Co-Chair',
    'Executive Member',
  ].includes(currentUser.role);

  // Get next upcoming IV
  const nextIV = upcomingIVs[0];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Industrial Visits</h1>
          <p className="text-muted-foreground mt-1">
            Explore industries, book visits, and expand your network
          </p>
        </div>
        <Button asChild>
          <Link href="/industrial-visits/marketplace">
            <Factory className="mr-2 h-4 w-4" />
            Browse All Visits
          </Link>
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Available</CardTitle>
            <Factory className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{availableIVs.length}</div>
            <p className="text-xs text-muted-foreground">industrial visits</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{upcomingIVs.length}</div>
            <p className="text-xs text-muted-foreground">scheduled visits</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Bookings</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{myBookings.length}</div>
            <p className="text-xs text-muted-foreground">registered visits</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Carpool Options</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{carpoolOptions.length}</div>
            <p className="text-xs text-muted-foreground">with rides available</p>
          </CardContent>
        </Card>
      </div>

      {/* Next Upcoming Visit Highlight */}
      {nextIV && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Next Upcoming Visit</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">{nextIV.title}</h3>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(nextIV.start_date), 'PPP')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {format(new Date(nextIV.start_date), 'p')}
                  </span>
                  {nextIV.industry_name && (
                    <span className="flex items-center gap-1">
                      <Factory className="h-4 w-4" />
                      {nextIV.industry_name}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 mt-2">
                  {nextIV.has_capacity ? (
                    <Badge variant="default" className="bg-green-600">
                      Spots Available
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Full</Badge>
                  )}
                  {nextIV.carpool_drivers_count > 0 && (
                    <Badge variant="outline">
                      <Car className="mr-1 h-3 w-3" />
                      Carpool Available
                    </Badge>
                  )}
                </div>
              </div>
              <Button asChild>
                <Link href={`/industrial-visits/${nextIV.id}`}>
                  View Details
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {navigationSections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader>
                <div
                  className={`w-10 h-10 rounded-lg ${section.color} flex items-center justify-center mb-2`}
                >
                  <section.icon className="h-5 w-5 text-white" />
                </div>
                <CardTitle className="text-lg">{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm text-primary flex items-center">
                  Go to {section.title.toLowerCase()}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}

        {isAdmin && (
          <Link href={adminSection.href}>
            <Card className="h-full transition-colors hover:bg-muted/50 border-orange-200">
              <CardHeader>
                <div
                  className={`w-10 h-10 rounded-lg ${adminSection.color} flex items-center justify-center mb-2`}
                >
                  <adminSection.icon className="h-5 w-5 text-white" />
                </div>
                <CardTitle className="text-lg">{adminSection.title}</CardTitle>
                <CardDescription>{adminSection.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm text-primary flex items-center">
                  Go to admin panel
                  <ArrowRight className="ml-1 h-4 w-4" />
                </span>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

      {/* Recent Available Visits Preview */}
      {availableIVs.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recently Added</CardTitle>
              <CardDescription>Latest industrial visits available for booking</CardDescription>
            </div>
            <Button variant="outline" asChild>
              <Link href="/industrial-visits/marketplace">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {availableIVs.slice(0, 3).map((iv) => (
                <Link
                  key={iv.id}
                  href={`/industrial-visits/${iv.id}`}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{iv.title}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(iv.start_date), 'MMM d, yyyy')}
                      </span>
                      {iv.industry_name && (
                        <span className="flex items-center gap-1">
                          <Factory className="h-3 w-3" />
                          {iv.industry_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {iv.has_capacity ? (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        Available
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Full</Badge>
                    )}
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function IVHubLoading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Skeleton className="h-9 w-[250px]" />
          <Skeleton className="h-4 w-[400px] mt-2" />
        </div>
        <Skeleton className="h-10 w-[180px]" />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[120px] rounded-lg" />
        ))}
      </div>

      <Skeleton className="h-[150px] rounded-lg" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[180px] rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function IndustrialVisitsPage() {
  return (
    <Suspense fallback={<IVHubLoading />}>
      <IVHubContent />
    </Suspense>
  );
}
