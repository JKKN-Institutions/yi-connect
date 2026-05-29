/**
 * Reset Password Page
 *
 * Landing page for the password-reset email link sent by the `forgotPassword`
 * server action (app/actions/auth.ts → redirectTo `${APP_URL}/reset-password`).
 *
 * Supabase sends a PKCE recovery link with `?code=...`. On mount we exchange
 * that code for a (recovery) session — the same mechanism used by the OAuth
 * callback route (app/auth/callback/route.ts) and the Yi-Future reset page.
 * The user then sets a new password via `supabase.auth.updateUser`.
 *
 * Matches the (auth) route-group visual style: shadcn Button/Input/Label/Alert,
 * client-side supabase via createBrowserSupabaseClient (same client the OAuth
 * buttons use). NOT the Yi-Future-branded reset page.
 */

'use client';

import { useEffect, useState, useTransition, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { resetPasswordSchema } from '@/lib/validations/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // The recovery code is knowable at render time, so derive the
  // "no code in URL" case here rather than setting state inside the effect
  // (which would trigger react-hooks/set-state-in-effect).
  const code = searchParams.get('code');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(
    code
      ? null
      : 'This reset link is missing its recovery code. Request a new one below.'
  );
  const [success, setSuccess] = useState(false);
  // Only "exchanging" when there's actually a code to exchange.
  const [exchanging, setExchanging] = useState(!!code);
  const [codeValid, setCodeValid] = useState(false);
  const [pending, startTransition] = useTransition();

  // Exchange the recovery code from the URL for a session on mount.
  // All setState calls live inside async callbacks, so this does not call
  // setState synchronously within the effect body.
  useEffect(() => {
    if (!code) return;

    const supabase = createBrowserSupabaseClient();
    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) {
          setCodeValid(false);
          setFormError(
            'This reset link is invalid or has expired. Request a new one below.'
          );
        } else {
          setCodeValid(true);
        }
        setExchanging(false);
      })
      .catch(() => {
        setCodeValid(false);
        setFormError(
          'Something went wrong verifying your reset link. Request a new one below.'
        );
        setExchanging(false);
      });
  }, [code]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const validation = resetPasswordSchema.safeParse({
      password,
      confirmPassword,
    });

    if (!validation.success) {
      const flattened = validation.error.flatten().fieldErrors;
      setFieldErrors({
        password: flattened.password?.[0],
        confirmPassword: flattened.confirmPassword?.[0],
      });
      return;
    }

    startTransition(async () => {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.updateUser({
        password: validation.data.password,
      });

      if (error) {
        setFormError(error.message);
        return;
      }

      setSuccess(true);
      // Brief pause so the success message is visible, then send to login.
      setTimeout(() => {
        router.push('/login?reset=success');
      }, 1500);
    });
  }

  // Verifying the recovery code.
  if (exchanging) {
    return (
      <div className='space-y-6 text-center'>
        <div className='space-y-2'>
          <h1 className='text-3xl font-bold'>Reset password</h1>
          <p className='text-muted-foreground'>Verifying your reset link…</p>
        </div>
        <div
          className='mx-auto h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary'
          role='status'
          aria-label='Verifying reset link'
        />
      </div>
    );
  }

  // Password successfully updated.
  if (success) {
    return (
      <div className='space-y-6 text-center'>
        <div className='space-y-2'>
          <h1 className='text-3xl font-bold'>Password updated</h1>
          <p className='text-muted-foreground'>
            Your password has been reset. Redirecting you to sign in…
          </p>
        </div>
        <Button asChild className='w-full'>
          <Link href='/login?reset=success'>Continue to sign in</Link>
        </Button>
      </div>
    );
  }

  // Invalid / expired / missing code — offer a path back to forgot-password.
  if (!codeValid) {
    return (
      <div className='space-y-6'>
        <div className='space-y-2 text-center'>
          <h1 className='text-3xl font-bold'>Reset link problem</h1>
          <p className='text-muted-foreground'>
            We couldn&apos;t verify your password reset link.
          </p>
        </div>

        {formError && (
          <Alert variant='destructive'>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <Button asChild className='w-full'>
          <Link href='/forgot-password'>Request a new reset link</Link>
        </Button>

        <div className='text-center'>
          <Link
            href='/login'
            className='inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary'
          >
            <ArrowLeft className='h-4 w-4' />
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  // Valid code — show the new-password form.
  return (
    <form method="post" action="#" onSubmit={handleSubmit} className='space-y-6'>
      <div className='space-y-2 text-center'>
        <h1 className='text-3xl font-bold'>Set a new password</h1>
        <p className='text-muted-foreground'>
          Choose a new password for your account
        </p>
      </div>

      {formError && (
        <Alert variant='destructive'>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div className='space-y-2'>
        <Label htmlFor='password'>New password</Label>
        <Input
          id='password'
          name='password'
          type='password'
          placeholder='••••••••'
          required
          autoComplete='new-password'
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!fieldErrors.password}
          aria-describedby={fieldErrors.password ? 'password-error' : undefined}
        />
        {fieldErrors.password && (
          <p id='password-error' className='text-sm text-destructive'>
            {fieldErrors.password}
          </p>
        )}
      </div>

      <div className='space-y-2'>
        <Label htmlFor='confirmPassword'>Confirm new password</Label>
        <Input
          id='confirmPassword'
          name='confirmPassword'
          type='password'
          placeholder='••••••••'
          required
          autoComplete='new-password'
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          aria-invalid={!!fieldErrors.confirmPassword}
          aria-describedby={
            fieldErrors.confirmPassword ? 'confirm-password-error' : undefined
          }
        />
        {fieldErrors.confirmPassword && (
          <p id='confirm-password-error' className='text-sm text-destructive'>
            {fieldErrors.confirmPassword}
          </p>
        )}
      </div>

      <Button type='submit' className='w-full' disabled={pending}>
        {pending ? 'Updating…' : 'Update password'}
      </Button>

      <div className='text-center'>
        <Link
          href='/login'
          className='inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary'
        >
          <ArrowLeft className='h-4 w-4' />
          Back to login
        </Link>
      </div>
    </form>
  );
}

export default function ResetPasswordPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense
      fallback={
        <div className='space-y-6 text-center'>
          <h1 className='text-3xl font-bold'>Reset password</h1>
          <p className='text-muted-foreground'>Loading…</p>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
