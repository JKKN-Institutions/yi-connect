/**
 * Event Lifecycle Manager Documentation
 *
 * Module 3: Event creation, RSVPs, attendance, volunteer management, and reporting.
 */

import { DocPageHeader, MermaidDiagram, RoleAccessTable } from '@/components/docs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Lightbulb } from 'lucide-react';

const createEventChart = `flowchart TD
    A["Plan new event"] --> B["Events > Create Event"]
    B --> C["Fill basic info<br/>Title, Date, Venue"]
    C --> D["Set capacity<br/>and budget"]
    D --> E["Select category<br/>and vertical"]
    E --> F["Generate RSVP link"]
    F --> G["Share via<br/>WhatsApp/Email"]
    G --> H["Track RSVPs<br/>in dashboard"]

    style A fill:#f0f9ff
    style H fill:#dcfce7`;

const eventDayChart = `flowchart TD
    A["Event day<br/>arrives"] --> B["Open event<br/>in app"]
    B --> C["Enable Check-in<br/>Mode"]
    C --> D["Mark attendance<br/>via QR/manual"]
    D --> E["Log expenses<br/>as they occur"]
    E --> F["Upload photos"]
    F --> G["Event concludes"]
    G --> H["Generate<br/>post-event report"]

    style A fill:#f0f9ff
    style H fill:#dcfce7`;

const volunteerChart = `flowchart TD
    A["Event created"] --> B["Go to Volunteers tab"]
    B --> C["System suggests<br/>based on skills"]
    C --> D["Review<br/>recommendations"]
    D --> E["Assign roles:<br/>MC, Coordinator,<br/>Registration, etc."]
    E --> F["Notifications<br/>sent to volunteers"]
    F --> G["Track volunteer<br/>confirmations"]

    style A fill:#f0f9ff
    style G fill:#dcfce7`;

const roleAccesses = [
  {
    role: 'Super Admin / National Admin',
    access: 'full' as const,
    permissions: ['Full event management', 'Cross-chapter events', 'All analytics']
  },
  {
    role: 'Executive Member / Chair',
    access: 'full' as const,
    permissions: ['Create/edit/delete events', 'Approve budgets', 'Manage volunteers', 'Generate reports']
  },
  {
    role: 'Co-Chair',
    access: 'limited' as const,
    permissions: ['Create events', 'Manage RSVPs', 'View reports']
  },
  {
    role: 'EC Member',
    access: 'limited' as const,
    permissions: ['Create events', 'Manage attendance', 'Assign volunteers']
  },
  {
    role: 'Yi Member',
    access: 'limited' as const,
    permissions: ['View events', 'RSVP', 'Check-in at events']
  }
];

export default function EventsDocPage() {
  return (
    <div className="space-y-8">
      <DocPageHeader
        title="Event Lifecycle Manager"
        description="Complete event management from planning to post-event reporting, with automated RSVPs, attendance tracking, and volunteer coordination."
        icon={Calendar}
        moduleNumber={3}
      />

      {/* Purpose */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Purpose & Objectives</h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">
              The Event Lifecycle Manager reduces 40+ hours/month in event coordination by automating
              planning, RSVPs, logistics, and reporting. It provides a single platform for the entire
              event lifecycle.
            </p>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Smart Planning</h4>
                <p className="text-sm text-muted-foreground">Templates from past events</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">RSVP System</h4>
                <p className="text-sm text-muted-foreground">Real-time tracking with reminders</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Day-of Mode</h4>
                <p className="text-sm text-muted-foreground">Mobile check-in & expense logging</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Auto Reports</h4>
                <p className="text-sm text-muted-foreground">Instant post-event summaries</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Key Features */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Key Features</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Event Creation</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Title, description, banner image</li>
                <li>- Date, time, venue (or virtual link)</li>
                <li>- Capacity limits and budget allocation</li>
                <li>- Category and vertical assignment</li>
                <li>- Template reuse from past events</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">RSVP Management</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Shareable RSVP link</li>
                <li>- Real-time response tracking</li>
                <li>- Automatic reminders (3 days, 1 day before)</li>
                <li>- Guest count tracking</li>
                <li>- Waitlist management when full</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Attendance Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- QR code check-in</li>
                <li>- Manual attendance marking</li>
                <li>- Real-time attendee count</li>
                <li>- Late arrival tracking</li>
                <li>- Auto-update member engagement scores</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Post-Event Reporting</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Auto-generated attendance summary</li>
                <li>- Expense reconciliation</li>
                <li>- Photo gallery</li>
                <li>- Feedback collection</li>
                <li>- Shareable PDF report</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Role Access */}
      <RoleAccessTable accesses={roleAccesses} title="Role-Based Access" />

      {/* Workflows */}
      <section>
        <h2 className="text-xl font-semibold mb-4">User Workflows</h2>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 1: Create Event</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={createEventChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">Events &gt; Create Event</code></li>
                  <li>Fill in event title, description, and upload banner image</li>
                  <li>Set date, time, and venue (or add virtual meeting link)</li>
                  <li>Define capacity limit and allocate budget</li>
                  <li>Select event category and assign to vertical</li>
                  <li>Publish event - RSVP link is automatically generated</li>
                  <li>Share the RSVP link via WhatsApp or email</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 2: Event Day Operations</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={eventDayChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Open the event in Yi Connect (works on mobile)</li>
                  <li>Enable &quot;Check-in Mode&quot; from the event dashboard</li>
                  <li>Mark attendance using QR scanner or manual search</li>
                  <li>Log any expenses incurred during the event</li>
                  <li>Upload photos to the event gallery</li>
                  <li>After event ends, click &quot;Generate Report&quot;</li>
                  <li>Report is auto-archived to Knowledge Management</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 3: Volunteer Assignment</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={volunteerChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Open event and go to &quot;Volunteers&quot; tab</li>
                  <li>System suggests members based on required skills</li>
                  <li>Review recommendations - sorted by engagement score</li>
                  <li>Assign specific roles (MC, Registration, Logistics, etc.)</li>
                  <li>Click &quot;Notify&quot; to send assignment emails</li>
                  <li>Track confirmations in the volunteer list</li>
                  <li>Post-event: log volunteer hours for engagement tracking</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Automation Triggers */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Automation Triggers</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {[
                { trigger: 'Low RSVP Rate (<50%, 5 days before)', action: 'Email Chair with reminder suggestion' },
                { trigger: 'Budget Overrun (>20%)', action: 'Alert Chair and EM for approval' },
                { trigger: 'Venue Conflict', action: 'Red alert + suggest alternate venues' },
                { trigger: 'Missing Role (3 days before)', action: 'Suggest available member for unfilled role' },
                { trigger: 'High Satisfaction (90%+)', action: 'Auto-tag as reusable template' }
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4 pb-4 border-b last:border-0">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.trigger}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">{item.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Tips */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Tips & Best Practices</h2>
        <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="space-y-3">
              <div>
                <h4 className="font-medium">Use Templates</h4>
                <p className="text-sm text-muted-foreground">
                  Copy from similar past events to pre-fill venue, budget, and volunteer roles.
                  Saves 30+ minutes per event creation.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Send Reminders</h4>
                <p className="text-sm text-muted-foreground">
                  Automatic reminders go out 3 days and 1 day before. For critical events,
                  send a personal WhatsApp reminder the morning of.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Complete Reports Same Day</h4>
                <p className="text-sm text-muted-foreground">
                  Generate the post-event report while details are fresh. Upload photos
                  immediately for automatic archival.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
