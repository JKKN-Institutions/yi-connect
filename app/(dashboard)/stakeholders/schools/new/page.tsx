/**
 * New School Form Page
 *
 * Placeholder for school creation form - to be implemented with full form UI
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getCurrentChapterId } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Add New School',
  description: 'Add a new school to your stakeholder network',
}

async function NewSchoolFormWrapper() {
  const chapterId = await getCurrentChapterId()

  if (!chapterId) {
    redirect('/login')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New School</CardTitle>
        <CardDescription>Create a new school stakeholder record</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border-2 border-dashed p-12 text-center">
          <h3 className="text-lg font-semibold mb-2">School Form</h3>
          <p className="text-muted-foreground mb-4">
            The school creation form will be implemented in the next iteration.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            For now, schools can be created directly via the database or API using the
            createSchool server action.
          </p>
          <div className="text-xs text-left bg-muted p-4 rounded-lg">
            <p className="font-semibold mb-2">Form will include:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>School name and type (CBSE, State Board, etc.)</li>
              <li>Address and location details</li>
              <li>Student count and grade range</li>
              <li>Medium of instruction</li>
              <li>Facilities (auditorium, smart class, ground, library)</li>
              <li>Suitable Yi programs</li>
              <li>Connection type and decision maker info</li>
              <li>Notes and operational details</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function FormSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-8 w-[250px]" />
        <Skeleton className="h-4 w-[400px]" />
      </CardHeader>
      <CardContent className="space-y-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <Skeleton className="h-10 w-[120px]" />
      </CardContent>
    </Card>
  )
}

export default function NewSchoolPage() {
  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/stakeholders/schools">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Add New School</h1>
          <p className="text-muted-foreground">
            Add a new school to your stakeholder network
          </p>
        </div>
      </div>

      <Suspense fallback={<FormSkeleton />}>
        <NewSchoolFormWrapper />
      </Suspense>
    </div>
  )
}
