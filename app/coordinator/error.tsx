'use client';

import { ErrorDisplay } from '@/components/error-display';

export default function CoordinatorError({
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
      title='Coordinator Portal Error'
      description='Something went wrong in the coordinator portal. Please try again.'
    />
  );
}
