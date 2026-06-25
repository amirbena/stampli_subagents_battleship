import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerNameEntry } from './PlayerNameEntry';

describe('PlayerNameEntry', () => {
  it('renders the name input and submit button', () => {
    render(<PlayerNameEntry onSubmit={vi.fn()} errorMessage={null} />);
    expect(screen.getByLabelText('Display name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save name/i })).toBeInTheDocument();
  });

  it('submit button is enabled when no submission is in flight', () => {
    render(<PlayerNameEntry onSubmit={vi.fn()} errorMessage={null} />);
    expect(screen.getByRole('button', { name: /save name/i })).not.toBeDisabled();
  });

  it('submit button is disabled while submission is in flight (EC-05)', async () => {
    // onSubmit never resolves so the button stays disabled throughout.
    const neverResolves = vi.fn(() => new Promise<void>(() => {}));
    render(<PlayerNameEntry onSubmit={neverResolves} errorMessage={null} />);

    const button = screen.getByRole('button', { name: /save name/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    });
  });

  it('displays DISPLAY_NAME_REQUIRED error message inline (AC-02)', () => {
    render(
      <PlayerNameEntry onSubmit={vi.fn()} errorMessage="DISPLAY_NAME_REQUIRED" />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Display name is required',
    );
  });

  it('displays DISPLAY_NAME_TOO_LONG error message inline (AC-03)', () => {
    render(
      <PlayerNameEntry onSubmit={vi.fn()} errorMessage="DISPLAY_NAME_TOO_LONG" />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Display name must be 30 characters or fewer',
    );
  });

  it('displays DISPLAY_NAME_INVALID_CHARS error message inline (AC-04)', () => {
    render(
      <PlayerNameEntry onSubmit={vi.fn()} errorMessage="DISPLAY_NAME_INVALID_CHARS" />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Display name may only contain letters, numbers, spaces, hyphens, and underscores',
    );
  });

  it('displays a raw error message when it is not a known code (EC-06 generic network error)', () => {
    render(
      <PlayerNameEntry
        onSubmit={vi.fn()}
        errorMessage="Something went wrong. Please try again."
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    );
  });

  it('shows no error when errorMessage is null', () => {
    render(<PlayerNameEntry onSubmit={vi.fn()} errorMessage={null} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('calls onSubmit with the current input value on form submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PlayerNameEntry onSubmit={onSubmit} errorMessage={null} />);

    await userEvent.type(screen.getByLabelText('Display name'), 'Alex');
    // Submit via button click (form has no aria role so we use the submit button).
    fireEvent.click(screen.getByRole('button', { name: /save name/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('Alex'));
  });

  it('re-enables the submit button after onSubmit rejects (EC-06)', async () => {
    // Rejection is caught by the component's try/finally — suppress unhandled-rejection
    // noise by making the mock explicitly swallow the error via a no-op catch.
    const onSubmit = vi.fn().mockImplementation(() => Promise.reject(new Error('network')));
    render(<PlayerNameEntry onSubmit={onSubmit} errorMessage={null} />);

    fireEvent.click(screen.getByRole('button', { name: /save name/i }));

    // The component catches the error in the finally block and re-enables the button.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save name/i })).not.toBeDisabled();
    });
  });
});
