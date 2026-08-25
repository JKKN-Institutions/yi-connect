"use client";

/**
 * Write and hand in a Private Member's Bill.
 *
 * A Member writes this alone — there is no drafting committee behind it, which
 * is what separates it from the Committee Room's bill. Handing it in puts it on
 * the organiser's bills board at `submitted`, exactly where an organiser-typed
 * one lands, so it picks up the same Approve / Reject controls with no special
 * handling.
 *
 * Editing stops at hand-in on purpose: an organiser may already have read it.
 */

import { useState, useTransition } from "react";
import { Loader2, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent } from "@/components/yip/ui/card";
import { Input } from "@/components/yip/ui/input";
import { Label } from "@/components/yip/ui/label";
import { Textarea } from "@/components/yip/ui/textarea";
import {
  getMyPrivateMemberBill,
  saveMyPrivateMemberBillDraft,
  submitMyPrivateMemberBill,
} from "@/app/yip/actions/bills";

const INK = "#1a1a3e";
const SAFFRON = "#C2691A";

export type MyPrivateBill = {
  id: string;
  title: string;
  objective: string | null;
  problemStatement: string | null;
  provisions: string[];
  status: string;
};

export function PrivateBillClient({
  eventId,
  participantId,
  participantName,
  initialBill,
  initialError,
}: {
  eventId: string;
  participantId: string;
  participantName: string;
  initialBill: MyPrivateBill | null;
  initialError: string | null;
}) {
  // Seeded from the server render — no load-on-mount effect, and no spinner on
  // a phone in a hall.
  // Never changes after the server render — the action re-checks on every call.
  const denied = initialError;
  const [status, setStatus] = useState(initialBill?.status ?? "drafting");
  const [title, setTitle] = useState(initialBill?.title ?? "");
  const [objective, setObjective] = useState(initialBill?.objective ?? "");
  const [problem, setProblem] = useState(initialBill?.problemStatement ?? "");
  const [provisions, setProvisions] = useState<string[]>(
    initialBill && initialBill.provisions.length > 0 ? initialBill.provisions : [""]
  );
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  const handedIn = status !== "drafting";

  function save(then?: () => void) {
    if (!title.trim()) {
      toast.error("Give your bill a title first.");
      return;
    }
    setSaving(true);
    startTransition(async () => {
      const res = await saveMyPrivateMemberBillDraft(eventId, participantId, {
        title,
        objective,
        problemStatement: problem,
        provisions,
      });
      setSaving(false);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Saved.");
      then?.();
    });
  }

  function handIn() {
    // Save first, so what is handed in is always what is on screen — a Member
    // who edits and taps Hand in without saving must not submit an older draft.
    save(() => {
      startTransition(async () => {
        const res = await submitMyPrivateMemberBill(eventId, participantId);
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        toast.success("Handed in. An organiser will review it.");
        setStatus(res.data.status);
      });
    });
  }

  if (denied) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Card>
          <CardContent className="p-6">
            <h1 className="text-lg font-semibold" style={{ color: INK }}>
              Private Member&apos;s Bill
            </h1>
            <p className="mt-2 text-sm text-[#1a1a3e]/70">{denied}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <p
        className="text-[10px] font-bold uppercase tracking-[0.16em]"
        style={{ color: SAFFRON }}
      >
        {participantName}
      </p>
      <h1 className="mt-1 text-2xl font-semibold" style={{ color: INK }}>
        Your Private Member&apos;s Bill
      </h1>
      <p className="mt-1.5 text-sm text-[#1a1a3e]/70">
        A bill you bring to the House yourself, without a committee behind it.
        Write it here and hand it in — an organiser reads every bill before it
        reaches the floor.
      </p>

      {handedIn && (
        <div
          className="mt-4 rounded-xl border px-4 py-3"
          style={{ borderColor: "#1a1a3e26", background: "#1a1a3e08" }}
        >
          <p className="text-sm font-medium" style={{ color: INK }}>
            Handed in — waiting for an organiser.
          </p>
          <p className="mt-0.5 text-xs text-[#1a1a3e]/60">
            You can still read it below. Ask an organiser if something needs
            changing.
          </p>
        </div>
      )}

      <div className="mt-5 space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="pmb-title">Title of the bill</Label>
          <Input
            id="pmb-title"
            value={title}
            disabled={handedIn}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. The School Road Safety Bill"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pmb-problem">What problem does it solve?</Label>
          <Textarea
            id="pmb-problem"
            rows={4}
            value={problem}
            disabled={handedIn}
            onChange={(e) => setProblem(e.target.value)}
            placeholder="What is wrong today, and who does it affect?"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pmb-objective">What is the bill trying to do?</Label>
          <Textarea
            id="pmb-objective"
            rows={3}
            value={objective}
            disabled={handedIn}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="In a sentence or two."
          />
        </div>

        <div className="space-y-2">
          <Label>What the bill provides for</Label>
          <p className="text-xs text-[#1a1a3e]/55">
            One clause per line — the specific things the bill would do.
          </p>
          {provisions.map((p, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2.5 w-5 shrink-0 text-right font-mono text-xs text-[#1a1a3e]/45">
                {i + 1}.
              </span>
              <Textarea
                rows={2}
                value={p}
                disabled={handedIn}
                aria-label={`Clause ${i + 1}`}
                onChange={(e) =>
                  setProvisions((prev) =>
                    prev.map((x, j) => (j === i ? e.target.value : x))
                  )
                }
              />
              {!handedIn && provisions.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remove clause ${i + 1}`}
                  onClick={() =>
                    setProvisions((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="mt-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-xl text-[#1a1a3e]/50"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}
          {!handedIn && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setProvisions((prev) => [...prev, ""])}
            >
              <Plus className="size-4" /> Add a clause
            </Button>
          )}
        </div>
      </div>

      {!handedIn && (
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={saving || isPending}
            onClick={() => save()}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Save draft"}
          </Button>
          <Button type="button" disabled={saving || isPending} onClick={handIn}>
            <Send className="size-4" /> Hand it in
          </Button>
          <span className="text-xs text-[#1a1a3e]/55">
            You can keep editing until you hand it in.
          </span>
        </div>
      )}
    </div>
  );
}
