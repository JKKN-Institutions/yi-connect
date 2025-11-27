/**
 * Industrial Visits Documentation
 *
 * Industrial visit marketplace, booking, carpool coordination, and industry partnerships.
 */

import { DocPageHeader, MermaidDiagram, RoleAccessTable } from '@/components/docs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Factory, Lightbulb } from 'lucide-react';

const browseMarketplaceChart = `flowchart TD
    A["Want to attend<br/>industrial visit"] --> B["Industrial Visits ><br/>Marketplace"]
    B --> C["Browse available<br/>visits"]
    C --> D["Filter by sector<br/>or date"]
    D --> E["View visit<br/>details"]
    E --> F["Check available<br/>capacity"]
    F --> G{{"Spots available?"}}
    G -->|Yes| H["Book spot"]
    G -->|No| I["Join waitlist"]
    H --> J["Confirmation<br/>received"]
    I --> J

    style A fill:#f0f9ff
    style J fill:#dcfce7
    style G fill:#fef3c7`;

const bookVisitChart = `flowchart TD
    A["Found visit<br/>to attend"] --> B["Click Book Now"]
    B --> C["Review visit<br/>details"]
    C --> D["Select number<br/>of participants"]
    D --> E["Add attendee<br/>details"]
    E --> F{{"Need carpool?"}}
    F -->|Yes| G["Browse available<br/>rides"]
    F -->|No| H["Skip carpool"]
    G --> I["Request carpool<br/>seat"]
    H --> J["Confirm booking"]
    I --> J
    J --> K["Booking added to<br/>My Bookings"]

    style A fill:#f0f9ff
    style K fill:#dcfce7
    style F fill:#fef3c7`;

const offerCarpoolChart = `flowchart TD
    A["Have extra seats<br/>in vehicle"] --> B["My Bookings ><br/>Select Booking"]
    B --> C["Click Offer<br/>Carpool"]
    C --> D["Enter number<br/>of seats"]
    D --> E["Set pickup<br/>location"]
    E --> F["Add any notes"]
    F --> G["Publish carpool<br/>offer"]
    G --> H["Others can<br/>request seats"]

    style A fill:#f0f9ff
    style H fill:#dcfce7`;

const createIVChart = `flowchart TD
    A["Plan new<br/>industrial visit"] --> B["Industrial Visits ><br/>Admin > Create IV"]
    B --> C["Enter visit<br/>details"]
    C --> D["Set industry<br/>sector"]
    D --> E["Define capacity<br/>and pricing"]
    E --> F["Add venue<br/>and schedule"]
    F --> G["Upload<br/>banner image"]
    G --> H["Publish visit"]
    H --> I["Appears in<br/>marketplace"]

    style A fill:#f0f9ff
    style I fill:#dcfce7`;

const roleAccesses = [
  {
    role: 'Super Admin / National Admin',
    access: 'full' as const,
    permissions: ['Full IV management', 'Cross-chapter access', 'Analytics', 'Approve industry slots']
  },
  {
    role: 'Executive Member / Chair',
    access: 'full' as const,
    permissions: ['Create IVs', 'Manage bookings', 'Approve industry slots', 'View analytics']
  },
  {
    role: 'Co-Chair',
    access: 'limited' as const,
    permissions: ['Create IVs', 'Manage bookings', 'View analytics']
  },
  {
    role: 'EC Member',
    access: 'limited' as const,
    permissions: ['Browse marketplace', 'Book visits', 'Offer carpool', 'View own bookings']
  },
  {
    role: 'Yi Member',
    access: 'limited' as const,
    permissions: ['Browse marketplace', 'Book visits', 'Join carpool', 'View own bookings']
  },
  {
    role: 'Industry Partner',
    access: 'limited' as const,
    permissions: ['Create self-service slots', 'View registrations for own slots']
  }
];

export default function IndustrialVisitsDocPage() {
  return (
    <div className="space-y-8">
      <DocPageHeader
        title="Industrial Visits"
        description="Browse and book industrial visits, coordinate carpools, and manage industry partnerships for learning experiences."
        icon={Factory}
        moduleNumber={11}
      />

      {/* Purpose */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Purpose & Objectives</h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">
              The Industrial Visits module facilitates factory and facility visits for Yi members.
              It includes a marketplace for browsing opportunities, booking management, carpool
              coordination, and a self-service portal for industry partners.
            </p>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Marketplace</h4>
                <p className="text-sm text-muted-foreground">Browse & book visits</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Carpool</h4>
                <p className="text-sm text-muted-foreground">Coordinate travel</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Self-Service</h4>
                <p className="text-sm text-muted-foreground">Industry partner portal</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Analytics</h4>
                <p className="text-sm text-muted-foreground">Track participation</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Industry Sectors */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Industry Sectors</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-3">
              {[
                { sector: 'Manufacturing', desc: 'Production facilities, factories' },
                { sector: 'Technology', desc: 'Tech companies, R&D centers' },
                { sector: 'Healthcare', desc: 'Hospitals, pharmaceutical plants' },
                { sector: 'Energy', desc: 'Power plants, renewable installations' },
                { sector: 'Food & Beverage', desc: 'Food processing, breweries' },
                { sector: 'Automotive', desc: 'Assembly plants, suppliers' },
                { sector: 'Textiles', desc: 'Garment factories, mills' },
                { sector: 'Logistics', desc: 'Warehouses, distribution centers' },
                { sector: 'Construction', desc: 'Sites, material plants' }
              ].map((item) => (
                <div key={item.sector} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Factory className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{item.sector}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
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
              <CardTitle className="text-base">Visit Marketplace</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Browse available industrial visits</li>
                <li>- Filter by sector, date, location</li>
                <li>- View capacity and availability</li>
                <li>- Grid and table view options</li>
                <li>- Calendar integration</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Carpool Coordination</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Offer rides to visit location</li>
                <li>- Request carpool seats</li>
                <li>- Pickup location coordination</li>
                <li>- Sustainability impact tracking</li>
                <li>- Driver and rider matching</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Industry Self-Service</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Industry partners create slots</li>
                <li>- Admin approval workflow</li>
                <li>- Automatic publishing</li>
                <li>- Registration management</li>
                <li>- Partner dashboard</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Visit Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Total visits conducted</li>
                <li>- Participant statistics</li>
                <li>- Attendance rates</li>
                <li>- Industry sector coverage</li>
                <li>- Carpool sustainability metrics</li>
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
              <CardTitle className="text-base">Workflow 1: Browse Marketplace</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={browseMarketplaceChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">Industrial Visits &gt; Marketplace</code></li>
                  <li>Browse available industrial visits</li>
                  <li>Use filters to narrow by industry sector or date</li>
                  <li>Click on a visit to view full details</li>
                  <li>Check available capacity</li>
                  <li>If spots available, proceed to book</li>
                  <li>If full, join the waitlist for notifications</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 2: Book Industrial Visit</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={bookVisitChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Select the industrial visit you want to attend</li>
                  <li>Click &quot;Book Now&quot; button</li>
                  <li>Review visit details (date, time, location, requirements)</li>
                  <li>Select number of participants</li>
                  <li>Enter attendee details for each participant</li>
                  <li>Optionally browse carpool offers if you need a ride</li>
                  <li>Confirm your booking</li>
                  <li>Booking confirmation appears in My Bookings</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 3: Offer Carpool</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={offerCarpoolChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">Industrial Visits &gt; My Bookings</code></li>
                  <li>Select the visit you&apos;re attending</li>
                  <li>Click &quot;Offer Carpool&quot;</li>
                  <li>Enter number of available seats</li>
                  <li>Set your pickup location and time</li>
                  <li>Add any notes (vehicle type, preferences)</li>
                  <li>Publish your carpool offer</li>
                  <li>Other attendees can request seats from you</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 4: Create Industrial Visit (Admin)</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={createIVChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">Industrial Visits &gt; Admin</code></li>
                  <li>Click &quot;Create IV&quot;</li>
                  <li>Enter visit details:
                    <ul className="ml-4 mt-1 space-y-1 list-disc list-inside">
                      <li>Title and description</li>
                      <li>Host company information</li>
                      <li>Industry sector</li>
                    </ul>
                  </li>
                  <li>Set capacity limits and any fees</li>
                  <li>Add venue address and schedule</li>
                  <li>Upload a banner image</li>
                  <li>Publish the visit - it appears in the marketplace</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Booking Statuses */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Booking Status</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center gap-4 p-3 rounded-lg border">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div>
                  <p className="font-medium">Pending</p>
                  <p className="text-sm text-muted-foreground">Booking submitted, awaiting confirmation</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-lg border">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <div>
                  <p className="font-medium">Confirmed</p>
                  <p className="text-sm text-muted-foreground">Spot secured, ready to attend</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-lg border">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <div>
                  <p className="font-medium">Attended</p>
                  <p className="text-sm text-muted-foreground">Visit completed successfully</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-lg border">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div>
                  <p className="font-medium">Cancelled</p>
                  <p className="text-sm text-muted-foreground">Booking was cancelled</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-lg border">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <div>
                  <p className="font-medium">Waitlisted</p>
                  <p className="text-sm text-muted-foreground">On waitlist, notified if spot opens</p>
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
                <h4 className="font-medium">Book Early</h4>
                <p className="text-sm text-muted-foreground">
                  Popular industrial visits fill up quickly. Book as soon as
                  new visits are announced to secure your spot.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Use Carpool</h4>
                <p className="text-sm text-muted-foreground">
                  Offer or request carpool rides. It&apos;s environmentally friendly
                  and helps build connections with fellow members.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Prepare Questions</h4>
                <p className="text-sm text-muted-foreground">
                  Review the company profile before the visit. Prepare thoughtful
                  questions to make the most of the experience.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Follow Safety Guidelines</h4>
                <p className="text-sm text-muted-foreground">
                  Industrial facilities have safety requirements. Wear appropriate
                  attire and follow all safety instructions during the visit.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
