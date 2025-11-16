/**
 * Increase Capacity Page (Industry Portal)
 * Allow industries to increase capacity for their slots
 */

import { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { IncreaseCapacityForm } from '@/components/industrial-visits/industry-portal/increase-capacity-form';

// Placeholder - would fetch actual slot data
async function getSlot(id: string) {
  // TODO: Fetch slot by ID for authenticated industry
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
  const slot = await getSlot(id);

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
          <CardTitle>Current Capacity Information</CardTitle>
          <CardDescription>
            Your slot is currently full. Increase the capacity to allow more members to
            join.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IncreaseCapacityForm slotId={id} currentCapacity={20} currentRegistrations={20} />
        </CardContent>
      </Card>
    </div>
  );
}
