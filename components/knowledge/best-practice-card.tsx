import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { BestPracticeListItem } from '@/types/knowledge';
import {
  Lightbulb,
  ThumbsUp,
  Eye,
  Calendar,
  User,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface BestPracticeCardProps {
  bestPractice: BestPracticeListItem;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  under_review: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  published: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  published: 'Published',
  rejected: 'Rejected',
};

export function BestPracticeCard({ bestPractice }: BestPracticeCardProps) {
  return (
    <Card className="group hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              <Link
                href={`/knowledge/best-practices/${bestPractice.id}`}
                className="font-semibold text-base hover:underline line-clamp-1"
              >
                {bestPractice.title}
              </Link>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {bestPractice.description}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <div className="space-y-3">
          {/* Status Badge */}
          <div>
            <Badge className={STATUS_COLORS[bestPractice.status]}>
              {STATUS_LABELS[bestPractice.status]}
            </Badge>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <ThumbsUp className="h-3.5 w-3.5" />
              {bestPractice.upvote_count}
            </div>
            <div className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {bestPractice.view_count}
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t">
        <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {bestPractice.submitted_by_name}
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {bestPractice.published_at
              ? formatDistanceToNow(new Date(bestPractice.published_at), { addSuffix: true })
              : formatDistanceToNow(new Date(bestPractice.created_at), { addSuffix: true })}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
