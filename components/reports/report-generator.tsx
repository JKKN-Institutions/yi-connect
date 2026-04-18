'use client';

import { useState, useTransition } from 'react';
import { FileText, Download, Loader2, Send, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  generateQuarterlyReport,
  sendReportToNational,
} from '@/app/actions/reports';
import { getLastCompletedQuarter } from '@/types/report';

interface ReportGeneratorProps {
  chapterId: string;
  chapterName: string;
}

export function ReportGenerator({ chapterId, chapterName }: ReportGeneratorProps) {
  const defaults = getLastCompletedQuarter();
  const [fiscalYear, setFiscalYear] = useState<number>(defaults.fiscalYear);
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(defaults.quarter);
  const [isGenerating, startGenerate] = useTransition();
  const [isSending, startSend] = useTransition();
  const [result, setResult] = useState<{ report_id: string; pdf_url: string | null } | null>(
    null
  );
  const [nationalEmail, setNationalEmail] = useState('national@youngindians.net');
  const [sent, setSent] = useState(false);

  const handleGenerate = () => {
    setResult(null);
    setSent(false);
    startGenerate(async () => {
      const r = await generateQuarterlyReport({
        chapter_id: chapterId,
        fiscal_year: fiscalYear,
        quarter,
      });
      if (!r.success) {
        toast.error(r.error || 'Generate failed');
        return;
      }
      setResult(r.data);
      toast.success('Report generated');
    });
  };

  const handleSend = () => {
    if (!result) return;
    if (!nationalEmail) {
      toast.error('Enter a recipient email');
      return;
    }
    startSend(async () => {
      const r = await sendReportToNational({
        report_id: result.report_id,
        recipient_emails: [nationalEmail],
      });
      if (!r.success) {
        toast.error(r.error || 'Send failed');
        return;
      }
      setSent(true);
      toast.success('Report sent to National');
    });
  };

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>Generate Quarterly Report</CardTitle>
          <CardDescription>
            Produces a one-click Yi National submission for {chapterName}, covering events,
            AAA verticals, top members, finance, and Take Pride nominees.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-4 md:grid-cols-2'>
            <div>
              <Label>Fiscal Year</Label>
              <Input
                type='number'
                min={2020}
                max={2100}
                value={fiscalYear}
                onChange={(e) => setFiscalYear(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Quarter</Label>
              <Select
                value={String(quarter)}
                onValueChange={(v) => setQuarter(Number(v) as 1 | 2 | 3 | 4)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='1'>Q1 (Jan-Mar)</SelectItem>
                  <SelectItem value='2'>Q2 (Apr-Jun)</SelectItem>
                  <SelectItem value='3'>Q3 (Jul-Sep)</SelectItem>
                  <SelectItem value='4'>Q4 (Oct-Dec)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className='w-full md:w-auto'
          >
            {isGenerating ? (
              <>
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                Generating…
              </>
            ) : (
              <>
                <FileText className='h-4 w-4 mr-2' />
                Generate Report
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base flex items-center gap-2'>
              <Check className='h-5 w-5 text-green-600' />
              Report ready
            </CardTitle>
            <CardDescription>
              Download the printable HTML, or email it directly to Yi National.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='flex items-center gap-2'>
              {result.pdf_url ? (
                <>
                  <Button variant='outline' asChild>
                    <a href={result.pdf_url} target='_blank' rel='noopener noreferrer'>
                      <Download className='h-4 w-4 mr-2' />
                      Download / Print
                    </a>
                  </Button>
                  <span className='text-xs text-muted-foreground'>
                    Opens in a new tab — use browser&apos;s print dialog to save as PDF.
                  </span>
                </>
              ) : (
                <span className='text-sm text-muted-foreground'>
                  Report saved but no download URL (storage not configured).
                </span>
              )}
            </div>

            <div className='grid gap-3 md:grid-cols-[1fr_auto] md:items-end'>
              <div>
                <Label>Send to (Yi National email)</Label>
                <Input
                  type='email'
                  value={nationalEmail}
                  onChange={(e) => setNationalEmail(e.target.value)}
                  disabled={sent}
                />
              </div>
              <Button onClick={handleSend} disabled={isSending || sent || !result.pdf_url}>
                {isSending ? (
                  <>
                    <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                    Sending…
                  </>
                ) : sent ? (
                  <>
                    <Check className='h-4 w-4 mr-2' />
                    Sent
                  </>
                ) : (
                  <>
                    <Send className='h-4 w-4 mr-2' />
                    Email to National
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
