/**
 * Industry Opportunities Documentation
 *
 * Browse, apply for, and manage industry opportunities including internships,
 * projects, mentorships, training, and jobs.
 */

import { DocPageHeader, MermaidDiagram, RoleAccessTable } from '@/components/docs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase, Lightbulb } from 'lucide-react';

const browseOpportunitiesChart = `flowchart TD
    A["Looking for<br/>opportunities"] --> B["Opportunities ><br/>Browse"]
    B --> C["View recommended<br/>opportunities"]
    C --> D["Filter by type:<br/>Internship/Project/<br/>Mentorship/Job"]
    D --> E["Search by<br/>keyword"]
    E --> F["Browse matching<br/>opportunities"]
    F --> G["View opportunity<br/>details"]
    G --> H["Check eligibility<br/>and requirements"]

    style A fill:#f0f9ff
    style H fill:#dcfce7`;

const applyOpportunityChart = `flowchart TD
    A["Found suitable<br/>opportunity"] --> B["Click Apply Now"]
    B --> C["Review requirements"]
    C --> D{{"Meet<br/>requirements?"}}
    D -->|Yes| E["Fill application<br/>form"]
    D -->|No| F["Bookmark for later"]
    E --> G["Upload resume<br/>if required"]
    G --> H["Add cover letter"]
    H --> I["Submit application"]
    I --> J["Track in<br/>My Applications"]

    style A fill:#f0f9ff
    style J fill:#dcfce7
    style D fill:#fef3c7`;

const trackApplicationsChart = `flowchart TD
    A["Check application<br/>status"] --> B["Opportunities ><br/>My Applications"]
    B --> C["View all<br/>applications"]
    C --> D["Filter by<br/>status"]
    D --> E["See application<br/>timeline"]
    E --> F["Check for<br/>updates"]
    F --> G["View feedback<br/>if any"]

    style A fill:#f0f9ff
    style G fill:#dcfce7`;

const createOpportunityChart = `flowchart TD
    A["Have opportunity<br/>to share"] --> B["Opportunities ><br/>Manage > New"]
    B --> C["Select opportunity<br/>type"]
    C --> D["Enter details:<br/>Title, Description"]
    D --> E["Set requirements<br/>and eligibility"]
    E --> F["Add stakeholder/<br/>company info"]
    F --> G["Set deadline<br/>and slots"]
    G --> H["Publish opportunity"]
    H --> I["Appears in<br/>marketplace"]

    style A fill:#f0f9ff
    style I fill:#dcfce7`;

const roleAccesses = [
  {
    role: 'Super Admin / National Admin',
    access: 'full' as const,
    permissions: ['Full opportunity management', 'Cross-chapter access', 'Review all applications', 'Analytics']
  },
  {
    role: 'Chair / Co-Chair',
    access: 'full' as const,
    permissions: ['Create opportunities', 'Manage applications', 'View analytics']
  },
  {
    role: 'Executive Member',
    access: 'limited' as const,
    permissions: ['Create opportunities', 'Manage own opportunities']
  },
  {
    role: 'EC Member',
    access: 'limited' as const,
    permissions: ['Browse opportunities', 'Apply', 'Track applications']
  },
  {
    role: 'Yi Member',
    access: 'limited' as const,
    permissions: ['Browse opportunities', 'Apply', 'Track applications']
  },
  {
    role: 'Industry Partner',
    access: 'limited' as const,
    permissions: ['Post opportunities', 'View applicants for own postings']
  }
];

export default function OpportunitiesDocPage() {
  return (
    <div className="space-y-8">
      <DocPageHeader
        title="Industry Opportunities"
        description="Discover and apply for internships, projects, mentorships, training programs, and job opportunities from industry partners."
        icon={Briefcase}
        moduleNumber={12}
      />

      {/* Purpose */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Purpose & Objectives</h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">
              The Industry Opportunities module connects Yi members with valuable career and
              development opportunities. It features personalized recommendations based on
              skills and interests, with a streamlined application process.
            </p>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Smart Matching</h4>
                <p className="text-sm text-muted-foreground">Personalized recommendations</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Easy Apply</h4>
                <p className="text-sm text-muted-foreground">Streamlined applications</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Track Progress</h4>
                <p className="text-sm text-muted-foreground">Application status updates</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Industry Partners</h4>
                <p className="text-sm text-muted-foreground">Direct postings from companies</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Opportunity Types */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Opportunity Types</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <p className="font-bold text-blue-600">Internships</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Short-term learning experiences
                </p>
              </div>
              <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                <p className="font-bold text-purple-600">Projects</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Industry collaboration projects
                </p>
              </div>
              <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <p className="font-bold text-green-600">Mentorships</p>
                <p className="text-xs text-muted-foreground mt-1">
                  One-on-one guidance programs
                </p>
              </div>
              <div className="text-center p-4 bg-cyan-50 dark:bg-cyan-950/20 rounded-lg">
                <p className="font-bold text-cyan-600">Training</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Skill development courses
                </p>
              </div>
              <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                <p className="font-bold text-orange-600">Jobs</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Full-time employment
                </p>
              </div>
              <div className="text-center p-4 bg-pink-50 dark:bg-pink-950/20 rounded-lg">
                <p className="font-bold text-pink-600">Visits</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Industry exposure visits
                </p>
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
              <CardTitle className="text-base">Personalized Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Match score based on your profile</li>
                <li>- Skills-based matching</li>
                <li>- Industry preference alignment</li>
                <li>- Experience level filtering</li>
                <li>- Top recommendations highlighted</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Application Management</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- One-click apply process</li>
                <li>- Resume/CV upload</li>
                <li>- Cover letter support</li>
                <li>- Application tracking</li>
                <li>- Status notifications</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Opportunity Discovery</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Filter by type, industry, location</li>
                <li>- Search by keywords</li>
                <li>- Deadline tracking</li>
                <li>- Bookmark favorites</li>
                <li>- New opportunities alerts</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Admin Management</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Create and publish opportunities</li>
                <li>- Manage applications</li>
                <li>- Review and shortlist candidates</li>
                <li>- Send feedback to applicants</li>
                <li>- Analytics and reporting</li>
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
              <CardTitle className="text-base">Workflow 1: Browse Opportunities</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={browseOpportunitiesChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">Opportunities</code></li>
                  <li>View personalized recommendations at the top</li>
                  <li>Filter by opportunity type:
                    <ul className="ml-4 mt-1 space-y-1 list-disc list-inside">
                      <li>Internships, Projects, Mentorships</li>
                      <li>Training, Jobs, Visits</li>
                    </ul>
                  </li>
                  <li>Use search to find specific opportunities</li>
                  <li>Browse matching opportunities</li>
                  <li>Click to view full details</li>
                  <li>Check if you meet the eligibility requirements</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 2: Apply for Opportunity</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={applyOpportunityChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Open the opportunity you want to apply for</li>
                  <li>Click &quot;Apply Now&quot; button</li>
                  <li>Review all requirements and eligibility criteria</li>
                  <li>If you meet requirements, proceed to apply</li>
                  <li>Fill in the application form</li>
                  <li>Upload your resume/CV if required</li>
                  <li>Write a cover letter explaining your interest</li>
                  <li>Submit your application</li>
                  <li>Track status in My Applications</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 3: Track Applications</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={trackApplicationsChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">Opportunities &gt; My Applications</code></li>
                  <li>View all your submitted applications</li>
                  <li>Filter by application status</li>
                  <li>See the timeline of each application</li>
                  <li>Check for status updates and notifications</li>
                  <li>View feedback from reviewers if available</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 4: Create Opportunity (Admin)</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={createOpportunityChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">Opportunities &gt; Manage</code></li>
                  <li>Click &quot;New Opportunity&quot;</li>
                  <li>Select the opportunity type</li>
                  <li>Enter opportunity details:
                    <ul className="ml-4 mt-1 space-y-1 list-disc list-inside">
                      <li>Title and description</li>
                      <li>Required skills and qualifications</li>
                      <li>Duration and location</li>
                    </ul>
                  </li>
                  <li>Set eligibility requirements</li>
                  <li>Add stakeholder/company information</li>
                  <li>Set application deadline and available slots</li>
                  <li>Publish the opportunity</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Application Statuses */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Application Status</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center gap-4 p-3 rounded-lg border">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div>
                  <p className="font-medium">Pending Review</p>
                  <p className="text-sm text-muted-foreground">Application submitted, awaiting review</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-lg border">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <div>
                  <p className="font-medium">Under Review</p>
                  <p className="text-sm text-muted-foreground">Application is being evaluated</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-lg border">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <div>
                  <p className="font-medium">Shortlisted</p>
                  <p className="text-sm text-muted-foreground">Selected for further consideration</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-lg border">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <div>
                  <p className="font-medium">Accepted</p>
                  <p className="text-sm text-muted-foreground">Congratulations! You got the opportunity</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-lg border">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div>
                  <p className="font-medium">Not Selected</p>
                  <p className="text-sm text-muted-foreground">Application was not selected this time</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Match Score */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Understanding Match Score</h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">
              The match score indicates how well an opportunity aligns with your profile:
            </p>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">90-100%</p>
                <p className="text-sm text-muted-foreground">Excellent Match</p>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">70-89%</p>
                <p className="text-sm text-muted-foreground">Good Match</p>
              </div>
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg text-center">
                <p className="text-2xl font-bold text-yellow-600">50-69%</p>
                <p className="text-sm text-muted-foreground">Moderate Match</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-950/20 rounded-lg text-center">
                <p className="text-2xl font-bold text-gray-600">&lt;50%</p>
                <p className="text-sm text-muted-foreground">Low Match</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Match scores are calculated based on your skills, industry experience, and preferences
              compared to the opportunity requirements.
            </p>
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
                <h4 className="font-medium">Complete Your Profile</h4>
                <p className="text-sm text-muted-foreground">
                  Keep your profile updated with skills, experience, and interests.
                  This improves match scores and recommendations.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Apply to High Matches First</h4>
                <p className="text-sm text-muted-foreground">
                  Focus on opportunities with 70%+ match scores. You&apos;re more
                  likely to be selected for opportunities that align with your profile.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Craft Quality Applications</h4>
                <p className="text-sm text-muted-foreground">
                  Take time to write thoughtful cover letters. Explain why you&apos;re
                  interested and how your skills match the requirements.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Watch Deadlines</h4>
                <p className="text-sm text-muted-foreground">
                  Many opportunities have application deadlines. Apply early and
                  don&apos;t wait until the last minute.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
