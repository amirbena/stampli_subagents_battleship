import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameCodePopup, GAME_CODE_POPUP_TITLE } from './GameCodePopup';

describe('GameCodePopup (AC-5/AC-6)', () => {
  it('renders as a modal dialog with the locked title', () => {
    render(<GameCodePopup gameId="ABC123" onAcknowledge={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(GAME_CODE_POPUP_TITLE)).toBeInTheDocument();
  });

  it('displays the game code (AC-5)', () => {
    render(<GameCodePopup gameId="ABC123" onAcknowledge={vi.fn()} />);
    expect(screen.getByText('ABC123')).toBeInTheDocument();
  });

  it('exposes a copy affordance so the code is saveable (AC-6)', () => {
    render(<GameCodePopup gameId="ABC123" onAcknowledge={vi.fn()} />);
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });

  it('renders the code in a selectable element (AC-6 minimum: selectable text)', () => {
    render(<GameCodePopup gameId="ABC123" onAcknowledge={vi.fn()} />);
    // The code value carries the room-code-value class, which sets user-select: all.
    expect(screen.getByText('ABC123')).toHaveClass('room-code-value');
  });

  it('copy button writes the code to the clipboard (AC-6 preferred affordance)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<GameCodePopup gameId="ABC123" onAcknowledge={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith('ABC123');
  });

  it('acknowledging fires onAcknowledge (proceed into the game)', async () => {
    const onAck = vi.fn();
    render(<GameCodePopup gameId="ABC123" onAcknowledge={onAck} />);
    await userEvent.click(screen.getByRole('button', { name: /got it, start playing/i }));
    expect(onAck).toHaveBeenCalledTimes(1);
  });
});
