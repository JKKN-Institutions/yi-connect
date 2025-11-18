/**
 * Vendor Detail Page - Simplified version
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Store, Star, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { getVendorById } from '@/lib/data/stakeholder'
import { StakeholderStatusBadge, HealthTierBadge } from '@/components/stakeholders/status-badges'

interface VendorDetailPageProps {
  params: Promise<{ id: string }>
}

// Static metadata to avoid issues with dynamic data access
export const metadata = {
  title: 'Vendor Details | Yi Connect',
  description: 'View and manage vendor stakeholder relationship',
}

async function VendorHeader({ vendorId }: { vendorId: string }) {
  const vendor = await getVendorById(vendorId)
  if (!vendor) notFound()

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/stakeholders/vendors"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{vendor.vendor_name}</h1>
            <StakeholderStatusBadge status={vendor.status} />
          </div>
          <div className="flex items-center gap-4 mt-2 text-muted-foreground">
            <div className="flex items-center gap-1">
              <Store className="h-4 w-4" />
              <span className="capitalize">{vendor.vendor_category.replace('_', ' ')}</span>
            </div>
            {vendor.quality_rating && (
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                <span>{vendor.quality_rating.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <Button asChild>
        <Link href={`/stakeholders/vendors/${vendor.id}/edit`}>Edit Vendor</Link>
      </Button>
    </div>
  )
}

async function VendorInformation({ vendorId }: { vendorId: string }) {
  const vendor = await getVendorById(vendorId)
  if (!vendor) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendor Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {vendor.services_offered && vendor.services_offered.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Services Offered</p>
            <div className="flex flex-wrap gap-2">
              {vendor.services_offered.map((service) => (
                <Badge key={service} variant="secondary">{service}</Badge>
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {vendor.pricing_model && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pricing Model</p>
              <p className="mt-1 capitalize">{vendor.pricing_model.replace('_', ' ')}</p>
            </div>
          )}
          {vendor.payment_terms && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Payment Terms</p>
              <p className="mt-1">{vendor.payment_terms}</p>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-muted-foreground">GST Registered</p>
            <p className="mt-1">{vendor.has_gst_certificate ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Service Agreement</p>
            <p className="mt-1">{vendor.has_service_agreement ? 'Yes' : 'No'}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

async function VendorDetailContent({ params }: VendorDetailPageProps) {
  const { id } = await params
  return (
    <div className="flex flex-col gap-8">
      <Suspense fallback={<div>Loading...</div>}>
        <VendorHeader vendorId={id} />
      </Suspense>
      <Suspense fallback={<div>Loading...</div>}>
        <VendorInformation vendorId={id} />
      </Suspense>
    </div>
  )
}

export default function VendorDetailPage({ params }: VendorDetailPageProps) {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <VendorDetailContent params={params} />
    </Suspense>
  )
}
