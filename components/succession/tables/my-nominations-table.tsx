'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Eye, XCircle } from 'lucide-react';
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
import { withdrawNomination } from '@/app/actions/succession';
import toast from 'react-hot-toast';

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

interface MyNominationsTableProps {
  nominations: any[];
}

export function MyNominationsTable({ nominations }: MyNominationsTableProps) {
  const router = useRouter();
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const handleWithdraw = async (id: string, nomineeName: string) => {
    if (
      !confirm(
        `Are you sure you want to withdraw the nomination for ${nomineeName}?`
      )
    ) {
      return;
    }

    setWithdrawingId(id);
    const result = await withdrawNomination(id, 'Withdrawn by nominator');

    if (result.success) {
      toast.success('Nomination withdrawn successfully');
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to withdraw nomination');
    }

    setWithdrawingId(null);
  };

  if (nominations.length === 0) {
    return (
      <div className='text-center py-12 text-muted-foreground'>
        <p className='text-lg font-medium'>No nominations submitted yet</p>
        <p className='text-sm mt-2'>
          Click &quot;New Nomination&quot; to nominate a member for a leadership
          position
        </p>
      </div>
    );
  }

  return (
    <div className='rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nominee</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Cycle</TableHead>
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
                  <div className='font-medium'>
                    {nomination.nominee.first_name}{' '}
                    {nomination.nominee.last_name}
                  </div>
                  <div className='text-sm text-muted-foreground'>
                    {nomination.nominee.email}
                  </div>
                </div>
              </TableCell>
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant='ghost'
                      size='sm'
                      disabled={withdrawingId === nomination.id}
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
                        router.push(`/succession/nominations/${nomination.id}`)
                      }
                    >
                      <Eye className='mr-2 h-4 w-4' />
                      View Details
                    </DropdownMenuItem>
                    {nomination.status === 'submitted' && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() =>
                            handleWithdraw(
                              nomination.id,
                              `${nomination.nominee.first_name} ${nomination.nominee.last_name}`
                            )
                          }
                          className='text-destructive'
                        >
                          <XCircle className='mr-2 h-4 w-4' />
                          Withdraw Nomination
                        </DropdownMenuItem>
                      </>
                    )}
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
