/**
 * Communication Hub Documentation
 *
 * Module 7: Announcements, templates, audience segments, and communication analytics.
 */

import { DocPageHeader, MermaidDiagram, RoleAccessTable } from '@/components/docs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Lightbulb } from 'lucide-react';

const createAnnouncementChart = `flowchart TD
    A["Need to communicate<br/>with members"] --> B["Communications ><br/>New Announcement"]
    B --> C["Choose template<br/>or start fresh"]
    C --> D["Write subject<br/>and content"]
    D --> E["Select delivery<br/>channels"]
    E --> F["Choose audience<br/>or segment"]
    F --> G{{"Send immediately<br/>or schedule?"}}
    G -->|Immediate| H["Send Now"]
    G -->|Schedule| I["Set date/time"]
    I --> J["Save Scheduled"]
    H --> K["Announcement delivered<br/>Track engagement"]
    J --> K

    style A fill:#f0f9ff
    style K fill:#dcfce7
    style G fill:#fef3c7`;

const createTemplateChart = `flowchart TD
    A["Repetitive<br/>announcement type"] --> B["Communications ><br/>Templates > New"]
    B --> C["Name the template"]
    C --> D["Write content with<br/>placeholders"]
    D --> E["Add placeholders:<br/>{firstName}, {eventName}"]
    E --> F["Set default<br/>channels"]
    F --> G["Save template"]
    G --> H["Use template in<br/>future announcements"]

    style A fill:#f0f9ff
    style H fill:#dcfce7`;

const createSegmentChart = `flowchart TD
    A["Need targeted<br/>communication"] --> B["Communications ><br/>Segments > New"]
    B --> C["Name the segment"]
    C --> D["Define filter rules"]
    D --> E["Filter by roles"]
    E --> F["Filter by<br/>engagement range"]
    F --> G["Preview matching<br/>members"]
    G --> H{{"Count correct?"}}
    H -->|Yes| I["Save segment"]
    H -->|No| J["Adjust filters"]
    J --> D
    I --> K["Use in<br/>announcements"]

    style A fill:#f0f9ff
    style K fill:#dcfce7
    style H fill:#fef3c7`;

const trackAnalyticsChart = `flowchart TD
    A["Announcement<br/>sent"] --> B["Communications ><br/>Analytics"]
    B --> C["View delivery<br/>stats"]
    C --> D["Check open rates"]
    D --> E["Review click-through<br/>rates"]
    E --> F["Analyze by channel"]
    F --> G["Identify top<br/>performing content"]
    G --> H["Optimize future<br/>communications"]

    style A fill:#f0f9ff
    style H fill:#dcfce7`;

const roleAccesses = [
  {
    role: 'Super Admin / National Admin',
    access: 'full' as const,
    permissions: ['Full communication management', 'Cross-chapter broadcasts', 'All analytics access']
  },
  {
    role: 'Executive Member',
    access: 'full' as const,
    permissions: ['Create announcements', 'Manage templates', 'Create segments', 'View analytics']
  },
  {
    role: 'Chair',
    access: 'full' as const,
    permissions: ['Send announcements', 'Manage templates', 'View analytics']
  },
  {
    role: 'Co-Chair',
    access: 'limited' as const,
    permissions: ['Create announcements (approval required)', 'Use templates', 'View analytics']
  },
  {
    role: 'EC Member',
    access: 'view' as const,
    permissions: ['View sent announcements', 'View notifications']
  },
  {
    role: 'Yi Member',
    access: 'view' as const,
    permissions: ['Receive notifications', 'View announcements']
  }
];

export default function CommunicationsDocPage() {
  return (
    <div className="space-y-8">
      <DocPageHeader
        title="Communication Hub"
        description="Centralized platform for managing announcements, newsletters, notifications, and member communications with analytics tracking."
        icon={MessageSquare}
        moduleNumber={7}
      />

      {/* Purpose */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Purpose & Objectives</h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">
              The Communication Hub centralizes all chapter communications into one platform.
              It enables targeted messaging, reusable templates, and detailed analytics to
              measure engagement and optimize outreach.
            </p>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Multi-Channel</h4>
                <p className="text-sm text-muted-foreground">Email, WhatsApp, In-App</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Smart Templates</h4>
                <p className="text-sm text-muted-foreground">Dynamic placeholders</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Audience Segments</h4>
                <p className="text-sm text-muted-foreground">Targeted messaging</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Analytics</h4>
                <p className="text-sm text-muted-foreground">Engagement tracking</p>
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
              <CardTitle className="text-base">Announcement Management</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Create rich-text announcements</li>
                <li>- Multi-channel delivery (Email, WhatsApp, In-App)</li>
                <li>- Schedule for future delivery</li>
                <li>- Draft and preview before sending</li>
                <li>- Track delivery and engagement</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Message Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Reusable message templates</li>
                <li>- Dynamic placeholders ({"{{firstName}}"}, {"{{eventName}}"})</li>
                <li>- Template categories</li>
                <li>- Usage tracking</li>
                <li>- Quick template selection</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Audience Segments</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Create custom audience filters</li>
                <li>- Filter by role, engagement, skills</li>
                <li>- Save segments for reuse</li>
                <li>- Preview member count before sending</li>
                <li>- Combine multiple criteria</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Communication Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Delivery success rates</li>
                <li>- Open and read rates</li>
                <li>- Click-through tracking</li>
                <li>- Channel performance comparison</li>
                <li>- Engagement trends over time</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Delivery Channels */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Delivery Channels</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <p className="text-lg font-bold text-blue-600">Email</p>
                <p className="text-sm text-muted-foreground mt-1">
                  HTML-formatted emails with tracking. Best for detailed communications.
                </p>
              </div>
              <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <p className="text-lg font-bold text-green-600">WhatsApp</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Instant messaging for urgent updates. High read rates.
                </p>
              </div>
              <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                <p className="text-lg font-bold text-purple-600">In-App</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Push notifications and inbox messages within Yi Connect.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Role Access */}
      <RoleAccessTable accesses={roleAccesses} title="Role-Based Access" />

      {/* Workflows */}
      <section>
        <h2 className="text-xl font-semibold mb-4">User Workflows</h2>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 1: Create Announcement</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={createAnnouncementChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">Communications &gt; New Announcement</code></li>
                  <li>Choose a template to start with or create from scratch</li>
                  <li>Write subject line and announcement content</li>
                  <li>Select delivery channels (Email, WhatsApp, In-App)</li>
                  <li>Choose target audience: All Members, specific segment, or custom selection</li>
                  <li>Preview the announcement before sending</li>
                  <li>Send immediately or schedule for a future date/time</li>
                  <li>Track delivery and engagement in Analytics</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 2: Create Message Template</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={createTemplateChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">Communications &gt; Templates</code></li>
                  <li>Click &quot;New Template&quot;</li>
                  <li>Name the template (e.g., &quot;Event Reminder&quot;)</li>
                  <li>Write the content using placeholders for dynamic data</li>
                  <li>Available placeholders: <code className="bg-muted px-1 rounded">{"{firstName}"}</code>, <code className="bg-muted px-1 rounded">{"{lastName}"}</code>, <code className="bg-muted px-1 rounded">{"{eventName}"}</code>, <code className="bg-muted px-1 rounded">{"{eventDate}"}</code></li>
                  <li>Set default delivery channels</li>
                  <li>Save the template for future use</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 3: Create Audience Segment</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={createSegmentChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">Communications &gt; Segments</code></li>
                  <li>Click &quot;New Segment&quot;</li>
                  <li>Name the segment (e.g., &quot;High Engagement EC Members&quot;)</li>
                  <li>Define filter rules:
                    <ul className="ml-4 mt-1 space-y-1 list-disc list-inside">
                      <li>By role (EC Member, Chair, etc.)</li>
                      <li>By engagement score range (e.g., 80-100)</li>
                      <li>By skills or interests</li>
                    </ul>
                  </li>
                  <li>Preview matching members to verify</li>
                  <li>Save the segment</li>
                  <li>Use in future announcements for targeted messaging</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 4: Track Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={trackAnalyticsChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">Communications &gt; Analytics</code></li>
                  <li>View overall statistics: total sent, engagement rate, click-through</li>
                  <li>Filter by date range to analyze specific periods</li>
                  <li>Compare channel performance (Email vs WhatsApp vs In-App)</li>
                  <li>Identify top-performing announcements</li>
                  <li>Use insights to optimize future communications</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Available Placeholders */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Template Placeholders</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="font-medium mb-2">Member Placeholders</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li><code className="bg-muted px-1 rounded">{"{firstName}"}</code> - Member&apos;s first name</li>
                  <li><code className="bg-muted px-1 rounded">{"{lastName}"}</code> - Member&apos;s last name</li>
                  <li><code className="bg-muted px-1 rounded">{"{email}"}</code> - Member&apos;s email address</li>
                  <li><code className="bg-muted px-1 rounded">{"{role}"}</code> - Current role in chapter</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Event Placeholders</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li><code className="bg-muted px-1 rounded">{"{eventName}"}</code> - Event title</li>
                  <li><code className="bg-muted px-1 rounded">{"{eventDate}"}</code> - Event date</li>
                  <li><code className="bg-muted px-1 rounded">{"{eventVenue}"}</code> - Event location</li>
                  <li><code className="bg-muted px-1 rounded">{"{rsvpLink}"}</code> - RSVP URL</li>
                </ul>
              </div>
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
                <h4 className="font-medium">Use Templates for Recurring Messages</h4>
                <p className="text-sm text-muted-foreground">
                  Create templates for event reminders, meeting invites, and monthly updates.
                  This ensures consistent messaging and saves time.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Segment Your Audience</h4>
                <p className="text-sm text-muted-foreground">
                  Don&apos;t send every message to everyone. Create segments for EC members,
                  active volunteers, new members, etc. for more relevant communications.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Schedule Strategically</h4>
                <p className="text-sm text-muted-foreground">
                  Schedule announcements for optimal times. Weekday mornings typically
                  have higher engagement. Avoid sending during late nights or holidays.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Monitor Analytics</h4>
                <p className="text-sm text-muted-foreground">
                  Check analytics weekly to understand what content resonates. If WhatsApp
                  has higher engagement than email, prioritize that channel.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
