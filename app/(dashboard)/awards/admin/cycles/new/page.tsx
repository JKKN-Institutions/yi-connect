import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { getAwardCategories } from '@/lib/data/awards'
import { CycleForm } from './cycle-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'New Award Cycle | Yi Connect',
  description: 'Create a new award cycle',
}

export default async function NewAwardCyclePage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member'])

  const { data: categories } = await getAwardCategories()

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/awards/admin/cycles">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">New Award Cycle</CardTitle>
          <CardDescription>Open a new cycle for an existing award category</CardDescription>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <p className="text-muted-foreground">
                You need at least one award category before creating a cycle.
              </p>
              <Button asChild>
                <Link href="/awards/admin/categories/new">Create Category First</Link>
              </Button>
            </div>
          ) : (
            <CycleForm categories={categories} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
