'use client';

import { useEffect } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import Link from 'next/link';

interface ErrorDisplayProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
}

export function ErrorDisplay({
  error,
  reset,
  title = 'Something went wrong',
  description = "We're sorry, but something unexpected happened. Please try again."
}: ErrorDisplayProps) {
  useEffect(() => {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by ErrorBoundary:', error);
    }
  }, [error]);

  return (
    <div className='flex min-h-[50vh] items-center justify-center p-4'>
      <Card className='w-full max-w-md'>
        <CardHeader className='text-center'>
          <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10'>
            <AlertTriangle className='h-8 w-8 text-destructive' />
          </div>
          <CardTitle className='text-xl'>{title}</CardTitle>
          <CardDescription className='mt-2'>{description}</CardDescription>
        </CardHeader>

        <CardContent>
          {process.env.NODE_ENV === 'development' && error.message && (
            <div className='rounded-md bg-muted p-3'>
              <p className='text-xs font-mono text-muted-foreground break-all'>
                {error.message}
              </p>
              {error.digest && (
                <p className='mt-1 text-xs text-muted-foreground'>
                  Error ID: {error.digest}
                </p>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className='flex flex-col gap-2 sm:flex-row sm:justify-center'>
          <Button onClick={reset} variant='default' className='w-full sm:w-auto'>
            <RefreshCw className='mr-2 h-4 w-4' />
            Try Again
          </Button>
          <Button asChild variant='outline' className='w-full sm:w-auto'>
            <Link href='/'>
              <Home className='mr-2 h-4 w-4' />
              Go Home
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// Simplified version for not-found pages
interface NotFoundDisplayProps {
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}

export function NotFoundDisplay({
  title = 'Page Not Found',
  description = "The page you're looking for doesn't exist or has been moved.",
  backHref = '/',
  backLabel = 'Go Home'
}: NotFoundDisplayProps) {
  return (
    <div className='flex min-h-[50vh] items-center justify-center p-4'>
      <Card className='w-full max-w-md'>
        <CardHeader className='text-center'>
          <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted'>
            <span className='text-3xl font-bold text-muted-foreground'>404</span>
          </div>
          <CardTitle className='text-xl'>{title}</CardTitle>
          <CardDescription className='mt-2'>{description}</CardDescription>
        </CardHeader>

        <CardFooter className='flex justify-center'>
          <Button asChild variant='default'>
            <Link href={backHref}>
              <Home className='mr-2 h-4 w-4' />
              {backLabel}
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
