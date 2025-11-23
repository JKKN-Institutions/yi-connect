'use client';

import { useEffect, useRef } from 'react';
import { incrementDocumentView, logAccess } from '@/app/actions/knowledge';

interface DocumentViewTrackerProps {
  documentId: string;
}

export function DocumentViewTracker({ documentId }: DocumentViewTrackerProps) {
  const hasTracked = useRef(false);

  useEffect(() => {
    // Only track once per component mount
    if (hasTracked.current) return;
    hasTracked.current = true;

    // Track view in the background (don't await to avoid blocking)
    const trackView = async () => {
      try {
        await Promise.all([
          logAccess('document', documentId, 'view'),
          incrementDocumentView(documentId, false), // Don't revalidate during tracking
        ]);
      } catch (error) {
        // Silently fail - view tracking shouldn't break the page
        console.error('Failed to track document view:', error);
      }
    };

    trackView();
  }, [documentId]);

  // This component doesn't render anything
  return null;
}
