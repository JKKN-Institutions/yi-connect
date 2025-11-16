/**
 * Reimbursement Request Detail Page
 *
 * Display full reimbursement request details with approval workflow and status tracking.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Edit,
  CheckCircle,
  XCircle,
  DollarSign,
  Calendar,
  User,
  FileText,
  CreditCard,
  Clock
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  ReimbursementStatusBadge,
  PaymentMethodBadge
} from '@/components/finance/status-badges';
import { getReimbursementRequestById } from '@/lib/data/finance';
import { formatCurrency } from '@/types/finance';

interface PageProps {
  params: Promise<{ id: string }>;
}

// Provide placeholder ID for build-time validation
export async function generateStaticParams() {
  return [
    { id: '00000000-0000-0000-0000-000000000000' } // Placeholder UUID
  ];
}

async function RequestDetail({ requestId }: { requestId: string }) {
  const request = await getReimbursementRequestById(requestId);

  if (!request) {
    notFound();
  }

  const expenseDate = new Date(request.expense_date);
  const submittedAt = request.submitted_at
    ? new Date(request.submitted_at)
    : null;
  const paidAt = request.payment_date ? new Date(request.payment_date) : null;

  const daysPending = submittedAt
    ? Math.floor(
        (new Date().getTime() - submittedAt.getTime()) / (1000 * 60 * 60 * 24)
      )
    : 0;

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <Link href='/finance/reimbursements'>
            <Button variant='ghost' size='icon'>
              <ArrowLeft className='h-4 w-4' />
            </Button>
          </Link>
          <div>
            <h1 className='text-3xl font-bold tracking-tight'>
              {request.title}
            </h1>
            <p className='text-muted-foreground flex items-center gap-2 mt-1'>
              <User className='h-4 w-4' />
              {request.requester_profile?.full_name || 'Unknown'}
              {submittedAt && (
                <span className='text-xs'>
                  • Submitted {submittedAt.toLocaleDateString()}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <ReimbursementStatusBadge status={request.status} />
          {request.status === 'pending_approval' && (
            <>
              <Button variant='outline' className='text-green-600'>
                <CheckCircle className='mr-2 h-4 w-4' />
                Approve
              </Button>
              <Button variant='outline' className='text-red-600'>
                <XCircle className='mr-2 h-4 w-4' />
                Reject
              </Button>
            </>
          )}
          {request.status === 'draft' && (
            <Link href={`/finance/reimbursements/${request.id}/edit`}>
              <Button variant='outline'>
                <Edit className='mr-2 h-4 w-4' />
                Edit
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Request Overview Stats */}
      <div className='grid gap-6 md:grid-cols-3'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Amount</CardTitle>
            <DollarSign className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {formatCurrency(request.amount)}
            </div>
            <p className='text-xs text-muted-foreground mt-1'>
              Expense date: {expenseDate.toLocaleDateString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Status</CardTitle>
            <CheckCircle className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='mt-1'>
              <ReimbursementStatusBadge status={request.status} />
            </div>
            {request.status === 'pending_approval' && (
              <p className='text-xs text-muted-foreground mt-2'>
                Awaiting approval
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Processing Time
            </CardTitle>
            <Clock className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {paidAt && submittedAt
                ? Math.floor(
                    (paidAt.getTime() - submittedAt.getTime()) /
                      (1000 * 60 * 60 * 24)
                  )
                : daysPending}
            </div>
            <p className='text-xs text-muted-foreground'>
              {paidAt ? 'days to payment' : 'days pending'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className='grid gap-6 md:grid-cols-2'>
        {/* Request Details */}
        <Card>
          <CardHeader>
            <CardTitle>Request Details</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div>
              <p className='text-sm font-medium text-muted-foreground'>
                Description
              </p>
              <p className='text-sm mt-1 whitespace-pre-wrap'>
                {request.description}
              </p>
            </div>

            <Separator />

            <div className='grid grid-cols-2 gap-4'>
              <div>
                <p className='text-sm font-medium text-muted-foreground'>
                  Requester
                </p>
                <p className='text-sm font-semibold'>
                  {request.requester_profile?.full_name || 'Unknown'}
                </p>
                {request.requester_profile?.email && (
                  <p className='text-xs text-muted-foreground'>
                    {request.requester_profile.email}
                  </p>
                )}
              </div>

              <div>
                <p className='text-sm font-medium text-muted-foreground'>
                  Expense Date
                </p>
                <p className='text-sm'>{expenseDate.toLocaleDateString()}</p>
              </div>
            </div>

            {request.event && (
              <div>
                <p className='text-sm font-medium text-muted-foreground'>
                  Related Event
                </p>
                <Badge variant='outline' className='mt-1'>
                  {request.event.title}
                </Badge>
              </div>
            )}

            {request.expense && (
              <div>
                <p className='text-sm font-medium text-muted-foreground'>
                  Linked Expense
                </p>
                <Link
                  href={`/finance/expenses/${request.expense.id}`}
                  className='text-sm text-primary hover:underline mt-1 block'
                >
                  View Expense #{request.expense.id.slice(0, 8)}
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Details */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Information</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div>
              <p className='text-sm font-medium text-muted-foreground'>
                Amount
              </p>
              <p className='text-2xl font-bold mt-1'>
                {formatCurrency(request.amount)}
              </p>
            </div>

            <Separator />

            {request.payment_method && (
              <div>
                <p className='text-sm font-medium text-muted-foreground'>
                  Payment Method
                </p>
                <div className='mt-1'>
                  <PaymentMethodBadge method={request.payment_method} />
                </div>
              </div>
            )}

            {request.payment_reference && (
              <div>
                <p className='text-sm font-medium text-muted-foreground'>
                  Payment Reference
                </p>
                <p className='text-sm font-mono'>{request.payment_reference}</p>
              </div>
            )}

            {paidAt && (
              <div>
                <p className='text-sm font-medium text-muted-foreground'>
                  Paid On
                </p>
                <p className='text-sm'>{paidAt.toLocaleDateString()}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Approval History */}
      {request.approvals && request.approvals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Approval History</CardTitle>
            <CardDescription>
              {request.approvals.length} approval step
              {request.approvals.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              {request.approvals.map((approval, index) => {
                const approvalDate = approval.created_at
                  ? new Date(approval.created_at)
                  : null;

                return (
                  <div
                    key={approval.id}
                    className='flex items-start gap-4 p-4 border rounded-lg'
                  >
                    <div className='flex-1'>
                      <div className='flex items-center gap-2'>
                        <p className='text-sm font-medium'>
                          {approval.approver?.full_name || 'Unknown'}
                        </p>
                        {approval.action === 'approve' && (
                          <Badge className='bg-green-100 text-green-800 hover:bg-green-100'>
                            Approved
                          </Badge>
                        )}
                        {approval.action === 'reject' && (
                          <Badge className='bg-red-100 text-red-800 hover:bg-red-100'>
                            Rejected
                          </Badge>
                        )}
                        {approval.action === 'request_changes' && (
                          <Badge variant='outline'>Requested Changes</Badge>
                        )}
                      </div>

                      {approvalDate && (
                        <p className='text-xs text-muted-foreground mt-1'>
                          {approvalDate.toLocaleDateString()}
                        </p>
                      )}

                      {approval.comments && (
                        <p className='text-sm mt-2 p-2 bg-muted rounded'>
                          {approval.comments}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default async function RequestDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<RequestDetailSkeleton />}>
      <RequestDetail requestId={id} />
    </Suspense>
  );
}

function RequestDetailSkeleton() {
  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <Skeleton className='h-10 w-10' />
          <div className='space-y-2'>
            <Skeleton className='h-8 w-[300px]' />
            <Skeleton className='h-4 w-[200px]' />
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <Skeleton className='h-10 w-24' />
          <Skeleton className='h-10 w-24' />
        </div>
      </div>

      <div className='grid gap-6 md:grid-cols-3'>
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className='h-[120px]' />
        ))}
      </div>

      <div className='grid gap-6 md:grid-cols-2'>
        <Skeleton className='h-[300px]' />
        <Skeleton className='h-[300px]' />
      </div>
    </div>
  );
}
