/**
 * WhatsApp Groups List Page
 *
 * Directory of all WhatsApp groups for the chapter.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import {
  Plus,
  Users2,
  Search,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Trash2,
  Send
} from 'lucide-react';
import { requireRole } from '@/lib/auth';
import { getCurrentChapterId } from '@/lib/auth';
import { getWhatsAppGroups } from '@/lib/data/whatsapp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { GROUP_TYPE_INFO } from '@/types/whatsapp';

interface PageProps {
  searchParams: Promise<{
    search?: string;
    type?: string;
  }>;
}

export default async function WhatsAppGroupsPage({ searchParams }: PageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'EC Member']);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-purple-100 p-2">
            <Users2 className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">WhatsApp Groups</h1>
            <p className="text-muted-foreground">
              Manage your chapter WhatsApp groups
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/communications/whatsapp/groups/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Group
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Suspense fallback={<FiltersSkeleton />}>
        <FiltersSection searchParams={searchParams} />
      </Suspense>

      {/* Groups List */}
      <Suspense fallback={<GroupsGridSkeleton />}>
        <GroupsList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function FiltersSection({
  searchParams
}: {
  searchParams: Promise<{ search?: string; type?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex gap-4">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search groups..."
          className="pl-10"
          defaultValue={params.search}
        />
      </div>
      <div className="flex gap-2">
        {GROUP_TYPE_INFO.slice(0, 4).map((type) => (
          <Button
            key={type.value}
            variant={params.type === type.value ? 'default' : 'outline'}
            size="sm"
            asChild
          >
            <Link
              href={
                params.type === type.value
                  ? '/communications/whatsapp/groups'
                  : `/communications/whatsapp/groups?type=${type.value}`
              }
            >
              {type.label}
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}

async function GroupsList({
  searchParams
}: {
  searchParams: Promise<{ search?: string; type?: string }>;
}) {
  const params = await searchParams;
  const chapterId = await getCurrentChapterId();

  if (!chapterId) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">No chapter selected</p>
        </CardContent>
      </Card>
    );
  }

  const groups = await getWhatsAppGroups(chapterId, {
    search: params.search,
    group_type: params.type ? [params.type as any] : undefined
  });

  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users2 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No groups found</h3>
          <p className="text-muted-foreground text-center mb-4">
            {params.search || params.type
              ? 'Try adjusting your filters'
              : 'Add your first WhatsApp group to get started'}
          </p>
          <Button asChild>
            <Link href="/communications/whatsapp/groups/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Group
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const groupTypeColors: Record<string, string> = {
    chapter: 'bg-blue-100 text-blue-600 border-blue-200',
    leadership: 'bg-purple-100 text-purple-600 border-purple-200',
    ec_team: 'bg-orange-100 text-orange-600 border-orange-200',
    yuva: 'bg-green-100 text-green-600 border-green-200',
    thalir: 'bg-cyan-100 text-cyan-600 border-cyan-200',
    fun: 'bg-pink-100 text-pink-600 border-pink-200',
    core: 'bg-red-100 text-red-600 border-red-200',
    other: 'bg-gray-100 text-gray-600 border-gray-200'
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {groups.map((group) => (
        <Card key={group.id} className={cn(!group.is_active && 'opacity-60')}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'rounded-lg p-2',
                    groupTypeColors[group.group_type || 'other']?.split(' ')[0] ||
                      'bg-gray-100'
                  )}
                >
                  <Users2
                    className={cn(
                      'h-4 w-4',
                      groupTypeColors[group.group_type || 'other']
                        ?.split(' ')[1] || 'text-gray-600'
                    )}
                  />
                </div>
                <div>
                  <CardTitle className="text-base">{group.name}</CardTitle>
                  {group.member_count && (
                    <CardDescription>
                      {group.member_count} members
                    </CardDescription>
                  )}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/communications/whatsapp/compose?group=${group.jid}`}>
                      <Send className="mr-2 h-4 w-4" />
                      Send Message
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/communications/whatsapp/groups/${group.id}/edit`}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 flex-wrap">
              {group.group_type && (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    groupTypeColors[group.group_type] || groupTypeColors.other
                  )}
                >
                  {GROUP_TYPE_INFO.find((t) => t.value === group.group_type)
                    ?.label || group.group_type}
                </Badge>
              )}
              {group.is_default && (
                <Badge variant="secondary" className="text-xs">
                  Default
                </Badge>
              )}
              {!group.is_active && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  Inactive
                </Badge>
              )}
            </div>
            {group.description && (
              <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                {group.description}
              </p>
            )}
            <div className="mt-4 pt-4 border-t">
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link href={`/communications/whatsapp/compose?group=${group.jid}`}>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Send Message
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FiltersSkeleton() {
  return (
    <div className="flex gap-4">
      <Skeleton className="h-10 w-64" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20" />
        ))}
      </div>
    </div>
  );
}

function GroupsGridSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div>
                <Skeleton className="h-5 w-32 mb-1" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-5 w-24 mb-3" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
