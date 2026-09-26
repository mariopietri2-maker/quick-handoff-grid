// Minimal ESC/POS encoder for 58/80mm thermal printers with CP737 (Greek) support.
// Atomic chunks so BLE/USB writers never split multi-byte commands.

export type EscPosWidth = 58 | 80;
export type EscPosAlign = 'left' | 'center' | 'right';

const ESC = 0x1b;
const GS = 0x1d;

/** Columns at font-A for each paper width. */
export const ESCPOS_COLS: Record<EscPosWidth, number> = {
  // Many 58mm heads only paint ~28 cols; 32 clips amounts on the right edge.
  58: 28,
  80: 42,
};

const CP737: Record<number, number> = {
  0x0391: 0x80, 0x0392: 0x81, 0x0393: 0x82, 0x0394: 0x83,
  0x0395: 0x84, 0x0396: 0x85, 0x0397: 0x86, 0x0398: 0x87,
  0x0399: 0x88, 0x039a: 0x89, 0x039b: 0x8a, 0x039c: 0x8b,
  0x039d: 0x8c, 0x039e: 0x8d, 0x039f: 0x8e, 0x03a0: 0x8f,
  0x03a1: 0x90, 0x03a3: 0x91, 0x03a4: 0x92, 0x03a5: 0x93,
  0x03a6: 0x94, 0x03a7: 0x95, 0x03a8: 0x96, 0x03a9: 0x97,
  0x03b1: 0x98, 0x03b2: 0x99, 0x03b3: 0x9a, 0x03b4: 0x9b,
  0x03b5: 0x9c, 0x03b6: 0x9d, 0x03b7: 0x9e, 0x03b8: 0x9f,
  0x03b9: 0xa0, 0x03ba: 0xa1, 0x03bb: 0xa2, 0x03bc: 0xa3,
  0x03bd: 0xa4, 0x03be: 0xa5, 0x03bf: 0xa6, 0x03c0: 0xa7,
  0x03c1: 0xa8, 0x03c2: 0xa9, 0x03c3: 0xaa, 0x03c4: 0xab,
  0x03c5: 0xac, 0x03c6: 0xad, 0x03c7: 0xae, 0x03c8: 0xaf,
  0x03c9: 0xe0,
  0x03ac: 0x98, 0x03ad: 0x9c, 0x03ae: 0x9e, 0x03af: 0xa0,
  0x03cc: 0xa6, 0x03cd: 0xac, 0x03ce: 0xe0,
  0x0386: 0x80, 0x0388: 0x84, 0x0389: 0x86, 0x038a: 0x88,
  0x038c: 0x8e, 0x038e: 0x93, 0x038f: 0x97,
};

function encodeCp737Char(ch: string): number {
  const cp = ch.codePointAt(0) ?? 0x3f;
  if (cp < 0x80) return cp;
  return CP737[cp] ?? 0x3f;
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
    this.raw([ESC, 0x40]);
    this.raw([ESC, 0x74, 14]);
    this.raw([ESC, 0x52, 11]);
    return this;
  }

  align(a: EscPosAlign): this {
    const n = a === 'center' ? 1 : a === 'right' ? 2 : 0;
    return this.raw([ESC, 0x61, n]);
  }

  bold(on: boolean): this {
    return this.raw([ESC, 0x45, on ? 1 : 0]);
  }

  tall(on: boolean): this {
    return this.raw([GS, 0x21, on ? 0x01 : 0x00]);
  }

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
