import { describe, it, expect } from 'vitest';
import { displayOpponentName } from './displayOpponentName';

describe('displayOpponentName', () => {
  it('returns "Computer" for any COMPUTER- sentinel id (AC-16)', () => {
    expect(displayOpponentName('COMPUTER-some-uuid-here')).toBe('Computer');
  });

  it('returns "Computer" regardless of what displayName is passed when id is a sentinel', () => {
    expect(displayOpponentName('COMPUTER-abc', 'Should Not Show')).toBe('Computer');
  });

  it('returns displayName when provided and id is not a sentinel', () => {
    expect(displayOpponentName('some-uuid', 'Alex')).toBe('Alex');
  });

  it('falls back to id when displayName is undefined and id is not a sentinel', () => {
    expect(displayOpponentName('some-uuid')).toBe('some-uuid');
  });

  it('does not match partial prefix — only exact "COMPUTER-" prefix triggers sentinel (EC-07)', () => {
    expect(displayOpponentName('COMPUTER', 'Alex')).toBe('Alex');
    expect(displayOpponentName('computer-abc', 'Alex')).toBe('Alex');
  });
});
