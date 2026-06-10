"use client";

/**
 * Activate / deactivate switch for an academy (NATIONAL list + detail).
 * Calls the national-gated setAcademyActive action — deactivation is blocked
 * server-side while a live run exists; the error is surfaced as a toast.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Switch } from "@/components/ui/switch";
import { setAcademyActive } from "@/app/youth-academy/actions/academies";

export function AcademyActiveToggle({
  academyId,
  isActive,
}: {
  academyId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useState(isActive);
  const [pending, startTransition] = useTransition();

  function onToggle(next: boolean) {
    setOptimistic(next);
    startTransition(async () => {
      const result = await setAcademyActive({ academyId, active: next });
      if (!result.success) {
        setOptimistic(!next); // revert — e.g. live-run deactivation block
        toast.error(result.error);
        return;
      }
      toast.success(next ? "Academy activated" : "Academy deactivated");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={optimistic}
        onCheckedChange={onToggle}
        disabled={pending}
        aria-label={optimistic ? "Deactivate academy" : "Activate academy"}
      />
      <span className="text-xs text-slate-500">
        {optimistic ? "Active" : "Inactive"}
      </span>
    </div>
  );
}
