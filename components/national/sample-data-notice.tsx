'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InfoIcon, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface SampleDataNoticeProps {
  module?: string;
  className?: string;
}

/**
 * Notice banner displayed on pages using sample/mock data
 * Shows when real National API integration is not yet configured
 */
export function SampleDataNotice({ module = 'this module', className }: SampleDataNoticeProps) {
  return (
    <Alert className={`border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 ${className || ''}`}>
      <InfoIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-800 dark:text-amber-200">
        Sample Data
      </AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-300">
        {module} is displaying sample data for demonstration purposes.
        Connect to the Yi National API in{' '}
        <Link
          href="/national/settings"
          className="font-medium underline underline-offset-4 hover:text-amber-900 dark:hover:text-amber-100"
        >
          Settings
        </Link>
        {' '}to see real data from your chapter.
      </AlertDescription>
    </Alert>
  );
}
