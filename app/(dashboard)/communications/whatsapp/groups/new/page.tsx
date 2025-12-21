/**
 * New WhatsApp Group Page
 *
 * Form to add a new WhatsApp group to the chapter.
 */

import Link from 'next/link';
import { ArrowLeft, Users2 } from 'lucide-react';
import { requireRole } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { GroupForm } from '../group-form';

export default async function NewWhatsAppGroupPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair']);

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/communications/whatsapp/groups">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-purple-100 p-2">
            <Users2 className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Add WhatsApp Group</h1>
            <p className="text-muted-foreground">
              Add a new WhatsApp group to your chapter
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <GroupForm />
    </div>
  );
}
