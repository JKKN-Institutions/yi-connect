import Link from 'next/link';
import { Suspense } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import {
  Users,
  Building2,
  Calendar,
  Wallet,
  TrendingUp,
  Award,
  MessageSquare,
  BookOpen,
  BarChart3,
  Network,
  Smartphone,
  ArrowRight,
  Map,
  HeartPulse,
  BotMessageSquare,
  UserCog,
  Globe,
  ShieldCheck
} from 'lucide-react';
import { CopyrightYear } from '@/components/copyright-year';

// ─── Yi-native differentiators ───────────────────────────────────────────────

const differentiators = [
  {
    icon: Calendar,
    title: 'Events feed AAA health cards automatically',
    description:
      'Every event a member attends updates their Pathfinder AAA plan score in real time. No spreadsheet, no manual entry.',
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-950/40 ring-orange-100 dark:ring-orange-900/60'
  },
  {
    icon: Award,
    title: 'Take Pride nominations auto-suggested',
    description:
      'Engagement scores surface the right members at nomination time. Juries see evidence, not gut feel.',
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-50 dark:bg-yellow-950/40 ring-yellow-100 dark:ring-yellow-900/60'
  },
  {
    icon: TrendingUp,
    title: 'Succession pipeline built on your real data',
    description:
      'Leadership readiness scores, vertical experience, and attendance history — not a separate survey.',
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-950/40 ring-green-100 dark:ring-green-900/60'
  },
  {
    icon: BarChart3,
    title: 'National reporting: one click, not four hours',
    description:
      'Chapter data maps directly to Yi National\'s reporting template. No reformatting, no chasing members for numbers.',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/40 ring-blue-100 dark:ring-blue-900/60'
  }
];

// ─── Capabilities by Chair rhythm ────────────────────────────────────────────

const rhythm = [
  {
    cadence: 'Daily',
    color: 'border-orange-300 dark:border-orange-800',
    labelColor: 'text-orange-700 dark:text-orange-400',
    badgeBg: 'bg-orange-100 dark:bg-orange-950/60',
    items: [
      { icon: BarChart3, label: 'Chapter dashboard' },
      { icon: Users, label: 'Member list & approvals' },
      { icon: UserCog, label: 'Role-based portals' }
    ]
  },
  {
    cadence: 'Weekly',
    color: 'border-green-300 dark:border-green-800',
    labelColor: 'text-green-700 dark:text-green-400',
    badgeBg: 'bg-green-100 dark:bg-green-950/60',
    items: [
      { icon: Calendar, label: 'Events & RSVPs' },
      { icon: MessageSquare, label: 'Announcements & WhatsApp' },
      { icon: Map, label: 'Pathfinder (AAA plans)' }
    ]
  },
  {
    cadence: 'Monthly',
    color: 'border-yellow-300 dark:border-yellow-800',
    labelColor: 'text-yellow-700 dark:text-yellow-400',
    badgeBg: 'bg-yellow-100 dark:bg-yellow-950/60',
    items: [
      { icon: Award, label: 'Take Pride Awards' },
      { icon: Wallet, label: 'Finance reporting' },
      { icon: BookOpen, label: 'Best practices & knowledge' }
    ]
  },
  {
    cadence: 'Yearly',
    color: 'border-purple-300 dark:border-purple-800',
    labelColor: 'text-purple-700 dark:text-purple-400',
    badgeBg: 'bg-purple-100 dark:bg-purple-950/60',
    items: [
      { icon: TrendingUp, label: 'Succession cycles' },
      { icon: BarChart3, label: 'Chapter performance review' },
      { icon: Network, label: 'National benchmarking' }
    ]
  },
  {
    cadence: 'Always',
    color: 'border-blue-300 dark:border-blue-800',
    labelColor: 'text-blue-700 dark:text-blue-400',
    badgeBg: 'bg-blue-100 dark:bg-blue-950/60',
    items: [
      { icon: Smartphone, label: 'Mobile PWA & offline' },
      { icon: Globe, label: 'Industry & Chapter Lead portals' },
      { icon: BotMessageSquare, label: 'Activity planner assistant' }
    ]
  }
];

// ─── Role cards ───────────────────────────────────────────────────────────────

const roles = [
  {
    title: 'Chair / Co-Chair',
    icon: ShieldCheck,
    color: 'text-orange-600 dark:text-orange-400',
    ring: 'ring-orange-200 dark:ring-orange-800',
    items: [
      'Full chapter dashboard',
      'Member approvals & roles',
      'Succession & succession scoring',
      'Finance sign-off workflows',
      'User impersonation for support'
    ]
  },
  {
    title: 'Members',
    icon: Users,
    color: 'text-green-600 dark:text-green-400',
    ring: 'ring-green-200 dark:ring-green-800',
    items: [
      'Personal AAA health card',
      'Event RSVP & attendance',
      'Engagement score & badges',
      'Take Pride nomination status',
      'Mobile-first, works offline'
    ]
  },
  {
    title: 'Industry Coordinators',
    icon: Building2,
    color: 'text-blue-600 dark:text-blue-400',
    ring: 'ring-blue-200 dark:ring-blue-800',
    items: [
      'Industry opportunity listings',
      'Visit scheduling & coordination',
      'Stakeholder relationship log',
      'Session booking management'
    ]
  },
  {
    title: 'National Admin',
    icon: Network,
    color: 'text-purple-600 dark:text-purple-400',
    ring: 'ring-purple-200 dark:ring-purple-800',
    items: [
      'Multi-chapter view & benchmarks',
      'National reporting template sync',
      'Cross-chapter succession data',
      'Chapter impersonation for support',
      'Unified communications layer'
    ]
  }
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className='min-h-screen bg-background'>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className='relative overflow-hidden bg-linear-to-br from-orange-50 via-background to-green-50 dark:from-orange-950/20 dark:via-background dark:to-green-950/20'>
        <div className='absolute inset-0 pointer-events-none' />

        <div className='container relative mx-auto px-4 py-20 md:py-32'>
          <div className='mx-auto max-w-4xl text-center space-y-8'>

            {/* Eyebrow */}
            <div className='inline-flex items-center gap-2 rounded-full bg-orange-100 dark:bg-orange-950/50 px-5 py-2.5 text-sm font-semibold text-orange-700 dark:text-orange-400 ring-1 ring-orange-200 dark:ring-orange-900'>
              <span className='relative flex h-2 w-2'>
                <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75' />
                <span className='relative inline-flex rounded-full h-2 w-2 bg-orange-600' />
              </span>
              Yi-native — built for how chapters actually work
            </div>

            {/* Headline */}
            <h1 className='text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl'>
              <span className='block text-foreground mb-2'>The operating system</span>
              <span className='block bg-linear-to-r from-orange-600 via-orange-500 to-green-600 bg-clip-text text-transparent'>
                your Yi Chapter runs on.
              </span>
            </h1>

            {/* Subhead */}
            <p className='mx-auto max-w-2xl text-xl text-muted-foreground md:text-2xl leading-relaxed'>
              Events, AAA plans, succession, Take Pride —
              one system, Yi-native from day one.
            </p>

            {/* CTAs */}
            <div className='flex flex-col gap-4 sm:flex-row sm:justify-center pt-4'>
              <Link
                href='/login'
                className='inline-flex items-center justify-center gap-2 rounded-md bg-orange-600 hover:bg-orange-700 text-white font-semibold px-8 py-3 transition-all shadow-lg hover:shadow-xl'
              >
                Sign In
                <ArrowRight className='h-5 w-5' />
              </Link>
              <Link
                href='/login'
                className='inline-flex items-center justify-center gap-2 rounded-md border-2 border-input bg-background hover:bg-accent hover:text-accent-foreground font-semibold px-8 py-3 transition-all shadow-sm hover:shadow-md'
              >
                Request access
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom wave */}
        <div className='absolute bottom-0 left-0 right-0'>
          <svg viewBox='0 0 1440 120' className='w-full h-auto text-background fill-current'>
            <path d='M0,64L80,69.3C160,75,320,85,480,80C640,75,800,53,960,48C1120,43,1280,53,1360,58.7L1440,64L1440,120L1360,120C1280,120,1120,120,960,120C800,120,640,120,480,120C320,120,160,120,80,120L0,120Z' />
          </svg>
        </div>
      </section>

      {/* ── Yi-native differentiators ─────────────────────────────────────── */}
      <section className='container mx-auto px-4 py-16 md:py-24'>
        <div className='mx-auto max-w-5xl'>
          <div className='text-center mb-12 space-y-3'>
            <h2 className='text-3xl md:text-4xl font-bold'>
              Built around the{' '}
              <span className='text-orange-600 dark:text-orange-400'>Yi operating rhythm</span>
            </h2>
            <p className='text-muted-foreground max-w-2xl mx-auto text-lg'>
              Stutzee tracks attendance. Yi Connect closes the gap it leaves open:
              AAA plans, Take Pride, succession pipelines, and national reporting — all wired together.
            </p>
          </div>

          <div className='grid gap-6 sm:grid-cols-2'>
            {differentiators.map((d) => {
              const Icon = d.icon;
              return (
                <Card key={d.title} className={`ring-2 ${d.bg} border-0 shadow-none`}>
                  <CardHeader className='pb-3'>
                    <div className='flex items-start gap-4'>
                      <div className={`p-3 rounded-xl ring-2 ${d.bg} shrink-0`}>
                        <Icon className={`h-6 w-6 ${d.color}`} />
                      </div>
                      <CardTitle className='text-base leading-snug pt-1'>{d.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className='pt-0'>
                    <CardDescription className='text-sm leading-relaxed'>{d.description}</CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── What's inside — by Chair's rhythm ────────────────────────────── */}
      <section className='bg-muted/30 py-16 md:py-24'>
        <div className='container mx-auto px-4'>
          <div className='mx-auto max-w-6xl'>
            <div className='text-center mb-12 space-y-3'>
              <h2 className='text-3xl md:text-4xl font-bold'>
                Everything a chapter needs,{' '}
                <span className='text-green-600 dark:text-green-400'>when it needs it</span>
              </h2>
              <p className='text-muted-foreground max-w-2xl mx-auto'>
                Organised by how a Chair actually thinks — not by module number.
              </p>
            </div>

            <div className='grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'>
              {rhythm.map((group) => (
                <div key={group.cadence} className={`rounded-xl border-2 ${group.color} bg-card p-5 space-y-4`}>
                  <div className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${group.badgeBg} ${group.labelColor}`}>
                    {group.cadence}
                  </div>
                  <ul className='space-y-3'>
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <li key={item.label} className='flex items-center gap-2.5 text-sm text-foreground'>
                          <ItemIcon className={`h-4 w-4 shrink-0 ${group.labelColor}`} />
                          {item.label}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>

            {/* Also-included callouts */}
            <div className='mt-8 grid gap-4 sm:grid-cols-3'>
              <div className='rounded-xl border bg-card p-4 flex items-start gap-3'>
                <HeartPulse className='h-5 w-5 mt-0.5 text-rose-500 shrink-0' />
                <div>
                  <p className='text-sm font-semibold'>Health Card tracking</p>
                  <p className='text-xs text-muted-foreground mt-0.5'>Member engagement scores update after every event and activity.</p>
                </div>
              </div>
              <div className='rounded-xl border bg-card p-4 flex items-start gap-3'>
                <BotMessageSquare className='h-5 w-5 mt-0.5 text-violet-500 shrink-0' />
                <div>
                  <p className='text-sm font-semibold'>Activity planner assistant</p>
                  <p className='text-xs text-muted-foreground mt-0.5'>Chat-based help for planning events that meet AAA criteria.</p>
                </div>
              </div>
              <div className='rounded-xl border bg-card p-4 flex items-start gap-3'>
                <Smartphone className='h-5 w-5 mt-0.5 text-blue-500 shrink-0' />
                <div>
                  <p className='text-sm font-semibold'>PWA — works offline</p>
                  <p className='text-xs text-muted-foreground mt-0.5'>Installable on any phone. Core features available without signal.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Role section ─────────────────────────────────────────────────── */}
      <section className='container mx-auto px-4 py-16 md:py-24'>
        <div className='mx-auto max-w-6xl'>
          <div className='text-center mb-12 space-y-3'>
            <h2 className='text-3xl md:text-4xl font-bold'>
              The right view for{' '}
              <span className='text-orange-600 dark:text-orange-400'>every role</span>
            </h2>
            <p className='text-muted-foreground max-w-xl mx-auto'>
              One login — but the system surfaces what matters to you, not everyone else's data.
            </p>
          </div>

          <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-4'>
            {roles.map((role) => {
              const RoleIcon = role.icon;
              return (
                <Card key={role.title} className={`ring-2 ${role.ring} border-0`}>
                  <CardHeader className='pb-3'>
                    <div className='flex items-center gap-3 mb-1'>
                      <div className={`p-2 rounded-lg bg-muted`}>
                        <RoleIcon className={`h-5 w-5 ${role.color}`} />
                      </div>
                      <CardTitle className='text-sm font-bold'>{role.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className='pt-0'>
                    <ul className='space-y-2'>
                      {role.items.map((item) => (
                        <li key={item} className='flex items-start gap-2 text-xs text-muted-foreground'>
                          <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${role.color} bg-current`} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className='relative overflow-hidden bg-gradient-to-br from-orange-600 via-orange-500 to-green-600 py-20 md:py-28'>
        <div className='container relative mx-auto px-4'>
          <Card className='mx-auto max-w-3xl bg-white/10 backdrop-blur-sm text-white border-white/20 shadow-2xl'>
            <CardContent className='p-8 md:p-12 text-center space-y-6'>
              <h2 className='text-3xl font-bold md:text-4xl leading-tight'>
                Your chapter already runs on Yi rhythms.
              </h2>
              <p className='text-lg opacity-95 max-w-xl mx-auto leading-relaxed'>
                Yi Connect is the only system that knows what AAA, Take Pride, and succession mean — without a configuration manual.
              </p>
              <div className='flex flex-col gap-4 sm:flex-row sm:justify-center pt-4'>
                <Link
                  href='/login'
                  className='inline-flex items-center justify-center gap-2 rounded-md bg-white text-orange-600 hover:bg-white/90 font-semibold px-8 py-3 transition-all shadow-lg hover:shadow-xl'
                >
                  Sign In to Dashboard
                  <ArrowRight className='h-5 w-5' />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className='border-t bg-gradient-to-b from-muted/30 to-muted/60'>
        <div className='container mx-auto px-4 py-12'>
          <div className='grid gap-8 md:grid-cols-2 lg:grid-cols-4 mb-8'>

            {/* Brand */}
            <div className='space-y-4'>
              <div className='flex items-center gap-2'>
                <div className='h-8 w-8 rounded-lg bg-gradient-to-br from-orange-600 to-green-600 text-white text-sm font-bold flex items-center justify-center'>
                  Yi
                </div>
                <span className='text-xl font-bold'>Connect</span>
              </div>
              <p className='text-sm text-muted-foreground leading-relaxed'>
                The Yi-native operating system for chapter and national leadership.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className='font-semibold mb-4'>Quick Links</h3>
              <ul className='space-y-2 text-sm text-muted-foreground'>
                <li>
                  <Link href='/login' className='hover:text-orange-600 dark:hover:text-orange-400 transition-colors'>
                    Sign In
                  </Link>
                </li>
              </ul>
            </div>

            {/* Core tools */}
            <div>
              <h3 className='font-semibold mb-4'>Core Tools</h3>
              <ul className='space-y-2 text-sm text-muted-foreground'>
                <li>Pathfinder (AAA Plans)</li>
                <li>Take Pride Awards</li>
                <li>Succession Pipeline</li>
                <li>Events & Health Cards</li>
              </ul>
            </div>

            {/* Portals */}
            <div>
              <h3 className='font-semibold mb-4'>Portals</h3>
              <ul className='space-y-2 text-sm text-muted-foreground'>
                <li>Chair &amp; Co-Chair</li>
                <li>Chapter Lead</li>
                <li>Industry Coordinator</li>
                <li>National Admin</li>
              </ul>
            </div>
          </div>

          <div className='border-t pt-8'>
            <div className='flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground'>
              <p>
                &copy;{' '}
                <Suspense fallback='2025'>
                  <CopyrightYear />
                </Suspense>{' '}
                Yi Connect. All rights reserved.
              </p>
              <p className='flex items-center gap-2'>
                Built for{' '}
                <span className='font-semibold text-orange-600 dark:text-orange-400'>
                  Young Indians
                </span>
              </p>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}

export const metadata = {
  title: 'Yi Connect — The Yi Chapter Operating System',
  description:
    'Events, AAA plans, succession, Take Pride, and national reporting — one system, Yi-native from day one.'
};
