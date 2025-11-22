'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { RefreshCw, Loader2 } from 'lucide-react';
import { triggerManualSync } from '@/app/actions/national-integration';
import { toast } from 'sonner';

interface ManualSyncButtonProps {
  chapterId: string;
}

export function ManualSyncButton({ chapterId }: ManualSyncButtonProps) {
  const [syncType, setSyncType] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  const handleSync = async () => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.set('sync_type', syncType);

      const result = await triggerManualSync(formData);

      if (result.success) {
        toast.success('Sync started successfully');
      } else {
        toast.error(result.error || 'Failed to start sync');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Select value={syncType} onValueChange={setSyncType}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Full Sync</SelectItem>
          <SelectItem value="members">Members Only</SelectItem>
          <SelectItem value="events">Events Only</SelectItem>
          <SelectItem value="benchmarks">Benchmarks Only</SelectItem>
          <SelectItem value="leadership">Leadership Only</SelectItem>
        </SelectContent>
      </Select>
      <Button onClick={handleSync} disabled={isLoading}>
        {isLoading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4 mr-2" />
        )}
        {isLoading ? 'Syncing...' : 'Sync Now'}
      </Button>
    </div>
  );
}
