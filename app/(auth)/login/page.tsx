/**
 * Login Page
 */

import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/login-form'
import { Skeleton } from '@/components/ui/skeleton'

// Loading fallback for LoginForm
function LoginFormSkeleton() {
  return (
    <div className='space-y-6'>
      <div className='space-y-2 text-center'>
        <Skeleton className='h-9 w-64 mx-auto' />
        <Skeleton className='h-5 w-96 mx-auto' />
      </div>
      <Skeleton className='h-12 w-full' />
      <Skeleton className='h-20 w-full' />
      <Skeleton className='h-10 w-full' />
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormSkeleton />}>
      <LoginForm />
    </Suspense>
  )
}
