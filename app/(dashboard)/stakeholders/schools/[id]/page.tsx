/**
 * School Detail Page
 *
 * Display comprehensive school information with contacts, interactions, MoUs, and health metrics
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Edit,
  MapPin,
  Users,
  Building2,
  Phone,
  Mail,
  Calendar,
  FileText,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  StakeholderStatusBadge,
  HealthTierBadge,
  MouStatusBadge,
  InteractionOutcomeBadge,
} from '@/components/stakeholders/status-badges'
import { getSchoolById } from '@/lib/data/stakeholder'

interface PageProps {
  params: Promise<{ id: string }>
}

// Provide placeholder ID for build-time validation
export async function generateStaticParams() {
  return [{ id: '00000000-0000-0000-0000-000000000000' }]
}

async function SchoolDetail({ schoolId }: { schoolId: string }) {
  const school = await getSchoolById(schoolId)

  if (!school) {
    notFound()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/stakeholders/schools">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{school.school_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground capitalize">
                {school.school_type.replace('_', ' ')}
              </span>
              <Separator orientation="vertical" className="h-4" />
              <StakeholderStatusBadge status={school.status} />
            </div>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href={`/stakeholders/schools/${school.id}/edit`}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {school.total_students?.toLocaleString() || '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {school.grade_range || 'All grades'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {school.health_score ? (
              <>
                <div className="text-2xl font-bold">
                  {school.health_score.overall_score.toFixed(0)}/100
                </div>
                <div className="mt-1">
                  <HealthTierBadge tier={school.health_score.health_tier} />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No data yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Interactions</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{school.interactions.length}</div>
            <p className="text-xs text-muted-foreground">
              {school.health_score?.last_interaction_date
                ? `Last: ${new Date(school.health_score.last_interaction_date).toLocaleDateString()}`
                : 'No interactions yet'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MoU Status</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{school.mous.length}</div>
            {school.mous[0] ? (
              <div className="mt-1">
                <MouStatusBadge status={school.mous[0].mou_status} />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No MoU</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* School Information */}
        <Card>
          <CardHeader>
            <CardTitle>School Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Address</p>
              <div className="flex items-start gap-2 mt-1">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="text-sm">
                  {school.address_line1 && <div>{school.address_line1}</div>}
                  {school.address_line2 && <div>{school.address_line2}</div>}
                  <div>
                    {school.city}, {school.state}
                    {school.pincode && ` - ${school.pincode}`}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {school.medium && school.medium.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Medium of Instruction</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {school.medium.map((m) => (
                    <Badge key={m} variant="secondary">
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Facilities</p>
                <div className="space-y-1 mt-1 text-sm">
                  {school.has_auditorium && <div>✓ Auditorium</div>}
                  {school.has_smart_class && <div>✓ Smart Class</div>}
                  {school.has_ground && <div>✓ Playground</div>}
                  {school.has_library && <div>✓ Library</div>}
                  {!school.has_auditorium &&
                    !school.has_smart_class &&
                    !school.has_ground &&
                    !school.has_library && (
                      <span className="text-muted-foreground">No data</span>
                    )}
                </div>
              </div>

              {school.decision_maker && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Decision Maker</p>
                  <p className="text-sm mt-1">{school.decision_maker}</p>
                </div>
              )}
            </div>

            {school.suitable_programs && school.suitable_programs.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Suitable Yi Programs</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {school.suitable_programs.map((program) => (
                    <Badge key={program} variant="outline">
                      {program}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {school.notes && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Notes</p>
                <p className="text-sm mt-1 whitespace-pre-wrap">{school.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contacts */}
        <Card>
          <CardHeader>
            <CardTitle>Contacts</CardTitle>
            <CardDescription>
              {school.contacts.length} contact{school.contacts.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {school.contacts.length > 0 ? (
              <div className="space-y-4">
                {school.contacts.map((contact) => (
                  <div key={contact.id} className="border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{contact.contact_name}</p>
                        {contact.designation && (
                          <p className="text-sm text-muted-foreground">{contact.designation}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {contact.is_primary_contact && (
                          <Badge variant="secondary" className="text-xs">
                            Primary
                          </Badge>
                        )}
                        {contact.is_decision_maker && (
                          <Badge variant="secondary" className="text-xs">
                            Decision Maker
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 space-y-1 text-sm">
                      {contact.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <a href={`mailto:${contact.email}`} className="hover:underline">
                            {contact.email}
                          </a>
                        </div>
                      )}
                      {contact.phone_primary && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <a href={`tel:${contact.phone_primary}`} className="hover:underline">
                            {contact.phone_primary}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No contacts added yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Interactions Timeline */}
      {school.interactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Interaction Timeline</CardTitle>
            <CardDescription>
              {school.interactions.length} interaction{school.interactions.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {school.interactions.slice(0, 10).map((interaction) => {
                const date = new Date(interaction.interaction_date)

                return (
                  <div key={interaction.id} className="flex gap-4 border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex-shrink-0">
                      <div className="w-12 text-center">
                        <div className="text-sm font-medium">{date.getDate()}</div>
                        <div className="text-xs text-muted-foreground">
                          {date.toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {interaction.interaction_type.replace('_', ' ')}
                        </Badge>
                        <InteractionOutcomeBadge outcome={interaction.outcome} />
                      </div>
                      <p className="text-sm mt-2">{interaction.summary}</p>
                      {interaction.next_steps && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          <strong>Next steps:</strong> {interaction.next_steps}
                        </div>
                      )}
                      {interaction.led_by?.profiles && (
                        <p className="text-xs text-muted-foreground mt-2">
                          By {interaction.led_by.profiles.full_name}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* MoUs */}
      {school.mous.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Memorandum of Understanding</CardTitle>
            <CardDescription>
              {school.mous.length} MoU{school.mous.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {school.mous.map((mou) => (
                <div key={mou.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{mou.mou_title}</p>
                      <div className="mt-1">
                        <MouStatusBadge status={mou.mou_status} />
                      </div>
                    </div>
                    {mou.document_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={mou.document_url} target="_blank" rel="noopener noreferrer">
                          <FileText className="mr-2 h-4 w-4" />
                          View
                        </a>
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                    {mou.signed_date && (
                      <div>
                        <p className="text-muted-foreground">Signed Date</p>
                        <p>{new Date(mou.signed_date).toLocaleDateString()}</p>
                      </div>
                    )}
                    {mou.valid_to && (
                      <div>
                        <p className="text-muted-foreground">Valid Until</p>
                        <p>{new Date(mou.valid_to).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                  {mou.scope_of_collaboration && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-muted-foreground">Scope</p>
                      <p className="text-sm mt-1">{mou.scope_of_collaboration}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default async function SchoolDetailPage({ params }: PageProps) {
  const { id } = await params

  return (
    <Suspense fallback={<SchoolDetailSkeleton />}>
      <SchoolDetail schoolId={id} />
    </Suspense>
  )
}

function SchoolDetailSkeleton() {
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
        <Skeleton className="h-10 w-24" />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[120px]" />
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-[400px]" />
        <Skeleton className="h-[400px]" />
      </div>
    </div>
  )
}
