/**
 * Event Detail Page
 *
 * Complete event details with RSVP, volunteers, and feedback.
 */

import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Video,
  Clock,
  Edit,
  Share2,
  Download,
  DollarSign,
  Award,
  UserPlus
} from 'lucide-react';
import { getCurrentUser } from '@/lib/data/auth';
import { createClient } from '@/lib/supabase/server';
import {
  getEventFull,
  getMemberRSVP,
  getEventFeedback,
  getEventDocuments,
  getVolunteerRoles
} from '@/lib/data/events';
import { RSVPForm, EventFeedbackForm, VolunteerAssignmentForm, ShareButton, EventQRCode, VolunteerMatcher } from '@/components/events';
import { FeedbackDisplay } from '@/components/events/event-feedback-form';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb';
import { getEventStatusVariant } from '@/types/event';
import Image from 'next/image';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function EventDetailPage({ params }: PageProps) {
  return (
    <Suspense fallback={<EventDetailSkeleton />}>
      <EventDetailContent params={params} />
    </Suspense>
  );
}

async function EventDetailContent({ params }: PageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Await params (Next.js 16 requirement)
  const { id } = await params;

  // Get user's hierarchy level
  const supabase = await createClient();
  const { data: hierarchyLevel } = await supabase.rpc(
    'get_user_hierarchy_level',
    {
      user_id: user.id
    }
  );
  const userHierarchyLevel = hierarchyLevel || 0;

  const event = await getEventFull(id);

  if (!event) {
    notFound();
  }

  const isOrganizer = event.organizer_id === user.id;
  const isAdmin = userHierarchyLevel <= 3;
  const canEdit = isOrganizer || isAdmin;

  // Get user's RSVP
  const userRSVP = await getMemberRSVP(event.id, user.id);

  // Get volunteer roles
  const volunteerRoles = await getVolunteerRoles();

  const statusVariant = getEventStatusVariant(event.status);
  const capacityPercentage = event.max_capacity
    ? (event.current_registrations / event.max_capacity) * 100
    : 0;

  const startDate = new Date(event.start_date);
  const endDate = new Date(event.end_date);
  const isMultiDay =
    format(startDate, 'yyyy-MM-dd') !== format(endDate, 'yyyy-MM-dd');
  const isPastEvent = endDate < new Date();
  const canRSVP = event.status === 'published' && !isPastEvent;

  return (
    <div className='flex flex-col gap-6'>
      {/* Breadcrumbs */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href='/dashboard'>Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href='/events'>Events</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{event.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className='flex items-start justify-between gap-4'>
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-2 mb-3'>
            <Badge variant={statusVariant}>{event.status}</Badge>
            {event.is_featured && <Badge variant='secondary'>Featured</Badge>}
            {event.is_virtual && (
              <Badge variant='outline'>
                <Video className='mr-1 h-3 w-3' />
                Virtual
              </Badge>
            )}
          </div>
          <h1 className='text-3xl font-bold tracking-tight mb-2 truncate'>
            {event.title}
          </h1>
          {event.description && (
            <p className='text-muted-foreground line-clamp-2 max-w-3xl'>
              {event.description}
            </p>
          )}
        </div>
        <div className='flex gap-2 shrink-0'>
          {canEdit && (
            <Button variant='outline' asChild>
              <Link href={`/events/${event.id}/edit`}>
                <Edit className='mr-2 h-4 w-4' />
                Edit
              </Link>
            </Button>
          )}
          <EventQRCode eventId={event.id} eventTitle={event.title} />
          <ShareButton eventId={event.id} eventTitle={event.title} />
        </div>
      </div>

      {/* Banner */}
      {event.banner_image_url && (
        <div className='relative w-full h-64 overflow-hidden rounded-lg border bg-muted'>
          <Image
            src={event.banner_image_url}
            alt={event.title}
            fill
            className='object-cover'
            priority
          />
        </div>
      )}

      <div className='grid gap-6 lg:grid-cols-3'>
        {/* Main Content */}
        <div className='lg:col-span-2 space-y-6'>
          {/* Full Description Card (if description is long) */}
          {event.description && event.description.length > 150 && (
            <Card>
              <CardHeader>
                <CardTitle>About This Event</CardTitle>
              </CardHeader>
              <CardContent>
                <p className='whitespace-pre-wrap text-muted-foreground leading-relaxed'>
                  {event.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Tabs for RSVPs, Volunteers, Feedback */}
          <Card>
            <Tabs defaultValue='rsvps' className='w-full'>
              <CardHeader className='pb-3'>
                <TabsList className='grid w-full grid-cols-4'>
                  <TabsTrigger value='rsvps' className='text-xs sm:text-sm'>
                    <Users className='mr-1 h-3 w-3 sm:h-4 sm:w-4' />
                    <span className='hidden sm:inline'>RSVPs</span>
                    <span className='sm:hidden'>({event.rsvps?.length || 0})</span>
                    <span className='hidden sm:inline ml-1'>({event.rsvps?.length || 0})</span>
                  </TabsTrigger>
                  <TabsTrigger value='volunteers' className='text-xs sm:text-sm'>
                    <Award className='mr-1 h-3 w-3 sm:h-4 sm:w-4' />
                    <span className='hidden sm:inline'>Volunteers</span>
                    <span className='sm:hidden'>({event.volunteers?.length || 0})</span>
                    <span className='hidden sm:inline ml-1'>({event.volunteers?.length || 0})</span>
                  </TabsTrigger>
                  <TabsTrigger value='feedback' className='text-xs sm:text-sm'>
                    <span className='hidden sm:inline'>Feedback</span>
                    <span className='sm:hidden'>FB</span>
                    <span className='ml-1'>({event.feedback?.length || 0})</span>
                  </TabsTrigger>
                  <TabsTrigger value='documents' className='text-xs sm:text-sm'>
                    <span className='hidden sm:inline'>Documents</span>
                    <span className='sm:hidden'>Docs</span>
                    <span className='ml-1'>({event.documents?.length || 0})</span>
                  </TabsTrigger>
                </TabsList>
              </CardHeader>

            <TabsContent value='rsvps' className='mt-0'>
              <CardContent className='space-y-4 pt-4'>
                <div className='flex items-center justify-between'>
                  <div>
                    <h3 className='font-semibold'>Attendees</h3>
                    <p className='text-sm text-muted-foreground'>
                      {event.current_registrations} member
                      {event.current_registrations !== 1 ? 's' : ''} registered
                      {event.guest_rsvps && event.guest_rsvps.length > 0 && (
                        <>
                          {' '}
                          + {event.guest_rsvps.length} guest
                          {event.guest_rsvps.length !== 1 ? 's' : ''}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <Separator />
                <div className='space-y-3'>
                  {event.rsvps && event.rsvps.length > 0 ? (
                    event.rsvps.map((rsvp) => (
                      <div
                        key={rsvp.id}
                        className='flex items-center justify-between'
                      >
                        <div className='flex items-center gap-3'>
                          <Avatar>
                            <AvatarImage
                              src={
                                (rsvp.member as any).profile?.avatar_url ||
                                undefined
                              }
                            />
                            <AvatarFallback>
                              {(
                                (rsvp.member as any).profile?.full_name || 'U'
                              ).charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className='font-medium'>
                              {(rsvp.member as any).profile?.full_name ||
                                'Unknown'}
                            </div>
                            <div className='text-sm text-muted-foreground'>
                              {rsvp.guests_count > 0 &&
                                `+${rsvp.guests_count} guest${
                                  rsvp.guests_count !== 1 ? 's' : ''
                                }`}
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant={
                            rsvp.status === 'confirmed'
                              ? 'success'
                              : rsvp.status === 'pending'
                              ? 'secondary'
                              : rsvp.status === 'attended'
                              ? 'default'
                              : 'destructive'
                          }
                        >
                          {rsvp.status}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className='text-sm text-muted-foreground text-center py-8'>
                      No RSVPs yet
                    </p>
                  )}
                </div>
              </CardContent>
            </TabsContent>

            <TabsContent value='volunteers' className='mt-0'>
              <CardContent className='space-y-4 pt-4'>
                <div className='flex items-center justify-between'>
                  <div>
                    <h3 className='font-semibold'>Volunteers</h3>
                    <p className='text-sm text-muted-foreground'>
                      Event volunteers and their roles
                    </p>
                  </div>
                  {canEdit && (
                    <VolunteerAssignmentForm
                      eventId={event.id}
                      roles={volunteerRoles}
                      trigger={
                        <Button size='sm'>
                          <UserPlus className='mr-2 h-4 w-4' />
                          Assign Volunteer
                        </Button>
                      }
                    />
                  )}
                </div>
                <Separator />
                <div className='space-y-3'>
                  {event.volunteers && event.volunteers.length > 0 ? (
                    event.volunteers.map((volunteer) => (
                      <div
                        key={volunteer.id}
                        className='flex items-center justify-between'
                      >
                        <div className='flex items-center gap-3'>
                          <Avatar>
                            <AvatarImage
                              src={
                                (volunteer.member as any).profile?.avatar_url ||
                                undefined
                              }
                            />
                            <AvatarFallback>
                              {(
                                (volunteer.member as any).profile?.full_name ||
                                'U'
                              ).charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className='font-medium'>
                              {(volunteer.member as any).profile?.full_name ||
                                'Unknown'}
                            </div>
                            <div className='text-sm text-muted-foreground'>
                              {volunteer.role_name}
                              {volunteer.hours_contributed &&
                                volunteer.hours_contributed > 0 && (
                                  <>
                                    {' '}
                                    • {volunteer.hours_contributed}h contributed
                                  </>
                                )}
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant={
                            volunteer.status === 'accepted'
                              ? 'success'
                              : volunteer.status === 'completed'
                              ? 'secondary'
                              : volunteer.status === 'declined'
                              ? 'destructive'
                              : 'default'
                          }
                        >
                          {volunteer.status}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className='text-sm text-muted-foreground text-center py-8'>
                      No volunteers assigned yet
                    </p>
                  )}
                </div>

                {/* Volunteer Matching Section */}
                {canEdit && event.status === 'published' && (
                  <>
                    <Separator className='my-6' />
                    <VolunteerMatcher
                      eventId={event.id}
                      requiredSkills={[]}
                    />
                  </>
                )}
              </CardContent>
            </TabsContent>

            <TabsContent value='feedback' className='mt-0'>
              <CardContent className='pt-4'>
              <div className='flex items-center justify-between mb-4'>
                <div>
                  <h3 className='text-lg font-semibold'>Event Feedback</h3>
                  <p className='text-sm text-muted-foreground'>
                    Reviews and ratings from attendees
                  </p>
                </div>
                {event.status === 'completed' && (
                  <EventFeedbackForm
                    eventId={event.id}
                    eventTitle={event.title}
                    memberId={user.id}
                  />
                )}
              </div>

              <Suspense fallback={<div>Loading feedback...</div>}>
                <FeedbackList eventId={event.id} />
              </Suspense>
              </CardContent>
            </TabsContent>

            <TabsContent value='documents' className='mt-0'>
              <CardContent className='space-y-4 pt-4'>
                <div className='flex items-center justify-between'>
                  <div>
                    <h3 className='font-semibold'>Event Documents</h3>
                    <p className='text-sm text-muted-foreground'>
                      Photos, reports, and certificates
                    </p>
                  </div>
                  {canEdit && <Button size='sm'>Upload Document</Button>}
                </div>
                <Separator />
                <Suspense fallback={<div className='text-sm text-muted-foreground py-4'>Loading documents...</div>}>
                  <DocumentsList eventId={event.id} />
                </Suspense>
              </CardContent>
            </TabsContent>
          </Tabs>
          </Card>
        </div>

        {/* Sidebar */}
        <div className='space-y-6'>
          {/* RSVP Card */}
          {canRSVP && (
            <Card>
              <CardHeader>
                <CardTitle>Register for Event</CardTitle>
              </CardHeader>
              <CardContent>
                <RSVPForm
                  event={event}
                  currentRSVP={userRSVP}
                  memberId={user.id}
                />
              </CardContent>
            </Card>
          )}

          {/* Event Details */}
          <Card>
            <CardHeader>
              <CardTitle>Event Details</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              {/* Date & Time */}
              <div className='flex items-start gap-3'>
                <Calendar className='h-5 w-5 mt-0.5 text-muted-foreground' />
                <div className='flex-1'>
                  <div className='font-medium'>
                    {format(startDate, 'EEEE, MMMM d, yyyy')}
                  </div>
                  <div className='text-sm text-muted-foreground'>
                    {format(startDate, 'h:mm a')}
                    {isMultiDay && (
                      <>
                        {' '}
                        - {format(endDate, 'MMM d')} at{' '}
                        {format(endDate, 'h:mm a')}
                      </>
                    )}
                    {!isMultiDay && <> - {format(endDate, 'h:mm a')}</>}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Location */}
              <div className='flex items-start gap-3'>
                {event.is_virtual ? (
                  <>
                    <Video className='h-5 w-5 mt-0.5 text-muted-foreground' />
                    <div className='flex-1'>
                      <div className='font-medium'>Virtual Event</div>
                      {event.virtual_meeting_link && (
                        <a
                          href={event.virtual_meeting_link}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-sm text-primary hover:underline'
                        >
                          Join Meeting
                        </a>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <MapPin className='h-5 w-5 mt-0.5 text-muted-foreground' />
                    <div className='flex-1'>
                      {event.venue ? (
                        <>
                          <div className='font-medium'>{event.venue.name}</div>
                          <div className='text-sm text-muted-foreground'>
                            {event.venue.address}
                            {event.venue.city && <>, {event.venue.city}</>}
                          </div>
                        </>
                      ) : event.venue_address ? (
                        <div className='text-sm'>{event.venue_address}</div>
                      ) : (
                        <div className='text-sm text-muted-foreground'>
                          Location TBD
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Capacity */}
              {event.max_capacity && (
                <>
                  <Separator />
                  <div>
                    <div className='flex items-center justify-between mb-2'>
                      <div className='flex items-center gap-2 text-sm font-medium'>
                        <Users className='h-4 w-4' />
                        Capacity
                      </div>
                      <span className='text-sm text-muted-foreground'>
                        {event.current_registrations} / {event.max_capacity}
                      </span>
                    </div>
                    <Progress value={capacityPercentage} className='h-2' />
                  </div>
                </>
              )}

              {/* Organizer */}
              {event.organizer?.profile && (
                <>
                  <Separator />
                  <div>
                    <div className='text-sm font-medium mb-2'>Organizer</div>
                    <div className='flex items-center gap-2'>
                      <Avatar className='h-8 w-8'>
                        <AvatarImage
                          src={event.organizer.profile.avatar_url || undefined}
                        />
                        <AvatarFallback>
                          {event.organizer.profile.full_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className='font-medium'>
                          {event.organizer.profile.full_name}
                        </div>
                        <div className='text-xs text-muted-foreground'>
                          {event.organizer.profile.email}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Budget */}
              {event.estimated_budget && (
                <>
                  <Separator />
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2 text-sm font-medium'>
                      <DollarSign className='h-4 w-4' />
                      Estimated Budget
                    </div>
                    <span className='text-sm'>
                      ₹{event.estimated_budget.toLocaleString()}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Impact Metrics */}
          {event.impact_metrics && (
            <Card>
              <CardHeader>
                <CardTitle>Impact Metrics</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm'>Attendance Rate</span>
                  <span className='font-medium'>
                    {Math.round(event.impact_metrics.attendance_rate || 0)}%
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-sm'>Volunteer Hours</span>
                  <span className='font-medium'>
                    {event.impact_metrics.total_volunteer_hours || 0}h
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-sm'>Average Rating</span>
                  <span className='font-medium flex items-center gap-1'>
                    <Award className='h-4 w-4 text-yellow-500' />
                    {event.impact_metrics.average_rating?.toFixed(1) || 'N/A'}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

async function FeedbackList({ eventId }: { eventId: string }) {
  const feedback = await getEventFeedback(eventId);

  if (feedback.length === 0) {
    return (
      <div className='py-8 text-center'>
        <p className='text-sm text-muted-foreground'>
          No feedback yet. Be the first to share your thoughts!
        </p>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {feedback.map((item) => (
        <FeedbackDisplay key={item.id} feedback={item as any} />
      ))}
    </div>
  );
}

async function DocumentsList({ eventId }: { eventId: string }) {
  const documents = await getEventDocuments(eventId);

  if (documents.length === 0) {
    return (
      <div className='py-8 text-center'>
        <p className='text-sm text-muted-foreground'>
          No documents uploaded yet
        </p>
      </div>
    );
  }

  return (
    <div className='space-y-3'>
      {documents.map((doc) => (
        <div
          key={doc.id}
          className='flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors'
        >
          <div className='flex-1 min-w-0'>
            <div className='font-medium truncate'>{doc.title}</div>
            {doc.description && (
              <div className='text-sm text-muted-foreground line-clamp-1'>
                {doc.description}
              </div>
            )}
            <div className='flex items-center gap-2 mt-2'>
              <Badge variant='outline' className='text-xs'>
                {doc.document_type}
              </Badge>
              {doc.file_size_kb && (
                <span className='text-xs text-muted-foreground'>
                  {(doc.file_size_kb / 1024).toFixed(1)} MB
                </span>
              )}
            </div>
          </div>
          <Button variant='outline' size='sm' className='ml-4 shrink-0' asChild>
            <a href={doc.file_url} target='_blank' rel='noopener noreferrer'>
              <Download className='h-4 w-4 mr-2' />
              <span className='hidden sm:inline'>Download</span>
            </a>
          </Button>
        </div>
      ))}
    </div>
  );
}

function EventDetailSkeleton() {
  return (
    <div className='flex flex-col gap-6'>
      {/* Breadcrumbs Skeleton */}
      <div className='flex items-center gap-2'>
        <Skeleton className='h-4 w-20' />
        <Skeleton className='h-4 w-4' />
        <Skeleton className='h-4 w-16' />
        <Skeleton className='h-4 w-4' />
        <Skeleton className='h-4 w-32' />
      </div>

      {/* Header Skeleton */}
      <div className='flex items-start justify-between gap-4'>
        <div className='flex-1 space-y-3'>
          <div className='flex items-center gap-2'>
            <Skeleton className='h-6 w-16' />
            <Skeleton className='h-6 w-20' />
          </div>
          <Skeleton className='h-9 w-96' />
          <Skeleton className='h-4 w-full max-w-2xl' />
        </div>
        <div className='flex gap-2'>
          <Skeleton className='h-10 w-24' />
          <Skeleton className='h-10 w-10' />
        </div>
      </div>

      {/* Banner Skeleton */}
      <Skeleton className='h-64 w-full rounded-lg' />

      <div className='grid gap-6 lg:grid-cols-3'>
        {/* Main Content Skeleton */}
        <div className='lg:col-span-2 space-y-6'>
          <Card>
            <CardHeader>
              <Skeleton className='h-6 w-40' />
            </CardHeader>
            <CardContent>
              <div className='space-y-2'>
                <Skeleton className='h-4 w-full' />
                <Skeleton className='h-4 w-full' />
                <Skeleton className='h-4 w-3/4' />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className='pt-6'>
              <div className='space-y-4'>
                <Skeleton className='h-10 w-full' />
                <Skeleton className='h-64 w-full' />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Skeleton */}
        <div className='space-y-6'>
          <Card>
            <CardHeader>
              <Skeleton className='h-6 w-32' />
            </CardHeader>
            <CardContent className='space-y-4'>
              <Skeleton className='h-4 w-full' />
              <Skeleton className='h-4 w-full' />
              <Skeleton className='h-4 w-3/4' />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className='h-6 w-32' />
            </CardHeader>
            <CardContent className='space-y-3'>
              <Skeleton className='h-4 w-full' />
              <Skeleton className='h-4 w-full' />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
