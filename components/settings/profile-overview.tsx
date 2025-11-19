/**
 * Profile Overview Component
 *
 * Displays user profile information with role and chapter details
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Mail, Phone, Building2, MapPin, ShieldCheck } from 'lucide-react';
import type { ProfileWithRole, Profile } from '@/types/profile';

interface ProfileOverviewProps {
  profile: ProfileWithRole;
}

export function ProfileOverview({ profile }: ProfileOverviewProps) {
  // Type helper to access Profile properties (ProfileWithRole extends Profile)
  const profileData = profile as any as Profile & typeof profile;

  const initials = (profileData.full_name || 'User')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Get all roles sorted by hierarchy
  const roles = profile.roles?.sort(
    (a, b) => (b.hierarchy_level || 0) - (a.hierarchy_level || 0)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Overview</CardTitle>
        <CardDescription>Your account information and roles</CardDescription>
      </CardHeader>
      <CardContent className='space-y-6'>
        {/* Avatar and Name */}
        <div className='flex items-center gap-4'>
          <Avatar className='h-20 w-20'>
            <AvatarImage
              src={profileData.avatar_url || undefined}
              alt={profileData.full_name || 'User'}
            />
            <AvatarFallback className='bg-primary text-primary-foreground text-2xl'>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className='space-y-1'>
            <h3 className='text-2xl font-bold'>{profileData.full_name}</h3>
            {roles && roles.length > 0 && (
              <div className='flex flex-wrap gap-2'>
                {roles.map((userRole, index) => (
                  <Badge key={index} variant='secondary'>
                    <ShieldCheck className='mr-1 h-3 w-3' />
                    {userRole.role_name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Contact Information */}
        <div className='space-y-3'>
          <h4 className='text-sm font-semibold text-muted-foreground'>
            Contact Information
          </h4>
          <div className='space-y-2'>
            <div className='flex items-center gap-2 text-sm'>
              <Mail className='h-4 w-4 text-muted-foreground' />
              <span>{profileData.email}</span>
            </div>
            {profileData.phone && (
              <div className='flex items-center gap-2 text-sm'>
                <Phone className='h-4 w-4 text-muted-foreground' />
                <span>{profileData.phone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Chapter Information */}
        {profile.chapter && (
          <div className='space-y-3'>
            <h4 className='text-sm font-semibold text-muted-foreground'>
              Chapter
            </h4>
            <div className='space-y-2'>
              <div className='flex items-center gap-2 text-sm'>
                <Building2 className='h-4 w-4 text-muted-foreground' />
                <span>{profile.chapter.name}</span>
              </div>
              <div className='flex items-center gap-2 text-sm'>
                <MapPin className='h-4 w-4 text-muted-foreground' />
                <span>{profile.chapter.location}</span>
              </div>
            </div>
          </div>
        )}

        {/* Role Descriptions */}
        {roles && roles.length > 0 && (
          <div className='space-y-3'>
            <h4 className='text-sm font-semibold text-muted-foreground'>
              Your Roles
            </h4>
            <div className='space-y-2'>
              {roles.map((userRole, index) => (
                <div
                  key={index}
                  className='rounded-lg border bg-muted/50 p-3 text-sm'
                >
                  <div className='font-medium'>{userRole.role_name}</div>
                  <div className='mt-1 text-xs text-muted-foreground'>
                    Hierarchy Level: {userRole.hierarchy_level}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
