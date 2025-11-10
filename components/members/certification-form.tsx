/**
 * Certification Form Components
 *
 * Forms for adding and managing member certifications.
 */

'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  addMemberCertification,
  updateMemberCertification
} from '@/app/actions/members';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { Certification } from '@/types/member';

interface AddCertificationFormProps {
  memberId: string;
  certifications: Certification[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UpdateCertificationFormProps {
  certificationId: string;
  currentCertificateNumber?: string | null;
  currentIssuedDate: string;
  currentExpiryDate?: string | null;
  currentDocumentUrl?: string | null;
  currentNotes?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type='submit' disabled={pending}>
      {pending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
      {label}
    </Button>
  );
}

export function AddCertificationDialog({
  memberId,
  certifications,
  open,
  onOpenChange
}: AddCertificationFormProps) {
  const [state, formAction] = useActionState(addMemberCertification, {
    message: '',
    errors: {}
  });

  // Close dialog on success
  if (state.success && open) {
    setTimeout(() => onOpenChange(false), 1000);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Add Certification</DialogTitle>
          <DialogDescription>
            Add a new certification to this member&apos;s profile
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className='space-y-4'>
          <input type='hidden' name='member_id' value={memberId} />

          {state.message && (
            <Alert variant={state.success ? 'default' : 'destructive'}>
              <AlertCircle className='h-4 w-4' />
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}

          <div className='space-y-2'>
            <Label htmlFor='certification_id'>Certification *</Label>
            <Select name='certification_id' required>
              <SelectTrigger id='certification_id'>
                <SelectValue placeholder='Select a certification' />
              </SelectTrigger>
              <SelectContent>
                {certifications.map((cert) => (
                  <SelectItem key={cert.id} value={cert.id}>
                    {cert.name} - {cert.issuing_organization}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state.errors?.certification_id && (
              <p className='text-sm text-destructive'>
                {state.errors.certification_id[0]}
              </p>
            )}
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='certificate_number'>Certificate Number</Label>
              <Input
                id='certificate_number'
                name='certificate_number'
                placeholder='CERT-2024-001'
              />
              {state.errors?.certificate_number && (
                <p className='text-sm text-destructive'>
                  {state.errors.certificate_number[0]}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='issued_date'>Issued Date *</Label>
              <Input
                id='issued_date'
                name='issued_date'
                type='date'
                required
                defaultValue={new Date().toISOString().split('T')[0]}
              />
              {state.errors?.issued_date && (
                <p className='text-sm text-destructive'>
                  {state.errors.issued_date[0]}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='expiry_date'>Expiry Date</Label>
              <Input id='expiry_date' name='expiry_date' type='date' />
              {state.errors?.expiry_date && (
                <p className='text-sm text-destructive'>
                  {state.errors.expiry_date[0]}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='document_url'>Document URL</Label>
              <Input
                id='document_url'
                name='document_url'
                type='url'
                placeholder='https://example.com/certificate.pdf'
              />
              {state.errors?.document_url && (
                <p className='text-sm text-destructive'>
                  {state.errors.document_url[0]}
                </p>
              )}
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='notes'>Notes</Label>
            <Textarea
              id='notes'
              name='notes'
              placeholder='Any additional information about this certification...'
              rows={3}
            />
            {state.errors?.notes && (
              <p className='text-sm text-destructive'>
                {state.errors.notes[0]}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <SubmitButton label='Add Certification' />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UpdateCertificationDialog({
  certificationId,
  currentCertificateNumber,
  currentIssuedDate,
  currentExpiryDate,
  currentDocumentUrl,
  currentNotes,
  open,
  onOpenChange
}: UpdateCertificationFormProps) {
  const [state, formAction] = useActionState(updateMemberCertification, {
    message: '',
    errors: {}
  });

  // Close dialog on success
  if (state.success && open) {
    setTimeout(() => onOpenChange(false), 1000);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Update Certification</DialogTitle>
          <DialogDescription>Update certification details</DialogDescription>
        </DialogHeader>

        <form action={formAction} className='space-y-4'>
          <input type='hidden' name='id' value={certificationId} />

          {state.message && (
            <Alert variant={state.success ? 'default' : 'destructive'}>
              <AlertCircle className='h-4 w-4' />
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}

          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='certificate_number'>Certificate Number</Label>
              <Input
                id='certificate_number'
                name='certificate_number'
                placeholder='CERT-2024-001'
                defaultValue={currentCertificateNumber || ''}
              />
              {state.errors?.certificate_number && (
                <p className='text-sm text-destructive'>
                  {state.errors.certificate_number[0]}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='issued_date'>Issued Date</Label>
              <Input
                id='issued_date'
                name='issued_date'
                type='date'
                defaultValue={currentIssuedDate}
              />
              {state.errors?.issued_date && (
                <p className='text-sm text-destructive'>
                  {state.errors.issued_date[0]}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='expiry_date'>Expiry Date</Label>
              <Input
                id='expiry_date'
                name='expiry_date'
                type='date'
                defaultValue={currentExpiryDate || ''}
              />
              {state.errors?.expiry_date && (
                <p className='text-sm text-destructive'>
                  {state.errors.expiry_date[0]}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='document_url'>Document URL</Label>
              <Input
                id='document_url'
                name='document_url'
                type='url'
                placeholder='https://example.com/certificate.pdf'
                defaultValue={currentDocumentUrl || ''}
              />
              {state.errors?.document_url && (
                <p className='text-sm text-destructive'>
                  {state.errors.document_url[0]}
                </p>
              )}
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='notes'>Notes</Label>
            <Textarea
              id='notes'
              name='notes'
              placeholder='Any additional information about this certification...'
              rows={3}
              defaultValue={currentNotes || ''}
            />
            {state.errors?.notes && (
              <p className='text-sm text-destructive'>
                {state.errors.notes[0]}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <SubmitButton label='Update Certification' />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
