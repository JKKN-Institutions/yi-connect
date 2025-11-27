import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { SegmentForm } from "@/components/communication/segment-form";

export const metadata: Metadata = {
  title: "Create Segment | Communication Hub",
  description: "Create a new audience segment for targeted communications",
};

export default async function NewSegmentPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member']);

  return (
    <div className="flex flex-col gap-6 max-w-9xl mx-auto">
      {/* Back Link */}
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/communications/segments">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Segments
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Segment</h1>
        <p className="text-muted-foreground mt-1">
          Define audience filters to create a reusable segment for targeted communications
        </p>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>Segment Details</CardTitle>
          <CardDescription>
            Set up filters to define which members should be included in this segment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SegmentForm />
        </CardContent>
      </Card>
    </div>
  );
}
