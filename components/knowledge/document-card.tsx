import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DocumentListItem } from '@/types/knowledge';
import {
  FileText,
  Download,
  Eye,
  Calendar,
  User,
  FolderOpen,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface DocumentCardProps {
  document: DocumentListItem;
}

const FILE_ICONS: Record<string, string> = {
  'application/pdf': '📄',
  'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.ms-excel': '📊',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
  'application/vnd.ms-powerpoint': '📽️',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '📽️',
  'image/jpeg': '🖼️',
  'image/png': '🖼️',
  'image/gif': '🖼️',
  'image/webp': '🖼️',
  'text/plain': '📃',
};

const VISIBILITY_COLORS: Record<string, string> = {
  public: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  chapter: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  ec_only: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  chair_only: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export function DocumentCard({ document }: DocumentCardProps) {
  const fileIcon = FILE_ICONS[document.file_type] || '📎';

  return (
    <Card className="group hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{fileIcon}</span>
            <div>
              <Link
                href={`/knowledge/documents/${document.id}`}
                className="font-semibold text-base hover:underline line-clamp-2"
              >
                {document.title}
              </Link>
              <p className="text-sm text-muted-foreground mt-1">
                {document.file_name}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <div className="space-y-3">
          {/* Category & Visibility */}
          <div className="flex items-center gap-2 flex-wrap">
            {document.category_name && (
              <Badge variant="outline" className="gap-1">
                <FolderOpen className="h-3 w-3" />
                {document.category_name}
              </Badge>
            )}
            <Badge className={VISIBILITY_COLORS[document.visibility]}>
              {document.visibility.replace('_', ' ')}
            </Badge>
          </div>

          {/* Tags */}
          {document.tags && document.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {document.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {document.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{document.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {document.view_count}
            </div>
            <div className="flex items-center gap-1">
              <Download className="h-3.5 w-3.5" />
              {document.download_count}
            </div>
            <div className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              {document.file_size_kb} KB
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t">
        <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {document.uploaded_by_name}
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDistanceToNow(new Date(document.created_at), { addSuffix: true })}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
