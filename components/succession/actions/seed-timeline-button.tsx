'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { PlayCircle, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { seedTimelineSteps } from '@/app/actions/succession'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface SeedTimelineButtonProps {
  cycleId: string
  cycleStartDate: string
}

export function SeedTimelineButton({ cycleId, cycleStartDate }: SeedTimelineButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSeedTimeline = async () => {
    setLoading(true)

    try {
      const result = await seedTimelineSteps(cycleId, new Date(cycleStartDate))

      if (result.success) {
        toast.success(
          `Successfully created ${result.data?.count || 0} timeline steps`,
          {
            icon: '✅',
            duration: 4000,
          }
        )
        setOpen(false)
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to seed timeline steps', {
          icon: '❌',
          duration: 5000,
        })
      }
    } catch (error) {
      console.error('Error seeding timeline:', error)
      toast.error('An unexpected error occurred', {
        icon: '❌',
        duration: 5000,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlayCircle className="mr-2 h-4 w-4" />
          Seed Timeline Steps
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Seed Timeline Steps</DialogTitle>
          <DialogDescription>
            This will create the standard 7-week succession workflow timeline for this cycle.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-2 text-sm text-blue-900">
                <p className="font-semibold">The following 7 steps will be created:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Week 1: Nominations Open (7 days)</li>
                  <li>Week 2: Self Applications (7 days)</li>
                  <li>Week 3: Evaluation & Scoring (7 days)</li>
                  <li>Week 4: RC Review (7 days)</li>
                  <li>Week 5: Steering Committee Meeting (7 days)</li>
                  <li>Week 6: Candidate Approach (7 days)</li>
                  <li>Week 7: Final Announcement (7 days)</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-900">
                <p className="font-semibold mb-1">Important:</p>
                <p>
                  Timeline steps will be automatically calculated starting from the cycle start
                  date ({new Date(cycleStartDate).toLocaleDateString()}). Each step is 7 days
                  long. You can manually adjust dates and statuses after creation if needed.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSeedTimeline} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Steps...
              </>
            ) : (
              <>
                <PlayCircle className="mr-2 h-4 w-4" />
                Create Timeline Steps
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
