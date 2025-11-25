import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDocumentWithDetails } from '@/lib/data/knowledge';
import { getDocumentDownloadUrl } from '@/app/actions/knowledge';
import { requireRole } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { DocumentViewTracker } from '@/components/knowledge/document-view-tracker';
import { DocumentShareButton, DocumentMoreActions } from '@/components/knowledge/document-actions';
import {
  ArrowLeft,
  Download,
  Eye,
  Calendar,
  User,
  FolderOpen,
  FileText,
  Tag,
  Globe,
  Lock,
} from 'lucide-react';
import { format } from 'date-fns';

// File type icons
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

const VISIBILITY_CONFIG: Record<string, { label: string; color: string; icon: typeof Globe }> = {
  public: { label: 'Public', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: Globe },
  chapter: { label: 'Chapter', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: User },
  ec_only: { label: 'EC Only', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', icon: Lock },
  chair_only: { label: 'Chair Only', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: Lock },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

async function DocumentDetails({ documentId }: { documentId: string }) {
  const document = await getDocumentWithDetails(documentId);

  if (!document) {
    notFound();
  }

  const fileIcon = FILE_ICONS[document.file_type] || '📎';
  const visibilityConfig = VISIBILITY_CONFIG[document.visibility] || VISIBILITY_CONFIG.chapter;
  const VisibilityIcon = visibilityConfig.icon;

  // Get download URL
  const { url: downloadUrl } = await getDocumentDownloadUrl(documentId);

  return (
    <div className="space-y-6">
      {/* Client component to track views on mount */}
      <DocumentViewTracker documentId={documentId} />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="text-5xl">{fileIcon}</span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{document.title}</h1>
            <p className="text-muted-foreground mt-1">{document.file_name}</p>
            <div className="flex items-center gap-3 mt-3">
              {document.category_name && (
                <Badge variant="outline" className="gap-1">
                  <FolderOpen className="h-3 w-3" />
                  {document.category_name}
                </Badge>
              )}
              <Badge className={visibilityConfig.color}>
                <VisibilityIcon className="h-3 w-3 mr-1" />
                {visibilityConfig.label}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {downloadUrl && (
            <Button asChild>
              <Link href={downloadUrl} download={document.file_name} target="_blank" rel="noopener noreferrer">
                <Download className="mr-2 h-4 w-4" />
                Download
              </Link>
            </Button>
          )}
          <DocumentShareButton documentId={documentId} documentTitle={document.title} />
          <DocumentMoreActions documentId={documentId} documentTitle={document.title} />
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {document.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{document.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Tags */}
          {document.tags && document.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {document.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Preview (for images) */}
          {document.file_type.startsWith('image/') && downloadUrl && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <img
                  src={downloadUrl}
                  alt={document.title}
                  className="max-w-full h-auto rounded-lg"
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Document Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Document Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  File Size
                </span>
                <span className="font-medium">
                  {document.file_size_kb >= 1024
                    ? `${(document.file_size_kb / 1024).toFixed(2)} MB`
                    : `${document.file_size_kb} KB`}
                </span>
              </div>

              <Separator />

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Views
                </span>
                <span className="font-medium">{document.view_count}</span>
              </div>

              <Separator />

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Downloads
                </span>
                <span className="font-medium">{document.download_count}</span>
              </div>

              <Separator />

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Uploaded By
                </span>
                <span className="font-medium">{document.uploaded_by_name}</span>
              </div>

              <Separator />

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Uploaded
                </span>
                <span className="font-medium">
                  {format(new Date(document.created_at), 'MMM d, yyyy')}
                </span>
              </div>

              {document.year_tag && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Year Tag</span>
                    <Badge variant="outline">{document.year_tag}</Badge>
                  </div>
                </>
              )}

              {document.version > 1 && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Version</span>
                    <Badge variant="outline">v{document.version}</Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* National Sync Status */}
          {document.shared_with_national && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">National Sync</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge
                    variant={
                      document.national_sync_status === 'synced'
                        ? 'default'
                        : document.national_sync_status === 'approved'
                        ? 'secondary'
                        : document.national_sync_status === 'rejected'
                        ? 'destructive'
                        : 'outline'
                    }
                  >
                    {document.national_sync_status || 'Pending'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default async function DocumentPage({ params }: PageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member', 'Member']);

  const { id } = await params;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/knowledge/documents">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Documents
        </Link>
      </Button>

      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <Skeleton className="h-16 w-16 rounded" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-48" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <Skeleton className="h-6 w-32" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-24 w-full" />
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-4 w-full" />
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        }
      >
        <DocumentDetails documentId={id} />
      </Suspense>
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const document = await getDocumentWithDetails(id);

  if (!document) {
    return {
      title: 'Document Not Found',
    };
  }

  return {
    title: document.title,
    description: document.description || `View ${document.title} - ${document.file_name}`,
  };
}
