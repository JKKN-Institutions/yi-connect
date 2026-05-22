export type HeroVariant = "a" | "b";

export const HERO_HEADLINES: Record<
  HeroVariant,
  { line1: string; line2: string; accent: "gold" | "saffron" }
> = {
  a: {
    line1: "Pick a problem.",
    line2: "Change a country.",
    accent: "gold",
  },
  b: {
    line1: "Turn opinions into policy.",
    line2: "In 90 days.",
    accent: "saffron",
  },
};

const COOKIE_NAME = "yifuture_hero_variant";

export function getHeroVariant(): HeroVariant {
  if (typeof document === "undefined") {
    // Server-side: always return default variant
    return "a";
  }

  // Parse existing cookie
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(COOKIE_NAME + "="));

  if (match) {
    const value = match.split("=")[1];
    if (value === "a" || value === "b") {
      return value;
    }
  }

  // Coin-flip and persist for 30 days
  const variant: HeroVariant = Math.random() < 0.5 ? "a" : "b";
  document.cookie = `${COOKIE_NAME}=${variant}; path=/; max-age=2592000`;
  return variant;
}
