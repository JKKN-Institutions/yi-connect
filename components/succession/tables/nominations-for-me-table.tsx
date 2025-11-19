'use client';

import { useRouter } from 'next/navigation';
import { Eye } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500',
  submitted: 'bg-blue-500',
  under_review: 'bg-yellow-500',
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
  withdrawn: 'bg-gray-400'
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn'
};

interface NominationsForMeTableProps {
  nominations: any[];
}

export function NominationsForMeTable({
  nominations
}: NominationsForMeTableProps) {
  const router = useRouter();

  if (nominations.length === 0) {
    return (
      <div className='text-center py-12 text-muted-foreground'>
        <p className='text-lg font-medium'>No nominations received</p>
        <p className='text-sm mt-2'>
          You haven&apos;t been nominated for any positions yet
        </p>
      </div>
    );
  }

  return (
    <div className='rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Position</TableHead>
            <TableHead>Cycle</TableHead>
            <TableHead>Nominated By</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className='text-right'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {nominations.map((nomination: any) => (
            <TableRow key={nomination.id}>
              <TableCell>
                <div>
                  <div className='font-medium'>{nomination.position.title}</div>
                  <div className='text-xs text-muted-foreground'>
                    Level {nomination.position.hierarchy_level}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <div className='text-sm'>{nomination.cycle.cycle_name}</div>
                  <div className='text-xs text-muted-foreground'>
                    {nomination.cycle.year}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className='text-sm'>
                  {nomination.nominator.first_name}{' '}
                  {nomination.nominator.last_name}
                </div>
              </TableCell>
              <TableCell>
                <Badge className={statusColors[nomination.status]}>
                  {statusLabels[nomination.status]}
                </Badge>
              </TableCell>
              <TableCell>
                {nomination.submitted_at ? (
                  <div className='text-sm'>
                    {new Date(nomination.submitted_at).toLocaleDateString()}
                  </div>
                ) : (
                  <span className='text-sm text-muted-foreground'>
                    Not submitted
                  </span>
                )}
              </TableCell>
              <TableCell className='text-right'>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() =>
                    router.push(`/succession/nominations/${nomination.id}`)
                  }
                >
                  <Eye className='h-4 w-4 mr-2' />
                  View
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
