/**
 * Member Card Component
 *
 * Display member information in card format.
 */

'use client'

import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import {
  Building2,
  Mail,
  MoreVertical,
  Phone,
  MapPin,
  Calendar,
  Award,
  Target,
} from 'lucide-react'
import type { MemberListItem } from '@/types/member'

interface MemberCardProps {
  member: MemberListItem
  onDelete?: (id: string) => void
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

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400'
  if (score >= 60) return 'text-blue-600 dark:text-blue-400'
  if (score >= 40) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function getProficiencyBadge(proficiency: string): string {
  const colors: Record<string, string> = {
    beginner: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    intermediate: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    advanced: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    expert: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  }
  return colors[proficiency] || colors.beginner
}

export function MemberCard({ member, onDelete }: MemberCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={member.avatar_url || undefined} alt={member.full_name} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {getInitials(member.full_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <Link
                href={`/members/${member.id}`}
                className="font-semibold text-lg hover:text-primary transition-colors"
              >
                {member.full_name}
              </Link>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className={getStatusColor(member.membership_status)}>
                  {member.membership_status}
                </Badge>
                {member.skills_count > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {member.skills_count} skill{member.skills_count !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/members/${member.id}`}>View Details</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/members/${member.id}/edit`}>Edit Member</Link>
              </DropdownMenuItem>
              {onDelete && (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDelete(member.id)}
                >
                  Delete Member
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Contact Information */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4 shrink-0" />
            <span className="truncate">{member.email}</span>
          </div>
          {member.company && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {member.designation ? `${member.designation} at ${member.company}` : member.company}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>Member since {new Date(member.member_since).getFullYear()}</span>
          </div>
        </div>

        {/* Skills */}
        {member.top_skills.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Top Skills</p>
            <div className="flex flex-wrap gap-2">
              {member.top_skills.map((skill, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className={getProficiencyBadge(skill.proficiency)}
                >
                  {skill.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Scores */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1">
                <Award className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Engagement</span>
              </div>
              <span className={`font-semibold ${getScoreColor(member.engagement_score)}`}>
                {member.engagement_score}
              </span>
            </div>
            <Progress value={member.engagement_score} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Readiness</span>
              </div>
              <span className={`font-semibold ${getScoreColor(member.readiness_score)}`}>
                {member.readiness_score}
              </span>
            </div>
            <Progress value={member.readiness_score} className="h-2" />
          </div>
        </div>
      </CardContent>

      <CardFooter className="bg-muted/50 pt-4">
        <Button asChild variant="outline" className="w-full">
          <Link href={`/members/${member.id}`}>View Full Profile</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
