/**
 * Vendor Edit Page
 *
 * Allows editing an existing vendor stakeholder
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { VendorForm } from '@/components/stakeholders/vendor-form'
import { getVendorById } from '@/lib/data/stakeholder'
import { getCurrentChapterId, requireRole } from '@/lib/auth'

interface VendorEditPageProps {
  params: Promise<{ id: string }>
}

export const metadata = {
  title: 'Edit Vendor | Yi Connect',
  description: 'Edit vendor stakeholder information',
}

async function VendorEditForm({ vendorId }: { vendorId: string }) {
  const [vendor, chapterId] = await Promise.all([
    getVendorById(vendorId),
    getCurrentChapterId(),
  ])

  if (!vendor) {
    notFound()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Vendor</CardTitle>
        <CardDescription>
          Update the information for {vendor.vendor_name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <VendorForm
          chapterId={chapterId}
          initialData={vendor}
          mode="edit"
        />
      </CardContent>
    </Card>
  )
}

function FormSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-8 w-[200px]" />
        <Skeleton className="h-4 w-[300px]" />
      </CardHeader>
      <CardContent className="space-y-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default async function VendorEditPage({ params }: VendorEditPageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member'])

  const { id } = await params

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/stakeholders/vendors/${id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Vendor</h1>
          <p className="text-muted-foreground">
            Update vendor stakeholder information
          </p>
        </div>
      </div>

      <Suspense fallback={<FormSkeleton />}>
        <VendorEditForm vendorId={id} />
      </Suspense>
    </div>
  )
}
