/**
 * Government Stakeholder Detail Page
 *
 * Displays detailed information about a specific government stakeholder
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Building,
  MapPin,
  Phone,
  Mail,
  Calendar,
  TrendingUp,
  FileText,
  FileCheck,
  Shield,
  Award,
  CheckCircle,
  Users,
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
  getGovernmentStakeholderById,
  getStakeholderContacts,
  getStakeholderInteractions,
  getStakeholderMous,
} from '@/lib/data/stakeholder'
import {
  StakeholderStatusBadge,
  HealthTierBadge,
  MouStatusBadge,
} from '@/components/stakeholders/status-badges'

interface GovernmentDetailPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: GovernmentDetailPageProps) {
  const { id } = await params
  const stakeholder = await getGovernmentStakeholderById(id)

  if (!stakeholder) {
    return {
      title: 'Government Stakeholder Not Found',
    }
  }

  return {
    title: stakeholder.official_name,
    description: `Manage ${stakeholder.official_name} stakeholder relationship`,
  }
}

async function GovernmentHeader({ stakeholderId }: { stakeholderId: string }) {
  const stakeholder = await getGovernmentStakeholderById(stakeholderId)

  if (!stakeholder) {
    notFound()
  }

  const stats = [
    {
      label: 'Department',
      value: stakeholder.department,
      icon: Building,
    },
    {
      label: 'Type',
      value: stakeholder.is_elected ? 'Elected' : 'Appointed',
      icon: Award,
    },
    {
      label: 'Status',
      value: stakeholder.status,
      icon: CheckCircle,
    },
    {
      label: 'Health Score',
      value: stakeholder.relationship_health_score?.current_score?.toFixed(0) || 'N/A',
      icon: TrendingUp,
    },
  ]

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/stakeholders/government">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">
                {stakeholder.official_name}
              </h1>
              <StakeholderStatusBadge status={stakeholder.status} />
              {stakeholder.relationship_health_score && (
                <HealthTierBadge tier={stakeholder.relationship_health_score.health_tier} />
              )}
            </div>
            <div className="flex items-center gap-4 mt-2 text-muted-foreground">
              <div className="flex items-center gap-1">
                <Shield className="h-4 w-4" />
                <span>{stakeholder.designation}</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span>
                  {stakeholder.city}, {stakeholder.state}
                </span>
              </div>
            </div>
          </div>
        </div>
        <Button asChild>
          <Link href={`/stakeholders/government/${stakeholder.id}/edit`}>
            Edit Official
          </Link>
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
                <div className="text-2xl font-bold capitalize truncate">{stat.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </>
  )
}

async function GovernmentInformation({ stakeholderId }: { stakeholderId: string }) {
  const stakeholder = await getGovernmentStakeholderById(stakeholderId)

  if (!stakeholder) {
    return null
  }

  return (
    <Card>
      <CardHeader className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-green-500/10">
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Official Information
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
              <p className="text-sm font-medium text-muted-foreground">Department</p>
              <p className="mt-1">{stakeholder.department}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Designation</p>
              <p className="mt-1">{stakeholder.designation}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Type</p>
              <div className="mt-1">
                {stakeholder.is_elected ? (
                  <Badge variant="secondary">Elected Official</Badge>
                ) : (
                  <Badge variant="outline">Appointed Official</Badge>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <div className="mt-1">
                <StakeholderStatusBadge status={stakeholder.status} />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Contact Information */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Contact Information
          </h3>
          <div className="space-y-3">
            {stakeholder.office_address && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Office Address</p>
                <p className="mt-1">{stakeholder.office_address}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">Location</p>
              <p className="mt-1">
                {stakeholder.city}, {stakeholder.state}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {stakeholder.email && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </p>
                  <a
                    href={`mailto:${stakeholder.email}`}
                    className="mt-1 text-blue-600 hover:underline block truncate"
                  >
                    {stakeholder.email}
                  </a>
                </div>
              )}
              {stakeholder.phone && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone
                  </p>
                  <a
                    href={`tel:${stakeholder.phone}`}
                    className="mt-1 text-blue-600 hover:underline"
                  >
                    {stakeholder.phone}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {/* Official Profile */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Official Profile
          </h3>
          {stakeholder.jurisdiction && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Jurisdiction</p>
              <p className="mt-1">{stakeholder.jurisdiction}</p>
            </div>
          )}
          {stakeholder.key_responsibilities && stakeholder.key_responsibilities.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Key Responsibilities
              </p>
              <div className="flex flex-wrap gap-2">
                {stakeholder.key_responsibilities.map((resp) => (
                  <Badge key={resp} variant="secondary">
                    {resp}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {stakeholder.decision_making_authority &&
            stakeholder.decision_making_authority.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Decision Making Authority
                </p>
                <div className="flex flex-wrap gap-2">
                  {stakeholder.decision_making_authority.map((auth) => (
                    <Badge key={auth} variant="outline">
                      {auth}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
        </div>

        <Separator />

        {/* Tenure Information */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Tenure Information
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            {stakeholder.appointment_date && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Appointment Date</p>
                <p className="mt-1">
                  {new Date(stakeholder.appointment_date).toLocaleDateString()}
                </p>
              </div>
            )}
            {stakeholder.tenure_end_date && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tenure End Date</p>
                <p className="mt-1">
                  {new Date(stakeholder.tenure_end_date).toLocaleDateString()}
                </p>
              </div>
            )}
            {stakeholder.term_duration && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Term Duration</p>
                <p className="mt-1">{stakeholder.term_duration}</p>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Collaboration & Support */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Collaboration & Support
          </h3>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="flex items-center gap-2">
              <CheckCircle
                className={`h-4 w-4 ${stakeholder.can_provide_permissions ? 'text-green-500' : 'text-gray-300'}`}
              />
              <span className="text-sm">
                {stakeholder.can_provide_permissions ? 'Provides' : 'No'} Permissions
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle
                className={`h-4 w-4 ${stakeholder.can_provide_funding ? 'text-green-500' : 'text-gray-300'}`}
              />
              <span className="text-sm">
                {stakeholder.can_provide_funding ? 'Provides' : 'No'} Funding
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle
                className={`h-4 w-4 ${stakeholder.can_provide_venue ? 'text-green-500' : 'text-gray-300'}`}
              />
              <span className="text-sm">
                {stakeholder.can_provide_venue ? 'Provides' : 'No'} Venue
              </span>
            </div>
          </div>

          {stakeholder.areas_of_support && stakeholder.areas_of_support.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Areas of Support</p>
              <div className="flex flex-wrap gap-2">
                {stakeholder.areas_of_support.map((area) => (
                  <Badge key={area} variant="secondary">
                    {area}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Operational Details */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Operational Details
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {stakeholder.best_time_to_meet && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Best Time to Meet</p>
                <p className="mt-1">{stakeholder.best_time_to_meet}</p>
              </div>
            )}
            {stakeholder.lead_time_required && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Lead Time Required</p>
                <p className="mt-1">{stakeholder.lead_time_required}</p>
              </div>
            )}
          </div>

          {stakeholder.protocol_requirements && stakeholder.protocol_requirements.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Protocol Requirements
              </p>
              <div className="flex flex-wrap gap-2">
                {stakeholder.protocol_requirements.map((protocol) => (
                  <Badge key={protocol} variant="outline">
                    {protocol}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {stakeholder.notes && (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Notes
              </h3>
              <p className="text-sm whitespace-pre-wrap">{stakeholder.notes}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

async function InteractionHistory({ stakeholderId }: { stakeholderId: string }) {
  const interactions = await getStakeholderInteractions(stakeholderId, 'government')

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
                  <TableHead>Purpose</TableHead>
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
                    <TableCell>{interaction.purpose || '-'}</TableCell>
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

async function MousList({ stakeholderId }: { stakeholderId: string }) {
  const mous = await getStakeholderMous(stakeholderId, 'government')

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
                    <h4 className="font-medium">{mou.title}</h4>
                    {mou.purpose && (
                      <p className="text-sm text-muted-foreground">{mou.purpose}</p>
                    )}
                  </div>
                  <MouStatusBadge status={mou.status} />
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Start Date</p>
                    <p className="font-medium">
                      {new Date(mou.start_date).toLocaleDateString()}
                    </p>
                  </div>
                  {mou.end_date && (
                    <div>
                      <p className="text-muted-foreground">End Date</p>
                      <p className="font-medium">
                        {new Date(mou.end_date).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>

                {mou.notes && (
                  <p className="text-sm text-muted-foreground border-t pt-3">{mou.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

async function ContactsSidebar({ stakeholderId }: { stakeholderId: string }) {
  const contacts = await getStakeholderContacts(stakeholderId, 'government')

  return (
    <Card>
      <CardHeader className="bg-gradient-to-r from-orange-500/10 to-pink-500/10">
        <CardTitle>Key Contacts</CardTitle>
        <CardDescription>People associated with this official</CardDescription>
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
                    {contact.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">{contact.name}</h4>
                    {contact.is_primary && (
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
                    {contact.phone && (
                      <div className="flex items-center gap-2 text-xs">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span>{contact.phone}</span>
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

export default async function GovernmentDetailPage({ params }: GovernmentDetailPageProps) {
  const { id } = await params

  return (
    <div className="flex flex-col gap-8">
      <Suspense fallback={<HeaderSkeleton />}>
        <GovernmentHeader stakeholderId={id} />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Suspense fallback={<ContentSkeleton />}>
            <GovernmentInformation stakeholderId={id} />
          </Suspense>

          <Suspense fallback={<ContentSkeleton />}>
            <InteractionHistory stakeholderId={id} />
          </Suspense>

          <Suspense fallback={<ContentSkeleton />}>
            <MousList stakeholderId={id} />
          </Suspense>
        </div>

        <div className="space-y-6">
          <Suspense fallback={<ContentSkeleton />}>
            <ContactsSidebar stakeholderId={id} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
