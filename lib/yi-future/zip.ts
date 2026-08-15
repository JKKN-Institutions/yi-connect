/**
 * Minimal ZIP writer — stored (uncompressed) entries only.
 *
 * WHY NOT A LIBRARY
 * `archiver` resolves in node_modules today but ONLY as a transitive
 * dependency of something else; it is not in package.json. Building a
 * user-facing download on that means the feature breaks the first time an
 * unrelated `npm install` re-resolves the tree. Adding a dependency for this
 * is the alternative, and it is not worth it here: every format we accept
 * (PDF, DOCX, PPTX) is ALREADY a compressed container, so deflating them again
 * buys a percent or two for a large amount of machinery.
 *
 * The format below is the documented ZIP layout (APPNOTE 6.3.2), stored mode:
 *   [local header + data] × n  ·  [central directory record] × n  ·  [EOCD]
 *
 * Zip64 is deliberately NOT implemented — a bundle over 4GB, or one entry over
 * 4GB, must not be produced silently, so buildZip throws instead.
 */

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export type ZipEntry = {
  /** Path inside the archive; forward slashes make folders. */
  name: string;
  data: Uint8Array;
};

/** 32-bit ceiling of the classic (non-Zip64) format. */
const MAX_ZIP_BYTES = 0xffffffff;

export function buildZip(entries: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  // Deduplicate names: two teams can easily both submit "policy.pdf", and a
  // ZIP with repeated paths silently loses entries in most extractors.
  const used = new Set<string>();

  for (const entry of entries) {
    let name = entry.name;
    if (used.has(name)) {
      const dot = name.lastIndexOf(".");
      const stem = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : "";
      let n = 2;
      while (used.has(`${stem} (${n})${ext}`)) n++;
      name = `${stem} (${n})${ext}`;
    }
    used.add(name);

    const nameBytes = enc.encode(name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    if (size > MAX_ZIP_BYTES) {
      throw new Error(
        `"${name}" is larger than 4GB, which this archive format cannot hold.`
      );
    }

    // ── Local file header ────────────────────────────────────────────
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // flags: UTF-8 names
    lv.setUint16(8, 0, true); // method 0 = stored
    lv.setUint16(10, 0, true); // mod time
    lv.setUint16(12, 0, true); // mod date
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true); // compressed size
    lv.setUint32(22, size, true); // uncompressed size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // extra length
    local.set(nameBytes, 30);

    locals.push(local, entry.data);

    // ── Central directory record ─────────────────────────────────────
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true); // extra
    cv.setUint16(32, 0, true); // comment
    cv.setUint16(34, 0, true); // disk number
    cv.setUint16(36, 0, true); // internal attrs
    cv.setUint32(38, 0, true); // external attrs
    cv.setUint32(42, offset, true); // offset of local header
    central.set(nameBytes, 46);
    centrals.push(central);

    offset += local.length + size;
    if (offset > MAX_ZIP_BYTES) {
      throw new Error(
        "That selection is larger than 4GB. Download one chapter at a time."
      );
    }
  }

  const centralSize = centrals.reduce((n, c) => n + c.length, 0);

  // ── End of central directory ───────────────────────────────────────
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, centrals.length, true);
  ev.setUint16(10, centrals.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const total =
    locals.reduce((n, b) => n + b.length, 0) + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const b of locals) {
    out.set(b, p);
    p += b.length;
  }
  for (const c of centrals) {
    out.set(c, p);
    p += c.length;
  }
  out.set(eocd, p);
  return out;
}
