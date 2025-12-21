/**
 * WhatsApp Compose Message Page
 *
 * Send messages to individuals, groups, or bulk recipients.
 * Supports template selection with variable substitution.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, Send } from 'lucide-react';
import { requireRole } from '@/lib/auth';
import { getCurrentChapterId } from '@/lib/auth';
import { getWhatsAppGroups, getWhatsAppTemplates } from '@/lib/data/whatsapp';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ComposeForm } from './compose-form';

interface PageProps {
  searchParams: Promise<{
    group?: string;
    template?: string;
  }>;
}

export default async function WhatsAppComposePage({ searchParams }: PageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'EC Member']);

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/communications/whatsapp">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compose Message</h1>
          <p className="text-muted-foreground">
            Send WhatsApp messages to individuals, groups, or multiple recipients
          </p>
        </div>
      </div>

      {/* Compose Form */}
      <Suspense fallback={<ComposeFormSkeleton />}>
        <ComposeFormWrapper searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ComposeFormWrapper({
  searchParams
}: {
  searchParams: Promise<{ group?: string; template?: string }>;
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

  // Fetch groups and templates for the form
  const [groups, templates] = await Promise.all([
    getWhatsAppGroups(chapterId, { is_active: true }),
    getWhatsAppTemplates(chapterId, { is_active: true })
  ]);

  // Pre-select group if provided in URL
  const preselectedGroup = params.group
    ? groups.find((g) => g.jid === params.group)
    : undefined;

  // Pre-select template if provided in URL
  const preselectedTemplate = params.template
    ? templates.find((t) => t.id === params.template)
    : undefined;

  return (
    <ComposeForm
      groups={groups}
      templates={templates}
      preselectedGroup={preselectedGroup}
      preselectedTemplate={preselectedTemplate}
    />
  );
}

function ComposeFormSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-10 w-32" />
      </CardContent>
    </Card>
  );
}
