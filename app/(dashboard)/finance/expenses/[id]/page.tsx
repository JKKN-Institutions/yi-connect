/**
 * Expense Detail Page
 *
 * Display full expense details with receipts and approval status.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Edit,
  CheckCircle,
  XCircle,
  Receipt,
  User,
  Calendar,
  DollarSign
} from 'lucide-react';
import { requireRole } from '@/lib/auth';

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
  ExpenseStatusBadge,
  ExpenseCategoryBadge,
  PaymentMethodBadge
} from '@/components/finance/status-badges';
import { getExpenseById } from '@/lib/data/finance';
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

async function ExpenseDetail({ expenseId }: { expenseId: string }) {
  const expense = await getExpenseById(expenseId);

  if (!expense) {
    notFound();
  }

  const expenseDate = new Date(expense.expense_date);

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <Link href='/finance/expenses'>
            <Button variant='ghost' size='icon'>
              <ArrowLeft className='h-4 w-4' />
            </Button>
          </Link>
          <div>
            <h1 className='text-3xl font-bold tracking-tight'>
              {expense.title}
            </h1>
            <p className='text-muted-foreground'>
              {expense.category && (
                <span className='mr-2 text-sm font-medium'>
                  {expense.category.name}
                </span>
              )}
              {expenseDate.toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <ExpenseStatusBadge status={expense.status} />
          {expense.status === 'submitted' && (
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
          {expense.status === 'draft' && (
            <Link href={`/finance/expenses/${expense.id}/edit`}>
              <Button variant='outline'>
                <Edit className='mr-2 h-4 w-4' />
                Edit
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Expense Overview */}
      <div className='grid gap-6 md:grid-cols-3'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Amount</CardTitle>
            <DollarSign className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {formatCurrency(expense.amount)}
            </div>
            <p className='text-xs text-muted-foreground mt-1'>
              {expense.payment_method && (
                <PaymentMethodBadge method={expense.payment_method} />
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Submitted By</CardTitle>
            <User className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-lg font-semibold'>
              {expense.submitted_by_profile?.full_name || 'Unknown'}
            </div>
            <p className='text-xs text-muted-foreground mt-1'>
              {new Date(expense.created_at).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Status</CardTitle>
            <Calendar className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='mt-1'>
              <ExpenseStatusBadge status={expense.status} />
            </div>
            {expense.approved_at && (
              <p className='text-xs text-muted-foreground mt-2'>
                Approved {new Date(expense.approved_at).toLocaleDateString()}
              </p>
            )}
            {expense.rejection_reason && (
              <p className='text-xs text-muted-foreground mt-2'>
                Rejected: {expense.rejection_reason}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      {expense.description && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-sm text-muted-foreground whitespace-pre-wrap'>
              {expense.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Expense Details */}
      <Card>
        <CardHeader>
          <CardTitle>Expense Information</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <p className='text-sm font-medium'>Category</p>
              <div className='mt-1 text-sm'>
                {expense.category?.name || 'N/A'}
              </div>
            </div>
            <div>
              <p className='text-sm font-medium'>Payment Method</p>
              <div className='mt-1'>
                {expense.payment_method && (
                  <PaymentMethodBadge method={expense.payment_method} />
                )}
              </div>
            </div>
            <div>
              <p className='text-sm font-medium'>Expense Date</p>
              <p className='text-sm text-muted-foreground'>
                {expenseDate.toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className='text-sm font-medium'>Status</p>
              <div className='mt-1'>
                <ExpenseStatusBadge status={expense.status} />
              </div>
            </div>
          </div>

          {expense.budget && (
            <>
              <Separator />
              <div>
                <p className='text-sm font-medium'>Linked Budget</p>
                <Link
                  href={`/finance/budgets/${expense.budget_id}`}
                  className='text-sm text-primary hover:underline mt-1 inline-block'
                >
                  {expense.budget.name}
                </Link>
              </div>
            </>
          )}

          {expense.event && (
            <>
              <Separator />
              <div>
                <p className='text-sm font-medium'>Linked Event</p>
                <Link
                  href={`/events/${expense.event_id}`}
                  className='text-sm text-primary hover:underline mt-1 inline-block'
                >
                  {expense.event.title}
                </Link>
              </div>
            </>
          )}

          {expense.vendor_name && (
            <>
              <Separator />
              <div>
                <p className='text-sm font-medium'>Vendor</p>
                <p className='text-sm text-muted-foreground'>
                  {expense.vendor_name}
                </p>
              </div>
            </>
          )}

          {expense.invoice_number && (
            <div>
              <p className='text-sm font-medium'>Invoice Number</p>
              <p className='text-sm text-muted-foreground'>
                {expense.invoice_number}
              </p>
            </div>
          )}

          <Separator />
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <p className='text-sm font-medium'>Created</p>
              <p className='text-sm text-muted-foreground'>
                {new Date(expense.created_at).toLocaleDateString()}
              </p>
            </div>
            {expense.updated_at && (
              <div>
                <p className='text-sm font-medium'>Last Updated</p>
                <p className='text-sm text-muted-foreground'>
                  {new Date(expense.updated_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Approval Information */}
      {(expense.approved_by_profile || expense.rejection_reason) && (
        <Card>
          <CardHeader>
            <CardTitle>Approval Details</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            {expense.approved_by_profile && (
              <div>
                <p className='text-sm font-medium'>Approved By</p>
                <p className='text-sm text-muted-foreground'>
                  {expense.approved_by_profile.full_name || 'Unknown'}
                </p>
                {expense.approved_at && (
                  <p className='text-xs text-muted-foreground mt-1'>
                    {new Date(expense.approved_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
            {expense.rejection_reason && (
              <div>
                <p className='text-sm font-medium'>Rejection Reason</p>
                <p className='text-sm text-muted-foreground'>
                  {expense.rejection_reason}
                </p>
              </div>
            )}
            {expense.rejection_reason && (
              <>
                <Separator />
                <div>
                  <p className='text-sm font-medium'>Rejection Reason</p>
                  <p className='text-sm text-muted-foreground whitespace-pre-wrap'>
                    {expense.rejection_reason}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Receipts */}
      {expense.receipts && expense.receipts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Receipt className='h-5 w-5' />
              Receipts ({expense.receipts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-2'>
            {expense.receipts.map((receipt, index) => (
              <a
                key={receipt.id}
                href={receipt.file_path}
                target='_blank'
                rel='noopener noreferrer'
                className='text-primary hover:underline flex items-center gap-2'
              >
                View Receipt {index + 1}
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {expense.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-sm text-muted-foreground whitespace-pre-wrap'>
              {expense.notes}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default async function ExpensePage({ params }: PageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']);

  const { id } = await params;

  return (
    <Suspense
      fallback={
        <div className='space-y-6'>
          <Skeleton className='h-12 w-full' />
          <div className='grid gap-6 md:grid-cols-3'>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className='h-32' />
            ))}
          </div>
          <Skeleton className='h-64' />
        </div>
      }
    >
      <ExpenseDetail expenseId={id} />
    </Suspense>
  );
}
