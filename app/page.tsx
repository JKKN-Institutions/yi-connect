import Link from 'next/link';
import { Suspense } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
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
  CheckCircle2
} from 'lucide-react';
import { CopyrightYear } from '@/components/copyright-year';

const modules = [
  {
    icon: Users,
    title: 'Member Intelligence Hub',
    description:
      'Centralized member database with skills, availability, and engagement tracking',
    color: 'text-blue-600 dark:text-blue-400'
  },
  {
    icon: Building2,
    title: 'Stakeholder CRM',
    description:
      'Manage relationships with schools, industries, government, and NGOs',
    color: 'text-green-600 dark:text-green-400'
  },
  {
    icon: Calendar,
    title: 'Event Lifecycle Manager',
    description:
      'Automate event creation, RSVPs, volunteer assignments, and reporting',
    color: 'text-purple-600 dark:text-purple-400'
  },
  {
    icon: Wallet,
    title: 'Financial Command Center',
    description:
      'Budgeting, expense tracking, sponsorship pipelines, and analytics',
    color: 'text-orange-600 dark:text-orange-400'
  },
  {
    icon: TrendingUp,
    title: 'Succession Pipeline',
    description:
      'Digital leadership selection with nomination tracking and evaluation',
    color: 'text-pink-600 dark:text-pink-400'
  },
  {
    icon: Award,
    title: 'Take Pride Awards',
    description:
      'Nomination, jury scoring, and certificate generation automation',
    color: 'text-yellow-600 dark:text-yellow-400'
  },
  {
    icon: MessageSquare,
    title: 'Communication Hub',
    description:
      'Announcements, newsletters, and WhatsApp integration with analytics',
    color: 'text-cyan-600 dark:text-cyan-400'
  },
  {
    icon: BookOpen,
    title: 'Knowledge Management',
    description:
      'Digital repository for reports, templates, and best practices',
    color: 'text-indigo-600 dark:text-indigo-400'
  },
  {
    icon: BarChart3,
    title: 'Vertical Performance Tracker',
    description:
      'Real-time dashboards for vertical heads to track KPIs and budgets',
    color: 'text-red-600 dark:text-red-400'
  },
  {
    icon: Network,
    title: 'National Integration',
    description:
      'API-based data exchange for benchmarking and unified communications',
    color: 'text-teal-600 dark:text-teal-400'
  },
  {
    icon: Smartphone,
    title: 'Mobile Command Center',
    description:
      'Mobile-first dashboard with real-time access to events and analytics',
    color: 'text-violet-600 dark:text-violet-400'
  }
];

const benefits = [
  '80% reduction in manual coordination time',
  '100% data visibility for leadership decisions',
  '2× faster volunteer and event matching',
  'Fully digital succession and award workflows',
  'Real-time chapter health monitoring',
  'Predictive analytics for budget planning'
];

export default function Home() {
  return (
    <div className='min-h-screen bg-background'>
      {/* Hero Section */}
      <section className='relative overflow-hidden bg-gradient-to-br from-orange-50 via-background to-green-50 dark:from-orange-950/20 dark:via-background dark:to-green-950/20'>
        <div className='absolute inset-0 bg-grid-slate-200/50 dark:bg-grid-slate-800/50 [mask-image:linear-gradient(to_bottom,white,transparent)] pointer-events-none' />
        <div className='container relative mx-auto px-4 py-20 md:py-32'>
          <div className='mx-auto max-w-5xl text-center space-y-8'>
            <div className='inline-flex items-center gap-2 rounded-full bg-orange-100 dark:bg-orange-950/50 px-5 py-2.5 text-sm font-semibold text-orange-700 dark:text-orange-400 ring-1 ring-orange-200 dark:ring-orange-900'>
              <span className='relative flex h-2 w-2'>
                <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75'></span>
                <span className='relative inline-flex rounded-full h-2 w-2 bg-orange-600'></span>
              </span>
              Yi Chapter Management System
            </div>

            <h1 className='text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl'>
              <span className='block text-foreground mb-2'>Welcome to</span>
              <span className='block bg-gradient-to-r from-orange-600 via-orange-500 to-green-600 bg-clip-text text-transparent'>
                Yi Connect
              </span>
            </h1>

            <p className='mx-auto max-w-3xl text-xl text-muted-foreground md:text-2xl leading-relaxed'>
              Development of the Chapter & Nation by Digital Transformation
            </p>

            <p className='mx-auto max-w-2xl text-base text-muted-foreground md:text-lg'>
              A comprehensive digital platform designed to unify member
              operations, events, finance, communication, and leadership across
              Yi Chapters.
            </p>

            <div className='flex flex-col gap-4 sm:flex-row sm:justify-center pt-4'>
              <Link
                href='/login'
                className='inline-flex items-center justify-center gap-2 rounded-md bg-orange-600 hover:bg-orange-700 text-white font-semibold px-8 py-3 transition-all cursor-pointer shadow-lg hover:shadow-xl'
              >
                Get Started
                <ArrowRight className='h-5 w-5' />
              </Link>
              <Link
                href='/members'
                className='inline-flex items-center justify-center gap-2 rounded-md border-2 border-input bg-background hover:bg-accent hover:text-accent-foreground font-semibold px-8 py-3 transition-all cursor-pointer shadow-sm hover:shadow-md'
              >
                Explore Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Decorative bottom wave */}
        <div className='absolute bottom-0 left-0 right-0'>
          <svg
            viewBox='0 0 1440 120'
            className='w-full h-auto text-background fill-current'
          >
            <path d='M0,64L80,69.3C160,75,320,85,480,80C640,75,800,53,960,48C1120,43,1280,53,1360,58.7L1440,64L1440,120L1360,120C1280,120,1120,120,960,120C800,120,640,120,480,120C320,120,160,120,80,120L0,120Z'></path>
          </svg>
        </div>
      </section>

      {/* Stats Section */}
      <section className='container mx-auto px-4 py-16 md:py-20'>
        <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto'>
          <Card className='relative overflow-hidden border-orange-200 dark:border-orange-900 bg-gradient-to-br from-orange-50 to-background dark:from-orange-950/30 dark:to-background'>
            <CardContent className='p-6 text-center'>
              <div className='text-4xl font-bold text-orange-600 dark:text-orange-400 mb-2'>
                11
              </div>
              <div className='text-sm font-medium text-muted-foreground uppercase tracking-wide'>
                Integrated Modules
              </div>
            </CardContent>
          </Card>

          <Card className='relative overflow-hidden border-green-200 dark:border-green-900 bg-gradient-to-br from-green-50 to-background dark:from-green-950/30 dark:to-background'>
            <CardContent className='p-6 text-center'>
              <div className='text-4xl font-bold text-green-600 dark:text-green-400 mb-2'>
                80%
              </div>
              <div className='text-sm font-medium text-muted-foreground uppercase tracking-wide'>
                Time Reduction
              </div>
            </CardContent>
          </Card>

          <Card className='relative overflow-hidden border-blue-200 dark:border-blue-900 bg-gradient-to-br from-blue-50 to-background dark:from-blue-950/30 dark:to-background'>
            <CardContent className='p-6 text-center'>
              <div className='text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2'>
                100%
              </div>
              <div className='text-sm font-medium text-muted-foreground uppercase tracking-wide'>
                Data Visibility
              </div>
            </CardContent>
          </Card>

          <Card className='relative overflow-hidden border-purple-200 dark:border-purple-900 bg-gradient-to-br from-purple-50 to-background dark:from-purple-950/30 dark:to-background'>
            <CardContent className='p-6 text-center'>
              <div className='text-4xl font-bold text-purple-600 dark:text-purple-400 mb-2'>
                2×
              </div>
              <div className='text-sm font-medium text-muted-foreground uppercase tracking-wide'>
                Faster Matching
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Benefits Section */}
      <section className='bg-muted/30 py-16 md:py-20'>
        <div className='container mx-auto px-4'>
          <div className='mx-auto max-w-6xl'>
            <div className='text-center mb-12 space-y-3'>
              <h2 className='text-3xl md:text-4xl font-bold'>
                Why Choose{' '}
                <span className='text-orange-600 dark:text-orange-400'>
                  Yi Connect
                </span>
              </h2>
              <p className='text-muted-foreground max-w-2xl mx-auto'>
                Transform your chapter operations with powerful automation and
                real-time insights
              </p>
            </div>
            <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
              {benefits.map((benefit) => (
                <Card
                  key={benefit}
                  className='group border-2 hover:shadow-lg transition-all hover:border-orange-200 dark:hover:border-orange-900 bg-card'
                >
                  <CardContent className='flex items-start gap-4 p-6'>
                    <div className='shrink-0'>
                      <div className='flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/50 group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors'>
                        <CheckCircle2 className='h-6 w-6 text-green-600 dark:text-green-400' />
                      </div>
                    </div>
                    <div className='flex-1 pt-1'>
                      <p className='text-base font-medium leading-relaxed text-foreground'>
                        {benefit}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Modules Section */}
      <section className='container mx-auto px-4 py-16 md:py-24'>
        <div className='mx-auto max-w-7xl'>
          <div className='mb-16 text-center space-y-4'>
            <div className='inline-block rounded-full bg-gradient-to-r from-orange-100 to-green-100 dark:from-orange-950/50 dark:to-green-950/50 px-4 py-2 text-sm font-semibold text-orange-700 dark:text-orange-400'>
              Complete Solution
            </div>
            <h2 className='text-3xl md:text-4xl font-bold'>
              11 Powerful{' '}
              <span className='text-transparent bg-gradient-to-r from-orange-600 to-green-600 bg-clip-text'>
                Integrated Modules
              </span>
            </h2>
            <p className='text-muted-foreground max-w-2xl mx-auto text-lg'>
              A complete ecosystem to streamline chapter operations, enhance
              collaboration, and enable data-driven decision making.
            </p>
          </div>
          <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
            {modules.map((module, index) => {
              const Icon = module.icon;
              return (
                <Card
                  key={module.title}
                  className='group relative overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1 border-2 hover:border-orange-200 dark:hover:border-orange-900'
                >
                  <div className='absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-orange-100/50 to-green-100/50 dark:from-orange-950/30 dark:to-green-950/30 rounded-bl-full' />
                  <CardHeader className='relative'>
                    <div className='flex items-start justify-between mb-3'>
                      <div className='p-3 rounded-xl bg-gradient-to-br from-background to-muted ring-2 ring-orange-100 dark:ring-orange-900/50 group-hover:ring-orange-200 dark:group-hover:ring-orange-800 transition-all'>
                        <Icon className={`h-7 w-7 ${module.color}`} />
                      </div>
                      <div className='text-xs font-bold text-muted-foreground/40'>
                        #{String(index + 1).padStart(2, '0')}
                      </div>
                    </div>
                    <CardTitle className='text-base leading-tight group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors'>
                      {module.title}
                    </CardTitle>
                    <CardDescription className='text-xs leading-relaxed'>
                      {module.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className='relative overflow-hidden bg-gradient-to-br from-orange-600 via-orange-500 to-green-600 py-20 md:py-28'>
        <div className='absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(to_bottom,white,transparent)] pointer-events-none' />
        <div className='container relative mx-auto px-4'>
          <Card className='mx-auto max-w-4xl bg-white/10 backdrop-blur-sm text-white border-white/20 shadow-2xl'>
            <CardContent className='p-8 md:p-12 text-center space-y-6'>
              <div className='inline-block'>
                <div className='inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold'>
                  <span className='relative flex h-2 w-2'>
                    <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75'></span>
                    <span className='relative inline-flex rounded-full h-2 w-2 bg-white'></span>
                  </span>
                  Start Your Digital Transformation
                </div>
              </div>

              <h2 className='text-3xl font-bold md:text-5xl leading-tight'>
                Ready to Transform Your Chapter?
              </h2>

              <p className='text-lg md:text-xl opacity-95 max-w-2xl mx-auto leading-relaxed'>
                Join the digital revolution and experience{' '}
                <span className='font-bold'>80% reduction</span> in manual
                coordination,{' '}
                <span className='font-bold'>100% data visibility</span>, and a
                foundation for AI-powered chapter intelligence.
              </p>

              <div className='flex flex-col gap-4 sm:flex-row sm:justify-center pt-6'>
                <Link
                  href='/login'
                  className='inline-flex items-center justify-center gap-2 rounded-md bg-white text-orange-600 hover:bg-white/90 font-semibold px-8 py-3 transition-all cursor-pointer shadow-lg hover:shadow-xl'
                >
                  Sign In to Dashboard
                  <ArrowRight className='h-5 w-5' />
                </Link>
                <Link
                  href='/members'
                  className='inline-flex items-center justify-center gap-2 rounded-md bg-transparent text-white border-2 border-white hover:bg-white/10 font-semibold px-8 py-3 transition-all cursor-pointer shadow-sm hover:shadow-md'
                >
                  Explore Features
                </Link>
              </div>

              <div className='pt-8 grid grid-cols-3 gap-6 max-w-2xl mx-auto border-t border-white/20'>
                <div>
                  <div className='text-3xl font-bold mb-1'>11</div>
                  <div className='text-xs opacity-80 uppercase tracking-wide'>
                    Modules
                  </div>
                </div>
                <div>
                  <div className='text-3xl font-bold mb-1'>80%</div>
                  <div className='text-xs opacity-80 uppercase tracking-wide'>
                    Time Saved
                  </div>
                </div>
                <div>
                  <div className='text-3xl font-bold mb-1'>100%</div>
                  <div className='text-xs opacity-80 uppercase tracking-wide'>
                    Visibility
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className='border-t bg-gradient-to-b from-muted/30 to-muted/60'>
        <div className='container mx-auto px-4 py-12'>
          <div className='grid gap-8 md:grid-cols-2 lg:grid-cols-4 mb-8'>
            {/* Brand Column */}
            <div className='space-y-4'>
              <div className='flex items-center gap-2'>
                <h1 className='h-8 w-8 rounded-lg bg-gradient-to-br from-orange-600 to-green-600 text-white text-2xl font-bold flex items-center justify-center'>
                  Yi
                </h1>
                <h1 className='text-2xl font-bold'>Connect</h1>
              </div>
              <p className='text-sm text-muted-foreground leading-relaxed'>
                Empowering Yi Chapters through digital transformation and
                data-driven decision making.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className='font-semibold mb-4'>Quick Links</h3>
              <ul className='space-y-2 text-sm text-muted-foreground'>
                <li>
                  <Link
                    href='/login'
                    className='hover:text-orange-600 dark:hover:text-orange-400 transition-colors'
                  >
                    Sign In
                  </Link>
                </li>
                <li>
                  <Link
                    href='/members'
                    className='hover:text-orange-600 dark:hover:text-orange-400 transition-colors'
                  >
                    Dashboard
                  </Link>
                </li>
              </ul>
            </div>

            {/* Modules */}
            <div>
              <h3 className='font-semibold mb-4'>Core Modules</h3>
              <ul className='space-y-2 text-sm text-muted-foreground'>
                <li>Member Intelligence Hub</li>
                <li>Event Lifecycle Manager</li>
                <li>Financial Command Center</li>
                <li>Stakeholder CRM</li>
              </ul>
            </div>

            {/* Stats */}
            <div>
              <h3 className='font-semibold mb-4'>Impact</h3>
              <div className='space-y-3'>
                <div className='flex items-baseline gap-2'>
                  <span className='text-2xl font-bold text-orange-600 dark:text-orange-400'>
                    80%
                  </span>
                  <span className='text-xs text-muted-foreground'>
                    Time Reduction
                  </span>
                </div>
                <div className='flex items-baseline gap-2'>
                  <span className='text-2xl font-bold text-green-600 dark:text-green-400'>
                    11
                  </span>
                  <span className='text-xs text-muted-foreground'>
                    Integrated Modules
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className='border-t pt-8'>
            <div className='flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground'>
              <p>
                ©{' '}
                <Suspense fallback='2025'>
                  <CopyrightYear />
                </Suspense>{' '}
                Yi Connect. All rights reserved.
              </p>
              <p className='flex items-center gap-2'>
                Powered by{' '}
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
  title: 'Yi Connect - Chapter Management System',
  description:
    'Comprehensive digital platform for Yi Chapter management with 11 integrated modules for member operations, events, finance, and leadership.'
};
