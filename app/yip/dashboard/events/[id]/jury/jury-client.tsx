"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addJury, removeJury } from "@/app/yip/actions/jury";
import { Button } from "@/components/yip/ui/button";
import { Input } from "@/components/yip/ui/input";
import { Label } from "@/components/yip/ui/label";
import { Badge } from "@/components/yip/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/yip/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/yip/ui/table";
import {
  Plus,
  Trash2,
  Copy,
  Check,
  Scale,
  Loader2,
  CalendarClock,
  Link2,
} from "lucide-react";

type JuryAssignment = {
  id: string;
  jury_name: string;
  access_code: string;
  is_active: boolean | null;
  created_at: string | null;
  email?: string | null;
};

export function JuryClient({
  eventId,
  jury: initialJury,
}: {
  eventId: string;
  jury: JuryAssignment[];
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [juryName, setJuryName] = useState("");
  const [juryEmail, setJuryEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Absolute jury access URL (the access-code entry that routes jurors to
  // /yip/jury). Resolved client-side so it's correct on prod / preview / local.
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const juryUrl = origin ? `${origin}/yip/join` : "/yip/join";

  async function handleAddJury() {
    if (!juryName.trim()) {
      setError("Jury name is required");
      return;
    }

    setLoading(true);
    setError("");

    const result = await addJury(
      eventId,
      juryName.trim(),
      juryEmail.trim() || null
    );

    if (result.success) {
      setDialogOpen(false);
      setJuryName("");
      setJuryEmail("");
      router.refresh();
    } else {
      setError(result.error);
    }
    setLoading(false);
  }

  async function handleRemove(juryId: string) {
    if (!confirm("Are you sure you want to remove this jury member?")) return;

    const result = await removeJury(juryId, eventId);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error);
    }
  }

  function handleCopy(code: string, id: string) {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleCopyUrl() {
    navigator.clipboard.writeText(`${window.location.origin}/yip/join`);
    setCopiedId("__url__");
    setTimeout(() => setCopiedId(null), 2000);
  }

  // Copy the full handout for one juror: link + their access code.
  function handleCopyLink(j: JuryAssignment) {
    navigator.clipboard.writeText(
      `${window.location.origin}/yip/join\nAccess code: ${j.access_code}`
    );
    setCopiedId(`${j.id}:link`);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Per-session panels (BUG-385): assign which juror scores which session */}
      <Link
        href={`/yip/dashboard/events/${eventId}/jury/sessions`}
        className="flex items-center justify-between rounded-lg border border-[#FF9933]/30 bg-[#FF9933]/5 px-4 py-2.5 text-sm font-medium text-[#994d00] hover:bg-[#FF9933]/10"
      >
        <span className="inline-flex items-center gap-2">
          <CalendarClock className="size-4" />
          Assign jurors to sessions
        </span>
        <span aria-hidden>→</span>
      </Link>

      {/* Jury access link — share with jurors at event time alongside their code */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-[#1a1a3e]/10 bg-white px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#1a1a3e]/55">
            Jury access link
          </p>
          <code className="block truncate text-sm font-mono text-[#1a1a3e]">
            {juryUrl}
          </code>
          <p className="mt-0.5 text-xs text-[#1a1a3e]/45">
            Jurors open this link and enter their access code (below) to start
            scoring.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyUrl}
          className="shrink-0"
        >
          {copiedId === "__url__" ? (
            <Check className="size-4 text-green-600" />
          ) : (
            <Copy className="size-4" />
          )}
          {copiedId === "__url__" ? "Copied" : "Copy link"}
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Jury Members ({initialJury.length})
        </h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button className="bg-[#FF9933] text-white hover:bg-[#E68A2E]" size="sm" />
            }
          >
            <Plus className="size-4" />
            Add Jury
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Add Jury Member</DialogTitle>
              <DialogDescription>
                An access code will be generated automatically
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <div>
              <Label htmlFor="jury-name">Jury Name *</Label>
              <Input
                id="jury-name"
                value={juryName}
                onChange={(e) => {
                  setJuryName(e.target.value);
                  setError("");
                }}
                placeholder="e.g., Judge Rajesh Kumar"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddJury();
                }}
              />
            </div>
            <div>
              <Label htmlFor="jury-email">Email (optional)</Label>
              <Input
                id="jury-email"
                type="email"
                value={juryEmail}
                onChange={(e) => {
                  setJuryEmail(e.target.value);
                  setError("");
                }}
                placeholder="rajesh@example.com (optional, for records)"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddJury();
                }}
              />
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button
                className="bg-[#FF9933] text-white hover:bg-[#E68A2E]"
                onClick={handleAddJury}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                {loading ? "Adding..." : "Add Jury"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Jury Table */}
      {initialJury.length > 0 ? (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Access Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialJury.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-medium">{j.jury_name}</TableCell>
                  <TableCell className="text-xs text-gray-600">
                    {j.email ?? <span className="text-gray-300">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono">
                        {j.access_code}
                      </code>
                      <button
                        onClick={() => handleCopy(j.access_code, j.id)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title="Copy code only"
                      >
                        {copiedId === j.id ? (
                          <Check className="size-3 text-green-500" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </button>
                      <button
                        onClick={() => handleCopyLink(j)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title="Copy access link + code"
                      >
                        {copiedId === `${j.id}:link` ? (
                          <Check className="size-3 text-green-500" />
                        ) : (
                          <Link2 className="size-3" />
                        )}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        j.is_active !== false
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }
                    >
                      {j.is_active !== false ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleRemove(j.id)}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      title="Remove jury"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-white py-16 text-center">
          <Scale className="mb-4 size-12 text-gray-300" />
          <h3 className="text-sm font-medium text-gray-700">
            No jury members yet
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            Add jury members who will evaluate the participants
          </p>
        </div>
      )}
    </div>
  );
}
