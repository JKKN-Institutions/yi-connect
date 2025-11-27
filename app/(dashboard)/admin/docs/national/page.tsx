/**
 * National Integration Layer Documentation
 *
 * Module 10: API-based data exchange, benchmarking, and national event registration.
 */

import { DocPageHeader, MermaidDiagram, RoleAccessTable } from '@/components/docs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe, Lightbulb } from 'lucide-react';

const viewDashboardChart = `flowchart TD
    A["Check national<br/>integration status"] --> B["National ><br/>Dashboard"]
    B --> C["View sync<br/>health score"]
    C --> D["Check benchmark<br/>ranking"]
    D --> E["See upcoming<br/>national events"]
    E --> F["Review unread<br/>broadcasts"]
    F --> G["Take action<br/>as needed"]

    style A fill:#f0f9ff
    style G fill:#dcfce7`;

const registerEventChart = `flowchart TD
    A["National event<br/>announced"] --> B["National ><br/>Events"]
    B --> C["Browse upcoming<br/>events"]
    C --> D["Select event:<br/>RCM/Summit/Conclave"]
    D --> E["View event<br/>details"]
    E --> F["Register members<br/>from chapter"]
    F --> G["Submit<br/>registration"]
    G --> H["Confirmation<br/>received"]
    H --> I["Event added to<br/>chapter calendar"]

    style A fill:#f0f9ff
    style I fill:#dcfce7`;

const viewBenchmarksChart = `flowchart TD
    A["Compare chapter<br/>performance"] --> B["National ><br/>Benchmarks"]
    B --> C["View overall<br/>ranking"]
    C --> D["See metrics<br/>comparison"]
    D --> E["Filter by<br/>category"]
    E --> F["Identify<br/>improvement areas"]
    F --> G["Set goals based<br/>on benchmarks"]

    style A fill:#f0f9ff
    style G fill:#dcfce7`;

const manageSyncChart = `flowchart TD
    A["Sync issue<br/>detected"] --> B["National ><br/>Sync Management"]
    B --> C["Check sync<br/>health status"]
    C --> D["View recent<br/>sync logs"]
    D --> E{{"Conflicts<br/>pending?"}}
    E -->|Yes| F["Resolve data<br/>conflicts"]
    E -->|No| G["All clear"]
    F --> H["Choose local<br/>or national data"]
    H --> I["Trigger manual<br/>sync if needed"]
    G --> I
    I --> J["Sync health<br/>restored"]

    style A fill:#f0f9ff
    style J fill:#dcfce7
    style E fill:#fef3c7`;

const roleAccesses = [
  {
    role: 'Super Admin',
    access: 'full' as const,
    permissions: ['Full national integration access', 'Configure sync settings', 'Manage API keys', 'Resolve conflicts']
  },
  {
    role: 'National Admin',
    access: 'full' as const,
    permissions: ['Full national access', 'Register for events', 'View benchmarks', 'Manage sync']
  },
  {
    role: 'Executive Member / Chair',
    access: 'limited' as const,
    permissions: ['View benchmarks', 'View national events', 'Read broadcasts']
  },
  {
    role: 'Co-Chair',
    access: 'view' as const,
    permissions: ['View benchmarks', 'View broadcasts']
  },
  {
    role: 'EC Member',
    access: 'none' as const,
    permissions: ['No direct access to national module']
  },
  {
    role: 'Yi Member',
    access: 'none' as const,
    permissions: ['No access to national module']
  }
];

export default function NationalDocPage() {
  return (
    <div className="space-y-8">
      <DocPageHeader
        title="National Integration Layer"
        description="API-based data exchange between chapters and Yi National systems for benchmarking, event registration, and unified communications."
        icon={Globe}
        moduleNumber={10}
      />

      {/* Purpose */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Purpose & Objectives</h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">
              The National Integration Layer connects individual chapters with Yi National systems.
              It enables data synchronization, performance benchmarking, national event registration,
              and unified communications across all Yi chapters.
            </p>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Data Sync</h4>
                <p className="text-sm text-muted-foreground">Automatic synchronization</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Benchmarking</h4>
                <p className="text-sm text-muted-foreground">Cross-chapter comparison</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">National Events</h4>
                <p className="text-sm text-muted-foreground">RCMs, Summits, Conclaves</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Broadcasts</h4>
                <p className="text-sm text-muted-foreground">National communications</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Integration Features */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Integration Features</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Data Synchronization</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Automatic scheduled syncs</li>
                <li>- Manual sync on demand</li>
                <li>- Bi-directional data flow</li>
                <li>- Conflict detection & resolution</li>
                <li>- Sync health monitoring</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Benchmark Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Chapter performance ranking</li>
                <li>- Metric-by-metric comparison</li>
                <li>- Percentile positioning</li>
                <li>- Tier classification</li>
                <li>- Historical trends</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">National Events</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- RCM (Regional Chapter Meet) registration</li>
                <li>- Yi Summit participation</li>
                <li>- National Conclave attendance</li>
                <li>- Member registration management</li>
                <li>- Event calendar sync</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">National Broadcasts</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Policy announcements</li>
                <li>- Deadline reminders</li>
                <li>- Best practice sharing</li>
                <li>- Resource distribution</li>
                <li>- Read/acknowledge tracking</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Sync Entity Types */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Synchronized Entities</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">Members</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Member profiles, roles, engagement scores
                </p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">Events</p>
                <p className="text-sm text-muted-foreground mt-1">
                  National events, registrations, attendance
                </p>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg text-center">
                <p className="text-2xl font-bold text-purple-600">Documents</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Reports, MoUs, best practices
                </p>
              </div>
              <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg text-center">
                <p className="text-2xl font-bold text-orange-600">Metrics</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Performance data, KPIs, financials
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
              <CardTitle className="text-base">Workflow 1: View Integration Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={viewDashboardChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">National</code></li>
                  <li>View sync health score on the dashboard</li>
                  <li>Check your chapter&apos;s benchmark ranking</li>
                  <li>Review upcoming national events</li>
                  <li>See any unread national broadcasts</li>
                  <li>Take action on items requiring attention</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 2: Register for National Event</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={registerEventChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">National &gt; Events</code></li>
                  <li>Browse upcoming national events</li>
                  <li>Select event type:
                    <ul className="ml-4 mt-1 space-y-1 list-disc list-inside">
                      <li><strong>RCM</strong> - Regional Chapter Meet</li>
                      <li><strong>Summit</strong> - Yi National Summit</li>
                      <li><strong>Conclave</strong> - National Conclave</li>
                    </ul>
                  </li>
                  <li>View event details, dates, and venue</li>
                  <li>Select members from your chapter to register</li>
                  <li>Submit registration</li>
                  <li>Event is automatically added to chapter calendar</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 3: View Benchmarks</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={viewBenchmarksChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">National &gt; Benchmarks</code></li>
                  <li>View your chapter&apos;s overall ranking and tier</li>
                  <li>See metric-by-metric comparison with national averages</li>
                  <li>Filter by specific categories (Events, Finance, Members, etc.)</li>
                  <li>Identify areas where your chapter is below average</li>
                  <li>Use insights to set improvement goals</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 4: Manage Data Sync</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={manageSyncChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">National &gt; Sync Management</code></li>
                  <li>Check sync health status indicator</li>
                  <li>View recent sync logs for success/failure history</li>
                  <li>If conflicts exist, review and resolve them:
                    <ul className="ml-4 mt-1 space-y-1 list-disc list-inside">
                      <li>Keep local data</li>
                      <li>Accept national data</li>
                      <li>Merge both (where applicable)</li>
                    </ul>
                  </li>
                  <li>Trigger manual sync if needed</li>
                  <li>Monitor until sync health is restored</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Benchmark Tiers */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Benchmark Performance Tiers</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="w-16 h-16 rounded-full bg-yellow-500 flex items-center justify-center text-white font-bold text-xl">
                  A
                </div>
                <div>
                  <h4 className="font-medium text-yellow-700 dark:text-yellow-400">Exemplary (90-100%)</h4>
                  <p className="text-sm text-muted-foreground">
                    Top performing chapters. Consistently exceeds national benchmarks across all metrics.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-xl">
                  B
                </div>
                <div>
                  <h4 className="font-medium text-green-700 dark:text-green-400">Strong (75-89%)</h4>
                  <p className="text-sm text-muted-foreground">
                    Above average performance. Meets or exceeds most national benchmarks.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xl">
                  C
                </div>
                <div>
                  <h4 className="font-medium text-blue-700 dark:text-blue-400">Average (50-74%)</h4>
                  <p className="text-sm text-muted-foreground">
                    Meeting basic expectations. Some areas for improvement identified.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white font-bold text-xl">
                  D
                </div>
                <div>
                  <h4 className="font-medium text-red-700 dark:text-red-400">Needs Improvement (&lt;50%)</h4>
                  <p className="text-sm text-muted-foreground">
                    Below national averages. Priority focus needed on key metrics.
                  </p>
                </div>
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
                <h4 className="font-medium">Monitor Sync Health</h4>
                <p className="text-sm text-muted-foreground">
                  Check sync status weekly. A healthy sync ensures your chapter&apos;s data is
                  accurately reflected in national reports and benchmarks.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Register Early for Events</h4>
                <p className="text-sm text-muted-foreground">
                  National events often have limited capacity. Register your chapter&apos;s
                  delegation as soon as events are announced.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Act on Broadcasts Promptly</h4>
                <p className="text-sm text-muted-foreground">
                  National broadcasts often contain deadlines and action items. Read and
                  acknowledge them promptly to avoid missing important updates.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Use Benchmarks for Planning</h4>
                <p className="text-sm text-muted-foreground">
                  Review benchmark data quarterly. Use national averages and top performers
                  as targets when setting chapter goals.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
