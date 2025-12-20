/**
 * Engagement Metrics Tab Component
 *
 * Displays member engagement metrics and leadership readiness indicators.
 * Shows event participation, volunteer history, skill development, and leadership potential.
 */

'use client';

import { useMemo } from 'react';
import {
  Award,
  Calendar,
  TrendingUp,
  Users,
  Star,
  Target,
  BarChart3,
  CheckCircle2,
  Clock,
  Briefcase,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface EngagementMetricsTabProps {
  memberId: string;
  engagementData: {
    // Event Participation
    total_events_attended: number;
    events_this_year: number;
    events_last_year: number;
    event_attendance_rate: number;
    // Volunteering
    total_volunteer_hours: number;
    volunteer_events: number;
    volunteer_roles: string[];
    // Leadership
    leadership_roles_held: number;
    current_leadership_roles: string[];
    committees_served: number;
    // Skills & Development
    skills_count: number;
    certifications_count: number;
    training_sessions_attended: number;
    mentor_sessions: number;
    // Recognition
    awards_received: number;
    nominations_received: number;
    // Engagement Score
    overall_engagement_score: number;
    engagement_trend: 'increasing' | 'stable' | 'decreasing';
    leadership_readiness_score: number;
    // Activity Timeline
    last_event_date: string | null;
    member_since: string;
    consecutive_active_months: number;
  } | null;
}

export function EngagementMetricsTab({ memberId, engagementData }: EngagementMetricsTabProps) {
  // Calculate derived metrics
  const metrics = useMemo(() => {
    if (!engagementData) {
      return {
        yearOverYearGrowth: 0,
        avgEventsPerMonth: 0,
        leadershipLevel: 'Emerging',
        engagementTier: 'Active',
      };
    }

    const yearOverYearGrowth = engagementData.events_last_year > 0
      ? ((engagementData.events_this_year - engagementData.events_last_year) / engagementData.events_last_year) * 100
      : 100;

    const avgEventsPerMonth = engagementData.events_this_year / 12;

    let leadershipLevel = 'Emerging';
    if (engagementData.leadership_readiness_score >= 80) leadershipLevel = 'Ready';
    else if (engagementData.leadership_readiness_score >= 60) leadershipLevel = 'Developing';
    else if (engagementData.leadership_readiness_score >= 40) leadershipLevel = 'Promising';

    let engagementTier = 'Active';
    if (engagementData.overall_engagement_score >= 80) engagementTier = 'Champion';
    else if (engagementData.overall_engagement_score >= 60) engagementTier = 'Engaged';
    else if (engagementData.overall_engagement_score >= 40) engagementTier = 'Active';
    else engagementTier = 'New';

    return {
      yearOverYearGrowth,
      avgEventsPerMonth,
      leadershipLevel,
      engagementTier,
    };
  }, [engagementData]);

  // Default data for display
  const data = engagementData || {
    total_events_attended: 0,
    events_this_year: 0,
    events_last_year: 0,
    event_attendance_rate: 0,
    total_volunteer_hours: 0,
    volunteer_events: 0,
    volunteer_roles: [],
    leadership_roles_held: 0,
    current_leadership_roles: [],
    committees_served: 0,
    skills_count: 0,
    certifications_count: 0,
    training_sessions_attended: 0,
    mentor_sessions: 0,
    awards_received: 0,
    nominations_received: 0,
    overall_engagement_score: 0,
    engagement_trend: 'stable' as const,
    leadership_readiness_score: 0,
    last_event_date: null,
    member_since: new Date().toISOString(),
    consecutive_active_months: 0,
  };

  const getTrendIcon = () => {
    switch (data.engagement_trend) {
      case 'increasing':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'decreasing':
        return <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />;
      default:
        return <BarChart3 className="h-4 w-4 text-yellow-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engagement Score</CardTitle>
            {getTrendIcon()}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overall_engagement_score}%</div>
            <Progress value={data.overall_engagement_score} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Tier: <Badge variant="outline">{metrics.engagementTier}</Badge>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leadership Readiness</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.leadership_readiness_score}%</div>
            <Progress value={data.leadership_readiness_score} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Level: <Badge variant="secondary">{metrics.leadershipLevel}</Badge>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Events Attended</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.total_events_attended}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {data.events_this_year} this year
              {metrics.yearOverYearGrowth !== 0 && (
                <span className={metrics.yearOverYearGrowth > 0 ? 'text-green-600 ml-1' : 'text-red-600 ml-1'}>
                  ({metrics.yearOverYearGrowth > 0 ? '+' : ''}{metrics.yearOverYearGrowth.toFixed(0)}%)
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Volunteer Hours</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.total_volunteer_hours}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Across {data.volunteer_events} events
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Sections */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Event Participation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Event Participation
            </CardTitle>
            <CardDescription>
              Attendance and participation history
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Attendance Rate</span>
              <span className="font-medium">{data.event_attendance_rate}%</span>
            </div>
            <Progress value={data.event_attendance_rate} className="h-2" />

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-bold">{data.events_this_year}</p>
                <p className="text-xs text-muted-foreground">Events This Year</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{data.events_last_year}</p>
                <p className="text-xs text-muted-foreground">Events Last Year</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {data.last_event_date ? (
                <span>Last attended: {new Date(data.last_event_date).toLocaleDateString()}</span>
              ) : (
                <span>No events attended yet</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Volunteering & Service */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Volunteering & Service
            </CardTitle>
            <CardDescription>
              Volunteer contributions and roles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{data.total_volunteer_hours}</p>
                <p className="text-xs text-muted-foreground">Total Hours</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{data.volunteer_events}</p>
                <p className="text-xs text-muted-foreground">Events Volunteered</p>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-sm font-medium mb-2">Volunteer Roles</p>
              <div className="flex flex-wrap gap-2">
                {data.volunteer_roles.length > 0 ? (
                  data.volunteer_roles.map((role) => (
                    <Badge key={role} variant="secondary">{role}</Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No volunteer roles yet</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leadership & Committees */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Leadership & Committees
            </CardTitle>
            <CardDescription>
              Leadership positions and committee service
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{data.leadership_roles_held}</p>
                <p className="text-xs text-muted-foreground">Roles Held</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{data.committees_served}</p>
                <p className="text-xs text-muted-foreground">Committees</p>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-sm font-medium mb-2">Current Roles</p>
              <div className="flex flex-wrap gap-2">
                {data.current_leadership_roles.length > 0 ? (
                  data.current_leadership_roles.map((role) => (
                    <Badge key={role} variant="default">{role}</Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No current leadership roles</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Skills & Development */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Skills & Development
            </CardTitle>
            <CardDescription>
              Professional growth and certifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold">{data.skills_count}</p>
                  <p className="text-xs text-muted-foreground">Skills</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Award className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold">{data.certifications_count}</p>
                  <p className="text-xs text-muted-foreground">Certifications</p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Training Sessions</span>
                <span className="font-medium">{data.training_sessions_attended}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Mentor Sessions</span>
                <span className="font-medium">{data.mentor_sessions}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recognition & Awards */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Recognition & Awards
          </CardTitle>
          <CardDescription>
            Awards and nominations received
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 border rounded-lg">
              <Award className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
              <p className="text-2xl font-bold">{data.awards_received}</p>
              <p className="text-sm text-muted-foreground">Awards Won</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <Star className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{data.nominations_received}</p>
              <p className="text-sm text-muted-foreground">Nominations</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <Calendar className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <p className="text-2xl font-bold">{data.consecutive_active_months}</p>
              <p className="text-sm text-muted-foreground">Active Months</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
