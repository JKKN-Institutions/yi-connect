import Link from 'next/link'
import { requireRole, getCurrentUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { CategoryForm } from './category-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'New Award Category | Yi Connect',
  description: 'Create a new award category',
}

export default async function NewAwardCategoryPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member'])

  const user = await getCurrentUser()
  const supabase = await createServerSupabaseClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('chapter_id')
    .eq('id', user!.id)
    .single()

  const chapterId = profile?.chapter_id ?? ''

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/awards/admin/categories">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">New Award Category</CardTitle>
          <CardDescription>
            Configure a new award type and scoring criteria for your chapter
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryForm chapterId={chapterId} />
        </CardContent>
      </Card>
    </div>
  )
}
