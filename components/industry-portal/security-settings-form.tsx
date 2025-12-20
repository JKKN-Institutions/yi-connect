/**
 * Security Settings Form Component
 * Form for managing password and security settings
 */

'use client';

import { useState, useActionState, useEffect } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, Shield, Key, Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { changePassword } from '@/app/actions/industry-portal';

interface SecuritySettingsFormProps {
  userEmail: string;
}

export function SecuritySettingsForm({ userEmail }: SecuritySettingsFormProps) {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [state, formAction, isPending] = useActionState(changePassword, {
    message: '',
  });

  useEffect(() => {
    if (state.success) {
      toast.success(state.message);
      // Reset form
      const form = document.getElementById('password-form') as HTMLFormElement;
      form?.reset();
    } else if (state.message && !state.success) {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <div className="space-y-6">
      {/* Account Info */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">Account Security</h3>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Address</p>
                  <p className="text-sm text-muted-foreground">{userEmail}</p>
                </div>
                <Badge variant="outline">Verified</Badge>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-muted-foreground">
                    Add an extra layer of security to your account
                  </p>
                </div>
                <Badge variant="secondary">Not Enabled</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Change Password */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">Change Password</h3>
        </div>

        <form id="password-form" action={formAction} className="space-y-4 max-w-md">
          <input type="hidden" name="email" value={userEmail} />

          {/* Current Password */}
          <div className="space-y-2">
            <Label htmlFor="current_password">Current Password</Label>
            <div className="relative">
              <Input
                id="current_password"
                name="current_password"
                type={showCurrentPassword ? 'text' : 'password'}
                placeholder="Enter current password"
                required
                disabled={isPending}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            {state.errors?.current_password && (
              <p className="text-sm text-destructive">{state.errors.current_password[0]}</p>
            )}
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="new_password">New Password</Label>
            <div className="relative">
              <Input
                id="new_password"
                name="new_password"
                type={showNewPassword ? 'text' : 'password'}
                placeholder="Enter new password"
                required
                disabled={isPending}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Password must be at least 8 characters with a mix of letters and numbers
            </p>
            {state.errors?.new_password && (
              <p className="text-sm text-destructive">{state.errors.new_password[0]}</p>
            )}
          </div>

          {/* Confirm New Password */}
          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirm_password"
                name="confirm_password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                required
                disabled={isPending}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            {state.errors?.confirm_password && (
              <p className="text-sm text-destructive">{state.errors.confirm_password[0]}</p>
            )}
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      </div>

      <Separator />

      {/* Login Activity */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">Recent Activity</h3>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">Current Session</p>
                  <p className="text-muted-foreground">
                    {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
                  </p>
                </div>
                <Badge variant="default">Active</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
