/**
 * Member Intelligence Hub Documentation
 *
 * Module 1: Member management, profiles, skills, engagement, and volunteer matching.
 */

import { DocPageHeader, MermaidDiagram, RoleAccessTable } from '@/components/docs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Lightbulb } from 'lucide-react';

const memberOnboardingChart = `flowchart TD
    A["EM receives<br/>payment confirmation"] --> B["Navigate to<br/>Members > Add Member"]
    B --> C["Fill member details<br/>Name, Email, Phone"]
    C --> D["Add professional info<br/>Company, Skills, Availability"]
    D --> E["Assign chapter<br/>and vertical interests"]
    E --> F["Submit form"]
    F --> G{"Validation"}
    G -->|Pass| H["Member created<br/>Welcome email sent"]
    G -->|Fail| C
    H --> I["Member appears<br/>in directory"]

    style A fill:#f0f9ff
    style H fill:#dcfce7
    style G fill:#fef3c7`;

const volunteerMatchingChart = `flowchart TD
    A["Event needs<br/>volunteers"] --> B["Go to Event<br/>Volunteer Tab"]
    B --> C["System suggests<br/>matching members"]
    C --> D["Filter by:<br/>Skills, Availability,<br/>Willingness"]
    D --> E["Select volunteers"]
    E --> F["Send assignment<br/>notifications"]
    F --> G["Track volunteer<br/>hours post-event"]

    style A fill:#f0f9ff
    style G fill:#dcfce7`;

const profileManagementChart = `flowchart TD
    A["Member logs in"] --> B["Go to Settings ><br/>Profile"]
    B --> C["Update personal info"]
    C --> D["Update skills<br/>and certifications"]
    D --> E["Set availability<br/>preferences"]
    E --> F["Save changes"]
    F --> G["Engagement score<br/>auto-updates"]

    style A fill:#f0f9ff
    style G fill:#dcfce7`;

const bulkUploadChart = `flowchart TD
    A["Prepare Excel file<br/>with member data"] --> B["Navigate to<br/>Members > Bulk Upload"]
    B --> C["Upload file"]
    C --> D["System validates<br/>data format"]
    D --> E{"Validation<br/>passed?"}
    E -->|Yes| F["Preview records"]
    E -->|No| G["Download error<br/>report"]
    G --> A
    F --> H["Confirm upload"]
    H --> I["Members created<br/>in batch"]

    style A fill:#f0f9ff
    style I fill:#dcfce7
    style E fill:#fef3c7`;

const roleAccesses = [
  {
    role: 'Super Admin / National Admin',
    access: 'full' as const,
    permissions: ['Full CRUD on all profiles', 'Role assignments', 'Analytics access', 'Bulk operations']
  },
  {
    role: 'Executive Member',
    access: 'full' as const,
    permissions: ['Add/edit/deactivate members', 'Assign roles', 'View engagement scores', 'Export data']
  },
  {
    role: 'Chair',
    access: 'full' as const,
    permissions: ['Add/edit members', 'View all profiles', 'Engagement analytics', 'Volunteer assignment']
  },
  {
    role: 'Co-Chair',
    access: 'view' as const,
    permissions: ['View member directory', 'Search and filter', 'View profiles (no edit)']
  },
  {
    role: 'EC Member',
    access: 'view' as const,
    permissions: ['View member directory', 'Assign to events', 'Search by skills']
  },
  {
    role: 'Yi Member',
    access: 'limited' as const,
    permissions: ['Edit own profile only', 'View own engagement score']
  }
];

export default function MembersDocPage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <DocPageHeader
        title="Member Intelligence Hub"
        description="Centralized member database with professional skills, engagement tracking, and smart volunteer matching capabilities."
        icon={Users}
        moduleNumber={1}
      />

      {/* Purpose */}
      <section>
        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Purpose & Objectives</h2>
        <Card>
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
            <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">
              The Member Intelligence Hub transforms invisible member skills into searchable, matchable
              intelligence. It enables smart volunteer coordination, reduces leadership bottlenecks,
              and provides data-driven insights into member engagement.
            </p>
            <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-3">
              <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
                <h4 className="font-medium mb-1.5 sm:mb-2 text-sm sm:text-base">Skill Discovery</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Capture and search member skills, certifications, and professional backgrounds.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
                <h4 className="font-medium mb-1.5 sm:mb-2 text-sm sm:text-base">Engagement Tracking</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Auto-calculated engagement scores based on attendance, volunteering, and participation.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
                <h4 className="font-medium mb-1.5 sm:mb-2 text-sm sm:text-base">Smart Matching</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  AI-powered volunteer suggestions based on skills, availability, and willingness.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Key Features */}
      <section>
        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Key Features</h2>
        <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2 px-3 sm:px-6">
              <CardTitle className="text-sm sm:text-base">Member Profiles</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              <ul className="text-xs sm:text-sm text-muted-foreground space-y-1">
                <li>- Basic info: name, email, phone, address</li>
                <li>- Professional background: company, designation, industry</li>
                <li>- Skills inventory with proficiency levels (1-5)</li>
                <li>- Certifications with expiry tracking</li>
                <li>- Availability preferences (days, times)</li>
                <li>- Vertical interests and willingness ratings</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 px-3 sm:px-6">
              <CardTitle className="text-sm sm:text-base">Engagement Score</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                Auto-calculated 0-100 score based on:
              </p>
              <ul className="text-xs sm:text-sm text-muted-foreground space-y-1">
                <li>- Event Attendance (40%)</li>
                <li>- Volunteer Hours (30%)</li>
                <li>- Leadership Activities (20%)</li>
                <li>- Communication Response (10%)</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 px-3 sm:px-6">
              <CardTitle className="text-sm sm:text-base">Directory Views</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              <ul className="text-xs sm:text-sm text-muted-foreground space-y-1">
                <li>- Table View: Full data with sorting and filtering</li>
                <li>- Grid View: Visual cards with photos</li>
                <li>- Analytics View: Charts and insights</li>
                <li>- Export: CSV/Excel download</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 px-3 sm:px-6">
              <CardTitle className="text-sm sm:text-base">Advanced Search</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              <ul className="text-xs sm:text-sm text-muted-foreground space-y-1">
                <li>- Filter by role, vertical, status</li>
                <li>- Search by skills and certifications</li>
                <li>- Filter by engagement score range</li>
                <li>- Availability-based filtering</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Role Access */}
      <RoleAccessTable accesses={roleAccesses} title="Role-Based Access" />

      {/* Workflows */}
      <section>
        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">User Workflows</h2>

        {/* Workflow 1 */}
        <div className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-3">
              <CardTitle className="text-sm sm:text-base">Workflow 1: New Member Onboarding</CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              <MermaidDiagram chart={memberOnboardingChart} />
              <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3 px-1 sm:px-0">
                <h4 className="font-medium text-sm sm:text-base">Step-by-Step:</h4>
                <ol className="text-xs sm:text-sm text-muted-foreground space-y-1.5 sm:space-y-2 list-decimal list-inside">
                  <li>After confirming membership payment, navigate to <code className="bg-muted px-1 rounded text-xs">Members &gt; Add Member</code></li>
                  <li>Fill in the member&apos;s personal details (name, email, phone number)</li>
                  <li>Add professional information including company, designation, and skills</li>
                  <li>Set availability preferences and vertical interests</li>
                  <li>Submit the form - system validates and creates the member record</li>
                  <li>Welcome email is automatically sent with login credentials</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Workflow 2 */}
          <Card>
            <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-3">
              <CardTitle className="text-sm sm:text-base">Workflow 2: Smart Volunteer Matching</CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              <MermaidDiagram chart={volunteerMatchingChart} />
              <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3 px-1 sm:px-0">
                <h4 className="font-medium text-sm sm:text-base">Step-by-Step:</h4>
                <ol className="text-xs sm:text-sm text-muted-foreground space-y-1.5 sm:space-y-2 list-decimal list-inside">
                  <li>Open an event that needs volunteers</li>
                  <li>Go to the Volunteers tab in the event details</li>
                  <li>System automatically suggests members based on required skills</li>
                  <li>Filter suggestions by availability, willingness level, and location</li>
                  <li>Select and assign volunteers to specific roles</li>
                  <li>Notifications are sent to assigned volunteers</li>
                  <li>After the event, log volunteer hours for engagement tracking</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Workflow 3 */}
          <Card>
            <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-3">
              <CardTitle className="text-sm sm:text-base">Workflow 3: Profile Management</CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              <MermaidDiagram chart={profileManagementChart} />
              <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3 px-1 sm:px-0">
                <h4 className="font-medium text-sm sm:text-base">Step-by-Step:</h4>
                <ol className="text-xs sm:text-sm text-muted-foreground space-y-1.5 sm:space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded text-xs">Settings &gt; Profile</code></li>
                  <li>Update personal information (phone, address, etc.)</li>
                  <li>Add or update skills with proficiency levels</li>
                  <li>Upload certifications with validity dates</li>
                  <li>Set your availability for volunteering</li>
                  <li>Save changes - engagement score auto-recalculates</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Workflow 4 */}
          <Card>
            <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-3">
              <CardTitle className="text-sm sm:text-base">Workflow 4: Bulk Member Upload</CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              <MermaidDiagram chart={bulkUploadChart} />
              <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3 px-1 sm:px-0">
                <h4 className="font-medium text-sm sm:text-base">Step-by-Step:</h4>
                <ol className="text-xs sm:text-sm text-muted-foreground space-y-1.5 sm:space-y-2 list-decimal list-inside">
                  <li>Download the Excel template from the Bulk Upload page</li>
                  <li>Fill in member data following the template format</li>
                  <li>Navigate to <code className="bg-muted px-1 rounded text-xs">Members &gt; Bulk Upload</code></li>
                  <li>Upload the completed Excel file</li>
                  <li>System validates data format and checks for duplicates</li>
                  <li>Review the preview and confirm upload</li>
                  <li>Members are created in batch with welcome emails</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Tips */}
      <section>
        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Tips & Best Practices</h2>
        <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 sm:p-6">
          <div className="flex items-start gap-2 sm:gap-3">
            <Lightbulb className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 mt-0.5 shrink-0" />
            <div className="space-y-2 sm:space-y-3">
              <div>
                <h4 className="font-medium text-sm sm:text-base">Keep Profiles Updated</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Encourage members to update their skills and availability regularly.
                  Accurate data leads to better volunteer matching.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-sm sm:text-base">Use Analytics</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Review the Member Analytics dashboard monthly to identify engagement trends
                  and members who may need re-engagement outreach.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-sm sm:text-base">Certification Alerts</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  System sends automatic alerts 30 days before certifications expire.
                  Use this to prompt members to renew their credentials.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Related Modules */}
      <section>
        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Related Modules</h2>
        <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-3">
          <Card className="hover:border-primary/50 cursor-pointer">
            <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
              <h4 className="font-medium mb-1 text-sm sm:text-base">Event Lifecycle Manager</h4>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Member data feeds into volunteer suggestions and attendance tracking.
              </p>
            </CardContent>
          </Card>
          <Card className="hover:border-primary/50 cursor-pointer">
            <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
              <h4 className="font-medium mb-1 text-sm sm:text-base">Take Pride Awards</h4>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Engagement scores are used in award eligibility calculations.
              </p>
            </CardContent>
          </Card>
          <Card className="hover:border-primary/50 cursor-pointer">
            <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
              <h4 className="font-medium mb-1 text-sm sm:text-base">Succession Planning</h4>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Leadership readiness scores inform succession nominations.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
