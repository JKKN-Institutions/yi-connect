'use client';

import { ErrorDisplay } from '@/components/error-display';

export default function MobileError({
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
      title='Oops!'
      description='Something went wrong. Tap below to try again.'
    />
  );
}
