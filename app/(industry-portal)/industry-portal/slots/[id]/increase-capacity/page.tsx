/**
 * Increase Capacity Page (Industry Portal)
 * Allow industries to increase capacity for their slots
 */

import { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { IncreaseCapacityForm } from '@/components/industrial-visits/industry-portal/increase-capacity-form';
import { getCurrentIndustryId } from '@/lib/auth/industry-portal';

// Phase E stub 2026-05-24: this page used to query a non-existent table
// `iv_events`. The real industrial-visit data lives in `yi_connect.events`,
// but that table has NO `industry_id` column or FK to industries (see
// lib/data/industrial-visits.ts line 50-52 and 617-619 for the same gap).
//
// Until the IV ↔ industry linkage is re-modelled (likely via
// event_industry_partners or by adding events.industry_id), there is no
// safe way to look up "this industry's slot by id". Returning null here
// triggers notFound() so the route stays alive without a 500.
//
// TODO: once the schema is fixed, re-implement getSlot() to query
// yi_connect.events (or the new linking table) with proper RLS/scoping.
interface SlotRow {
  id: string;
  title: string;
  max_capacity: number;
  current_registrations: number;
  industry_id: string;
}

async function getSlot(_id: string, _industryId: string): Promise<SlotRow | null> {
  return null;
}

interface IncreaseCapacityPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({
  params,
}: IncreaseCapacityPageProps): Promise<Metadata> {
  return {
    title: 'Increase Capacity | Industry Portal',
    description: 'Increase the capacity for your industrial visit slot',
  };
}

export default async function IncreaseCapacityPage({
  params,
}: IncreaseCapacityPageProps) {
  const { id } = await params;

  const industryId = await getCurrentIndustryId();
  if (!industryId) {
    redirect('/login?redirect=/industry-portal');
  }

  const slot = await getSlot(id, industryId);

  if (!slot) {
    notFound();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Back Button */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/industry-portal/slots">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to My Slots
        </Link>
      </Button>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Increase Capacity</h1>
        <p className="text-muted-foreground mt-1">
          Add more spots to accommodate additional participants
        </p>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>{slot.title}</CardTitle>
          <CardDescription>
            Your slot currently has {slot.current_registrations} registrations out of {slot.max_capacity} capacity.
            Increase the capacity to allow more members to join.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IncreaseCapacityForm
            slotId={id}
            currentCapacity={slot.max_capacity}
            currentRegistrations={slot.current_registrations}
          />
        </CardContent>
      </Card>
    </div>
  );
}
