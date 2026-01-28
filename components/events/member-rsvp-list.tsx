'use client';

import { useState, useTransition, useMemo } from 'react';
import { Check, Plus, Minus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toggleMemberRSVP, updateGuestCount } from '@/app/actions/quick-rsvp';
import toast from 'react-hot-toast';
import type { PublicMember } from '@/lib/data/public-events';

interface MemberRSVPListProps {
  attending: PublicMember[];
  notYet: PublicMember[];
  rsvpMap: Record<string, { id: string; guests_count: number }>;
  eventId: string;
  token: string;
  isEventOver: boolean;
  isEventFull: boolean;
}

interface MemberRowProps {
  member: PublicMember;
  isAttending: boolean;
  guestsCount: number;
  eventId: string;
  token: string;
  disabled: boolean;
  onToggle: (memberId: string, newStatus: 'confirmed' | 'declined') => void;
  onGuestChange: (memberId: string, count: number) => void;
}

function MemberAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="h-10 w-10 rounded-full object-cover"
      />
    );
  }

  // Generate a consistent color from the name
  const colors = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
    'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
    'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
    'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
  ];
  const colorIndex = name.charCodeAt(0) % colors.length;
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className={`h-10 w-10 rounded-full ${colors[colorIndex]} flex items-center justify-center text-white font-semibold text-sm`}>
      {initial}
    </div>
  );
}

function MemberRow({ member, isAttending, guestsCount, eventId, token, disabled, onToggle, onGuestChange }: MemberRowProps) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    if (disabled || isPending) return;

    const newStatus = isAttending ? 'declined' : 'confirmed';

    // Optimistic update
    onToggle(member.id, newStatus);

    startTransition(async () => {
      const result = await toggleMemberRSVP({
        event_id: eventId,
        token,
        member_id: member.id,
        guests_count: isAttending ? 0 : guestsCount,
      });

      if (!result.success) {
        // Revert optimistic update
        onToggle(member.id, isAttending ? 'confirmed' : 'declined');
        toast.error(result.error || 'Failed to update RSVP');
      }
    });
  };

  const handleGuestIncrement = () => {
    if (guestsCount >= 5) return;
    const newCount = guestsCount + 1;
    onGuestChange(member.id, newCount);

    startTransition(async () => {
      await updateGuestCount({ event_id: eventId, token, member_id: member.id, guests_count: newCount });
    });
  };

  const handleGuestDecrement = () => {
    if (guestsCount <= 0) return;
    const newCount = guestsCount - 1;
    onGuestChange(member.id, newCount);

    startTransition(async () => {
      await updateGuestCount({ event_id: eventId, token, member_id: member.id, guests_count: newCount });
    });
  };

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${isAttending ? 'bg-green-50 dark:bg-green-950/20' : 'hover:bg-muted/50'} ${isPending ? 'opacity-70' : ''}`}>
      <MemberAvatar name={member.full_name} avatarUrl={member.avatar_url} />

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{member.full_name}</p>
        {member.company && (
          <p className="text-xs text-muted-foreground truncate">{member.company}</p>
        )}
      </div>

      {isAttending ? (
        <div className="flex items-center gap-2">
          {/* Guest counter */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleGuestDecrement}
              disabled={disabled || isPending || guestsCount <= 0}
              className="h-6 w-6 rounded-full border flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="text-xs w-6 text-center text-muted-foreground">+{guestsCount}</span>
            <button
              onClick={handleGuestIncrement}
              disabled={disabled || isPending || guestsCount >= 5}
              className="h-6 w-6 rounded-full border flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {/* Undo button */}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-green-600 hover:text-red-600 hover:bg-red-50"
            onClick={handleToggle}
            disabled={disabled || isPending}
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs font-medium"
          onClick={handleToggle}
          disabled={disabled || isPending}
        >
          I&apos;m In
        </Button>
      )}
    </div>
  );
}

export function MemberRSVPList({ attending: initialAttending, notYet: initialNotYet, rsvpMap: initialRsvpMap, eventId, token, isEventOver, isEventFull }: MemberRSVPListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Local state for optimistic updates
  const [localStatuses, setLocalStatuses] = useState<Record<string, 'confirmed' | 'declined'>>({});
  const [localGuests, setLocalGuests] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const [memberId, rsvp] of Object.entries(initialRsvpMap)) {
      initial[memberId] = rsvp.guests_count;
    }
    return initial;
  });

  // Merge server state with local optimistic state
  const allMembers = useMemo(() => [...initialAttending, ...initialNotYet], [initialAttending, initialNotYet]);

  const { attending, notYet } = useMemo(() => {
    const att: PublicMember[] = [];
    const ny: PublicMember[] = [];

    for (const member of allMembers) {
      const localStatus = localStatuses[member.id];
      const serverIsAttending = initialAttending.some(m => m.id === member.id);

      const isAttending = localStatus ? localStatus === 'confirmed' : serverIsAttending;

      if (isAttending) {
        att.push(member);
      } else {
        ny.push(member);
      }
    }

    att.sort((a, b) => a.full_name.localeCompare(b.full_name));
    ny.sort((a, b) => a.full_name.localeCompare(b.full_name));

    return { attending: att, notYet: ny };
  }, [allMembers, localStatuses, initialAttending]);

  const handleToggle = (memberId: string, newStatus: 'confirmed' | 'declined') => {
    setLocalStatuses(prev => ({ ...prev, [memberId]: newStatus }));
    if (newStatus === 'confirmed' && !(memberId in localGuests)) {
      setLocalGuests(prev => ({ ...prev, [memberId]: 0 }));
    }
  };

  const handleGuestChange = (memberId: string, count: number) => {
    setLocalGuests(prev => ({ ...prev, [memberId]: count }));
  };

  // Filter by search
  const filterMembers = (members: PublicMember[]) => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase();
    return members.filter(m =>
      m.full_name.toLowerCase().includes(q) ||
      (m.company && m.company.toLowerCase().includes(q))
    );
  };

  const filteredAttending = filterMembers(attending);
  const filteredNotYet = filterMembers(notYet);
  const disabled = isEventOver;

  return (
    <div className="space-y-4">
      {/* Search bar for large chapters */}
      {allMembers.length > 15 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Attending Section */}
      <div>
        <h2 className="text-sm font-semibold text-green-600 mb-2 flex items-center gap-2">
          <Check className="h-4 w-4" />
          Attending ({attending.length})
        </h2>
        <div className="space-y-1">
          {filteredAttending.length > 0 ? (
            filteredAttending.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                isAttending={true}
                guestsCount={localGuests[member.id] ?? 0}
                eventId={eventId}
                token={token}
                disabled={disabled}
                onToggle={handleToggle}
                onGuestChange={handleGuestChange}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground py-3 text-center">
              {searchQuery ? 'No matching attendees' : 'No one has RSVP\'d yet. Be the first!'}
            </p>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t" />

      {/* Not Yet Section */}
      {notYet.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">
            Not Yet Responded ({notYet.length})
          </h2>
          <div className="space-y-1">
            {filteredNotYet.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                isAttending={false}
                guestsCount={localGuests[member.id] ?? 0}
                eventId={eventId}
                token={token}
                disabled={disabled || isEventFull}
                onToggle={handleToggle}
                onGuestChange={handleGuestChange}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
