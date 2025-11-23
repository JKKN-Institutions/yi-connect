'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import {
  AnnouncementChannel,
  AudienceFilter,
  CommunicationSegment,
  AnnouncementTemplate,
  AVAILABLE_DYNAMIC_TAGS,
  replacePlaceholders
} from '@/types/communication';
import {
  createAnnouncementSchema,
  type CreateAnnouncementInput
} from '@/lib/validations/communication';
import {
  createAnnouncement,
  updateAnnouncement,
  sendAnnouncement,
  scheduleAnnouncement
} from '@/app/actions/communication';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChannelSelector } from './channel-selector';
import { AudienceTagger } from './audience-tagger';
import { SchedulePicker } from './schedule-picker';
import { PriorityBadge } from './status-badges';
import {
  Save,
  Send,
  Clock,
  Loader2,
  Sparkles,
  Info,
  Eye,
  EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface AnnouncementComposerProps {
  announcementId?: string;
  templates?: AnnouncementTemplate[];
  segments?: CommunicationSegment[];
  defaultValues?: Partial<CreateAnnouncementInput>;
  onSuccess?: (announcementId: string) => void;
  onCancel?: () => void;
  className?: string;
}

export function AnnouncementComposer({
  announcementId,
  templates = [],
  segments = [],
  defaultValues,
  onSuccess,
  onCancel,
  className
}: AnnouncementComposerProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitAction, setSubmitAction] = useState<
    'draft' | 'schedule' | 'send'
  >('draft');
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState('');

  const form = useForm<CreateAnnouncementInput>({
    resolver: zodResolver(createAnnouncementSchema),
    defaultValues: {
      title: defaultValues?.title || '',
      content: defaultValues?.content || '',
      channels: defaultValues?.channels || [],
      priority: defaultValues?.priority || 'normal',
      audience_filter: defaultValues?.audience_filter,
      segment_id: defaultValues?.segment_id,
      template_id: defaultValues?.template_id,
      scheduled_at: defaultValues?.scheduled_at
    }
  });

  const watchedContent = form.watch('content');
  const watchedTemplateId = form.watch('template_id');

  // Update preview when content changes
  useEffect(() => {
    if (showPreview && watchedContent) {
      // Replace placeholders with example data
      const exampleData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        chapterName: 'Chennai Chapter',
        eventName: 'Leadership Summit 2025',
        eventDate: 'March 15, 2025',
        eventLocation: 'Convention Center'
        // Add more example replacements as needed
      };

      setPreviewContent(replacePlaceholders(watchedContent, exampleData));
    }
  }, [watchedContent, showPreview]);

  // Load template when selected
  useEffect(() => {
    if (watchedTemplateId) {
      const template = templates.find((t) => t.id === watchedTemplateId);
      if (template) {
        form.setValue('content', template.content_template);
        if (template.default_channels && template.default_channels.length > 0) {
          form.setValue(
            'channels',
            template.default_channels as AnnouncementChannel[]
          );
        }
        toast.success(`Template "${template.name}" loaded`);
      }
    }
  }, [watchedTemplateId, templates, form]);

  const insertPlaceholder = (tag: string) => {
    const currentContent = form.getValues('content');
    const newContent = currentContent + ` {${tag}}`;
    form.setValue('content', newContent);
    form.setFocus('content');
  };

  const handleSubmit = async (data: CreateAnnouncementInput) => {
    setIsSubmitting(true);

    try {
      let result;

      if (submitAction === 'send') {
        // Create and send immediately
        if (announcementId) {
          result = await sendAnnouncement(announcementId);
        } else {
          const createResult = await createAnnouncement(data);
          if (createResult.success && createResult.data?.id) {
            result = await sendAnnouncement(createResult.data.id);
          } else {
            throw new Error(
              createResult.message || 'Failed to create announcement'
            );
          }
        }
      } else if (submitAction === 'schedule') {
        // Create and schedule
        if (!data.scheduled_at) {
          toast.error('Please select a scheduled time');
          setIsSubmitting(false);
          return;
        }

        if (announcementId) {
          result = await scheduleAnnouncement(
            announcementId,
            data.scheduled_at
          );
        } else {
          const createResult = await createAnnouncement(data);
          if (createResult.success && createResult.data?.id) {
            result = await scheduleAnnouncement(
              createResult.data.id,
              data.scheduled_at
            );
          } else {
            throw new Error(
              createResult.message || 'Failed to create announcement'
            );
          }
        }
      } else {
        // Save as draft
        if (announcementId) {
          result = await updateAnnouncement(announcementId, data);
        } else {
          result = await createAnnouncement(data);
        }
      }

      if (result.success) {
        toast.success(result.message || 'Announcement saved successfully');

        if (onSuccess && result.data?.id) {
          onSuccess(result.data.id);
        } else if (result.data?.id) {
          router.push(`/communications/announcements/${result.data.id}`);
        } else {
          router.push('/communications/announcements');
        }
      } else {
        toast.error(result.message || 'An error occurred');
      }
    } catch (error) {
      console.error('Submission error:', error);
      toast.error(
        error instanceof Error ? error.message : 'An unexpected error occurred'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className={cn('space-y-6', className)}
      >
        {/* Template Selector */}
        {templates.length > 0 && (
          <FormField
            control={form.control}
            name='template_id'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start from Template (Optional)</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={isSubmitting}
                >
                  <FormControl>
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder='Choose a template...' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className='flex items-center gap-2'>
                          <Sparkles className='h-4 w-4 text-primary' />
                          <span>{template.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Load a pre-made template with placeholders
                </FormDescription>
              </FormItem>
            )}
          />
        )}

        {/* Title */}
        <FormField
          control={form.control}
          name='title'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title *</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder='Enter announcement title...'
                  disabled={isSubmitting}
                  className='text-lg'
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Content */}
        <FormField
          control={form.control}
          name='content'
          render={({ field }) => (
            <FormItem>
              <div className='flex items-center justify-between'>
                <FormLabel>Message Content *</FormLabel>
                <div className='flex items-center gap-2'>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => setShowPreview(!showPreview)}
                  >
                    {showPreview ? (
                      <>
                        <EyeOff className='mr-2 h-4 w-4' />
                        Hide Preview
                      </>
                    ) : (
                      <>
                        <Eye className='mr-2 h-4 w-4' />
                        Show Preview
                      </>
                    )}
                  </Button>

                  {/* Dynamic Tags Popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type='button' variant='outline' size='sm'>
                        <Sparkles className='mr-2 h-4 w-4' />
                        Insert Placeholder
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className='w-80' align='end'>
                      <div className='space-y-4'>
                        <div>
                          <h4 className='font-semibold mb-2'>Dynamic Tags</h4>
                          <p className='text-sm text-muted-foreground'>
                            Click to insert placeholders that will be replaced
                            with member data
                          </p>
                        </div>

                        <div className='grid gap-2 max-h-64 overflow-y-auto'>
                          {AVAILABLE_DYNAMIC_TAGS.map((tag) => (
                            <Button
                              key={tag.tag}
                              type='button'
                              variant='outline'
                              size='sm'
                              onClick={() => insertPlaceholder(tag.tag)}
                              className='justify-start h-auto py-2'
                            >
                              <div className='flex flex-col items-start gap-1'>
                                <div className='flex items-center gap-2'>
                                  <code className='text-xs bg-muted px-2 py-0.5 rounded'>
                                    {tag.placeholder}
                                  </code>
                                </div>
                                <span className='text-xs text-muted-foreground'>
                                  {tag.description}
                                </span>
                              </div>
                            </Button>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <FormControl>
                <Textarea
                  {...field}
                  placeholder='Write your announcement message here... Use {firstName}, {lastName} and other placeholders for personalization.'
                  disabled={isSubmitting}
                  rows={12}
                  className='font-mono text-sm'
                />
              </FormControl>
              <FormDescription>
                Use placeholders like {'{firstName}'} for personalized messages
              </FormDescription>
              <FormMessage />

              {/* Preview */}
              {showPreview && watchedContent && (
                <Card className='mt-4'>
                  <CardHeader className='pb-3'>
                    <CardTitle className='text-sm font-medium flex items-center gap-2'>
                      <Info className='h-4 w-4' />
                      Preview (with example data)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='prose prose-sm max-w-none'>
                      <p className='whitespace-pre-wrap'>{previewContent}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </FormItem>
          )}
        />

        {/* Channels */}
        <FormField
          control={form.control}
          name='channels'
          render={({ field }) => (
            <FormItem>
              <ChannelSelector
                selectedChannels={field.value}
                onChange={field.onChange}
                disabled={isSubmitting}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Priority */}
        <FormField
          control={form.control}
          name='priority'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Priority Level</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
                disabled={isSubmitting}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value='low'>
                    <div className='flex items-center gap-2'>
                      <PriorityBadge priority='low' />
                      <span>Low Priority</span>
                    </div>
                  </SelectItem>
                  <SelectItem value='normal'>
                    <div className='flex items-center gap-2'>
                      <PriorityBadge priority='normal' />
                      <span>Normal Priority</span>
                    </div>
                  </SelectItem>
                  <SelectItem value='high'>
                    <div className='flex items-center gap-2'>
                      <PriorityBadge priority='high' />
                      <span>High Priority</span>
                    </div>
                  </SelectItem>
                  <SelectItem value='urgent'>
                    <div className='flex items-center gap-2'>
                      <PriorityBadge priority='urgent' />
                      <span>Urgent - Notify Immediately</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                High and urgent priorities will send push notifications
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Audience */}
        <AudienceTagger
          segmentId={form.watch('segment_id')}
          audienceFilter={form.watch('audience_filter')}
          segments={segments}
          onSegmentChange={(segmentId) =>
            form.setValue('segment_id', segmentId)
          }
          onFilterChange={(filter) => form.setValue('audience_filter', filter)}
          disabled={isSubmitting}
        />

        {/* Schedule */}
        <FormField
          control={form.control}
          name='scheduled_at'
          render={({ field }) => (
            <FormItem>
              <SchedulePicker
                scheduledAt={field.value ? new Date(field.value) : undefined}
                onChange={(date) => field.onChange(date?.toISOString())}
                disabled={isSubmitting}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Action Buttons */}
        <div className='flex items-center justify-between pt-6 border-t'>
          <Button
            type='button'
            variant='outline'
            onClick={onCancel || (() => router.back())}
            disabled={isSubmitting}
          >
            Cancel
          </Button>

          <div className='flex items-center gap-2'>
            <Button
              type='submit'
              variant='outline'
              disabled={isSubmitting}
              onClick={() => setSubmitAction('draft')}
            >
              {isSubmitting && submitAction === 'draft' ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Saving...
                </>
              ) : (
                <>
                  <Save className='mr-2 h-4 w-4' />
                  Save Draft
                </>
              )}
            </Button>

            {form.watch('scheduled_at') && (
              <Button
                type='submit'
                variant='secondary'
                disabled={isSubmitting}
                onClick={() => setSubmitAction('schedule')}
              >
                {isSubmitting && submitAction === 'schedule' ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <Clock className='mr-2 h-4 w-4' />
                    Schedule
                  </>
                )}
              </Button>
            )}

            <Button
              type='submit'
              disabled={isSubmitting}
              onClick={() => setSubmitAction('send')}
            >
              {isSubmitting && submitAction === 'send' ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Sending...
                </>
              ) : (
                <>
                  <Send className='mr-2 h-4 w-4' />
                  Send Now
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
