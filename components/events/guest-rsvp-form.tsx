'use client';

import { useState, useTransition } from 'react';
import { ChevronDown, ChevronUp, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addGuestRSVP } from '@/app/actions/quick-rsvp';
import toast from 'react-hot-toast';
import type { PublicGuestRSVP } from '@/lib/data/public-events';

interface GuestRSVPFormProps {
  eventId: string;
  token: string;
  existingGuests: PublicGuestRSVP[];
}

export function GuestRSVPForm({ eventId, token, existingGuests }: GuestRSVPFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [guests, setGuests] = useState<PublicGuestRSVP[]>(existingGuests);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Please enter your name');
      return;
    }

    startTransition(async () => {
      const result = await addGuestRSVP({
        event_id: eventId,
        token,
        full_name: name.trim(),
        phone: phone.trim() || undefined,
      });

      if (result.success) {
        setGuests(prev => [...prev, { id: result.data!.id, full_name: name.trim(), status: 'confirmed' }]);
        setName('');
        setPhone('');
        toast.success('You\'re in! See you there.');
      } else {
        toast.error(result.error || 'Failed to add RSVP');
      }
    });
  };

  return (
    <div className="mt-6 border rounded-xl overflow-hidden">
      {/* Toggle Header */}
      <button
        className="w-full p-4 flex items-center justify-between text-sm font-medium hover:bg-muted/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-muted-foreground" />
          <span>Not a member? Add yourself</span>
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label htmlFor="guest-name" className="text-xs">Name *</Label>
              <Input
                id="guest-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                required
                disabled={isPending}
              />
            </div>
            <div>
              <Label htmlFor="guest-phone" className="text-xs">Phone (optional)</Label>
              <Input
                id="guest-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Your phone number"
                disabled={isPending}
              />
            </div>
            <Button type="submit" size="sm" className="w-full" disabled={isPending}>
              {isPending ? 'Adding...' : 'Count me in'}
            </Button>
          </form>

          {/* Show existing guests */}
          {guests.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-2">Guests ({guests.length})</p>
              <div className="space-y-1">
                {guests.map((guest) => (
                  <div key={guest.id} className="flex items-center gap-2 text-sm py-1">
                    <div className="h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center text-xs text-white">
                      {guest.full_name.charAt(0).toUpperCase()}
                    </div>
                    <span>{guest.full_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
