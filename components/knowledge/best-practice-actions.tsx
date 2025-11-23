'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { submitBestPractice, reviewBestPractice } from '@/app/actions/knowledge';
import type { BestPractice } from '@/types/knowledge';
import toast from 'react-hot-toast';
import { Loader2, Send, CheckCircle, XCircle } from 'lucide-react';

interface BestPracticeActionsProps {
  bestPractice: BestPractice;
  isOwner: boolean;
  canReview: boolean;
}

export function BestPracticeActions({
  bestPractice,
  isOwner,
  canReview,
}: BestPracticeActionsProps) {
  const router = useRouter();
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const result = await submitBestPractice(bestPractice.id);
      if (result.success) {
        toast.success(result.message || 'Submitted for review');
        setShowSubmitDialog(false);
        router.refresh();
      } else {
        toast.error(result.message || 'Failed to submit');
      }
    } catch {
      toast.error('Failed to submit');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReview = async () => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.set('action', reviewAction);
      formData.set('review_notes', reviewNotes);

      const result = await reviewBestPractice(
        bestPractice.id,
        { success: false, message: '' },
        formData
      );

      if (result.success) {
        toast.success(result.message || `Best practice ${reviewAction}d`);
        setShowReviewDialog(false);
        setReviewNotes('');
        router.refresh();
      } else {
        toast.error(result.message || 'Failed to review');
      }
    } catch {
      toast.error('Failed to review');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openReviewDialog = (action: 'approve' | 'reject') => {
    setReviewAction(action);
    setShowReviewDialog(true);
  };

  // Show submit button for owner when status is draft
  const canSubmit = isOwner && bestPractice.status === 'draft';

  // Show review buttons for reviewers when status is submitted or under_review
  const canDoReview = canReview && (bestPractice.status === 'submitted' || bestPractice.status === 'under_review');

  if (!canSubmit && !canDoReview) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {canSubmit && (
          <Button onClick={() => setShowSubmitDialog(true)}>
            <Send className="mr-2 h-4 w-4" />
            Submit for Review
          </Button>
        )}

        {canDoReview && (
          <>
            <Button
              variant="default"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => openReviewDialog('approve')}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve & Publish
            </Button>
            <Button
              variant="destructive"
              onClick={() => openReviewDialog('reject')}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
          </>
        )}
      </div>

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit for Review</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to submit this best practice for review? Once
              submitted, you won&apos;t be able to edit it until the review is
              complete.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? 'Approve & Publish' : 'Reject'} Best Practice
            </DialogTitle>
            <DialogDescription>
              {reviewAction === 'approve'
                ? 'This will publish the best practice and make it visible to all chapter members.'
                : 'This will reject the best practice and send it back to the author.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="review_notes">
                Review Notes {reviewAction === 'reject' && '(Required for rejection)'}
              </Label>
              <Textarea
                id="review_notes"
                placeholder={
                  reviewAction === 'approve'
                    ? 'Optional feedback for the author...'
                    : 'Please explain why this is being rejected...'
                }
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowReviewDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant={reviewAction === 'approve' ? 'default' : 'destructive'}
              onClick={handleReview}
              disabled={isSubmitting || (reviewAction === 'reject' && !reviewNotes.trim())}
              className={reviewAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {reviewAction === 'approve' ? 'Approve & Publish' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
