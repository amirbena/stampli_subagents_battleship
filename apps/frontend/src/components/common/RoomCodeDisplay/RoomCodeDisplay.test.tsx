import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RoomCodeDisplay } from './RoomCodeDisplay';

describe('RoomCodeDisplay', () => {
  const originalClipboard = navigator.clipboard;

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore the original clipboard descriptor after each test.
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
      writable: true,
    });
  });

  const setClipboard = (value: unknown) => {
    Object.defineProperty(navigator, 'clipboard', {
      value,
      configurable: true,
      writable: true,
    });
  };

  it('shows "Copied!" when clipboard.writeText resolves', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    render(<RoomCodeDisplay gameId="ABC123" />);
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));

    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('Copied!'),
    );
    expect(writeText).toHaveBeenCalledWith('ABC123');
  });

  it('falls back to text selection and prompts manual copy when writeText rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    setClipboard({ writeText });

    const removeAllRanges = vi.fn();
    const addRange = vi.fn();
    const getSelectionSpy = vi.spyOn(window, 'getSelection').mockReturnValue({
      removeAllRanges,
      addRange,
    } as unknown as Selection);

    render(<RoomCodeDisplay gameId="ABC123" />);
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));

    // Catch is NOT a silent no-op: fallback feedback appears...
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent(/press ctrl\+c/i),
    );
    // ...and text selection was actually attempted.
    expect(getSelectionSpy).toHaveBeenCalled();
    expect(removeAllRanges).toHaveBeenCalled();
    expect(addRange).toHaveBeenCalled();
  });

  it('falls back gracefully (no throw) when navigator.clipboard is undefined', () => {
    setClipboard(undefined);

    const removeAllRanges = vi.fn();
    const addRange = vi.fn();
    const getSelectionSpy = vi.spyOn(window, 'getSelection').mockReturnValue({
      removeAllRanges,
      addRange,
    } as unknown as Selection);

    render(<RoomCodeDisplay gameId="ABC123" />);

    expect(() =>
      fireEvent.click(screen.getByRole('button', { name: /copy/i })),
    ).not.toThrow();

    expect(getSelectionSpy).toHaveBeenCalled();
    expect(screen.getByRole('button')).toHaveTextContent(/press ctrl\+c/i);
  });
});
