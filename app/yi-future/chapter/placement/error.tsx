"use client";

import { PlacementErrorPanel } from "@/components/yi-future/placement/PlacementFallbacks";

export default function Error(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PlacementErrorPanel {...props} />;
}
