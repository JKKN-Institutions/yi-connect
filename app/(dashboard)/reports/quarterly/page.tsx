/**
 * Quarterly Report Generator Page
 *
 * Chair+ only. Generates the one-click Yi National submission PDF.
 */

import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ReportGenerator } from '@/components/reports/report-generator';

export default async function QuarterlyReportPage() {
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

  return (
    <div className='max-w-4xl mx-auto py-8'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold'>Quarterly Report to National</h1>
        <p className='text-muted-foreground mt-2'>
          Click once. Get a finished report. No more 4-hour scrambles to compile
          attendance, AAA status, and engagement numbers.
        </p>
      </div>

      <ReportGenerator
        chapterId={profile.chapter_id}
        chapterName={chapter?.name || 'Chapter'}
      />

      <div className='sr-only'>user={user.id}</div>
    </div>
  );
}
