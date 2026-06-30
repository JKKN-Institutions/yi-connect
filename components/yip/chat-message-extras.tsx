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
import { Reply, SmilePlus, X, Pin, Search, Loader2, AtSign } from "lucide-react";
import { cn } from "@/lib/yip/utils";
import { CHAT_REACTION_EMOJIS } from "@/lib/yip/chat-reactions";
import type {
  ChatMessage,
  ChatMember,
  ChatReactionSummary,
  ChatReplyPreview,
} from "@/app/yip/actions/chat";

type Tone = "light" | "accent";

/** Render a message body with @mentions highlighted. */
export function MessageBody({
  body,
  mentionsMe,
}: {
  body: string;
  mentionsMe?: boolean;
}) {
  const parts = body.split(/(@[\p{L}][\p{L}\d._]*)/u);
  return (
    <>
      {mentionsMe && (
        <span className="mr-1 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 align-middle text-[9px] font-semibold uppercase tracking-wide text-amber-700">
          mentions you
        </span>
      )}
      {parts.map((p, i) =>
        /^@[\p{L}]/u.test(p) ? (
          <span key={i} className="font-semibold text-blue-600">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

/**
 * Textarea with an inline @-mention picker. Detects a trailing "@fragment",
 * shows matching members, and on pick inserts "@FirstName " and records the id.
 * Enter sends (onSubmit) unless the picker is open, where it picks the top match.
 */
export function MentionInput({
  value,
  onChange,
  members,
  onAddMention,
  onSubmit,
  placeholder,
  disabled,
  rows = 1,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  members: ChatMember[];
  onAddMention: (id: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [frag, setFrag] = useState("");

  function handleChange(v: string) {
    onChange(v);
    const m = v.match(/@([\p{L}\d._]*)$/u);
    if (m) {
      setFrag(m[1].toLowerCase());
      setOpen(true);
    } else {
      setOpen(false);
    }
  }

  const filtered =
    members.length > 0
      ? members.filter((mm) => mm.name.toLowerCase().includes(frag)).slice(0, 6)
      : [];

  function pick(member: ChatMember) {
    const replaced = value.replace(
      /@([\p{L}\d._]*)$/u,
      "@" + member.name.split(" ")[0] + " "
    );
    onChange(replaced);
    onAddMention(member.id);
    setOpen(false);
  }

  return (
    <div className="relative flex-1">
      {open && filtered.length > 0 && (
        <div className="absolute bottom-full z-30 mb-1 max-h-48 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => pick(m)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50"
            >
              <AtSign className="size-3.5 text-gray-400" />
              {m.name}
            </button>
          ))}
        </div>
      )}
      <textarea
        value={value}
        rows={rows}
        disabled={disabled}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            return;
          }
          if (e.key === "Enter" && !e.shiftKey) {
            if (open && filtered.length > 0) {
              e.preventDefault();
              pick(filtered[0]);
              return;
            }
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder={placeholder}
        className={
          className ??
          "max-h-32 w-full resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-[#FF9933] focus:outline-none focus:ring-1 focus:ring-[#FF9933]"
        }
      />
    </div>
  );
}

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

function formatMsgTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * Per-channel message search. Drops into a channel header; expands to an input
 * + a results panel. The caller supplies the gated search action and (optionally)
 * a name resolver so results can show who said it.
 */
export function ChannelSearch({
  onSearch,
  nameOf,
}: {
  onSearch: (query: string) => Promise<ChatMessage[]>;
  nameOf?: (m: ChatMessage) => string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ChatMessage[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      setResults(await onSearch(query));
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setOpen(false);
    setQ("");
    setResults(null);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex size-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
        aria-label="Search messages"
      >
        <Search className="size-4" />
      </button>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 px-3 py-1.5">
          <Search className="size-4 shrink-0 text-gray-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                run();
              }
              if (e.key === "Escape") close();
            }}
            placeholder="Search messages…"
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
          {loading && <Loader2 className="size-4 animate-spin text-gray-400" />}
        </div>
        <button
          type="button"
          onClick={close}
          className="flex size-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
          aria-label="Close search"
        >
          <X className="size-4" />
        </button>
      </div>

      {results !== null && (
        <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-gray-100 bg-white">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-gray-400">
              {q.trim().length < 2
                ? "Type at least 2 characters."
                : "No messages found."}
            </p>
          ) : (
            results.map((m) => (
              <div
                key={m.id}
                className="border-b border-gray-50 px-3 py-2 last:border-0"
              >
                <div className="mb-0.5 flex items-center gap-2 text-[10px] text-gray-400">
                  {nameOf && <span className="font-medium">{nameOf(m)}</span>}
                  <span>{formatMsgTime(m.createdAt)}</span>
                </div>
                <p className="line-clamp-2 text-xs text-gray-700">{m.body}</p>
              </div>
            ))
          )}
        </div>
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
