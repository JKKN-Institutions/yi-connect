/**
 * Login Form Component
 *
 * Google OAuth only - No email/password login
 */

'use client';

import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { OAuthButtons } from './oauth-buttons';
import { useSearchParams } from 'next/navigation';
import { Info } from 'lucide-react';

export function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <div className='space-y-6'>
      <div className='space-y-2 text-center'>
        <h1 className='text-3xl font-bold'>Welcome to Yi Connect</h1>
        <p className='text-muted-foreground'>
          Sign in with your Google account to access your member dashboard
        </p>
      </div>

      {/* Error Message */}
      {error === 'auth_failed' && (
        <Alert variant='destructive'>
          <AlertDescription>
            Authentication failed. Please try again.
          </AlertDescription>
        </Alert>
      )}

      {error === 'unauthorized' && (
        <Alert variant='destructive'>
          <AlertDescription>
            Your email is not authorized to access this system. Please apply for membership first.
          </AlertDescription>
        </Alert>
      )}

      {/* Google OAuth Button */}
      <OAuthButtons />

      {/* Info Box */}
      <Alert>
        <Info className='h-4 w-4' />
        <AlertDescription className='ml-2'>
          <strong>Note:</strong> Only approved members can login.
          You must use the same Google email you applied with.
        </AlertDescription>
      </Alert>

      {/* Divider */}
      <div className='relative'>
        <div className='absolute inset-0 flex items-center'>
          <span className='w-full border-t' />
        </div>
      </div>

      {/* Apply Link */}
      <div className='text-center space-y-2'>
        <p className='text-sm text-muted-foreground'>
          Not a member yet?
        </p>
        <Link
          href='/apply'
          className='text-primary hover:underline font-medium inline-flex items-center gap-1'
        >
          Apply for Yi Membership →
        </Link>
      </div>
    </div>
  );
}
