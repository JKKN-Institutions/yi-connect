/**
 * Take Pride Awards Documentation
 *
 * Module 6: Award nominations, jury scoring, winner declarations, and leaderboards.
 */

import { DocPageHeader, MermaidDiagram, RoleAccessTable } from '@/components/docs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, Lightbulb } from 'lucide-react';

const nominationChart = `flowchart TD
    A["Award cycle<br/>announced"] --> B["Awards > Nominate"]
    B --> C["Select active<br/>cycle"]
    C --> D["View scoring<br/>criteria"]
    D --> E["Choose nominee"]
    E --> F["Write detailed<br/>justification"]
    F --> G["Attach supporting<br/>documents"]
    G --> H["Submit nomination"]

    style A fill:#f0f9ff
    style H fill:#dcfce7`;

const juryScoringChart = `flowchart TD
    A["Jury member<br/>assigned"] --> B["Awards > Jury Portal"]
    B --> C["View anonymized<br/>nominations"]
    C --> D["For each nomination:"]
    D --> E["Score Impact<br/>1-10"]
    E --> F["Score Innovation<br/>1-10"]
    F --> G["Score Participation<br/>1-10"]
    G --> H["Score Consistency<br/>1-10"]
    H --> I["Score Leadership<br/>1-10"]
    I --> J["Add comments"]
    J --> K["Submit scores"]
    K --> L["Weighted total<br/>auto-calculated"]

    style A fill:#f0f9ff
    style L fill:#dcfce7`;

const winnerDeclarationChart = `flowchart TD
    A["Jury deadline<br/>passed"] --> B["EM reviews<br/>top scorers"]
    B --> C["Cross-check with<br/>engagement data"]
    C --> D{"Verified?"}
    D -->|Yes| E["Mark as winner"]
    D -->|No| F["Flag for review"]
    E --> G["Generate certificate"]
    G --> H["Announce via<br/>Communication Hub"]
    H --> I["Update member<br/>profile timeline"]
    I --> J["Add to leaderboard"]

    style A fill:#f0f9ff
    style J fill:#dcfce7
    style D fill:#fef3c7`;

const roleAccesses = [
  {
    role: 'Super Admin / National Admin',
    access: 'full' as const,
    permissions: ['Manage award cycles', 'View all nominations', 'Declare winners']
  },
  {
    role: 'Executive Member',
    access: 'full' as const,
    permissions: ['Create cycles', 'Verify winners', 'Generate certificates']
  },
  {
    role: 'Chair / Co-Chair',
    access: 'limited' as const,
    permissions: ['View nominations', 'Participate as jury']
  },
  {
    role: 'Jury Members',
    access: 'limited' as const,
    permissions: ['Score assigned nominations', 'View anonymized profiles']
  },
  {
    role: 'EC Member',
    access: 'limited' as const,
    permissions: ['Submit nominations', 'View leaderboard']
  },
  {
    role: 'Yi Member',
    access: 'limited' as const,
    permissions: ['Submit nominations', 'View leaderboard', 'View own nominations']
  }
];

export default function AwardsDocPage() {
  return (
    <div className="space-y-8">
      <DocPageHeader
        title="Take Pride Award Automation"
        description="Digital award system from nomination to scoring and winner declaration with transparent, automated workflows."
        icon={Award}
        moduleNumber={6}
      />

      {/* Purpose */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Purpose & Objectives</h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">
              The Take Pride Award module digitizes the entire award process from nomination
              to certificate generation. It ensures transparency, reduces manual work,
              and provides faster turnaround.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Fair Scoring</h4>
                <p className="text-sm text-muted-foreground">Weighted criteria with anonymous jury</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Auto Certificates</h4>
                <p className="text-sm text-muted-foreground">One-click PDF generation</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Leaderboard</h4>
                <p className="text-sm text-muted-foreground">Year-to-date rankings</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Award Categories */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Award Categories</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            { name: 'Best Member of Month', freq: 'Monthly' },
            { name: 'Best Volunteer', freq: 'Quarterly' },
            { name: 'Best Vertical Performance', freq: 'Quarterly' },
            { name: 'Best Chapter Initiative', freq: 'Annual' },
            { name: "Chair's Recognition", freq: 'As needed' },
            { name: 'Lifetime Service Award', freq: 'Annual' }
          ].map((cat) => (
            <Card key={cat.name}>
              <CardContent className="pt-6">
                <h4 className="font-medium mb-1">{cat.name}</h4>
                <p className="text-sm text-muted-foreground">{cat.freq}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Scoring Criteria */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Scoring Criteria & Weights</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {[
                { criteria: 'Impact', weight: 30, desc: 'Measurable outcomes and reach' },
                { criteria: 'Innovation', weight: 25, desc: 'Creativity and new approaches' },
                { criteria: 'Participation', weight: 20, desc: 'Event attendance and involvement' },
                { criteria: 'Consistency', weight: 15, desc: 'Sustained performance over time' },
                { criteria: 'Leadership', weight: 10, desc: 'Guidance and mentorship' }
              ].map((item) => (
                <div key={item.criteria} className="flex items-center gap-4">
                  <div className="w-24 font-medium">{item.criteria}</div>
                  <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-primary h-full"
                      style={{ width: `${item.weight}%` }}
                    />
                  </div>
                  <div className="w-12 text-right text-sm text-muted-foreground">
                    {item.weight}%
                  </div>
                  <div className="w-48 text-sm text-muted-foreground hidden md:block">
                    {item.desc}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              <strong>Formula:</strong> (Impact×0.3 + Innovation×0.25 + Participation×0.2 + Consistency×0.15 + Leadership×0.1) × 10
            </p>
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
              <CardTitle className="text-base">Workflow 1: Submit Nomination</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={nominationChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">Awards &gt; Nominate</code></li>
                  <li>Select the active award cycle from the dropdown</li>
                  <li>Review the scoring criteria displayed</li>
                  <li>Choose nominee from the eligible member list</li>
                  <li>Write a detailed justification covering each criterion</li>
                  <li>Attach supporting documents (photos, reports, certificates)</li>
                  <li>Submit nomination before the deadline</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 2: Jury Scoring</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={juryScoringChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Jury members access <code className="bg-muted px-1 rounded">Awards &gt; Jury Portal</code></li>
                  <li>View assigned nominations (names are anonymized)</li>
                  <li>Read justification and review attached evidence</li>
                  <li>Score each criterion from 1-10</li>
                  <li>Add optional comments for each score</li>
                  <li>Submit scores - weighted total is auto-calculated</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 3: Winner Declaration</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={winnerDeclarationChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>After jury deadline, EM reviews ranked nominees</li>
                  <li>Cross-check top scorers against engagement data</li>
                  <li>Verify and mark winners</li>
                  <li>Click &quot;Generate Certificate&quot; for each winner</li>
                  <li>Announce via Communication Hub</li>
                  <li>Awards are added to member profiles and leaderboard</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Tips */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Tips & Best Practices</h2>
        <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="space-y-3">
              <div>
                <h4 className="font-medium">Provide Evidence</h4>
                <p className="text-sm text-muted-foreground">
                  Nominations with photos, reports, and certificates score higher.
                  Attach as much supporting evidence as possible.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Be Specific</h4>
                <p className="text-sm text-muted-foreground">
                  Write justifications that address each scoring criterion.
                  Include specific examples and measurable impact.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Meet Deadlines</h4>
                <p className="text-sm text-muted-foreground">
                  Late nominations are not accepted. System sends reminders
                  5 days before the deadline.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
