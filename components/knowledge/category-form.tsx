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
  createCategorySchema,
  updateCategorySchema
} from '@/lib/validations/knowledge';
import { createCategory, updateCategory } from '@/app/actions/knowledge';
import type { KnowledgeCategory } from '@/types/knowledge';
import type { FormState } from '@/types/knowledge';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

interface CategoryFormProps {
  category?: KnowledgeCategory;
  categories?: KnowledgeCategory[];
  onSuccess?: () => void;
}

const LUCIDE_ICONS = [
  'FolderOpen',
  'FileText',
  'BookOpen',
  'Layout',
  'Archive',
  'Inbox',
  'Package',
  'Tag'
];

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16' // lime
];

export function CategoryForm({
  category,
  categories = [],
  onSuccess
}: CategoryFormProps) {
  const router = useRouter();
  const isEditing = !!category;

  const schema = isEditing ? updateCategorySchema : createCategorySchema;
  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: category
      ? {
          name: category.name,
          slug: category.slug,
          description: category.description || '',
          icon: category.icon || '',
          color: category.color || '',
          parent_category_id: category.parent_category_id || undefined,
          sort_order: category.sort_order
        }
      : {
          name: '',
          slug: '',
          description: '',
          icon: 'FolderOpen',
          color: '#3b82f6',
          sort_order: 0
        }
  });

  const action = isEditing
    ? updateCategory.bind(null, category.id)
    : createCategory;

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

  // Auto-generate slug from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    form.setValue('name', name);
    if (!isEditing) {
      const slug = name
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
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category Name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  onChange={handleNameChange}
                  placeholder='e.g., Event Reports'
                  disabled={isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='slug'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slug</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder='e.g., event-reports'
                  disabled={isPending || isEditing}
                />
              </FormControl>
              <FormDescription>
                URL-friendly identifier (auto-generated from name)
              </FormDescription>
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
                  placeholder='Brief description of this category'
                  rows={3}
                  disabled={isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className='grid grid-cols-2 gap-4'>
          <FormField
            control={form.control}
            name='icon'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Icon</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value || undefined}
                  disabled={isPending}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select an icon' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {LUCIDE_ICONS.map((icon) => (
                      <SelectItem key={icon} value={icon}>
                        {icon}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='color'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Color</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value || undefined}
                  disabled={isPending}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select a color' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {COLORS.map((color) => (
                      <SelectItem key={color} value={color}>
                        <div className='flex items-center gap-2'>
                          <div
                            className='h-4 w-4 rounded'
                            style={{ backgroundColor: color }}
                          />
                          {color}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {categories.length > 0 && (
          <FormField
            control={form.control}
            name='parent_category_id'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Parent Category (Optional)</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value || undefined}
                  disabled={isPending}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='None (top-level category)' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='none'>
                      None (top-level category)
                    </SelectItem>
                    {categories
                      .filter((c) => c.id !== category?.id)
                      .map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Create a subcategory under an existing category
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name='sort_order'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sort Order</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type='number'
                  min='0'
                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                  disabled={isPending}
                />
              </FormControl>
              <FormDescription>
                Lower numbers appear first in listings
              </FormDescription>
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
            {isEditing ? 'Update Category' : 'Create Category'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
