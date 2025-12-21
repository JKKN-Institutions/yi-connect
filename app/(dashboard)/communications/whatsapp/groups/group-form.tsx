'use client';

/**
 * WhatsApp Group Form (Client Component)
 *
 * Shared form for creating and editing WhatsApp groups.
 */

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  createWhatsAppGroup,
  updateWhatsAppGroup,
  type WhatsAppActionState
} from '@/app/actions/whatsapp';
import { GROUP_TYPE_INFO } from '@/types/whatsapp';
import type { WhatsAppGroup } from '@/types/whatsapp';

interface GroupFormProps {
  group?: WhatsAppGroup;
}

const initialState: WhatsAppActionState = {
  success: false,
  message: ''
};

export function GroupForm({ group }: GroupFormProps) {
  const router = useRouter();
  const isEditing = !!group;

  // Bind update action with group id if editing
  const action = isEditing
    ? updateWhatsAppGroup.bind(null, group.id)
    : createWhatsAppGroup;

  const [state, formAction, isPending] = useActionState(action, initialState);

  // Redirect on success
  useEffect(() => {
    if (state.success) {
      router.push('/communications/whatsapp/groups');
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? 'Edit Group' : 'Group Details'}</CardTitle>
        <CardDescription>
          {isEditing
            ? 'Update the group information'
            : 'Enter the WhatsApp group details'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
          {/* JID (only for new groups) */}
          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="jid">Group JID *</Label>
              <Input
                id="jid"
                name="jid"
                placeholder="e.g., 919876543210-1234567890@g.us"
                required
              />
              <p className="text-xs text-muted-foreground">
                The WhatsApp Group ID (JID). You can find this in WhatsApp Web developer tools.
              </p>
              {state.errors?.jid && (
                <p className="text-xs text-destructive">{state.errors.jid[0]}</p>
              )}
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Group Name *</Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g., Yi Erode Chapter"
              defaultValue={group?.name}
              required
            />
            {state.errors?.name && (
              <p className="text-xs text-destructive">{state.errors.name[0]}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Brief description of this group..."
              defaultValue={group?.description || ''}
              rows={3}
            />
            {state.errors?.description && (
              <p className="text-xs text-destructive">
                {state.errors.description[0]}
              </p>
            )}
          </div>

          {/* Group Type */}
          <div className="space-y-2">
            <Label htmlFor="group_type">Group Type</Label>
            <Select name="group_type" defaultValue={group?.group_type || ''}>
              <SelectTrigger id="group_type">
                <SelectValue placeholder="Select group type" />
              </SelectTrigger>
              <SelectContent>
                {GROUP_TYPE_INFO.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex flex-col">
                      <span>{type.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {type.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state.errors?.group_type && (
              <p className="text-xs text-destructive">
                {state.errors.group_type[0]}
              </p>
            )}
          </div>

          {/* Member Count */}
          <div className="space-y-2">
            <Label htmlFor="member_count">Member Count</Label>
            <Input
              id="member_count"
              name="member_count"
              type="number"
              min={0}
              placeholder="e.g., 50"
              defaultValue={group?.member_count || ''}
            />
            <p className="text-xs text-muted-foreground">
              Approximate number of members in this group
            </p>
            {state.errors?.member_count && (
              <p className="text-xs text-destructive">
                {state.errors.member_count[0]}
              </p>
            )}
          </div>

          {/* Switches */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_default">Default Group</Label>
                <p className="text-xs text-muted-foreground">
                  Show this group in quick actions
                </p>
              </div>
              <Switch
                id="is_default"
                name="is_default"
                value="true"
                defaultChecked={group?.is_default}
              />
            </div>

            {isEditing && (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="is_active">Active</Label>
                  <p className="text-xs text-muted-foreground">
                    Inactive groups won&apos;t appear in selection lists
                  </p>
                </div>
                <Switch
                  id="is_active"
                  name="is_active"
                  value="true"
                  defaultChecked={group?.is_active ?? true}
                />
              </div>
            )}
          </div>

          {/* Error Message */}
          {state.message && !state.success && (
            <Alert variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <div className="flex gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {isEditing ? 'Update Group' : 'Create Group'}
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/communications/whatsapp/groups')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
