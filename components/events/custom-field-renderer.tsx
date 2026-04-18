'use client';

/**
 * Custom Field Renderer
 *
 * Renders a single custom form field in the RSVP form. Stateless —
 * the parent controls the value via `value` + `onChange`, which keeps
 * it compatible with react-hook-form (via Controller) or plain useState.
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
import type {
  CustomFieldResponseValue,
  CustomFormField
} from '@/types/event';

interface CustomFieldRendererProps {
  field: CustomFormField;
  value: CustomFieldResponseValue;
  onChange: (value: CustomFieldResponseValue) => void;
  error?: string;
  disabled?: boolean;
}

export function CustomFieldRenderer({
  field,
  value,
  onChange,
  error,
  disabled
}: CustomFieldRendererProps) {
  const labelNode = (
    <Label
      htmlFor={`cf-${field.id}`}
      className='flex items-center gap-1'
    >
      {field.label}
      {field.required && <span className='text-destructive'>*</span>}
    </Label>
  );

  const helpNode = field.help_text ? (
    <p className='text-xs text-muted-foreground'>{field.help_text}</p>
  ) : null;

  const errorNode = error ? (
    <p className='text-xs text-destructive'>{error}</p>
  ) : null;

  switch (field.type) {
    case 'text':
    case 'phone':
      return (
        <div className='space-y-2'>
          {labelNode}
          <Input
            id={`cf-${field.id}`}
            type={field.type === 'phone' ? 'tel' : 'text'}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
          />
          {helpNode}
          {errorNode}
        </div>
      );
    case 'textarea':
      return (
        <div className='space-y-2'>
          {labelNode}
          <Textarea
            id={`cf-${field.id}`}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
          />
          {helpNode}
          {errorNode}
        </div>
      );
    case 'number':
      return (
        <div className='space-y-2'>
          {labelNode}
          <Input
            id={`cf-${field.id}`}
            type='number'
            value={
              typeof value === 'number'
                ? value
                : typeof value === 'string'
                ? value
                : ''
            }
            onChange={(e) => {
              const v = e.target.value;
              if (v === '') onChange(null);
              else {
                const n = Number(v);
                onChange(Number.isFinite(n) ? n : null);
              }
            }}
            placeholder={field.placeholder}
            disabled={disabled}
          />
          {helpNode}
          {errorNode}
        </div>
      );
    case 'date':
      return (
        <div className='space-y-2'>
          {labelNode}
          <Input
            id={`cf-${field.id}`}
            type='date'
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
          {helpNode}
          {errorNode}
        </div>
      );
    case 'checkbox':
      return (
        <div className='space-y-2'>
          <div className='flex items-start gap-2'>
            <Checkbox
              id={`cf-${field.id}`}
              checked={value === true}
              onCheckedChange={(checked) => onChange(checked === true)}
              disabled={disabled}
            />
            <div className='space-y-1'>
              {labelNode}
              {helpNode}
            </div>
          </div>
          {errorNode}
        </div>
      );
    case 'select':
      return (
        <div className='space-y-2'>
          {labelNode}
          <Select
            value={typeof value === 'string' ? value : ''}
            onValueChange={(v) => onChange(v)}
            disabled={disabled}
          >
            <SelectTrigger id={`cf-${field.id}`}>
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
          {errorNode}
        </div>
      );
    case 'multiselect': {
      const current = Array.isArray(value) ? (value as string[]) : [];
      const toggle = (opt: string) => {
        if (current.includes(opt)) {
          onChange(current.filter((v) => v !== opt));
        } else {
          onChange([...current, opt]);
        }
      };
      return (
        <div className='space-y-2'>
          {labelNode}
          <div className='space-y-2 rounded-md border p-3'>
            {(field.options ?? []).map((opt) => {
              const id = `cf-${field.id}-${opt}`;
              return (
                <div key={opt} className='flex items-center gap-2'>
                  <Checkbox
                    id={id}
                    checked={current.includes(opt)}
                    onCheckedChange={() => toggle(opt)}
                    disabled={disabled}
                  />
                  <Label htmlFor={id} className='text-sm font-normal'>
                    {opt}
                  </Label>
                </div>
              );
            })}
            {(field.options ?? []).length === 0 && (
              <p className='text-xs text-muted-foreground'>No options</p>
            )}
          </div>
          {helpNode}
          {errorNode}
        </div>
      );
    }
    default:
      return null;
  }
}

/**
 * Validate a map of responses against a list of field definitions.
 * Returns `{ ok: true }` or `{ ok: false, errors }` keyed by field id.
 */
export function validateCustomFieldResponsesClient(
  fields: CustomFormField[],
  responses: Record<string, CustomFieldResponseValue>
): { ok: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    if (!field.required) continue;
    const value = responses[field.id];
    let isEmpty = false;

    switch (field.type) {
      case 'multiselect':
        isEmpty = !Array.isArray(value) || value.length === 0;
        break;
      case 'checkbox':
        isEmpty = value !== true;
        break;
      case 'number':
        isEmpty =
          value === null ||
          value === undefined ||
          value === '' ||
          (typeof value === 'number' && !Number.isFinite(value));
        break;
      default:
        isEmpty =
          value === null || value === undefined || value === '' ||
          (typeof value === 'string' && value.trim() === '');
    }

    if (isEmpty) {
      errors[field.id] = `${field.label} is required`;
    }
  }

  return { ok: Object.keys(errors).length === 0, errors };
}
