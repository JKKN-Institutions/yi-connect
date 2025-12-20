/**
 * Settings Page (Industry Portal)
 * Manage industry profile and portal settings
 */

import { Suspense } from 'react';
import { Metadata } from 'next';
import { Building2, User, Bell, Shield, Plus, Trash2, Edit, Mail, Phone } from 'lucide-react';
import { cookies } from 'next/headers';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { createClient } from '@/lib/supabase/server';
import { IndustryProfileForm } from '@/components/industry-portal/industry-profile-form';
import { IndustryPortalUserDialog } from '@/components/industry-portal/industry-portal-user-dialog';
import { NotificationSettingsForm } from '@/components/industry-portal/notification-settings-form';
import { SecuritySettingsForm } from '@/components/industry-portal/security-settings-form';

export const metadata: Metadata = {
  title: 'Settings | Industry Portal',
  description: 'Manage your industry portal settings',
};

async function getIndustryPortalData() {
  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Get industry portal user
  const { data: portalUser } = await supabase
    .from('industry_portal_users')
    .select(`
      *,
      industry:industries(
        id, company_name, industry_sector, city, state,
        address_line1, website, employee_count, has_csr_program,
        csr_focus_areas, collaboration_interests, notes
      )
    `)
    .eq('email', user.email)
    .eq('status', 'active')
    .single();

  if (!portalUser) return null;

  // Get all portal users for this industry
  const { data: allPortalUsers } = await supabase
    .from('industry_portal_users')
    .select('id, email, full_name, role, status, permissions, last_login_at, created_at')
    .eq('industry_id', portalUser.industry_id)
    .order('created_at', { ascending: false });

  return {
    currentUser: portalUser,
    industry: portalUser.industry,
    portalUsers: allPortalUsers || [],
  };
}

async function SettingsContent() {
  const data = await getIndustryPortalData();

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">
          You don&apos;t have access to the industry portal settings.
        </p>
      </div>
    );
  }

  const { currentUser, industry, portalUsers } = data;
  const canManageUsers = currentUser.permissions?.add_slot || currentUser.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your industry profile and portal preferences
        </p>
      </div>

      <Separator />

      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile">
            <Building2 className="mr-2 h-4 w-4" />
            Company Profile
          </TabsTrigger>
          <TabsTrigger value="users">
            <User className="mr-2 h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-2 h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="mr-2 h-4 w-4" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* Company Profile */}
        <TabsContent value="profile" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>
                Update your company profile visible to Yi members
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IndustryProfileForm industry={industry} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users */}
        <TabsContent value="users" className="mt-6 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Portal Users</CardTitle>
                <CardDescription>
                  Manage users who can access and create slots from your company
                </CardDescription>
              </div>
              {canManageUsers && (
                <IndustryPortalUserDialog
                  industryId={industry.id}
                  trigger={
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add User
                    </Button>
                  }
                />
              )}
            </CardHeader>
            <CardContent>
              {portalUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No portal users found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {portalUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>
                                {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{user.full_name || 'Unnamed'}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{user.role || 'User'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={user.status === 'active' ? 'default' : 'secondary'}
                          >
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {user.last_login_at
                            ? new Date(user.last_login_at).toLocaleDateString()
                            : 'Never'
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          {canManageUsers && user.id !== currentUser.id && (
                            <div className="flex justify-end gap-2">
                              <IndustryPortalUserDialog
                                industryId={industry.id}
                                existingUser={user}
                                trigger={
                                  <Button variant="ghost" size="icon">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                }
                              />
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose when and how you want to be notified
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NotificationSettingsForm userId={currentUser.id} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Manage your password and security preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SecuritySettingsForm userEmail={currentUser.email} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <Separator />
      <Skeleton className="h-10 w-96" />
      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsLoading />}>
      <SettingsContent />
    </Suspense>
  );
}
