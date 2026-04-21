'use client'

/**
 * Mobile Notifications Client Component
 *
 * Handles interactive notification list with tabs, mark-as-read, and navigation.
 * Receives data from the server component page.
 */

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MobileHeader } from '@/components/mobile/mobile-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Bell,
  Calendar,
  Award,
  Users,
  FileText,
  CheckCircle2,
  Clock,
  DollarSign,
  MessageSquare,
  Settings
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { markAsRead, markAllAsRead } from '@/app/actions/notifications'
import { toast } from 'react-hot-toast'
import type { Notification } from '@/types/notifications'

// Notification type icons
const notificationIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  event: Calendar,
  member: Users,
  finance: DollarSign,
  communication: MessageSquare,
  system: Settings,
  general: Bell,
  // Legacy type mappings for backwards compatibility
  award: Award,
  announcement: Bell,
  document: FileText,
  approval: CheckCircle2,
  reminder: Clock
}

// Notification card component
function NotificationCard({
  notification,
  onMarkRead
}: {
  notification: Notification
  onMarkRead: (id: string) => void
}) {
  const router = useRouter()
  const Icon = notificationIcons[notification.type] || notificationIcons[notification.category || ''] || Bell

  const handleClick = () => {
    if (!notification.read) {
      onMarkRead(notification.id)
    }
    if (notification.action_url) {
      router.push(notification.action_url)
    }
  }

  return (
    <Card
      className={`overflow-hidden cursor-pointer ${!notification.read ? 'border-primary/20 bg-primary/5' : ''}`}
      onClick={handleClick}
    >
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
              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Empty state
function EmptyState({ filter }: { filter: 'all' | 'unread' }) {
  return (
    <div className='flex flex-col items-center justify-center py-16 px-4 text-center'>
      <Bell className='h-12 w-12 text-muted-foreground/50 mb-4' />
      <h3 className='font-semibold text-lg mb-1'>
        {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
      </h3>
      <p className='text-sm text-muted-foreground'>
        {filter === 'unread'
          ? "You've read all your notifications"
          : "You don't have any notifications yet"}
      </p>
    </div>
  )
}

// Notifications list
function NotificationsList({
  notifications,
  filter,
  onMarkRead
}: {
  notifications: Notification[]
  filter: 'all' | 'unread'
  onMarkRead: (id: string) => void
}) {
  const filtered = filter === 'unread'
    ? notifications.filter(n => !n.read)
    : notifications

  if (filtered.length === 0) {
    return <EmptyState filter={filter} />
  }

  return (
    <div className='space-y-3 px-4'>
      {filtered.map((notification) => (
        <NotificationCard
          key={notification.id}
          notification={notification}
          onMarkRead={onMarkRead}
        />
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

// Main client component
export function NotificationsClient({
  notifications,
  unreadCount
}: {
  notifications: Notification[]
  unreadCount: number
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleMarkAllAsRead = () => {
    startTransition(async () => {
      const result = await markAllAsRead()
      if (result.success) {
        toast.success('All notifications marked as read')
        router.refresh()
      } else {
        toast.error(result.message || 'Failed to mark notifications as read')
      }
    })
  }

  const handleMarkRead = (id: string) => {
    startTransition(async () => {
      await markAsRead(id)
      router.refresh()
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
          <NotificationsList
            notifications={notifications}
            filter='all'
            onMarkRead={handleMarkRead}
          />
        </TabsContent>

        <TabsContent value='unread' className='mt-0 py-4'>
          <NotificationsList
            notifications={notifications}
            filter='unread'
            onMarkRead={handleMarkRead}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
