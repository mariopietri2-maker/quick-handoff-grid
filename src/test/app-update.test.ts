import { describe, expect, it } from 'vitest';
import { isVersionDifferent, versionId } from '@/hooks/useAppUpdate';

describe('app update version compare', () => {
  it('builds a stable identity from version+commit+builtAt', () => {
    expect(versionId({ version: '1.0.0', commit: 'abc1234', builtAt: '2026-09-04T10:00:00Z' })).toBe(
      '1.0.0@abc1234@2026-09-04T10:00:00Z',
    );
    expect(versionId(null)).toBeNull();
    expect(versionId({})).toBeNull();
  });

  it('detects a changed deploy', () => {
    const a = { version: '1.0.0', commit: 'aaa1111', builtAt: '2026-09-04T10:00:00Z' };
    expect(isVersionDifferent(a, a)).toBe(false);
    expect(
      isVersionDifferent(a, { version: '1.0.0', commit: 'bbb2222', builtAt: '2026-09-04T11:00:00Z' }),
    ).toBe(true);
  });

  it('never prompts while either side is unresolved', () => {
    const a = { version: '1.0.0', commit: 'aaa1111', builtAt: '2026-09-04T10:00:00Z' };
    expect(isVersionDifferent(null, a)).toBe(false);
    expect(isVersionDifferent(a, null)).toBe(false);
    expect(isVersionDifferent(null, null)).toBe(false);
  });
});
