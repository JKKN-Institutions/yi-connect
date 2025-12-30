/**
 * Member Detail Page
 *
 * Display full member profile with skills, certifications, and metrics.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { MemberScoreDisplay } from '@/components/members'
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Linkedin,
  Edit,
  Users,
  ArrowLeft,
  Globe,
} from 'lucide-react'
import { notFound } from 'next/navigation'
import { MemberDetailClient } from './member-detail-client'
import { getMemberById, getSkills, getCertifications, calculateEngagementScores, calculateReadinessScores } from '@/lib/data/members'
import { getTrainerProfile } from '@/lib/data/trainers'
import { getMemberAssessment, getAvailableMentors } from '@/lib/data/assessments'
import { getVerticals } from '@/lib/data/vertical'
import { getMemberAvailability } from '@/lib/data/availability'

interface PageProps {
  params: Promise<{ id: string }>
}

// Provide placeholder ID for build-time validation with Cache Components
export async function generateStaticParams() {
  return [
    { id: '00000000-0000-0000-0000-000000000000' } // Placeholder UUID
  ];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'bg-green-500/10 text-green-700 dark:text-green-400',
    inactive: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
    suspended: 'bg-red-500/10 text-red-700 dark:text-red-400',
    alumni: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  }
  return colors[status] || colors.active
}

// Content component that fetches member data
async function MemberDetailContent({ id }: { id: string }) {
  // Fetch member data, trainer profile, assessment, and verticals in parallel
  const [member, trainerProfile, assessment] = await Promise.all([
    getMemberById(id),
    getTrainerProfile(id),
    getMemberAssessment(id),
  ])

  if (!member) {
    notFound()
  }

  // Fetch verticals, mentors, and availability (need chapter_id from member)
  const chapterId = member.chapter_id || ''
  // Get date range for availability (3 months)
  const today = new Date()
  const threeMonthsLater = new Date(today)
  threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3)
  const startDate = today.toISOString().split('T')[0]
  const endDate = threeMonthsLater.toISOString().split('T')[0]

  const [verticals, mentors, availabilities, skills, certifications, engagementScores, readinessScores] = await Promise.all([
    chapterId ? getVerticals({ chapter_id: chapterId }) : Promise.resolve([]),
    chapterId ? getAvailableMentors(chapterId) : Promise.resolve([]),
    getMemberAvailability(id, startDate, endDate),
    getSkills(),
    getCertifications(),
    calculateEngagementScores([id]),
    calculateReadinessScores([id]),
  ])

  // Get scores for this member (default to 0 if not calculated)
  const engagementScore = engagementScores.get(id) || 0
  const readinessScore = readinessScores.get(id) || 0

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link href="/members">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Members
        </Link>
      </Button>

      {/* Member Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={member.profile?.avatar_url || undefined} alt={member.profile?.full_name} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                  {getInitials(member.profile?.full_name || 'U')}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <div>
                  <h1 className="text-3xl font-bold">{member.profile?.full_name}</h1>
                  <p className="text-muted-foreground">
                    {member.designation && member.company
                      ? `${member.designation} at ${member.company}`
                      : member.company || member.designation || 'Yi Member'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className={getStatusColor(member.membership_status || 'active')}>
                    {member.membership_status || 'Active'}
                  </Badge>
                  {member.membership_number && (
                    <Badge variant="outline">{member.membership_number}</Badge>
                  )}
                  {member.chapter && (
                    <Badge variant="outline">
                      <MapPin className="h-3 w-3 mr-1" />
                      {member.chapter.name}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <Button asChild>
              <Link href={`/members/${member.id}/edit`}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Profile
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Score Display */}
      <MemberScoreDisplay
        engagementScore={engagementScore}
        readinessScore={readinessScore}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${member.profile?.email}`} className="text-primary hover:underline">
                {member.profile?.email}
              </a>
            </div>
            {member.profile?.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${member.profile.phone}`} className="text-primary hover:underline">
                  {member.profile.phone}
                </a>
              </div>
            )}
            {member.linkedin_url && (
              <div className="flex items-center gap-3 text-sm">
                <Linkedin className="h-4 w-4 text-muted-foreground" />
                <a
                  href={member.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  LinkedIn Profile
                </a>
              </div>
            )}
            <Separator />
            {member.address && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Address</p>
                <p className="text-sm text-muted-foreground">{member.address}</p>
                <p className="text-sm text-muted-foreground">
                  {[member.city, member.state, member.pincode, member.country]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Professional Information */}
        <Card>
          <CardHeader>
            <CardTitle>Professional Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {member.company && (
              <div className="flex items-center gap-3 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{member.company}</span>
              </div>
            )}
            {member.designation && (
              <div className="flex items-center gap-3 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{member.designation}</span>
              </div>
            )}
            {member.industry && (
              <div className="flex items-center gap-3 text-sm">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span>{member.industry}</span>
              </div>
            )}
            {member.years_of_experience && (
              <div className="text-sm">
                <span className="text-muted-foreground">Experience: </span>
                <span className="font-medium">{member.years_of_experience} years</span>
              </div>
            )}
            <Separator />
            {member.member_since && (
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  Member since {new Date(member.member_since).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Skills, Certifications, Trainer Profile & Assessment - Client Component */}
      <MemberDetailClient
        member={member}
        trainerProfile={trainerProfile}
        assessment={assessment}
        verticals={verticals}
        availableMentors={mentors}
        availabilities={availabilities}
        skills={skills}
        certifications={certifications}
        canEdit={true}
      />

      {/* Emergency Contact */}
      {(member.emergency_contact_name || member.emergency_contact_phone) && (
        <Card>
          <CardHeader>
            <CardTitle>Emergency Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {member.emergency_contact_name && (
              <div className="text-sm">
                <span className="text-muted-foreground">Name: </span>
                <span className="font-medium">{member.emergency_contact_name}</span>
              </div>
            )}
            {member.emergency_contact_phone && (
              <div className="text-sm">
                <span className="text-muted-foreground">Phone: </span>
                <a
                  href={`tel:${member.emergency_contact_phone}`}
                  className="font-medium text-primary hover:underline"
                >
                  {member.emergency_contact_phone}
                </a>
              </div>
            )}
            {member.emergency_contact_relationship && (
              <div className="text-sm">
                <span className="text-muted-foreground">Relationship: </span>
                <span className="font-medium">{member.emergency_contact_relationship}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {member.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{member.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Loading skeleton
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-32" />
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <Skeleton className="h-20 w-20 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-5 w-64" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  )
}

// Main page component with Suspense
export default async function MemberDetailPage({ params }: PageProps) {
  const resolvedParams = await params

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <MemberDetailContent id={resolvedParams.id} />
    </Suspense>
  )
}

// Note: Dynamic metadata generation will be added when data fetching is implemented
// For now, metadata is handled by the layout
