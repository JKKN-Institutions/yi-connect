"use client";

/**
 * Chapter Mentor YUVA Network roster (Phase 6).
 * Photo, name, expertise, organization, delivered/upcoming session counts,
 * public-profile indicator, and a deactivate action. Deactivating a mentor
 * with future assigned sessions still proceeds, but the warning returned by
 * the action (sessions needing reassignment) is surfaced loudly.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, CalendarClock, Eye, EyeOff, Loader2, UserMinus } from "lucide-react";
import toast from "react-hot-toast";
import { deactivateMentor } from "@/app/youth-academy/actions/mentors";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type MentorRosterRow = {
  assignmentId: string;
  personId: string;
  name: string;
  email: string | null;
  chapter: string | null;
  organization: string | null;
  expertise: string[];
  photoUrl: string | null;
  isPublic: boolean;
  upcomingSessions: number;
  deliveredSessions: number;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function MentorRoster({
  rows,
  showChapterColumn = false,
}: {
  rows: MentorRosterRow[];
  /** National view spans chapters — show which chapter each row belongs to. */
  showChapterColumn?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [target, setTarget] = useState<MentorRosterRow | null>(null);

  const confirmDeactivate = () => {
    if (!target) return;
    const row = target;
    startTransition(async () => {
      const result = await deactivateMentor({ assignmentId: row.assignmentId });
      setTarget(null);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if (result.warning) {
        toast(`${row.name} removed. ${result.warning}`, {
          icon: "⚠️",
          duration: 10000,
        });
      } else {
        toast.success(`${row.name} removed from the network.`);
      }
      router.refresh();
    });
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm font-medium text-slate-900">
          No mentors in the network yet
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Invite your first mentor — anyone with a name and an email can join.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mentor</TableHead>
              {showChapterColumn && <TableHead>Chapter</TableHead>}
              <TableHead>Expertise</TableHead>
              <TableHead className="text-center">Upcoming</TableHead>
              <TableHead className="text-center">Delivered</TableHead>
              <TableHead className="text-center">Public</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.assignmentId}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {row.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.photoUrl}
                        alt={row.name}
                        className="h-9 w-9 shrink-0 rounded-full border border-slate-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                        {initials(row.name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {row.name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {row.organization ?? row.email ?? "—"}
                      </p>
                    </div>
                  </div>
                </TableCell>
                {showChapterColumn && (
                  <TableCell className="text-sm text-slate-600">
                    {row.chapter ?? "—"}
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex max-w-60 flex-wrap gap-1">
                    {row.expertise.length === 0 ? (
                      <span className="text-xs text-slate-400">
                        Profile not filled yet
                      </span>
                    ) : (
                      row.expertise.slice(0, 3).map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="bg-amber-50 text-amber-800 hover:bg-amber-50"
                        >
                          {tag}
                        </Badge>
                      ))
                    )}
                    {row.expertise.length > 3 && (
                      <Badge variant="outline" className="text-slate-500">
                        +{row.expertise.length - 3}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <span className="inline-flex items-center gap-1 text-sm text-slate-700">
                    <CalendarClock className="size-3.5 text-slate-400" />
                    {row.upcomingSessions}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="inline-flex items-center gap-1 text-sm text-slate-700">
                    <CalendarCheck className="size-3.5 text-slate-400" />
                    {row.deliveredSessions}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  {row.isPublic ? (
                    <span
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"
                      title="Shown on the public Mentor YUVA Network page"
                    >
                      <Eye className="size-3.5" /> Public
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 text-xs text-slate-400"
                      title="Hidden from the public Mentor YUVA Network page"
                    >
                      <EyeOff className="size-3.5" /> Hidden
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => setTarget(row)}
                    disabled={isPending}
                    title="Remove from network"
                  >
                    <UserMinus className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={target !== null}
        onOpenChange={(next) => {
          if (!next) setTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {target?.name} from the network?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They will disappear from this chapter&apos;s Mentor YUVA Network
              and the public mentors page.
              {target && target.upcomingSessions > 0 && (
                <>
                  {" "}
                  <strong className="text-amber-700">
                    Heads up: they have {target.upcomingSessions} upcoming
                    assigned session
                    {target.upcomingSessions === 1 ? "" : "s"} that will need a
                    new mentor.
                  </strong>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDeactivate();
              }}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Remove mentor
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
