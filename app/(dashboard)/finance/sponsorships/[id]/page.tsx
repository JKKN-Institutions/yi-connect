/**
 * Sponsorship Deal Detail Page
 *
 * Display comprehensive deal information, sponsor details, payments, and deliverables.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Edit, TrendingUp, DollarSign, Target, Award, Calendar, Building2, User, FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { DealStageBadge } from '@/components/finance/status-badges'
import { getSponsorshipDealById } from '@/lib/data/finance'
import { formatCurrency } from '@/types/finance'

interface PageProps {
  params: Promise<{ id: string }>
}

// Provide placeholder ID for build-time validation
export async function generateStaticParams() {
  return [
    { id: '00000000-0000-0000-0000-000000000000' } // Placeholder UUID
  ]
}

async function DealDetail({ dealId }: { dealId: string }) {
  const deal = await getSponsorshipDealById(dealId)

  if (!deal) {
    notFound()
  }

  const proposalDate = deal.proposal_date ? new Date(deal.proposal_date) : null
  const expectedClosure = deal.expected_closure_date ? new Date(deal.expected_closure_date) : null
  const commitmentDate = deal.commitment_date ? new Date(deal.commitment_date) : null
  const contractDate = deal.contract_signed_date ? new Date(deal.contract_signed_date) : null

  const receivedPercentage = deal.committed_amount && deal.received_amount
    ? Math.round((deal.received_amount / deal.committed_amount) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/finance/sponsorships">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{deal.deal_name}</h1>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              <Building2 className="h-4 w-4" />
              {deal.sponsor.organization_name}
              {deal.tier && (
                <Badge variant="outline" className="ml-2">
                  {deal.tier.name}
                </Badge>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DealStageBadge stage={deal.deal_stage} />
          <Link href={`/finance/sponsorships/${deal.id}/edit`}>
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Edit Deal
            </Button>
          </Link>
        </div>
      </div>

      {/* Deal Overview Stats */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proposed Value</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(deal.proposed_amount)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Initial proposal
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Committed Amount</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {deal.committed_amount ? formatCurrency(deal.committed_amount) : '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {commitmentDate ? commitmentDate.toLocaleDateString() : 'Not committed'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Received Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(deal.received_amount || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {deal.payments?.length || 0} payment{deal.payments?.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Probability</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deal.probability_percentage}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Weighted: {formatCurrency(deal.weighted_value || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payment Progress */}
      {deal.committed_amount && deal.committed_amount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Progress</CardTitle>
            <CardDescription>
              {formatCurrency(deal.received_amount || 0)} of {formatCurrency(deal.committed_amount || 0)} received
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Completion</span>
                <span className="font-medium">{receivedPercentage}%</span>
              </div>
              <Progress value={receivedPercentage} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Sponsor Information */}
        <Card>
          <CardHeader>
            <CardTitle>Sponsor Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Organization</p>
                <p className="text-sm font-semibold">{deal.sponsor.organization_name}</p>
              </div>
              {deal.sponsor.industry && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Industry</p>
                  <p className="text-sm">{deal.sponsor.industry}</p>
                </div>
              )}
            </div>

            {deal.sponsor.contact_person_name && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Contact Person</p>
                <p className="text-sm">{deal.sponsor.contact_person_name}</p>
                {deal.sponsor.contact_person_designation && (
                  <p className="text-xs text-muted-foreground">{deal.sponsor.contact_person_designation}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {deal.sponsor.contact_email && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p className="text-sm">{deal.sponsor.contact_email}</p>
                </div>
              )}
              {deal.sponsor.contact_phone && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Phone</p>
                  <p className="text-sm">{deal.sponsor.contact_phone}</p>
                </div>
              )}
            </div>

            {deal.sponsor.website && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Website</p>
                <a
                  href={deal.sponsor.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  {deal.sponsor.website}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deal Information */}
        <Card>
          <CardHeader>
            <CardTitle>Deal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Deal Stage</p>
                <div className="mt-1">
                  <DealStageBadge stage={deal.deal_stage} />
                </div>
              </div>
              {deal.fiscal_year && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Fiscal Year</p>
                  <p className="text-sm font-semibold">FY {deal.fiscal_year}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {proposalDate && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Proposal Date</p>
                  <p className="text-sm">{proposalDate.toLocaleDateString()}</p>
                </div>
              )}
              {expectedClosure && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Expected Closure</p>
                  <p className="text-sm">{expectedClosure.toLocaleDateString()}</p>
                </div>
              )}
            </div>

            {contractDate && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Contract Signed</p>
                  <p className="text-sm">{contractDate.toLocaleDateString()}</p>
                </div>
                {deal.contract_number && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Contract Number</p>
                    <p className="text-sm">{deal.contract_number}</p>
                  </div>
                )}
              </div>
            )}

            {deal.point_of_contact_profile && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Point of Contact</p>
                <p className="text-sm">{deal.point_of_contact_profile.full_name}</p>
              </div>
            )}

            {deal.assigned_to_profile && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Assigned To</p>
                <p className="text-sm">{deal.assigned_to_profile.full_name}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Deliverables */}
      {deal.deliverables && deal.deliverables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Deliverables</CardTitle>
            <CardDescription>Promised benefits to the sponsor</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {deal.deliverables.map((deliverable, index) => (
                <li key={index} className="flex items-start gap-2">
                  <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <span className="text-sm">{deliverable}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Contract Terms */}
      {deal.contract_terms && (
        <Card>
          <CardHeader>
            <CardTitle>Contract Terms</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{deal.contract_terms}</p>
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      {deal.payments && deal.payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>
              {deal.payments.length} payment{deal.payments.length !== 1 ? 's' : ''} received
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {deal.payments.map((payment) => {
                const paymentDate = new Date(payment.payment_date)
                return (
                  <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium">{formatCurrency(payment.amount)}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {paymentDate.toLocaleDateString()} • {payment.payment_method}
                      </p>
                      {payment.transaction_reference && (
                        <p className="text-xs text-muted-foreground">
                          Ref: {payment.transaction_reference}
                        </p>
                      )}
                    </div>
                    {payment.receipt_number && (
                      <Badge variant="outline">
                        Receipt #{payment.receipt_number}
                      </Badge>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {deal.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{deal.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Rejection Reason (if lost) */}
      {deal.deal_stage === 'lost' && deal.rejection_reason && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Rejection Reason</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{deal.rejection_reason}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default async function DealDetailPage({ params }: PageProps) {
  const { id } = await params

  return (
    <Suspense fallback={<DealDetailSkeleton />}>
      <DealDetail dealId={id} />
    </Suspense>
  )
}

function DealDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-[300px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[120px]" />
        ))}
      </div>

      <Skeleton className="h-[200px]" />

      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-[300px]" />
        <Skeleton className="h-[300px]" />
      </div>
    </div>
  )
}
