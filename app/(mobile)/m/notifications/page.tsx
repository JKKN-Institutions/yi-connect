/**
 * Mobile Notifications Page
 *
 * Server component that fetches notifications from the database
 * and renders the client-side interactive notification list.
 */

import { Suspense } from 'react'
import { getNotifications, getUnreadCount } from '@/lib/data/notifications'
import { Card, CardContent } from '@/components/ui/card'
import { NotificationsClient } from './notifications-client'

// Loading skeleton
function NotificationsSkeleton() {
  return (
    <div className='space-y-3 px-4'>
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className='p-4'>
            <div className='flex gap-3'>
              <div className='h-10 w-10 rounded-full bg-muted animate-pulse' />
              <div className='flex-1'>
                <div className='h-4 w-1/2 bg-muted animate-pulse rounded mb-2' />
                <div className='h-3 w-3/4 bg-muted animate-pulse rounded mb-2' />
                <div className='h-2 w-20 bg-muted animate-pulse rounded' />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Async component that fetches data then renders the client UI
async function NotificationsContent() {
  const [allNotifications, unreadCount] = await Promise.all([
    getNotifications(),
    getUnreadCount(),
  ])

  return (
    <NotificationsClient
      notifications={allNotifications}
      unreadCount={unreadCount}
    />
  )
}

export default function MobileNotificationsPage() {
  return (
    <Suspense fallback={<NotificationsSkeleton />}>
      <NotificationsContent />
    </Suspense>
  )
}
