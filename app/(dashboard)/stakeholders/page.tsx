/**
 * Stakeholders Overview Dashboard
 *
 * Main stakeholder CRM dashboard with overview stats and quick access to all stakeholder types
 */

import { Suspense } from 'react';
import Link from 'next/link';
import {
  Building2,
  GraduationCap,
  Factory,
  Landmark,
  Users,
  Package,
  Mic,
  TrendingUp,
  AlertCircle,
  FileText,
  ArrowRight
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { getCurrentChapterId } from '@/lib/auth';
import {
  getStakeholderOverview,
  getPendingFollowUps,
  getExpiringMous
} from '@/lib/data/stakeholder';
import { formatStakeholderType } from '@/types/stakeholder';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Stakeholder CRM',
  description:
    'Manage relationships with schools, colleges, industries, government, NGOs, vendors, and speakers'
};

const stakeholderTypes = [
  {
    type: 'schools',
    label: 'Schools',
    icon: Building2,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    href: '/stakeholders/schools'
  },
  {
    type: 'colleges',
    label: 'Colleges',
    icon: GraduationCap,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    href: '/stakeholders/colleges'
  },
  {
    type: 'industries',
    label: 'Industries',
    icon: Factory,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    href: '/stakeholders/industries'
  },
  {
    type: 'government',
    label: 'Government',
    icon: Landmark,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    href: '/stakeholders/government'
  },
  {
    type: 'ngos',
    label: 'NGOs',
    icon: Users,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    href: '/stakeholders/ngos'
  },
  {
    type: 'vendors',
    label: 'Vendors',
    icon: Package,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    href: '/stakeholders/vendors'
  },
  {
    type: 'speakers',
    label: 'Speakers',
    icon: Mic,
    color: 'text-pink-600',
    bgColor: 'bg-pink-100',
    href: '/stakeholders/speakers'
  }
];

async function StakeholderOverviewStats() {
  const chapterId = await getCurrentChapterId();
  if (!chapterId) return null;

  const stats = await getStakeholderOverview(chapterId);

  return (
    <>
      {/* Main Overview Stats */}
      <div className='grid gap-4 md:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Total Stakeholders
            </CardTitle>
            <Users className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.total_stakeholders}</div>
            <p className='text-xs text-muted-foreground'>
              {stats.by_status.active} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Active MoUs</CardTitle>
            <FileText className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.active_mous}</div>
            <p className='text-xs text-muted-foreground'>
              {stats.expiring_soon_mous} expiring soon
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>This Month</CardTitle>
            <TrendingUp className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {stats.interactions_this_month}
            </div>
            <p className='text-xs text-muted-foreground'>Interactions logged</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Pending Follow-ups
            </CardTitle>
            <AlertCircle className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.follow_ups_pending}</div>
            <p className='text-xs text-muted-foreground'>Require attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Stakeholder Types Grid */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        {stakeholderTypes.map((stakeholder) => {
          const Icon = stakeholder.icon;
          const count =
            stats.by_type[stakeholder.type as keyof typeof stats.by_type];

          return (
            <Card
              key={stakeholder.type}
              className='hover:shadow-md transition-shadow'
            >
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>
                  {stakeholder.label}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stakeholder.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stakeholder.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>{count}</div>
                <Link href={stakeholder.href}>
                  <Button variant='ghost' size='sm' className='mt-2 px-0'>
                    View all <ArrowRight className='ml-1 h-3 w-3' />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Health Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Relationship Health Distribution</CardTitle>
          <CardDescription>
            Overview of stakeholder relationship health across your network
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='grid gap-4 md:grid-cols-3'>
            <div className='flex items-center gap-4'>
              <div className='flex-1'>
                <p className='text-sm font-medium'>Healthy</p>
                <p className='text-2xl font-bold'>
                  {stats.health_distribution.healthy}
                </p>
              </div>
              <Badge variant='default'>Score 80-100</Badge>
            </div>
            <div className='flex items-center gap-4'>
              <div className='flex-1'>
                <p className='text-sm font-medium'>Needs Attention</p>
                <p className='text-2xl font-bold'>
                  {stats.health_distribution.needs_attention}
                </p>
              </div>
              <Badge variant='secondary'>Score 60-79</Badge>
            </div>
            <div className='flex items-center gap-4'>
              <div className='flex-1'>
                <p className='text-sm font-medium'>At Risk</p>
                <p className='text-2xl font-bold'>
                  {stats.health_distribution.at_risk}
                </p>
              </div>
              <Badge variant='destructive'>Score &lt;60</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

async function PendingFollowUpsCard() {
  const chapterId = await getCurrentChapterId();
  if (!chapterId) return null;

  const followUps = await getPendingFollowUps(chapterId);

  if (followUps.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Follow-ups</CardTitle>
        <CardDescription>
          {followUps.length} interaction{followUps.length !== 1 ? 's' : ''}{' '}
          require follow-up
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='space-y-3'>
          {followUps.slice(0, 5).map((interaction) => {
            const followUpDate = interaction.follow_up_date
              ? new Date(interaction.follow_up_date)
              : null;
            const isOverdue = followUpDate && followUpDate < new Date();

            return (
              <div
                key={interaction.id}
                className='flex items-center justify-between border-b pb-3 last:border-0 last:pb-0'
              >
                <div className='flex-1'>
                  <p className='text-sm font-medium capitalize'>
                    {formatStakeholderType(interaction.stakeholder_type)}
                  </p>
                  <p className='text-xs text-muted-foreground line-clamp-1'>
                    {interaction.summary}
                  </p>
                </div>
                <div className='flex items-center gap-2'>
                  {followUpDate && (
                    <Badge
                      variant={isOverdue ? 'destructive' : 'secondary'}
                      className='text-xs'
                    >
                      {isOverdue
                        ? 'Overdue'
                        : followUpDate.toLocaleDateString()}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

async function ExpiringMoUsCard() {
  const chapterId = await getCurrentChapterId();
  if (!chapterId) return null;

  const expiringMous = await getExpiringMous(chapterId, 30);

  if (expiringMous.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expiring MoUs</CardTitle>
        <CardDescription>
          {expiringMous.length} MoU{expiringMous.length !== 1 ? 's' : ''}{' '}
          expiring in the next 30 days
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='space-y-3'>
          {expiringMous.slice(0, 5).map((mou) => {
            const expiryDate = mou.valid_to ? new Date(mou.valid_to) : null;
            const daysUntilExpiry = expiryDate
              ? Math.floor(
                  (expiryDate.getTime() - new Date().getTime()) /
                    (1000 * 60 * 60 * 24)
                )
              : 0;

            return (
              <div
                key={mou.id}
                className='flex items-center justify-between border-b pb-3 last:border-0 last:pb-0'
              >
                <div className='flex-1'>
                  <p className='text-sm font-medium'>{mou.mou_title}</p>
                  <p className='text-xs text-muted-foreground capitalize'>
                    {formatStakeholderType(mou.stakeholder_type)}
                  </p>
                </div>
                <Badge variant='secondary' className='text-xs'>
                  {daysUntilExpiry} days left
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

async function DashboardWrapper() {
  const chapterId = await getCurrentChapterId();

  if (!chapterId) {
    redirect('/login');
  }

  return (
    <>
      <StakeholderOverviewStats />
      <div className='grid gap-4 md:grid-cols-2'>
        <PendingFollowUpsCard />
        <ExpiringMoUsCard />
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className='grid gap-4 md:grid-cols-4'>
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className='h-[120px]' />
        ))}
      </div>
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        {[...Array(7)].map((_, i) => (
          <Skeleton key={i} className='h-[120px]' />
        ))}
      </div>
      <Skeleton className='h-[200px]' />
    </>
  );
}

export default function StakeholdersPage() {
  return (
    <div className='flex flex-col gap-8'>
      {/* Header */}
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>Stakeholder CRM</h1>
        <p className='text-muted-foreground'>
          Manage relationships with schools, colleges, industries, government,
          NGOs, vendors, and speakers
        </p>
      </div>

      {/* Dashboard */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardWrapper />
      </Suspense>
    </div>
  );
}
