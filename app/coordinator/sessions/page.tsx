/**
 * Session Types Page
 *
 * View available session types and their details.
 */

import { Suspense } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Clock, Users, BookOpen } from 'lucide-react'
import { getSessionTypes } from '@/lib/data/session-bookings'

export const metadata = {
  title: 'Session Types | Coordinator Portal',
  description: 'View available session types',
}

async function SessionTypesContent() {
  const sessionTypes = await getSessionTypes()

  const activeTypes = sessionTypes.filter((t) => t.is_active)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Available Sessions
        </h1>
        <p className="text-muted-foreground mt-1">
          Browse available training session types
        </p>
      </div>

      {/* Session Types Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {activeTypes.map((sessionType) => (
          <Card key={sessionType.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{sessionType.display_name}</CardTitle>
                {sessionType.vertical && (
                  <Badge variant="outline">{sessionType.vertical.name}</Badge>
                )}
              </div>
              <CardDescription>{sessionType.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>
                    {sessionType.typical_duration_minutes
                      ? `${sessionType.typical_duration_minutes} minutes`
                      : 'Duration varies'}
                  </span>
                </div>

                {sessionType.target_age_groups && sessionType.target_age_groups.length > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>
                      {sessionType.target_age_groups.join(', ')}
                    </span>
                  </div>
                )}

                {sessionType.requires_materials && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <BookOpen className="h-4 w-4" />
                    <span>Materials required</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {activeTypes.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
            <p className="mt-4 text-muted-foreground">
              No session types available
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SessionTypesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-64" />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-[200px]" />
        ))}
      </div>
    </div>
  )
}

export default function SessionTypesPage() {
  return (
    <Suspense fallback={<SessionTypesSkeleton />}>
      <SessionTypesContent />
    </Suspense>
  )
}
