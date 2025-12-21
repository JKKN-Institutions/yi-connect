'use client';
'use no memo';

/**
 * Event Form Component
 *
 * Comprehensive form for creating and editing events.
 * Supports all event types, venues, templates, and scheduling.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CalendarIcon,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Check,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { createEvent, updateEvent } from '@/app/actions/events';
import {
  createEventSchema,
  type CreateEventInput
} from '@/lib/validations/event';
import { EVENT_CATEGORIES } from '@/types/event';
import type {
  EventWithDetails,
  Venue,
  EventTemplate,
  EventCategory
} from '@/types/event';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ImageUpload } from '@/components/ui/image-upload';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LocationPicker } from '@/components/ui/location-picker';
import toast from 'react-hot-toast';

interface EventFormProps {
  event?: EventWithDetails;
  venues?: Venue[];
  templates?: EventTemplate[];
  chapterId?: string;
}

export function EventForm(props: EventFormProps) {
  const {
    event,
    venues: venuesProp = [],
    templates: templatesProp = [],
    chapterId
  } = props;

  const venues = venuesProp as Venue[];
  const templates = templatesProp as EventTemplate[];

  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedTemplate, setSelectedTemplate] =
    useState<EventTemplate | null>(null);

  const isEditing = !!event;
  const [currentTab, setCurrentTab] = useState('basic');
  const tabs = ['basic', 'schedule', 'venue', 'settings'];

  const form = useForm<CreateEventInput>({
    // @ts-expect-error - zodResolver infers input type (with optional defaults) but form needs output type
    resolver: zodResolver(createEventSchema),
    mode: 'onChange', // Enable real-time validation
    defaultValues: {
      title: event?.title || '',
      description: event?.description || '',
      category: (event?.category as EventCategory | undefined) || 'other',
      start_date: event?.start_date || '',
      end_date: event?.end_date || '',
      registration_start_date: event?.registration_start_date || '',
      registration_end_date: event?.registration_end_date || '',
      venue_id: event?.venue?.id || '',
      venue_address: event?.venue_address || '',
      venue_latitude: event?.venue_latitude ?? null,
      venue_longitude: event?.venue_longitude ?? null,
      is_virtual: event?.is_virtual || false,
      virtual_meeting_link: event?.virtual_meeting_link || '',
      max_capacity: event?.max_capacity ?? ('' as any),
      waitlist_enabled: event?.waitlist_enabled || false,
      requires_approval: event?.requires_approval || false,
      send_reminders: event?.send_reminders ?? true,
      allow_guests: event?.allow_guests || false,
      guest_limit: event?.guest_limit || 0,
      estimated_budget: event?.estimated_budget ?? ('' as any),
      banner_image_url: event?.banner_image_url || '',
      tags: (event?.tags as string[]) || [],
      template_id: event?.template?.id || '',
      chapter_id: event?.chapter?.id || chapterId || ''
    }
  });

  const isVirtual = form.watch('is_virtual');
  const allowGuests = form.watch('allow_guests');

  // Apply template when selected
  const applyTemplate = (template: any) => {
    setSelectedTemplate(template as EventTemplate);
    (form.setValue as any)('category', template.category);
    (form.setValue as any)(
      'max_capacity',
      template.default_capacity || undefined
    );
    (form.setValue as any)('template_id', template.id);
    toast.success(`Applied template: ${template.name}`);
  };

  const onSubmit = (data: CreateEventInput) => {
    console.log('Form submitted with data:', data);
    console.log('Form errors:', form.formState.errors);

    startTransition(async () => {
      try {
        if (isEditing && event) {
          const result = await updateEvent(event.id, data);
          if (result.success) {
            toast.success('Event updated successfully');
            router.push(`/events/${event.id}`);
          } else {
            console.error('Update error:', result.error);
            toast.error(result.error || 'Failed to update event');
          }
        } else {
          console.log('Creating event...');
          const result = await createEvent(data);
          console.log('Create result:', result);
          if (result.success && result.data) {
            toast.success('Event created successfully');
            router.push(`/events/${result.data.id}`);
          } else {
            console.error('Create error:', result.error);
            toast.error(result.error || 'Failed to create event');
          }
        }
      } catch (error) {
        console.error('Unexpected error:', error);
        toast.error('An unexpected error occurred');
      }
    });
  };

  const handleNext = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    e?.stopPropagation();

    const currentIndex = tabs.indexOf(currentTab);
    if (currentIndex < tabs.length - 1) {
      // Define fields for each tab
      const tabFields: Record<string, Array<keyof CreateEventInput>> = {
        basic: ['title', 'description', 'category', 'banner_image_url'],
        schedule: [
          'start_date',
          'end_date',
          'registration_start_date',
          'registration_end_date'
        ],
        venue: [
          'is_virtual',
          'venue_id',
          'venue_address',
          'venue_latitude',
          'venue_longitude',
          'virtual_meeting_link'
        ],
        settings: [
          'max_capacity',
          'waitlist_enabled',
          'requires_approval',
          'send_reminders',
          'allow_guests',
          'guest_limit',
          'estimated_budget'
        ]
      };

      // Validate only current tab fields
      const fieldsToValidate = tabFields[currentTab] || [];

      console.log('Current tab:', currentTab);
      console.log('Fields to validate:', fieldsToValidate);
      console.log('Current form values:', form.getValues());
      console.log(
        'Current form errors before validation:',
        form.formState.errors
      );

      // Trigger validation only for current tab fields
      const isValid = await form.trigger(fieldsToValidate as any);

      console.log('Validation result:', isValid);
      console.log('Form errors after validation:', form.formState.errors);

      if (isValid) {
        setCurrentTab(tabs[currentIndex + 1]);
      } else {
        // Show specific error message based on current tab
        const errorMessages: Record<string, string> = {
          basic: 'Please complete all required fields in Basic Info',
          schedule: 'Please provide valid dates for the event',
          venue: 'Please provide venue details or mark as virtual event',
          settings: 'Please check event settings'
        };

        // Log specific errors
        const currentErrors = form.formState.errors;
        console.error('Validation failed for tab:', currentTab);
        console.error('Field errors:', currentErrors);

        toast.error(
          errorMessages[currentTab] ||
            'Please fix validation errors before continuing'
        );
      }
    }
  };

  const handlePrevious = (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    e?.stopPropagation();

    const currentIndex = tabs.indexOf(currentTab);
    if (currentIndex > 0) {
      setCurrentTab(tabs[currentIndex - 1]);
    }
  };

  const currentTabIndex = tabs.indexOf(currentTab);
  const isFirstTab = currentTabIndex === 0;
  const isLastTab = currentTabIndex === tabs.length - 1;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit as any)} className='space-y-8'>
        <Tabs
          value={currentTab}
          onValueChange={setCurrentTab}
          className='w-full'
        >
          <TabsList className='grid w-full grid-cols-4'>
            <TabsTrigger value='basic' className='relative'>
              Basic Info
              {form.formState.errors.title ||
              form.formState.errors.description ||
              form.formState.errors.category ? (
                <span className='absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full' />
              ) : null}
            </TabsTrigger>
            <TabsTrigger value='schedule' className='relative'>
              Schedule
              {form.formState.errors.start_date ||
              form.formState.errors.end_date ? (
                <span className='absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full' />
              ) : null}
            </TabsTrigger>
            <TabsTrigger value='venue' className='relative'>
              Venue
              {form.formState.errors.venue_address ||
              form.formState.errors.virtual_meeting_link ? (
                <span className='absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full' />
              ) : null}
            </TabsTrigger>
            <TabsTrigger value='settings'>Settings</TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value='basic' className='space-y-6'>
            <Card>
              <CardHeader>
                <CardTitle>Event Details</CardTitle>
                <CardDescription>
                  Provide the basic information about your event
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                {/* Template Selection */}
                {!isEditing && templates.length > 0 && (
                  <div className='space-y-2'>
                    <FormLabel>Start from Template (Optional)</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        const template = templates.find(
                          (t) => (t as any).id === value
                        );
                        if (template) applyTemplate(template as EventTemplate);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Select a template...' />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem
                            key={(template as any).id}
                            value={(template as any).id}
                          >
                            {(template as any).name} -{' '}
                            {
                              (EVENT_CATEGORIES as any)[
                                (template as any).category
                              ]
                            }
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedTemplate && (
                      <p className='text-sm text-muted-foreground'>
                        {(selectedTemplate as any).description}
                      </p>
                    )}
                  </div>
                )}

                <FormField
                  control={form.control as any}
                  name='title'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Title *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='Annual Networking Gala'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name='description'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder='Provide a detailed description of the event...'
                          className='min-h-32'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name='category'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className='w-full'>
                            <SelectValue placeholder='Select a category' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(EVENT_CATEGORIES).map(
                            ([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name='banner_image_url'
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <ImageUpload
                          value={field.value}
                          onChange={field.onChange}
                          label='Banner Image'
                          description='Upload an event banner image or enter a URL. Recommended size: 1920x816px (21:9 ratio)'
                          aspectRatio='21/9'
                          maxSizeMB={5}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value='schedule' className='space-y-6'>
            <Card>
              <CardHeader>
                <CardTitle>Event Schedule</CardTitle>
                <CardDescription>
                  Set the event dates and registration period
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid gap-4 md:grid-cols-2'>
                  <FormField
                    control={form.control as any}
                    name='start_date'
                    render={({ field }) => {
                      const dateValue = field.value ? new Date(field.value) : undefined;
                      const hours = dateValue ? dateValue.getHours().toString().padStart(2, '0') : '09';
                      const minutes = dateValue ? dateValue.getMinutes().toString().padStart(2, '0') : '00';

                      const handleDateChange = (date: Date | undefined) => {
                        if (date) {
                          const newDate = new Date(date);
                          if (dateValue) {
                            newDate.setHours(dateValue.getHours(), dateValue.getMinutes());
                          } else {
                            newDate.setHours(9, 0); // Default to 9:00 AM
                          }
                          field.onChange(newDate.toISOString());
                        }
                      };

                      const handleTimeChange = (type: 'hours' | 'minutes', value: string) => {
                        const numValue = parseInt(value) || 0;
                        const date = dateValue ? new Date(dateValue) : new Date();
                        if (type === 'hours') {
                          date.setHours(Math.min(23, Math.max(0, numValue)));
                        } else {
                          date.setMinutes(Math.min(59, Math.max(0, numValue)));
                        }
                        field.onChange(date.toISOString());
                      };

                      return (
                        <FormItem className='flex flex-col'>
                          <FormLabel>Start Date & Time *</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant='outline'
                                  className={cn(
                                    'w-full pl-3 text-left font-normal',
                                    !field.value && 'text-muted-foreground'
                                  )}
                                >
                                  {field.value ? (
                                    format(new Date(field.value), 'PPP hh:mm a')
                                  ) : (
                                    <span>Pick date & time</span>
                                  )}
                                  <CalendarIcon className='ml-auto h-4 w-4 opacity-50' />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className='w-auto p-0' align='start'>
                              <Calendar
                                mode='single'
                                selected={dateValue}
                                onSelect={handleDateChange}
                                disabled={(date) => {
                                  const today = new Date();
                                  today.setHours(0, 0, 0, 0);
                                  return date < today;
                                }}
                                initialFocus
                              />
                              <div className='border-t p-3'>
                                <Label className='text-sm font-medium flex items-center gap-2 mb-2'>
                                  <Clock className='h-4 w-4' />
                                  Select Time
                                </Label>
                                <div className='flex items-center gap-2'>
                                  <Input
                                    type='number'
                                    min='0'
                                    max='23'
                                    value={hours}
                                    onChange={(e) => handleTimeChange('hours', e.target.value)}
                                    className='w-16 text-center'
                                    placeholder='HH'
                                  />
                                  <span className='text-lg font-bold'>:</span>
                                  <Input
                                    type='number'
                                    min='0'
                                    max='59'
                                    value={minutes}
                                    onChange={(e) => handleTimeChange('minutes', e.target.value)}
                                    className='w-16 text-center'
                                    placeholder='MM'
                                  />
                                  <span className='text-sm text-muted-foreground ml-2'>
                                    ({dateValue ? format(dateValue, 'hh:mm a') : '--:--'})
                                  </span>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />

                  <FormField
                    control={form.control as any}
                    name='end_date'
                    render={({ field }) => {
                      const dateValue = field.value ? new Date(field.value) : undefined;
                      const hours = dateValue ? dateValue.getHours().toString().padStart(2, '0') : '17';
                      const minutes = dateValue ? dateValue.getMinutes().toString().padStart(2, '0') : '00';

                      const handleDateChange = (date: Date | undefined) => {
                        if (date) {
                          const newDate = new Date(date);
                          if (dateValue) {
                            newDate.setHours(dateValue.getHours(), dateValue.getMinutes());
                          } else {
                            newDate.setHours(17, 0); // Default to 5:00 PM
                          }
                          field.onChange(newDate.toISOString());
                        }
                      };

                      const handleTimeChange = (type: 'hours' | 'minutes', value: string) => {
                        const numValue = parseInt(value) || 0;
                        const date = dateValue ? new Date(dateValue) : new Date();
                        if (type === 'hours') {
                          date.setHours(Math.min(23, Math.max(0, numValue)));
                        } else {
                          date.setMinutes(Math.min(59, Math.max(0, numValue)));
                        }
                        field.onChange(date.toISOString());
                      };

                      return (
                        <FormItem className='flex flex-col'>
                          <FormLabel>End Date & Time *</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant='outline'
                                  className={cn(
                                    'w-full pl-3 text-left font-normal',
                                    !field.value && 'text-muted-foreground'
                                  )}
                                >
                                  {field.value ? (
                                    format(new Date(field.value), 'PPP hh:mm a')
                                  ) : (
                                    <span>Pick date & time</span>
                                  )}
                                  <CalendarIcon className='ml-auto h-4 w-4 opacity-50' />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className='w-auto p-0' align='start'>
                              <Calendar
                                mode='single'
                                selected={dateValue}
                                onSelect={handleDateChange}
                                disabled={(date) => {
                                  const today = new Date();
                                  today.setHours(0, 0, 0, 0);
                                  return date < today;
                                }}
                                initialFocus
                              />
                              <div className='border-t p-3'>
                                <Label className='text-sm font-medium flex items-center gap-2 mb-2'>
                                  <Clock className='h-4 w-4' />
                                  Select Time
                                </Label>
                                <div className='flex items-center gap-2'>
                                  <Input
                                    type='number'
                                    min='0'
                                    max='23'
                                    value={hours}
                                    onChange={(e) => handleTimeChange('hours', e.target.value)}
                                    className='w-16 text-center'
                                    placeholder='HH'
                                  />
                                  <span className='text-lg font-bold'>:</span>
                                  <Input
                                    type='number'
                                    min='0'
                                    max='59'
                                    value={minutes}
                                    onChange={(e) => handleTimeChange('minutes', e.target.value)}
                                    className='w-16 text-center'
                                    placeholder='MM'
                                  />
                                  <span className='text-sm text-muted-foreground ml-2'>
                                    ({dateValue ? format(dateValue, 'hh:mm a') : '--:--'})
                                  </span>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                </div>

                <div className='grid gap-4 md:grid-cols-2'>
                  <FormField
                    control={form.control as any}
                    name='registration_start_date'
                    render={({ field }) => (
                      <FormItem className='flex flex-col'>
                        <FormLabel>Registration Start</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant='outline'
                                className={cn(
                                  'w-full pl-3 text-left font-normal',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                {field.value ? (
                                  format(new Date(field.value), 'PPP')
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className='ml-auto h-4 w-4 opacity-50' />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className='w-auto p-0' align='start'>
                            <Calendar
                              mode='single'
                              selected={
                                field.value ? new Date(field.value) : undefined
                              }
                              onSelect={(date) => {
                                if (date) {
                                  field.onChange(date.toISOString());
                                }
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control as any}
                    name='registration_end_date'
                    render={({ field }) => (
                      <FormItem className='flex flex-col'>
                        <FormLabel>Registration End</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant='outline'
                                className={cn(
                                  'w-full pl-3 text-left font-normal',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                {field.value ? (
                                  format(new Date(field.value), 'PPP')
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className='ml-auto h-4 w-4 opacity-50' />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className='w-auto p-0' align='start'>
                            <Calendar
                              mode='single'
                              selected={
                                field.value ? new Date(field.value) : undefined
                              }
                              onSelect={(date) => {
                                if (date) {
                                  field.onChange(date.toISOString());
                                }
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Venue Tab */}
          <TabsContent value='venue' className='space-y-6'>
            <Card>
              <CardHeader>
                <CardTitle>Event Location</CardTitle>
                <CardDescription>
                  Choose between in-person or virtual event
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <FormField
                  control={form.control as any}
                  name='is_virtual'
                  render={({ field }) => (
                    <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                      <div className='space-y-0.5'>
                        <FormLabel className='text-base'>
                          Virtual Event
                        </FormLabel>
                        <FormDescription>
                          This event will be held online
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {isVirtual ? (
                  <FormField
                    control={form.control as any}
                    name='virtual_meeting_link'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meeting Link</FormLabel>
                        <FormControl>
                          <Input
                            placeholder='https://meet.google.com/xxx-xxxx-xxx'
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Zoom, Google Meet, or other virtual meeting link
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={form.control as any}
                    name='venue_address'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Venue Location</FormLabel>
                        <FormControl>
                          <LocationPicker
                            address={field.value || ''}
                            latitude={form.watch('venue_latitude')}
                            longitude={form.watch('venue_longitude')}
                            onAddressChange={(address) => {
                              field.onChange(address);
                            }}
                            onCoordinatesChange={(lat, lng) => {
                              form.setValue('venue_latitude', lat);
                              form.setValue('venue_longitude', lng);
                            }}
                            placeholder='Search for a venue location...'
                          />
                        </FormControl>
                        <FormDescription>
                          Search for a location, use your current location, or enter coordinates manually
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value='settings' className='space-y-6'>
            <Card>
              <CardHeader>
                <CardTitle>Event Settings</CardTitle>
                <CardDescription>
                  Configure capacity, approvals, and guest settings
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid gap-4 md:grid-cols-2'>
                  <FormField
                    control={form.control as any}
                    name='max_capacity'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maximum Capacity</FormLabel>
                        <FormControl>
                          <Input
                            type='number'
                            placeholder='100'
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                e.target.valueAsNumber || undefined
                              )
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          Leave empty for unlimited capacity
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control as any}
                    name='estimated_budget'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated Budget</FormLabel>
                        <FormControl>
                          <Input
                            type='number'
                            placeholder='50000'
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                e.target.valueAsNumber || undefined
                              )
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          Estimated budget in INR
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control as any}
                  name='waitlist_enabled'
                  render={({ field }) => (
                    <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                      <div className='space-y-0.5'>
                        <FormLabel className='text-base'>
                          Enable Waitlist
                        </FormLabel>
                        <FormDescription>
                          Allow registrations when capacity is full
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name='requires_approval'
                  render={({ field }) => (
                    <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                      <div className='space-y-0.5'>
                        <FormLabel className='text-base'>
                          Require Approval
                        </FormLabel>
                        <FormDescription>
                          Manually approve RSVPs before confirmation
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name='send_reminders'
                  render={({ field }) => (
                    <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                      <div className='space-y-0.5'>
                        <FormLabel className='text-base'>
                          Send Reminders
                        </FormLabel>
                        <FormDescription>
                          Automatically send event reminders to attendees
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name='allow_guests'
                  render={({ field }) => (
                    <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                      <div className='space-y-0.5'>
                        <FormLabel className='text-base'>
                          Allow Guests
                        </FormLabel>
                        <FormDescription>
                          Members can bring guests to this event
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {allowGuests && (
                  <FormField
                    control={form.control as any}
                    name='guest_limit'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Guest Limit per Member</FormLabel>
                        <FormControl>
                          <Input
                            type='number'
                            placeholder='2'
                            {...field}
                            onChange={(e) =>
                              field.onChange(e.target.valueAsNumber || 0)
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          Maximum guests each member can bring
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Form Actions */}
        <div className='flex justify-between gap-4'>
          <div className='flex gap-2'>
            {!isFirstTab && (
              <Button
                type='button'
                variant='outline'
                onClick={handlePrevious}
                disabled={isPending}
              >
                <ChevronLeft className='mr-2 h-4 w-4' />
                Previous
              </Button>
            )}
          </div>

          <div className='flex gap-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => router.back()}
              disabled={isPending}
            >
              Cancel
            </Button>

            {!isLastTab ? (
              <Button type='button' onClick={handleNext} disabled={isPending}>
                Save & Next
                <ChevronRight className='ml-2 h-4 w-4' />
              </Button>
            ) : (
              <Button type='submit' disabled={isPending}>
                {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                {!isPending && <Check className='mr-2 h-4 w-4' />}
                {isEditing ? 'Update Event' : 'Create Event'}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Form>
  );
}
