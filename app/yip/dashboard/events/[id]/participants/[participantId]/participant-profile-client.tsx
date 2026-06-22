"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import { Badge } from "@/components/yip/ui/badge";
import { ROLE_LABELS, PARTY_COLORS } from "@/lib/yip/constants";
import { committeeLabel } from "@/lib/yip/committee-label";
import {
  ArrowLeft,
  GraduationCap,
  Phone,
  Mail,
  Users2,
  Landmark,
  MapPin,
  BadgeCheck,
  Layers,
  KeyRound,
  CircleUserRound,
  ClipboardList,
} from "lucide-react";
import type { ParticipantProfile } from "@/app/yip/actions/participant-profile";

const LEVEL_LABEL: Record<string, string> = {
  chapter: "Chapter",
  regional: "Regional",
  national: "National",
};

function titleize(v: string | null | undefined): string {
  if (!v) return "—";
  return v
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function ParticipantProfileClient({
  eventId,
  eventName,
  profile,
}: {
  eventId: string;
  eventName: string;
  profile: ParticipantProfile;
}) {
  const { participant: p, contestant, crossLevel, canManage } = profile;
  const place = [p.city, p.home_state].filter(Boolean).join(", ");
  const partyClass =
    p.party_side
      ? PARTY_COLORS[p.party_side as keyof typeof PARTY_COLORS]?.badge ??
        "bg-gray-100 text-gray-700"
      : "";

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-6 space-y-6">
      {/* Back */}
      <Link
        href={`/yip/dashboard/events/${eventId}/participants`}
        className="inline-flex items-center gap-1.5 text-sm text-[#1a1a3e]/60 hover:text-[#1a1a3e]"
      >
        <ArrowLeft className="size-4" />
        Back to participants
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4 min-w-0">
          {contestant?.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={contestant.photo_url}
              alt={p.full_name}
              className="size-16 rounded-full object-cover border border-[#1a1a3e]/10"
            />
          ) : (
            <div className="size-16 rounded-full bg-gradient-to-br from-[#FF9933] to-[#E68A2E] flex items-center justify-center text-white text-xl font-bold shrink-0">
              {p.full_name
                .split(" ")
                .slice(0, 2)
                .map((s) => s[0])
                .join("")}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[#1a1a3e] tracking-tight truncate">
              {p.serial_no ? `#${p.serial_no} · ` : ""}
              {p.full_name}
            </h1>
            <p className="text-sm text-[#1a1a3e]/60 mt-0.5">
              {eventName}
              {p.constituency_name ? ` · ${p.constituency_name}` : ""}
            </p>
          </div>
        </div>
        <div className="sm:ml-auto flex items-center gap-2">
          {p.checked_in ? (
            <Badge className="bg-[#138808]/10 text-[#138808] border-[#138808]/20">
              Checked in
            </Badge>
          ) : (
            <Badge className="bg-[#1a1a3e]/5 text-[#1a1a3e]/50 border-[#1a1a3e]/10">
              Not checked in
            </Badge>
          )}
          {p.qualified_for_next && (
            <Badge className="bg-[#FF9933]/10 text-[#E68A2E] border-[#FF9933]/25">
              Qualified for next level
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-[#1a1a3e]/70 flex items-center gap-2">
              <GraduationCap className="size-4 text-[#FF9933]" /> Identity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            {/* School + class are collected only to balance allocation and are
                never shown in the platform (purged after the one-time export). */}
            <Row label="Place" value={place || null} />
            {contestant?.bio && (
              <div className="pt-1">
                <div className="text-[11px] uppercase tracking-wider text-[#1a1a3e]/45">
                  Bio
                </div>
                <p className="text-[#1a1a3e]/80 mt-0.5">{contestant.bio}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-[#1a1a3e]/70 flex items-center gap-2">
              <Phone className="size-4 text-[#FF9933]" /> Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <Row label="Phone" value={p.phone} icon={<Phone className="size-3.5" />} />
            <Row label="Email" value={p.email} icon={<Mail className="size-3.5" />} />
            <Row
              label="Parent phone"
              value={p.parent_phone}
              icon={<Users2 className="size-3.5" />}
            />
          </CardContent>
        </Card>

        {/* Parliament */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-[#1a1a3e]/70 flex items-center gap-2">
              <Landmark className="size-4 text-[#FF9933]" /> Parliament
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[#1a1a3e]/55">Party</span>
              {p.party_side ? (
                <Badge variant="secondary" className={partyClass}>
                  {p.party_side === "ruling" ? "Ruling" : "Opposition"}
                </Badge>
              ) : (
                <span className="text-[#1a1a3e]/40">—</span>
              )}
            </div>
            <Row
              label="Role"
              value={
                p.parliament_role
                  ? ROLE_LABELS[p.parliament_role] ?? titleize(p.parliament_role)
                  : null
              }
            />
            <Row label="Ministry" value={p.ministry ? titleize(p.ministry) : null} />
            <Row
              label="Constituency"
              value={
                p.constituency_name
                  ? `${p.constituency_name}${
                      p.constituency_state ? ` · ${p.constituency_state}` : ""
                    }`
                  : null
              }
              icon={<MapPin className="size-3.5" />}
            />
            <Row
              label="Committee"
              value={
                (p as { committee_name?: string | null }).committee_name ??
                committeeLabel(
                  (p as { committee_number?: number | null }).committee_number
                )
              }
            />
          </CardContent>
        </Card>

        {/* Status & access */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-[#1a1a3e]/70 flex items-center gap-2">
              <BadgeCheck className="size-4 text-[#FF9933]" /> Status & access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <Row
              label="Check-in"
              value={
                p.checked_in
                  ? p.checked_in_at
                    ? `In · ${new Date(p.checked_in_at).toLocaleString()}`
                    : "In"
                  : "Out"
              }
            />
            <div className="flex items-center justify-between">
              <span className="text-[#1a1a3e]/55 flex items-center gap-1.5">
                <KeyRound className="size-3.5" /> Access code
              </span>
              <code className="rounded bg-[#1a1a3e]/5 px-2 py-0.5 text-xs font-mono text-[#1a1a3e]">
                {p.access_code ?? "—"}
              </code>
            </div>
            {canManage && (
              <Link
                href={`/yip/dashboard/events/${eventId}/scoring/${p.id}`}
                className="inline-flex items-center gap-1.5 text-sm text-[#FF9933] hover:text-[#E68A2E] pt-1"
              >
                <ClipboardList className="size-4" /> View scoring detail
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Across levels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-[#1a1a3e]/70 flex items-center gap-2">
            <Layers className="size-4 text-[#FF9933]" /> Across levels
          </CardTitle>
        </CardHeader>
        <CardContent>
          {crossLevel.length === 0 ? (
            <p className="text-sm text-[#1a1a3e]/50 flex items-center gap-2">
              <CircleUserRound className="size-4 text-[#1a1a3e]/30" />
              {contestant
                ? "No other events linked to this student yet."
                : "This roster entry isn't linked to a cross-level profile yet."}
            </p>
          ) : (
            <div className="divide-y divide-[#1a1a3e]/5">
              {crossLevel.map((c) => (
                <Link
                  key={c.participant_id}
                  href={`/yip/dashboard/events/${c.event_id}/participants/${c.participant_id}`}
                  className="flex items-center gap-3 py-3 hover:bg-[#1a1a3e]/[0.015] -mx-2 px-2 rounded-md transition-colors"
                >
                  <Badge className="bg-[#1a1a3e]/5 text-[#1a1a3e]/70 border border-[#1a1a3e]/10 text-[10px] shrink-0">
                    {c.level ? LEVEL_LABEL[c.level] ?? c.level : "Event"}
                  </Badge>
                  <span className="font-medium text-[#1a1a3e] truncate flex-1">
                    {c.event_name}
                  </span>
                  <span className="text-xs text-[#1a1a3e]/55">
                    {c.parliament_role
                      ? ROLE_LABELS[c.parliament_role] ?? titleize(c.parliament_role)
                      : "—"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | null | undefined;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[#1a1a3e]/55 flex items-center gap-1.5 shrink-0">
        {icon}
        {label}
      </span>
      <span className="text-[#1a1a3e] text-right truncate">{value || "—"}</span>
    </div>
  );
}
