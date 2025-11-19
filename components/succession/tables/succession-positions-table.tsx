'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MoreHorizontal,
  Edit,
  Eye,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { SuccessionPosition } from '@/lib/types/succession';
import { togglePositionStatus } from '@/app/actions/succession';
import toast from 'react-hot-toast';

interface SuccessionPositionsTableProps {
  positions: SuccessionPosition[];
  cycleId: string;
}

const hierarchyLabels: Record<number, string> = {
  1: 'Executive',
  2: 'Senior Leadership',
  3: 'Mid Leadership',
  4: 'Team Lead',
  5: 'Entry Leadership'
};

export function SuccessionPositionsTable({
  positions,
  cycleId
}: SuccessionPositionsTableProps) {
  const router = useRouter();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    setTogglingId(id);
    const result = await togglePositionStatus(id, !currentStatus);

    if (result.success) {
      toast.success(`Position ${!currentStatus ? 'activated' : 'deactivated'}`);
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to update position status');
    }

    setTogglingId(null);
  };

  if (positions.length === 0) {
    return (
      <div className='text-center py-8 text-muted-foreground'>
        <p className='text-sm'>No positions defined for this cycle</p>
        <p className='text-xs mt-1'>
          Add positions to start the succession process
        </p>
      </div>
    );
  }

  return (
    <div className='rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Position Title</TableHead>
            <TableHead>Hierarchy Level</TableHead>
            <TableHead>Openings</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className='text-right'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((position) => (
            <TableRow key={position.id}>
              <TableCell>
                <div>
                  <div className='font-medium'>{position.title}</div>
                  {position.description && (
                    <div className='text-sm text-muted-foreground line-clamp-1'>
                      {position.description}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant='outline'>
                  Level {position.hierarchy_level} -{' '}
                  {hierarchyLabels[position.hierarchy_level]}
                </Badge>
              </TableCell>
              <TableCell>
                <div className='text-sm font-medium'>
                  {position.number_of_openings}
                </div>
              </TableCell>
              <TableCell>
                {position.is_active ? (
                  <Badge className='bg-green-500'>Active</Badge>
                ) : (
                  <Badge variant='secondary'>Inactive</Badge>
                )}
              </TableCell>
              <TableCell className='text-right'>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant='ghost'
                      size='sm'
                      disabled={togglingId === position.id}
                    >
                      <MoreHorizontal className='h-4 w-4' />
                      <span className='sr-only'>Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end'>
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() =>
                        router.push(
                          `/succession/admin/positions/${position.id}`
                        )
                      }
                    >
                      <Eye className='mr-2 h-4 w-4' />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        router.push(
                          `/succession/admin/positions/${position.id}/edit`
                        )
                      }
                    >
                      <Edit className='mr-2 h-4 w-4' />
                      Edit Position
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() =>
                        handleToggleStatus(position.id, position.is_active)
                      }
                    >
                      {position.is_active ? (
                        <>
                          <ToggleLeft className='mr-2 h-4 w-4' />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <ToggleRight className='mr-2 h-4 w-4' />
                          Activate
                        </>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
