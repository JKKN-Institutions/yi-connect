'use client';

import { useState } from 'react';
import { Loader2, Bell, Mail, Calendar, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { updateNotificationSettings } from '@/app/actions/industry-portal';

interface NotificationSettingsProps {
  initialSettings: {
    email_notifications: boolean;
    visit_request_notifications: boolean;
    application_updates: boolean;
    weekly_digest: boolean;
  };
}

export function NotificationsSettings({ initialSettings }: NotificationSettingsProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [isSaving, setIsSaving] = useState<string | null>(null);

  const handleToggle = async (key: keyof typeof settings) => {
    const newValue = !settings[key];
    const newSettings = { ...settings, [key]: newValue };

    setIsSaving(key);
    setSettings(newSettings);

    try {
      const result = await updateNotificationSettings(newSettings);
      if (result.success) {
        toast.success(result.message || 'Setting updated');
      } else {
        // Revert on failure
        setSettings(settings);
        toast.error(result.message || 'Failed to update setting');
      }
    } catch {
      // Revert on error
      setSettings(settings);
      toast.error('An error occurred');
    } finally {
      setIsSaving(null);
    }
  };

  const notificationOptions = [
    {
      key: 'email_notifications' as const,
      icon: Mail,
      title: 'Email Notifications',
      description: 'Receive important updates and alerts via email',
    },
    {
      key: 'visit_request_notifications' as const,
      icon: Calendar,
      title: 'Visit Request Notifications',
      description: 'Get notified when Yi members request to visit your facility',
    },
    {
      key: 'application_updates' as const,
      icon: FileText,
      title: 'Application Updates',
      description: 'Receive notifications about booking confirmations and changes',
    },
    {
      key: 'weekly_digest' as const,
      icon: Bell,
      title: 'Weekly Digest',
      description: 'Get a weekly summary of all activity on your portal',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Manage how and when you receive notifications about your industrial visits.
        </p>
      </div>

      <div className="space-y-4">
        {notificationOptions.map((option) => {
          const Icon = option.icon;
          const isLoading = isSaving === option.key;

          return (
            <div
              key={option.key}
              className="flex items-center justify-between p-4 border rounded-lg bg-card"
            >
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-0.5">
                  <Label htmlFor={option.key} className="font-medium cursor-pointer">
                    {option.title}
                  </Label>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <Switch
                  id={option.key}
                  checked={settings[option.key]}
                  onCheckedChange={() => handleToggle(option.key)}
                  disabled={isLoading}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-4 border-t">
        <p className="text-xs text-muted-foreground">
          Note: Critical notifications about security and account changes will always be sent
          regardless of these settings.
        </p>
      </div>
    </div>
  );
}
