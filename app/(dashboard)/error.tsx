'use client';

import { ErrorDisplay } from '@/components/error-display';

export default function DashboardError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorDisplay
      error={error}
      reset={reset}
      title='Dashboard Error'
      description='Something went wrong loading this page. Please try again or return to the dashboard.'
    />
  );
}
