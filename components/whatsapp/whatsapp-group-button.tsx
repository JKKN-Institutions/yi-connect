'use client';

/**
 * WhatsApp Group Message Button
 *
 * Allows sending messages to WhatsApp groups.
 * Fetches available groups and provides a compose dialog.
 */

import { useState, useEffect, useTransition } from 'react';
import { MessageCircle, Send, Loader2, Users, Check, AlertCircle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { sendWhatsAppGroupMessage, getWhatsAppStatus } from '@/app/actions/whatsapp';

export interface WhatsAppGroup {
  jid: string;
  name: string;
}

// Predefined Yi Erode groups for quick access
const YI_GROUPS: WhatsAppGroup[] = [
  { jid: '919047036969-1614918903@g.us', name: 'Yi ERODE CHAPTER 2025' },
  { jid: '120363386639999002@g.us', name: 'Yi Erode Leadership 2025' },
  { jid: '120363374011459909@g.us', name: 'Yi ERD EC TEAM Enablers 2025' },
  { jid: '120363029543462744@g.us', name: 'Ed Yi Yuva 2025' },
  { jid: '120363047501417660@g.us', name: 'Ed Yi Thalir 2025' },
  { jid: '919047036969-1615253093@g.us', name: 'Yi ERODE FUN' },
  { jid: '919842762600-1517199708@g.us', name: 'Yi Core Group' },
];

interface WhatsAppGroupButtonProps {
  // Pre-selected group (optional)
  group?: WhatsAppGroup;
  // Default message
  defaultMessage?: string;
  // Show group selector dropdown
  showSelector?: boolean;
  // Button variant
  variant?: 'default' | 'outline' | 'ghost';
  // Button size
  size?: 'default' | 'sm' | 'lg';
  // Custom label
  label?: string;
  // Callback on success
  onSuccess?: () => void;
  // Callback on error
  onError?: (error: string) => void;
  // Disabled
  disabled?: boolean;
  // Custom class
  className?: string;
}

export function WhatsAppGroupButton({
  group: initialGroup,
  defaultMessage = '',
  showSelector = true,
  variant = 'outline',
  size = 'default',
  label = 'Message Group',
  onSuccess,
  onError,
  disabled = false,
  className,
}: WhatsAppGroupButtonProps) {
  const [open, setOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<WhatsAppGroup | null>(initialGroup || null);
  const [message, setMessage] = useState(defaultMessage);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'checking' | 'sending' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Reset message when dialog opens
  useEffect(() => {
    if (open) {
      setMessage(defaultMessage);
      setStatus('idle');
      setError(null);
    }
  }, [open, defaultMessage]);

  const handleSend = async () => {
    if (!selectedGroup) {
      setError('Please select a group');
      return;
    }

    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    setStatus('checking');
    setError(null);

    startTransition(async () => {
      try {
        // Check if WhatsApp is connected
        const whatsappStatus = await getWhatsAppStatus();
        if (!whatsappStatus.isReady) {
          setStatus('error');
          setError('WhatsApp is not connected. Please connect in Settings → WhatsApp first.');
          onError?.('WhatsApp not connected');
          return;
        }

        setStatus('sending');

        const result = await sendWhatsAppGroupMessage(selectedGroup.jid, message.trim());

        if (result.success) {
          setStatus('success');
          onSuccess?.();
        } else {
          setStatus('error');
          setError(result.error || 'Failed to send message');
          onError?.(result.error || 'Failed to send message');
        }
      } catch (err) {
        setStatus('error');
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        onError?.(errorMsg);
      }
    });
  };

  const handleClose = () => {
    setOpen(false);
    // Reset state after dialog closes
    setTimeout(() => {
      setStatus('idle');
      setError(null);
      setMessage(defaultMessage);
      if (!initialGroup) {
        setSelectedGroup(null);
      }
    }, 200);
  };

  // If no selector needed and group is pre-selected, show simple button
  if (!showSelector && initialGroup) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => isOpen ? setOpen(true) : handleClose()}>
        <DialogTrigger asChild>
          <Button variant={variant} size={size} disabled={disabled} className={className}>
            <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
            {label}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-600" />
              Message {initialGroup.name}
            </DialogTitle>
            <DialogDescription>
              {status === 'idle' || status === 'checking' || status === 'sending' ? (
                'Compose your message to the group.'
              ) : status === 'success' ? (
                'Message sent to group successfully!'
              ) : (
                'There was an issue sending the message.'
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Message compose */}
          {(status === 'idle' || status === 'checking') && (
            <div className="space-y-2">
              <Label htmlFor="group-message">Message</Label>
              <Textarea
                id="group-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message here..."
                rows={5}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Tip: Use *bold*, _italic_ for formatting.
              </p>
            </div>
          )}

          {/* Sending state */}
          {status === 'sending' && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-green-600" />
              <p className="text-sm text-muted-foreground">Sending to group...</p>
            </div>
          )}

          {/* Success state */}
          {status === 'success' && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="rounded-full bg-green-100 p-3">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <p className="font-medium">Message sent to {initialGroup.name}!</p>
            </div>
          )}

          {/* Error state */}
          {status === 'error' && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="rounded-full bg-red-100 p-3">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <div className="text-center">
                <p className="font-medium text-red-600">Failed to send</p>
                {error && <p className="text-sm text-muted-foreground">{error}</p>}
              </div>
            </div>
          )}

          <DialogFooter>
            {(status === 'idle' || status === 'checking') && (
              <>
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button
                  onClick={handleSend}
                  disabled={isPending || !message.trim()}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send to Group
                    </>
                  )}
                </Button>
              </>
            )}
            {(status === 'success' || status === 'error') && (
              <Button onClick={handleClose}>
                {status === 'success' ? 'Done' : 'Close'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Show dropdown with group selector
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={disabled} className={className}>
          <Users className="h-4 w-4 mr-2 text-green-600" />
          {label}
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Select a Group</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {YI_GROUPS.map((group) => (
          <DropdownMenuItem
            key={group.jid}
            onClick={() => {
              setSelectedGroup(group);
              setOpen(true);
            }}
            className="cursor-pointer"
          >
            <Users className="h-4 w-4 mr-2 text-muted-foreground" />
            <span className="truncate">{group.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>

      {/* Compose Dialog */}
      <Dialog open={open} onOpenChange={(isOpen) => isOpen ? setOpen(true) : handleClose()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-600" />
              Message {selectedGroup?.name || 'Group'}
            </DialogTitle>
            <DialogDescription>
              {status === 'idle' || status === 'checking' || status === 'sending' ? (
                'Compose your message to the group.'
              ) : status === 'success' ? (
                'Message sent to group successfully!'
              ) : (
                'There was an issue sending the message.'
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Selected group badge */}
          {selectedGroup && (status === 'idle' || status === 'checking') && (
            <div className="flex items-center gap-2">
              <Label>Sending to:</Label>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {selectedGroup.name}
              </Badge>
            </div>
          )}

          {/* Message compose */}
          {(status === 'idle' || status === 'checking') && (
            <div className="space-y-2">
              <Label htmlFor="group-message">Message</Label>
              <Textarea
                id="group-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message here..."
                rows={5}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Tip: Use *bold*, _italic_ for formatting. Message will appear from your connected WhatsApp.
              </p>
            </div>
          )}

          {/* Sending state */}
          {status === 'sending' && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-green-600" />
              <p className="text-sm text-muted-foreground">Sending to {selectedGroup?.name}...</p>
            </div>
          )}

          {/* Success state */}
          {status === 'success' && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="rounded-full bg-green-100 p-3">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <p className="font-medium">Message sent to {selectedGroup?.name}!</p>
            </div>
          )}

          {/* Error state */}
          {status === 'error' && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="rounded-full bg-red-100 p-3">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <div className="text-center">
                <p className="font-medium text-red-600">Failed to send</p>
                {error && <p className="text-sm text-muted-foreground">{error}</p>}
              </div>
            </div>
          )}

          <DialogFooter>
            {(status === 'idle' || status === 'checking') && (
              <>
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button
                  onClick={handleSend}
                  disabled={isPending || !message.trim() || !selectedGroup}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send to Group
                    </>
                  )}
                </Button>
              </>
            )}
            {(status === 'success' || status === 'error') && (
              <Button onClick={handleClose}>
                {status === 'success' ? 'Done' : 'Close'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DropdownMenu>
  );
}

// Pre-configured button for Yi Erode Chapter group
export function WhatsAppChapterButton(props: Omit<WhatsAppGroupButtonProps, 'group' | 'showSelector'>) {
  return (
    <WhatsAppGroupButton
      group={{ jid: '919047036969-1614918903@g.us', name: 'Yi ERODE CHAPTER 2025' }}
      showSelector={false}
      label="Message Chapter"
      {...props}
    />
  );
}

// Pre-configured button for Leadership group
export function WhatsAppLeadershipButton(props: Omit<WhatsAppGroupButtonProps, 'group' | 'showSelector'>) {
  return (
    <WhatsAppGroupButton
      group={{ jid: '120363386639999002@g.us', name: 'Yi Erode Leadership 2025' }}
      showSelector={false}
      label="Message Leadership"
      {...props}
    />
  );
}

// Pre-configured button for EC Team group
export function WhatsAppECButton(props: Omit<WhatsAppGroupButtonProps, 'group' | 'showSelector'>) {
  return (
    <WhatsAppGroupButton
      group={{ jid: '120363374011459909@g.us', name: 'Yi ERD EC TEAM Enablers 2025' }}
      showSelector={false}
      label="Message EC Team"
      {...props}
    />
  );
}
