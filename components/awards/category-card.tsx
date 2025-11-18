import Link from 'next/link'
import { AwardCategory } from '@/types/award'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trophy, Calendar, Target } from 'lucide-react'

interface CategoryCardProps {
  category: AwardCategory
  activeCycleCount?: number
  totalNominations?: number
}

const FREQUENCY_LABELS = {
  monthly: { label: 'Monthly', icon: Calendar },
  quarterly: { label: 'Quarterly', icon: Calendar },
  annual: { label: 'Annual', icon: Calendar },
  one_time: { label: 'One Time', icon: Target },
} as const

export function CategoryCard({
  category,
  activeCycleCount = 0,
  totalNominations = 0,
}: CategoryCardProps) {
  const frequencyConfig = FREQUENCY_LABELS[category.frequency]

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {category.icon && (
              <div
                className="flex h-12 w-12 items-center justify-center rounded-lg"
                style={{ backgroundColor: category.color || '#f3f4f6' }}
              >
                <Trophy className="h-6 w-6" />
              </div>
            )}
            <div>
              <CardTitle className="text-xl">{category.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {frequencyConfig.label}
                </Badge>
                {!category.is_active && (
                  <Badge variant="outline" className="text-xs">
                    Inactive
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <CardDescription className="text-sm">
          {category.description || 'No description available'}
        </CardDescription>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="flex flex-col">
            <span className="text-2xl font-bold">{activeCycleCount}</span>
            <span className="text-xs text-muted-foreground">Active Cycles</span>
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-bold">{totalNominations}</span>
            <span className="text-xs text-muted-foreground">Total Nominations</span>
          </div>
        </div>

        {/* Scoring Weights Preview */}
        {category.scoring_weights && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Scoring Criteria:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span>Impact:</span>
                <span className="font-medium">
                  {((category.scoring_weights as any).impact * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Innovation:</span>
                <span className="font-medium">
                  {((category.scoring_weights as any).innovation * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Participation:</span>
                <span className="font-medium">
                  {((category.scoring_weights as any).participation * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Consistency:</span>
                <span className="font-medium">
                  {((category.scoring_weights as any).consistency * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Leadership:</span>
                <span className="font-medium">
                  {((category.scoring_weights as any).leadership * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button asChild variant="default" className="flex-1">
          <Link href={`/awards/categories/${category.id}`}>
            View Details
          </Link>
        </Button>
        {category.is_active && activeCycleCount > 0 && (
          <Button asChild variant="outline" className="flex-1">
            <Link href={`/awards/nominate?category=${category.id}`}>
              Nominate
            </Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
