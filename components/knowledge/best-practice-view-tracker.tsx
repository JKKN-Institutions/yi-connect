'use client';

import { useEffect, useRef } from 'react';
import { incrementBestPracticeView } from '@/app/actions/knowledge';

interface BestPracticeViewTrackerProps {
  practiceId: string;
}

export function BestPracticeViewTracker({ practiceId }: BestPracticeViewTrackerProps) {
  const hasTracked = useRef(false);

  useEffect(() => {
    // Only track once per component mount
    if (hasTracked.current) return;
    hasTracked.current = true;

    // Track view in the background (don't await to avoid blocking)
    const trackView = async () => {
      try {
        await incrementBestPracticeView(practiceId, false);
      } catch (error) {
        // Silently fail - view tracking shouldn't break the page
        console.error('Failed to track best practice view:', error);
      }
    };

    trackView();
  }, [practiceId]);

  // This component doesn't render anything
  return null;
}
