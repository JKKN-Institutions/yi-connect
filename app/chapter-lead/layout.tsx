/**
 * Chapter Lead Portal Layout
 *
 * Layout for Yuva/Thalir sub-chapter lead portal.
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  GraduationCap,
  LayoutDashboard,
  Calendar,
  Users,
  Plus,
  Settings,
  LogOut,
  Menu,
} from 'lucide-react'
import { getSubChapterLeadById } from '@/lib/data/sub-chapters'
import { logoutChapterLead } from '@/app/actions/chapter-lead-auth'

const navigation = [
  { name: 'Dashboard', href: '/chapter-lead', icon: LayoutDashboard },
  { name: 'Events', href: '/chapter-lead/events', icon: Calendar },
  { name: 'Members', href: '/chapter-lead/members', icon: Users },
]

async function ChapterLeadHeader({
  leadId,
}: {
  leadId: string
}) {
  const lead = await getSubChapterLeadById(leadId)

  if (!lead) {
    redirect('/chapter-lead/login')
  }

  const initials = lead.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo & Nav */}
        <div className="flex items-center gap-6">
          <Link href="/chapter-lead" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold hidden sm:inline-block">
              Chapter Lead Portal
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button variant="ghost" size="sm" className="gap-2">
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Button>
              </Link>
            ))}
          </nav>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="gap-2 hidden sm:flex">
            <Link href="/chapter-lead/events/new">
              <Plus className="h-4 w-4" />
              New Event
            </Link>
          </Button>

          {/* Mobile Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {navigation.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href} className="flex items-center gap-2">
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/chapter-lead/events/new" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  New Event
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 px-2">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={lead.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline-block max-w-[100px] truncate">
                  {lead.full_name}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{lead.full_name}</p>
                <p className="text-xs text-muted-foreground">{lead.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/chapter-lead/settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <form action={logoutChapterLead}>
                <DropdownMenuItem asChild>
                  <button type="submit" className="w-full flex items-center gap-2 text-red-600">
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

export default async function ChapterLeadLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const leadId = cookieStore.get('chapter_lead_id')?.value

  // Allow login page without auth
  const pathname =
    typeof window !== 'undefined' ? window.location.pathname : ''

  if (!leadId) {
    // This will be handled by individual pages
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ChapterLeadHeader leadId={leadId} />
      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
