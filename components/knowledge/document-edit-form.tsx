'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
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
import { updateDocument } from '@/app/actions/knowledge';
import type {
  KnowledgeCategory,
  KnowledgeDocument,
  FormState
} from '@/types/knowledge';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Loader2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface DocumentEditFormProps {
  document: KnowledgeDocument;
  categories: KnowledgeCategory[];
}

const formSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  category_id: z.string().optional(),
  tags: z.array(z.string()).optional(),
  visibility: z.enum(['public', 'chapter', 'ec_only', 'chair_only'])
});

type FormValues = z.infer<typeof formSchema>;

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public', description: 'Anyone can view' },
  { value: 'chapter', label: 'Chapter', description: 'Chapter members only' },
  {
    value: 'ec_only',
    label: 'EC Only',
    description: 'Executive Committee only'
  },
  {
    value: 'chair_only',
    label: 'Chair Only',
    description: 'Chapter Chair only'
  }
];

export function DocumentEditForm({
  document,
  categories
}: DocumentEditFormProps) {
  const router = useRouter();
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(document.tags || []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: document.title,
      description: document.description || '',
      category_id: document.category_id || 'none',
      tags: document.tags || [],
      visibility: document.visibility
    }
  });

  const updateDocumentWithId = updateDocument.bind(null, document.id);
  const initialState: FormState = { success: false, message: '' };
  const [state, formAction, isPending] = useActionState(
    updateDocumentWithId,
    initialState
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      toast.success(state.message || 'Document updated successfully');
      router.push(`/knowledge/documents/${document.id}`);
    } else if (state.message && !state.success) {
      toast.error(state.message);
    }
  }, [state, router, document.id]);

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      const newTags = [...tags, tag];
      setTags(newTags);
      form.setValue('tags', newTags);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = tags.filter((t) => t !== tagToRemove);
    setTags(newTags);
    form.setValue('tags', newTags);
  };

  const handleFormAction = async (formData: FormData) => {
    // Add react-hook-form values that aren't in native form elements
    // (Select components don't create native form elements)
    const formValues = form.getValues();

    // Handle category
    const categoryId = formValues.category_id;
    if (categoryId && categoryId !== 'none') {
      formData.set('category_id', categoryId);
    } else {
      formData.delete('category_id');
    }

    // Add visibility
    formData.set('visibility', formValues.visibility || 'chapter');

    // Add tags as JSON
    formData.set('tags', JSON.stringify(tags));

    // Call the server action
    return formAction(formData);
  };

  return (
    <Form {...form}>
      <form ref={formRef} action={handleFormAction} className='space-y-6'>
        {/* File Info (read-only) */}
        <div className='rounded-lg border p-4 bg-muted/50'>
          <p className='text-sm font-medium'>File</p>
          <p className='text-sm text-muted-foreground mt-1'>
            {document.file_name}
          </p>
          <p className='text-xs text-muted-foreground'>
            {document.file_size_kb >= 1024
              ? `${(document.file_size_kb / 1024).toFixed(2)} MB`
              : `${document.file_size_kb} KB`}
            {' • '}
            {document.file_type}
          </p>
        </div>

        <FormField
          control={form.control}
          name='title'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder='e.g., Annual Report 2024'
                  disabled={isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='description'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder='Brief description of the document'
                  rows={3}
                  disabled={isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='category_id'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value || 'none'}
                disabled={isPending}
              >
                <FormControl>
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Select a category' />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value='none'>None</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Tags Input */}
        <FormItem>
          <FormLabel>Tags</FormLabel>
          <div className='flex gap-2'>
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              placeholder='Add tags (press Enter)'
              disabled={isPending}
            />
            <Button
              type='button'
              variant='secondary'
              onClick={handleAddTag}
              disabled={isPending}
            >
              Add
            </Button>
          </div>
          {tags.length > 0 && (
            <div className='flex flex-wrap gap-2 mt-2'>
              {tags.map((tag) => (
                <Badge key={tag} variant='secondary'>
                  {tag}
                  <button
                    type='button'
                    onClick={() => handleRemoveTag(tag)}
                    className='ml-1 hover:text-destructive'
                  >
                    <X className='h-3 w-3' />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </FormItem>

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
                      <div>
                        <div className='font-medium'>{option.label}</div>
                        <div className='text-xs text-muted-foreground'>
                          {option.description}
                        </div>
                      </div>
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
            {isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
