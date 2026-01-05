/**
 * Settings Page (Industry Portal)
 * Manage industry profile and portal settings
 */

import { Suspense } from 'react';
import { Metadata } from 'next';
import { Building2, User, Bell, Shield } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

import { getCurrentIndustryId } from '@/lib/auth/industry-portal';
import {
  getIndustryProfile,
  getIndustryCoordinators,
  getNotificationSettings,
  getActiveSessions,
} from '@/app/actions/industry-portal';

import { CompanyProfileForm } from './components/company-profile-form';
import { UsersManagement } from './components/users-management';
import { NotificationsSettings } from './components/notifications-settings';
import { SecuritySettings } from './components/security-settings';

export const metadata: Metadata = {
  title: 'Settings | Industry Portal',
  description: 'Manage your industry portal settings',
};

// Force dynamic rendering
export const dynamic = 'force-dynamic';

function SettingsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-96 mt-2" />
      </div>
      <Separator />
      <div className="flex gap-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-32" />
        ))}
      </div>
      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  );
}

async function SettingsContent() {
  const industryId = await getCurrentIndustryId();

  if (!industryId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">
          You need to be authenticated as an industry user to access settings.
        </p>
      </div>
    );
  }

  // Fetch all data in parallel
  const [profile, coordinators, notificationSettings, sessions] = await Promise.all([
    getIndustryProfile(industryId),
    getIndustryCoordinators(industryId),
    getNotificationSettings(industryId),
    getActiveSessions(),
  ]);

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
              <CompanyProfileForm initialData={profile} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users */}
        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Portal Users</CardTitle>
              <CardDescription>
                Manage users who can access and create slots from your company
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UsersManagement coordinators={coordinators} />
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
              <NotificationsSettings initialSettings={notificationSettings} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="mt-6">
          <SecuritySettings sessions={sessions} twoFactorEnabled={false} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsLoadingSkeleton />}>
      <SettingsContent />
    </Suspense>
  );
}
