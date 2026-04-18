/**
 * Report History Page
 *
 * Chair+ and National Admin — list all past chapter reports.
 */

import Link from 'next/link';
import { format } from 'date-fns';
import { Download, ExternalLink, Check } from 'lucide-react';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { listChapterReports } from '@/lib/data/reports-quarterly';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default async function ReportsHistoryPage() {
  const { user, roles } = await requireRole([
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

  // National Admin sees all; Chair sees their own
  const isNational =
    Array.isArray(roles) &&
    (roles.includes('National Admin') || roles.includes('Super Admin'));

  let reports: Awaited<ReturnType<typeof listChapterReports>> = [];
  if (isNational) {
    const { data } = await supabase
      .from('chapter_reports')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(50);
    reports = (data ?? []) as typeof reports;
  } else if (profile?.chapter_id) {
    reports = await listChapterReports(profile.chapter_id);
  }

  return (
    <div className='max-w-5xl mx-auto py-8'>
      <div className='flex items-center justify-between mb-8'>
        <div>
          <h1 className='text-3xl font-bold'>Report History</h1>
          <p className='text-muted-foreground mt-2'>
            All previously generated chapter reports.
          </p>
        </div>
        <Button asChild>
          <Link href='/reports/quarterly'>Generate new</Link>
        </Button>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className='py-16 text-center'>
            <p className='text-muted-foreground'>No reports generated yet.</p>
            <Button asChild className='mt-4'>
              <Link href='/reports/quarterly'>Generate your first report</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className='space-y-3'>
          {reports.map((r) => {
            const snap = r.data_snapshot as
              | { period: { label: string }; events: { total_count: number } }
              | null;
            return (
              <Card key={r.id}>
                <CardHeader className='pb-2'>
                  <div className='flex items-center justify-between'>
                    <CardTitle className='text-base'>
                      {snap?.period?.label ||
                        `${r.report_type} ${r.period_start} — ${r.period_end}`}
                    </CardTitle>
                    <div className='flex items-center gap-2'>
                      <Badge variant='outline' className='capitalize'>
                        {r.report_type}
                      </Badge>
                      {r.sent_to_national && (
                        <Badge variant='default' className='gap-1'>
                          <Check className='h-3 w-3' />
                          Sent
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className='flex items-center justify-between text-sm'>
                    <div className='text-muted-foreground'>
                      {snap?.events?.total_count ?? 0} event
                      {(snap?.events?.total_count ?? 0) !== 1 ? 's' : ''} · generated{' '}
                      {format(new Date(r.generated_at), 'MMM d, yyyy HH:mm')}
                    </div>
                    {r.pdf_url && (
                      <Button variant='outline' size='sm' asChild>
                        <a href={r.pdf_url} target='_blank' rel='noopener noreferrer'>
                          <Download className='h-3.5 w-3.5 mr-2' />
                          Open
                          <ExternalLink className='h-3 w-3 ml-1.5 opacity-60' />
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
