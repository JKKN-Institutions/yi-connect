import { Suspense } from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AnnouncementComposer } from "@/components/communication/announcement-composer";
import {
  getAnnouncementById,
  getTemplates,
  getSegments
} from "@/lib/data/communication";

// Static metadata to avoid issues with dynamic data access
export const metadata: Metadata = {
  title: "Edit Announcement | Yi Connect",
  description: "Edit announcement details and settings",
};


interface EditAnnouncementPageProps {
  params: { id: string };
}

async function EditAnnouncementContent({ params }: EditAnnouncementPageProps) {
  const announcement = await getAnnouncementById(params.id);

  if (!announcement) {
    notFound();
  }

  // Only allow editing drafts
  if (announcement.status !== "draft") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <h2 className="text-2xl font-bold">Cannot Edit This Announcement</h2>
        <p className="text-muted-foreground">
          Only draft announcements can be edited. This announcement has status: {announcement.status}
        </p>
        <Button asChild>
          <Link href={`/communication/announcements/${announcement.id}`}>
            View Announcement
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/communication/announcements/${announcement.id}`}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to announcement</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Announcement</h1>
          <p className="text-muted-foreground mt-1">
            Update your announcement details
          </p>
        </div>
      </div>

      {/* Composer Card */}
      <Card>
        <CardHeader>
          <CardTitle>Announcement Details</CardTitle>
          <CardDescription>
            Make changes to your announcement. Changes will be saved when you click save.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<ComposerSkeleton />}>
            <AnnouncementComposerWrapper announcementId={announcement.id} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

export default function EditAnnouncementPage({ params }: EditAnnouncementPageProps) {
  return (
    <Suspense fallback={<div className="p-8"><Skeleton className="h-96 w-full" /></div>}>
      <EditAnnouncementContent params={params} />
    </Suspense>
  );
}

async function AnnouncementComposerWrapper({ announcementId }: { announcementId: string }) {
  // Fetch the announcement, templates, and segments
  const [announcement, templatesResult, segmentsResult] = await Promise.all([
    getAnnouncementById(announcementId),
    getTemplates(),
    getSegments()
  ]);

  if (!announcement) {
    notFound();
  }

  // Prepare default values from the announcement
  const defaultValues = {
    title: announcement.title,
    content: announcement.content,
    channels: announcement.channels,
    priority: announcement.priority,
    audience_filter: announcement.audience_filter,
    segment_id: announcement.segment_id,
    template_id: announcement.template_id,
    scheduled_at: announcement.scheduled_at,
  };

  return (
    <AnnouncementComposer
      announcementId={announcementId}
      templates={templatesResult}
      segments={segmentsResult}
      defaultValues={defaultValues}
    />
  );
}

function ComposerSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-40 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}
