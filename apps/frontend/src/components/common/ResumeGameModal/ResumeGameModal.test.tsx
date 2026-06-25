import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResumeGameModal, RESUME_MODAL_TEXT } from './ResumeGameModal';

describe('ResumeGameModal (AC-5)', () => {
  it('renders the verbatim resume copy', () => {
    render(<ResumeGameModal onResume={vi.fn()} onStop={vi.fn()} />);
    // Locks the product copy — a regression in this string fails the build.
    expect(
      screen.getByText('Do you want to continue your existing game?'),
    ).toBeInTheDocument();
    expect(RESUME_MODAL_TEXT).toBe('Do you want to continue your existing game?');
  });

  it('behaves as a blocking dialog, not a toast', () => {
    render(<ResumeGameModal onResume={vi.fn()} onStop={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('renders exactly two choices: Yes/Resume and No/Stop', () => {
    render(<ResumeGameModal onResume={vi.fn()} onStop={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
  });

  it('fires onResume when Yes/Resume is clicked', () => {
    const onResume = vi.fn();
    render(<ResumeGameModal onResume={onResume} onStop={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /resume/i }));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('fires onStop when No/Stop is clicked', () => {
    const onStop = vi.fn();
    render(<ResumeGameModal onResume={vi.fn()} onStop={onStop} />);
    fireEvent.click(screen.getByRole('button', { name: /stop/i }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons while busy (no double-submit)', () => {
    render(<ResumeGameModal onResume={vi.fn()} onStop={vi.fn()} busy />);
    expect(screen.getByRole('button', { name: /resume/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /stop/i })).toBeDisabled();
  });
});
