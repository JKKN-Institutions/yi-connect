'use client';

/**
 * Custom Form Field Preview
 *
 * Read-only preview of a single custom form field. Used by the editor's
 * "Preview" mode so organisers can see exactly what attendees will see
 * without wiring up RHF state.
 */

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import type { CustomFormField } from '@/types/event';

interface CustomFormFieldPreviewProps {
  field: CustomFormField;
}

export function CustomFormFieldPreview({ field }: CustomFormFieldPreviewProps) {
  const labelNode = (
    <Label className='flex items-center gap-1'>
      {field.label}
      {field.required && <span className='text-destructive'>*</span>}
    </Label>
  );

  const helpNode = field.help_text ? (
    <p className='text-xs text-muted-foreground'>{field.help_text}</p>
  ) : null;

  switch (field.type) {
    case 'text':
    case 'phone':
      return (
        <div className='space-y-2'>
          {labelNode}
          <Input
            disabled
            placeholder={field.placeholder || ''}
            type={field.type === 'phone' ? 'tel' : 'text'}
          />
          {helpNode}
        </div>
      );
    case 'textarea':
      return (
        <div className='space-y-2'>
          {labelNode}
          <Textarea disabled placeholder={field.placeholder || ''} />
          {helpNode}
        </div>
      );
    case 'number':
      return (
        <div className='space-y-2'>
          {labelNode}
          <Input
            disabled
            type='number'
            placeholder={field.placeholder || ''}
          />
          {helpNode}
        </div>
      );
    case 'date':
      return (
        <div className='space-y-2'>
          {labelNode}
          <Input disabled type='date' />
          {helpNode}
        </div>
      );
    case 'checkbox':
      return (
        <div className='flex items-start gap-2'>
          <Checkbox disabled />
          <div className='space-y-1'>
            {labelNode}
            {helpNode}
          </div>
        </div>
      );
    case 'select':
      return (
        <div className='space-y-2'>
          {labelNode}
          <Select disabled>
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || 'Select…'} />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {helpNode}
        </div>
      );
    case 'multiselect':
      return (
        <div className='space-y-2'>
          {labelNode}
          <div className='space-y-2 rounded-md border p-3 opacity-60'>
            {(field.options ?? []).map((opt) => (
              <div key={opt} className='flex items-center gap-2'>
                <Checkbox disabled id={`pv-${field.id}-${opt}`} />
                <Label htmlFor={`pv-${field.id}-${opt}`} className='text-sm font-normal'>
                  {opt}
                </Label>
              </div>
            ))}
            {(field.options ?? []).length === 0 && (
              <p className='text-xs text-muted-foreground'>No options yet</p>
            )}
          </div>
          {helpNode}
        </div>
      );
    default:
      return null;
  }
}
