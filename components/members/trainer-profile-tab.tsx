/**
 * Trainer Profile Tab Component
 *
 * Displays trainer profile information including eligibility,
 * session stats, certifications, and preferences.
 */

'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  GraduationCap,
  Award,
  Users,
  Calendar,
  Star,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Target,
} from 'lucide-react'
import type { TrainerProfileFull, TrainerDistributionStatus } from '@/types/trainer'
import { AGE_GROUP_LABELS } from '@/types/trainer'

interface TrainerProfileTabProps {
  trainerProfile: TrainerProfileFull | null
  memberId: string
  onCreateProfile?: () => void
}

function getDistributionStatusInfo(status: TrainerDistributionStatus | null) {
  const statusMap: Record<TrainerDistributionStatus, { label: string; color: string; icon: React.ReactNode }> = {
    active: {
      label: 'Active',
      color: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    inactive: {
      label: 'Inactive',
      color: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20',
      icon: <XCircle className="h-3 w-3" />,
    },
    on_leave: {
      label: 'On Leave',
      color: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
      icon: <Clock className="h-3 w-3" />,
    },
    maxed_out: {
      label: 'Maxed Out',
      color: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
      icon: <AlertTriangle className="h-3 w-3" />,
    },
  }

  if (!status) {
    return {
      label: 'Not Set',
      color: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
      icon: null,
    }
  }

  return statusMap[status]
}

function StatCard({
  title,
  value,
  icon,
  description,
  trend,
}: {
  title: string
  value: string | number
  icon: React.ReactNode
  description?: string
  trend?: { value: number; label: string }
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{title}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">{value}</span>
        {trend && (
          <span
            className={`text-xs ${
              trend.value >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {trend.value >= 0 ? '+' : ''}
            {trend.value} {trend.label}
          </span>
        )}
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  )
}

export function TrainerProfileTab({
  trainerProfile,
  memberId,
  onCreateProfile,
}: TrainerProfileTabProps) {
  // If no trainer profile exists, show prompt to create one
  if (!trainerProfile) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">No Trainer Profile</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                This member doesn't have a trainer profile yet. Create one to enable them to conduct sessions.
              </p>
            </div>
            {onCreateProfile && (
              <Button onClick={onCreateProfile}>
                <GraduationCap className="h-4 w-4 mr-2" />
                Create Trainer Profile
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const statusInfo = getDistributionStatusInfo(trainerProfile.distribution_status)
  const expiringCerts = trainerProfile.certifications?.filter(c => c.is_expiring_soon) || []

  return (
    <div className="space-y-6">
      {/* Trainer Status Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <GraduationCap className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <CardTitle>Trainer Profile</CardTitle>
                <CardDescription>Session trainer eligibility and statistics</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {trainerProfile.is_trainer_eligible ? (
                <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Eligible
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-gray-500/10">
                  <XCircle className="h-3 w-3 mr-1" />
                  Not Eligible
                </Badge>
              )}
              <Badge variant="outline" className={statusInfo.color}>
                {statusInfo.icon && <span className="mr-1">{statusInfo.icon}</span>}
                {statusInfo.label}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <StatCard
              title="Total Sessions"
              value={trainerProfile.total_sessions}
              icon={<Calendar className="h-4 w-4" />}
              description={`${trainerProfile.sessions_this_month} this month`}
            />
            <StatCard
              title="Students Impacted"
              value={trainerProfile.total_students_impacted.toLocaleString()}
              icon={<Users className="h-4 w-4" />}
            />
            <StatCard
              title="Average Rating"
              value={trainerProfile.average_rating?.toFixed(1) || '-'}
              icon={<Star className="h-4 w-4" />}
              description="Out of 5.0"
            />
            <StatCard
              title="Days Since Last Session"
              value={trainerProfile.days_since_last_session ?? '-'}
              icon={<Clock className="h-4 w-4" />}
              description={
                trainerProfile.last_session_date
                  ? `Last: ${new Date(trainerProfile.last_session_date).toLocaleDateString()}`
                  : 'No sessions yet'
              }
            />
          </div>

          {/* Monthly Progress */}
          {trainerProfile.max_sessions_per_month && (
            <>
              <Separator className="my-6" />
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Monthly Sessions</span>
                  <span className="font-medium">
                    {trainerProfile.sessions_this_month} / {trainerProfile.max_sessions_per_month}
                  </span>
                </div>
                <Progress
                  value={
                    (trainerProfile.sessions_this_month / trainerProfile.max_sessions_per_month) * 100
                  }
                  className="h-2"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Expertise & Preferences */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Eligible Verticals & Session Types */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              Expertise Areas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {trainerProfile.eligible_verticals && trainerProfile.eligible_verticals.length > 0 ? (
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">Verticals</span>
                <div className="flex flex-wrap gap-2">
                  {trainerProfile.eligible_verticals.map((vertical, index) => (
                    <Badge key={index} variant="outline">
                      {vertical}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No verticals assigned</p>
            )}

            <Separator />

            {trainerProfile.eligible_session_types &&
            trainerProfile.eligible_session_types.length > 0 ? (
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">Session Types</span>
                <div className="flex flex-wrap gap-2">
                  {trainerProfile.eligible_session_types.map((type, index) => (
                    <Badge key={index} variant="secondary">
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No session types assigned</p>
            )}
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {trainerProfile.preferred_session_types &&
            trainerProfile.preferred_session_types.length > 0 ? (
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">Preferred Session Types</span>
                <div className="flex flex-wrap gap-2">
                  {trainerProfile.preferred_session_types.map((type, index) => (
                    <Badge key={index} variant="outline" className="bg-blue-500/5">
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No preferences set</p>
            )}

            <Separator />

            {trainerProfile.preferred_age_groups &&
            trainerProfile.preferred_age_groups.length > 0 ? (
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">Preferred Age Groups</span>
                <div className="flex flex-wrap gap-2">
                  {trainerProfile.preferred_age_groups.map((group, index) => (
                    <Badge key={index} variant="outline" className="bg-green-500/5">
                      {AGE_GROUP_LABELS[group] || group}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No age group preferences</p>
            )}

            {trainerProfile.max_sessions_per_month && (
              <>
                <Separator />
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Max Sessions Per Month</span>
                  <p className="font-medium">{trainerProfile.max_sessions_per_month} sessions</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trainer Certifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4" />
              Trainer Certifications
            </CardTitle>
            {expiringCerts.length > 0 && (
              <Badge variant="destructive" className="bg-red-500/10 text-red-700">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {expiringCerts.length} expiring soon
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {trainerProfile.certifications && trainerProfile.certifications.length > 0 ? (
            <div className="space-y-4">
              {trainerProfile.certifications.map((cert) => (
                <div
                  key={cert.id}
                  className={`flex items-start justify-between p-3 rounded-lg border ${
                    cert.is_expiring_soon ? 'border-red-500/30 bg-red-500/5' : 'bg-muted/30'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{cert.certification_name}</span>
                      {cert.is_verified && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                      {cert.is_expiring_soon && (
                        <Badge variant="destructive" className="text-xs bg-red-500/10 text-red-700">
                          Expiring in {cert.days_until_expiry} days
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {cert.issuing_organization}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        Issued: {new Date(cert.issued_date).toLocaleDateString()}
                      </span>
                      {cert.expiry_date && (
                        <span>
                          Expires: {new Date(cert.expiry_date).toLocaleDateString()}
                        </span>
                      )}
                      {cert.certificate_number && (
                        <span>#{cert.certificate_number}</span>
                      )}
                    </div>
                  </div>
                  {cert.document_url && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={cert.document_url} target="_blank" rel="noopener noreferrer">
                        View
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Award className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No trainer certifications yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
