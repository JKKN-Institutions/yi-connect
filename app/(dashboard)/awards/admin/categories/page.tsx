import { Suspense } from 'react'
import Link from 'next/link'
import { getAwardCategories } from '@/lib/data/awards'
import type { AwardCategory } from '@/types/award'
import { CategoryCard } from '@/components/awards'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Award } from 'lucide-react'

async function CategoriesSection() {
  const { data: categories } = await getAwardCategories()

  if (categories.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Award className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">
            No award categories
          </p>
          <p className="text-sm text-muted-foreground mt-2 mb-4">
            Create your first award category to get started
          </p>
          <Button asChild>
            <Link href="/awards/admin/categories/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Category
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {categories.map((category: AwardCategory) => (
        <CategoryCard
          key={category.id}
          category={category}
          activeCycleCount={category._count?.cycles}
          totalNominations={category._count?.nominations}
        />
      ))}
    </div>
  )
}

export default function CategoriesManagementPage() {
  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Manage Award Categories</h1>
          <p className="text-muted-foreground mt-2">
            Configure award types and scoring criteria for your chapter
          </p>
        </div>
        <Button asChild>
          <Link href="/awards/admin/categories/new">
            <Plus className="mr-2 h-4 w-4" />
            New Category
          </Link>
        </Button>
      </div>

      {/* Categories Grid */}
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
