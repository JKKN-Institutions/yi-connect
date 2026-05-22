/**
 * Event Auto-Pilot Settings Page (Chair config)
 *
 * Chair+ only. Enables/disables the feature per chapter and configures
 * timing/behavior of the 6-step pipeline.
 */

import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import {
  isAutopilotEnabled,
  getAutopilotSettings,
} from '@/lib/data/autopilot';
import { AutopilotSettingsForm } from '@/components/autopilot/autopilot-settings-form';

export default async function EventAutopilotSettingsPage() {
  const { user } = await requireRole([
    'Super Admin',
    'National Admin',
    'Chair',
    'Co-Chair',
  ]);

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('chapter_id')
    .eq('id', user.id)
    .single();

  if (!profile?.chapter_id) {
    redirect('/dashboard');
  }

  const { data: chapter } = await supabase
    .from('chapters')
    .select('id, name')
    .eq('id', profile.chapter_id)
    .single();

  const [enabled, settings] = await Promise.all([
    isAutopilotEnabled(profile.chapter_id),
    getAutopilotSettings(profile.chapter_id),
  ]);

  return (
    <div className='max-w-3xl mx-auto py-8'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold'>Event Auto-Pilot</h1>
        <p className='text-muted-foreground mt-2'>
          Automates the after-event scramble for <strong>{chapter?.name}</strong>: sends
          feedback reminders, drafts your AAA health card, awards attendance points,
          and emails you a one-page summary.
        </p>
      </div>

      <AutopilotSettingsForm
        chapterId={profile.chapter_id}
        initialEnabled={enabled}
        initialSettings={settings}
      />

      <div className='mt-12 border-t pt-6'>
        <h2 className='font-semibold mb-2'>What happens when Auto-Pilot runs?</h2>
        <ol className='text-sm text-muted-foreground space-y-2 list-decimal pl-6'>
          <li>Feedback reminder sent to every attending member (email + WhatsApp if connected).</li>
          <li>Event stats computed (attendance, check-in rate, feedback avg).</li>
          <li>AAA health card draft created (if event has a vertical).</li>
          <li>Engagement points awarded to everyone who checked in.</li>
          <li>You receive a one-page summary email.</li>
          <li>Event is flagged for the next quarterly report to National.</li>
        </ol>
      </div>

      <div className='sr-only'>user={user.id}</div>
    </div>
  );
}
