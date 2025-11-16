/**
 * Create New Industrial Visit Slot (Industry Portal)
 * Simplified form for industries to create self-service IV slots
 */

import { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { IndustrySlotForm } from '@/components/industrial-visits/industry-portal/industry-slot-form';

export const metadata: Metadata = {
  title: 'Create New Slot | Industry Portal',
  description: 'Create a new industrial visit opportunity for Yi members'
};

export default function CreateIndustrySlotPage() {
  return (
    <div className='space-y-6 max-w-4xl'>
      {/* Back Button */}
      <Button variant='ghost' size='sm' asChild>
        <Link href='/industry-portal'>
          <ArrowLeft className='mr-2 h-4 w-4' />
          Back to Dashboard
        </Link>
      </Button>

      {/* Header */}
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>Create New Slot</h1>
        <p className='text-muted-foreground mt-1'>
          Set up a new industrial visit opportunity for Yi Chapter members
        </p>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Slot Details</CardTitle>
          <CardDescription>
            Provide information about the industrial visit you&apos;re offering
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IndustrySlotForm />
        </CardContent>
      </Card>
    </div>
  );
}
