/**
 * Bulk Upload Options Component
 *
 * Advanced options for bulk member upload.
 */

'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { ChevronDown, Settings2 } from 'lucide-react'
import { useState } from 'react'
import type { BulkUploadOptions } from '@/lib/validations/bulk-member'

interface BulkUploadOptionsProps {
  options: BulkUploadOptions
  onOptionsChange: (options: BulkUploadOptions) => void
  chapters: Array<{ id: string; name: string; location: string }>
}

export function BulkUploadOptionsPanel({
  options,
  onOptionsChange,
  chapters
}: BulkUploadOptionsProps) {
  const [isOpen, setIsOpen] = useState(true)

  const updateOption = <K extends keyof BulkUploadOptions>(
    key: K,
    value: BulkUploadOptions[K]
  ) => {
    onOptionsChange({ ...options, [key]: value })
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                <CardTitle className="text-lg">Upload Options</CardTitle>
              </div>
              <ChevronDown
                className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </div>
            <CardDescription>
              Configure how members should be imported
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            {/* Default Chapter */}
            <div className="space-y-2">
              <Label htmlFor="defaultChapter">Default Chapter</Label>
              <Select
                value={options.defaultChapterId || ''}
                onValueChange={(value) => updateOption('defaultChapterId', value || undefined)}
              >
                <SelectTrigger id="defaultChapter">
                  <SelectValue placeholder="Select default chapter" />
                </SelectTrigger>
                <SelectContent>
                  {chapters.map((chapter) => (
                    <SelectItem key={chapter.id} value={chapter.id}>
                      {chapter.name} - {chapter.location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Used when no chapter is specified in the Excel file. You can also specify chapter per member using the &quot;Chapter&quot; column.
              </p>
            </div>

            {/* Default Membership Status */}
            <div className="space-y-2">
              <Label htmlFor="defaultStatus">Default Membership Status</Label>
              <Select
                value={options.defaultMembershipStatus}
                onValueChange={(value: any) => updateOption('defaultMembershipStatus', value)}
              >
                <SelectTrigger id="defaultStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="alumni">Alumni</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Status to assign if not specified in the file
              </p>
            </div>

            {/* Duplicate Email Handling */}
            <div className="space-y-4">
              <Label className="text-base">Duplicate Email Handling</Label>
              <p className="text-xs text-muted-foreground -mt-2">
                Choose how to handle emails that already exist in the system
              </p>

              <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                <div className="space-y-0.5">
                  <Label htmlFor="skipExisting" className="font-normal cursor-pointer">
                    Skip existing emails
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Skip rows with emails that already exist in the system
                  </p>
                </div>
                <Switch
                  id="skipExisting"
                  checked={options.skipExisting}
                  onCheckedChange={(checked) => {
                    // Single state update to avoid race condition
                    onOptionsChange({
                      ...options,
                      skipExisting: checked,
                      updateExisting: checked ? false : options.updateExisting
                    })
                  }}
                  className="cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                <div className="space-y-0.5">
                  <Label htmlFor="updateExisting" className="font-normal cursor-pointer">
                    Update existing members
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Update member data for existing emails instead of skipping
                  </p>
                </div>
                <Switch
                  id="updateExisting"
                  checked={options.updateExisting}
                  onCheckedChange={(checked) => {
                    // Single state update to avoid race condition
                    onOptionsChange({
                      ...options,
                      updateExisting: checked,
                      skipExisting: checked ? false : options.skipExisting
                    })
                  }}
                  className="cursor-pointer"
                />
              </div>

              {/* Show active mode indicator */}
              {(options.skipExisting || options.updateExisting) && (
                <div className="p-3 rounded-lg bg-muted/50 text-sm">
                  <strong>Mode:</strong>{' '}
                  {options.skipExisting && 'Existing emails will be skipped (no changes to existing members)'}
                  {options.updateExisting && 'Existing members will be updated with new data from the file'}
                  {!options.skipExisting && !options.updateExisting && 'Error on duplicate emails'}
                </div>
              )}
            </div>

            {/* Email Options */}
            <div className="space-y-4">
              <Label className="text-base">Email Options</Label>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="sendWelcomeEmail" className="font-normal">
                    Send welcome emails
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Send password reset email to each new member so they can set their password
                  </p>
                </div>
                <Switch
                  id="sendWelcomeEmail"
                  checked={options.sendWelcomeEmail}
                  onCheckedChange={(checked) => updateOption('sendWelcomeEmail', checked)}
                />
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
