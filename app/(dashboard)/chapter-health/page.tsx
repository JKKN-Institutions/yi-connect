/**
 * Chapter Health Dashboard
 *
 * Shows the Best Chapter score breakdown:
 * BEST CHAPTER = Coverage x Documentation x Impact x Visibility
 *
 * Uses mock data with TODO comments for real Supabase queries.
 */

import { Suspense } from 'react'
import { getUserProfile } from '@/lib/auth'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  TrendingUp,
  TrendingDown,
  Activity,
  FileCheck,
  Users,
  Eye,
  Calendar,
  TreePine,
  Heart,
  Shield,
  Accessibility,
  Lightbulb,
  GraduationCap,
  Megaphone,
  Dumbbell,
  Rocket,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from 'lucide-react'

// ─── Mock Data ────────────────────────────────────────────────────────────────
// TODO: Replace with real Supabase queries using createServerSupabaseClient()
// Query activities, health_cards, social_posts from yi_connect schema

const MOCK_OVERALL_SCORE = {
  current: 72,
  previous: 65,
  trend: 'up' as const
}

const MOCK_VERTICALS = [
  { name: 'MASOOM', icon: 'Shield', activities: 8, lastActivity: '2026-05-20', active: true, stakeholder: 'Thalir' },
  { name: 'Climate Change', icon: 'TreePine', activities: 3, lastActivity: '2026-04-15', active: true, stakeholder: 'Members' },
  { name: 'Health', icon: 'Heart', activities: 5, lastActivity: '2026-05-18', active: true, stakeholder: 'Rural' },
  { name: 'Road Safety', icon: 'Shield', activities: 2, lastActivity: '2026-03-28', active: true, stakeholder: 'Thalir' },
  { name: 'Accessibility', icon: 'Accessibility', activities: 1, lastActivity: '2026-02-10', active: false, stakeholder: 'Members' },
  { name: 'Entrepreneurship', icon: 'Rocket', activities: 4, lastActivity: '2026-05-12', active: true, stakeholder: 'Yuva' },
  { name: 'Innovation', icon: 'Lightbulb', activities: 6, lastActivity: '2026-05-22', active: true, stakeholder: 'Yuva' },
  { name: 'Learning', icon: 'GraduationCap', activities: 3, lastActivity: '2026-04-30', active: true, stakeholder: 'Members' },
  { name: 'Branding', icon: 'Megaphone', activities: 2, lastActivity: '2026-05-05', active: true, stakeholder: 'Members' },
  { name: 'Sports', icon: 'Dumbbell', activities: 1, lastActivity: '2026-03-10', active: false, stakeholder: 'Members' },
]

const MOCK_MYTRI = [
  { name: 'Members', code: 'M', engagements: 24, totalMembers: 80, participationRate: 65 },
  { name: 'Yuva', code: 'Y', engagements: 12, totalMembers: 45, participationRate: 48 },
  { name: 'Thalir', code: 'T', engagements: 15, totalMembers: 120, participationRate: 72 },
  { name: 'Rural', code: 'Ri', engagements: 6, totalMembers: 30, participationRate: 35 },
]

const MOCK_DOCUMENTATION = {
  totalActivities: 35,
  healthCardsSubmitted: 28,
  rate: 80,
  gap: 7
}

const MOCK_IMPACT = {
  totalPeopleImpacted: 4250,
  ecMembersInvolved: 18,
  nonEcParticipants: 42,
  topActivities: [
    { name: 'MASOOM School Safety Week', impact: 1200, date: '2026-05-20' },
    { name: 'Health Camp - Rural Outreach', impact: 850, date: '2026-05-18' },
    { name: 'Innovation Hackathon', impact: 320, date: '2026-05-22' },
  ]
}

const MOCK_VISIBILITY = {
  socialMediaPosts: 22,
  mediaCoverage: 4,
  activitiesWithoutSocialProof: 9,
  score: 63
}

// ─── Helper Components ────────────────────────────────────────────────────────

function VerticalIcon({ name }: { name: string }) {
  const iconClass = 'h-4 w-4'
  switch (name) {
    case 'MASOOM': return <Shield className={iconClass} />
    case 'Climate Change': return <TreePine className={iconClass} />
    case 'Health': return <Heart className={iconClass} />
    case 'Road Safety': return <Shield className={iconClass} />
    case 'Accessibility': return <Accessibility className={iconClass} />
    case 'Entrepreneurship': return <Rocket className={iconClass} />
    case 'Innovation': return <Lightbulb className={iconClass} />
    case 'Learning': return <GraduationCap className={iconClass} />
    case 'Branding': return <Megaphone className={iconClass} />
    case 'Sports': return <Dumbbell className={iconClass} />
    default: return <Activity className={iconClass} />
  }
}

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (score / 100) * circumference

  const getColor = (s: number) => {
    if (s >= 80) return '#229434'
    if (s >= 60) return '#FD7215'
    return '#ef4444'
  }

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={10}
          className="text-muted/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor(score)}
          strokeWidth={10}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold" style={{ color: getColor(score) }}>
          {score}
        </span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
    </div>
  )
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function daysAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return `${diff}d ago`
}

// ─── Section Components ───────────────────────────────────────────────────────

function OverallScoreCard() {
  const { current, previous, trend } = MOCK_OVERALL_SCORE
  const diff = current - previous

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Best Chapter Score</CardTitle>
        <CardDescription>Coverage x Documentation x Impact x Visibility</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <ScoreRing score={current} />
          <div className="flex flex-col gap-3 text-right">
            <div className="flex items-center gap-2 justify-end">
              {trend === 'up' ? (
                <TrendingUp className="h-5 w-5 text-[#229434]" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-500" />
              )}
              <span className={`text-sm font-medium ${trend === 'up' ? 'text-[#229434]' : 'text-red-500'}`}>
                {diff > 0 ? '+' : ''}{diff} from last month
              </span>
            </div>
            <div className="space-y-1.5">
              <ScoreBreakdownRow label="Coverage" value={78} />
              <ScoreBreakdownRow label="Documentation" value={80} />
              <ScoreBreakdownRow label="Impact" value={71} />
              <ScoreBreakdownRow label="Visibility" value={63} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ScoreBreakdownRow({ label, value }: { label: string; value: number }) {
  const getColor = (v: number) => {
    if (v >= 80) return 'bg-[#229434]'
    if (v >= 60) return 'bg-[#FD7215]'
    return 'bg-red-500'
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-28 text-left">{label}</span>
      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${getColor(value)}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-medium w-8">{value}%</span>
    </div>
  )
}

function CoverageGrid() {
  const activeCount = MOCK_VERTICALS.filter(v => v.active).length
  const totalVerticals = MOCK_VERTICALS.length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Coverage</CardTitle>
            <CardDescription>Vertical activity + MYTRI stakeholder engagement</CardDescription>
          </div>
          <Badge variant={activeCount >= 8 ? 'success' : activeCount >= 6 ? 'warning' : 'destructive'}>
            {activeCount}/{totalVerticals} active
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Verticals Grid */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Verticals (this quarter)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {MOCK_VERTICALS.map((vertical) => (
              <div
                key={vertical.name}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  vertical.active ? 'bg-background' : 'bg-muted/50 opacity-70'
                }`}
              >
                <div className={`p-1.5 rounded ${vertical.active ? 'text-[#FD7215]' : 'text-muted-foreground'}`}>
                  <VerticalIcon name={vertical.name} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{vertical.name}</span>
                    {vertical.active ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#229434] shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{vertical.activities} activities</span>
                    <span>-</span>
                    <span>{daysAgo(vertical.lastActivity)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MYTRI Stakeholders */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">MYTRI Stakeholders</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {MOCK_MYTRI.map((stakeholder) => (
              <div key={stakeholder.code} className="p-3 rounded-lg border bg-background text-center">
                <div className="text-2xl font-bold text-[#FD7215]">{stakeholder.engagements}</div>
                <div className="text-xs font-medium mt-1">{stakeholder.name}</div>
                <div className="text-xs text-muted-foreground">{stakeholder.participationRate}% active</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DocumentationRate() {
  const { totalActivities, healthCardsSubmitted, rate, gap } = MOCK_DOCUMENTATION

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Documentation</CardTitle>
            <CardDescription>Health Card submission rate</CardDescription>
          </div>
          <FileCheck className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold" style={{ color: rate >= 80 ? '#229434' : rate >= 60 ? '#FD7215' : '#ef4444' }}>
              {rate}%
            </span>
            <span className="text-sm text-muted-foreground mb-1">submission rate</span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Submitted</span>
              <span className="font-medium">{healthCardsSubmitted} / {totalActivities}</span>
            </div>
            <Progress value={rate} className="h-3" />
          </div>

          {gap > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              <span className="text-sm text-red-700 dark:text-red-400">
                <strong>{gap} activities</strong> without health cards
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ImpactMetrics() {
  const { totalPeopleImpacted, ecMembersInvolved, nonEcParticipants, topActivities } = MOCK_IMPACT

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Impact</CardTitle>
            <CardDescription>People reached and outcomes this quarter</CardDescription>
          </div>
          <Users className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold text-[#229434]">
              {totalPeopleImpacted.toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground mb-1">people impacted</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <div className="text-xl font-bold">{ecMembersInvolved}</div>
              <div className="text-xs text-muted-foreground">EC members involved</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <div className="text-xl font-bold">{nonEcParticipants}</div>
              <div className="text-xs text-muted-foreground">Non-EC participants</div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Top Activities by Impact</h4>
            <div className="space-y-2">
              {topActivities.map((activity, idx) => (
                <div key={activity.name} className="flex items-center gap-3 p-2 rounded border">
                  <span className="text-xs font-bold text-[#FD7215] w-5">#{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{activity.name}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(activity.date)}</div>
                  </div>
                  <Badge variant="secondary">{activity.impact.toLocaleString()}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function VisibilityScore() {
  const { socialMediaPosts, mediaCoverage, activitiesWithoutSocialProof, score } = MOCK_VISIBILITY

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Visibility</CardTitle>
            <CardDescription>Social media and media coverage</CardDescription>
          </div>
          <Eye className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold" style={{ color: score >= 80 ? '#229434' : score >= 60 ? '#FD7215' : '#ef4444' }}>
              {score}%
            </span>
            <span className="text-sm text-muted-foreground mb-1">visibility score</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <div className="text-xl font-bold">{socialMediaPosts}</div>
              <div className="text-xs text-muted-foreground">Social posts</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <div className="text-xl font-bold">{mediaCoverage}</div>
              <div className="text-xs text-muted-foreground">Media coverage</div>
            </div>
          </div>

          {activitiesWithoutSocialProof > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-sm text-amber-700 dark:text-amber-400">
                <strong>{activitiesWithoutSocialProof} activities</strong> without social proof
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default async function ChapterHealthPage() {
  // TODO: Replace mock data with real queries
  // const supabase = await createServerSupabaseClient()
  // const profile = await getUserProfile()
  // const chapterId = profile?.chapter_id
  //
  // Query examples:
  // const { data: activities } = await supabase.from('activities').select('*').eq('chapter_id', chapterId)
  // const { data: healthCards } = await supabase.from('health_cards').select('*').eq('chapter_id', chapterId)
  // const { data: socialPosts } = await supabase.from('social_posts').select('*').eq('chapter_id', chapterId)

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Chapter Health</h1>
        <p className="text-muted-foreground">
          Best Chapter score breakdown for the current quarter
        </p>
      </div>

      {/* Overall Score */}
      <OverallScoreCard />

      {/* Coverage */}
      <CoverageGrid />

      {/* Documentation + Impact + Visibility in responsive grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <DocumentationRate />
        <ImpactMetrics />
        <VisibilityScore />
      </div>
    </div>
  )
}
