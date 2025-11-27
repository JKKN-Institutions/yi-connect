/**
 * Vertical Performance Tracker Documentation
 *
 * Module 9: Vertical dashboards, KPIs, activities, and performance rankings.
 */

import { DocPageHeader, MermaidDiagram, RoleAccessTable } from '@/components/docs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Lightbulb } from 'lucide-react';

const viewDashboardChart = `flowchart TD
    A["Monitor vertical<br/>performance"] --> B["Verticals ><br/>Select Vertical"]
    B --> C["View dashboard<br/>overview"]
    C --> D["Check KPI<br/>progress"]
    D --> E["Review budget<br/>utilization"]
    E --> F["See impact<br/>metrics"]
    F --> G["View recent<br/>activities"]
    G --> H["Check team<br/>members"]

    style A fill:#f0f9ff
    style H fill:#dcfce7`;

const recordKPIChart = `flowchart TD
    A["End of quarter<br/>or milestone"] --> B["Verticals ><br/>Select Vertical"]
    B --> C["Go to Plan tab"]
    C --> D["Select KPI<br/>to update"]
    D --> E["Enter actual<br/>value achieved"]
    E --> F["Add supporting<br/>notes"]
    F --> G["Submit progress"]
    G --> H["Completion %<br/>auto-calculates"]
    H --> I["Alerts generated<br/>if behind target"]

    style A fill:#f0f9ff
    style I fill:#dcfce7`;

const logActivityChart = `flowchart TD
    A["Vertical activity<br/>completed"] --> B["Verticals ><br/>Select Vertical"]
    B --> C["Go to Activities"]
    C --> D["Click New Activity"]
    D --> E["Enter activity<br/>details"]
    E --> F["Add beneficiary<br/>count"]
    F --> G["Log volunteer<br/>hours"]
    G --> H["Upload photos<br/>if any"]
    H --> I["Submit activity"]
    I --> J["Impact metrics<br/>updated"]

    style A fill:#f0f9ff
    style J fill:#dcfce7`;

const assignMembersChart = `flowchart TD
    A["Need to build<br/>vertical team"] --> B["Verticals ><br/>Select Vertical"]
    B --> C["Go to Team tab"]
    C --> D["Click Add Member"]
    D --> E["Search for<br/>member"]
    E --> F["Select role<br/>in vertical"]
    F --> G["Set start date"]
    G --> H["Add member<br/>to team"]
    H --> I["Member sees<br/>vertical in profile"]

    style A fill:#f0f9ff
    style I fill:#dcfce7`;

const roleAccesses = [
  {
    role: 'Super Admin / National Admin',
    access: 'full' as const,
    permissions: ['Full vertical management', 'Cross-chapter visibility', 'Create/delete verticals', 'View all rankings']
  },
  {
    role: 'Executive Member',
    access: 'full' as const,
    permissions: ['Manage all verticals', 'Assign chairs', 'Set targets', 'View analytics']
  },
  {
    role: 'Chair / Co-Chair',
    access: 'full' as const,
    permissions: ['Manage assigned verticals', 'Record KPIs', 'Log activities', 'Manage team']
  },
  {
    role: 'Vertical Chair',
    access: 'limited' as const,
    permissions: ['Full access to own vertical', 'Record KPIs', 'Log activities', 'Manage team members']
  },
  {
    role: 'EC Member',
    access: 'view' as const,
    permissions: ['View all verticals', 'View KPIs', 'View activities', 'See own assignments']
  },
  {
    role: 'Yi Member',
    access: 'view' as const,
    permissions: ['View vertical information', 'View rankings', 'See assigned vertical']
  }
];

export default function VerticalsDocPage() {
  return (
    <div className="space-y-8">
      <DocPageHeader
        title="Vertical Performance Tracker"
        description="Real-time dashboards for vertical heads to track KPIs, activities, team performance, and impact metrics with auto-integration from events and finance."
        icon={Activity}
        moduleNumber={9}
      />

      {/* Purpose */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Purpose & Objectives</h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">
              The Vertical Performance Tracker provides each vertical head with a comprehensive
              dashboard to monitor their vertical&apos;s performance. It auto-integrates data from
              events and finance modules for accurate, real-time tracking.
            </p>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">KPI Tracking</h4>
                <p className="text-sm text-muted-foreground">Quarterly targets & progress</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Activity Logging</h4>
                <p className="text-sm text-muted-foreground">Events & impact metrics</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Team Management</h4>
                <p className="text-sm text-muted-foreground">Members & roles</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Rankings</h4>
                <p className="text-sm text-muted-foreground">Performance comparison</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Verticals Overview */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Yi Verticals</h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-4">
              Yi chapters typically have multiple verticals, each focusing on a specific area:
            </p>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {[
                { name: 'Manufacturing Excellence', focus: 'Industry best practices' },
                { name: 'Future Leaders', focus: 'Youth development' },
                { name: 'Digital Innovation', focus: 'Technology adoption' },
                { name: 'Skill Development', focus: 'Training & education' },
                { name: 'Social Impact', focus: 'Community service' },
                { name: 'Business Development', focus: 'Entrepreneurship' }
              ].map((v) => (
                <div key={v.name} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="font-bold text-primary">{v.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">{v.name}</p>
                    <p className="text-xs text-muted-foreground">{v.focus}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Dashboard Metrics */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Dashboard Metrics</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">KPI Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Overall completion percentage</li>
                <li>- Quarter-by-quarter breakdown</li>
                <li>- Target vs actual comparison</li>
                <li>- Weighted score calculation</li>
                <li>- Alert indicators for at-risk KPIs</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Budget Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Allocated budget amount</li>
                <li>- Spent to date</li>
                <li>- Utilization percentage</li>
                <li>- Remaining balance</li>
                <li>- Auto-linked from Finance module</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Impact Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Total beneficiaries reached</li>
                <li>- Total activities conducted</li>
                <li>- Volunteer hours contributed</li>
                <li>- Events hosted</li>
                <li>- Geographic coverage</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Team Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Active member count</li>
                <li>- Chair information</li>
                <li>- Member roles</li>
                <li>- Join/leave history</li>
                <li>- Activity participation</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* KPI Types */}
      <section>
        <h2 className="text-xl font-semibold mb-4">KPI Metric Types</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <h4 className="font-medium text-blue-700 dark:text-blue-400">Number</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Count-based metrics. Example: &quot;Number of sessions conducted&quot;
                </p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <h4 className="font-medium text-green-700 dark:text-green-400">Currency</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Financial metrics. Example: &quot;Sponsorship raised&quot;
                </p>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                <h4 className="font-medium text-purple-700 dark:text-purple-400">Percentage</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Rate-based metrics. Example: &quot;Member participation rate&quot;
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
              <CardTitle className="text-base">Workflow 1: View Vertical Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={viewDashboardChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">Verticals</code></li>
                  <li>Select your vertical from the list</li>
                  <li>View the dashboard overview with key metrics</li>
                  <li>Check KPI progress in the Overview tab</li>
                  <li>Review budget utilization (auto-linked from Finance)</li>
                  <li>See impact metrics (beneficiaries, volunteer hours)</li>
                  <li>View recent activities and achievements</li>
                  <li>Check team member list and assignments</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 2: Record KPI Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={recordKPIChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">Verticals &gt; Your Vertical</code></li>
                  <li>Go to the <code className="bg-muted px-1 rounded">Plan</code> or <code className="bg-muted px-1 rounded">KPIs</code> tab</li>
                  <li>Select the KPI you want to update</li>
                  <li>Enter the actual value achieved for the period</li>
                  <li>Add supporting notes or evidence</li>
                  <li>Submit the progress update</li>
                  <li>System auto-calculates completion percentage</li>
                  <li>If behind target, alerts are generated for review</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 3: Log Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={logActivityChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">Verticals &gt; Your Vertical</code></li>
                  <li>Go to the <code className="bg-muted px-1 rounded">Activities</code> section</li>
                  <li>Click &quot;New Activity&quot;</li>
                  <li>Enter activity details:
                    <ul className="ml-4 mt-1 space-y-1 list-disc list-inside">
                      <li>Activity title and description</li>
                      <li>Date and location</li>
                      <li>Activity type (Session, Workshop, Event, etc.)</li>
                    </ul>
                  </li>
                  <li>Add beneficiary count</li>
                  <li>Log volunteer hours contributed</li>
                  <li>Upload photos or documents</li>
                  <li>Submit the activity - impact metrics update automatically</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 4: Manage Team Members</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={assignMembersChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">Verticals &gt; Your Vertical</code></li>
                  <li>Go to the <code className="bg-muted px-1 rounded">Team</code> tab</li>
                  <li>Click &quot;Add Member&quot;</li>
                  <li>Search for the member by name</li>
                  <li>Select their role within the vertical</li>
                  <li>Set the start date</li>
                  <li>Add the member to the team</li>
                  <li>Member will see the vertical assignment in their profile</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Performance Alerts */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Performance Alerts</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                <div className="w-3 h-3 rounded-full bg-red-500 mt-1" />
                <div>
                  <h4 className="font-medium text-red-700 dark:text-red-400">Danger Alert</h4>
                  <p className="text-sm text-muted-foreground">
                    KPI is significantly behind target (&lt;50% of expected progress). Immediate action required.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="w-3 h-3 rounded-full bg-yellow-500 mt-1" />
                <div>
                  <h4 className="font-medium text-yellow-700 dark:text-yellow-400">Warning Alert</h4>
                  <p className="text-sm text-muted-foreground">
                    KPI is slightly behind target (50-75% of expected progress). Monitor and take corrective action.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="w-3 h-3 rounded-full bg-green-500 mt-1" />
                <div>
                  <h4 className="font-medium text-green-700 dark:text-green-400">On Track</h4>
                  <p className="text-sm text-muted-foreground">
                    KPI is meeting or exceeding target (&gt;75% of expected progress). Keep up the good work!
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
                <h4 className="font-medium">Update KPIs Quarterly</h4>
                <p className="text-sm text-muted-foreground">
                  Record progress at least once per quarter. This helps identify issues early
                  and keeps the dashboard accurate for leadership reviews.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Log Activities Promptly</h4>
                <p className="text-sm text-muted-foreground">
                  Log activities within 48 hours while details are fresh. Include beneficiary
                  counts and volunteer hours for accurate impact tracking.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Review Rankings</h4>
                <p className="text-sm text-muted-foreground">
                  Check the Rankings page to see how your vertical compares to others.
                  Use this for healthy competition and identifying best practices.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Maintain Team Roster</h4>
                <p className="text-sm text-muted-foreground">
                  Keep your team member list current. Remove inactive members and assign
                  roles to help with volunteer matching from Events.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
