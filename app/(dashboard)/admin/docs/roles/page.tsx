/**
 * Roles & Permissions Documentation Page
 *
 * Comprehensive reference for role hierarchy, permissions,
 * and module access matrix.
 */

import { DocPageHeader, MermaidDiagram } from '@/components/docs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Shield, Check, X, Minus } from 'lucide-react';

const roleHierarchyChart = `flowchart TB
    SA["Super Admin<br/><small>Level 7</small>"] --> NA["National Admin<br/><small>Level 6</small>"]
    NA --> EM["Executive Member<br/><small>Level 5</small>"]
    EM --> CH["Chair<br/><small>Level 4</small>"]
    CH --> CC["Co-Chair<br/><small>Level 3</small>"]
    CC --> EC["EC Member<br/><small>Level 2</small>"]
    EC --> VC["Vertical Chair<br/><small>Level 2</small>"]
    EC --> SC["Sub-Chapter Lead<br/><small>Level 2</small>"]
    EC --> YM["Yi Member<br/><small>Level 1</small>"]

    style SA fill:#dc2626,color:#fff
    style NA fill:#ea580c,color:#fff
    style EM fill:#ca8a04,color:#fff
    style CH fill:#16a34a,color:#fff
    style CC fill:#0891b2,color:#fff
    style EC fill:#6366f1,color:#fff
    style VC fill:#8b5cf6,color:#fff
    style SC fill:#8b5cf6,color:#fff
    style YM fill:#94a3b8,color:#fff`;

const roles = [
  {
    name: 'Super Admin',
    level: 7,
    description: 'System administrator with complete control over all features',
    responsibilities: [
      'Full system configuration',
      'User impersonation',
      'All permissions across all modules',
      'Database management'
    ]
  },
  {
    name: 'National Admin',
    level: 6,
    description: 'National level administrator managing multiple chapters',
    responsibilities: [
      'Cross-chapter management',
      'National event coordination',
      'Benchmark monitoring',
      'All chapter-level permissions'
    ]
  },
  {
    name: 'Executive Member',
    level: 5,
    description: 'Chapter director with full operational access',
    responsibilities: [
      'Full chapter operations',
      'Budget allocation',
      'Role assignment',
      'Member verification'
    ]
  },
  {
    name: 'Chair',
    level: 4,
    description: 'Chapter leader responsible for day-to-day operations',
    responsibilities: [
      'Event approval and management',
      'Expense approval',
      'Member management',
      'Communication oversight'
    ]
  },
  {
    name: 'Co-Chair',
    level: 3,
    description: 'Deputy chapter leader supporting the Chair',
    responsibilities: [
      'Support Chair functions',
      'View dashboards and reports',
      'Limited approval authority',
      'Event coordination'
    ]
  },
  {
    name: 'EC Member',
    level: 2,
    description: 'Executive Committee member with module-specific access',
    responsibilities: [
      'Create and manage events',
      'View member directory',
      'Submit nominations',
      'Log interactions'
    ]
  },
  {
    name: 'Yi Member',
    level: 1,
    description: 'Regular chapter member with basic access',
    responsibilities: [
      'View own profile',
      'RSVP to events',
      'Submit nominations',
      'View public content'
    ]
  }
];

const moduleAccessMatrix = [
  {
    module: 'Member Hub',
    superAdmin: 'full',
    nationalAdmin: 'full',
    executive: 'full',
    chair: 'full',
    coChair: 'view',
    ecMember: 'view',
    member: 'self'
  },
  {
    module: 'Stakeholders',
    superAdmin: 'full',
    nationalAdmin: 'full',
    executive: 'full',
    chair: 'full',
    coChair: 'view',
    ecMember: 'limited',
    member: 'none'
  },
  {
    module: 'Events',
    superAdmin: 'full',
    nationalAdmin: 'full',
    executive: 'full',
    chair: 'full',
    coChair: 'limited',
    ecMember: 'limited',
    member: 'rsvp'
  },
  {
    module: 'Finance',
    superAdmin: 'full',
    nationalAdmin: 'full',
    executive: 'full',
    chair: 'full',
    coChair: 'view',
    ecMember: 'submit',
    member: 'none'
  },
  {
    module: 'Succession',
    superAdmin: 'full',
    nationalAdmin: 'full',
    executive: 'full',
    chair: 'limited',
    coChair: 'limited',
    ecMember: 'view',
    member: 'view'
  },
  {
    module: 'Awards',
    superAdmin: 'full',
    nationalAdmin: 'full',
    executive: 'full',
    chair: 'limited',
    coChair: 'limited',
    ecMember: 'jury',
    member: 'nominate'
  },
  {
    module: 'Communications',
    superAdmin: 'full',
    nationalAdmin: 'full',
    executive: 'full',
    chair: 'full',
    coChair: 'send',
    ecMember: 'view',
    member: 'receive'
  },
  {
    module: 'Knowledge',
    superAdmin: 'full',
    nationalAdmin: 'full',
    executive: 'full',
    chair: 'full',
    coChair: 'upload',
    ecMember: 'upload',
    member: 'view'
  },
  {
    module: 'Verticals',
    superAdmin: 'full',
    nationalAdmin: 'full',
    executive: 'full',
    chair: 'full',
    coChair: 'view',
    ecMember: 'limited',
    member: 'none'
  },
  {
    module: 'National',
    superAdmin: 'full',
    nationalAdmin: 'full',
    executive: 'limited',
    chair: 'view',
    coChair: 'none',
    ecMember: 'none',
    member: 'register'
  }
];

function AccessCell({ access }: { access: string }) {
  const styles: Record<string, { bg: string; text: string; icon: any }> = {
    full: { bg: 'bg-green-100', text: 'text-green-800', icon: Check },
    limited: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Minus },
    view: { bg: 'bg-blue-100', text: 'text-blue-800', icon: Check },
    none: { bg: 'bg-gray-100', text: 'text-gray-500', icon: X },
    self: { bg: 'bg-purple-100', text: 'text-purple-800', icon: Check },
    rsvp: { bg: 'bg-cyan-100', text: 'text-cyan-800', icon: Check },
    submit: { bg: 'bg-orange-100', text: 'text-orange-800', icon: Check },
    jury: { bg: 'bg-pink-100', text: 'text-pink-800', icon: Check },
    nominate: { bg: 'bg-indigo-100', text: 'text-indigo-800', icon: Check },
    send: { bg: 'bg-teal-100', text: 'text-teal-800', icon: Check },
    upload: { bg: 'bg-amber-100', text: 'text-amber-800', icon: Check },
    receive: { bg: 'bg-slate-100', text: 'text-slate-600', icon: Check },
    register: { bg: 'bg-emerald-100', text: 'text-emerald-800', icon: Check }
  };

  const style = styles[access] || styles.none;
  const Icon = style.icon;

  return (
    <Badge className={`${style.bg} ${style.text} hover:${style.bg} text-xs`}>
      <Icon className="h-3 w-3 mr-1" />
      {access}
    </Badge>
  );
}

const permissionCategories = [
  {
    name: 'Member Management',
    permissions: [
      'VIEW_MEMBERS - View member directory',
      'MANAGE_MEMBERS - Add, edit, deactivate members',
      'ASSIGN_ROLES - Assign roles to users',
      'VIEW_MEMBER_ASSESSMENTS - View skill assessments',
      'MANAGE_MEMBER_ASSESSMENTS - Create/edit assessments'
    ]
  },
  {
    name: 'Events',
    permissions: [
      'VIEW_EVENTS - View event listings',
      'CREATE_EVENTS - Create new events',
      'MANAGE_EVENTS - Edit and delete events',
      'MARK_ATTENDANCE - Check-in attendees',
      'VIEW_EVENT_REPORTS - Access event reports'
    ]
  },
  {
    name: 'Finance',
    permissions: [
      'VIEW_FINANCE - View budgets and expenses',
      'MANAGE_FINANCE - Create budgets, submit expenses',
      'APPROVE_EXPENSES - Approve expense requests'
    ]
  },
  {
    name: 'Communications',
    permissions: [
      'VIEW_COMMUNICATIONS - Receive announcements',
      'SEND_ANNOUNCEMENTS - Create and send announcements',
      'MANAGE_TEMPLATES - Create communication templates'
    ]
  },
  {
    name: 'Administration',
    permissions: [
      'MANAGE_SETTINGS - Configure system settings',
      'VIEW_AUDIT_LOGS - Access audit trail',
      'MANAGE_ROLES - Create and modify roles',
      'IMPERSONATE_USERS - Act as another user (Super Admin only)'
    ]
  }
];

export default function RolesPage() {
  return (
    <div className="space-y-8">
      <DocPageHeader
        title="Roles & Permissions"
        description="Understanding the role hierarchy and what each role can access across Yi Connect modules."
        icon={Shield}
      />

      {/* Role Hierarchy Diagram */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Role Hierarchy</h2>
        <Card>
          <CardContent className="pt-6">
            <MermaidDiagram chart={roleHierarchyChart} />
          </CardContent>
        </Card>
        <p className="text-sm text-muted-foreground mt-3">
          Higher-level roles inherit all permissions from lower levels. Super Admin and National Admin
          have access to everything. Vertical Chairs and Sub-Chapter Leads have context-specific permissions.
        </p>
      </section>

      {/* Role Descriptions */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Role Descriptions</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {roles.map((role) => (
            <Card key={role.name}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{role.name}</CardTitle>
                  <Badge variant="outline">Level {role.level}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{role.description}</p>
                <div className="text-sm">
                  <span className="font-medium">Key Responsibilities:</span>
                  <ul className="mt-1 space-y-1 text-muted-foreground">
                    {role.responsibilities.map((resp, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-primary">-</span>
                        <span>{resp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Module Access Matrix */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Module Access Matrix</h2>
        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Module</TableHead>
                  <TableHead className="text-center">Super Admin</TableHead>
                  <TableHead className="text-center">National Admin</TableHead>
                  <TableHead className="text-center">Executive</TableHead>
                  <TableHead className="text-center">Chair</TableHead>
                  <TableHead className="text-center">Co-Chair</TableHead>
                  <TableHead className="text-center">EC Member</TableHead>
                  <TableHead className="text-center">Member</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {moduleAccessMatrix.map((row) => (
                  <TableRow key={row.module}>
                    <TableCell className="font-medium">{row.module}</TableCell>
                    <TableCell className="text-center">
                      <AccessCell access={row.superAdmin} />
                    </TableCell>
                    <TableCell className="text-center">
                      <AccessCell access={row.nationalAdmin} />
                    </TableCell>
                    <TableCell className="text-center">
                      <AccessCell access={row.executive} />
                    </TableCell>
                    <TableCell className="text-center">
                      <AccessCell access={row.chair} />
                    </TableCell>
                    <TableCell className="text-center">
                      <AccessCell access={row.coChair} />
                    </TableCell>
                    <TableCell className="text-center">
                      <AccessCell access={row.ecMember} />
                    </TableCell>
                    <TableCell className="text-center">
                      <AccessCell access={row.member} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground">Legend:</span>
          <AccessCell access="full" />
          <AccessCell access="limited" />
          <AccessCell access="view" />
          <AccessCell access="none" />
          <AccessCell access="self" />
        </div>
      </section>

      {/* Permission Categories */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Permission Categories</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {permissionCategories.map((category) => (
            <Card key={category.name}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{category.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-2">
                  {category.permissions.map((perm, i) => {
                    const [code, desc] = perm.split(' - ');
                    return (
                      <li key={i} className="flex items-start gap-2">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                          {code}
                        </code>
                        <span className="text-muted-foreground">{desc}</span>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Context-Specific Roles */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Context-Specific Roles</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Vertical Chair</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Assigned to lead a specific vertical (e.g., Masoom, Road Safety).
                Has elevated permissions within their vertical only.
              </p>
              <div className="text-sm">
                <span className="font-medium">Special Permissions:</span>
                <ul className="mt-1 space-y-1 text-muted-foreground">
                  <li>- Manage vertical stakeholders</li>
                  <li>- Assign trainers to sessions</li>
                  <li>- Approve materials for their vertical</li>
                  <li>- View vertical-specific reports</li>
                </ul>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Sub-Chapter Lead</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Leads a sub-chapter (geographic division) within the chapter.
                Has management access for their sub-chapter only.
              </p>
              <div className="text-sm">
                <span className="font-medium">Special Permissions:</span>
                <ul className="mt-1 space-y-1 text-muted-foreground">
                  <li>- Manage sub-chapter members</li>
                  <li>- Create sub-chapter events</li>
                  <li>- Mark attendance for events</li>
                  <li>- View sub-chapter reports</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Important Notes */}
      <section className="pt-4 border-t">
        <h2 className="text-xl font-semibold mb-4">Important Notes</h2>
        <div className="bg-muted/50 rounded-lg p-6 space-y-4">
          <div>
            <h3 className="font-medium mb-1">Role Assignment</h3>
            <p className="text-sm text-muted-foreground">
              Roles can only be assigned by users with MANAGE_ROLES permission (Executive Member and above).
              A user can have multiple roles simultaneously.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-1">Permission Inheritance</h3>
            <p className="text-sm text-muted-foreground">
              Higher-level roles automatically have all permissions of lower-level roles.
              Super Admin and National Admin bypass all permission checks.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-1">Data Isolation</h3>
            <p className="text-sm text-muted-foreground">
              Members can only see their own data (profile, applications, nominations).
              Coordinators can only see data for their assigned institution.
              All sensitive operations are logged in the audit trail.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
