/** Chapter name -> who on this recognition calls it home, e.g. "Omkar Sambary (NMT)". */
export type HomeNotes = Record<string, string[]>;

/**
 * "Home chapter of …" under a chapter's name (Piyush, 28 Oct): the evaluator
 * still scores it; the note is information for everyone reviewing the marks.
 */
export function HomeNote({ names }: { names?: string[] }) {
  if (!names || names.length === 0) return null;
  return <div className="rx-small rx-home-note">Home chapter of {names.join(", ")}</div>;
}
