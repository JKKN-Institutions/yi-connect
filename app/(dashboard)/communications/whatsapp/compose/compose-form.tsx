'use client';

/**
 * WhatsApp Compose Form (Client Component)
 *
 * Interactive form for composing and sending WhatsApp messages.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Users2,
  FileText,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  sendWhatsAppMessage,
  sendWhatsAppGroupMessage
} from '@/app/actions/whatsapp';
import type { GroupListItem, TemplateListItem } from '@/types/whatsapp';

interface ComposeFormProps {
  groups: GroupListItem[];
  templates: TemplateListItem[];
  preselectedGroup?: GroupListItem;
  preselectedTemplate?: TemplateListItem;
}

type RecipientType = 'individual' | 'group';

export function ComposeForm({
  groups,
  templates,
  preselectedGroup,
  preselectedTemplate
}: ComposeFormProps) {
  const router = useRouter();

  // Form state
  const [recipientType, setRecipientType] = useState<RecipientType>(
    preselectedGroup ? 'group' : 'individual'
  );
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(
    preselectedGroup?.id || ''
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    preselectedTemplate?.id || ''
  );
  const [message, setMessage] = useState(preselectedTemplate?.content || '');
  const [variables, setVariables] = useState<Record<string, string>>({});

  // UI state
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Get selected template
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // Update message when template changes
  useEffect(() => {
    if (selectedTemplate) {
      setMessage(selectedTemplate.content);
      // Initialize variables from template
      const templateVars = selectedTemplate.variables || [];
      const initialVars: Record<string, string> = {};
      templateVars.forEach((v) => {
        initialVars[v] = variables[v] || '';
      });
      setVariables(initialVars);
    }
  }, [selectedTemplateId]);

  // Get preview message with variables replaced
  const getPreviewMessage = () => {
    let preview = message;
    Object.entries(variables).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(`\\{${key}\\}`, 'g'), value || `{${key}}`);
    });
    return preview;
  };

  // Get selected group
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  // Validate form
  const isValid = () => {
    if (recipientType === 'individual') {
      return phoneNumber.trim().length >= 10 && message.trim().length > 0;
    }
    return selectedGroupId && message.trim().length > 0;
  };

  // Handle send
  const handleSend = async () => {
    if (!isValid()) return;

    setIsSending(true);
    setResult(null);

    try {
      const finalMessage = getPreviewMessage();

      let sendResult;
      if (recipientType === 'individual') {
        // Format phone number - remove any non-digit characters
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        // Add country code if not present
        const formattedPhone = cleanPhone.startsWith('91')
          ? cleanPhone
          : `91${cleanPhone}`;
        sendResult = await sendWhatsAppMessage(formattedPhone, finalMessage);
      } else {
        if (!selectedGroup) {
          setResult({ success: false, message: 'No group selected' });
          return;
        }
        sendResult = await sendWhatsAppGroupMessage(selectedGroup.jid, finalMessage);
      }

      if (sendResult.success) {
        setResult({
          success: true,
          message: `Message sent successfully to ${
            recipientType === 'individual'
              ? phoneNumber
              : selectedGroup?.name || 'group'
          }!`
        });
        // Clear form after success
        if (recipientType === 'individual') {
          setPhoneNumber('');
        }
        setMessage('');
        setVariables({});
        setSelectedTemplateId('');
      } else {
        setResult({
          success: false,
          message: sendResult.error || 'Failed to send message'
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'An error occurred while sending the message'
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>Message Details</CardTitle>
          <CardDescription>
            Configure your message recipient and content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Recipient Type Toggle */}
          <div className="space-y-2">
            <Label>Recipient Type</Label>
            <ToggleGroup
              type="single"
              value={recipientType}
              onValueChange={(value) => {
                if (value) setRecipientType(value as RecipientType);
              }}
              className="justify-start"
            >
              <ToggleGroupItem value="individual" className="gap-2">
                <User className="h-4 w-4" />
                Individual
              </ToggleGroupItem>
              <ToggleGroupItem value="group" className="gap-2">
                <Users2 className="h-4 w-4" />
                Group
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Recipient Input */}
          {recipientType === 'individual' ? (
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="e.g., 9876543210"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter phone number without country code (defaults to +91)
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="group">Select Group</Label>
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger id="group">
                  <SelectValue placeholder="Choose a group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      <div className="flex items-center gap-2">
                        <span>{group.name}</span>
                        {group.member_count && (
                          <Badge variant="outline" className="text-xs">
                            {group.member_count} members
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Template Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="template">Template (Optional)</Label>
              {selectedTemplateId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedTemplateId('');
                    setMessage('');
                    setVariables({});
                  }}
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger id="template">
                <SelectValue placeholder="Choose a template (optional)" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span>{template.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {template.category}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Template Variables */}
          {selectedTemplate && selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
            <div className="space-y-3">
              <Label>Template Variables</Label>
              <div className="grid gap-3">
                {selectedTemplate.variables.map((variable) => (
                  <div key={variable} className="flex items-center gap-2">
                    <Label className="w-32 text-sm text-muted-foreground">
                      {`{${variable}}`}
                    </Label>
                    <Input
                      placeholder={`Enter ${variable}`}
                      value={variables[variable] || ''}
                      onChange={(e) =>
                        setVariables((prev) => ({
                          ...prev,
                          [variable]: e.target.value
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Message Content */}
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Type your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {message.length}/4000 characters
            </p>
          </div>

          {/* Result Alert */}
          {result && (
            <Alert variant={result.success ? 'default' : 'destructive'}>
              {result.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{result.message}</AlertDescription>
            </Alert>
          )}

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={!isValid() || isSending}
            className="w-full"
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Message
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Preview Card */}
      <Card>
        <CardHeader>
          <CardTitle>Message Preview</CardTitle>
          <CardDescription>
            How your message will appear to the recipient
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Recipient Info */}
          <div className="mb-4 pb-4 border-b">
            <p className="text-sm text-muted-foreground">Sending to:</p>
            <p className="font-medium">
              {recipientType === 'individual'
                ? phoneNumber || 'Enter phone number'
                : selectedGroup?.name || 'Select a group'}
            </p>
            {recipientType === 'group' && selectedGroup?.member_count && (
              <p className="text-xs text-muted-foreground">
                {selectedGroup.member_count} members will receive this message
              </p>
            )}
          </div>

          {/* Message Preview */}
          <div
            className={cn(
              "rounded-lg p-4 whitespace-pre-wrap",
              message ? "bg-green-50 border border-green-200" : "bg-muted"
            )}
          >
            {message ? (
              <p className="text-sm">{getPreviewMessage()}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Your message will appear here...
              </p>
            )}
          </div>

          {/* Template Info */}
          {selectedTemplate && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Using template: <strong>{selectedTemplate.name}</strong>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
