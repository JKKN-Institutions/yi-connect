/**
 * Unauthorized Page
 *
 * Shown when user doesn't have required permissions.
 */

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className='min-h-screen flex items-center justify-center p-4'>
      <div className='text-center space-y-4 max-w-md'>
        <ShieldAlert className='h-16 w-16 text-destructive mx-auto' />
        <h1 className='text-3xl font-bold'>Access Denied</h1>
        <p className='text-muted-foreground'>
          You don&apos;t have permission to access this page. Please contact
          your chapter administrator if you believe this is an error.
        </p>
        <Button asChild>
          <Link href='/dashboard'>Return to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
