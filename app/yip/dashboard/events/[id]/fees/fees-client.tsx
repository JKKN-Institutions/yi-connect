"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import { Input } from "@/components/yip/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/yip/ui/table";
import {
  IndianRupee,
  CheckCircle2,
  XCircle,
  Users,
  CreditCard,
  Loader2,
  Download,
  ExternalLink,
  Search,
} from "lucide-react";
import {
  setEventPaymentConfig,
  markFeePaid,
  markFeeUnpaid,
  type ParticipantFee,
} from "@/app/actions/yip/fees";

type Participant = {
  id: string;
  full_name: string;
  school_name: string;
  class: number;
  phone: string | null;
};

type Stats = {
  total_participants: number;
  paid: number;
  unpaid: number;
  total_collected_inr: number;
  expected_inr: number;
};

export function FeesClient({
  eventId,
  eventName,
  mycii_payment_link,
  mycii_event_registered,
  fee_per_participant_inr,
  participants,
  initialFees,
  initialStats,
}: {
  eventId: string;
  eventName: string;
  mycii_payment_link: string | null;
  mycii_event_registered: boolean;
  fee_per_participant_inr: number;
  participants: Participant[];
  initialFees: ParticipantFee[];
  initialStats: Stats;
}) {
  const [fees, setFees] = useState(initialFees);
  const [stats, setStats] = useState(initialStats);
  const [link, setLink] = useState(mycii_payment_link ?? "");
  const [registered, setRegistered] = useState(mycii_event_registered);
  const [feeAmount, setFeeAmount] = useState(fee_per_participant_inr);
  const [query, setQuery] = useState("");
  const [txRef, setTxRef] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const feeById = new Map(fees.map((f) => [f.participant_id, f]));

  const filtered = participants.filter((p) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return p.full_name.toLowerCase().includes(q) || p.school_name.toLowerCase().includes(q);
  });

  function saveConfig() {
    startTransition(async () => {
      const res = await setEventPaymentConfig(eventId, link || null, registered, feeAmount);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setFlash("Payment config saved");
      setTimeout(() => setFlash(null), 2000);
    });
  }

  function togglePaid(participantId: string, currentlyPaid: boolean) {
    startTransition(async () => {
      if (currentlyPaid) {
        const res = await markFeeUnpaid(participantId, eventId);
        if (!res.success) {
          setError(res.error);
          return;
        }
        setFees((prev) =>
          prev.map((f) =>
            f.participant_id === participantId
              ? { ...f, is_paid: false, paid_at: null }
              : f
          )
        );
        setStats((s) => ({
          ...s,
          paid: s.paid - 1,
          unpaid: s.unpaid + 1,
          total_collected_inr: s.total_collected_inr - feeAmount,
        }));
      } else {
        const ref = txRef[participantId] ?? undefined;
        const res = await markFeePaid(participantId, eventId, {
          amount_inr: feeAmount,
          transaction_ref: ref,
          paid_via: "mycii",
        });
        if (!res.success) {
          setError(res.error);
          return;
        }
        const updated = res.data;
        setFees((prev) => {
          const i = prev.findIndex((f) => f.participant_id === participantId);
          if (i >= 0) {
            const next = [...prev];
            next[i] = updated;
            return next;
          }
          return [updated, ...prev];
        });
        setStats((s) => ({
          ...s,
          paid: s.paid + 1,
          unpaid: Math.max(0, s.unpaid - 1),
          total_collected_inr: s.total_collected_inr + feeAmount,
        }));
        setTxRef((prev) => ({ ...prev, [participantId]: "" }));
      }
    });
  }

  function exportCSV() {
    const headers = [
      "Name",
      "School",
      "Class",
      "Phone",
      "Paid",
      "Amount (INR)",
      "Transaction Ref",
      "Paid At",
    ];
    const rows = participants.map((p) => {
      const f = feeById.get(p.id);
      return [
        p.full_name,
        p.school_name,
        p.class,
        p.phone ?? "",
        f?.is_paid ? "YES" : "NO",
        f?.amount_inr ?? "",
        f?.transaction_ref ?? "",
        f?.paid_at ?? "",
      ];
    });
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${eventName.replace(/[^a-z0-9]/gi, "_")}_fees.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const pctCollected = stats.expected_inr > 0
    ? Math.round((stats.total_collected_inr / stats.expected_inr) * 100)
    : 0;

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1a1a3e] flex items-center gap-2">
            <IndianRupee className="size-7 text-[#FF9933]" />
            Fee Collection
          </h1>
          <p className="text-sm text-[#1a1a3e]/60 mt-1">
            {eventName} · Handbook p.9 · ₹{fee_per_participant_inr} per participant (incl GST)
          </p>
        </div>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="size-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {flash && (
        <div className="rounded-lg bg-[#138808]/8 border border-[#138808]/15 px-4 py-2 text-sm text-[#138808]">
          {flash}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total" value={stats.total_participants} color="indigo" />
        <StatCard icon={CheckCircle2} label="Paid" value={stats.paid} color="green" />
        <StatCard icon={XCircle} label="Unpaid" value={stats.unpaid} color="orange" />
        <StatCard
          icon={IndianRupee}
          label={`Collected (${pctCollected}%)`}
          value={`₹${stats.total_collected_inr.toLocaleString("en-IN")}`}
          sub={`of ₹${stats.expected_inr.toLocaleString("en-IN")} expected`}
          color="blue"
        />
      </div>

      {/* Payment Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="size-4 text-[#1a1a3e]/70" />
            MyCII Payment Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-[#1a1a3e]/70">
                MyCII Payment Link
              </label>
              <Input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://mycii.in/..."
              />
              {link && (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#FF9933] hover:underline mt-1"
                >
                  Test link <ExternalLink className="size-3" />
                </a>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-[#1a1a3e]/70">Fee (INR)</label>
              <Input
                type="number"
                value={feeAmount}
                onChange={(e) => setFeeAmount(parseInt(e.target.value) || 399)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="mycii_registered"
              checked={registered}
              onChange={(e) => setRegistered(e.target.checked)}
              className="size-4"
            />
            <label htmlFor="mycii_registered" className="text-sm">
              Event registered on MyCII
            </label>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={saveConfig}
              disabled={pending}
              className="bg-[#FF9933] hover:bg-[#FF9933]/90 text-white"
            >
              {pending && <Loader2 className="size-4 mr-2 animate-spin" />}
              Save Config
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#1a1a3e]/40" />
        <Input
          placeholder="Search participants…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Participants x fees table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Participant</TableHead>
                <TableHead>School</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Transaction Ref</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-sm text-[#1a1a3e]/50">
                    {participants.length === 0 ? "No participants yet" : "No matches"}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((p) => {
                const f = feeById.get(p.id);
                const paid = f?.is_paid ?? false;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{p.full_name}</div>
                      <div className="text-xs text-[#1a1a3e]/60">Class {p.class}</div>
                    </TableCell>
                    <TableCell className="text-sm text-[#1a1a3e]/70">
                      {p.school_name}
                    </TableCell>
                    <TableCell>
                      {paid ? (
                        <Badge className="bg-[#138808]/10 text-[#138808] border-[#138808]/20 text-[10px]">
                          <CheckCircle2 className="size-3 mr-1" />
                          Paid
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-[#1a1a3e]/60">
                          Unpaid
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {paid ? (
                        <span className="text-xs font-mono text-[#1a1a3e]/60">
                          {f?.transaction_ref ?? "—"}
                        </span>
                      ) : (
                        <Input
                          value={txRef[p.id] ?? ""}
                          onChange={(e) =>
                            setTxRef({ ...txRef, [p.id]: e.target.value })
                          }
                          placeholder="Optional ref / UTR"
                          className="h-8 text-xs"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant={paid ? "outline" : "default"}
                        onClick={() => togglePaid(p.id, paid)}
                        disabled={pending}
                        className={
                          paid
                            ? "text-[#1a1a3e]/60"
                            : "bg-[#138808] hover:bg-[#138808]/90 text-white"
                        }
                      >
                        {paid ? "Undo" : "Mark Paid"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  sub?: string;
  color: "green" | "orange" | "indigo" | "blue";
}) {
  const map = {
    green: { bg: "bg-[#138808]/10", text: "text-[#138808]" },
    orange: { bg: "bg-[#FF9933]/10", text: "text-[#FF9933]" },
    indigo: { bg: "bg-indigo-50", text: "text-indigo-600" },
    blue: { bg: "bg-blue-50", text: "text-blue-600" },
  }[color];

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-3">
          <div className={`size-9 rounded-lg ${map.bg} flex items-center justify-center`}>
            <Icon className={`size-5 ${map.text}`} />
          </div>
          <div>
            <div className="text-lg font-bold text-[#1a1a3e]">{value}</div>
            <div className="text-xs text-[#1a1a3e]/60">{label}</div>
            {sub && <div className="text-[10px] text-[#1a1a3e]/40">{sub}</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
