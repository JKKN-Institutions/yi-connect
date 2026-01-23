/**
 * User Guide Page
 *
 * Comprehensive help documentation for Yi Connect users.
 * Organized by feature modules with collapsible sections.
 */

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  BookOpen,
  Users,
  Calendar,
  Wallet,
  Building2,
  Award,
  MessageSquare,
  Target,
  Settings,
  HelpCircle,
  Rocket,
  LayoutDashboard,
  FileText,
  Mail,
  Phone,
  Bug,
  ChevronRight,
  Lightbulb,
  CheckCircle2,
  GraduationCap,
} from 'lucide-react'

export const metadata = {
  title: 'User Guide - Yi Connect',
  description: 'Learn how to use Yi Connect effectively',
}

export default function UserGuidePage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Guide</h1>
            <p className="text-muted-foreground">
              Everything you need to know to get the most out of Yi Connect
            </p>
          </div>
        </div>
      </div>

      {/* Quick Start Section */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            <CardTitle>Getting Started</CardTitle>
          </div>
          <CardDescription>
            New to Yi Connect? Follow these steps to get up and running quickly
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <QuickStartStep
              number={1}
              title="Complete Your Profile"
              description="Add your photo, contact details, and professional information"
              href="/settings/profile"
            />
            <QuickStartStep
              number={2}
              title="Explore the Dashboard"
              description="View key metrics, upcoming events, and quick actions"
              href="/dashboard"
            />
            <QuickStartStep
              number={3}
              title="Join Events"
              description="Browse upcoming events and register your attendance"
              href="/events"
            />
          </div>
        </CardContent>
      </Card>

      {/* Main Content - Organized by Feature */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Members & Engagement */}
        <FeatureGuideCard
          icon={Users}
          title="Members"
          description="View and manage chapter members"
          color="blue"
        >
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="view-members">
              <AccordionTrigger>How do I view member profiles?</AccordionTrigger>
              <AccordionContent>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                  <li>Navigate to <strong>Members</strong> from the sidebar</li>
                  <li>Browse the member list or use the search bar</li>
                  <li>Click on any member to view their full profile</li>
                  <li>View their engagement score, skills, and event history</li>
                </ol>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="member-analytics">
              <AccordionTrigger>Understanding engagement scores</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground mb-2">
                  Engagement scores are calculated based on:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Event attendance and participation</li>
                  <li>Committee involvement</li>
                  <li>Volunteer activities</li>
                  <li>Profile completeness</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="add-member">
              <AccordionTrigger>How do I add new members?</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  Leadership members can add new members by going to{' '}
                  <strong>Members &gt; Add Member</strong>. Fill in the required
                  details including email, name, and membership type. The new member
                  will receive an invitation email to set up their account.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </FeatureGuideCard>

        {/* Events */}
        <FeatureGuideCard
          icon={Calendar}
          title="Events"
          description="Create and manage chapter events"
          color="green"
        >
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="create-event">
              <AccordionTrigger>How do I create an event?</AccordionTrigger>
              <AccordionContent>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                  <li>Go to <strong>Events &gt; New Event</strong></li>
                  <li>Fill in event details (title, date, venue, description)</li>
                  <li>Select the event category and vertical</li>
                  <li>Add an event banner image (optional)</li>
                  <li>Click <strong>Create Event</strong> to save as draft</li>
                  <li>Publish when ready to make it visible to members</li>
                </ol>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="event-rsvp">
              <AccordionTrigger>Managing RSVPs and attendance</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground mb-2">
                  Track who is attending your events:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>View RSVP list on the event page</li>
                  <li>Mark attendance during or after the event</li>
                  <li>Download attendance reports for documentation</li>
                  <li>Send reminders to registered attendees</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="event-reports">
              <AccordionTrigger>Post-event reporting</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  After an event, add a post-event report including photos, outcomes,
                  and feedback. This helps track chapter activities and can be
                  shared with national for recognition.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </FeatureGuideCard>

        {/* Finance */}
        <FeatureGuideCard
          icon={Wallet}
          title="Finance"
          description="Budget tracking and expense management"
          color="purple"
        >
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="view-budget">
              <AccordionTrigger>Viewing budget and expenses</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  Navigate to <strong>Finance</strong> to see your chapter budget
                  overview, expense breakdown by category, and budget utilization
                  percentage. Use filters to view specific time periods or categories.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="submit-expense">
              <AccordionTrigger>Submitting expenses</AccordionTrigger>
              <AccordionContent>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                  <li>Go to <strong>Finance &gt; Expenses &gt; New</strong></li>
                  <li>Select the expense category and related event (if any)</li>
                  <li>Enter amount and description</li>
                  <li>Upload receipts or invoices</li>
                  <li>Submit for approval</li>
                </ol>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="reimbursement">
              <AccordionTrigger>Reimbursement process</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  Submitted expenses go through an approval workflow. Once approved,
                  reimbursements are processed according to your chapter policy.
                  Track the status of your submissions in the Finance section.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </FeatureGuideCard>

        {/* Stakeholders */}
        <FeatureGuideCard
          icon={Building2}
          title="Stakeholders"
          description="Manage external relationships"
          color="orange"
        >
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="stakeholder-types">
              <AccordionTrigger>Types of stakeholders</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground mb-2">
                  Yi Connect tracks various stakeholder categories:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li><strong>Schools</strong> - For educational outreach</li>
                  <li><strong>Colleges</strong> - Partnership institutions</li>
                  <li><strong>Industries</strong> - Corporate partners</li>
                  <li><strong>Government</strong> - Public sector contacts</li>
                  <li><strong>NGOs</strong> - Non-profit collaborations</li>
                  <li><strong>Vendors</strong> - Service providers</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="health-scores">
              <AccordionTrigger>Understanding health scores</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  Health scores indicate the strength of your relationship with each
                  stakeholder. They are calculated based on recent interactions,
                  event collaborations, and communication frequency. Higher scores
                  indicate stronger, more active relationships.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="add-stakeholder">
              <AccordionTrigger>Adding a new stakeholder</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  Go to <strong>Stakeholders &gt; Add New</strong>. Fill in the
                  organization details, primary contact information, and relationship
                  type. Log initial interactions to start building the relationship
                  history.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </FeatureGuideCard>

        {/* Awards */}
        <FeatureGuideCard
          icon={Award}
          title="Awards"
          description="Take Pride Award nominations"
          color="yellow"
        >
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="nominate">
              <AccordionTrigger>How to nominate someone</AccordionTrigger>
              <AccordionContent>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                  <li>Go to <strong>Awards &gt; Nominate</strong></li>
                  <li>Select the award category</li>
                  <li>Choose the member you want to nominate</li>
                  <li>Write a compelling nomination statement</li>
                  <li>Submit before the deadline</li>
                </ol>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="award-categories">
              <AccordionTrigger>Award categories</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  Take Pride Awards recognize excellence in various categories
                  including leadership, community service, innovation, and chapter
                  growth. Check the Awards section for current categories and
                  nomination criteria.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </FeatureGuideCard>

        {/* Communications */}
        <FeatureGuideCard
          icon={MessageSquare}
          title="Communications"
          description="Announcements and messaging"
          color="teal"
        >
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="announcements">
              <AccordionTrigger>Sending announcements</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  Leadership can send announcements to the entire chapter or specific
                  groups. Go to <strong>Communications &gt; Announcements &gt; New</strong>
                  to compose and send. Choose delivery channels (in-app, email,
                  WhatsApp) based on urgency.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="whatsapp">
              <AccordionTrigger>WhatsApp integration</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  Connect your WhatsApp to receive event reminders and important
                  announcements. Go to <strong>Settings &gt; WhatsApp</strong> to
                  set up the integration. You control which notifications you receive.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </FeatureGuideCard>

        {/* Knowledge Base */}
        <FeatureGuideCard
          icon={FileText}
          title="Knowledge Base"
          description="Documents and resources"
          color="indigo"
        >
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="browse-docs">
              <AccordionTrigger>Browsing documents</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  The Knowledge Base contains templates, guides, best practices,
                  and important documents. Use categories and search to find what
                  you need. Bookmark frequently used documents for quick access.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="upload-docs">
              <AccordionTrigger>Uploading documents</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  Leadership members can upload documents to share with the chapter.
                  Go to <strong>Knowledge &gt; Documents &gt; Upload</strong>.
                  Add proper categorization and descriptions to help others find
                  your documents easily.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </FeatureGuideCard>

        {/* Verticals */}
        <FeatureGuideCard
          icon={Target}
          title="Verticals"
          description="Track vertical performance"
          color="pink"
        >
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="vertical-dashboard">
              <AccordionTrigger>Vertical dashboards</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  Each vertical has its own dashboard showing KPIs, events, and
                  progress. Vertical heads can track performance and compare against
                  targets. View rankings to see how your vertical compares to others.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="kpi-tracking">
              <AccordionTrigger>KPI tracking</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  Key Performance Indicators are automatically calculated based on
                  events conducted, member participation, and outcomes achieved.
                  Update event reports promptly to ensure accurate KPI tracking.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </FeatureGuideCard>
      </div>

      {/* Settings & Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Settings & Profile</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="profile-settings">
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Profile settings
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground mb-3">
                  Keep your profile up to date for better engagement tracking and
                  networking opportunities:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li><strong>Photo</strong> - Add a professional headshot</li>
                  <li><strong>Contact</strong> - Verify email and phone number</li>
                  <li><strong>Skills</strong> - List your professional expertise</li>
                  <li><strong>Company</strong> - Add your workplace details</li>
                  <li><strong>Availability</strong> - Set your volunteer availability</li>
                </ul>
                <div className="mt-4">
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/settings/profile">
                      Go to Profile Settings
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="notification-settings">
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Notification preferences
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  Control how and when you receive notifications. You can customize
                  settings for event reminders, announcements, and other communications.
                  WhatsApp notifications can be enabled in Settings &gt; WhatsApp.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Tips & Best Practices */}
      <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-green-600" />
            <CardTitle className="text-lg">Tips for Success</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <TipCard
              icon={CheckCircle2}
              title="Complete Your Profile"
              description="A complete profile improves your engagement score and helps with volunteer matching"
            />
            <TipCard
              icon={Calendar}
              title="RSVP to Events Early"
              description="Early RSVPs help organizers plan better and ensure you get event updates"
            />
            <TipCard
              icon={FileText}
              title="Document Activities"
              description="Log your participation and volunteer hours to build your Yi track record"
            />
            <TipCard
              icon={GraduationCap}
              title="Explore All Features"
              description="Yi Connect has many features - take time to explore the sidebar menu"
            />
          </div>
        </CardContent>
      </Card>

      {/* Support Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Need Help?</CardTitle>
          </div>
          <CardDescription>
            Cannot find what you are looking for? Reach out for support
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <SupportCard
              icon={Bug}
              title="Report a Bug"
              description="Found something not working? Use the bug reporter"
              action="Use the feedback button in the bottom right corner of any page"
            />
            <SupportCard
              icon={Mail}
              title="Email Support"
              description="For general inquiries"
              action="Contact your chapter leadership or national support"
            />
            <SupportCard
              icon={Phone}
              title="Urgent Issues"
              description="For time-sensitive matters"
              action="Reach out to your Chapter Chair or EC members directly"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function QuickStartStep({
  number,
  title,
  description,
  href,
}: {
  number: number
  title: string
  description: string
  href: string
}) {
  return (
    <Link href={href} className="block">
      <div className="flex items-start gap-3 p-4 rounded-lg border bg-background hover:bg-muted/50 transition-colors">
        <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm shrink-0">
          {number}
        </div>
        <div className="space-y-1">
          <p className="font-medium text-sm">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </Link>
  )
}

function FeatureGuideCard({
  icon: Icon,
  title,
  description,
  color,
  children,
}: {
  icon: React.ElementType
  title: string
  description: string
  color: string
  children: React.ReactNode
}) {
  const colorClasses: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
    green: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' },
    purple: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400' },
    orange: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400' },
    yellow: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400' },
    teal: { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-600 dark:text-teal-400' },
    indigo: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-400' },
    pink: { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-600 dark:text-pink-400' },
  }

  const { bg, text } = colorClasses[color] || colorClasses.blue

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className={`h-9 w-9 rounded-lg ${bg} flex items-center justify-center`}>
            <Icon className={`h-5 w-5 ${text}`} />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  )
}

function TipCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function SupportCard({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType
  title: string
  description: string
  action: string
}) {
  return (
    <div className="p-4 rounded-lg border space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <p className="font-medium text-sm">{title}</p>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <p className="text-xs text-primary">{action}</p>
    </div>
  )
}
