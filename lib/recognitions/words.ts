/** Word counting shared by the browser meters and the server validators. */
export function countWords(text: string | null | undefined): number {
  const t = (text ?? "").trim();
  if (t === "") return 0;
  return t.split(/\s+/).length;
}

export function withinWords(text: string | null | undefined, limit: number): boolean {
  return countWords(text) <= limit;
}
