import Image from "next/image";

/**
 * Renders a track icon — either a Next.js Image (when the icon is a path
 * starting with `/`) or a plain emoji/text span.
 */
export function TrackIcon({
  icon,
  name,
  size = 48,
  className = "",
}: {
  icon: string | null | undefined;
  name?: string;
  /** Width & height in px for image icons (default 48) */
  size?: number;
  className?: string;
}) {
  if (icon?.startsWith("/")) {
    return (
      <Image
        src={icon}
        alt={name ?? "track icon"}
        width={size}
        height={size}
        className={`object-contain ${className}`}
      />
    );
  }
  return <span className={className}>{icon ?? "•"}</span>;
}

/**
 * Returns the track icon as a plain string for contexts that cannot render
 * images (e.g. `<option>` elements, PDF text nodes). Image paths are replaced
 * with the bullet character.
 */
export function trackIconText(icon: string | null | undefined): string {
  if (!icon) return "•";
  if (icon.startsWith("/")) return "•";
  return icon;
}
