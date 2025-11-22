'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Bell,
  AlertTriangle,
  Info,
  FileText,
  Megaphone,
  CheckCircle2,
  Clock,
  Paperclip
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { markBroadcastRead, acknowledgeBroadcast } from '@/app/actions/national-integration';
import type { BroadcastWithReceipt } from '@/types/national-integration';

interface BroadcastCenterProps {
  broadcasts: BroadcastWithReceipt[];
}

const priorityIcons: Record<string, React.ReactNode> = {
  low: <Info className="h-4 w-4 text-blue-500" />,
  normal: <Bell className="h-4 w-4 text-gray-500" />,
  high: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  urgent: <Megaphone className="h-4 w-4 text-red-500" />
};

const priorityColors: Record<string, string> = {
  low: 'bg-blue-100 text-blue-800',
  normal: 'bg-gray-100 text-gray-800',
  high: 'bg-yellow-100 text-yellow-800',
  urgent: 'bg-red-100 text-red-800'
};

const typeIcons: Record<string, React.ReactNode> = {
  announcement: <Megaphone className="h-4 w-4" />,
  directive: <FileText className="h-4 w-4" />,
  update: <Info className="h-4 w-4" />,
  alert: <AlertTriangle className="h-4 w-4" />,
  newsletter: <FileText className="h-4 w-4" />
};

export function BroadcastCenter({ broadcasts }: BroadcastCenterProps) {
  const [selectedBroadcast, setSelectedBroadcast] =
    useState<BroadcastWithReceipt | null>(null);
  const [acknowledgeDialogOpen, setAcknowledgeDialogOpen] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleViewBroadcast = async (broadcast: BroadcastWithReceipt) => {
    setSelectedBroadcast(broadcast);

    // Mark as read if not already
    if (!broadcast.receipt?.read_at) {
      await markBroadcastRead(broadcast.id);
    }
  };

  const handleAcknowledge = async () => {
    if (!selectedBroadcast) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.set('broadcast_id', selectedBroadcast.id);
      if (responseText) {
        formData.set('response_text', responseText);
      }

      await acknowledgeBroadcast(formData);
      setAcknowledgeDialogOpen(false);
      setResponseText('');
      setSelectedBroadcast(null);
    } catch (error) {
      console.error('Error acknowledging broadcast:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (broadcasts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10">
          <Bell className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No broadcasts to display</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {broadcasts.map((broadcast) => {
          const isUnread = !broadcast.receipt?.read_at;
          const isAcknowledged = !!broadcast.receipt?.acknowledged_at;
          const needsAcknowledgment =
            broadcast.requires_acknowledgment && !isAcknowledged;

          return (
            <Card
              key={broadcast.id}
              className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                isUnread ? 'border-l-4 border-l-primary' : ''
              }`}
              onClick={() => handleViewBroadcast(broadcast)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 p-2 bg-muted rounded-lg">
                    {typeIcons[broadcast.broadcast_type]}
                  </div>

                  <div className="flex-grow min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge className={priorityColors[broadcast.priority]}>
                        {broadcast.priority}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(broadcast.published_at), {
                          addSuffix: true
                        })}
                      </span>
                      {isUnread && (
                        <Badge variant="default" className="bg-primary">
                          New
                        </Badge>
                      )}
                      {needsAcknowledgment && (
                        <Badge variant="destructive">
                          Requires Acknowledgment
                        </Badge>
                      )}
                      {isAcknowledged && (
                        <Badge variant="outline" className="text-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Acknowledged
                        </Badge>
                      )}
                    </div>

                    <h3 className="font-semibold mb-1 truncate">
                      {broadcast.title}
                    </h3>

                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {broadcast.summary || broadcast.content.slice(0, 150)}...
                    </p>

                    {broadcast.attachments.length > 0 && (
                      <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                        <Paperclip className="h-3 w-3" />
                        <span>{broadcast.attachments.length} attachment(s)</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-shrink-0">
                    {priorityIcons[broadcast.priority]}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Broadcast Detail Dialog */}
      <Dialog
        open={!!selectedBroadcast && !acknowledgeDialogOpen}
        onOpenChange={(open) => !open && setSelectedBroadcast(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedBroadcast && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={priorityColors[selectedBroadcast.priority]}>
                    {selectedBroadcast.priority}
                  </Badge>
                  <Badge variant="outline">
                    {selectedBroadcast.broadcast_type}
                  </Badge>
                </div>
                <DialogTitle>{selectedBroadcast.title}</DialogTitle>
                <DialogDescription>
                  Published{' '}
                  {format(new Date(selectedBroadcast.published_at), 'PPpp')}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {selectedBroadcast.content_html ? (
                  <div
                    className="prose dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: selectedBroadcast.content_html
                    }}
                  />
                ) : (
                  <p className="whitespace-pre-wrap">
                    {selectedBroadcast.content}
                  </p>
                )}

                {selectedBroadcast.attachments.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-2">Attachments</h4>
                    <div className="space-y-2">
                      {selectedBroadcast.attachments.map((attachment, i) => (
                        <a
                          key={i}
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <Paperclip className="h-4 w-4" />
                          {attachment.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {selectedBroadcast.expires_at && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      Expires:{' '}
                      {format(new Date(selectedBroadcast.expires_at), 'PPp')}
                    </span>
                  </div>
                )}
              </div>

              <DialogFooter>
                {selectedBroadcast.requires_acknowledgment &&
                  !selectedBroadcast.receipt?.acknowledged_at && (
                    <Button onClick={() => setAcknowledgeDialogOpen(true)}>
                      Acknowledge
                    </Button>
                  )}
                <Button
                  variant="outline"
                  onClick={() => setSelectedBroadcast(null)}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Acknowledge Dialog */}
      <Dialog
        open={acknowledgeDialogOpen}
        onOpenChange={setAcknowledgeDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acknowledge Broadcast</DialogTitle>
            <DialogDescription>
              Please acknowledge that you have read and understood this
              broadcast.
              {selectedBroadcast?.allows_comments &&
                ' You can optionally add a response.'}
            </DialogDescription>
          </DialogHeader>

          {selectedBroadcast?.allows_comments && (
            <Textarea
              placeholder="Add a response (optional)"
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              rows={3}
            />
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAcknowledgeDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAcknowledge} disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Confirm Acknowledgment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
