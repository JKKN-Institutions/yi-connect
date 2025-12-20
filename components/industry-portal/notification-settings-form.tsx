/**
 * Notification Settings Form Component
 * Form for managing notification preferences
 */

'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Bell, Mail, Smartphone } from 'lucide-react';

interface NotificationSettingsFormProps {
  userId: string;
}

interface NotificationPreferences {
  email_new_booking: boolean;
  email_booking_cancelled: boolean;
  email_slot_reminder: boolean;
  email_capacity_alert: boolean;
  push_new_booking: boolean;
  push_booking_cancelled: boolean;
  push_slot_reminder: boolean;
}

export function NotificationSettingsForm({ userId }: NotificationSettingsFormProps) {
  const [isPending, setIsPending] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email_new_booking: true,
    email_booking_cancelled: true,
    email_slot_reminder: true,
    email_capacity_alert: true,
    push_new_booking: true,
    push_booking_cancelled: false,
    push_slot_reminder: true,
  });

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    setIsPending(true);
    try {
      // In a full implementation, this would call a server action
      // For now, we simulate a save
      await new Promise((resolve) => setTimeout(resolve, 500));
      toast.success('Notification preferences saved');
    } catch {
      toast.error('Failed to save preferences');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Email Notifications */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">Email Notifications</h3>
        </div>
        <div className="space-y-4 pl-7">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="email_new_booking">New Bookings</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when a member books your IV slot
              </p>
            </div>
            <Switch
              id="email_new_booking"
              checked={preferences.email_new_booking}
              onCheckedChange={() => handleToggle('email_new_booking')}
              disabled={isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="email_booking_cancelled">Booking Cancellations</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when a member cancels their booking
              </p>
            </div>
            <Switch
              id="email_booking_cancelled"
              checked={preferences.email_booking_cancelled}
              onCheckedChange={() => handleToggle('email_booking_cancelled')}
              disabled={isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="email_slot_reminder">Slot Reminders</Label>
              <p className="text-sm text-muted-foreground">
                Receive reminders before your scheduled IV slots
              </p>
            </div>
            <Switch
              id="email_slot_reminder"
              checked={preferences.email_slot_reminder}
              onCheckedChange={() => handleToggle('email_slot_reminder')}
              disabled={isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="email_capacity_alert">Capacity Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when slots reach capacity or have low registrations
              </p>
            </div>
            <Switch
              id="email_capacity_alert"
              checked={preferences.email_capacity_alert}
              onCheckedChange={() => handleToggle('email_capacity_alert')}
              disabled={isPending}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Push Notifications */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">Push Notifications</h3>
        </div>
        <div className="space-y-4 pl-7">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="push_new_booking">New Bookings</Label>
              <p className="text-sm text-muted-foreground">
                Instant push notification for new bookings
              </p>
            </div>
            <Switch
              id="push_new_booking"
              checked={preferences.push_new_booking}
              onCheckedChange={() => handleToggle('push_new_booking')}
              disabled={isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="push_booking_cancelled">Booking Cancellations</Label>
              <p className="text-sm text-muted-foreground">
                Instant push notification for cancellations
              </p>
            </div>
            <Switch
              id="push_booking_cancelled"
              checked={preferences.push_booking_cancelled}
              onCheckedChange={() => handleToggle('push_booking_cancelled')}
              disabled={isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="push_slot_reminder">Slot Reminders</Label>
              <p className="text-sm text-muted-foreground">
                Push reminder before your scheduled IV slots
              </p>
            </div>
            <Switch
              id="push_slot_reminder"
              checked={preferences.push_slot_reminder}
              onCheckedChange={() => handleToggle('push_slot_reminder')}
              disabled={isPending}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
}
