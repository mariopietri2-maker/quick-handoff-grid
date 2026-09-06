// Minimal ESC/POS encoder for 58/80mm thermal printers with CP737 (Greek) support.
// Produces a list of *atomic* chunks — each chunk is a complete command (or a text
// run) so callers can send them one-by-one over Bluetooth (BEL/MTU friendly) without
// ever splitting a multi-byte command across writes.

export type EscPosWidth = 58 | 80;
export type EscPosAlign = 'left' | 'center' | 'right';

const ESC = 0x1b;
const GS = 0x1d;

/** Columns at font-A for each paper width (reasonable defaults for thermal printers). */
export const ESCPOS_COLS: Record<EscPosWidth, number> = {
  58: 32,
  80: 42,
};

// CP737 (OEM Greek) — Unicode codepoint -> single byte. ASCII passes through.
const CP737_MAP: ReadonlyArray<readonly [number, number]> = [
  [0x0391, 0x80], [0x03b1, 0x81], [0x0392, 0x82], [0x03b2, 0x83],
  [0x0393, 0x84], [0x03b3, 0x85], [0x0394, 0x86], [0x03b4, 0x87],
  [0x0395, 0x88], [0x03b5, 0x89], [0x0396, 0x8a], [0x03b6, 0x8b],
  [0x0397, 0x8c], [0x03b7, 0x8d], [0x0398, 0x8e], [0x03b8, 0x8f],
  [0x0399, 0x90], [0x03b9, 0x91], [0x039a, 0x92], [0x03ba, 0x93],
  [0x039b, 0x94], [0x03bb, 0x95], [0x039c, 0x96], [0x03bc, 0x97],
  [0x039d, 0x98], [0x03bd, 0x99], [0x039e, 0x9a], [0x03be, 0x9b],
  [0x039f, 0x9c], [0x03bf, 0x9d], [0x03a0, 0x9e], [0x03c0, 0x9f],
  [0x03a1, 0xa0], [0x03c1, 0xa1], [0x03a3, 0xa2], [0x03c2, 0xa3],
  [0x03c3, 0xa4], [0x03a4, 0xa5], [0x03c4, 0xa6], [0x03a5, 0xa7],
  [0x03c5, 0xa8], [0x03a6, 0xa9], [0x03c6, 0xaa], [0x03a7, 0xab],
  [0x03c7, 0xac], [0x03a8, 0xad], [0x03c8, 0xae], [0x03a9, 0xaf],
  [0x03c9, 0xb0], [0x03ac, 0xb1], [0x03ad, 0xb2], [0x03ae, 0xb3],
  [0x03af, 0xb4], [0x03cc, 0xb5], [0x03cd, 0xb6], [0x03ce, 0xb7],
  [0x038a, 0xb8], [0x038e, 0xb9], [0x03ab, 0xba], [0x0386, 0xbb],
  [0x0388, 0xbc], [0x0389, 0xbd], [0x038c, 0xbe], [0x038f, 0xbf],
  [0x0390, 0xc0],
];

function encodeCp737Char(ch: string): number {
  const code = ch.charCodeAt(0);
  if (code >= 0x20 && code <= 0x7e) return code;
  for (const [u, b] of CP737_MAP) if (u === code) return b;
  return 0x3f; // '?'
}

export function encodeCp737(input: string): Uint8Array {
  const out = new Uint8Array(input.length);
  for (let i = 0; i < input.length; i++) out[i] = encodeCp737Char(input[i]);
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
    return this.raw([ESC, 0x40]); // ESC @ — initialize printer
  }

  align(a: EscPosAlign): this {
    const n = a === 'center' ? 1 : a === 'right' ? 2 : 0;
    return this.raw([ESC, 0x61, n]); // ESC a n
  }

  bold(on: boolean): this {
    return this.raw([ESC, 0x45, on ? 1 : 0]); // ESC E n
  }

  double(on: boolean): this {
    return this.raw([GS, 0x21, on ? 0x11 : 0x00]); // GS ! n (double width + height)
  }

  text(s: string): this {
    return this.raw(encodeCp737(s));
  }

  feed(lines = 1): this {
    return this.raw([ESC, 0x64, Math.max(1, Math.min(255, lines))]); // ESC d n
  }

  line(): this {
    return this.raw([0x0a]); // LF
  }

  cut(): this {
    return this.raw([GS, 0x56, 0x42, 0x00]).feed(3); // GS V B 0 — partial cut + clear
  }

  /** Atomic command/text chunks (each fits a single BLE write of 20 bytes when small). */
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

/** Split a byte buffer into ≤ maxLen pieces (used for BLE writes / small MTUs). */
export function splitBytes(bytes: Uint8Array, maxLen: number): Uint8Array[] {
  if (bytes.byteLength <= maxLen) return [bytes];
  const out: Uint8Array[] = [];
  for (let i = 0; i < bytes.byteLength; i += maxLen) {
    out.push(bytes.slice(i, i + maxLen));
  }
  return out;
}