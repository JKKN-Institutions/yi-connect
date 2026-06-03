"use client";

import { ROLE_LABELS, ROLE_COLORS, PARTY_COLORS } from "@/lib/yip/constants";
import { FileEdit, CheckCircle2, Lock, Clock } from "lucide-react";

interface ScoreCardProps {
  participantName: string;
  // Optional constituency line shown under the participant name/number.
  constituency?: string | null;
  parliamentRole: string | null;
  partySide: string | null;
  totalScore: number;
  maxScore: number;
  status: string | null;
  updatedAt: string | null;
  onClick?: () => void;
}

export function ScoreCard({
  participantName,
  constituency,
  parliamentRole,
  partySide,
  totalScore,
  maxScore,
  status,
  updatedAt,
  onClick,
}: ScoreCardProps) {
  const roleLabel = parliamentRole
    ? ROLE_LABELS[parliamentRole] ?? parliamentRole
    : "Participant";
  const roleColor = parliamentRole
    ? ROLE_COLORS[parliamentRole] ?? "bg-gray-500 text-white"
    : "bg-gray-500 text-white";
  const partyColor = partySide
    ? PARTY_COLORS[partySide as keyof typeof PARTY_COLORS]
    : null;

  const statusConfig = {
    draft: {
      icon: FileEdit,
      label: "Draft",
      color: "text-amber-600 bg-amber-50 border-amber-200",
    },
    submitted: {
      icon: CheckCircle2,
      label: "Submitted",
      color: "text-green-600 bg-green-50 border-green-200",
    },
    locked: {
      icon: Lock,
      label: "Locked",
      color: "text-gray-600 bg-gray-50 border-gray-200",
    },
  };

  const st = statusConfig[status as keyof typeof statusConfig] ?? statusConfig.draft;
  const StatusIcon = st.icon;

  const formattedTime = updatedAt
    ? new Date(updatedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const pct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={`${participantName}${onClick ? " — tap to edit score" : ""}`}
      className={`w-full text-left rounded-xl border-2 p-4 transition-all touch-manipulation
        ${partyColor ? `${partyColor.bg} ${partyColor.border}` : "bg-white border-gray-200"}
        ${onClick ? "active:scale-[0.98] hover:shadow-md cursor-pointer" : "cursor-default"}
      `}
      style={{ minHeight: onClick ? "72px" : undefined }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-900 truncate">{participantName}</h3>
          {constituency && (
            <p className="text-xs text-gray-500 truncate mt-0.5">{constituency}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${roleColor}`}>
              {roleLabel}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${st.color}`}>
              <StatusIcon className="size-3 inline mr-1" />
              {st.label}
            </span>
          </div>
        </div>

        {/* Score Circle */}
        <div className="shrink-0 flex flex-col items-center">
          <div className="relative size-14 flex items-center justify-center">
            <svg className="absolute inset-0 size-14" viewBox="0 0 56 56">
              <circle
                cx="28"
                cy="28"
                r="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-gray-200"
              />
              <circle
                cx="28"
                cy="28"
                r="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeDasharray={`${(pct / 100) * 150.8} 150.8`}
                strokeLinecap="round"
                transform="rotate(-90 28 28)"
                className="text-blue-600 transition-all duration-300"
              />
            </svg>
            <span className="text-sm font-bold text-gray-900 tabular-nums">{totalScore}</span>
          </div>
          <span className="text-[10px] text-gray-400 mt-0.5">/{maxScore}</span>
        </div>
      </div>

      {/* Timestamp */}
      {formattedTime && (
        <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
          <Clock className="size-3" />
          {formattedTime}
        </div>
      )}
    </button>
  );
}
