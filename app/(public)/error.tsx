'use client';

import { ErrorDisplay } from '@/components/error-display';

export default function PublicError({
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
      title='Something went wrong'
      description='We encountered an error loading this page. Please try again.'
    />
  );
}
