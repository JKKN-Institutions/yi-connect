'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createWikiPageSchema,
  updateWikiPageSchema
} from '@/lib/validations/knowledge';
import { createWikiPage, updateWikiPage } from '@/app/actions/knowledge';
import type { WikiPage } from '@/types/knowledge';
import type { FormState } from '@/types/knowledge';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

interface WikiPageFormProps {
  wikiPage?: WikiPage;
  onSuccess?: () => void;
}

const WIKI_CATEGORIES = [
  { value: 'sop', label: 'SOP (Standard Operating Procedure)' },
  { value: 'best_practice', label: 'Best Practice' },
  { value: 'process_note', label: 'Process Note' },
  { value: 'general', label: 'General Knowledge' }
];

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'chapter', label: 'Chapter Members' },
  { value: 'ec_only', label: 'EC Only' },
  { value: 'chair_only', label: 'Chair Only' }
];

export function WikiPageForm({ wikiPage, onSuccess }: WikiPageFormProps) {
  const router = useRouter();
  const isEditing = !!wikiPage;

  const schema = isEditing ? updateWikiPageSchema : createWikiPageSchema;
  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: wikiPage
      ? {
          title: wikiPage.title,
          content: wikiPage.content,
          summary: wikiPage.summary || '',
          visibility: wikiPage.visibility,
          change_summary: ''
        }
      : {
          title: '',
          slug: '',
          category: 'general',
          content: '',
          summary: '',
          visibility: 'chapter'
        }
  });

  const action = isEditing
    ? updateWikiPage.bind(null, wikiPage.id)
    : createWikiPage;

  const initialState: FormState = { success: false, message: '' };
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) {
      if (state.message) toast.success(state.message);
      if (state.redirectTo) {
        router.push(state.redirectTo);
      } else if (onSuccess) {
        onSuccess();
      }
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, router, onSuccess]);

  // Auto-generate slug from title
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    form.setValue('title', title);
    if (!isEditing) {
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      form.setValue('slug', slug);
    }
  };

  return (
    <Form {...form}>
      <form action={formAction} className='space-y-6'>
        <FormField
          control={form.control}
          name='title'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  onChange={isEditing ? field.onChange : handleTitleChange}
                  placeholder='e.g., How to Organize Events'
                  disabled={isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {!isEditing && (
          <>
            <FormField
              control={form.control}
              name='slug'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder='e.g., how-to-organize-events'
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormDescription>
                    URL-friendly identifier (auto-generated from title)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='category'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isPending}
                  >
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder='Select category' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {WIKI_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <FormField
          control={form.control}
          name='content'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Content</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder='Write your wiki page content here (Markdown supported)'
                  rows={15}
                  className='font-mono'
                  disabled={isPending}
                />
              </FormControl>
              <FormDescription>
                Supports Markdown formatting for rich text content
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='summary'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Summary (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  value={field.value || ''}
                  placeholder='Brief summary of this wiki page'
                  rows={2}
                  disabled={isPending}
                />
              </FormControl>
              <FormDescription>
                Short description shown in search results and listings
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {isEditing && (
          <FormField
            control={form.control}
            name='change_summary'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Change Summary (Optional)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder='e.g., Updated event guidelines'
                    disabled={isPending}
                  />
                </FormControl>
                <FormDescription>
                  Describe what changes you made in this version
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name='visibility'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Visibility</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
                disabled={isPending}
              >
                <FormControl>
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Select visibility' />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {VISIBILITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className='flex justify-end gap-2'>
          <Button
            type='button'
            variant='outline'
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type='submit' disabled={isPending}>
            {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {isEditing ? 'Update Wiki Page' : 'Create Wiki Page'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
