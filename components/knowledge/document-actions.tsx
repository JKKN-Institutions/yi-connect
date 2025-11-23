'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import toast from 'react-hot-toast';
import { Share2, Copy, Link2, Edit, Trash2, MoreVertical } from 'lucide-react';
import { deleteDocument } from '@/app/actions/knowledge';

interface DocumentActionsProps {
  documentId: string;
  documentTitle: string;
  downloadUrl?: string | null;
}

export function DocumentShareButton({
  documentId,
  documentTitle
}: {
  documentId: string;
  documentTitle: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleCopyLink = async () => {
    try {
      const url = `${window.location.origin}/knowledge/documents/${documentId}`;
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard!');
      setIsOpen(false);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/knowledge/documents/${documentId}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: documentTitle,
          text: `Check out this document: ${documentTitle}`,
          url: url
        });
        setIsOpen(false);
      } catch (error) {
        // User cancelled or share failed - fall back to copy
        if ((error as Error).name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      // Fallback to copy link
      handleCopyLink();
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant='outline' size='icon'>
          <Share2 className='h-4 w-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuItem onClick={handleShare}>
          <Share2 className='mr-2 h-4 w-4' />
          Share
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyLink}>
          <Copy className='mr-2 h-4 w-4' />
          Copy Link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DocumentMoreActions({
  documentId,
  documentTitle
}: DocumentActionsProps) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEdit = () => {
    router.push(`/knowledge/documents/${documentId}/edit`);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent default AlertDialogAction behavior
    setIsDeleting(true);
    try {
      const result = await deleteDocument(documentId);
      if (result.success) {
        toast.success('Document deleted successfully');
        setShowDeleteDialog(false);
        router.push('/knowledge/documents');
      } else {
        toast.error(result.message || 'Failed to delete document');
        setIsDeleting(false);
      }
    } catch {
      toast.error('Failed to delete document');
      setIsDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='outline' size='icon'>
            <MoreVertical className='h-4 w-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuItem onClick={handleEdit}>
            <Edit className='mr-2 h-4 w-4' />
            Edit Document
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className='text-destructive focus:text-destructive'
          >
            <Trash2 className='mr-2 h-4 w-4' />
            Delete Document
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{documentTitle}&quot;? This
              action cannot be undone. The file will be permanently removed from
              storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className='bg-destructive text-white hover:bg-destructive/90'
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
