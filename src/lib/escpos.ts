// Minimal ESC/POS encoder for 58/80mm thermal printers with CP737 (Greek) support.
// Atomic chunks so BLE/USB writers never split multi-byte commands.

export type EscPosWidth = 58 | 80;
export type EscPosAlign = 'left' | 'center' | 'right';

const ESC = 0x1b;
const GS = 0x1d;

/** Columns at font-A for each paper width. */
export const ESCPOS_COLS: Record<EscPosWidth, number> = {
  58: 32,
  80: 42,
};

/**
 * IBM Code page 737 (OEM Greek) — correct mapping.
 * 0x80–0x97 capital, 0x98–0xAF lowercase (+ ω at 0xE0).
 * @see https://en.wikipedia.org/wiki/Code_page_737
 */
const CP737: Record<number, number> = {
  0x0391: 0x80, // Α
  0x0392: 0x81, // Β
  0x0393: 0x82, // Γ
  0x0394: 0x83, // Δ
  0x0395: 0x84, // Ε
  0x0396: 0x85, // Ζ
  0x0397: 0x86, // Η
  0x0398: 0x87, // Θ
  0x0399: 0x88, // Ι
  0x039a: 0x89, // Κ
  0x039b: 0x8a, // Λ
  0x039c: 0x8b, // Μ
  0x039d: 0x8c, // Ν
  0x039e: 0x8d, // Ξ
  0x039f: 0x8e, // Ο
  0x03a0: 0x8f, // Π
  0x03a1: 0x90, // Ρ
  0x03a3: 0x91, // Σ
  0x03a4: 0x92, // Τ
  0x03a5: 0x93, // Υ
  0x03a6: 0x94, // Φ
  0x03a7: 0x95, // Χ
  0x03a8: 0x96, // Ψ
  0x03a9: 0x97, // Ω
  0x03b1: 0x98, // α
  0x03b2: 0x99, // β
  0x03b3: 0x9a, // γ
  0x03b4: 0x9b, // δ
  0x03b5: 0x9c, // ε
  0x03b6: 0x9d, // ζ
  0x03b7: 0x9e, // η
  0x03b8: 0x9f, // θ
  0x03b9: 0xa0, // ι
  0x03ba: 0xa1, // κ
  0x03bb: 0xa2, // λ
  0x03bc: 0xa3, // μ
  0x03bd: 0xa4, // ν
  0x03be: 0xa5, // ξ
  0x03bf: 0xa6, // ο
  0x03c0: 0xa7, // π
  0x03c1: 0xa8, // ρ
  0x03c2: 0xa9, // ς
  0x03c3: 0xaa, // σ
  0x03c4: 0xab, // τ
  0x03c5: 0xac, // υ
  0x03c6: 0xad, // φ
  0x03c7: 0xae, // χ
  0x03c8: 0xaf, // ψ
  0x03c9: 0xe0, // ω
  // Accented → closest base letter (cheap printers often lack accents)
  0x03ac: 0x98, // ά
  0x03ad: 0x9c, // έ
  0x03ae: 0x9e, // ή
  0x03af: 0xa0, // ί
  0x03cc: 0xa6, // ό
  0x03cd: 0xac, // ύ
  0x03ce: 0xe0, // ώ
  0x0386: 0x80, // Ά
  0x0388: 0x84, // Έ
  0x0389: 0x86, // Ή
  0x038a: 0x88, // Ί
  0x038c: 0x8e, // Ό
  0x038e: 0x93, // Ύ
  0x038f: 0x97, // Ώ
  0x03ca: 0xa0, // ϊ
  0x03cb: 0xac, // ϋ
  0x0390: 0xa0, // ΐ
  0x03b0: 0xac, // ΰ
  0x20ac: 0x45, // € → E
};

function encodeCp737Char(ch: string): number {
  const code = ch.charCodeAt(0);
  if (code >= 0x20 && code <= 0x7e) return code;
  if (CP737[code] !== undefined) return CP737[code];
  return 0x3f; // ?
}

export function encodeCp737(input: string): Uint8Array {
  const s = input.normalize('NFC');
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = encodeCp737Char(s[i]);
  return out;
}

export class EscPosEncoder {
  private readonly chunks: Uint8Array[] = [];

  constructor(private readonly width: EscPosWidth = 80) {}

  getWidth(): EscPosWidth {
    return this.width;
  }

  raw(bytes: ArrayLike<number>): this {
    this.chunks.push(new Uint8Array(bytes));
    return this;
  }

  reset(): this {
    this.raw([ESC, 0x40]); // init
    this.raw([ESC, 0x74, 14]); // code page 737 Greek
    this.raw([ESC, 0x52, 11]); // international charset Greece (best-effort)
    return this;
  }

  align(a: EscPosAlign): this {
    const n = a === 'center' ? 1 : a === 'right' ? 2 : 0;
    return this.raw([ESC, 0x61, n]);
  }

  bold(on: boolean): this {
    return this.raw([ESC, 0x45, on ? 1 : 0]);
  }

  /** Double height only — keeps column width so amounts stay readable. */
  tall(on: boolean): this {
    return this.raw([GS, 0x21, on ? 0x01 : 0x00]);
  }

  /** Height-only (same as tall). Full double-width clips totals. */
  double(on: boolean): this {
    return this.tall(on);
  }

  text(s: string): this {
    return this.raw(encodeCp737(s));
  }

  feed(lines = 1): this {
    return this.raw([ESC, 0x64, Math.max(1, Math.min(255, lines))]);
  }

  line(): this {
    return this.raw([0x0a]);
  }

  cut(): this {
    return this.raw([GS, 0x56, 0x42, 0x00]).feed(3);
  }

  getChunks(): Uint8Array[] {
    return this.chunks;
  }

  getBytes(): Uint8Array {
    let len = 0;
    for (const c of this.chunks) len += c.byteLength;
    const out = new Uint8Array(len);
    let off = 0;
    for (const c of this.chunks) {
      out.set(c, off);
      off += c.byteLength;
    }
    return out;
  }
}

export function splitBytes(bytes: Uint8Array, maxLen: number): Uint8Array[] {
  if (bytes.byteLength <= maxLen) return [bytes];
  const out: Uint8Array[] = [];
  for (let i = 0; i < bytes.byteLength; i += maxLen) {
    out.push(bytes.subarray(i, Math.min(i + maxLen, bytes.byteLength)));
  }
  return out;
}
