"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import { Button } from "@/components/yip/ui/button";
import { Badge } from "@/components/yip/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/yip/ui/dialog";
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  ThumbsUp,
  ThumbsDown,
  Landmark,
} from "lucide-react";
import { cn } from "@/lib/yip/utils";
import { PARTY_COLORS } from "@/lib/yip/constants";
import { toast } from "sonner";
import {
  approveBill,
  rejectBill,
  type BillWithMembers,
} from "@/app/yip/actions/bills";

// ─── Status Config ──────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; icon: typeof Clock }
> = {
  drafting: {
    label: "Drafting",
    className: "bg-gray-100 text-gray-700",
    icon: FileText,
  },
  submitted: {
    label: "Submitted",
    className: "bg-blue-100 text-blue-700",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    className: "bg-green-100 text-green-700",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 text-red-700",
    icon: XCircle,
  },
  presented: {
    label: "Presented",
    className: "bg-purple-100 text-purple-700",
    icon: Landmark,
  },
  passed: {
    label: "Passed",
    className: "bg-emerald-100 text-emerald-700",
    icon: CheckCircle2,
  },
};

// ─── Component ──────────────────────────────────────────────────

interface BillsClientProps {
  eventId: string;
  initialBills: BillWithMembers[];
}

export function BillsClient({ eventId, initialBills }: BillsClientProps) {
  const router = useRouter();
  const [bills, setBills] = useState(initialBills);
  const [isPending, startTransition] = useTransition();
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => void;
  }>({ open: false, title: "", description: "", action: () => {} });

  const rulingBill = bills.find((b) => b.party_side === "ruling");
  const oppositionBill = bills.find((b) => b.party_side === "opposition");

  function handleApprove(billId: string, title: string) {
    setConfirmDialog({
      open: true,
      title: "Approve Bill",
      description: `Approve "${title}"? This will allow the bill to be presented in the House.`,
      action: () => {
        startTransition(async () => {
          const result = await approveBill(billId);
          if (result.success) {
            toast.success("Bill approved");
            setBills((prev) =>
              prev.map((b) =>
                b.id === billId ? { ...b, status: "approved" } : b
              )
            );
          } else {
            toast.error(result.error);
          }
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        });
      },
    });
  }

  function handleReject(billId: string, title: string) {
    setConfirmDialog({
      open: true,
      title: "Reject Bill",
      description: `Reject "${title}"? The bill committee will need to revise and resubmit.`,
      action: () => {
        startTransition(async () => {
          const result = await rejectBill(billId);
          if (result.success) {
            toast.success("Bill rejected");
            setBills((prev) =>
              prev.map((b) =>
                b.id === billId ? { ...b, status: "rejected" } : b
              )
            );
          } else {
            toast.error(result.error);
          }
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        });
      },
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FileText className="size-5 text-[#FF9933]" />
            Bill Management
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Review and manage bills submitted by both parties
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.refresh()}>
          Refresh
        </Button>
      </div>

      {/* Two column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ruling Party Bill */}
        <BillColumn
          label="Ruling Party Bill"
          side="ruling"
          bill={rulingBill ?? null}
          onApprove={handleApprove}
          onReject={handleReject}
          isPending={isPending}
        />

        {/* Opposition Party Bill */}
        <BillColumn
          label="Opposition Party Bill"
          side="opposition"
          bill={oppositionBill ?? null}
          onApprove={handleApprove}
          onReject={handleReject}
          isPending={isPending}
        />
      </div>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          setConfirmDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>
              {confirmDialog.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setConfirmDialog((prev) => ({ ...prev, open: false }))
              }
            >
              Cancel
            </Button>
            <Button disabled={isPending} onClick={confirmDialog.action}>
              {isPending ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Bill Column Component ──────────────────────────────────────

function BillColumn({
  label,
  side,
  bill,
  onApprove,
  onReject,
  isPending,
}: {
  label: string;
  side: "ruling" | "opposition";
  bill: BillWithMembers | null;
  onApprove: (billId: string, title: string) => void;
  onReject: (billId: string, title: string) => void;
  isPending: boolean;
}) {
  const colors = PARTY_COLORS[side];
  const status = bill?.status ?? "drafting";
  const statusConfig = STATUS_CONFIG[status] ?? STATUS_CONFIG.drafting;
  const StatusIcon = statusConfig.icon;
  const provisions = (bill?.provisions as string[]) ?? [];

  return (
    <Card className={cn("overflow-hidden", colors.border, "border")}>
      {/* Party header bar */}
      <div
        className={cn(
          "px-4 py-2.5 flex items-center justify-between",
          side === "ruling" ? "bg-blue-50" : "bg-red-50"
        )}
      >
        <span
          className={cn(
            "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium",
            colors.badge
          )}
        >
          {label}
        </span>
        {bill && (
          <Badge variant="secondary" className={statusConfig.className}>
            <StatusIcon className="size-3 mr-0.5" />
            {statusConfig.label}
          </Badge>
        )}
      </div>

      <CardContent className="pt-4 pb-5">
        {!bill ? (
          <div className="py-8 text-center">
            <FileText className="mx-auto size-10 text-gray-200 mb-3" />
            <p className="text-sm text-gray-500">No bill submitted yet</p>
            <p className="text-xs text-gray-400 mt-1">
              The bill committee has not started drafting
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Title */}
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">
                Bill Title
              </p>
              <p className="text-lg font-bold text-gray-900">{bill.title}</p>
            </div>

            {/* Objective */}
            {bill.objective && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">
                  Objective
                </p>
                <p className="text-sm text-gray-700">{bill.objective}</p>
              </div>
            )}

            {/* Problem Statement */}
            {bill.problem_statement && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">
                  Problem Statement
                </p>
                <p className="text-sm text-gray-700">
                  {bill.problem_statement}
                </p>
              </div>
            )}

            {/* Key Provisions */}
            {provisions.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">
                  Key Provisions
                </p>
                <ul className="mt-1 space-y-1">
                  {provisions.map((p, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-gray-700"
                    >
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#FF9933]" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Expected Impact */}
            {bill.expected_impact && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">
                  Expected Impact
                </p>
                <p className="text-sm text-gray-700">
                  {bill.expected_impact}
                </p>
              </div>
            )}

            {/* Implementation */}
            {bill.implementation && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">
                  Implementation Mechanism
                </p>
                <p className="text-sm text-gray-700">
                  {bill.implementation}
                </p>
              </div>
            )}

            {/* Committee Members */}
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Users className="size-3" />
                Committee Members
              </p>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {bill.lead_drafter_name && (
                  <div className="rounded bg-gray-50 px-2 py-1.5">
                    <p className="text-[10px] text-gray-400">Lead Drafter</p>
                    <p className="text-xs font-medium text-gray-700 truncate">
                      {bill.lead_drafter_name}
                    </p>
                  </div>
                )}
                {bill.presenter_1_name && (
                  <div className="rounded bg-gray-50 px-2 py-1.5">
                    <p className="text-[10px] text-gray-400">Presenter 1</p>
                    <p className="text-xs font-medium text-gray-700 truncate">
                      {bill.presenter_1_name}
                    </p>
                  </div>
                )}
                {bill.presenter_2_name && (
                  <div className="rounded bg-gray-50 px-2 py-1.5">
                    <p className="text-[10px] text-gray-400">Presenter 2</p>
                    <p className="text-xs font-medium text-gray-700 truncate">
                      {bill.presenter_2_name}
                    </p>
                  </div>
                )}
                {bill.policy_researcher_name && (
                  <div className="rounded bg-gray-50 px-2 py-1.5">
                    <p className="text-[10px] text-gray-400">
                      Policy Researcher
                    </p>
                    <p className="text-xs font-medium text-gray-700 truncate">
                      {bill.policy_researcher_name}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Vote Results (if bill has been voted on) */}
            {(bill.votes_for !== null || bill.votes_against !== null) && (
              <div className="rounded-lg border p-3">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                  Vote Results
                </p>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-green-700 font-medium">
                    Aye: {bill.votes_for ?? 0}
                  </span>
                  <span className="text-red-700 font-medium">
                    Nay: {bill.votes_against ?? 0}
                  </span>
                  <span className="text-gray-500">
                    Abstain: {bill.votes_abstain ?? 0}
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons — only for submitted bills */}
            {status === "submitted" && (
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={() => onApprove(bill.id, bill.title)}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <ThumbsUp className="size-3.5 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => onReject(bill.id, bill.title)}
                  className="flex-1"
                >
                  <ThumbsDown className="size-3.5 mr-1" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
