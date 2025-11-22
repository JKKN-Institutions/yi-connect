'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Merge,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { resolveConflict } from '@/app/actions/national-integration';
import { toast } from 'sonner';
import type { NationalDataConflict } from '@/types/national-integration';

interface ConflictsTableProps {
  conflicts: NationalDataConflict[];
}

export function ConflictsTable({ conflicts }: ConflictsTableProps) {
  const [selectedConflict, setSelectedConflict] = useState<NationalDataConflict | null>(null);
  const [resolution, setResolution] = useState<'keep_local' | 'accept_national' | 'merge' | null>(null);
  const [mergedData, setMergedData] = useState('');
  const [notes, setNotes] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  if (conflicts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <AlertTriangle className="h-12 w-12 mb-4 opacity-50" />
        <p>No conflicts to resolve</p>
      </div>
    );
  }

  const handleResolve = async () => {
    if (!selectedConflict || !resolution) return;

    setIsResolving(true);
    try {
      const formData = new FormData();
      formData.set('conflict_id', selectedConflict.id);
      formData.set('resolution', resolution);
      if (resolution === 'merge' && mergedData) {
        formData.set('merged_data', mergedData);
      }
      if (notes) {
        formData.set('resolution_notes', notes);
      }

      const result = await resolveConflict(formData);

      if (result.success) {
        toast.success('Conflict resolved successfully');
        setSelectedConflict(null);
        setResolution(null);
        setMergedData('');
        setNotes('');
      } else {
        toast.error(result.error || 'Failed to resolve conflict');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsResolving(false);
    }
  };

  const openResolutionDialog = (conflict: NationalDataConflict) => {
    setSelectedConflict(conflict);
    setMergedData(JSON.stringify(conflict.national_data, null, 2));
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Entity</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Detected</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {conflicts.map((conflict) => (
            <TableRow key={conflict.id}>
              <TableCell className="font-medium">
                {conflict.entity_type}
                <p className="text-xs text-muted-foreground">
                  ID: {conflict.local_entity_id?.slice(0, 8)}...
                </p>
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    conflict.conflict_type === 'version_conflict'
                      ? 'secondary'
                      : conflict.conflict_type === 'missing_local' || conflict.conflict_type === 'missing_national'
                        ? 'destructive'
                        : 'default'
                  }
                >
                  {conflict.conflict_type.replace('_', ' ')}
                </Badge>
              </TableCell>
              <TableCell>
                {format(new Date(conflict.detected_at), 'PP')}
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openResolutionDialog(conflict)}
                >
                  Resolve
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Resolution Dialog */}
      <Dialog
        open={!!selectedConflict}
        onOpenChange={(open) => !open && setSelectedConflict(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Resolve Data Conflict</DialogTitle>
            <DialogDescription>
              Choose how to resolve this conflict between local and national data
            </DialogDescription>
          </DialogHeader>

          {selectedConflict && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Local Data</Label>
                  <pre className="mt-2 p-3 bg-muted rounded-lg text-xs overflow-auto max-h-48">
                    {JSON.stringify(selectedConflict.local_data, null, 2)}
                  </pre>
                </div>
                <div>
                  <Label className="text-sm font-medium">National Data</Label>
                  <pre className="mt-2 p-3 bg-muted rounded-lg text-xs overflow-auto max-h-48">
                    {JSON.stringify(selectedConflict.national_data, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Resolution Method</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={resolution === 'keep_local' ? 'default' : 'outline'}
                    className="flex flex-col items-center py-4 h-auto"
                    onClick={() => setResolution('keep_local')}
                  >
                    <ArrowLeft className="h-5 w-5 mb-1" />
                    <span>Keep Local</span>
                  </Button>
                  <Button
                    variant={resolution === 'accept_national' ? 'default' : 'outline'}
                    className="flex flex-col items-center py-4 h-auto"
                    onClick={() => setResolution('accept_national')}
                  >
                    <ArrowRight className="h-5 w-5 mb-1" />
                    <span>Accept National</span>
                  </Button>
                  <Button
                    variant={resolution === 'merge' ? 'default' : 'outline'}
                    className="flex flex-col items-center py-4 h-auto"
                    onClick={() => setResolution('merge')}
                  >
                    <Merge className="h-5 w-5 mb-1" />
                    <span>Merge</span>
                  </Button>
                </div>
              </div>

              {resolution === 'merge' && (
                <div className="space-y-2">
                  <Label htmlFor="merged">Merged Data (JSON)</Label>
                  <Textarea
                    id="merged"
                    value={mergedData}
                    onChange={(e) => setMergedData(e.target.value)}
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Resolution Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add notes about this resolution..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedConflict(null)}>
              Cancel
            </Button>
            <Button onClick={handleResolve} disabled={!resolution || isResolving}>
              {isResolving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isResolving ? 'Resolving...' : 'Apply Resolution'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
