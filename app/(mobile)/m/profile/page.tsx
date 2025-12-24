/**
 * Mobile Profile Page
 *
 * User profile with engagement stats, settings, and logout.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MobileHeader } from '@/components/mobile/mobile-header'
import { getUserProfile } from '@/lib/auth'
import { getCurrentUser } from '@/lib/data/auth'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  User,
  Settings,
  Bell,
  Shield,
  LogOut,
  ChevronRight,
  Award,
  Calendar,
  TrendingUp,
  HelpCircle
} from 'lucide-react'

// Profile header with avatar and name
async function ProfileHeader() {
  const profile = await getUserProfile()

  if (!profile) {
    redirect('/login')
  }

  const initials = profile.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase() || 'U'

  return (
    <div className='flex flex-col items-center py-6 px-4'>
      <Avatar className='h-20 w-20 mb-3'>
        <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name || ''} />
        <AvatarFallback className='text-xl'>{initials}</AvatarFallback>
      </Avatar>
      <h1 className='text-lg font-bold'>{profile.full_name}</h1>
      <p className='text-sm text-muted-foreground'>{profile.email}</p>
      {profile.role && (
        <span className='mt-2 px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full'>
          {profile.role}
        </span>
      )}
    </div>
  )
}

// Engagement stats section - fetches real data from database
async function EngagementSection() {
  const user = await getCurrentUser()

  if (!user) {
    return (
      <Card className='mx-4 mb-4'>
        <CardContent className='p-4'>
          <p className='text-sm text-muted-foreground text-center'>Login to view engagement stats</p>
        </CardContent>
      </Card>
    )
  }

  const supabase = await createServerSupabaseClient()

  // Get member engagement score
  const { data: member } = await supabase
    .from('members')
    .select('engagement_score, yi_activity_score')
    .eq('id', user.id)
    .single()

  // Count events attended (registrations with attended status)
  const { count: eventsAttended } = await supabase
    .from('event_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', user.id)
    .eq('status', 'attended')

  // Count awards received
  const { count: awardsCount } = await supabase
    .from('award_nominations')
    .select('id', { count: 'exact', head: true })
    .eq('nominee_id', user.id)
    .eq('status', 'approved')

  // Get total service hours from event attendance
  const { data: serviceEvents } = await supabase
    .from('event_registrations')
    .select('event:events(duration_hours)')
    .eq('member_id', user.id)
    .eq('status', 'attended')

  const totalServiceHours = serviceEvents?.reduce((acc, reg) => {
    const hours = (reg.event as any)?.duration_hours || 0
    return acc + hours
  }, 0) || 0

  const engagementScore = member?.engagement_score || 0

  return (
    <Card className='mx-4 mb-4'>
      <CardContent className='p-4'>
        <div className='flex items-center justify-between mb-3'>
          <h3 className='text-sm font-semibold'>Engagement Score</h3>
          <span className='text-2xl font-bold text-primary'>{engagementScore}%</span>
        </div>
        <Progress value={engagementScore} className='h-2 mb-3' />
        <div className='grid grid-cols-3 gap-4 text-center'>
          <div>
            <p className='text-lg font-bold'>{eventsAttended || 0}</p>
            <p className='text-xs text-muted-foreground'>Events</p>
          </div>
          <div>
            <p className='text-lg font-bold'>{totalServiceHours}h</p>
            <p className='text-xs text-muted-foreground'>Volunteered</p>
          </div>
          <div>
            <p className='text-lg font-bold'>{awardsCount || 0}</p>
            <p className='text-xs text-muted-foreground'>Awards</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Menu item component
function MenuItem({
  icon: Icon,
  label,
  href,
  onClick,
  variant = 'default'
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  href?: string
  onClick?: () => void
  variant?: 'default' | 'destructive'
}) {
  const content = (
    <div className='flex items-center justify-between p-4 active:bg-accent transition-colors'>
      <div className='flex items-center gap-3'>
        <Icon
          className={`h-5 w-5 ${
            variant === 'destructive' ? 'text-destructive' : 'text-muted-foreground'
          }`}
        />
        <span
          className={`text-sm font-medium ${
            variant === 'destructive' ? 'text-destructive' : ''
          }`}
        >
          {label}
        </span>
      </div>
      <ChevronRight className='h-4 w-4 text-muted-foreground' />
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return (
    <button type='button' onClick={onClick} className='w-full text-left'>
      {content}
    </button>
  )
}

// Profile menu sections
function ProfileMenu() {
  return (
    <div className='px-4 space-y-4'>
      {/* Account Section */}
      <Card>
        <CardContent className='p-0 divide-y'>
          <MenuItem icon={User} label='Edit Profile' href='/settings/profile' />
          <MenuItem icon={Bell} label='Notifications' href='/m/settings/notifications' />
          <MenuItem icon={Shield} label='Privacy & Security' href='/settings' />
        </CardContent>
      </Card>

      {/* Activity Section */}
      <Card>
        <CardContent className='p-0 divide-y'>
          <MenuItem icon={Calendar} label='My Events' href='/m/events' />
          <MenuItem icon={Award} label='My Awards' href='/awards/nominations' />
          <MenuItem icon={TrendingUp} label='Activity History' href='/members' />
        </CardContent>
      </Card>

      {/* Support Section */}
      <Card>
        <CardContent className='p-0 divide-y'>
          <MenuItem icon={HelpCircle} label='Help & Support' href='/help' />
          <MenuItem icon={Settings} label='App Settings' href='/settings' />
        </CardContent>
      </Card>

      {/* Logout */}
      <form action='/auth/signout' method='POST'>
        <Button
          type='submit'
          variant='outline'
          className='w-full text-destructive hover:text-destructive hover:bg-destructive/10'
        >
          <LogOut className='h-4 w-4 mr-2' />
          Sign Out
        </Button>
      </form>

      {/* App Version */}
      <p className='text-center text-xs text-muted-foreground py-4'>
        Yi Connect v1.0.0
      </p>
    </div>
  )
}

// Loading skeleton for profile header
function ProfileSkeleton() {
  return (
    <div className='flex flex-col items-center py-6 px-4'>
      <div className='h-20 w-20 rounded-full bg-muted animate-pulse mb-3' />
      <div className='h-5 w-32 bg-muted animate-pulse rounded mb-2' />
      <div className='h-4 w-48 bg-muted animate-pulse rounded' />
    </div>
  )
}

// Loading skeleton for engagement section
function EngagementSkeleton() {
  return (
    <Card className='mx-4 mb-4'>
      <CardContent className='p-4'>
        <div className='flex items-center justify-between mb-3'>
          <div className='h-4 w-28 bg-muted animate-pulse rounded' />
          <div className='h-8 w-14 bg-muted animate-pulse rounded' />
        </div>
        <div className='h-2 w-full bg-muted animate-pulse rounded mb-3' />
        <div className='grid grid-cols-3 gap-4 text-center'>
          {[1, 2, 3].map(i => (
            <div key={i}>
              <div className='h-6 w-10 bg-muted animate-pulse rounded mx-auto mb-1' />
              <div className='h-3 w-16 bg-muted animate-pulse rounded mx-auto' />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function MobileProfilePage() {
  return (
    <div className='min-h-screen bg-background'>
      <MobileHeader title='Profile' />

      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileHeader />
      </Suspense>

      <Suspense fallback={<EngagementSkeleton />}>
        <EngagementSection />
      </Suspense>

      <ProfileMenu />
    </div>
  )
}
