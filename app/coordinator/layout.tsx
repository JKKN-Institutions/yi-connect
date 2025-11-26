/**
 * Coordinator Portal Layout
 *
 * Separate layout for stakeholder coordinators with their own auth.
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Calendar,
  LayoutDashboard,
  LogOut,
  BookOpen,
  User,
} from 'lucide-react'
import { cookies } from 'next/headers'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Coordinator Portal | Yi Connect',
  description: 'Stakeholder coordinator session booking portal',
}

async function getCoordinatorSession() {
  const cookieStore = await cookies()
  const coordinatorId = cookieStore.get('coordinator_id')?.value
  const coordinatorEmail = cookieStore.get('coordinator_email')?.value

  if (!coordinatorId || !coordinatorEmail) {
    return null
  }

  return {
    id: coordinatorId,
    email: coordinatorEmail,
  }
}

export default async function CoordinatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getCoordinatorSession()

  if (!session) {
    redirect('/coordinator/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/coordinator" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-teal-600">
                <span className="text-lg font-bold text-white">Yi</span>
              </div>
              <span className="text-lg font-semibold text-gray-900">
                Coordinator Portal
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              <Link href="/coordinator">
                <Button variant="ghost" size="sm" className="gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/coordinator/bookings">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  Bookings
                </Button>
              </Link>
              <Link href="/coordinator/sessions">
                <Button variant="ghost" size="sm" className="gap-2">
                  <BookOpen className="h-4 w-4" />
                  Session Types
                </Button>
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{session.email}</span>
            </div>
            <form action="/coordinator/logout" method="POST">
              <Button variant="ghost" size="sm" className="gap-2 text-gray-600">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
