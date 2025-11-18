/**
 * NGO Detail Page
 *
 * Displays detailed information about a specific NGO stakeholder
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Heart,
  MapPin,
  Users,
  Phone,
  Mail,
  Globe,
  Calendar,
  TrendingUp,
  FileText,
  FileCheck,
  Award,
  Briefcase,
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
  getNGOById,
  getStakeholderContacts,
  getStakeholderInteractions,
  getStakeholderMous,
} from '@/lib/data/stakeholder'
import {
  StakeholderStatusBadge,
  HealthTierBadge,
  MouStatusBadge,
} from '@/components/stakeholders/status-badges'

interface NGODetailPageProps {
  params: Promise<{ id: string }>
}

// Static metadata to avoid issues with dynamic data access
export const metadata = {
  title: 'NGO Details | Yi Connect',
  description: 'View and manage NGO stakeholder relationship',
}

async function NGOHeader({ ngoId }: { ngoId: string }) {
  const ngo = await getNGOById(ngoId)

  if (!ngo) {
    notFound()
  }

  const stats = [
    {
      label: 'Team Size',
      value: ngo.team_size || 'N/A',
      icon: Users,
    },
    {
      label: 'Geographic Reach',
      value: ngo.geographic_reach || 'N/A',
      icon: MapPin,
    },
    {
      label: 'Registration Status',
      value: ngo.is_registered ? 'Registered' : 'Not Registered',
      icon: Award,
    },
    {
      label: 'Health Score',
      value: ngo.health_score?.overall_score?.toFixed(0) || 'N/A',
      icon: TrendingUp,
    },
  ]

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/stakeholders/ngos">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">
                {ngo.ngo_name}
              </h1>
              <StakeholderStatusBadge status={ngo.status} />
              {ngo.health_score && (
                <HealthTierBadge tier={ngo.health_score.health_tier} />
              )}
            </div>
            <div className="flex items-center gap-4 mt-2 text-muted-foreground">
              <div className="flex items-center gap-1">
                <Heart className="h-4 w-4" />
                <span>{ngo.is_registered ? 'Registered NGO' : 'Unregistered'}</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span>
                  {ngo.city}, {ngo.state}
                </span>
              </div>
              {ngo.website && (
                <a
                  href={ngo.website}
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
          <Link href={`/stakeholders/ngos/${ngo.id}/edit`}>Edit NGO</Link>
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

async function NGOInformation({ ngoId }: { ngoId: string }) {
  const ngo = await getNGOById(ngoId)

  if (!ngo) {
    return null
  }

  return (
    <Card>
      <CardHeader className="bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10">
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5" />
          NGO Information
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Basic Information
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Registration Number</p>
              <p className="mt-1">{ngo.registration_number || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <div className="mt-1">
                <StakeholderStatusBadge status={ngo.status} />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            NGO Profile
          </h3>
          {ngo.focus_areas && ngo.focus_areas.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Focus Areas</p>
              <div className="flex flex-wrap gap-2">
                {ngo.focus_areas.map((area) => (
                  <Badge key={area} variant="secondary">
                    {area}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {ngo.target_beneficiaries && ngo.target_beneficiaries.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Target Beneficiaries</p>
              <div className="flex flex-wrap gap-2">
                {ngo.target_beneficiaries.map((beneficiary) => (
                  <Badge key={beneficiary} variant="outline">
                    {beneficiary}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {ngo.is_registered && (
          <>
            <Separator />
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Registration Details
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {ngo.registration_type && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Registration Type</p>
                    <p className="mt-1 capitalize">{ngo.registration_type}</p>
                  </div>
                )}
                {ngo.tax_exemption_status && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tax Exemption</p>
                    <p className="mt-1">{ngo.tax_exemption_status}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <Separator />

        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Partnership & Resources
          </h3>
          {ngo.collaboration_areas && ngo.collaboration_areas.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Collaboration Areas</p>
              <div className="flex flex-wrap gap-2">
                {ngo.collaboration_areas.map((area) => (
                  <Badge key={area} variant="secondary">
                    {area}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {ngo.resources_they_can_provide && ngo.resources_they_can_provide.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Resources They Provide</p>
              <div className="flex flex-wrap gap-2">
                {ngo.resources_they_can_provide.map((resource) => (
                  <Badge key={resource} variant="outline">
                    {resource}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {ngo.resources_they_need && ngo.resources_they_need.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Resources They Need</p>
              <div className="flex flex-wrap gap-2">
                {ngo.resources_they_need.map((resource) => (
                  <Badge key={resource} variant="destructive">
                    {resource}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {ngo.notes && (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Notes
              </h3>
              <p className="text-sm whitespace-pre-wrap">{ngo.notes}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

async function InteractionHistory({ ngoId }: { ngoId: string }) {
  const interactions = await getStakeholderInteractions(ngoId, 'ngo')

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

async function MousList({ ngoId }: { ngoId: string }) {
  const mous = await getStakeholderMous(ngoId, 'ngo')

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

async function ContactsSidebar({ ngoId }: { ngoId: string }) {
  const contacts = await getStakeholderContacts(ngoId, 'ngo')

  return (
    <Card>
      <CardHeader className="bg-gradient-to-r from-orange-500/10 to-pink-500/10">
        <CardTitle>Key Contacts</CardTitle>
        <CardDescription>People associated with this NGO</CardDescription>
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

async function NGODetailContent({ params }: NGODetailPageProps) {
  const { id } = await params

  return (
    <div className="flex flex-col gap-8">
      <Suspense fallback={<HeaderSkeleton />}>
        <NGOHeader ngoId={id} />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Suspense fallback={<ContentSkeleton />}>
            <NGOInformation ngoId={id} />
          </Suspense>

          <Suspense fallback={<ContentSkeleton />}>
            <InteractionHistory ngoId={id} />
          </Suspense>

          <Suspense fallback={<ContentSkeleton />}>
            <MousList ngoId={id} />
          </Suspense>
        </div>

        <div className="space-y-6">
          <Suspense fallback={<ContentSkeleton />}>
            <ContactsSidebar ngoId={id} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

export default function NGODetailPage({ params }: NGODetailPageProps) {
  return (
    <Suspense fallback={<div className="p-8"><ContentSkeleton /></div>}>
      <NGODetailContent params={params} />
    </Suspense>
  )
}
