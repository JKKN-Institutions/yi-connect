/**
 * Login Form Component
 *
 * Client component for login form with server action.
 */

'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { login } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { OAuthButtons } from './oauth-buttons';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type='submit' className='w-full' disabled={pending}>
      {pending ? 'Signing in...' : 'Sign in'}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(login, {});

  return (
    <div className='space-y-6'>
      <div className='space-y-2 text-center'>
        <h1 className='text-3xl font-bold'>Welcome back</h1>
        <p className='text-muted-foreground'>
          Sign in to your Yi Connect account
        </p>
      </div>

      {/* Google OAuth */}
      <OAuthButtons />

      {/* Divider */}
      <div className='relative'>
        <div className='absolute inset-0 flex items-center'>
          <span className='w-full border-t' />
        </div>
        <div className='relative flex justify-center text-xs uppercase'>
          <span className='bg-background px-2 text-muted-foreground'>
            Or continue with email
          </span>
        </div>
      </div>

      {/* Email/Password Form */}
      <form action={formAction} className='space-y-6'>
        {state.message && (
          <Alert variant={state.success ? 'default' : 'destructive'}>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}

      <div className='space-y-4'>
        <div className='space-y-2'>
          <Label htmlFor='email'>Email</Label>
          <Input
            id='email'
            name='email'
            type='email'
            placeholder='you@example.com'
            required
            autoComplete='email'
            aria-invalid={!!state.errors?.email}
            aria-describedby={state.errors?.email ? 'email-error' : undefined}
          />
          {state.errors?.email && (
            <p id='email-error' className='text-sm text-destructive'>
              {state.errors.email[0]}
            </p>
          )}
        </div>

        <div className='space-y-2'>
          <div className='flex items-center justify-between'>
            <Label htmlFor='password'>Password</Label>
            <Link
              href='/forgot-password'
              className='text-sm text-primary hover:underline'
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id='password'
            name='password'
            type='password'
            required
            autoComplete='current-password'
            aria-invalid={!!state.errors?.password}
            aria-describedby={
              state.errors?.password ? 'password-error' : undefined
            }
          />
          {state.errors?.password && (
            <p id='password-error' className='text-sm text-destructive'>
              {state.errors.password[0]}
            </p>
          )}
        </div>
      </div>

      <SubmitButton />

        <div className='text-center text-sm'>
          <span className='text-muted-foreground'>
            Don&apos;t have an account?{' '}
          </span>
          <Link
            href='/signup'
            className='text-primary hover:underline font-medium'
          >
            Sign up
          </Link>
        </div>
      </form>
    </div>
  );
}
