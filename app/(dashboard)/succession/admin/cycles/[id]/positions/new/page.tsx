import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SuccessionPositionForm } from '@/components/succession/forms/succession-position-form'
import { requireRole } from '@/lib/auth'

export default async function NewPositionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member'])

  const { id } = await params;
  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/succession/admin/cycles/${id}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Cycle
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add Leadership Position</h1>
        <p className="text-muted-foreground mt-2">
          Define a new leadership position for this succession cycle
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Position Details</CardTitle>
          <CardDescription>
            Specify the position details and eligibility criteria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SuccessionPositionForm cycleId={id} />
        </CardContent>
      </Card>
    </div>
  )
}
