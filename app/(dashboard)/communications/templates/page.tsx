import { Suspense } from "react";
import { Metadata } from "next";
import Link from "next/link";
import { Plus, FileText, Sparkles, Copy, Edit, Trash2 } from "lucide-react";
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
import { getTemplates } from "@/lib/data/communication";
import { format } from "date-fns";
import { ChannelBadge } from "@/components/communication/status-badges";

export const metadata: Metadata = {
  title: "Templates | Communication Hub",
  description: "Manage message templates with dynamic placeholders",
};

export default function TemplatesPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Message Templates</h1>
          <p className="text-muted-foreground mt-1">
            Create reusable templates with dynamic placeholders
          </p>
        </div>
        <Button asChild>
          <Link href="/communication/templates/new">
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Link>
        </Button>
      </div>

      {/* Templates Grid */}
      <Suspense fallback={<TemplatesGridSkeleton />}>
        <TemplatesGrid />
      </Suspense>
    </div>
  );
}

async function TemplatesGrid() {
  const templates = await getTemplates();

  if (templates.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No templates yet</h3>
          <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
            Create reusable message templates with dynamic placeholders like {"{firstName}"} and {"{eventName}"} to save time.
          </p>
          <Button asChild>
            <Link href="/communication/templates/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Template
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {templates.map((template) => (
        <Card key={template.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate">{template.name}</CardTitle>
                  {template.category && (
                    <CardDescription className="line-clamp-2 mt-1">
                      {template.category}
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
                    <Link href={`/communication/templates/${template.id}/edit`}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicate
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
            {/* Content Preview */}
            <div className="p-3 rounded-lg bg-muted/50 border text-sm">
              <p className="line-clamp-3 font-mono text-xs">
                {template.content_template}
              </p>
            </div>

            {/* Metadata */}
            <div className="space-y-2">
              {/* Channels */}
              {template.default_channels && template.default_channels.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Channels:</span>
                  <div className="flex flex-wrap gap-1">
                    {template.default_channels.map((channel) => (
                      <ChannelBadge
                        key={channel}
                        channel={channel as "email" | "whatsapp" | "in_app"}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Usage Count */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Used {template.usage_count || 0} times</span>
                {template.last_used_at && (
                  <span>Last used {format(new Date(template.last_used_at), "MMM d")}</span>
                )}
              </div>
            </div>

            {/* Action Button */}
            <Button variant="outline" className="w-full" asChild>
              <Link href={`/communication/announcements/new?template=${template.id}`}>
                Use Template
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TemplatesGridSkeleton() {
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
