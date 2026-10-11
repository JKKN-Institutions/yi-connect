/*
 * Browser-only: turn a phone camera photo into a small JPEG for the card
 * reader. Longest side scaled down to CARD_MAX_SIDE, JPEG quality 0.8 first,
 * then lower steps while the result is over CARD_TARGET_BYTES. Anything still
 * over CARD_MAX_BYTES is refused. Uses canvas; never call it on the server.
 *
 * The limits are passed in (defaults match lib/take-pride/cards/schemas.ts)
 * so this file has no imports and a test page can load it as-is.
 */

export type CompressedPhoto =
  | { ok: true; b64: string; bytes: number; width: number; height: number; quality: number }
  | { ok: false; error: string };

export type CompressLimits = { maxSide: number; qualities: readonly number[]; targetBytes: number; maxBytes: number };

const DEFAULTS: CompressLimits = {
  maxSide: 1280,
  qualities: [0.8, 0.7, 0.6, 0.5],
  targetBytes: 300 * 1024,
  maxBytes: 2 * 1024 * 1024,
};

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable"));
    };
    img.src = url;
  });
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", quality));
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = typeof r.result === "string" ? r.result : "";
      resolve(s.slice(s.indexOf(",") + 1));
    };
    r.onerror = () => reject(new Error("read"));
    r.readAsDataURL(blob);
  });
}

export async function compressCardPhoto(file: Blob, limits: Partial<CompressLimits> = {}): Promise<CompressedPhoto> {
  const L = { ...DEFAULTS, ...limits };
  if (!file.type.startsWith("image/")) return { ok: false, error: "That is not a photo. Take a photo of the card." };
  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return { ok: false, error: "That photo could not be opened. Take it again." };
  }
  const w0 = img.naturalWidth;
  const h0 = img.naturalHeight;
  if (!w0 || !h0) return { ok: false, error: "That photo could not be opened. Take it again." };
  const k = Math.min(1, L.maxSide / Math.max(w0, h0));
  const width = Math.max(1, Math.round(w0 * k));
  const height = Math.max(1, Math.round(h0 * k));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, error: "This phone could not prepare the photo. Try another browser." };
  // White under any transparency, so a PNG screenshot does not turn black.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  let best: Blob | null = null;
  let usedQ = L.qualities[0] ?? 0.8;
  for (const q of L.qualities) {
    const b = await toJpeg(canvas, q);
    if (!b) continue;
    best = b;
    usedQ = q;
    if (b.size <= L.targetBytes) break;
  }
  if (!best) return { ok: false, error: "This phone could not prepare the photo. Try another browser." };
  if (best.size > L.maxBytes) return { ok: false, error: "That photo is too large even after shrinking. Take it again a little further from the card." };
  const b64 = await blobToBase64(best);
  return { ok: true, b64, bytes: best.size, width, height, quality: usedQ };
}
