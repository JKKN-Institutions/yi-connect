'use client';

/**
 * Reusable WhatsApp Send Button with Compose Dialog
 *
 * Usage:
 * - Single contact: <WhatsAppSendButton contact={{ phone: "9876543210", name: "John" }} />
 * - Multiple contacts: <WhatsAppSendButton contacts={[{ phone: "...", name: "..." }]} />
 * - With preset message: <WhatsAppSendButton contact={...} defaultMessage="Hello!" />
 * - Icon only: <WhatsAppSendButton contact={...} variant="icon" />
 */

import { useState, useTransition } from 'react';
import { MessageCircle, Send, Loader2, Users, Check, X, AlertCircle } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { sendWhatsAppMessage, sendBulkWhatsAppMessages, getWhatsAppStatus } from '@/app/actions/whatsapp';

export interface WhatsAppContact {
  phone: string;
  name?: string;
}

interface WhatsAppSendButtonProps {
  // Single contact mode
  contact?: WhatsAppContact;
  // Multiple contacts mode
  contacts?: WhatsAppContact[];
  // Default message to pre-fill
  defaultMessage?: string;
  // Button variant
  variant?: 'default' | 'outline' | 'ghost' | 'icon';
  // Button size
  size?: 'default' | 'sm' | 'lg' | 'icon';
  // Custom button label
  label?: string;
  // Custom dialog title
  dialogTitle?: string;
  // Callback on success
  onSuccess?: (result: { sent: number; failed: number }) => void;
  // Callback on error
  onError?: (error: string) => void;
  // Disable the button
  disabled?: boolean;
  // Custom class
  className?: string;
}

export function WhatsAppSendButton({
  contact,
  contacts,
  defaultMessage = '',
  variant = 'outline',
  size = 'sm',
  label,
  dialogTitle,
  onSuccess,
  onError,
  disabled = false,
  className,
}: WhatsAppSendButtonProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(defaultMessage);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'checking' | 'sending' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Determine recipients
  const recipients = contacts || (contact ? [contact] : []);
  const isBulk = recipients.length > 1;
  const recipientCount = recipients.length;

  // Generate button label
  const buttonLabel = label || (isBulk ? `WhatsApp (${recipientCount})` : 'WhatsApp');

  // Generate dialog title
  const title = dialogTitle || (isBulk ? `Send WhatsApp to ${recipientCount} contacts` : `Send WhatsApp to ${contact?.name || 'contact'}`);

  const handleSend = async () => {
    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    setStatus('checking');
    setError(null);

    startTransition(async () => {
      try {
        // First check if WhatsApp is connected
        const whatsappStatus = await getWhatsAppStatus();
        if (!whatsappStatus.isReady) {
          setStatus('error');
          setError('WhatsApp is not connected. Please connect in Settings → WhatsApp first.');
          onError?.('WhatsApp not connected');
          return;
        }

        setStatus('sending');

        if (isBulk) {
          // Bulk send
          const bulkRecipients = recipients.map(r => ({
            phoneNumber: r.phone,
            message: message.trim()
          }));
          const bulkResult = await sendBulkWhatsAppMessages(bulkRecipients);

          setResult({ sent: bulkResult.sent, failed: bulkResult.failed });
          setStatus(bulkResult.failed === 0 ? 'success' : 'error');

          if (bulkResult.sent > 0) {
            onSuccess?.({ sent: bulkResult.sent, failed: bulkResult.failed });
          }
          if (bulkResult.failed > 0) {
            setError(`${bulkResult.failed} message(s) failed to send`);
          }
        } else {
          // Single send
          const singleResult = await sendWhatsAppMessage(recipients[0].phone, message.trim());

          if (singleResult.success) {
            setResult({ sent: 1, failed: 0 });
            setStatus('success');
            onSuccess?.({ sent: 1, failed: 0 });
          } else {
            setResult({ sent: 0, failed: 1 });
            setStatus('error');
            setError(singleResult.error || 'Failed to send message');
            onError?.(singleResult.error || 'Failed to send message');
          }
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
      setResult(null);
      setError(null);
      setMessage(defaultMessage);
    }, 200);
  };

  const renderButtonContent = () => {
    if (variant === 'icon') {
      return <MessageCircle className="h-4 w-4 text-green-600" />;
    }
    return (
      <>
        <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
        {buttonLabel}
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => isOpen ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button
          variant={variant === 'icon' ? 'ghost' : variant}
          size={variant === 'icon' ? 'icon' : size}
          disabled={disabled || recipientCount === 0}
          className={className}
          title={isBulk ? `Send WhatsApp to ${recipientCount} contacts` : `Send WhatsApp to ${contact?.name || contact?.phone}`}
        >
          {renderButtonContent()}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {status === 'idle' || status === 'checking' || status === 'sending' ? (
              isBulk ? (
                'Compose your message below. It will be sent to all selected contacts.'
              ) : (
                `Message will be sent to ${contact?.phone || recipients[0]?.phone}`
              )
            ) : status === 'success' ? (
              'Message sent successfully!'
            ) : (
              'There was an issue sending the message.'
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Recipients preview for bulk */}
        {isBulk && (status === 'idle' || status === 'checking') && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Recipients ({recipientCount})
            </Label>
            <ScrollArea className="h-24 rounded-md border p-2">
              <div className="flex flex-wrap gap-1">
                {recipients.slice(0, 20).map((r, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {r.name || r.phone}
                  </Badge>
                ))}
                {recipients.length > 20 && (
                  <Badge variant="outline" className="text-xs">
                    +{recipients.length - 20} more
                  </Badge>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Message compose */}
        {(status === 'idle' || status === 'checking') && (
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              rows={5}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Tip: Use *bold*, _italic_ for formatting. Messages appear from your connected WhatsApp number.
            </p>
          </div>
        )}

        {/* Sending state */}
        {status === 'sending' && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-green-600" />
            <p className="text-sm text-muted-foreground">
              Sending {isBulk ? `to ${recipientCount} contacts...` : 'message...'}
            </p>
            {isBulk && (
              <p className="text-xs text-muted-foreground">
                This may take a moment to avoid rate limiting
              </p>
            )}
          </div>
        )}

        {/* Success state */}
        {status === 'success' && result && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="rounded-full bg-green-100 p-3">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <div className="text-center">
              <p className="font-medium">
                {result.sent === 1 ? 'Message sent!' : `${result.sent} messages sent!`}
              </p>
              {result.failed > 0 && (
                <p className="text-sm text-orange-600">
                  {result.failed} failed to send
                </p>
              )}
            </div>
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
              {result && result.sent > 0 && (
                <p className="text-sm text-green-600 mt-2">
                  {result.sent} message(s) were sent successfully
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {(status === 'idle' || status === 'checking') && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={isPending || !message.trim()}
                className="bg-green-600 hover:bg-green-700"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {status === 'checking' ? 'Checking...' : 'Sending...'}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send {isBulk ? `to ${recipientCount}` : 'Message'}
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

// Convenience wrapper for icon-only button
export function WhatsAppIconButton(props: Omit<WhatsAppSendButtonProps, 'variant'>) {
  return <WhatsAppSendButton {...props} variant="icon" />;
}

// Convenience wrapper for bulk send
export function WhatsAppBulkButton({
  contacts,
  label = 'Send WhatsApp to All',
  ...props
}: Omit<WhatsAppSendButtonProps, 'contact'> & { contacts: WhatsAppContact[] }) {
  return (
    <WhatsAppSendButton
      contacts={contacts}
      label={label}
      variant="default"
      className="bg-green-600 hover:bg-green-700 text-white"
      {...props}
    />
  );
}
