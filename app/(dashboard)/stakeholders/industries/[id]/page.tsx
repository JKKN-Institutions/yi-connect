/**
 * Industry Detail Page
 *
 * Displays detailed information about a specific industry stakeholder
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Building,
  MapPin,
  Users,
  Phone,
  Mail,
  Globe,
  Calendar,
  TrendingUp,
  FileText,
  FileCheck,
  Factory,
  Award,
  Briefcase,
  DollarSign,
  GraduationCap,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  getIndustryById,
  getStakeholderContacts,
  getStakeholderInteractions,
  getStakeholderMous,
} from '@/lib/data/stakeholder'
import {
  StakeholderStatusBadge,
  HealthTierBadge,
  MouStatusBadge,
} from '@/components/stakeholders/status-badges'
import { requireRole } from '@/lib/auth'

interface IndustryDetailPageProps {
  params: Promise<{ id: string }>
}

// Static metadata to avoid issues with dynamic data access
export const metadata = {
  title: 'Industry Details | Yi Connect',
  description: 'View and manage industry stakeholder relationship',
}

async function IndustryHeader({ industryId }: { industryId: string }) {
  const industry = await getIndustryById(industryId)

  if (!industry) {
    notFound()
  }

  const stats = [
    {
      label: 'Organization Size',
      value: industry.organization_size || 'N/A',
      icon: Building,
    },
    {
      label: 'Employee Count',
      value: industry.employee_count?.toLocaleString() || 'N/A',
      icon: Users,
    },
    {
      label: 'CSR Program',
      value: industry.has_csr_program ? 'Yes' : 'No',
      icon: Award,
    },
    {
      label: 'Health Score',
      value: industry.health_score?.overall_score?.toFixed(0) || 'N/A',
      icon: TrendingUp,
    },
  ]

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/stakeholders/industries">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">
                {industry.organization_name}
              </h1>
              <StakeholderStatusBadge status={industry.status} />
              {industry.health_score && (
                <HealthTierBadge tier={industry.health_score.health_tier} />
              )}
            </div>
            <div className="flex items-center gap-4 mt-2 text-muted-foreground">
              <div className="flex items-center gap-1">
                <Factory className="h-4 w-4" />
                <span className="capitalize">
                  {industry.industry_sector.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span>
                  {industry.city}, {industry.state}
                </span>
              </div>
              {industry.website && (
                <a
                  href={industry.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:underline"
                >
                  <Globe className="h-4 w-4" />
                  <span>Website</span>
                </a>
              )}
            </div>
          </div>
        </div>
        <Button asChild>
          <Link href={`/stakeholders/industries/${industry.id}/edit`}>Edit Industry</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold capitalize">{stat.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </>
  )
}

async function IndustryInformation({ industryId }: { industryId: string }) {
  const industry = await getIndustryById(industryId)

  if (!industry) {
    return null
  }

  return (
    <Card>
      <CardHeader className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-orange-500/10">
        <CardTitle className="flex items-center gap-2">
          <Factory className="h-5 w-5" />
          Industry Information
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Basic Information
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Industry Sector</p>
              <p className="mt-1 capitalize">
                {industry.industry_sector.replace('_', ' ')}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <div className="mt-1">
                <StakeholderStatusBadge status={industry.status} />
              </div>
            </div>
            {industry.website && (
              <div className="md:col-span-2">
                <p className="text-sm font-medium text-muted-foreground">Website</p>
                <a
                  href={industry.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Globe className="h-4 w-4" />
                  {industry.website}
                </a>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Address */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Address
          </h3>
          <div className="space-y-1">
            {industry.address_line1 && <p>{industry.address_line1}</p>}
            {industry.address_line2 && <p>{industry.address_line2}</p>}
            <p>
              {industry.city}, {industry.state} {industry.pincode || ''}
            </p>
          </div>
        </div>

        <Separator />

        {/* Organization Profile */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Organization Profile
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            {industry.organization_size && (
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Organization Size
                </p>
                <p className="mt-1 text-lg font-semibold capitalize">
                  {industry.organization_size}
                </p>
              </div>
            )}
            {industry.employee_count && (
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Employee Count
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {industry.employee_count.toLocaleString()}
                </p>
              </div>
            )}
            {industry.annual_turnover && (
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Annual Turnover
                </p>
                <p className="mt-1 text-lg font-semibold">{industry.annual_turnover}</p>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* CSR & Sponsorship */}
        {industry.has_csr_program && (
          <>
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Award className="h-4 w-4" />
                CSR & Sponsorship
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {industry.csr_budget_range && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      CSR Budget Range
                    </p>
                    <p className="mt-1">{industry.csr_budget_range}</p>
                  </div>
                )}
                {industry.sponsorship_potential && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Sponsorship Potential
                    </p>
                    <p className="mt-1 capitalize">{industry.sponsorship_potential}</p>
                  </div>
                )}
              </div>

              {industry.csr_focus_areas && industry.csr_focus_areas.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    CSR Focus Areas
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {industry.csr_focus_areas.map((area) => (
                      <Badge key={area} variant="secondary">
                        {area}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Separator />
          </>
        )}

        {/* Collaboration Opportunities */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Collaboration Opportunities
          </h3>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {industry.can_provide_internships
                  ? 'Provides Internships'
                  : 'No Internships'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {industry.can_provide_mentorship
                  ? 'Provides Mentorship'
                  : 'No Mentorship'}
              </span>
            </div>
          </div>

          {industry.collaboration_interests && industry.collaboration_interests.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Collaboration Interests
              </p>
              <div className="flex flex-wrap gap-2">
                {industry.collaboration_interests.map((interest) => (
                  <Badge key={interest} variant="secondary">
                    {interest}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {industry.available_resources && industry.available_resources.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Available Resources
              </p>
              <div className="flex flex-wrap gap-2">
                {industry.available_resources.map((resource) => (
                  <Badge key={resource} variant="outline">
                    {resource}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Connection & Operational Details */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Connection & Operational Details
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {industry.connection_type && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Connection Type
                </p>
                <p className="mt-1 capitalize">
                  {industry.connection_type.replace('_', ' ')}
                </p>
              </div>
            )}
            {industry.decision_maker && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Decision Maker
                </p>
                <p className="mt-1">{industry.decision_maker}</p>
              </div>
            )}
            {industry.procurement_process && (
              <div className="md:col-span-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Procurement Process
                </p>
                <p className="mt-1 text-sm">{industry.procurement_process}</p>
              </div>
            )}
            {industry.lead_time_required && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Lead Time Required
                </p>
                <p className="mt-1">{industry.lead_time_required}</p>
              </div>
            )}
          </div>
        </div>

        {industry.notes && (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Notes
              </h3>
              <p className="text-sm whitespace-pre-wrap">{industry.notes}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

async function InteractionHistory({ industryId }: { industryId: string }) {
  const interactions = await getStakeholderInteractions(industryId, 'industry')

  return (
    <Card>
      <CardHeader className="bg-gradient-to-r from-blue-500/10 to-purple-500/10">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Interaction History
        </CardTitle>
        <CardDescription>Recent interactions and engagements</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        {interactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No interactions recorded yet</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Outcome</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {interactions.slice(0, 5).map((interaction) => (
                  <TableRow key={interaction.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {new Date(interaction.interaction_date).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">
                      {interaction.interaction_type.replace('_', ' ')}
                    </TableCell>
                    <TableCell>{interaction.summary || '-'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          interaction.outcome === 'positive'
                            ? 'default'
                            : interaction.outcome === 'negative'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {interaction.outcome}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

async function MousList({ industryId }: { industryId: string }) {
  const mous = await getStakeholderMous(industryId, 'industry')

  return (
    <Card>
      <CardHeader className="bg-gradient-to-r from-teal-500/10 to-blue-500/10">
        <CardTitle className="flex items-center gap-2">
          <FileCheck className="h-5 w-5" />
          Memorandums of Understanding
        </CardTitle>
        <CardDescription>Active and historical MoUs</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        {mous.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No MoUs recorded yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {mous.map((mou) => (
              <div
                key={mou.id}
                className="border rounded-lg p-4 space-y-3 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h4 className="font-medium">{mou.mou_title}</h4>
                    {mou.scope_of_collaboration && (
                      <p className="text-sm text-muted-foreground">{mou.scope_of_collaboration}</p>
                    )}
                  </div>
                  <MouStatusBadge status={mou.mou_status} />
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Start Date</p>
                    <p className="font-medium">
                      {mou.valid_from ? new Date(mou.valid_from).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  {mou.valid_to && (
                    <div>
                      <p className="text-muted-foreground">End Date</p>
                      <p className="font-medium">
                        {new Date(mou.valid_to).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

async function ContactsSidebar({ industryId }: { industryId: string }) {
  const contacts = await getStakeholderContacts(industryId, 'industry')

  return (
    <Card>
      <CardHeader className="bg-gradient-to-r from-orange-500/10 to-pink-500/10">
        <CardTitle>Key Contacts</CardTitle>
        <CardDescription>People associated with this industry</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        {contacts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">No contacts added yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {contact.contact_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">{contact.contact_name}</h4>
                    {contact.is_primary_contact && (
                      <Badge variant="secondary" className="text-xs">
                        Primary
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{contact.designation}</p>
                  <div className="space-y-1 pt-1">
                    {contact.email && (
                      <div className="flex items-center gap-2 text-xs">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate">{contact.email}</span>
                      </div>
                    )}
                    {contact.phone_primary && (
                      <div className="flex items-center gap-2 text-xs">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span>{contact.phone_primary}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function HeaderSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-[300px]" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-[100px]" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[60px]" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function ContentSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-[200px]" />
      </CardHeader>
      <CardContent className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </CardContent>
    </Card>
  )
}

async function IndustryDetailContent({ params }: IndustryDetailPageProps) {
  const { id } = await params

  return (
    <div className="flex flex-col gap-8">
      <Suspense fallback={<HeaderSkeleton />}>
        <IndustryHeader industryId={id} />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Suspense fallback={<ContentSkeleton />}>
            <IndustryInformation industryId={id} />
          </Suspense>

          <Suspense fallback={<ContentSkeleton />}>
            <InteractionHistory industryId={id} />
          </Suspense>

          <Suspense fallback={<ContentSkeleton />}>
            <MousList industryId={id} />
          </Suspense>
        </div>

        <div className="space-y-6">
          <Suspense fallback={<ContentSkeleton />}>
            <ContactsSidebar industryId={id} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

export default async function IndustryDetailPage({ params }: IndustryDetailPageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']);

  return (
    <Suspense fallback={<div className="p-8"><ContentSkeleton /></div>}>
      <IndustryDetailContent params={params} />
    </Suspense>
  )
}
