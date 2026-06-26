import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ShotResultToast } from './ShotResultToast';
import { RESULT_TOAST_HIT_MS, RESULT_TOAST_MISS_MS } from '../../../utils/turnTiming';

describe('ShotResultToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the result text', () => {
    render(<ShotResultToast result="HIT" sunkShipType={null} />);
    expect(screen.getByText('HIT!')).toBeInTheDocument();
  });

  it('renders a sunk message with the ship name', () => {
    render(<ShotResultToast result="SUNK" sunkShipType="DESTROYER" />);
    expect(screen.getByText(/sunk their destroyer/i)).toBeInTheDocument();
  });

  it('keeps a MISS result visible for the shorter miss duration, then hides it', () => {
    render(<ShotResultToast result="MISS" sunkShipType={null} />);
    expect(screen.getByText('MISS')).toBeInTheDocument();

    // Still visible just before the miss duration elapses.
    act(() => { vi.advanceTimersByTime(RESULT_TOAST_MISS_MS - 1); });
    expect(screen.getByText('MISS')).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByText('MISS')).toBeNull();
  });

  it('keeps a HIT result visible ~0.5s longer than a miss (still up past the miss duration)', () => {
    render(<ShotResultToast result="HIT" sunkShipType={null} />);

    // At the miss duration a HIT is still on screen — it lingers longer.
    act(() => { vi.advanceTimersByTime(RESULT_TOAST_MISS_MS); });
    expect(screen.getByText('HIT!')).toBeInTheDocument();

    // Cleared only at the longer hit duration.
    act(() => { vi.advanceTimersByTime(RESULT_TOAST_HIT_MS - RESULT_TOAST_MISS_MS); });
    expect(screen.queryByText('HIT!')).toBeNull();
  });

  it('uses the longer (hit) duration for a SUNK result', () => {
    render(<ShotResultToast result="SUNK" sunkShipType="CRUISER" />);

    act(() => { vi.advanceTimersByTime(RESULT_TOAST_MISS_MS); });
    expect(screen.getByText(/sunk their cruiser/i)).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(RESULT_TOAST_HIT_MS - RESULT_TOAST_MISS_MS); });
    expect(screen.queryByText(/sunk their cruiser/i)).toBeNull();
  });

  it('asserts the hit duration is exactly 500ms longer than the miss duration', () => {
    expect(RESULT_TOAST_HIT_MS - RESULT_TOAST_MISS_MS).toBe(500);
    expect(RESULT_TOAST_MISS_MS).toBeLessThan(2500);
  });
});
