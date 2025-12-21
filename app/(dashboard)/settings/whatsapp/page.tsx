/**
 * WhatsApp Settings Page
 *
 * Manage WhatsApp connection - scan QR code to authenticate
 */

import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { WhatsAppSettingsContent } from './whatsapp-settings-content';

export const metadata = {
  title: 'WhatsApp Settings - Yi Connect',
  description: 'Connect your WhatsApp account for event notifications',
};

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-96" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-[400px] w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    </div>
  );
}

async function WhatsAppPage() {
  await requireAuth();
  return <WhatsAppSettingsContent />;
}

export default function WhatsAppSettingsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <WhatsAppPage />
    </Suspense>
  );
}
