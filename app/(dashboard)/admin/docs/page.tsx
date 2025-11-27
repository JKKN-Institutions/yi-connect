/**
 * User Documentation Home Page
 *
 * Overview of Yi Connect with quick navigation to all modules
 * and system architecture diagram.
 */

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MermaidDiagram } from '@/components/docs';
import {
  BookOpen,
  Users,
  Building2,
  Calendar,
  Wallet,
  UserCog,
  Award,
  MessageSquare,
  FileText,
  Target,
  Globe,
  Briefcase,
  GraduationCap,
  Shield,
  Rocket,
  ArrowRight
} from 'lucide-react';

const modules = [
  {
    number: 1,
    name: 'Member Intelligence Hub',
    description: 'Manage member profiles, skills, engagement scores, and volunteer matching.',
    href: '/admin/docs/members',
    icon: Users,
    color: 'text-blue-500'
  },
  {
    number: 2,
    name: 'Stakeholder CRM',
    description: 'Track schools, colleges, industries, government, NGOs, vendors, and speakers.',
    href: '/admin/docs/stakeholders',
    icon: Building2,
    color: 'text-purple-500'
  },
  {
    number: 3,
    name: 'Event Lifecycle Manager',
    description: 'Create events, manage RSVPs, track attendance, and generate reports.',
    href: '/admin/docs/events',
    icon: Calendar,
    color: 'text-green-500'
  },
  {
    number: 4,
    name: 'Financial Command Center',
    description: 'Budget management, expense tracking, sponsorships, and reimbursements.',
    href: '/admin/docs/finance',
    icon: Wallet,
    color: 'text-yellow-500'
  },
  {
    number: 5,
    name: 'Succession & Leadership',
    description: 'Leadership pipeline, nominations, evaluations, and succession planning.',
    href: '/admin/docs/succession',
    icon: UserCog,
    color: 'text-orange-500'
  },
  {
    number: 6,
    name: 'Take Pride Awards',
    description: 'Award nominations, jury scoring, winner declarations, and leaderboards.',
    href: '/admin/docs/awards',
    icon: Award,
    color: 'text-pink-500'
  },
  {
    number: 7,
    name: 'Communication Hub',
    description: 'Announcements, notifications, templates, segments, and analytics.',
    href: '/admin/docs/communications',
    icon: MessageSquare,
    color: 'text-cyan-500'
  },
  {
    number: 8,
    name: 'Knowledge Management',
    description: 'Document library, wiki pages, best practices, and knowledge sharing.',
    href: '/admin/docs/knowledge',
    icon: FileText,
    color: 'text-indigo-500'
  },
  {
    number: 9,
    name: 'Vertical Performance',
    description: 'KPI tracking, vertical planning, performance rankings, and analytics.',
    href: '/admin/docs/verticals',
    icon: Target,
    color: 'text-red-500'
  },
  {
    number: 10,
    name: 'National Integration',
    description: 'Benchmarks, national events, broadcasts, and data synchronization.',
    href: '/admin/docs/national',
    icon: Globe,
    color: 'text-teal-500'
  },
  {
    name: 'Industrial Visits',
    description: 'Browse, book, and manage industrial visit programs.',
    href: '/admin/docs/industrial-visits',
    icon: Briefcase,
    color: 'text-amber-500'
  },
  {
    name: 'Opportunities',
    description: 'Post and apply for internships, jobs, and project opportunities.',
    href: '/admin/docs/opportunities',
    icon: GraduationCap,
    color: 'text-emerald-500'
  }
];

const systemArchitectureChart = `flowchart TB
    subgraph Core["Core Modules"]
        M1[Member Intelligence Hub]
        M2[Stakeholder CRM]
        M3[Event Lifecycle]
        M4[Financial Command]
    end

    subgraph Engagement["Engagement Modules"]
        M5[Succession Pipeline]
        M6[Take Pride Awards]
        M7[Communication Hub]
        M8[Knowledge Management]
    end

    subgraph Operations["Operations Modules"]
        M9[Vertical Performance]
        M10[National Integration]
        IV[Industrial Visits]
        OP[Opportunities]
    end

    M1 --> M3
    M1 --> M5
    M3 --> M4
    M3 --> M9
    M1 --> M6
    M7 --> M1
    M8 --> M3
    M9 --> M10`;

export default function DocsHomePage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-3 sm:space-y-4 pb-6 sm:pb-8 border-b">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-primary/10">
            <BookOpen className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Yi Connect User Guide</h1>
        <p className="text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
          Comprehensive documentation for the Yi Chapter Management System.
          Learn how to use all modules effectively with step-by-step workflows.
        </p>
      </div>

      {/* Quick Start */}
      <section>
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <Rocket className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          <h2 className="text-lg sm:text-xl font-semibold">Quick Start</h2>
        </div>
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Understand Your Role
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Learn about role hierarchy, permissions, and what you can access in each module.
              </p>
              <Link
                href="/admin/docs/roles"
                className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
              >
                View Roles & Permissions
                <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Common Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Create and manage events</li>
                <li>- Add new members to the chapter</li>
                <li>- Submit expense reports</li>
                <li>- Send announcements</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* System Architecture */}
      <section>
        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">System Architecture</h2>
        <Card>
          <CardContent className="pt-4 sm:pt-6 px-2 sm:px-6">
            <MermaidDiagram chart={systemArchitectureChart} />
          </CardContent>
        </Card>
        <p className="text-xs sm:text-sm text-muted-foreground mt-2 sm:mt-3">
          Yi Connect consists of 12 integrated modules. Data flows between modules automatically -
          for example, event attendance updates member engagement scores, and expenses link to budgets.
        </p>
      </section>

      {/* Module Grid */}
      <section>
        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Modules</h2>
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <Link key={module.name} href={module.href}>
              <Card className="h-full hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <module.icon className={`h-5 w-5 ${module.color}`} />
                    {module.number && (
                      <Badge variant="outline" className="text-xs">
                        #{module.number}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-base">{module.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    {module.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Help Section */}
      <section className="pt-4 sm:pt-6 border-t">
        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Need Help?</h2>
        <div className="bg-muted/50 rounded-lg p-4 sm:p-6">
          <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
            If you have questions about using Yi Connect or encounter issues:
          </p>
          <ul className="text-xs sm:text-sm space-y-2">
            <li className="flex items-start gap-2">
              <span className="font-medium shrink-0">1.</span>
              <span>Check the module-specific documentation for detailed workflows</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-medium shrink-0">2.</span>
              <span>Review the Roles & Permissions page to understand access levels</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-medium shrink-0">3.</span>
              <span>Contact your Chapter Chair or Executive Member for assistance</span>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
