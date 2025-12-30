/**
 * Create Trainer Profile Dialog Component
 *
 * Dialog for creating a trainer profile for a member.
 */

'use client';

import { useActionState, useState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { createTrainerProfile } from '@/app/actions/trainers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Loader2, GraduationCap, CheckCircle2 } from 'lucide-react';
import { AGE_GROUP_LABELS } from '@/types/trainer';

// Default session types based on Yi Connect verticals
const SESSION_TYPES = [
  { id: 'masoom', label: 'Masoom (Child Safety)' },
  { id: 'road_safety', label: 'Road Safety' },
  { id: 'career_guidance', label: 'Career Guidance' },
  { id: 'soft_skills', label: 'Soft Skills' },
  { id: 'entrepreneurship', label: 'Entrepreneurship' },
  { id: 'life_skills', label: 'Life Skills' },
  { id: 'health_wellness', label: 'Health & Wellness' },
  { id: 'environment', label: 'Environment Awareness' },
  { id: 'digital_literacy', label: 'Digital Literacy' },
  { id: 'financial_literacy', label: 'Financial Literacy' },
];

const AGE_GROUPS = [
  { id: 'children_6_10', label: 'Children (6-10 years)' },
  { id: 'children_11_14', label: 'Children (11-14 years)' },
  { id: 'teens_15_18', label: 'Teenagers (15-18 years)' },
  { id: 'young_adults_19_25', label: 'Young Adults (19-25 years)' },
  { id: 'adults_26_plus', label: 'Adults (26+ years)' },
];

interface CreateTrainerProfileDialogProps {
  memberId: string;
  chapterId: string;
  memberName?: string;
  verticals?: Array<{ id: string; name: string; color: string | null }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Create Trainer Profile
    </Button>
  );
}

export function CreateTrainerProfileDialog({
  memberId,
  chapterId,
  memberName,
  verticals = [],
  open,
  onOpenChange,
}: CreateTrainerProfileDialogProps) {
  const [state, formAction] = useActionState(createTrainerProfile, {
    message: '',
    errors: {},
  });

  const [selectedSessionTypes, setSelectedSessionTypes] = useState<string[]>([]);
  const [preferredSessionTypes, setPreferredSessionTypes] = useState<string[]>([]);
  const [selectedAgeGroups, setSelectedAgeGroups] = useState<string[]>([]);
  const [selectedVerticals, setSelectedVerticals] = useState<string[]>([]);

  // Close dialog on success
  useEffect(() => {
    if (state.success && open) {
      const timer = setTimeout(() => {
        onOpenChange(false);
        // Reset state after closing
        setSelectedSessionTypes([]);
        setPreferredSessionTypes([]);
        setSelectedAgeGroups([]);
        setSelectedVerticals([]);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [state.success, open, onOpenChange]);

  const toggleSessionType = (typeId: string) => {
    setSelectedSessionTypes((prev) =>
      prev.includes(typeId) ? prev.filter((id) => id !== typeId) : [...prev, typeId]
    );
  };

  const togglePreferredSessionType = (typeId: string) => {
    setPreferredSessionTypes((prev) =>
      prev.includes(typeId) ? prev.filter((id) => id !== typeId) : [...prev, typeId]
    );
  };

  const toggleAgeGroup = (groupId: string) => {
    setSelectedAgeGroups((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const toggleVertical = (verticalId: string) => {
    setSelectedVerticals((prev) =>
      prev.includes(verticalId) ? prev.filter((id) => id !== verticalId) : [...prev, verticalId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Create Trainer Profile
          </DialogTitle>
          <DialogDescription>
            {memberName
              ? `Create a trainer profile for ${memberName} to enable them to conduct sessions.`
              : 'Create a trainer profile to enable this member to conduct sessions.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <form action={formAction} className="space-y-6">
            <input type="hidden" name="member_id" value={memberId} />
            <input type="hidden" name="chapter_id" value={chapterId} />
            <input type="hidden" name="is_trainer_eligible" value="true" />
            <input
              type="hidden"
              name="eligible_session_types"
              value={JSON.stringify(selectedSessionTypes)}
            />
            <input
              type="hidden"
              name="preferred_session_types"
              value={JSON.stringify(preferredSessionTypes)}
            />
            <input
              type="hidden"
              name="preferred_age_groups"
              value={JSON.stringify(selectedAgeGroups)}
            />
            <input
              type="hidden"
              name="eligible_verticals"
              value={JSON.stringify(selectedVerticals)}
            />

            {state.message && (
              <Alert variant={state.success ? 'default' : 'destructive'}>
                {state.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            )}

            {/* Eligible Session Types */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                Eligible Session Types
                <span className="text-muted-foreground text-sm font-normal ml-2">
                  (Types this trainer can conduct)
                </span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {SESSION_TYPES.map((type) => (
                  <div
                    key={type.id}
                    className={`flex items-center space-x-2 p-2 rounded-md border cursor-pointer transition-colors ${
                      selectedSessionTypes.includes(type.id)
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => toggleSessionType(type.id)}
                  >
                    <Checkbox
                      id={`session-${type.id}`}
                      checked={selectedSessionTypes.includes(type.id)}
                      onCheckedChange={() => toggleSessionType(type.id)}
                    />
                    <label
                      htmlFor={`session-${type.id}`}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {type.label}
                    </label>
                  </div>
                ))}
              </div>
              {selectedSessionTypes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedSessionTypes.map((id) => {
                    const type = SESSION_TYPES.find((t) => t.id === id);
                    return (
                      <Badge key={id} variant="secondary" className="text-xs">
                        {type?.label}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>

            <Separator />

            {/* Preferred Session Types */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                Preferred Session Types
                <span className="text-muted-foreground text-sm font-normal ml-2">
                  (Types trainer prefers to conduct)
                </span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {SESSION_TYPES.map((type) => (
                  <div
                    key={`pref-${type.id}`}
                    className={`flex items-center space-x-2 p-2 rounded-md border cursor-pointer transition-colors ${
                      preferredSessionTypes.includes(type.id)
                        ? 'bg-blue-500/10 border-blue-500'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => togglePreferredSessionType(type.id)}
                  >
                    <Checkbox
                      id={`pref-session-${type.id}`}
                      checked={preferredSessionTypes.includes(type.id)}
                      onCheckedChange={() => togglePreferredSessionType(type.id)}
                    />
                    <label
                      htmlFor={`pref-session-${type.id}`}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {type.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Preferred Age Groups */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                Preferred Age Groups
                <span className="text-muted-foreground text-sm font-normal ml-2">
                  (Audience trainer prefers)
                </span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {AGE_GROUPS.map((group) => (
                  <div
                    key={group.id}
                    className={`flex items-center space-x-2 p-2 rounded-md border cursor-pointer transition-colors ${
                      selectedAgeGroups.includes(group.id)
                        ? 'bg-green-500/10 border-green-500'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => toggleAgeGroup(group.id)}
                  >
                    <Checkbox
                      id={`age-${group.id}`}
                      checked={selectedAgeGroups.includes(group.id)}
                      onCheckedChange={() => toggleAgeGroup(group.id)}
                    />
                    <label
                      htmlFor={`age-${group.id}`}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {group.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Verticals (if available) */}
            {verticals.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label className="text-base font-semibold">
                    Eligible Verticals
                    <span className="text-muted-foreground text-sm font-normal ml-2">
                      (Yi verticals trainer can serve)
                    </span>
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {verticals.map((vertical) => (
                      <div
                        key={vertical.id}
                        className={`flex items-center space-x-2 p-2 rounded-md border cursor-pointer transition-colors ${
                          selectedVerticals.includes(vertical.name)
                            ? 'bg-purple-500/10 border-purple-500'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => toggleVertical(vertical.name)}
                      >
                        <Checkbox
                          id={`vertical-${vertical.id}`}
                          checked={selectedVerticals.includes(vertical.name)}
                          onCheckedChange={() => toggleVertical(vertical.name)}
                        />
                        <label
                          htmlFor={`vertical-${vertical.id}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {vertical.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Max Sessions Per Month */}
            <div className="space-y-2">
              <Label htmlFor="max_sessions_per_month" className="text-base font-semibold">
                Max Sessions Per Month
                <span className="text-muted-foreground text-sm font-normal ml-2">
                  (Optional capacity limit)
                </span>
              </Label>
              <Input
                id="max_sessions_per_month"
                name="max_sessions_per_month"
                type="number"
                min="1"
                max="30"
                placeholder="e.g., 4"
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for no limit. Trainer status will change to &quot;Maxed Out&quot; when
                limit is reached.
              </p>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <SubmitButton />
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
