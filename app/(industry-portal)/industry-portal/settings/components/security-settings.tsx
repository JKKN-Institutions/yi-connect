'use client';

import { useState, useActionState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Loader2,
  Key,
  Shield,
  Monitor,
  Smartphone,
  Clock,
  MapPin,
  LogOut,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  changePassword,
  revokeSession,
  toggleTwoFactor,
  type ActionResponse,
} from '@/app/actions/industry-portal';

interface Session {
  id: string;
  device: string;
  browser: string;
  location: string;
  last_active: string;
  is_current: boolean;
}

interface SecuritySettingsProps {
  sessions: Session[];
  twoFactorEnabled?: boolean;
}

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords don't match",
    path: ['confirm_password'],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

const initialState: ActionResponse = {
  success: false,
  message: '',
};

export function SecuritySettings({ sessions, twoFactorEnabled = false }: SecuritySettingsProps) {
  const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(twoFactorEnabled);
  const [isTogglingTwoFactor, setIsTogglingTwoFactor] = useState(false);
  const [isRevokingSession, setIsRevokingSession] = useState<string | null>(null);
  const [state, formAction, isPending] = useActionState(changePassword, initialState);

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      current_password: '',
      new_password: '',
      confirm_password: '',
    },
  });

  useEffect(() => {
    if (state.success) {
      toast.success(state.message || 'Password changed successfully');
      form.reset();
    } else if (state.message && !state.success) {
      toast.error(state.message);
    }
  }, [state, form]);

  const handleToggleTwoFactor = async () => {
    setIsTogglingTwoFactor(true);
    try {
      const result = await toggleTwoFactor(!isTwoFactorEnabled);
      if (result.success) {
        setIsTwoFactorEnabled(!isTwoFactorEnabled);
        toast.success(result.message || '2FA settings updated');
      } else {
        toast.error(result.message || 'Failed to toggle 2FA');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsTogglingTwoFactor(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    setIsRevokingSession(sessionId);
    try {
      const result = await revokeSession(sessionId);
      if (result.success) {
        toast.success(result.message || 'Session revoked');
      } else {
        toast.error(result.message || 'Failed to revoke session');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsRevokingSession(null);
    }
  };

  const getDeviceIcon = (device: string) => {
    if (device.toLowerCase().includes('mobile') || device.toLowerCase().includes('phone')) {
      return Smartphone;
    }
    return Monitor;
  };

  return (
    <div className="space-y-6">
      {/* Change Password Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Change Password</CardTitle>
          </div>
          <CardDescription>
            Update your password to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form action={formAction} className="space-y-4">
              <FormField
                control={form.control}
                name="current_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter current password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="new_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter new password" {...field} />
                    </FormControl>
                    <FormDescription>
                      Must be at least 8 characters long
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirm_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Confirm new password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Changing...
                  </>
                ) : (
                  'Change Password'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Two-Factor Authentication</CardTitle>
          </div>
          <CardDescription>
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="two-factor" className="font-medium">
                {isTwoFactorEnabled ? 'Enabled' : 'Disabled'}
              </Label>
              <p className="text-sm text-muted-foreground">
                {isTwoFactorEnabled
                  ? 'Your account is protected with two-factor authentication'
                  : 'Enable 2FA to require a verification code when signing in'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isTogglingTwoFactor && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              <Switch
                id="two-factor"
                checked={isTwoFactorEnabled}
                onCheckedChange={handleToggleTwoFactor}
                disabled={isTogglingTwoFactor}
              />
            </div>
          </div>
          {!isTwoFactorEnabled && (
            <p className="text-xs text-amber-600 mt-3">
              We recommend enabling two-factor authentication for enhanced security.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Active Sessions Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Active Sessions</CardTitle>
          </div>
          <CardDescription>
            Manage devices where you are currently logged in
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active sessions found.</p>
            ) : (
              sessions.map((session) => {
                const DeviceIcon = getDeviceIcon(session.device);
                return (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <DeviceIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{session.device}</span>
                          {session.is_current && (
                            <Badge variant="default" className="text-xs">
                              Current
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{session.browser}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {session.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(session.last_active), 'MMM d, yyyy h:mm a')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {!session.is_current && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <LogOut className="h-4 w-4 mr-1" />
                            Revoke
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revoke Session</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will sign you out from {session.device}. You will need to sign in
                              again on that device.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRevokeSession(session.id)}
                              disabled={isRevokingSession === session.id}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {isRevokingSession === session.id ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : null}
                              Revoke Session
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
