/**
 * Industrial Visit Detail Page
 * View full details and book an industrial visit
 */

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import {
  Building2,
  Calendar,
  Clock,
  MapPin,
  Users,
  Car,
  Phone,
  Mail,
  AlertCircle,
  CheckCircle2,
  Info,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { getIVById } from '@/lib/data/industrial-visits';
import { IVBookingForm } from '@/components/industrial-visits/iv-booking-form';
import { IVWaitlistButton } from '@/components/industrial-visits/iv-waitlist-button';
import { IVCarpoolList } from '@/components/industrial-visits/iv-carpool-list';

interface IVDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

// Static metadata to avoid prerendering issues with cookies
export const metadata: Metadata = {
  title: 'Industrial Visit Details | Yi Connect',
  description: 'View industrial visit details and book your spot',
};

async function IVDetailContent({ id }: { id: string }) {
  const iv = await getIVById(id);

  if (!iv) {
    notFound();
  }

  const startDate = new Date(iv.start_date);
  const endDate = iv.end_date ? new Date(iv.end_date) : null;
  const capacityPercentage = iv.max_capacity
    ? Math.round((iv.current_registrations / iv.max_capacity) * 100)
    : 0;
  const spotsRemaining = iv.max_capacity
    ? iv.max_capacity - iv.current_registrations
    : null;
  const hasCapacity = iv.max_capacity === null || spotsRemaining! > 0;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/industrial-visits/marketplace">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Marketplace
        </Link>
      </Button>

      {/* Hero Section */}
      <div className="relative">
        {iv.banner_image_url && (
          <div className="relative h-[300px] w-full rounded-lg overflow-hidden">
            <Image
              src={iv.banner_image_url}
              alt={iv.title}
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 text-white">
              <h1 className="text-4xl font-bold mb-2">{iv.title}</h1>
              {iv.industry && (
                <div className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5" />
                  {iv.industry.company_name}
                </div>
              )}
            </div>
          </div>
        )}

        {!iv.banner_image_url && (
          <div>
            <h1 className="text-4xl font-bold">{iv.title}</h1>
            {iv.industry && (
              <div className="flex items-center gap-2 text-lg text-muted-foreground mt-2">
                <Building2 className="h-5 w-5" />
                {iv.industry.company_name}
              </div>
            )}
          </div>
        )}

        {/* Status Badges */}
        <div className="flex gap-2 mt-4">
          <Badge
            variant={iv.entry_method === 'self_service' ? 'default' : 'secondary'}
          >
            {iv.entry_method === 'self_service' ? 'Industry Hosted' : 'Chapter Organized'}
          </Badge>
          {iv.industry?.industry_sector && (
            <Badge variant="outline">{iv.industry.industry_sector}</Badge>
          )}
          {hasCapacity ? (
            <Badge variant="default">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Available
            </Badge>
          ) : (
            <Badge variant="destructive">
              <AlertCircle className="mr-1 h-3 w-3" />
              Full
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {iv.description && (
            <Card>
              <CardHeader>
                <CardTitle>About This Visit</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {iv.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Learning Outcomes */}
          {iv.learning_outcomes && (
            <Card>
              <CardHeader>
                <CardTitle>Learning Outcomes</CardTitle>
                <CardDescription>
                  What you&apos;ll gain from this industrial visit
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {iv.learning_outcomes}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Requirements */}
          {iv.requirements && (
            <Card>
              <CardHeader>
                <CardTitle>Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {iv.requirements}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Logistics */}
          <Card>
            <CardHeader>
              <CardTitle>Logistics Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {iv.logistics_meeting_point && (
                <div className="flex gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Meeting Point</div>
                    <div className="text-muted-foreground">
                      {iv.logistics_meeting_point}
                    </div>
                  </div>
                </div>
              )}
              {iv.logistics_arrival_time && (
                <div className="flex gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Arrival Time</div>
                    <div className="text-muted-foreground">
                      {iv.logistics_arrival_time}
                    </div>
                  </div>
                </div>
              )}
              {iv.logistics_parking && (
                <div className="flex gap-3">
                  <Car className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Parking Information</div>
                    <div className="text-muted-foreground">
                      {iv.logistics_parking}
                    </div>
                  </div>
                </div>
              )}
              {iv.logistics_food && (
                <div className="flex gap-3">
                  <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Food & Refreshments</div>
                    <div className="text-muted-foreground">
                      {iv.logistics_food}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Carpool Options */}
          <Tabs defaultValue="details" className="w-full">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="carpool">
                Carpool Options
                {iv.carpool_drivers_count > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {iv.carpool_drivers_count}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="mt-4">
              {/* Contact Person */}
              {(iv.contact_person_name || iv.industry?.phone || iv.industry?.email) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {iv.contact_person_name && (
                      <div>
                        <div className="font-medium">{iv.contact_person_name}</div>
                        {iv.contact_person_role && (
                          <div className="text-sm text-muted-foreground">
                            {iv.contact_person_role}
                          </div>
                        )}
                      </div>
                    )}
                    {iv.contact_person_phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={`tel:${iv.contact_person_phone}`}
                          className="hover:underline"
                        >
                          {iv.contact_person_phone}
                        </a>
                      </div>
                    )}
                    {iv.industry?.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={`mailto:${iv.industry.email}`}
                          className="hover:underline"
                        >
                          {iv.industry.email}
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            <TabsContent value="carpool" className="mt-4">
              <IVCarpoolList eventId={iv.id} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Date & Time */}
          <Card>
            <CardHeader>
              <CardTitle>Event Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium">
                    {format(startDate, 'EEEE, MMMM d, yyyy')}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(startDate, 'h:mm a')} - {endDate ? format(endDate, 'h:mm a') : 'TBD'}
                  </div>
                </div>
              </div>
              <Separator />
              <div className="flex gap-3">
                <Users className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium">Capacity</div>
                  <div className="text-sm text-muted-foreground">
                    {iv.current_registrations}
                    {iv.max_capacity ? ` / ${iv.max_capacity}` : ''} registered
                  </div>
                  {iv.max_capacity && (
                    <>
                      <Progress
                        value={capacityPercentage}
                        className="mt-2 h-2"
                      />
                      <div className="text-xs text-muted-foreground mt-1">
                        {hasCapacity ? (
                          <span className="text-primary font-medium">
                            {spotsRemaining} spots remaining
                          </span>
                        ) : (
                          <span className="text-destructive font-medium">
                            Event is full
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Booking/Waitlist Card */}
          <Card>
            <CardHeader>
              <CardTitle>
                {hasCapacity ? 'Book Your Spot' : 'Join Waitlist'}
              </CardTitle>
              <CardDescription>
                {hasCapacity
                  ? 'Reserve your spot for this industrial visit'
                  : 'Get notified if a spot becomes available'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hasCapacity ? (
                <IVBookingForm eventId={iv.id} />
              ) : (
                <div className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Event is Full</AlertTitle>
                    <AlertDescription>
                      This event has reached maximum capacity. You can join the
                      waitlist to be notified if spots become available.
                    </AlertDescription>
                  </Alert>
                  {iv.waitlist_count > 0 && (
                    <div className="text-sm text-muted-foreground">
                      {iv.waitlist_count} {iv.waitlist_count === 1 ? 'person' : 'people'} on
                      waitlist
                    </div>
                  )}
                  <IVWaitlistButton eventId={iv.id} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Industry Info */}
          {iv.industry && (
            <Card>
              <CardHeader>
                <CardTitle>About the Company</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="font-medium">{iv.industry.company_name}</div>
                  {iv.industry.industry_sector && (
                    <div className="text-sm text-muted-foreground">
                      {iv.industry.industry_sector}
                    </div>
                  )}
                </div>
                {iv.industry.city && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {iv.industry.city}
                  </div>
                )}
                {iv.industry.website && (
                  <Button variant="outline" size="sm" asChild className="w-full">
                    <a
                      href={iv.industry.website}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Visit Website
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function IVDetailLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-32" />
      <Skeleton className="h-[300px] w-full rounded-lg" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-[200px] rounded-lg" />
          <Skeleton className="h-[200px] rounded-lg" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-[200px] rounded-lg" />
          <Skeleton className="h-[300px] rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default async function IVDetailPage({ params }: IVDetailPageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<IVDetailLoading />}>
      <IVDetailContent id={id} />
    </Suspense>
  );
}
