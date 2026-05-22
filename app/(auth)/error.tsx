'use client';

import { ErrorDisplay } from '@/components/error-display';

export default function AuthError({
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
      title='Authentication Error'
      description='Something went wrong during authentication. Please try again.'
    />
  );
}
