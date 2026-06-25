/**
 * Returns a human-readable opponent label.
 * The computer opponent uses a "COMPUTER-<uuid>" sentinel id — never surface
 * that raw string to the user; return "Computer" instead (AC-16, EC-07).
 */
export function displayOpponentName(id: string, displayName?: string): string {
  if (id.startsWith('COMPUTER-')) {
    return 'Computer';
  }
  return displayName ?? id;
}
