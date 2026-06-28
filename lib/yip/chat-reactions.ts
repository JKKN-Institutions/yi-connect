// Allowed reaction emojis for YIP chat (whitelist — keeps the stored value
// small + predictable, and the picker consistent). Client- and server-safe:
// this is a plain module (NOT "use server"), so both the gated chat actions
// and the chat UI import it.
export const CHAT_REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "👏", "🙏"] as const;

export type ChatReactionEmoji = (typeof CHAT_REACTION_EMOJIS)[number];

export function isAllowedReaction(emoji: string): emoji is ChatReactionEmoji {
  return (CHAT_REACTION_EMOJIS as readonly string[]).includes(emoji);
}
