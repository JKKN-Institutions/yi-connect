'use client';

/**
 * Custom Fields Editor
 *
 * Add / edit / reorder / remove custom registration form fields for an event.
 * State is fully controlled via props so the parent can submit the list
 * through a server action (`updateEventFormFields`).
 */

import { useState, useTransition } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import toast from 'react-hot-toast';
import {
  CUSTOM_FIELD_TYPES,
  MAX_CUSTOM_FIELDS,
  customFieldNeedsOptions,
  type CustomFieldType,
  type CustomFormField
} from '@/types/event';
import { updateEventFormFields } from '@/app/actions/events';
import { CustomFormFieldPreview } from './custom-form-field-preview';
import { cn } from '@/lib/utils';

interface CustomFieldsEditorProps {
  eventId?: string;
  initialFields: CustomFormField[];
  /**
   * If true, the editor will persist changes via `updateEventFormFields`.
   * If false (e.g. during event creation before an id exists), changes are
   * held locally and exposed to the parent via `onChange`.
   */
  autoSave?: boolean;
  onChange?: (fields: CustomFormField[]) => void;
}

type DraftField = {
  id: string;
  type: CustomFieldType;
  label: string;
  required: boolean;
  placeholder: string;
  help_text: string;
  options: string[];
};

function emptyDraft(): DraftField {
  return {
    id: crypto.randomUUID(),
    type: 'text',
    label: '',
    required: false,
    placeholder: '',
    help_text: '',
    options: []
  };
}

function fieldToDraft(field: CustomFormField): DraftField {
  return {
    id: field.id,
    type: field.type,
    label: field.label,
    required: field.required,
    placeholder: field.placeholder ?? '',
    help_text: field.help_text ?? '',
    options: field.options ?? []
  };
}

function draftToField(draft: DraftField, sort_order: number): CustomFormField {
  const base: CustomFormField = {
    id: draft.id,
    type: draft.type,
    label: draft.label.trim(),
    required: draft.required,
    sort_order
  };
  if (draft.placeholder.trim()) base.placeholder = draft.placeholder.trim();
  if (draft.help_text.trim()) base.help_text = draft.help_text.trim();
  if (customFieldNeedsOptions(draft.type)) {
    base.options = draft.options.map((o) => o.trim()).filter(Boolean);
  }
  return base;
}

export function CustomFieldsEditor({
  eventId,
  initialFields,
  autoSave = true,
  onChange
}: CustomFieldsEditorProps) {
  const [fields, setFields] = useState<CustomFormField[]>(
    [...(initialFields ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  );
  const [draft, setDraft] = useState<DraftField | null>(null);
  const [draftMode, setDraftMode] = useState<'add' | 'edit' | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [isPending, startTransition] = useTransition();

  const canSave = autoSave && !!eventId;

  const commit = (next: CustomFormField[]) => {
    const normalized = next.map((f, i) => ({ ...f, sort_order: i }));
    setFields(normalized);
    onChange?.(normalized);
    if (canSave) {
      startTransition(async () => {
        const result = await updateEventFormFields({
          event_id: eventId!,
          registration_form_fields: normalized
        });
        if (!result.success) {
          toast.error(result.error || 'Failed to save custom fields');
        }
      });
    }
  };

  const handleStartAdd = () => {
    if (fields.length >= MAX_CUSTOM_FIELDS) {
      toast.error(`Maximum ${MAX_CUSTOM_FIELDS} custom fields allowed`);
      return;
    }
    setDraft(emptyDraft());
    setDraftMode('add');
  };

  const handleStartEdit = (field: CustomFormField) => {
    setDraft(fieldToDraft(field));
    setDraftMode('edit');
  };

  const handleCancelDraft = () => {
    setDraft(null);
    setDraftMode(null);
  };

  const handleSaveDraft = () => {
    if (!draft) return;
    if (!draft.label.trim()) {
      toast.error('Field label is required');
      return;
    }
    if (customFieldNeedsOptions(draft.type)) {
      const cleaned = draft.options.map((o) => o.trim()).filter(Boolean);
      if (cleaned.length < 1) {
        toast.error('Dropdown fields need at least one option');
        return;
      }
    }

    const newField = draftToField(draft, fields.length);
    let next: CustomFormField[];
    if (draftMode === 'add') {
      next = [...fields, newField];
    } else {
      next = fields.map((f) => (f.id === draft.id ? { ...newField, sort_order: f.sort_order } : f));
    }
    commit(next);
    setDraft(null);
    setDraftMode(null);
  };

  const handleDelete = (id: string) => {
    const next = fields.filter((f) => f.id !== id);
    commit(next);
  };

  const move = (id: string, dir: -1 | 1) => {
    const idx = fields.findIndex((f) => f.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    const [item] = next.splice(idx, 1);
    next.splice(target, 0, item);
    commit(next);
  };

  return (
    <Card>
      <CardHeader className='flex flex-row items-start justify-between gap-4'>
        <div>
          <CardTitle>Registration form</CardTitle>
          <CardDescription>
            Collect extra information from attendees when they RSVP. Up to{' '}
            {MAX_CUSTOM_FIELDS} fields.
          </CardDescription>
        </div>
        <div className='flex items-center gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => setPreviewMode((v) => !v)}
            disabled={fields.length === 0}
          >
            {previewMode ? (
              <>
                <EyeOff className='mr-2 h-4 w-4' /> Hide preview
              </>
            ) : (
              <>
                <Eye className='mr-2 h-4 w-4' /> Preview
              </>
            )}
          </Button>
          <Button
            type='button'
            size='sm'
            onClick={handleStartAdd}
            disabled={draftMode !== null || fields.length >= MAX_CUSTOM_FIELDS}
          >
            <Plus className='mr-2 h-4 w-4' /> Add field
          </Button>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        {!canSave && autoSave && (
          <Alert>
            <AlertDescription>
              Save the event first to start adding custom registration fields.
            </AlertDescription>
          </Alert>
        )}

        {fields.length === 0 && !draft && (
          <div className='rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground'>
            No custom fields yet. Default RSVP collects dietary info and guest
            count. Use &quot;Add field&quot; to ask for more.
          </div>
        )}

        {!previewMode && (
          <ul className='space-y-3'>
            {fields.map((f, idx) => (
              <li
                key={f.id}
                className='flex items-start justify-between gap-3 rounded-md border bg-card p-4'
              >
                <div className='flex-1 min-w-0 space-y-1'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <span className='font-medium truncate'>{f.label}</span>
                    <Badge variant='secondary' className='capitalize'>
                      {CUSTOM_FIELD_TYPES[f.type]}
                    </Badge>
                    {f.required && (
                      <Badge variant='destructive'>Required</Badge>
                    )}
                  </div>
                  {f.help_text && (
                    <p className='text-xs text-muted-foreground'>
                      {f.help_text}
                    </p>
                  )}
                  {customFieldNeedsOptions(f.type) && f.options && (
                    <p className='text-xs text-muted-foreground'>
                      Options:{' '}
                      <span className='italic'>{f.options.join(', ')}</span>
                    </p>
                  )}
                </div>
                <div className='flex items-center gap-1'>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    onClick={() => move(f.id, -1)}
                    disabled={idx === 0 || isPending}
                    title='Move up'
                  >
                    <ArrowUp className='h-4 w-4' />
                  </Button>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    onClick={() => move(f.id, 1)}
                    disabled={idx === fields.length - 1 || isPending}
                    title='Move down'
                  >
                    <ArrowDown className='h-4 w-4' />
                  </Button>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    onClick={() => handleStartEdit(f)}
                    disabled={draftMode !== null || isPending}
                    title='Edit'
                  >
                    <Pencil className='h-4 w-4' />
                  </Button>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    onClick={() => handleDelete(f.id)}
                    disabled={isPending}
                    title='Delete'
                    className='text-destructive hover:text-destructive'
                  >
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {previewMode && fields.length > 0 && (
          <div className='space-y-4 rounded-md border bg-muted/20 p-4'>
            {fields.map((f) => (
              <CustomFormFieldPreview key={f.id} field={f} />
            ))}
          </div>
        )}

        {draft && (
          <DraftEditor
            draft={draft}
            onChange={setDraft}
            onCancel={handleCancelDraft}
            onSave={handleSaveDraft}
            isPending={isPending}
            mode={draftMode}
          />
        )}

        {isPending && canSave && (
          <div className='flex items-center gap-2 text-xs text-muted-foreground'>
            <Loader2 className='h-3 w-3 animate-spin' /> Saving…
          </div>
        )}
      </CardContent>
      {canSave && (
        <CardFooter className='text-xs text-muted-foreground'>
          Changes save automatically.
        </CardFooter>
      )}
    </Card>
  );
}

function DraftEditor({
  draft,
  mode,
  onChange,
  onCancel,
  onSave,
  isPending
}: {
  draft: DraftField;
  mode: 'add' | 'edit' | null;
  onChange: (d: DraftField) => void;
  onCancel: () => void;
  onSave: () => void;
  isPending: boolean;
}) {
  const set = <K extends keyof DraftField>(key: K, value: DraftField[K]) =>
    onChange({ ...draft, [key]: value });

  return (
    <div className='space-y-4 rounded-md border border-primary/40 bg-primary/5 p-4'>
      <div className='flex items-center justify-between'>
        <h4 className='text-sm font-semibold'>
          {mode === 'edit' ? 'Edit field' : 'New field'}
        </h4>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          onClick={onCancel}
          disabled={isPending}
        >
          <X className='h-4 w-4' />
        </Button>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <div className='space-y-2'>
          <Label>Field type</Label>
          <Select
            value={draft.type}
            onValueChange={(v) => set('type', v as CustomFieldType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(CUSTOM_FIELD_TYPES) as CustomFieldType[]).map(
                (t) => (
                  <SelectItem key={t} value={t}>
                    {CUSTOM_FIELD_TYPES[t]}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-2'>
          <Label>Label *</Label>
          <Input
            value={draft.label}
            onChange={(e) => set('label', e.target.value)}
            placeholder='e.g. T-shirt size'
            maxLength={200}
          />
        </div>

        <div className='space-y-2'>
          <Label>Placeholder (optional)</Label>
          <Input
            value={draft.placeholder}
            onChange={(e) => set('placeholder', e.target.value)}
            maxLength={200}
          />
        </div>

        <div className='space-y-2'>
          <Label>Help text (optional)</Label>
          <Input
            value={draft.help_text}
            onChange={(e) => set('help_text', e.target.value)}
            maxLength={500}
          />
        </div>
      </div>

      {customFieldNeedsOptions(draft.type) && (
        <OptionsEditor
          options={draft.options}
          onChange={(opts) => set('options', opts)}
        />
      )}

      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Switch
            checked={draft.required}
            onCheckedChange={(v) => set('required', v)}
            id={`req-${draft.id}`}
          />
          <Label htmlFor={`req-${draft.id}`} className='text-sm'>
            Required
          </Label>
        </div>
        <div className='flex items-center gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type='button' size='sm' onClick={onSave} disabled={isPending}>
            {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            <Save className='mr-2 h-4 w-4' /> Save field
          </Button>
        </div>
      </div>
    </div>
  );
}

function OptionsEditor({
  options,
  onChange
}: {
  options: string[];
  onChange: (options: string[]) => void;
}) {
  const [input, setInput] = useState('');

  const add = () => {
    const value = input.trim();
    if (!value) return;
    if (options.includes(value)) {
      toast.error('Option already added');
      return;
    }
    onChange([...options, value]);
    setInput('');
  };

  const remove = (opt: string) => {
    onChange(options.filter((o) => o !== opt));
  };

  return (
    <div className='space-y-2'>
      <Label>Options</Label>
      <div className='flex items-center gap-2'>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder='Type an option and press Enter'
        />
        <Button type='button' size='sm' onClick={add}>
          Add
        </Button>
      </div>
      {options.length > 0 && (
        <div className='flex flex-wrap gap-2'>
          {options.map((opt) => (
            <Badge
              key={opt}
              variant='secondary'
              className={cn(
                'cursor-pointer select-none',
                'hover:bg-destructive/20'
              )}
              onClick={() => remove(opt)}
            >
              {opt} <X className='ml-1 h-3 w-3' />
            </Badge>
          ))}
        </div>
      )}
      {options.length === 0 && (
        <p className='text-xs text-muted-foreground'>
          Add at least one option for dropdown fields.
        </p>
      )}
    </div>
  );
}

