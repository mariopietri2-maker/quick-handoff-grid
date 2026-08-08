import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '..');

function readSource(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

const mobileKeyboardAttributes = [
  'autoComplete="off"',
  'autoCorrect="off"',
  'spellCheck={false}',
  'autoCapitalize="sentences"',
  'inputMode="text"',
];

describe('native chat input configuration', () => {
  it('applies mobile keyboard attributes to the live chat thread input', () => {
    const source = readSource('components/support/LiveChatThread.tsx');

    expect(source).toContain('<Input');
    for (const attribute of mobileKeyboardAttributes) {
      expect(source).toContain(attribute);
    }
  });

  it('applies mobile keyboard attributes to the shared chat composer textarea', () => {
    const source = readSource('components/chat/ChatComposer.tsx');

    expect(source).toContain('<Textarea');
    for (const attribute of mobileKeyboardAttributes) {
      expect(source).toContain(attribute);
    }
  });

  it('applies mobile keyboard attributes to custom order text fields', () => {
    const source = readSource('components/admin/CustomOrderDialog.tsx');

    expect(source).toContain('value={customerName}');
    expect(source).toContain('value={customerPhone}');
    expect(source).toContain('value={items}');
    expect(source).toContain('value={notes}');
    expect(source.match(/autoComplete="off"/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(source.match(/autoCorrect="off"/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(source.match(/spellCheck=\{false\}/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(source.match(/autoCapitalize="sentences"/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(source.match(/inputMode="text"/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });
});
