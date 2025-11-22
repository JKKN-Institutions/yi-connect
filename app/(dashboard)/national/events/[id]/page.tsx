import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Calendar,
  MapPin,
  Users,
  Video,
  Clock,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Building,
  User,
  Mail,
  Phone
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { getNationalEventById } from '@/lib/data/national-integration';
import { EventRegistrationForm } from '@/components/national/event-registration-form';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ register?: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  // In production, fetch actual event data
  return {
    title: `Event Details | Yi Connect`,
    description: 'View national event details and register'
  };
}

async function EventDetailContent({ eventId, showRegister }: { eventId: string; showRegister: boolean }) {
  const event = await getNationalEventById(eventId);

  if (!event) {
    // Mock event for demonstration
    const mockEvent = {
      id: eventId,
      national_event_id: `nat-${eventId}`,
      title: 'Yi National Summit 2025',
      description: `Join us for the Yi National Summit 2025, the premier gathering of Yi members from across the country. This three-day event will feature:

• Keynote speeches from industry leaders
• Interactive workshops on leadership development
• Networking sessions with fellow Yi members
• Panel discussions on emerging trends
• Awards ceremony recognizing outstanding chapters

Don't miss this opportunity to connect, learn, and grow with the Yi community!`,
      event_type: 'summit' as const,
      start_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      end_date: new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString(),
      venue: 'Taj Palace Hotel',
      city: 'Mumbai',
      state: 'Maharashtra',
      address: '2, Sardar Patel Marg, Diplomatic Enclave',
      is_virtual: false,
      virtual_link: null,
      status: 'registration_open' as const,
      registration_deadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      registration_fee: 5000,
      early_bird_fee: 4000,
      early_bird_deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      max_participants: 500,
      current_registrations: 342,
      is_featured: true,
      contact_name: 'Yi National Office',
      contact_email: 'events@yinational.org',
      contact_phone: '+91 98765 43210',
      agenda_url: 'https://example.com/agenda.pdf',
      brochure_url: 'https://example.com/brochure.pdf',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return <EventDetail event={mockEvent} showRegister={showRegister} />;
  }

  return <EventDetail event={event} showRegister={showRegister} />;
}

function EventDetail({ event, showRegister }: { event: any; showRegister: boolean }) {
  const spotsLeft = event.max_participants ? event.max_participants - event.current_registrations : null;
  const isEarlyBird = event.early_bird_deadline && new Date(event.early_bird_deadline) > new Date();
  const currentFee = isEarlyBird ? event.early_bird_fee : event.registration_fee;

  const eventTypeLabels: Record<string, string> = {
    rcm: 'Regional Chapter Meet',
    summit: 'Yi Summit',
    yuva_conclave: 'Yuva Conclave',
    national_meet: 'National Meeting',
    training: 'Training Program',
    workshop: 'Workshop',
    conference: 'Conference',
    other: 'Other'
  };

  const statusColors: Record<string, string> = {
    upcoming: 'bg-blue-500',
    registration_open: 'bg-green-500',
    registration_closed: 'bg-yellow-500',
    ongoing: 'bg-purple-500',
    completed: 'bg-gray-500',
    cancelled: 'bg-red-500'
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main Content */}
      <div className="lg:col-span-2 space-y-6">
        {/* Header Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge className="bg-purple-100 text-purple-800">
                {eventTypeLabels[event.event_type] || event.event_type}
              </Badge>
              <Badge className={statusColors[event.status]}>
                {event.status.replace('_', ' ')}
              </Badge>
              {event.is_featured && (
                <Badge variant="outline" className="border-primary">
                  Featured
                </Badge>
              )}
            </div>
            <CardTitle className="text-2xl">{event.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose dark:prose-invert max-w-none">
              <p className="whitespace-pre-wrap">{event.description}</p>
            </div>
          </CardContent>
        </Card>

        {/* Event Details */}
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Date & Time</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(event.start_date), 'EEEE, MMMM d, yyyy')}
                    {event.end_date !== event.start_date && (
                      <> - {format(new Date(event.end_date), 'EEEE, MMMM d, yyyy')}</>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(event.start_date), 'h:mm a')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                {event.is_virtual ? (
                  <>
                    <Video className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Virtual Event</p>
                      <p className="text-sm text-muted-foreground">
                        Join link will be sent after registration
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">{event.venue}</p>
                      <p className="text-sm text-muted-foreground">
                        {event.address}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {event.city}, {event.state}
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Capacity</p>
                  <p className="text-sm text-muted-foreground">
                    {event.current_registrations} / {event.max_participants} registered
                  </p>
                  {spotsLeft !== null && spotsLeft < 50 && (
                    <Badge variant="destructive" className="mt-1">
                      Only {spotsLeft} spots left!
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Registration Deadline</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(event.registration_deadline), 'MMMM d, yyyy')}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Contact Information */}
            <div>
              <h4 className="font-medium mb-3">Contact Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {event.contact_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{event.contact_name}</span>
                  </div>
                )}
                {event.contact_email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${event.contact_email}`} className="text-primary hover:underline">
                      {event.contact_email}
                    </a>
                  </div>
                )}
                {event.contact_phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${event.contact_phone}`} className="text-primary hover:underline">
                      {event.contact_phone}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Resources */}
            {(event.agenda_url || event.brochure_url) && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium mb-3">Resources</h4>
                  <div className="flex flex-wrap gap-2">
                    {event.agenda_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={event.agenda_url} target="_blank" rel="noopener noreferrer">
                          View Agenda
                          <ExternalLink className="h-4 w-4 ml-2" />
                        </a>
                      </Button>
                    )}
                    {event.brochure_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={event.brochure_url} target="_blank" rel="noopener noreferrer">
                          Download Brochure
                          <ExternalLink className="h-4 w-4 ml-2" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* Registration Card */}
        <Card>
          <CardHeader>
            <CardTitle>Registration</CardTitle>
            <CardDescription>
              Secure your spot for this event
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Registration Fee</p>
              <p className="text-3xl font-bold">
                {currentFee ? `₹${currentFee.toLocaleString()}` : 'Free'}
              </p>
              {isEarlyBird && event.early_bird_fee && (
                <Badge variant="secondary" className="mt-2">
                  Early Bird Price!
                </Badge>
              )}
              {!isEarlyBird && event.early_bird_fee && event.registration_fee && (
                <p className="text-sm text-muted-foreground line-through mt-1">
                  Early bird: ₹{event.early_bird_fee.toLocaleString()}
                </p>
              )}
            </div>

            {event.status === 'registration_open' && (
              <Button className="w-full" size="lg" asChild>
                <Link href={`/national/events/${event.id}?register=true`}>
                  Register Now
                </Link>
              </Button>
            )}

            {event.status === 'registration_closed' && (
              <Button className="w-full" disabled>
                Registration Closed
              </Button>
            )}

            {event.status === 'completed' && (
              <Button className="w-full" disabled>
                Event Completed
              </Button>
            )}

            {event.early_bird_deadline && isEarlyBird && (
              <p className="text-sm text-center text-muted-foreground">
                Early bird ends: {format(new Date(event.early_bird_deadline), 'MMM d, yyyy')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* What's Included */}
        <Card>
          <CardHeader>
            <CardTitle>What's Included</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Access to all sessions</span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Networking opportunities</span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Event materials</span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Certificate of participation</span>
              </li>
              {!event.is_virtual && (
                <>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Meals included</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Event kit</span>
                  </li>
                </>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Registration Form Modal would go here */}
      {showRegister && (
        <EventRegistrationForm eventId={event.id} eventTitle={event.title} />
      )}
    </div>
  );
}

function EventDetailSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-8 w-3/4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default async function EventDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { register } = await searchParams;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Button variant="ghost" asChild className="mb-4">
        <Link href="/national/events">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Events
        </Link>
      </Button>

      <Suspense fallback={<EventDetailSkeleton />}>
        <EventDetailContent eventId={id} showRegister={register === 'true'} />
      </Suspense>
    </div>
  );
}
