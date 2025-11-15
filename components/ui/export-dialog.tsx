'use client';

import { useState } from 'react';
import { Download, FileDown, FileSpreadsheet, FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export type ExportFormat = 'csv' | 'xlsx' | 'json';
export type ExportScope = 'selected' | 'all';

interface ExportDialogProps {
  onExport: (format: ExportFormat, scope: ExportScope) => void;
  selectedCount: number;
  totalCount: number;
  trigger?: React.ReactNode;
  disabled?: boolean;
}

export function ExportDialog({
  onExport,
  selectedCount,
  totalCount,
  trigger,
  disabled = false
}: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [scope, setScope] = useState<ExportScope>('selected');

  const handleExport = () => {
    onExport(format, scope);
    setOpen(false);
  };

  const formatIcons = {
    csv: FileDown,
    xlsx: FileSpreadsheet,
    json: FileJson
  };

  const formatLabels = {
    csv: 'CSV',
    xlsx: 'Excel (XLSX)',
    json: 'JSON'
  };

  const Icon = formatIcons[format];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant='outline' size='sm' disabled={disabled}>
            <Download className='mr-2 h-4 w-4' />
            Export
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Export Data</DialogTitle>
          <DialogDescription>
            Choose the export format and scope for your data.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-6 py-4'>
          {/* Export Scope */}
          <div className='space-y-3'>
            <Label>Export Scope</Label>
            <RadioGroup value={scope} onValueChange={(value: ExportScope) => setScope(value)}>
              <div className='flex items-center space-x-2'>
                <RadioGroupItem value='selected' id='selected' disabled={selectedCount === 0} />
                <Label htmlFor='selected' className={selectedCount === 0 ? 'text-muted-foreground' : ''}>
                  Selected rows ({selectedCount})
                </Label>
              </div>
              <div className='flex items-center space-x-2'>
                <RadioGroupItem value='all' id='all' />
                <Label htmlFor='all'>
                  All rows ({totalCount})
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Export Format */}
          <div className='space-y-3'>
            <Label htmlFor='format'>Export Format</Label>
            <Select value={format} onValueChange={(value: ExportFormat) => setFormat(value)}>
              <SelectTrigger id='format'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='csv'>
                  <div className='flex items-center'>
                    <FileDown className='mr-2 h-4 w-4' />
                    CSV - Comma Separated Values
                  </div>
                </SelectItem>
                <SelectItem value='xlsx'>
                  <div className='flex items-center'>
                    <FileSpreadsheet className='mr-2 h-4 w-4' />
                    XLSX - Microsoft Excel
                  </div>
                </SelectItem>
                <SelectItem value='json'>
                  <div className='flex items-center'>
                    <FileJson className='mr-2 h-4 w-4' />
                    JSON - JavaScript Object Notation
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Preview Info */}
          <div className='rounded-lg bg-muted p-4'>
            <div className='flex items-start gap-3'>
              <Icon className='h-5 w-5 mt-0.5 text-muted-foreground' />
              <div className='space-y-1'>
                <p className='text-sm font-medium'>
                  {formatLabels[format]}
                </p>
                <p className='text-xs text-muted-foreground'>
                  {scope === 'selected'
                    ? `Exporting ${selectedCount} selected row${selectedCount === 1 ? '' : 's'}`
                    : `Exporting all ${totalCount} rows`}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={scope === 'selected' && selectedCount === 0}>
            <Download className='mr-2 h-4 w-4' />
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
