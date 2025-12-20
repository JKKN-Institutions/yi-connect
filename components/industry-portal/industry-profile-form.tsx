/**
 * Industry Profile Form Component
 * Form for updating industry/company profile information
 */

'use client';

import { useActionState, useEffect } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { updateIndustryProfile } from '@/app/actions/industry-portal';

const INDUSTRY_SECTORS = [
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'it_services', label: 'IT Services' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'education', label: 'Education' },
  { value: 'retail', label: 'Retail' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'construction', label: 'Construction' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'finance', label: 'Finance' },
  { value: 'other', label: 'Other' },
];

const CSR_FOCUS_AREAS = [
  'Education',
  'Healthcare',
  'Environment',
  'Skill Development',
  'Women Empowerment',
  'Rural Development',
  'Sports',
  'Arts & Culture',
];

interface IndustryProfileFormProps {
  industry: {
    id: string;
    company_name: string;
    industry_sector: string;
    city: string;
    state: string;
    address_line1?: string;
    website?: string;
    employee_count?: number;
    has_csr_program?: boolean;
    csr_focus_areas?: string[];
    collaboration_interests?: string[];
    notes?: string;
  };
}

export function IndustryProfileForm({ industry }: IndustryProfileFormProps) {
  const [state, formAction, isPending] = useActionState(updateIndustryProfile, {
    message: '',
  });

  useEffect(() => {
    if (state.success) {
      toast.success(state.message);
    } else if (state.message && !state.success) {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="industry_id" value={industry.id} />

      <div className="grid gap-4 md:grid-cols-2">
        {/* Company Name */}
        <div className="space-y-2">
          <Label htmlFor="company_name">
            Company Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="company_name"
            name="company_name"
            defaultValue={industry.company_name}
            required
            disabled={isPending}
          />
          {state.errors?.company_name && (
            <p className="text-sm text-destructive">{state.errors.company_name[0]}</p>
          )}
        </div>

        {/* Industry Sector */}
        <div className="space-y-2">
          <Label htmlFor="industry_sector">Industry Sector</Label>
          <Select name="industry_sector" defaultValue={industry.industry_sector}>
            <SelectTrigger id="industry_sector" disabled={isPending}>
              <SelectValue placeholder="Select sector" />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRY_SECTORS.map((sector) => (
                <SelectItem key={sector.value} value={sector.value}>
                  {sector.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-2">
        <Label htmlFor="address_line1">Address</Label>
        <Input
          id="address_line1"
          name="address_line1"
          defaultValue={industry.address_line1 || ''}
          placeholder="Street address"
          disabled={isPending}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* City */}
        <div className="space-y-2">
          <Label htmlFor="city">
            City <span className="text-destructive">*</span>
          </Label>
          <Input
            id="city"
            name="city"
            defaultValue={industry.city}
            required
            disabled={isPending}
          />
        </div>

        {/* State */}
        <div className="space-y-2">
          <Label htmlFor="state">
            State <span className="text-destructive">*</span>
          </Label>
          <Input
            id="state"
            name="state"
            defaultValue={industry.state}
            required
            disabled={isPending}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Website */}
        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            name="website"
            type="url"
            defaultValue={industry.website || ''}
            placeholder="https://example.com"
            disabled={isPending}
          />
        </div>

        {/* Employee Count */}
        <div className="space-y-2">
          <Label htmlFor="employee_count">Number of Employees</Label>
          <Input
            id="employee_count"
            name="employee_count"
            type="number"
            defaultValue={industry.employee_count || ''}
            placeholder="100"
            disabled={isPending}
          />
        </div>
      </div>

      {/* CSR Program */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="has_csr_program"
            name="has_csr_program"
            defaultChecked={industry.has_csr_program}
            disabled={isPending}
          />
          <Label htmlFor="has_csr_program" className="font-normal cursor-pointer">
            We have a CSR program
          </Label>
        </div>

        {/* CSR Focus Areas */}
        <div className="space-y-2">
          <Label>CSR Focus Areas</Label>
          <div className="grid gap-2 md:grid-cols-4">
            {CSR_FOCUS_AREAS.map((area) => (
              <div key={area} className="flex items-center space-x-2">
                <Checkbox
                  id={`csr_${area}`}
                  name="csr_focus_areas"
                  value={area}
                  defaultChecked={industry.csr_focus_areas?.includes(area)}
                  disabled={isPending}
                />
                <Label htmlFor={`csr_${area}`} className="font-normal cursor-pointer text-sm">
                  {area}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Additional Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={industry.notes || ''}
          placeholder="Any additional information about your company..."
          rows={3}
          disabled={isPending}
        />
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Error Message */}
      {state.message && !state.success && !state.errors && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{state.message}</p>
        </div>
      )}
    </form>
  );
}
