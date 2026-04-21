'use client';

import { useState, useTransition } from 'react';
import { Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateAutopilotFeature } from '@/app/actions/autopilot';
import type { AutopilotSettings } from '@/types/autopilot';

interface AutopilotSettingsFormProps {
  chapterId: string;
  initialEnabled: boolean;
  initialSettings: AutopilotSettings;
}

export function AutopilotSettingsForm({
  chapterId,
  initialEnabled,
  initialSettings,
}: AutopilotSettingsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [isEnabled, setIsEnabled] = useState(initialEnabled);
  const [settings, setSettings] = useState<AutopilotSettings>(initialSettings);

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateAutopilotFeature({
        chapter_id: chapterId,
        is_enabled: isEnabled,
        settings,
      });
      if (result.success) {
        toast.success('Settings saved');
      } else {
        toast.error(result.error || 'Failed to save');
      }
    });
  };

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle>Enable Event Auto-Pilot</CardTitle>
              <CardDescription>
                Turn the 6-step post-event pipeline on for your chapter.
              </CardDescription>
            </div>
            <Switch
              checked={isEnabled}
              onCheckedChange={setIsEnabled}
              disabled={isPending}
            />
          </div>
        </CardHeader>
      </Card>

      {isEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Configuration</CardTitle>
            <CardDescription>
              These settings apply to all events in your chapter.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-6'>
            <div className='grid gap-2'>
              <Label htmlFor='feedback_reminder_hours'>
                Feedback reminder delay (hours after event end)
              </Label>
              <Input
                id='feedback_reminder_hours'
                type='number'
                min={0}
                max={168}
                value={settings.feedback_reminder_hours}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    feedback_reminder_hours: Number(e.target.value),
                  }))
                }
              />
              <p className='text-xs text-muted-foreground'>
                Default: 24 hours. Range: 0-168 (up to 1 week).
              </p>
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='points_per_attendance'>Engagement points per event attended</Label>
              <Input
                id='points_per_attendance'
                type='number'
                min={0}
                max={100}
                value={settings.points_per_attendance}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    points_per_attendance: Number(e.target.value),
                  }))
                }
              />
              <p className='text-xs text-muted-foreground'>
                Default: 10. Used for the quarterly Take Pride nominee ranking.
              </p>
            </div>

            <div className='flex items-center justify-between py-2'>
              <div>
                <Label className='text-sm'>Auto-log AAA health card entry</Label>
                <p className='text-xs text-muted-foreground mt-0.5'>
                  Only applies to events with a vertical_id set.
                </p>
              </div>
              <Switch
                checked={settings.auto_log_health_card}
                onCheckedChange={(v) =>
                  setSettings((s) => ({ ...s, auto_log_health_card: v }))
                }
              />
            </div>

            <div className='flex items-center justify-between py-2'>
              <div>
                <Label className='text-sm'>Email Chair summary</Label>
                <p className='text-xs text-muted-foreground mt-0.5'>
                  One-page recap sent to Chair + Co-Chair after every event.
                </p>
              </div>
              <Switch
                checked={settings.email_chair_summary}
                onCheckedChange={(v) =>
                  setSettings((s) => ({ ...s, email_chair_summary: v }))
                }
              />
            </div>

            <div className='flex items-center justify-between py-2'>
              <div>
                <Label className='text-sm'>Send WhatsApp feedback reminder</Label>
                <p className='text-xs text-muted-foreground mt-0.5'>
                  Skipped if the chapter WhatsApp session is not connected.
                </p>
              </div>
              <Switch
                checked={settings.whatsapp_reminder}
                onCheckedChange={(v) =>
                  setSettings((s) => ({ ...s, whatsapp_reminder: v }))
                }
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className='flex justify-end'>
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className='h-4 w-4 mr-2 animate-spin' />
              Saving…
            </>
          ) : (
            <>
              <Save className='h-4 w-4 mr-2' />
              Save settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
