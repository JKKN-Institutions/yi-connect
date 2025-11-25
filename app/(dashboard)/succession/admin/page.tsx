import { Suspense } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { requireRole } from '@/lib/auth'
import { getCurrentActiveCycle, getSuccessionCycles } from '@/lib/data/succession'
import {
  CalendarDays,
  Users,
  FileText,
  UserCheck,
  Clock,
  Settings,
  HandshakeIcon,
  Vote,
  Shield,
  BookOpen,
} from 'lucide-react'

export const metadata = {
  title: 'Succession Admin | Yi Connect',
  description: 'Manage succession cycles, applications, and leadership selection',
}

const adminModules = [
  {
    title: 'Cycles',
    description: 'Create and manage succession cycles',
    href: '/succession/admin/cycles',
    icon: CalendarDays,
    color: 'bg-blue-100 text-blue-600',
  },
  {
    title: 'Nominations',
    description: 'Review and manage nominations',
    href: '/succession/admin/nominations',
    icon: Users,
    color: 'bg-green-100 text-green-600',
  },
  {
    title: 'Applications',
    description: 'Review leadership applications',
    href: '/succession/admin/applications',
    icon: FileText,
    color: 'bg-purple-100 text-purple-600',
  },
  {
    title: 'Evaluators',
    description: 'Assign and manage evaluators',
    href: '/succession/admin/evaluators',
    icon: UserCheck,
    color: 'bg-orange-100 text-orange-600',
  },
  {
    title: 'Timeline',
    description: 'Manage 7-week succession timeline',
    href: '/succession/admin/timeline',
    icon: Clock,
    color: 'bg-cyan-100 text-cyan-600',
  },
  {
    title: 'Approaches',
    description: 'Track candidate approaches',
    href: '/succession/admin/approaches',
    icon: HandshakeIcon,
    color: 'bg-pink-100 text-pink-600',
  },
  {
    title: 'Meetings',
    description: 'Schedule steering committee meetings',
    href: '/succession/admin/meetings',
    icon: Vote,
    color: 'bg-yellow-100 text-yellow-600',
  },
  {
    title: 'RC Review',
    description: 'Regional Chair candidate review portal',
    href: '/succession/admin/rc-review',
    icon: Shield,
    color: 'bg-red-100 text-red-600',
  },
]

async function AdminContent() {
  const [activeCycle, allCycles] = await Promise.all([
    getCurrentActiveCycle(),
    getSuccessionCycles(),
  ])

  const recentCycles = allCycles.slice(0, 3)

  return (
    <div className="space-y-6">
      {/* Active Cycle Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Active Succession Cycle
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeCycle ? (
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">{activeCycle.cycle_name}</h3>
                <p className="text-sm text-muted-foreground">Year: {activeCycle.year}</p>
                <Badge variant="outline" className="capitalize">
                  {activeCycle.status.replace(/_/g, ' ')}
                </Badge>
              </div>
              <Button asChild>
                <Link href={`/succession/admin/cycles/${activeCycle.id}`}>
                  Manage Cycle
                </Link>
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground">No active succession cycle</p>
              <Button asChild>
                <Link href="/succession/admin/cycles/new">Create New Cycle</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Modules Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {adminModules.map((module) => (
          <Link key={module.href} href={module.href}>
            <Card className="h-full transition-all hover:shadow-md hover:border-primary/50 cursor-pointer">
              <CardHeader className="pb-2">
                <div className={`w-10 h-10 rounded-lg ${module.color} flex items-center justify-center mb-2`}>
                  <module.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">{module.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{module.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Cycles */}
      {recentCycles.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Cycles</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href="/succession/admin/cycles">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentCycles.map((cycle) => (
                <div
                  key={cycle.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <p className="font-medium">{cycle.cycle_name}</p>
                    <p className="text-sm text-muted-foreground">Year: {cycle.year}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {cycle.status.replace(/_/g, ' ')}
                    </Badge>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/succession/admin/cycles/${cycle.id}`}>View</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Quick Links
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2">
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/succession/knowledge-base">
                <BookOpen className="h-4 w-4 mr-2" />
                Knowledge Base
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/succession/admin/cycles/new">
                <CalendarDays className="h-4 w-4 mr-2" />
                New Succession Cycle
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function AdminLoading() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-4 w-24 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default async function SuccessionAdminPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member'])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Succession Administration</h1>
        <p className="text-muted-foreground mt-2">
          Manage leadership succession cycles, nominations, and selection process
        </p>
      </div>

      <Suspense fallback={<AdminLoading />}>
        <AdminContent />
      </Suspense>
    </div>
  )
}
