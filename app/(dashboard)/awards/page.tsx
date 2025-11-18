import { Suspense } from 'react'
import Link from 'next/link'
import { getActiveCycles, getAwardCategories } from '@/lib/data/awards'
import { CycleCard, CategoryCard } from '@/components/awards'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy, Users, FileText, Award, Plus } from 'lucide-react'

async function ActiveCyclesSection() {
  const cycles = await getActiveCycles()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Active Award Cycles</h2>
        <Button asChild variant="outline">
          <Link href="/awards/admin/cycles">
            Manage Cycles
          </Link>
        </Button>
      </div>

      {cycles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              No active award cycles
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Check back later or contact your chapter admin
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cycles.map((cycle) => (
            <CycleCard key={cycle.id} cycle={cycle} />
          ))}
        </div>
      )}
    </div>
  )
}

async function CategoriesSection() {
  const { data: categories } = await getAwardCategories({ is_active: true })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Award Categories</h2>
        <Button asChild variant="outline">
          <Link href="/awards/admin/categories">
            Manage Categories
          </Link>
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Award className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              No award categories configured
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Contact your chapter admin to set up award categories
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              activeCycleCount={category._count?.cycles}
              totalNominations={category._count?.nominations}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function QuickActions() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <Link href="/awards/nominate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Nominate Someone
            </CardTitle>
            <Plus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Submit a new nomination for an active award cycle
            </p>
          </CardContent>
        </Link>
      </Card>

      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <Link href="/awards/nominations">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              My Nominations
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              View and manage your submitted nominations
            </p>
          </CardContent>
        </Link>
      </Card>

      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <Link href="/awards/jury">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Jury Dashboard
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Evaluate nominations as a jury member
            </p>
          </CardContent>
        </Link>
      </Card>

      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <Link href="/awards/leaderboard">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Leaderboard
            </CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              View all-time award winners and rankings
            </p>
          </CardContent>
        </Link>
      </Card>
    </div>
  )
}

export default function AwardsPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Take Pride Awards</h1>
          <p className="text-muted-foreground mt-2">
            Recognize and celebrate outstanding contributions to our chapter
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Active Cycles */}
      <Suspense
        fallback={
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-[300px]" />
            <Skeleton className="h-[300px]" />
            <Skeleton className="h-[300px]" />
          </div>
        }
      >
        <ActiveCyclesSection />
      </Suspense>

      {/* Categories */}
      <Suspense
        fallback={
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-[400px]" />
            <Skeleton className="h-[400px]" />
            <Skeleton className="h-[400px]" />
          </div>
        }
      >
        <CategoriesSection />
      </Suspense>
    </div>
  )
}
