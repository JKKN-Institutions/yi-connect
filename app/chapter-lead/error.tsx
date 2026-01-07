'use client';

import { ErrorDisplay } from '@/components/error-display';

export default function ChapterLeadError({
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
      title='Chapter Lead Portal Error'
      description='Something went wrong in the chapter lead portal. Please try again.'
    />
  );
}
