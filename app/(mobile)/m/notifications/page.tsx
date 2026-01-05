'use client'

/**
 * Mobile Notifications Page
 *
 * Displays all notifications with filtering and mark as read functionality.
 */

import { Suspense, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MobileHeader } from '@/components/mobile/mobile-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Bell,
  Calendar,
  Award,
  Users,
  FileText,
  CheckCircle2,
  Clock
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { markAllNotificationsAsRead } from '@/app/actions/communication'
import { toast } from 'react-hot-toast'

// Notification type icons
const notificationIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  event: Calendar,
  award: Award,
  member: Users,
  announcement: Bell,
  document: FileText,
  approval: CheckCircle2,
  reminder: Clock
}

// Sample notification data for offline PWA demo
// When online, notifications are fetched via getNotifications() from lib/data/communication.ts
const sampleNotifications = [
  {
    id: '1',
    type: 'event',
    title: 'Event Reminder',
    message: 'EC Committee Meeting starts in 1 hour at the Chapter Office. Don\'t forget the monthly report.',
    createdAt: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
    read: false,
    actionUrl: '/events/123'
  },
  {
    id: '2',
    type: 'announcement',
    title: 'CMP Submission Due',
    message: 'Your Chapter Management Plan for Q1 2025 is due in 3 days. Please complete all sections.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    read: false,
    actionUrl: '/communications/announcements/456'
  },
  {
    id: '3',
    type: 'award',
    title: 'Take Pride Award Nomination',
    message: 'You have been nominated for the Take Pride Award - Best Volunteer category. Review your nomination.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    read: true,
    actionUrl: '/awards/nominations'
  },
  {
    id: '4',
    type: 'member',
    title: 'New Member Joined',
    message: 'Priya Sharma has joined Yi Erode Chapter. Welcome them to the family!',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
    read: true,
    actionUrl: '/members/new'
  },
  {
    id: '5',
    type: 'approval',
    title: 'Event Approved',
    message: 'Your event "Industry Visit to Lakshmi Mills" has been approved by the Chapter Chair.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72), // 3 days ago
    read: true,
    actionUrl: '/events/456'
  }
]

// Notification card component
function NotificationCard({
  notification
}: {
  notification: {
    id: string
    type: string
    title: string
    message: string
    createdAt: Date
    read: boolean
    actionUrl?: string
  }
}) {
  const Icon = notificationIcons[notification.type] || Bell

  return (
    <Card className={`overflow-hidden ${!notification.read ? 'border-primary/20 bg-primary/5' : ''}`}>
      <CardContent className='p-4'>
        <div className='flex gap-3'>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            !notification.read ? 'bg-primary/20' : 'bg-muted'
          }`}>
            <Icon className={`h-5 w-5 ${!notification.read ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>

          <div className='flex-1 min-w-0'>
            <div className='flex items-start justify-between gap-2'>
              <h3 className={`text-sm font-medium ${!notification.read ? 'font-semibold' : ''}`}>
                {notification.title}
              </h3>
              {!notification.read && (
                <Badge variant='default' className='shrink-0 h-2 w-2 p-0 rounded-full' />
              )}
            </div>
            <p className='text-xs text-muted-foreground mt-1 line-clamp-2'>
              {notification.message}
            </p>
            <p className='text-[10px] text-muted-foreground mt-2'>
              {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Notifications list
function NotificationsList({ filter }: { filter: 'all' | 'unread' }) {
  const notifications = filter === 'unread'
    ? sampleNotifications.filter(n => !n.read)
    : sampleNotifications

  if (notifications.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-16 px-4 text-center'>
        <Bell className='h-12 w-12 text-muted-foreground/50 mb-4' />
        <h3 className='font-semibold text-lg mb-1'>
          {filter === 'unread' ? 'All caught up!' : 'No Notifications'}
        </h3>
        <p className='text-sm text-muted-foreground'>
          {filter === 'unread'
            ? "You've read all your notifications"
            : "You don't have any notifications yet"}
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-3 px-4'>
      {notifications.map((notification) => (
        <NotificationCard key={notification.id} notification={notification} />
      ))}
    </div>
  )
}

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

export default function MobileNotificationsPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const unreadCount = sampleNotifications.filter(n => !n.read).length

  const handleMarkAllAsRead = () => {
    startTransition(async () => {
      const result = await markAllNotificationsAsRead()
      if (result.success) {
        toast.success('All notifications marked as read')
        router.refresh()
      } else {
        toast.error(result.message || 'Failed to mark notifications as read')
      }
    })
  }

  return (
    <div className='min-h-screen bg-background'>
      <MobileHeader
        title='Notifications'
        showBack
        actions={[
          {
            label: isPending ? 'Marking...' : 'Mark all as read',
            onClick: handleMarkAllAsRead
          },
          {
            label: 'Notification settings',
            onClick: () => {
              router.push('/m/settings/notifications')
            }
          }
        ]}
      />

      <Tabs defaultValue='all' className='w-full'>
        <div className='sticky top-14 z-30 bg-background border-b px-4'>
          <TabsList className='w-full h-12 bg-transparent p-0 gap-0'>
            <TabsTrigger
              value='all'
              className='flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent'
            >
              All
            </TabsTrigger>
            <TabsTrigger
              value='unread'
              className='flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent'
            >
              Unread {unreadCount > 0 && `(${unreadCount})`}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value='all' className='mt-0 py-4'>
          <Suspense fallback={<NotificationsSkeleton />}>
            <NotificationsList filter='all' />
          </Suspense>
        </TabsContent>

        <TabsContent value='unread' className='mt-0 py-4'>
          <Suspense fallback={<NotificationsSkeleton />}>
            <NotificationsList filter='unread' />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
