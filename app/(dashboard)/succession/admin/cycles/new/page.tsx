import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SuccessionCycleForm } from '@/components/succession/forms/succession-cycle-form'
import { requireRole } from '@/lib/auth'

export const metadata = {
  title: 'New Succession Cycle | Admin',
  description: 'Create a new succession cycle',
}

export default async function NewSuccessionCyclePage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member'])
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Succession Cycle</h1>
        <p className="text-muted-foreground mt-2">
          Set up a new leadership succession cycle with positions and timelines
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cycle Information</CardTitle>
          <CardDescription>
            Provide basic information about the succession cycle
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SuccessionCycleForm />
        </CardContent>
      </Card>
    </div>
  )
}
