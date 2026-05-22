'use client';

import { ErrorDisplay } from '@/components/error-display';

export default function IndustryPortalError({
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
      title='Portal Error'
      description='Something went wrong in the industry portal. Please try again.'
    />
  );
}
