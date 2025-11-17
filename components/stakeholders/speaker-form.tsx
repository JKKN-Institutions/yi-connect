/**
 * Speaker Form Component
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, X } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  speakerFormSchema,
  type SpeakerFormInput
} from '@/lib/validations/stakeholder';
import { createSpeaker } from '@/app/actions/stakeholder';
import { toast } from 'react-hot-toast';

interface SpeakerFormProps {
  chapterId: string | null; // Allow null for super admins
  initialData?: SpeakerFormInput & { id: string };
}

export function SpeakerForm({ chapterId, initialData }: SpeakerFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expertiseArea, setExpertiseArea] = useState('');
  const [suitableTopic, setSuitableTopic] = useState('');
  const [sessionFormat, setSessionFormat] = useState('');

  const form = useForm({
    resolver: zodResolver(speakerFormSchema) as any,
    defaultValues: initialData || {
      speaker_name: '',
      professional_title: '',
      expertise_areas: [],
      suitable_topics: [],
      session_formats: [],
      charges_fee: false,
      availability_status: 'available',
      status: 'prospective'
    }
  });

  const onSubmit = async (data: any) => {
    try {
      setIsSubmitting(true);
      const formData = new FormData();
      formData.append('chapter_id', chapterId || '');
      formData.append('speaker_name', data.speaker_name);

      if (data.professional_title) {
        formData.append('professional_title', data.professional_title);
      }
      if (data.expertise_areas && data.expertise_areas.length > 0) {
        formData.append(
          'expertise_areas',
          JSON.stringify(data.expertise_areas)
        );
      }
      if (data.suitable_topics && data.suitable_topics.length > 0) {
        formData.append(
          'suitable_topics',
          JSON.stringify(data.suitable_topics)
        );
      }
      if (data.session_formats && data.session_formats.length > 0) {
        formData.append(
          'session_formats',
          JSON.stringify(data.session_formats)
        );
      }
      if (data.charges_fee !== undefined) {
        formData.append('charges_fee', String(data.charges_fee));
      }
      if (data.fee_range) {
        formData.append('fee_range', data.fee_range);
      }
      if (data.availability_status) {
        formData.append('availability_status', data.availability_status);
      }
      if (data.bio) {
        formData.append('bio', data.bio);
      }
      if (data.status) {
        formData.append('status', data.status);
      }
      if (data.notes) {
        formData.append('notes', data.notes);
      }

      const result = await createSpeaker(
        { message: '', success: false },
        formData
      );

      if (result.success) {
        toast.success('Speaker created successfully!');
        router.push('/stakeholders/speakers');
        router.refresh();
      } else {
        toast.error(result.message || 'Failed to create speaker');
      }
    } catch (error) {
      console.error('Error submitting speaker form:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addExpertiseArea = () => {
    if (expertiseArea.trim()) {
      const current = form.getValues('expertise_areas') || [];
      if (!current.includes(expertiseArea.trim())) {
        form.setValue('expertise_areas', [...current, expertiseArea.trim()]);
        setExpertiseArea('');
      }
    }
  };

  const removeExpertiseArea = (area: string) => {
    const current = form.getValues('expertise_areas') || [];
    form.setValue(
      'expertise_areas',
      current.filter((a) => a !== area)
    );
  };

  const addSuitableTopic = () => {
    if (suitableTopic.trim()) {
      const current = form.getValues('suitable_topics') || [];
      if (!current.includes(suitableTopic.trim())) {
        form.setValue('suitable_topics', [...current, suitableTopic.trim()]);
        setSuitableTopic('');
      }
    }
  };

  const removeSuitableTopic = (topic: string) => {
    const current = form.getValues('suitable_topics') || [];
    form.setValue(
      'suitable_topics',
      current.filter((t) => t !== topic)
    );
  };

  const addSessionFormat = () => {
    if (sessionFormat.trim()) {
      const current = form.getValues('session_formats') || [];
      if (!current.includes(sessionFormat.trim())) {
        form.setValue('session_formats', [...current, sessionFormat.trim()]);
        setSessionFormat('');
      }
    }
  };

  const removeSessionFormat = (format: string) => {
    const current = form.getValues('session_formats') || [];
    form.setValue(
      'session_formats',
      current.filter((f) => f !== format)
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-8'>
        {/* Basic Information */}
        <div className='space-y-4'>
          <h3 className='text-lg font-medium'>Basic Information</h3>

          <FormField
            control={form.control}
            name='speaker_name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Speaker Name *</FormLabel>
                <FormControl>
                  <Input placeholder='Enter speaker name' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='professional_title'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Professional Title</FormLabel>
                <FormControl>
                  <Input
                    placeholder='e.g., CEO, Motivational Speaker, Industry Expert'
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Current professional designation or role
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />


          <FormField
            control={form.control}
            name='status'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select status' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='active'>Active</SelectItem>
                    <SelectItem value='prospective'>Prospective</SelectItem>
                    <SelectItem value='inactive'>Inactive</SelectItem>
                    <SelectItem value='dormant'>Dormant</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Expertise & Topics */}
        <div className='space-y-4'>
          <h3 className='text-lg font-medium'>Expertise & Topics</h3>

          <FormField
            control={form.control}
            name='expertise_areas'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Expertise Areas</FormLabel>
                <div className='flex gap-2'>
                  <Input
                    placeholder='Add expertise area'
                    value={expertiseArea}
                    onChange={(e) => setExpertiseArea(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addExpertiseArea();
                      }
                    }}
                  />
                  <Button
                    type='button'
                    onClick={addExpertiseArea}
                    size='icon'
                    variant='outline'
                  >
                    <Plus className='h-4 w-4' />
                  </Button>
                </div>
                <div className='flex flex-wrap gap-2 mt-2'>
                  {field.value?.map((area) => (
                    <Badge key={area} variant='secondary'>
                      {area}
                      <button
                        type='button'
                        onClick={() => removeExpertiseArea(area)}
                        className='ml-2 hover:text-destructive'
                      >
                        <X className='h-3 w-3' />
                      </button>
                    </Badge>
                  ))}
                </div>
                <FormDescription>
                  Areas of expertise (e.g., Leadership, Technology, Marketing)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='suitable_topics'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Suitable Topics</FormLabel>
                <div className='flex gap-2'>
                  <Input
                    placeholder='Add suitable topic'
                    value={suitableTopic}
                    onChange={(e) => setSuitableTopic(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSuitableTopic();
                      }
                    }}
                  />
                  <Button
                    type='button'
                    onClick={addSuitableTopic}
                    size='icon'
                    variant='outline'
                  >
                    <Plus className='h-4 w-4' />
                  </Button>
                </div>
                <div className='flex flex-wrap gap-2 mt-2'>
                  {field.value?.map((topic) => (
                    <Badge key={topic} variant='secondary'>
                      {topic}
                      <button
                        type='button'
                        onClick={() => removeSuitableTopic(topic)}
                        className='ml-2 hover:text-destructive'
                      >
                        <X className='h-3 w-3' />
                      </button>
                    </Badge>
                  ))}
                </div>
                <FormDescription>Topics they can speak about</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='session_formats'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Session Formats</FormLabel>
                <div className='flex gap-2'>
                  <Input
                    placeholder='Add session format'
                    value={sessionFormat}
                    onChange={(e) => setSessionFormat(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSessionFormat();
                      }
                    }}
                  />
                  <Button
                    type='button'
                    onClick={addSessionFormat}
                    size='icon'
                    variant='outline'
                  >
                    <Plus className='h-4 w-4' />
                  </Button>
                </div>
                <div className='flex flex-wrap gap-2 mt-2'>
                  {field.value?.map((format) => (
                    <Badge key={format} variant='secondary'>
                      {format}
                      <button
                        type='button'
                        onClick={() => removeSessionFormat(format)}
                        className='ml-2 hover:text-destructive'
                      >
                        <X className='h-3 w-3' />
                      </button>
                    </Badge>
                  ))}
                </div>
                <FormDescription>
                  Formats they can deliver (e.g., Keynote, Workshop, Panel
                  Discussion)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Fee & Availability */}
        <div className='space-y-4'>
          <h3 className='text-lg font-medium'>Fee & Availability</h3>

          <FormField
            control={form.control}
            name='charges_fee'
            render={({ field }) => (
              <FormItem className='flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4'>
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className='space-y-1 leading-none'>
                  <FormLabel>Charges Fee</FormLabel>
                  <FormDescription>
                    Does this speaker charge a fee for sessions?
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          {form.watch('charges_fee') && (
            <FormField
              control={form.control}
              name='fee_range'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fee Range</FormLabel>
                  <FormControl>
                    <Input placeholder='e.g., ₹25,000 - ₹50,000' {...field} />
                  </FormControl>
                  <FormDescription>
                    Typical fee range for sessions
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name='availability_status'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Availability Status</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select availability status' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='available'>Available</SelectItem>
                    <SelectItem value='limited'>
                      Limited Availability
                    </SelectItem>
                    <SelectItem value='unavailable'>Unavailable</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Current availability for speaking engagements
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Additional Information */}
        <div className='space-y-4'>
          <h3 className='text-lg font-medium'>Additional Information</h3>

          <FormField
            control={form.control}
            name='notes'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Internal Notes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder='Any additional notes or comments'
                    className='min-h-[100px]'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className='flex gap-4'>
          <Button type='submit' disabled={isSubmitting}>
            {isSubmitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {initialData ? 'Update Speaker' : 'Create Speaker'}
          </Button>
          <Button type='button' variant='outline' onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
