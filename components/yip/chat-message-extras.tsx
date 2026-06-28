"use client";

/**
 * Shared WhatsApp-style message extras for the YIP chat surfaces
 * (app/yip/me/chat + app/yip/me/committee). Drop-in, layout-agnostic:
 *   • ReplyQuote   — the quoted snippet (in a bubble, or above the composer).
 *   • ReactionChips — the row of emoji+count chips under a message.
 *   • MessageActions — a tiny Reply / React toolbar with an emoji popover.
 *
 * `tone` lets the same component sit on an accent (own) bubble or a light bubble.
 */

import { useState } from "react";
import { Reply, SmilePlus, X, Pin } from "lucide-react";
import { cn } from "@/lib/yip/utils";
import { CHAT_REACTION_EMOJIS } from "@/lib/yip/chat-reactions";
import type {
  ChatMessage,
  ChatReactionSummary,
  ChatReplyPreview,
} from "@/app/yip/actions/chat";

type Tone = "light" | "accent";

/** Banner shown at the top of a channel with the organiser's pinned message(s). */
export function PinnedBanner({ pinned }: { pinned: ChatMessage[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!pinned || pinned.length === 0) return null;
  const shown = expanded ? pinned : pinned.slice(0, 1);
  return (
    <div className="mb-2 rounded-lg border border-[#FF9933]/30 bg-[#FF9933]/5 px-3 py-2">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#b5651d]">
        <Pin className="size-3" />
        Pinned{pinned.length > 1 ? ` · ${pinned.length}` : ""}
      </div>
      <div className="space-y-1">
        {shown.map((m) => (
          <p key={m.id} className="line-clamp-2 text-xs text-gray-700">
            {m.body}
          </p>
        ))}
      </div>
      {pinned.length > 1 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[11px] font-medium text-[#FF9933] hover:underline"
        >
          {expanded ? "Show less" : `Show ${pinned.length - 1} more`}
        </button>
      )}
    </div>
  );
}

export function ReplyQuote({
  preview,
  tone = "light",
  onCancel,
}: {
  preview: ChatReplyPreview;
  tone?: Tone;
  onCancel?: () => void;
}) {
  const accent = tone === "accent";
  return (
    <div
      className={cn(
        "mb-1 flex items-start gap-2 rounded-md border-l-2 px-2 py-1 text-xs",
        accent
          ? "border-white/70 bg-white/15 text-white/90"
          : "border-[#FF9933] bg-black/[0.03] text-gray-600"
      )}
    >
      <div className="min-w-0 flex-1">
        <span className="block font-medium">
          {preview.deleted ? "Message" : preview.senderName}
        </span>
        <span className="block truncate opacity-80">
          {preview.deleted ? "This message was removed" : preview.body}
        </span>
      </div>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel reply"
          className="shrink-0 rounded-full p-0.5 opacity-70 hover:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function ReactionChips({
  reactions,
  onToggle,
  disabled,
}: {
  reactions: ChatReactionSummary[];
  onToggle: (emoji: string) => void;
  disabled?: boolean;
}) {
  if (!reactions || reactions.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          disabled={disabled}
          onClick={() => onToggle(r.emoji)}
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] leading-none transition-colors disabled:opacity-50",
            r.mine
              ? "border-[#FF9933] bg-[#FF9933]/10 text-[#b5651d]"
              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          )}
          aria-pressed={r.mine}
          aria-label={`${r.emoji} ${r.count}`}
        >
          <span>{r.emoji}</span>
          <span className="tabular-nums">{r.count}</span>
        </button>
      ))}
    </div>
  );
}

export function MessageActions({
  tone = "light",
  onReply,
  onReact,
  align = "start",
}: {
  tone?: Tone;
  /** Omit to hide the reply button (e.g. DM threads). */
  onReply?: () => void;
  onReact: (emoji: string) => void;
  /** Which side the emoji popover opens toward. */
  align?: "start" | "end";
}) {
  const [picking, setPicking] = useState(false);
  const accent = tone === "accent";
  const iconBtn = cn(
    "flex size-6 items-center justify-center rounded-full transition-colors",
    accent
      ? "text-white/80 hover:bg-white/20"
      : "text-gray-400 hover:bg-black/5 hover:text-gray-600"
  );

  return (
    <div className="relative flex items-center gap-0.5">
      {onReply && (
        <button type="button" onClick={onReply} className={iconBtn} aria-label="Reply">
          <Reply className="size-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={() => setPicking((v) => !v)}
        className={iconBtn}
        aria-label="Add reaction"
        aria-expanded={picking}
      >
        <SmilePlus className="size-3.5" />
      </button>
      {picking && (
        <>
          {/* click-away */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setPicking(false)}
            aria-hidden
          />
          <div
            className={cn(
              "absolute bottom-7 z-20 flex gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 shadow-lg",
              align === "end" ? "right-0" : "left-0"
            )}
          >
            {CHAT_REACTION_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  onReact(e);
                  setPicking(false);
                }}
                className="rounded-full p-0.5 text-base leading-none hover:bg-gray-100"
                aria-label={`React ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
