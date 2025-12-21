/**
 * Event Detail Page
 *
 * Professional event details with RSVP, volunteers, and feedback.
 * Editorial-style design with clean typography and refined spacing.
 */

import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { requireRole } from '@/lib/auth';
import {
  Calendar,
  MapPin,
  Users,
  Video,
  Clock,
  Edit,
  Download,
  DollarSign,
  Award,
  UserPlus,
  ExternalLink,
  Image as ImageIcon,
  MessageSquare,
  FileText,
  ChevronRight
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
import {
  RSVPForm,
  EventFeedbackForm,
  VolunteerAssignmentForm,
  ShareButton,
  EventQRCode,
  VolunteerMatcher,
  EventPublishButton
} from '@/components/events';
import { FeedbackDisplay } from '@/components/events/event-feedback-form';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

export default async function EventDetailPage({ params }: PageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member', 'Member']);

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

  const { id } = await params;

  const supabase = await createClient();
  const { data: hierarchyLevel } = await supabase.rpc(
    'get_user_hierarchy_level',
    { user_id: user.id }
  );
  const userHierarchyLevel = hierarchyLevel || 0;

  const event = await getEventFull(id);

  if (!event) {
    notFound();
  }

  const isOrganizer = event.organizer?.id === user.id;
  const isAdmin = userHierarchyLevel >= 4;
  const canEdit = isOrganizer || isAdmin;

  const userRSVP = await getMemberRSVP(event.id, user.id);
  const volunteerRoles = await getVolunteerRoles();

  const statusVariant = getEventStatusVariant(event.status);
  const capacityPercentage = event.max_capacity
    ? (event.current_registrations / event.max_capacity) * 100
    : 0;

  const startDate = new Date(event.start_date);
  const endDate = event.end_date ? new Date(event.end_date) : startDate;
  const isMultiDay = format(startDate, 'yyyy-MM-dd') !== format(endDate, 'yyyy-MM-dd');
  const isPastEvent = endDate < new Date();
  const canRSVP = event.status === 'published' && !isPastEvent;

  return (
    <div className='min-h-screen'>
      {/* Breadcrumbs */}
      <Breadcrumb className='mb-6'>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href='/dashboard' className='text-muted-foreground hover:text-foreground transition-colors'>
              Dashboard
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className='h-4 w-4' />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbLink href='/events' className='text-muted-foreground hover:text-foreground transition-colors'>
              Events
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className='h-4 w-4' />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage className='font-medium text-foreground'>
              {event.title.length > 30 ? event.title.slice(0, 30) + '...' : event.title}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Hero Header */}
      <div className='relative mb-6 sm:mb-8'>
        {/* Background gradient */}
        <div className='absolute inset-0 bg-gradient-to-br from-orange-50 via-amber-50/50 to-background dark:from-orange-950/20 dark:via-amber-950/10 dark:to-background rounded-xl sm:rounded-2xl -z-10' />

        <div className='p-4 sm:p-6 lg:p-8'>
          {/* Status & Actions Row */}
          <div className='flex flex-wrap items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6'>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge
                variant={statusVariant}
                className='px-3 py-1 text-xs font-semibold uppercase tracking-wider'
              >
                {event.status}
              </Badge>
              {event.is_featured && (
                <Badge variant='secondary' className='px-3 py-1 text-xs font-medium'>
                  ⭐ Featured
                </Badge>
              )}
              {event.is_virtual && (
                <Badge variant='outline' className='px-3 py-1 text-xs font-medium'>
                  <Video className='mr-1.5 h-3 w-3' />
                  Virtual
                </Badge>
              )}
            </div>

            <div className='flex items-center gap-2'>
              {canEdit && event.status === 'draft' && (
                <EventPublishButton
                  eventId={event.id}
                  eventTitle={event.title}
                  status={event.status}
                  canPublish={canEdit}
                />
              )}
              {canEdit && (
                <Button variant='outline' size='sm' asChild className='shadow-sm'>
                  <Link href={`/events/${event.id}/edit`}>
                    <Edit className='mr-2 h-4 w-4' />
                    Edit
                  </Link>
                </Button>
              )}
              <EventQRCode eventId={event.id} eventTitle={event.title} />
              <ShareButton
                eventId={event.id}
                eventTitle={event.title}
                eventDescription={event.description || undefined}
                eventDate={format(startDate, 'EEEE, MMMM d, yyyy')}
                eventTime={format(startDate, 'h:mm a')}
                eventVenue={event.venue_address || (event as any).venue?.name || undefined}
                eventImageUrl={event.banner_image_url || undefined}
              />
            </div>
          </div>

          {/* Title */}
          <h1 className='text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground mb-3 sm:mb-4 leading-tight'>
            {event.title}
          </h1>

          {/* Quick Info Bar */}
          <div className='flex flex-wrap items-center gap-x-4 sm:gap-x-6 gap-y-2 sm:gap-y-3 text-xs sm:text-sm text-muted-foreground'>
            <div className='flex items-center gap-2'>
              <Calendar className='h-4 w-4 text-orange-500' />
              <span className='font-medium text-foreground'>
                {format(startDate, 'EEE, MMM d, yyyy')}
              </span>
              <span>at {format(startDate, 'h:mm a')}</span>
            </div>

            {!event.is_virtual && event.venue_address && (
              <div className='flex items-center gap-2'>
                <MapPin className='h-4 w-4 text-orange-500' />
                <span>{event.venue_address.split(',')[0]}</span>
              </div>
            )}

            {event.is_virtual && (
              <div className='flex items-center gap-2'>
                <Video className='h-4 w-4 text-orange-500' />
                <span>Online Event</span>
              </div>
            )}

            <div className='flex items-center gap-2'>
              <Users className='h-4 w-4 text-orange-500' />
              <span>{event.current_registrations} registered</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className='grid gap-6 lg:gap-8 lg:grid-cols-12'>
        {/* Left Column - Main Content (order-2 on mobile so poster shows first) */}
        <div className='order-2 lg:order-1 lg:col-span-8 space-y-6'>
          {/* Description Card */}
          {event.description && (
            <Card className='overflow-hidden border-0 shadow-sm bg-card/50 backdrop-blur-sm'>
              <CardContent className='p-4 sm:p-6'>
                <div className='prose prose-sm dark:prose-invert max-w-none'>
                  <p className='text-muted-foreground leading-relaxed whitespace-pre-wrap'>
                    {event.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs Section */}
          <Card className='overflow-hidden border-0 shadow-sm'>
            <Tabs defaultValue='rsvps' className='w-full'>
              {/* Scrollable tabs container for mobile */}
              <div className='border-b bg-muted/30 overflow-x-auto scrollbar-hide'>
                <TabsList className='h-auto p-0 bg-transparent inline-flex min-w-full sm:w-full justify-start rounded-none'>
                  <TabsTrigger
                    value='rsvps'
                    className='relative flex-shrink-0 px-3 sm:px-5 py-3 sm:py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-all'
                  >
                    <Users className='h-4 w-4 sm:mr-2' />
                    <span className='hidden sm:inline font-medium'>RSVPs</span>
                    <span className='ml-1 sm:ml-2 text-xs bg-muted px-1.5 sm:px-2 py-0.5 rounded-full'>
                      {event.rsvps?.length || 0}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger
                    value='volunteers'
                    className='relative flex-shrink-0 px-3 sm:px-5 py-3 sm:py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-all'
                  >
                    <Award className='h-4 w-4 sm:mr-2' />
                    <span className='hidden sm:inline font-medium'>Volunteers</span>
                    <span className='ml-1 sm:ml-2 text-xs bg-muted px-1.5 sm:px-2 py-0.5 rounded-full'>
                      {event.volunteers?.length || 0}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger
                    value='feedback'
                    className='relative flex-shrink-0 px-3 sm:px-5 py-3 sm:py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-all'
                  >
                    <MessageSquare className='h-4 w-4 sm:mr-2' />
                    <span className='hidden sm:inline font-medium'>Feedback</span>
                    <span className='ml-1 sm:ml-2 text-xs bg-muted px-1.5 sm:px-2 py-0.5 rounded-full'>
                      {event.feedback?.length || 0}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger
                    value='documents'
                    className='relative flex-shrink-0 px-3 sm:px-5 py-3 sm:py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-all'
                  >
                    <FileText className='h-4 w-4 sm:mr-2' />
                    <span className='hidden sm:inline font-medium'>Docs</span>
                    <span className='ml-1 sm:ml-2 text-xs bg-muted px-1.5 sm:px-2 py-0.5 rounded-full'>
                      {event.documents?.length || 0}
                    </span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value='rsvps' className='mt-0 p-4 sm:p-6'>
                <div className='flex items-center justify-between mb-6'>
                  <div>
                    <h3 className='text-lg font-semibold'>Attendees</h3>
                    <p className='text-sm text-muted-foreground mt-1'>
                      {event.current_registrations} member{event.current_registrations !== 1 ? 's' : ''} registered
                      {event.guest_rsvps && event.guest_rsvps.length > 0 && (
                        <> + {event.guest_rsvps.length} guest{event.guest_rsvps.length !== 1 ? 's' : ''}</>
                      )}
                    </p>
                  </div>
                </div>

                <div className='space-y-3'>
                  {(event as any).rsvps && (event as any).rsvps.length > 0 ? (
                    (event as any).rsvps.map((rsvp: any) => (
                      <div
                        key={rsvp.id}
                        className='flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors'
                      >
                        <div className='flex items-center gap-4'>
                          <Avatar className='h-10 w-10 ring-2 ring-background'>
                            <AvatarImage src={rsvp.member?.profile?.avatar_url || undefined} />
                            <AvatarFallback className='bg-orange-100 text-orange-700 font-semibold'>
                              {(rsvp.member?.profile?.full_name || 'U').charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className='font-medium'>{rsvp.member?.profile?.full_name || 'Unknown'}</div>
                            {rsvp.guests_count > 0 && (
                              <div className='text-sm text-muted-foreground'>
                                +{rsvp.guests_count} guest{rsvp.guests_count !== 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant={
                            rsvp.status === 'confirmed' ? 'success' :
                            rsvp.status === 'pending' ? 'secondary' :
                            rsvp.status === 'attended' ? 'default' : 'destructive'
                          }
                          className='capitalize'
                        >
                          {rsvp.status}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <div className='text-center py-12'>
                      <div className='w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4'>
                        <Users className='h-8 w-8 text-muted-foreground/50' />
                      </div>
                      <p className='text-muted-foreground font-medium'>No RSVPs yet</p>
                      <p className='text-sm text-muted-foreground/70 mt-1'>Be the first to register!</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value='volunteers' className='mt-0 p-4 sm:p-6'>
                <div className='flex items-center justify-between mb-6'>
                  <div>
                    <h3 className='text-lg font-semibold'>Volunteers</h3>
                    <p className='text-sm text-muted-foreground mt-1'>Event volunteers and their roles</p>
                  </div>
                  {canEdit && (
                    <VolunteerAssignmentForm
                      eventId={event.id}
                      roles={volunteerRoles}
                      trigger={
                        <Button size='sm' className='shadow-sm'>
                          <UserPlus className='mr-2 h-4 w-4' />
                          Assign
                        </Button>
                      }
                    />
                  )}
                </div>

                <div className='space-y-3'>
                  {(event as any).volunteers && (event as any).volunteers.length > 0 ? (
                    (event as any).volunteers.map((volunteer: any) => (
                      <div
                        key={volunteer.id}
                        className='flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors'
                      >
                        <div className='flex items-center gap-4'>
                          <Avatar className='h-10 w-10 ring-2 ring-background'>
                            <AvatarImage src={volunteer.member?.profile?.avatar_url || undefined} />
                            <AvatarFallback className='bg-green-100 text-green-700 font-semibold'>
                              {(volunteer.member?.profile?.full_name || 'U').charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className='font-medium'>{volunteer.member?.profile?.full_name || 'Unknown'}</div>
                            <div className='text-sm text-muted-foreground'>
                              {volunteer.role_name}
                              {volunteer.hours_contributed > 0 && (
                                <> · {volunteer.hours_contributed}h contributed</>
                              )}
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant={
                            volunteer.status === 'accepted' ? 'success' :
                            volunteer.status === 'completed' ? 'secondary' :
                            volunteer.status === 'declined' ? 'destructive' : 'default'
                          }
                          className='capitalize'
                        >
                          {volunteer.status}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <div className='text-center py-12'>
                      <div className='w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4'>
                        <Award className='h-8 w-8 text-muted-foreground/50' />
                      </div>
                      <p className='text-muted-foreground font-medium'>No volunteers yet</p>
                      <p className='text-sm text-muted-foreground/70 mt-1'>Assign volunteers to help with this event</p>
                    </div>
                  )}
                </div>

                {canEdit && event.status === 'published' && (
                  <>
                    <Separator className='my-8' />
                    <VolunteerMatcher eventId={event.id} requiredSkills={[]} />
                  </>
                )}
              </TabsContent>

              <TabsContent value='feedback' className='mt-0 p-4 sm:p-6'>
                <div className='flex items-center justify-between mb-6'>
                  <div>
                    <h3 className='text-lg font-semibold'>Event Feedback</h3>
                    <p className='text-sm text-muted-foreground mt-1'>Reviews and ratings from attendees</p>
                  </div>
                  {event.status === 'completed' && (
                    <EventFeedbackForm
                      eventId={event.id}
                      eventTitle={event.title}
                      memberId={user.id}
                    />
                  )}
                </div>

                <Suspense fallback={<div className='text-center py-8 text-muted-foreground'>Loading feedback...</div>}>
                  <FeedbackList eventId={event.id} />
                </Suspense>
              </TabsContent>

              <TabsContent value='documents' className='mt-0 p-4 sm:p-6'>
                <div className='flex items-center justify-between mb-6'>
                  <div>
                    <h3 className='text-lg font-semibold'>Event Documents</h3>
                    <p className='text-sm text-muted-foreground mt-1'>Photos, reports, and certificates</p>
                  </div>
                  {canEdit && (
                    <Button size='sm' className='shadow-sm'>
                      <Download className='mr-2 h-4 w-4' />
                      Upload
                    </Button>
                  )}
                </div>

                <Suspense fallback={<div className='text-center py-8 text-muted-foreground'>Loading documents...</div>}>
                  <DocumentsList eventId={event.id} />
                </Suspense>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        {/* Right Column - Sidebar (order-1 on mobile so poster shows first) */}
        <div className='order-1 lg:order-2 lg:col-span-4 space-y-6'>
          {/* Event Poster */}
          {event.banner_image_url ? (
            <Card className='overflow-hidden border-0 shadow-sm'>
              <div className='relative aspect-[3/4] w-full bg-gradient-to-br from-muted to-muted/50'>
                <Image
                  src={event.banner_image_url}
                  alt={event.title}
                  fill
                  className='object-cover'
                  priority
                  sizes='(max-width: 1024px) 100vw, 33vw'
                />
              </div>
              <CardContent className='p-4 bg-muted/30'>
                <a
                  href={event.banner_image_url}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='flex items-center justify-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors'
                >
                  <Download className='h-4 w-4' />
                  Download Poster
                </a>
              </CardContent>
            </Card>
          ) : (
            <Card className='overflow-hidden border-0 shadow-sm border-dashed'>
              <div className='aspect-[3/4] w-full bg-gradient-to-br from-muted/50 to-muted/30 flex flex-col items-center justify-center p-6'>
                <div className='w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4'>
                  <ImageIcon className='h-8 w-8 text-muted-foreground/40' />
                </div>
                <p className='text-sm font-medium text-muted-foreground'>No poster uploaded</p>
                <p className='text-xs text-muted-foreground/60 mt-1'>Add an event poster image</p>
              </div>
            </Card>
          )}

          {/* RSVP Card */}
          {canRSVP && (
            <Card className='overflow-hidden border-0 shadow-sm bg-gradient-to-br from-orange-50 to-amber-50/50 dark:from-orange-950/30 dark:to-amber-950/20'>
              <CardHeader className='pb-4'>
                <CardTitle className='text-lg'>Register for Event</CardTitle>
                <CardDescription>Secure your spot at this event</CardDescription>
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

          {/* Event Details Card */}
          <Card className='overflow-hidden border-0 shadow-sm'>
            <CardHeader className='pb-4'>
              <CardTitle className='text-lg'>Event Details</CardTitle>
            </CardHeader>
            <CardContent className='space-y-5'>
              {/* Date & Time */}
              <div className='flex gap-4'>
                <div className='flex-shrink-0 w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center'>
                  <Calendar className='h-5 w-5 text-orange-600 dark:text-orange-400' />
                </div>
                <div className='flex-1 min-w-0'>
                  <div className='font-medium text-foreground'>
                    {format(startDate, 'EEEE, MMMM d, yyyy')}
                  </div>
                  <div className='text-sm text-muted-foreground mt-0.5'>
                    {format(startDate, 'h:mm a')}
                    {isMultiDay ? (
                      <> – {format(endDate, 'MMM d')} at {format(endDate, 'h:mm a')}</>
                    ) : (
                      <> – {format(endDate, 'h:mm a')}</>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Location */}
              <div className='flex gap-4'>
                <div className='flex-shrink-0 w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center'>
                  {event.is_virtual ? (
                    <Video className='h-5 w-5 text-blue-600 dark:text-blue-400' />
                  ) : (
                    <MapPin className='h-5 w-5 text-blue-600 dark:text-blue-400' />
                  )}
                </div>
                <div className='flex-1 min-w-0'>
                  {event.is_virtual ? (
                    <>
                      <div className='font-medium text-foreground'>Virtual Event</div>
                      {event.virtual_meeting_link && (
                        <a
                          href={event.virtual_meeting_link}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-sm text-primary hover:underline flex items-center gap-1 mt-0.5'
                        >
                          Join Meeting
                          <ExternalLink className='h-3 w-3' />
                        </a>
                      )}
                    </>
                  ) : (
                    <>
                      {(event as any).venue ? (
                        <>
                          <div className='font-medium text-foreground'>{(event as any).venue.name}</div>
                          <div className='text-sm text-muted-foreground mt-0.5'>
                            {(event as any).venue.address}
                            {(event as any).venue.city && <>, {(event as any).venue.city}</>}
                          </div>
                        </>
                      ) : event.venue_address ? (
                        <div className='text-sm text-foreground'>{event.venue_address}</div>
                      ) : (
                        <div className='text-sm text-muted-foreground'>Location TBD</div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Capacity */}
              {event.max_capacity && (
                <>
                  <Separator />
                  <div>
                    <div className='flex items-center justify-between mb-3'>
                      <div className='flex items-center gap-2'>
                        <div className='w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center'>
                          <Users className='h-4 w-4 text-purple-600 dark:text-purple-400' />
                        </div>
                        <span className='text-sm font-medium'>Capacity</span>
                      </div>
                      <span className='text-sm font-semibold text-foreground'>
                        {event.current_registrations} / {event.max_capacity}
                      </span>
                    </div>
                    <Progress value={capacityPercentage} className='h-2' />
                    {capacityPercentage >= 80 && (
                      <p className='text-xs text-orange-600 dark:text-orange-400 mt-2 font-medium'>
                        ⚡ Filling up fast!
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Organizer */}
              {event.organizer?.profile && (
                <>
                  <Separator />
                  <div>
                    <div className='text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3'>
                      Organizer
                    </div>
                    <div className='flex items-center gap-3'>
                      <Avatar className='h-10 w-10 ring-2 ring-muted'>
                        <AvatarImage src={event.organizer.profile.avatar_url || undefined} />
                        <AvatarFallback className='bg-gradient-to-br from-orange-400 to-amber-500 text-white font-semibold'>
                          {event.organizer.profile.full_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className='min-w-0'>
                        <div className='font-medium text-foreground truncate'>
                          {event.organizer.profile.full_name}
                        </div>
                        <div className='text-xs text-muted-foreground truncate'>
                          {event.organizer.profile.email}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Budget */}
              {canEdit && event.estimated_budget && (
                <>
                  <Separator />
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <div className='w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center'>
                        <DollarSign className='h-4 w-4 text-green-600 dark:text-green-400' />
                      </div>
                      <span className='text-sm font-medium'>Budget</span>
                    </div>
                    <span className='text-sm font-semibold text-foreground'>
                      ₹{(event.estimated_budget as any).toLocaleString('en-IN')}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Impact Metrics */}
          {(event as any).impact_metrics && (
            <Card className='overflow-hidden border-0 shadow-sm'>
              <CardHeader className='pb-4'>
                <CardTitle className='text-lg flex items-center gap-2'>
                  <Award className='h-5 w-5 text-yellow-500' />
                  Impact Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid grid-cols-3 gap-4'>
                  <div className='text-center p-3 rounded-xl bg-muted/30'>
                    <div className='text-2xl font-bold text-foreground'>
                      {Math.round((event as any).impact_metrics.attendance_rate || 0)}%
                    </div>
                    <div className='text-xs text-muted-foreground mt-1'>Attendance</div>
                  </div>
                  <div className='text-center p-3 rounded-xl bg-muted/30'>
                    <div className='text-2xl font-bold text-foreground'>
                      {(event as any).impact_metrics.total_volunteer_hours || 0}h
                    </div>
                    <div className='text-xs text-muted-foreground mt-1'>Volunteer Hours</div>
                  </div>
                  <div className='text-center p-3 rounded-xl bg-muted/30'>
                    <div className='text-2xl font-bold text-foreground flex items-center justify-center gap-1'>
                      <Award className='h-4 w-4 text-yellow-500' />
                      {(event as any).impact_metrics.average_rating?.toFixed(1) || 'N/A'}
                    </div>
                    <div className='text-xs text-muted-foreground mt-1'>Rating</div>
                  </div>
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
      <div className='text-center py-12'>
        <div className='w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4'>
          <MessageSquare className='h-8 w-8 text-muted-foreground/50' />
        </div>
        <p className='text-muted-foreground font-medium'>No feedback yet</p>
        <p className='text-sm text-muted-foreground/70 mt-1'>Be the first to share your thoughts!</p>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {(feedback as any[]).map((item: any) => (
        <FeedbackDisplay key={item.id} feedback={item} />
      ))}
    </div>
  );
}

async function DocumentsList({ eventId }: { eventId: string }) {
  const documents = await getEventDocuments(eventId);

  if (documents.length === 0) {
    return (
      <div className='text-center py-12'>
        <div className='w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4'>
          <FileText className='h-8 w-8 text-muted-foreground/50' />
        </div>
        <p className='text-muted-foreground font-medium'>No documents yet</p>
        <p className='text-sm text-muted-foreground/70 mt-1'>Upload photos, reports, or certificates</p>
      </div>
    );
  }

  return (
    <div className='space-y-3'>
      {(documents as any[]).map((doc: any) => (
        <div
          key={doc.id}
          className='flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors'
        >
          <div className='flex-1 min-w-0'>
            <div className='font-medium truncate'>{doc.title}</div>
            {doc.description && (
              <div className='text-sm text-muted-foreground line-clamp-1 mt-0.5'>
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
          <Button variant='ghost' size='sm' className='ml-4 shrink-0' asChild>
            <a href={doc.file_url} target='_blank' rel='noopener noreferrer'>
              <Download className='h-4 w-4' />
            </a>
          </Button>
        </div>
      ))}
    </div>
  );
}

function EventDetailSkeleton() {
  return (
    <div className='min-h-screen'>
      {/* Breadcrumbs */}
      <div className='flex items-center gap-2 mb-6'>
        <Skeleton className='h-4 w-20' />
        <Skeleton className='h-4 w-4' />
        <Skeleton className='h-4 w-16' />
        <Skeleton className='h-4 w-4' />
        <Skeleton className='h-4 w-32' />
      </div>

      {/* Hero Header */}
      <div className='relative mb-8 p-6 sm:p-8 rounded-2xl bg-muted/30'>
        <div className='flex items-center gap-2 mb-6'>
          <Skeleton className='h-7 w-20' />
          <Skeleton className='h-7 w-24' />
        </div>
        <Skeleton className='h-10 w-96 mb-4' />
        <div className='flex gap-6'>
          <Skeleton className='h-5 w-40' />
          <Skeleton className='h-5 w-32' />
          <Skeleton className='h-5 w-28' />
        </div>
      </div>

      <div className='grid gap-8 lg:grid-cols-12'>
        {/* Main Content */}
        <div className='lg:col-span-8 space-y-6'>
          <Card className='border-0 shadow-sm'>
            <CardContent className='p-6'>
              <Skeleton className='h-4 w-full mb-2' />
              <Skeleton className='h-4 w-full mb-2' />
              <Skeleton className='h-4 w-3/4' />
            </CardContent>
          </Card>

          <Card className='border-0 shadow-sm'>
            <div className='border-b p-4'>
              <div className='flex gap-4'>
                <Skeleton className='h-10 w-24' />
                <Skeleton className='h-10 w-28' />
                <Skeleton className='h-10 w-24' />
                <Skeleton className='h-10 w-20' />
              </div>
            </div>
            <CardContent className='p-6'>
              <Skeleton className='h-64 w-full' />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className='lg:col-span-4 space-y-6'>
          <Card className='border-0 shadow-sm overflow-hidden'>
            <Skeleton className='aspect-[9/16] w-full' />
            <div className='p-4'>
              <Skeleton className='h-5 w-32 mx-auto' />
            </div>
          </Card>

          <Card className='border-0 shadow-sm'>
            <CardHeader>
              <Skeleton className='h-6 w-32' />
            </CardHeader>
            <CardContent className='space-y-5'>
              <div className='flex gap-4'>
                <Skeleton className='h-10 w-10 rounded-xl' />
                <div className='flex-1'>
                  <Skeleton className='h-5 w-40 mb-2' />
                  <Skeleton className='h-4 w-32' />
                </div>
              </div>
              <Separator />
              <div className='flex gap-4'>
                <Skeleton className='h-10 w-10 rounded-xl' />
                <div className='flex-1'>
                  <Skeleton className='h-5 w-36 mb-2' />
                  <Skeleton className='h-4 w-48' />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
