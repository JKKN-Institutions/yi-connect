import { Suspense } from "react";
import { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AnnouncementComposer } from "@/components/communication/announcement-composer";
import { getTemplates, getSegments } from "@/lib/data/communication";
import { requireRole } from "@/lib/auth";
import Link from "next/link";

export const metadata: Metadata = {
  title: "New Announcement | Communication Hub",
  description: "Create a new chapter announcement",
};


export default async function NewAnnouncementPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member']);
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/communications/announcements">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to announcements</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Announcement</h1>
          <p className="text-muted-foreground mt-1">
            Create a new announcement to communicate with your members
          </p>
        </div>
      </div>

      {/* Composer Card */}
      <Card>
        <CardHeader>
          <CardTitle>Announcement Details</CardTitle>
          <CardDescription>
            Fill in the details below to create your announcement. You can save as draft, schedule for later, or send immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<ComposerSkeleton />}>
            <AnnouncementComposerWrapper />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

async function AnnouncementComposerWrapper() {
  // Fetch templates and segments for the composer
  const [templatesResult, segmentsResult] = await Promise.all([
    getTemplates(),
    getSegments()
  ]);

  return (
    <AnnouncementComposer
      templates={templatesResult}
      segments={segmentsResult}
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
