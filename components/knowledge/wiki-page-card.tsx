import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { WikiPageListItem } from '@/types/knowledge';
import {
  BookOpen,
  Calendar,
  User,
  Lock,
  GitBranch,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface WikiPageCardProps {
  wikiPage: WikiPageListItem;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  sop: {
    label: 'SOP',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  best_practice: {
    label: 'Best Practice',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  process_note: {
    label: 'Process Note',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  },
  general: {
    label: 'General',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  },
};

const VISIBILITY_LABELS: Record<string, string> = {
  public: 'Public',
  chapter: 'Chapter',
  ec_only: 'EC Only',
  chair_only: 'Chair Only',
};

export function WikiPageCard({ wikiPage }: WikiPageCardProps) {
  const categoryInfo = CATEGORY_LABELS[wikiPage.category];

  return (
    <Card className="group hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <Link
                href={`/knowledge/wiki/${wikiPage.slug}`}
                className="font-semibold text-base hover:underline line-clamp-1"
              >
                {wikiPage.title}
              </Link>
              {wikiPage.is_locked && (
                <Lock className="h-4 w-4 text-orange-500" />
              )}
            </div>
            {wikiPage.summary && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {wikiPage.summary}
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={categoryInfo.color}>
            {categoryInfo.label}
          </Badge>
          <Badge variant="outline">
            {VISIBILITY_LABELS[wikiPage.visibility]}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <GitBranch className="h-3 w-3" />
            v{wikiPage.version}
          </Badge>
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t">
        <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {wikiPage.last_edited_by_name || wikiPage.created_by_name}
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDistanceToNow(new Date(wikiPage.updated_at), { addSuffix: true })}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
