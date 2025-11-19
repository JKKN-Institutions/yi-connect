import { Suspense } from "react";
import { Metadata } from "next";
import Link from "next/link";
import { Plus, Target, Users, Edit, Trash2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getSegments } from "@/lib/data/communication";
import { format } from "date-fns";

export const metadata: Metadata = {
  title: "Audience Segments | Communication Hub",
  description: "Manage saved audience segments for targeted communications",
};


export default function SegmentsPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audience Segments</h1>
          <p className="text-muted-foreground mt-1">
            Save custom audience filters for targeted communications
          </p>
        </div>
        <Button asChild>
          <Link href="/communication/segments/new">
            <Plus className="mr-2 h-4 w-4" />
            New Segment
          </Link>
        </Button>
      </div>

      {/* Segments Grid */}
      <Suspense fallback={<SegmentsGridSkeleton />}>
        <SegmentsGrid />
      </Suspense>
    </div>
  );
}

async function SegmentsGrid() {
  const segments = await getSegments();

  if (segments.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Target className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No segments yet</h3>
          <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
            Create audience segments to target specific groups of members based on roles, engagement, or other criteria.
          </p>
          <Button asChild>
            <Link href="/communication/segments/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Segment
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {segments.map((segment) => (
        <Card key={segment.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                  <Target className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate">{segment.name}</CardTitle>
                  {segment.description && (
                    <CardDescription className="line-clamp-2 mt-1">
                      {segment.description}
                    </CardDescription>
                  )}
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <span className="sr-only">Open menu</span>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/communication/segments/${segment.id}/edit`}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Users className="mr-2 h-4 w-4" />
                    Preview Members
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Filter Summary */}
            <div className="p-3 rounded-lg bg-muted/50 border">
              <div className="space-y-2 text-sm">
                {segment.filter_rules.roles && segment.filter_rules.roles.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Roles:</span>
                    <div className="flex flex-wrap gap-1">
                      {segment.filter_rules.roles.slice(0, 2).map((role) => (
                        <Badge key={role} variant="secondary" className="text-xs">
                          {role}
                        </Badge>
                      ))}
                      {segment.filter_rules.roles.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{segment.filter_rules.roles.length - 2}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {segment.filter_rules.engagement && (
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Engagement:</span>
                    <span>
                      {segment.filter_rules.engagement.min}%-{segment.filter_rules.engagement.max}%
                    </span>
                  </div>
                )}

                {(!segment.filter_rules.roles || segment.filter_rules.roles.length === 0) &&
                  !segment.filter_rules.engagement && (
                    <span className="text-muted-foreground text-xs">No filters set</span>
                  )}
              </div>
            </div>

            {/* Metadata */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>{segment.member_count || 0} members</span>
              </div>
              {segment.created_at && (
                <span>Created {format(new Date(segment.created_at), "MMM d, yyyy")}</span>
              )}
            </div>

            {/* Action Button */}
            <Button variant="outline" className="w-full" asChild>
              <Link href={`/communication/announcements/new?segment=${segment.id}`}>
                Use Segment
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SegmentsGridSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="flex items-start gap-2">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-9 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
