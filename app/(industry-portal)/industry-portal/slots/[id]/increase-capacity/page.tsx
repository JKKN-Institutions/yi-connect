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
import { createClient } from '@/lib/supabase/server';

async function getSlot(id: string, industryId: string) {
  const supabase = await createClient();

  const { data: slot } = await supabase
    .from('iv_events')
    .select('id, title, max_capacity, current_registrations, industry_id')
    .eq('id', id)
    .eq('industry_id', industryId)
    .single();

  return slot;
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
