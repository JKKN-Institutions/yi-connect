'use client';

/**
 * Member Requests Table Component
 *
 * Displays membership applications with approve/reject actions
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { approveMemberRequest, rejectMemberRequest } from '@/app/actions/member-requests';
import { toast } from 'react-hot-toast';
import { Check, X, Eye, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface MemberRequest {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  company?: string;
  designation?: string;
  city: string;
  state: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  created_at: string;
  reviewed_at?: string;
  review_notes?: string;
  motivation: string;
  chapter?: {
    id: string;
    name: string;
    location: string;
  };
}

interface MemberRequestsTableProps {
  requests: MemberRequest[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
}

export function MemberRequestsTable({
  requests,
  totalCount,
  currentPage,
  pageSize
}: MemberRequestsTableProps) {
  const router = useRouter();
  const [selectedRequest, setSelectedRequest] = useState<MemberRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'view' | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleApprove = async (requestId: string) => {
    setLoading(true);
    try {
      const result = await approveMemberRequest(requestId, notes || undefined);
      if (result.success) {
        toast.success(result.message || 'Application approved successfully');
        setActionType(null);
        setSelectedRequest(null);
        setNotes('');
        router.refresh();
      } else {
        toast.error(result.message || 'Failed to approve application');
      }
    } catch (error) {
      toast.error('Failed to approve request');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!notes.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    setLoading(true);
    try {
      const result = await rejectMemberRequest(requestId, notes);
      if (result.success) {
        toast.success(result.message || 'Application rejected successfully');
        setActionType(null);
        setSelectedRequest(null);
        setNotes('');
        router.refresh();
      } else {
        toast.error(result.message || 'Failed to reject application');
      }
    } catch (error) {
      toast.error('Failed to reject request');
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (request: MemberRequest, action: 'approve' | 'reject' | 'view') => {
    setSelectedRequest(request);
    setActionType(action);
    setNotes(request.review_notes || '');
  };

  const closeDialog = () => {
    setActionType(null);
    setSelectedRequest(null);
    setNotes('');
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      approved: 'default',
      rejected: 'destructive',
      withdrawn: 'outline'
    };

    return (
      <Badge variant={variants[status] || 'default'} className='capitalize'>
        {status}
      </Badge>
    );
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <>
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Chapter</TableHead>
              <TableHead>Applied</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className='text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => (
              <TableRow key={request.id}>
                <TableCell className='font-medium'>{request.full_name}</TableCell>
                <TableCell>{request.email}</TableCell>
                <TableCell>{request.phone}</TableCell>
                <TableCell>
                  {request.city}, {request.state}
                </TableCell>
                <TableCell>{request.chapter?.name || 'N/A'}</TableCell>
                <TableCell>{format(new Date(request.created_at), 'MMM dd, yyyy')}</TableCell>
                <TableCell>{getStatusBadge(request.status)}</TableCell>
                <TableCell className='text-right'>
                  <div className='flex items-center justify-end gap-2'>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => openDialog(request, 'view')}
                    >
                      <Eye className='h-4 w-4' />
                    </Button>
                    {request.status === 'pending' && (
                      <>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => openDialog(request, 'approve')}
                        >
                          <Check className='h-4 w-4 text-green-600' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => openDialog(request, 'reject')}
                        >
                          <X className='h-4 w-4 text-red-600' />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className='flex items-center justify-between px-2'>
          <div className='text-sm text-muted-foreground'>
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, totalCount)} of {totalCount} applications
          </div>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={currentPage === 1}
              onClick={() => router.push(`?page=${currentPage - 1}`)}
            >
              Previous
            </Button>
            <Button
              variant='outline'
              size='sm'
              disabled={currentPage === totalPages}
              onClick={() => router.push(`?page=${currentPage + 1}`)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* View/Approve/Reject Dialog */}
      <Dialog open={actionType !== null} onOpenChange={closeDialog}>
        <DialogContent className='max-w-2xl max-h-[80vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'view' && 'Application Details'}
              {actionType === 'approve' && 'Approve Application'}
              {actionType === 'reject' && 'Reject Application'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'view' && 'Review the complete application details'}
              {actionType === 'approve' &&
                'This will add the email to the whitelist and allow the applicant to login'}
              {actionType === 'reject' && 'Please provide a reason for rejection'}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className='space-y-4'>
              {/* Basic Information */}
              <div>
                <h3 className='font-semibold mb-2'>Basic Information</h3>
                <div className='grid grid-cols-2 gap-3 text-sm'>
                  <div>
                    <span className='text-muted-foreground'>Full Name:</span>
                    <p className='font-medium'>{selectedRequest.full_name}</p>
                  </div>
                  <div>
                    <span className='text-muted-foreground'>Email:</span>
                    <p className='font-medium'>{selectedRequest.email}</p>
                  </div>
                  <div>
                    <span className='text-muted-foreground'>Phone:</span>
                    <p className='font-medium'>{selectedRequest.phone}</p>
                  </div>
                  <div>
                    <span className='text-muted-foreground'>Location:</span>
                    <p className='font-medium'>
                      {selectedRequest.city}, {selectedRequest.state}
                    </p>
                  </div>
                </div>
              </div>

              {/* Professional Information */}
              {(selectedRequest.company || selectedRequest.designation) && (
                <div>
                  <h3 className='font-semibold mb-2'>Professional Information</h3>
                  <div className='grid grid-cols-2 gap-3 text-sm'>
                    {selectedRequest.company && (
                      <div>
                        <span className='text-muted-foreground'>Company:</span>
                        <p className='font-medium'>{selectedRequest.company}</p>
                      </div>
                    )}
                    {selectedRequest.designation && (
                      <div>
                        <span className='text-muted-foreground'>Designation:</span>
                        <p className='font-medium'>{selectedRequest.designation}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Motivation */}
              <div>
                <h3 className='font-semibold mb-2'>Why Join Yi?</h3>
                <p className='text-sm bg-muted p-3 rounded-md'>{selectedRequest.motivation}</p>
              </div>

              {/* Preferred Chapter */}
              <div>
                <h3 className='font-semibold mb-2'>Preferred Chapter</h3>
                <p className='text-sm'>
                  {selectedRequest.chapter?.name} - {selectedRequest.chapter?.location}
                </p>
              </div>

              {/* Review Information (if reviewed) */}
              {selectedRequest.reviewed_at && (
                <div>
                  <h3 className='font-semibold mb-2'>Review Information</h3>
                  <div className='grid grid-cols-2 gap-3 text-sm'>
                    <div>
                      <span className='text-muted-foreground'>Reviewed At:</span>
                      <p className='font-medium'>
                        {format(new Date(selectedRequest.reviewed_at), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  </div>
                  {selectedRequest.review_notes && (
                    <div className='mt-2'>
                      <span className='text-muted-foreground'>Notes:</span>
                      <p className='text-sm bg-muted p-3 rounded-md mt-1'>
                        {selectedRequest.review_notes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Notes field for approve/reject */}
              {(actionType === 'approve' || actionType === 'reject') && (
                <div className='space-y-2'>
                  <Label htmlFor='notes'>
                    Notes {actionType === 'reject' && <span className='text-red-600'>*</span>}
                  </Label>
                  <Textarea
                    id='notes'
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={
                      actionType === 'approve'
                        ? 'Optional notes about this approval...'
                        : 'Required: Provide reason for rejection...'
                    }
                    rows={3}
                    required={actionType === 'reject'}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant='outline' onClick={closeDialog} disabled={loading}>
              {actionType === 'view' ? 'Close' : 'Cancel'}
            </Button>
            {actionType === 'approve' && selectedRequest && (
              <Button onClick={() => handleApprove(selectedRequest.id)} disabled={loading}>
                {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                Approve Application
              </Button>
            )}
            {actionType === 'reject' && selectedRequest && (
              <Button
                variant='destructive'
                onClick={() => handleReject(selectedRequest.id)}
                disabled={loading}
              >
                {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                Reject Application
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
