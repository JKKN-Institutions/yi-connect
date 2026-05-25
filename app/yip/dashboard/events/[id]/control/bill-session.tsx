"use client";

import { useState, useEffect, useTransition } from "react";
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
  Presentation,
  Vote,
  CheckCircle2,
  XCircle,
  Users,
} from "lucide-react";
import { cn } from "@/lib/yip/utils";
import { PARTY_COLORS } from "@/lib/yip/constants";
import { toast } from "sonner";
import {
  getBills,
  setBillPresented,
  type BillWithMembers,
} from "@/app/yip/actions/bills";
import { openVote } from "@/app/yip/actions/voting";

// ─── Types ──────────────────────────────────────────────────────

interface BillSessionProps {
  eventId: string;
  agendaItemId: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  drafting: { label: "Drafting", className: "bg-gray-100 text-gray-700" },
  submitted: { label: "Submitted", className: "bg-blue-100 text-blue-700" },
  approved: { label: "Approved", className: "bg-green-100 text-green-700" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700" },
  presented: { label: "Presented", className: "bg-purple-100 text-purple-700" },
  passed: { label: "Passed", className: "bg-emerald-100 text-emerald-700" },
};

// ─── Component ──────────────────────────────────────────────────

export function BillSession({ eventId, agendaItemId }: BillSessionProps) {
  const [bills, setBills] = useState<BillWithMembers[]>([]);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => void;
  }>({ open: false, title: "", description: "", action: () => {} });

  // Load bills
  useEffect(() => {
    loadBills();
  }, [eventId]);

  async function loadBills() {
    const data = await getBills(eventId);
    setBills(data);
    setLoading(false);
  }

  function handlePresentBill(bill: BillWithMembers) {
    setConfirmDialog({
      open: true,
      title: `Present ${bill.party_side === "ruling" ? "Ruling" : "Opposition"} Bill`,
      description: `Mark "${bill.title}" as presented? This will show the bill on the projector display.`,
      action: () => {
        startTransition(async () => {
          const result = await setBillPresented(bill.id);
          if (result.success) {
            toast.success("Bill marked as presented");
            setBills((prev) =>
              prev.map((b) =>
                b.id === bill.id ? { ...b, status: "presented" } : b
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

  function handleOpenBillVote(bill: BillWithMembers) {
    setConfirmDialog({
      open: true,
      title: "Open Bill Vote",
      description: `Open voting on "${bill.title}"? Participants will vote Aye, Nay, or Abstain.`,
      action: () => {
        startTransition(async () => {
          const result = await openVote(
            eventId,
            agendaItemId,
            "bill_vote",
            { billId: bill.id }
          );
          if (result.success) {
            toast.success("Bill voting is now open!");
          } else {
            toast.error(result.error);
          }
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        });
      },
    });
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Loading bills...
        </CardContent>
      </Card>
    );
  }

  const rulingBill = bills.find((b) => b.party_side === "ruling");
  const oppositionBill = bills.find((b) => b.party_side === "opposition");

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="size-4" />
            Bill Presentation & Voting
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!rulingBill && !oppositionBill ? (
            <p className="text-center py-4 text-sm text-muted-foreground">
              No bills available. Bills must be submitted and approved first.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Ruling Bill */}
              {rulingBill && (
                <BillCard
                  bill={rulingBill}
                  onPresent={handlePresentBill}
                  onVote={handleOpenBillVote}
                  isPending={isPending}
                />
              )}

              {/* Opposition Bill */}
              {oppositionBill && (
                <BillCard
                  bill={oppositionBill}
                  onPresent={handlePresentBill}
                  onVote={handleOpenBillVote}
                  isPending={isPending}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
    </>
  );
}

// ─── Bill Card ──────────────────────────────────────────────────

function BillCard({
  bill,
  onPresent,
  onVote,
  isPending,
}: {
  bill: BillWithMembers;
  onPresent: (bill: BillWithMembers) => void;
  onVote: (bill: BillWithMembers) => void;
  isPending: boolean;
}) {
  const side = bill.party_side as "ruling" | "opposition";
  const partyLabel = side === "ruling" ? "Ruling Party" : "Opposition";
  const status = bill.status ?? "drafting";
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.drafting;
  const provisions = (bill.provisions as string[]) ?? [];

  const canPresent =
    status === "approved" || status === "submitted";
  const canVote = status === "presented";

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        side === "ruling" ? "border-blue-200" : "border-red-200"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              PARTY_COLORS[side].badge
            )}
          >
            {partyLabel}
          </span>
          <h3 className="mt-1.5 text-sm font-bold text-gray-900">
            {bill.title}
          </h3>
        </div>
        <Badge variant="secondary" className={cn("shrink-0", config.className)}>
          {config.label}
        </Badge>
      </div>

      {/* Bill summary */}
      {bill.objective && (
        <p className="text-xs text-gray-600 mb-2">{bill.objective}</p>
      )}

      {provisions.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
            Key Provisions
          </p>
          <ul className="space-y-0.5">
            {provisions.map((p, i) => (
              <li
                key={i}
                className="flex items-start gap-1.5 text-xs text-gray-600"
              >
                <span className="mt-1 size-1 shrink-0 rounded-full bg-[#FF9933]" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Presenters */}
      <div className="flex flex-wrap gap-2 mb-3">
        {bill.presenter_1_name && (
          <span className="inline-flex items-center gap-1 rounded bg-gray-50 px-2 py-0.5 text-[10px] text-gray-600">
            <Users className="size-2.5" />
            P1: {bill.presenter_1_name}
          </span>
        )}
        {bill.presenter_2_name && (
          <span className="inline-flex items-center gap-1 rounded bg-gray-50 px-2 py-0.5 text-[10px] text-gray-600">
            <Users className="size-2.5" />
            P2: {bill.presenter_2_name}
          </span>
        )}
      </div>

      {/* Vote results if available */}
      {(bill.votes_for !== null || bill.votes_against !== null) && (
        <div className="rounded bg-gray-50 px-3 py-2 mb-3 flex items-center gap-3 text-xs">
          <span className="text-green-700 font-medium">
            Aye: {bill.votes_for ?? 0}
          </span>
          <span className="text-red-700 font-medium">
            Nay: {bill.votes_against ?? 0}
          </span>
          <span className="text-gray-500">
            Abstain: {bill.votes_abstain ?? 0}
          </span>
          {status === "passed" && (
            <CheckCircle2 className="size-4 text-green-600 ml-auto" />
          )}
          {status === "rejected" && (
            <XCircle className="size-4 text-red-600 ml-auto" />
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {canPresent && (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => onPresent(bill)}
            className="flex-1"
          >
            <Presentation className="size-3.5 mr-1" />
            Present Bill
          </Button>
        )}
        {canVote && (
          <Button
            size="sm"
            disabled={isPending}
            onClick={() => onVote(bill)}
            className="flex-1"
          >
            <Vote className="size-3.5 mr-1" />
            Open Bill Vote
          </Button>
        )}
      </div>
    </div>
  );
}
