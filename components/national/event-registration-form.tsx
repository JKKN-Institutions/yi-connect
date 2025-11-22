'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { registerForNationalEvent } from '@/app/actions/national-integration';
import { toast } from 'sonner';

interface EventRegistrationFormProps {
  eventId: string;
  eventTitle: string;
}

export function EventRegistrationForm({ eventId, eventTitle }: EventRegistrationFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    dietary_requirements: '',
    accommodation_required: false,
    travel_assistance: false,
    special_requests: '',
    emergency_contact_name: '',
    emergency_contact_phone: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const form = new FormData();
      form.set('event_id', eventId);
      form.set('dietary_requirements', formData.dietary_requirements);
      form.set('accommodation_required', String(formData.accommodation_required));
      form.set('travel_assistance', String(formData.travel_assistance));
      form.set('special_requests', formData.special_requests);
      form.set('emergency_contact_name', formData.emergency_contact_name);
      form.set('emergency_contact_phone', formData.emergency_contact_phone);

      const result = await registerForNationalEvent(form);

      if (result.success) {
        toast.success('Registration submitted successfully!');
        setOpen(false);
        router.push(`/national/events/${eventId}`);
      } else {
        toast.error(result.error || 'Failed to register');
      }
    } catch (error) {
      toast.error('An error occurred while registering');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    router.push(`/national/events/${eventId}`);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Event Registration</DialogTitle>
          <DialogDescription>
            Register for {eventTitle}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dietary">Dietary Requirements</Label>
            <Select
              value={formData.dietary_requirements}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, dietary_requirements: value }))
              }
            >
              <SelectTrigger id="dietary">
                <SelectValue placeholder="Select dietary preference" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No restrictions</SelectItem>
                <SelectItem value="vegetarian">Vegetarian</SelectItem>
                <SelectItem value="vegan">Vegan</SelectItem>
                <SelectItem value="halal">Halal</SelectItem>
                <SelectItem value="kosher">Kosher</SelectItem>
                <SelectItem value="gluten_free">Gluten Free</SelectItem>
                <SelectItem value="other">Other (specify in requests)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="accommodation"
              checked={formData.accommodation_required}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  accommodation_required: checked === true
                }))
              }
            />
            <Label htmlFor="accommodation" className="text-sm font-normal">
              I need accommodation assistance
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="travel"
              checked={formData.travel_assistance}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  travel_assistance: checked === true
                }))
              }
            />
            <Label htmlFor="travel" className="text-sm font-normal">
              I need travel assistance
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="special">Special Requests</Label>
            <Textarea
              id="special"
              placeholder="Any special requirements or requests..."
              value={formData.special_requests}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, special_requests: e.target.value }))
              }
              rows={3}
            />
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-3">Emergency Contact</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="emergency_name">Contact Name</Label>
                <Input
                  id="emergency_name"
                  placeholder="Full name"
                  value={formData.emergency_contact_name}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      emergency_contact_name: e.target.value
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergency_phone">Contact Phone</Label>
                <Input
                  id="emergency_phone"
                  placeholder="+91 98765 43210"
                  value={formData.emergency_contact_phone}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      emergency_contact_phone: e.target.value
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isSubmitting ? 'Submitting...' : 'Complete Registration'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
