'use client';

import { useState, useEffect } from 'react';
// Note: This is a client component. For National Admin protection,
// implement server-side checks in the action handlers (updateSyncConfig, testConnection, toggleSync)
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Settings,
  Globe,
  Key,
  RefreshCw,
  Shield,
  Database,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  TestTube,
  AlertTriangle
} from 'lucide-react';
import { updateSyncConfig, testConnection, toggleSync } from '@/app/actions/national-integration';
import { toast } from 'sonner';

export default function NationalSettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'failed'>('unknown');

  const [config, setConfig] = useState({
    api_endpoint: 'https://api.yinational.org/v1',
    api_key: '',
    sync_enabled: true,
    sync_frequency: 'hourly',
    auto_resolve_conflicts: false,
    sync_members: true,
    sync_events: true,
    sync_documents: true,
    sync_metrics: true,
    sync_leadership: true,
    notification_email: '',
    webhook_url: ''
  });

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const formData = new FormData();
      formData.set('api_endpoint', config.api_endpoint);
      formData.set('api_key', config.api_key);

      const result = await testConnection(formData);

      if (result.success) {
        setConnectionStatus('connected');
        toast.success('Connection successful!');
      } else {
        setConnectionStatus('failed');
        toast.error(result.error || 'Connection failed');
      }
    } catch (error) {
      setConnectionStatus('failed');
      toast.error('Connection test failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      Object.entries(config).forEach(([key, value]) => {
        formData.set(key, String(value));
      });

      const result = await updateSyncConfig(formData);

      if (result.success) {
        toast.success('Configuration saved successfully');
      } else {
        toast.error(result.error || 'Failed to save configuration');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSync = async (enabled: boolean) => {
    try {
      const result = await toggleSync(enabled);

      if (result.success) {
        setConfig((prev) => ({ ...prev, sync_enabled: enabled }));
        toast.success(enabled ? 'Sync enabled' : 'Sync disabled');
      } else {
        toast.error(result.error || 'Failed to toggle sync');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integration Settings</h1>
          <p className="text-muted-foreground">
            Configure connection to Yi National systems
          </p>
        </div>
        <Badge
          variant={
            connectionStatus === 'connected'
              ? 'default'
              : connectionStatus === 'failed'
                ? 'destructive'
                : 'secondary'
          }
        >
          {connectionStatus === 'connected' && (
            <CheckCircle2 className="h-4 w-4 mr-1" />
          )}
          {connectionStatus === 'failed' && <XCircle className="h-4 w-4 mr-1" />}
          {connectionStatus === 'unknown' && <Globe className="h-4 w-4 mr-1" />}
          {connectionStatus === 'connected'
            ? 'Connected'
            : connectionStatus === 'failed'
              ? 'Disconnected'
              : 'Not Tested'}
        </Badge>
      </div>

      <Tabs defaultValue="connection">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="connection">
            <Globe className="h-4 w-4 mr-2" />
            Connection
          </TabsTrigger>
          <TabsTrigger value="entities" id="entities">
            <Database className="h-4 w-4 mr-2" />
            Entities
          </TabsTrigger>
          <TabsTrigger value="schedule" id="schedule">
            <Clock className="h-4 w-4 mr-2" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* Connection Tab */}
        <TabsContent value="connection" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription>
                Configure connection to Yi National API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="endpoint">API Endpoint</Label>
                <Input
                  id="endpoint"
                  placeholder="https://api.yinational.org/v1"
                  value={config.api_endpoint}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, api_endpoint: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="api_key">API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="api_key"
                    type="password"
                    placeholder="Enter your API key"
                    value={config.api_key}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, api_key: e.target.value }))
                    }
                  />
                  <Button
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                  >
                    {isTesting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <TestTube className="h-4 w-4" />
                    )}
                    <span className="ml-2">Test</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Contact Yi National to obtain your API key
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Sync</Label>
                  <p className="text-sm text-muted-foreground">
                    Turn synchronization on or off
                  </p>
                </div>
                <Switch
                  checked={config.sync_enabled}
                  onCheckedChange={handleToggleSync}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>
                Configure sync notifications and alerts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notification_email">Notification Email</Label>
                <Input
                  id="notification_email"
                  type="email"
                  placeholder="admin@chapter.org"
                  value={config.notification_email}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      notification_email: e.target.value
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Receive alerts for sync failures and conflicts
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook_url">Webhook URL (optional)</Label>
                <Input
                  id="webhook_url"
                  placeholder="https://your-server.com/webhook"
                  value={config.webhook_url}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, webhook_url: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Send sync events to an external endpoint
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Entities Tab */}
        <TabsContent value="entities" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Entity Synchronization</CardTitle>
              <CardDescription>
                Choose which data types to sync with Yi National
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Members
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Sync member profiles and engagement data
                  </p>
                </div>
                <Switch
                  checked={config.sync_members}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => ({ ...prev, sync_members: checked }))
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Events
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Sync chapter events and registrations
                  </p>
                </div>
                <Switch
                  checked={config.sync_events}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => ({ ...prev, sync_events: checked }))
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Documents
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Sync reports, MoUs, and shared resources
                  </p>
                </div>
                <Switch
                  checked={config.sync_documents}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => ({ ...prev, sync_documents: checked }))
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Metrics & Benchmarks
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receive benchmark data and submit chapter metrics
                  </p>
                </div>
                <Switch
                  checked={config.sync_metrics}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => ({ ...prev, sync_metrics: checked }))
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Leadership Directory
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Sync leadership positions with national directory
                  </p>
                </div>
                <Switch
                  checked={config.sync_leadership}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => ({ ...prev, sync_leadership: checked }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sync Schedule</CardTitle>
              <CardDescription>
                Configure automatic synchronization timing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Sync Frequency</Label>
                <Select
                  value={config.sync_frequency}
                  onValueChange={(value) =>
                    setConfig((prev) => ({ ...prev, sync_frequency: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realtime">Real-time</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="manual">Manual Only</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  How often to automatically sync data with Yi National
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-resolve Conflicts</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically accept national data for conflicts
                  </p>
                </div>
                <Switch
                  checked={config.auto_resolve_conflicts}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => ({
                      ...prev,
                      auto_resolve_conflicts: checked
                    }))
                  }
                />
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Caution
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Auto-resolve will always prefer national data. Review conflicts
                    manually if local data accuracy is critical.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next Scheduled Sync</CardTitle>
              <CardDescription>
                Information about upcoming sync operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Full Sync</p>
                  <p className="font-medium">Today at 11:00 PM</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Incremental Sync</p>
                  <p className="font-medium">Next hour</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Manage API credentials and access control
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>API Key Status</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Expires: March 31, 2025
                  </span>
                </div>
              </div>

              <Separator />

              <div>
                <Label className="mb-2 block">Rotate API Key</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Generate a new API key. The current key will be immediately
                  invalidated.
                </p>
                <Button variant="destructive">
                  <Key className="h-4 w-4 mr-2" />
                  Rotate Key
                </Button>
              </div>

              <Separator />

              <div>
                <Label className="mb-2 block">Access Log</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  View recent API access history
                </p>
                <Button variant="outline">View Access Log</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Privacy</CardTitle>
              <CardDescription>
                Control what data is shared with Yi National
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Only aggregated and anonymized data is shared by default.
                  Individual member data is only shared when explicitly enabled
                  and with member consent.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSaveConfig} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {isLoading ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>
    </div>
  );
}
