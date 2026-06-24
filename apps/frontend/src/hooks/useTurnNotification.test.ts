import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTurnNotification } from './useTurnNotification';
import type { GameStatus } from '../types/game';

type Props = { mine: boolean; status: GameStatus };

function setup(initial: Props) {
  return renderHook(({ mine, status }: Props) => useTurnNotification(mine, status), {
    initialProps: initial,
  });
}

describe('useTurnNotification', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not show on initial render even when it is already my turn (AC10)', () => {
    const { result } = setup({ mine: true, status: 'IN_PROGRESS' });
    expect(result.current).toBe(false);
  });

  it('shows on the opponent -> me transition (AC9)', () => {
    const { result, rerender } = setup({ mine: false, status: 'IN_PROGRESS' });
    expect(result.current).toBe(false);
    rerender({ mine: true, status: 'IN_PROGRESS' });
    expect(result.current).toBe(true);
  });

  it('does not re-trigger while it stays my turn across polls (AC10)', () => {
    const { result, rerender } = setup({ mine: false, status: 'IN_PROGRESS' });
    rerender({ mine: true, status: 'IN_PROGRESS' });
    expect(result.current).toBe(true);

    // Auto-dismiss after the timeout.
    act(() => vi.advanceTimersByTime(2600));
    expect(result.current).toBe(false);

    // A subsequent poll where it is STILL my turn must not re-show it.
    rerender({ mine: true, status: 'IN_PROGRESS' });
    expect(result.current).toBe(false);
  });

  it('does not show during the opponent/computer turn (AC11)', () => {
    const { result, rerender } = setup({ mine: false, status: 'IN_PROGRESS' });
    rerender({ mine: false, status: 'IN_PROGRESS' });
    expect(result.current).toBe(false);
  });

  it('is suppressed when the game is FINISHED (AC12)', () => {
    const { result, rerender } = setup({ mine: false, status: 'IN_PROGRESS' });
    rerender({ mine: true, status: 'FINISHED' });
    expect(result.current).toBe(false);
  });

  it('re-triggers on a fresh transition after returning to the opponent (AC9/AC13)', () => {
    const { result, rerender } = setup({ mine: false, status: 'IN_PROGRESS' });
    rerender({ mine: true, status: 'IN_PROGRESS' });
    expect(result.current).toBe(true);
    act(() => vi.advanceTimersByTime(2600));
    expect(result.current).toBe(false);

    // Opponent's/computer's turn, then back to me — same logic in both modes.
    rerender({ mine: false, status: 'IN_PROGRESS' });
    rerender({ mine: true, status: 'IN_PROGRESS' });
    expect(result.current).toBe(true);
  });
});
