/**
 * Stakeholder CRM Documentation
 *
 * Module 2: Stakeholder relationship management for schools, colleges,
 * industries, government, NGOs, vendors, and speakers.
 */

import { DocPageHeader, MermaidDiagram, RoleAccessTable } from '@/components/docs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Lightbulb } from 'lucide-react';

const addStakeholderChart = `flowchart TD
    A["Identify new<br/>stakeholder"] --> B["Select type:<br/>School/College/Industry/<br/>Government/NGO/Vendor/Speaker"]
    B --> C["Fill basic info<br/>Name, Address, Contact"]
    C --> D["Add key contacts<br/>with designations"]
    D --> E["Set relationship<br/>health baseline"]
    E --> F["Upload MoU<br/>if applicable"]
    F --> G["Stakeholder added<br/>to directory"]

    style A fill:#f0f9ff
    style G fill:#dcfce7`;

const logInteractionChart = `flowchart TD
    A["Meeting/Call<br/>with stakeholder"] --> B["Open stakeholder<br/>profile"]
    B --> C["Click Log<br/>Interaction"]
    C --> D["Select type:<br/>Call/Meeting/Email/<br/>Session/MoU"]
    D --> E["Add participants<br/>and outcomes"]
    E --> F["Set follow-up<br/>date if needed"]
    F --> G["Health score<br/>auto-recalculates"]

    style A fill:#f0f9ff
    style G fill:#dcfce7`;

const mouTrackingChart = `flowchart TD
    A["New MoU<br/>discussion"] --> B["Update status:<br/>In Discussion"]
    B --> C["MoU signed"]
    C --> D["Upload document"]
    D --> E["Set expiry date"]
    E --> F["System sends<br/>90-day alert"]
    F --> G["Renewal workflow<br/>triggered"]

    style A fill:#f0f9ff
    style G fill:#dcfce7`;

const roleAccesses = [
  {
    role: 'Super Admin / National Admin',
    access: 'full' as const,
    permissions: ['Full CRUD on all stakeholders', 'MoU management', 'Analytics access']
  },
  {
    role: 'Executive Member / Chair',
    access: 'full' as const,
    permissions: ['Add/edit stakeholders', 'Log interactions', 'Manage MoUs', 'View analytics']
  },
  {
    role: 'Co-Chair',
    access: 'view' as const,
    permissions: ['View stakeholder directory', 'View interaction history']
  },
  {
    role: 'EC Member',
    access: 'limited' as const,
    permissions: ['View stakeholders', 'Log interactions for assigned stakeholders']
  },
  {
    role: 'Vertical Chair',
    access: 'limited' as const,
    permissions: ['Full access to stakeholders in their vertical only']
  },
  {
    role: 'Yi Member',
    access: 'none' as const,
    permissions: ['No access to stakeholder module']
  }
];

export default function StakeholdersDocPage() {
  return (
    <div className="space-y-8">
      <DocPageHeader
        title="Stakeholder Relationship CRM"
        description="Comprehensive CRM for managing relationships with schools, colleges, industries, government, NGOs, vendors, and speakers."
        icon={Building2}
        moduleNumber={2}
      />

      {/* Purpose */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Purpose & Objectives</h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">
              The Stakeholder CRM transforms scattered stakeholder information into organized,
              searchable data with relationship health scoring. It enables systematic engagement
              and prevents duplicate or missed opportunities.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Centralized Database</h4>
                <p className="text-sm text-muted-foreground">
                  Single source of truth for all stakeholder contacts and history.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Health Scoring</h4>
                <p className="text-sm text-muted-foreground">
                  Automated relationship health scores based on interaction frequency and quality.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">MoU Tracking</h4>
                <p className="text-sm text-muted-foreground">
                  Track agreements with expiry alerts and renewal workflows.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Stakeholder Types */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Stakeholder Types</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            { name: 'Schools', desc: 'K-12 institutions for program delivery', path: '/stakeholders/schools' },
            { name: 'Colleges', desc: 'Higher education institutions', path: '/stakeholders/colleges' },
            { name: 'Industries', desc: 'Corporate partners and CSR sponsors', path: '/stakeholders/industries' },
            { name: 'Government', desc: 'Government agencies and officials', path: '/stakeholders/government' },
            { name: 'NGOs', desc: 'Non-profit partner organizations', path: '/stakeholders/ngos' },
            { name: 'Vendors', desc: 'Event service providers', path: '/stakeholders/vendors' },
            { name: 'Speakers', desc: 'Guest speakers and trainers', path: '/stakeholders/speakers' }
          ].map((type) => (
            <Card key={type.name}>
              <CardContent className="pt-6">
                <h4 className="font-medium mb-1">{type.name}</h4>
                <p className="text-sm text-muted-foreground">{type.desc}</p>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded mt-2 inline-block">{type.path}</code>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Key Features */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Key Features</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Relationship Health Score</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">
                Calculated automatically (0-100):
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Interaction Frequency (40%)</li>
                <li>- Responsiveness (20%)</li>
                <li>- Collaboration Quality (20%)</li>
                <li>- MoU Status (20%)</li>
              </ul>
              <div className="mt-3 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  <span>Healthy: 80-100</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                  <span>Needs Attention: 60-79</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  <span>At Risk: Below 60</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Interaction Logging</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Log calls, meetings, emails, sessions</li>
                <li>- Record participants and outcomes</li>
                <li>- Set follow-up reminders</li>
                <li>- Attach documents and photos</li>
                <li>- Track discussion topics</li>
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
              <CardTitle className="text-base">Workflow 1: Add New Stakeholder</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={addStakeholderChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">Stakeholders</code> and select the type</li>
                  <li>Click &quot;Add New&quot; button</li>
                  <li>Fill in organization name, address, and contact details</li>
                  <li>Add key contacts with their designations and direct contact info</li>
                  <li>If applicable, upload any existing MoU documents</li>
                  <li>Save the stakeholder record</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 2: Log Interaction</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={logInteractionChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Open the stakeholder&apos;s profile page</li>
                  <li>Click &quot;Log Interaction&quot; button</li>
                  <li>Select interaction type (Call, Meeting, Email, Session)</li>
                  <li>Add date, participants, and discussion summary</li>
                  <li>Record outcomes and any commitments made</li>
                  <li>Set a follow-up date if needed</li>
                  <li>Health score automatically recalculates</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 3: MoU Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={mouTrackingChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>When MoU discussions begin, update status to &quot;In Discussion&quot;</li>
                  <li>Once signed, upload the MoU document</li>
                  <li>Set the expiry/renewal date</li>
                  <li>System automatically sends alerts 90 days before expiry</li>
                  <li>Track benefits delivery using the checklist</li>
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
                <h4 className="font-medium">Regular Follow-ups</h4>
                <p className="text-sm text-muted-foreground">
                  Log interactions within 24 hours while details are fresh.
                  Set follow-up reminders to maintain relationship health.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Government Officials</h4>
                <p className="text-sm text-muted-foreground">
                  Track tenure and expected transfer dates. System alerts you
                  90 days before transfers to plan relationship succession.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Check Health Scores Weekly</h4>
                <p className="text-sm text-muted-foreground">
                  Review the dashboard for stakeholders with declining health
                  scores and prioritize outreach to at-risk relationships.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
