import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LeaveConfirmModal, LEAVE_MODAL_TEXT } from './LeaveConfirmModal';

describe('LeaveConfirmModal (AC-11/12/13)', () => {
  it('renders as a modal dialog with the locked copy and both actions', () => {
    render(<LeaveConfirmModal onStay={vi.fn()} onLeave={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(LEAVE_MODAL_TEXT)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^stay$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^leave$/i })).toBeInTheDocument();
  });

  it('Stay fires onStay (AC-12)', async () => {
    const onStay = vi.fn();
    render(<LeaveConfirmModal onStay={onStay} onLeave={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /^stay$/i }));
    expect(onStay).toHaveBeenCalledTimes(1);
  });

  it('Leave fires onLeave (AC-13)', async () => {
    const onLeave = vi.fn();
    render(<LeaveConfirmModal onStay={vi.fn()} onLeave={onLeave} />);
    await userEvent.click(screen.getByRole('button', { name: /^leave$/i }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('disables both actions while busy (prevents double-submit / double-release)', () => {
    render(<LeaveConfirmModal onStay={vi.fn()} onLeave={vi.fn()} busy />);
    expect(screen.getByRole('button', { name: /^stay$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^leave$/i })).toBeDisabled();
  });
});
