/**
 * Login Page
 */

import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/login-form'
import { Skeleton } from '@/components/ui/skeleton'

// Loading fallback for LoginForm
function LoginFormSkeleton() {
  return (
    <div className='w-full space-y-6'>
      {/* Header skeleton */}
      <div className='text-center space-y-3'>
        <div className='flex justify-center mb-4'>
          <Skeleton className='h-16 w-16 rounded-2xl' />
        </div>
        <Skeleton className='h-9 w-64 mx-auto' />
        <Skeleton className='h-5 w-80 mx-auto' />
      </div>

      {/* Card skeleton */}
      <div className='border-2 rounded-lg p-6 space-y-4'>
        <Skeleton className='h-5 w-48 mx-auto' />
        <Skeleton className='h-12 w-full' />
        <Skeleton className='h-20 w-full' />
      </div>

      {/* Application card skeleton */}
      <div className='border-2 border-dashed rounded-lg p-6'>
        <Skeleton className='h-32 w-full' />
      </div>
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
