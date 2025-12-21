'use client';

/**
 * WhatsApp Settings Content (Client Component)
 *
 * Interactive UI for WhatsApp connection management
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  MessageSquare,
  Smartphone,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  QrCode,
  Send,
  AlertCircle,
  Power,
  PowerOff,
  Clock
} from 'lucide-react';
import {
  connectWhatsApp,
  disconnectWhatsAppAction,
  getWhatsAppStatus,
  sendTestMessage
} from '@/app/actions/whatsapp';

type ConnectionStatus = 'disconnected' | 'connecting' | 'qr_ready' | 'authenticated' | 'ready';

interface StatusInfo {
  status: ConnectionStatus;
  qrCode: string | null;
  error: string | null;
  isReady: boolean;
}

export function WhatsAppSettingsContent() {
  const [statusInfo, setStatusInfo] = useState<StatusInfo>({
    status: 'disconnected',
    qrCode: null,
    error: null,
    isReady: false
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Connection progress tracking
  const [connectionStartTime, setConnectionStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Expected time for QR code generation (in seconds)
  const EXPECTED_QR_TIME = 12;

  // Connection progress messages based on elapsed time
  const getProgressMessage = () => {
    if (elapsedSeconds < 3) return 'Initializing browser...';
    if (elapsedSeconds < 6) return 'Loading WhatsApp Web...';
    if (elapsedSeconds < 9) return 'Generating QR code...';
    if (elapsedSeconds < 15) return 'Almost ready...';
    return 'Taking longer than usual. Please wait...';
  };

  // Progress percentage (capped at 95% until QR appears)
  const progressPercent = Math.min(95, (elapsedSeconds / EXPECTED_QR_TIME) * 100);

  // Start/stop timer based on connecting state
  useEffect(() => {
    if (statusInfo.status === 'connecting' && !connectionStartTime) {
      setConnectionStartTime(Date.now());
      setElapsedSeconds(0);

      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }

    // Stop timer when QR ready or connected
    if (statusInfo.status !== 'connecting' && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setConnectionStartTime(null);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [statusInfo.status, connectionStartTime]);

  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const status = await getWhatsAppStatus();
      setStatusInfo(status as StatusInfo);
    } catch (error) {
      console.error('Failed to fetch status:', error);
    }
  }, []);

  // Poll for status updates when connecting/QR ready
  useEffect(() => {
    fetchStatus();

    const shouldPoll = ['connecting', 'qr_ready', 'authenticated'].includes(statusInfo.status);
    if (shouldPoll) {
      const interval = setInterval(fetchStatus, 2000);
      return () => clearInterval(interval);
    }
  }, [statusInfo.status, fetchStatus]);

  // Connect handler
  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await connectWhatsApp();
      await fetchStatus();
    } catch (error) {
      console.error('Connect error:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect handler
  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await disconnectWhatsAppAction();
      setStatusInfo({
        status: 'disconnected',
        qrCode: null,
        error: null,
        isReady: false
      });
    } catch (error) {
      console.error('Disconnect error:', error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Send test message
  const handleSendTest = async () => {
    if (!testPhone.trim()) {
      setTestResult({ success: false, message: 'Please enter a phone number' });
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);

    try {
      const result = await sendTestMessage(testPhone);
      setTestResult({
        success: result.success,
        message: result.success
          ? 'Test message sent successfully!'
          : result.error || 'Failed to send message'
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: 'An error occurred while sending the message'
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Status badge
  const getStatusBadge = () => {
    switch (statusInfo.status) {
      case 'ready':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Connected</Badge>;
      case 'authenticated':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Finalizing...</Badge>;
      case 'qr_ready':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Scan QR Code</Badge>;
      case 'connecting':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            {elapsedSeconds}s
          </Badge>
        );
      default:
        return <Badge variant="secondary">Disconnected</Badge>;
    }
  };

  const getStatusIcon = () => {
    switch (statusInfo.status) {
      case 'ready':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'authenticated':
      case 'qr_ready':
      case 'connecting':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <XCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-green-100 p-2">
          <MessageSquare className="h-6 w-6 text-green-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">WhatsApp Settings</h1>
          <p className="text-muted-foreground">
            Connect your WhatsApp account to send event notifications to members
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Connection Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon()}
                <CardTitle>Connection Status</CardTitle>
              </div>
              {getStatusBadge()}
            </div>
            <CardDescription>
              {statusInfo.status === 'ready'
                ? 'WhatsApp is connected and ready to send messages'
                : statusInfo.status === 'qr_ready'
                ? 'Scan the QR code with your WhatsApp mobile app'
                : statusInfo.status === 'connecting'
                ? getProgressMessage()
                : statusInfo.status === 'authenticated'
                ? 'Finalizing connection...'
                : 'Connect your WhatsApp account to enable messaging'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Connection Progress Indicator */}
            {statusInfo.status === 'connecting' && (
              <div className="space-y-4 py-4">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="h-20 w-20 rounded-full border-4 border-green-100 flex items-center justify-center">
                      <Loader2 className="h-10 w-10 text-green-600 animate-spin" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="text-center space-y-1">
                    <p className="text-lg font-medium text-foreground">
                      {getProgressMessage()}
                    </p>
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <span>{elapsedSeconds}s elapsed</span>
                      <span>•</span>
                      <span>Usually takes ~10-12 seconds</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Progress value={progressPercent} className="h-2" />
                  <p className="text-xs text-center text-muted-foreground">
                    Please wait — no need to click again
                  </p>
                </div>
              </div>
            )}

            {/* QR Code Display */}
            {statusInfo.qrCode && statusInfo.status === 'qr_ready' && (
              <div className="flex flex-col items-center gap-4">
                {/* Success indicator */}
                <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-full">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">QR Code Ready!</span>
                </div>

                <div className="rounded-xl border-4 border-green-100 bg-white p-4 shadow-lg">
                  <img
                    src={statusInfo.qrCode}
                    alt="WhatsApp QR Code"
                    className="h-64 w-64"
                  />
                </div>

                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center gap-2 text-sm font-medium">
                    <Smartphone className="h-4 w-4 text-green-600" />
                    <span>Scan with your phone</span>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Open WhatsApp → Settings → Linked Devices → Link a Device
                  </p>
                  <p className="text-xs text-muted-foreground">
                    QR code expires in 60 seconds. Click refresh if needed.
                  </p>
                </div>
              </div>
            )}

            {/* Error Display */}
            {statusInfo.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{statusInfo.error}</AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              {statusInfo.status === 'disconnected' && (
                <Button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Power className="mr-2 h-4 w-4" />
                      Connect WhatsApp
                    </>
                  )}
                </Button>
              )}

              {statusInfo.status === 'qr_ready' && (
                <Button
                  variant="outline"
                  onClick={fetchStatus}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh QR Code
                </Button>
              )}

              {(statusInfo.status === 'ready' || statusInfo.status === 'authenticated') && (
                <Button
                  variant="destructive"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                >
                  {isDisconnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Disconnecting...
                    </>
                  ) : (
                    <>
                      <PowerOff className="mr-2 h-4 w-4" />
                      Disconnect
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Test Message Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Test Connection
            </CardTitle>
            <CardDescription>
              Send a test message to verify the connection is working
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="testPhone">Phone Number</Label>
              <Input
                id="testPhone"
                placeholder="e.g., 9876543210"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                disabled={!statusInfo.isReady}
              />
              <p className="text-xs text-muted-foreground">
                Enter phone number with or without country code (defaults to +91)
              </p>
            </div>

            <Button
              onClick={handleSendTest}
              disabled={!statusInfo.isReady || isSendingTest}
              className="w-full"
            >
              {isSendingTest ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Test Message
                </>
              )}
            </Button>

            {testResult && (
              <Alert variant={testResult.success ? 'default' : 'destructive'}>
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>{testResult.message}</AlertDescription>
              </Alert>
            )}

            {!statusInfo.isReady && (
              <p className="text-sm text-muted-foreground text-center">
                Connect WhatsApp first to send test messages
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-semibold">
                1
              </div>
              <div>
                <p className="font-medium">Connect</p>
                <p className="text-sm text-muted-foreground">
                  Click Connect WhatsApp to generate a QR code
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-semibold">
                2
              </div>
              <div>
                <p className="font-medium">Scan</p>
                <p className="text-sm text-muted-foreground">
                  Open WhatsApp on your phone and scan the QR code
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-semibold">
                3
              </div>
              <div>
                <p className="font-medium">Send</p>
                <p className="text-sm text-muted-foreground">
                  Yi Connect can now send event notifications to members
                </p>
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <strong>Note:</strong> This uses your personal WhatsApp account. Messages will appear as sent from your number.
            </p>
            <p>
              Session persists across server restarts. You may need to re-scan if you log out from WhatsApp on your phone.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
