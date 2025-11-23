'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { toggleBestPracticeUpvote } from '@/app/actions/knowledge';
import { ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface BestPracticeUpvoteButtonProps {
  practiceId: string;
  initialUpvoteCount: number;
  initialHasUpvoted: boolean;
}

export function BestPracticeUpvoteButton({
  practiceId,
  initialUpvoteCount,
  initialHasUpvoted,
}: BestPracticeUpvoteButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [hasUpvoted, setHasUpvoted] = useState(initialHasUpvoted);
  const [upvoteCount, setUpvoteCount] = useState(initialUpvoteCount);

  const handleUpvote = () => {
    // Optimistic update
    const newHasUpvoted = !hasUpvoted;
    setHasUpvoted(newHasUpvoted);
    setUpvoteCount((prev) => (newHasUpvoted ? prev + 1 : prev - 1));

    startTransition(async () => {
      const result = await toggleBestPracticeUpvote(practiceId);
      if (!result.success) {
        // Revert on error
        setHasUpvoted(!newHasUpvoted);
        setUpvoteCount((prev) => (newHasUpvoted ? prev - 1 : prev + 1));
        toast.error(result.message || 'Failed to toggle upvote');
      }
    });
  };

  return (
    <Button
      variant={hasUpvoted ? 'default' : 'outline'}
      size="sm"
      onClick={handleUpvote}
      disabled={isPending}
      className={cn(
        'gap-2',
        hasUpvoted && 'bg-primary text-primary-foreground'
      )}
    >
      <ThumbsUp
        className={cn(
          'h-4 w-4',
          hasUpvoted && 'fill-current'
        )}
      />
      <span>{upvoteCount}</span>
    </Button>
  );
}
