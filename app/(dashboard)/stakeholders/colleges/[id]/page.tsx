/**
 * College Detail Page
 *
 * Displays detailed information about a specific college stakeholder
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Building,
  MapPin,
  Users,
  UserCheck,
  Phone,
  Mail,
  Globe,
  Calendar,
  TrendingUp,
  FileText,
  FileCheck,
  GraduationCap,
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
  getCollegeById,
  getStakeholderContacts,
  getStakeholderInteractions,
  getStakeholderMous,
} from '@/lib/data/stakeholder'
import {
  StakeholderStatusBadge,
  HealthTierBadge,
  MouStatusBadge,
} from '@/components/stakeholders/status-badges'

interface CollegeDetailPageProps {
  params: Promise<{ id: string }>
}

// Static metadata to avoid issues with dynamic data access
export const metadata = {
  title: 'College Details | Yi Connect',
  description: 'View and manage college stakeholder relationship',
}

async function CollegeHeader({ collegeId }: { collegeId: string }) {
  const college = await getCollegeById(collegeId)

  if (!college) {
    notFound()
  }

  const stats = [
    {
      label: 'Total Students',
      value: college.total_students?.toLocaleString() || 'N/A',
      icon: Users,
    },
    {
      label: 'Total Staff',
      value: college.total_staff?.toLocaleString() || 'N/A',
      icon: UserCheck,
    },
    {
      label: 'Departments',
      value: college.departments?.length || 0,
      icon: Building,
    },
    {
      label: 'Health Score',
      value: college.health_score?.overall_score?.toFixed(0) || 'N/A',
      icon: TrendingUp,
    },
  ]

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/stakeholders/colleges">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">
                {college.college_name}
              </h1>
              <StakeholderStatusBadge status={college.status} />
              {college.health_score && (
                <HealthTierBadge tier={college.health_score.health_tier} />
              )}
            </div>
            <div className="flex items-center gap-4 mt-2 text-muted-foreground">
              <div className="flex items-center gap-1">
                <Building className="h-4 w-4" />
                <span className="capitalize">
                  {college.college_type.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span>
                  {college.city}, {college.state}
                </span>
              </div>
            </div>
          </div>
        </div>
        <Button asChild>
          <Link href={`/stakeholders/colleges/${college.id}/edit`}>Edit College</Link>
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
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </>
  )
}

async function CollegeInformation({ collegeId }: { collegeId: string }) {
  const college = await getCollegeById(collegeId)

  if (!college) {
    return null
  }

  return (
    <Card>
      <CardHeader className="bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-teal-500/10">
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          College Information
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
              <p className="text-sm font-medium text-muted-foreground">College Type</p>
              <p className="mt-1 capitalize">
                {college.college_type.replace('_', ' ')}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <div className="mt-1">
                <StakeholderStatusBadge status={college.status} />
              </div>
            </div>
            {college.university_affiliation && (
              <div className="md:col-span-2">
                <p className="text-sm font-medium text-muted-foreground">
                  University Affiliation
                </p>
                <p className="mt-1">{college.university_affiliation}</p>
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
            <p>{college.address_line1}</p>
            {college.address_line2 && <p>{college.address_line2}</p>}
            <p>
              {college.city}, {college.state} {college.pincode}
            </p>
          </div>
        </div>

        <Separator />

        {/* College Profile */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            College Profile
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total Students
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {college.total_students?.toLocaleString() || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Total Staff
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {college.total_staff?.toLocaleString() || 'N/A'}
              </p>
            </div>
          </div>

          {college.departments && college.departments.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Departments</p>
              <div className="flex flex-wrap gap-2">
                {college.departments.map((dept) => (
                  <Badge key={dept} variant="secondary">
                    {dept}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {college.accreditation && college.accreditation.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <Award className="h-4 w-4" />
                Accreditation
              </p>
              <div className="flex flex-wrap gap-2">
                {college.accreditation.map((acc) => (
                  <Badge key={acc} variant="outline">
                    {acc}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Yuva Chapter Information */}
        {college.has_yuva_chapter && (
          <>
            <Separator />
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Yuva Chapter Information
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {college.yuva_chapter_strength && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Chapter Strength
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {college.yuva_chapter_strength} members
                    </p>
                  </div>
                )}
                {college.yuva_chapter_status && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Chapter Status
                    </p>
                    <p className="mt-1 capitalize">
                      {college.yuva_chapter_status.replace('_', ' ')}
                    </p>
                  </div>
                )}
                {college.yuva_president_name && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      President Name
                    </p>
                    <p className="mt-1">{college.yuva_president_name}</p>
                  </div>
                )}
                {college.yuva_president_contact && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      President Contact
                    </p>
                    <p className="mt-1">{college.yuva_president_contact}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Collaboration Opportunities */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Collaboration Opportunities
          </h3>

          {college.suitable_activities && college.suitable_activities.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Suitable Activities
              </p>
              <div className="flex flex-wrap gap-2">
                {college.suitable_activities.map((activity) => (
                  <Badge key={activity} variant="secondary">
                    {activity}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {college.available_resources && college.available_resources.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Available Resources
              </p>
              <div className="flex flex-wrap gap-2">
                {college.available_resources.map((resource) => (
                  <Badge key={resource} variant="outline">
                    {resource}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Connection Details */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Connection & Operational Details
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {college.connection_type && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Connection Type
                </p>
                <p className="mt-1 capitalize">
                  {college.connection_type.replace('_', ' ')}
                </p>
              </div>
            )}
            {college.decision_maker && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Decision Maker
                </p>
                <p className="mt-1">{college.decision_maker}</p>
              </div>
            )}
            {college.decision_making_process && (
              <div className="md:col-span-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Decision Making Process
                </p>
                <p className="mt-1 text-sm">{college.decision_making_process}</p>
              </div>
            )}
            {college.lead_time_required && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Lead Time Required
                </p>
                <p className="mt-1">{college.lead_time_required}</p>
              </div>
            )}
          </div>
        </div>

        {college.notes && (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Notes
              </h3>
              <p className="text-sm whitespace-pre-wrap">{college.notes}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

async function InteractionHistory({ collegeId }: { collegeId: string }) {
  const interactions = await getStakeholderInteractions(collegeId, 'college')

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

async function MousList({ collegeId }: { collegeId: string }) {
  const mous = await getStakeholderMous(collegeId, 'college')

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

async function ContactsSidebar({ collegeId }: { collegeId: string }) {
  const contacts = await getStakeholderContacts(collegeId, 'college')

  return (
    <Card>
      <CardHeader className="bg-gradient-to-r from-orange-500/10 to-pink-500/10">
        <CardTitle>Key Contacts</CardTitle>
        <CardDescription>People associated with this college</CardDescription>
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

async function CollegeDetailContent({ params }: CollegeDetailPageProps) {
  const { id } = await params

  return (
    <div className="flex flex-col gap-8">
      <Suspense fallback={<HeaderSkeleton />}>
        <CollegeHeader collegeId={id} />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Suspense fallback={<ContentSkeleton />}>
            <CollegeInformation collegeId={id} />
          </Suspense>

          <Suspense fallback={<ContentSkeleton />}>
            <InteractionHistory collegeId={id} />
          </Suspense>

          <Suspense fallback={<ContentSkeleton />}>
            <MousList collegeId={id} />
          </Suspense>
        </div>

        <div className="space-y-6">
          <Suspense fallback={<ContentSkeleton />}>
            <ContactsSidebar collegeId={id} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

export default function CollegeDetailPage({ params }: CollegeDetailPageProps) {
  return (
    <Suspense fallback={<div className="p-8"><HeaderSkeleton /></div>}>
      <CollegeDetailContent params={params} />
    </Suspense>
  )
}
