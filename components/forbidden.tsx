/**
 * Forbidden Component
 *
 * Server component shown when an authenticated user lacks access to a specific
 * resource (e.g., trying to view another chapter's event, or trying to edit an
 * event they don't own and aren't admin for).
 *
 * Used INSTEAD of a silent `redirect()` so the user understands WHY they were
 * denied, not just bounced to /dashboard with no feedback (CLAUDE.md rule #27).
 *
 * Yi Connect brand: primary orange (#FF7800), secondary green (#00A859).
 */

import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { signOut } from '@/app/actions/auth'

interface ForbiddenProps {
  /** Plain-English explanation of why access was denied. */
  reason?: string
  /** Contact for help. Defaults to chapter administrator. */
  contactEmail?: string
}

export function Forbidden({
  reason = "You don't have access to this resource.",
  contactEmail,
}: ForbiddenProps) {
  return (
    <div className='min-h-[60vh] flex items-center justify-center p-4'>
      <Card className='max-w-md w-full border-destructive/20'>
        <CardContent className='pt-8 pb-6 text-center space-y-4'>
          <div className='mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center'>
            <ShieldAlert className='h-8 w-8 text-destructive' />
          </div>

          <div className='space-y-2'>
            <h1 className='text-2xl font-bold tracking-tight'>Access Denied</h1>
            <p className='text-sm text-muted-foreground'>{reason}</p>
            <p className='text-xs text-muted-foreground pt-2'>
              If you believe this is an error, please contact{' '}
              {contactEmail ? (
                <a
                  href={`mailto:${contactEmail}`}
                  className='text-primary hover:underline'
                >
                  {contactEmail}
                </a>
              ) : (
                'your chapter administrator'
              )}
              .
            </p>
          </div>

          <div className='flex flex-col sm:flex-row gap-2 pt-4'>
            <Button asChild variant='default' className='flex-1'>
              <Link href='/dashboard'>Back to Dashboard</Link>
            </Button>
            <form action={signOut} className='flex-1'>
              <Button
                type='submit'
                variant='outline'
                className='w-full'
              >
                Sign Out
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
