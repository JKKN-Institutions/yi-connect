/**
 * Succession & Leadership Pipeline Documentation
 *
 * Module 5: Leadership selection, nominations, evaluations, and succession planning.
 */

import { DocPageHeader, MermaidDiagram, RoleAccessTable } from '@/components/docs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserCog, Lightbulb } from 'lucide-react';

const successionTimelineChart = `flowchart TD
    A["Sept 1: Cycle<br/>auto-created"] --> B["Week 1-2:<br/>Nominations open"]
    B --> C["Chair/Co-Chair<br/>submit nominations"]
    C --> D["Week 3:<br/>Past Chair scoring"]
    D --> E["Core group<br/>rates candidates"]
    E --> F["Week 4:<br/>RC Review"]
    F --> G["Steering Committee<br/>meeting"]
    G --> H["Consensus ranking<br/>determined"]
    H --> I["Top candidate<br/>approached"]
    I --> J{"Accepts?"}
    J -->|Yes| K["RC & National<br/>approval"]
    J -->|No| L["Next candidate"]
    L --> I
    K --> M["Handover<br/>planning begins"]

    style A fill:#f0f9ff
    style M fill:#dcfce7
    style J fill:#fef3c7`;

const nominateChart = `flowchart TD
    A["Nominations<br/>period open"] --> B["Succession ><br/>Nominate"]
    B --> C["Select active<br/>cycle"]
    C --> D["Choose nominee<br/>from eligible list"]
    D --> E["Write justification"]
    E --> F["Submit nomination"]
    F --> G["Nomination logged<br/>for review"]

    style A fill:#f0f9ff
    style G fill:#dcfce7`;

const eligibilityChart = `flowchart TD
    A["Considering<br/>nomination"] --> B["Succession ><br/>Eligibility"]
    B --> C["System checks:<br/>EC Experience ≥2 yrs"]
    C --> D["Projects Led ≥1"]
    D --> E["RCM Attendance ≥2"]
    E --> F["Leadership Academy<br/>completed"]
    F --> G["Engagement ≥75"]
    G --> H{"All criteria met?"}
    H -->|Yes| I["Eligible - Green badge"]
    H -->|No| J["Shows gaps<br/>to address"]

    style A fill:#f0f9ff
    style I fill:#dcfce7
    style H fill:#fef3c7`;

const roleAccesses = [
  {
    role: 'Super Admin / National Admin',
    access: 'full' as const,
    permissions: ['Full cycle management', 'View all nominations', 'Approve candidates']
  },
  {
    role: 'Executive Member',
    access: 'full' as const,
    permissions: ['Manage cycles', 'View nominations', 'Coordinate evaluations']
  },
  {
    role: 'Chair / Co-Chair',
    access: 'limited' as const,
    permissions: ['Submit nominations', 'Participate in scoring', 'View timeline']
  },
  {
    role: 'Past Chairs',
    access: 'limited' as const,
    permissions: ['Score candidates confidentially', 'View anonymized profiles']
  },
  {
    role: 'EC Member',
    access: 'view' as const,
    permissions: ['View cycle status', 'Check own eligibility']
  },
  {
    role: 'Yi Member',
    access: 'view' as const,
    permissions: ['View cycle timeline', 'Check eligibility', 'Apply for positions']
  }
];

export default function SuccessionDocPage() {
  return (
    <div className="space-y-8">
      <DocPageHeader
        title="Succession & Leadership Pipeline"
        description="Digitized 7-step leadership succession process with nominations, evaluations, and structured handover planning."
        icon={UserCog}
        moduleNumber={5}
      />

      {/* Purpose */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Purpose & Objectives</h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">
              The Succession module automates the annual Yi leadership selection process,
              reducing 50+ hours of coordination. It ensures confidentiality, timely reviews,
              and structured leadership transitions.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Automated Timeline</h4>
                <p className="text-sm text-muted-foreground">7-step process tracked automatically</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Confidential Scoring</h4>
                <p className="text-sm text-muted-foreground">Anonymous evaluation by Past Chairs</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Eligibility Tracking</h4>
                <p className="text-sm text-muted-foreground">Auto-check against criteria</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Eligibility Criteria */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Eligibility Criteria</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[
                { criteria: 'EC Experience', requirement: '≥ 2 years' },
                { criteria: 'Projects Led', requirement: '≥ 1 project' },
                { criteria: 'RCM Attendance', requirement: '≥ 2 meetings' },
                { criteria: 'Leadership Academy', requirement: 'Completed' },
                { criteria: 'Engagement Score', requirement: '≥ 75' },
                { criteria: 'Skill Proficiency', requirement: '≥ 3 average' }
              ].map((item) => (
                <div key={item.criteria} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm font-medium">{item.criteria}</span>
                  <span className="text-sm text-muted-foreground">{item.requirement}</span>
                </div>
              ))}
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
              <CardTitle className="text-base">Workflow 1: Annual Succession Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={successionTimelineChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">7-Week Process:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li><strong>Week 1-2:</strong> Chair/Co-Chair/Mentor submit 3-5 candidate nominations</li>
                  <li><strong>Week 3:</strong> Past Chairs score candidates (1-10) on 5 attributes</li>
                  <li><strong>Week 4:</strong> RC reviews profiles and scores</li>
                  <li><strong>Week 5:</strong> Steering Committee meeting for consensus ranking</li>
                  <li><strong>Week 6:</strong> Top candidate approached</li>
                  <li><strong>Week 7:</strong> RC and National approval processed</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 2: Nominate a Candidate</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={nominateChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">Succession &gt; Nominate</code></li>
                  <li>Select the active succession cycle</li>
                  <li>Browse eligible candidates or search by name</li>
                  <li>Select nominee and write detailed justification</li>
                  <li>Submit nomination - it&apos;s logged confidentially</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 3: Check Eligibility</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={eligibilityChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">Succession &gt; Eligibility</code></li>
                  <li>System automatically checks your profile against criteria</li>
                  <li>View status for each requirement (met/not met)</li>
                  <li>See recommendations for addressing gaps</li>
                  <li>Track progress toward eligibility over time</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Scoring Attributes */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Scoring Attributes</h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-4">
              Past Chairs evaluate candidates on these 5 attributes (1-10 scale):
            </p>
            <div className="grid gap-4 md:grid-cols-5">
              {[
                { attr: 'Leadership', desc: 'Ability to inspire and guide' },
                { attr: 'Teamwork', desc: 'Collaboration and support' },
                { attr: 'Adaptability', desc: 'Handling change and challenges' },
                { attr: 'Time Discipline', desc: 'Punctuality and commitment' },
                { attr: 'Purpose Clarity', desc: 'Vision and direction' }
              ].map((item) => (
                <div key={item.attr} className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="font-medium text-sm">{item.attr}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
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
                <h4 className="font-medium">Maintain Confidentiality</h4>
                <p className="text-sm text-muted-foreground">
                  Nominations and scores are confidential. Do not discuss candidates
                  outside the formal process.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Build Eligibility Early</h4>
                <p className="text-sm text-muted-foreground">
                  Members aspiring to leadership should track their eligibility
                  status and work on gaps throughout the year.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Complete Academy</h4>
                <p className="text-sm text-muted-foreground">
                  Leadership Academy completion is mandatory. Prioritize this
                  if you&apos;re considering future leadership roles.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
