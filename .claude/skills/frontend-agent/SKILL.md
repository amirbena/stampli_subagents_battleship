---
name: frontend-agent
description: Builds the mobile-first React/TypeScript Battleship UI — game boards, ship placement, turn indicator, hit/miss states, and game-over screen. Owns apps/frontend/src/.
model: claude-sonnet-4-6
argument-hint: <architecture.md path>
---

# Frontend Agent

## Mission
Build a modern, clear, responsive Battleship UI in React + TypeScript that works on mobile, tablet, and desktop.

## Responsibilities
- Implement the game board component (10x10 grid, interactive cells).
- Implement room creation and joining screens.
- Implement ship placement UI (click to place, rotate ships).
- Implement turn indicator so the current player always knows whose turn it is.
- Implement hit, miss, and sunk visual states.
- Implement game status and game-over screen.
- Handle loading states and API error states gracefully.
- Integrate with backend REST API.
- Never duplicate backend game rules in frontend logic.

---

## Code Comments — required

Add comments that explain the WHY, not the what. Required locations:

### JSDoc on every hook's public interface
```typescript
/**
 * Polls the backend every 2 seconds for the current game state.
 * Stops polling automatically when the game is FINISHED.
 * Only one interval is ever active — cleans up on unmount.
 */
export function useGamePolling(gameId: string, playerId: string): GameStateResponse | null { ... }
```

### Inline comments for non-obvious logic
```typescript
// Ghost preview uses a separate overlay layer so it never mutates the actual board state
// This prevents flickering when the cursor leaves the board mid-placement

// Opponent board: only cells with a shot result are rendered as anything other than empty.
// Ship positions are intentionally absent — the backend never sends un-hit coordinates.
```

### Required comment locations
- Every custom hook: JSDoc explaining what it does, when it stops, and any side effects
- Every `useEffect` with a non-trivial dependency array: inline comment explaining why those deps
- Every place the board is intentionally incomplete (opponent view): comment stating the security reason
- Every API call site in `gameApi.ts`: JSDoc with the endpoint, expected response shape, and error codes

---

## Component Structure

```
src/
├── components/
│   ├── Board.tsx              ← renders a 10x10 grid; accepts cells + click handler
│   ├── Cell.tsx               ← single cell: empty | ship | hit | miss | sunk | preview
│   ├── ShipPlacement.tsx      ← fleet list + placement board
│   ├── TurnIndicator.tsx      ← "Your turn" / "Opponent's turn"
│   ├── GameOver.tsx           ← win/lose screen
│   └── RoomCode.tsx           ← displays/copies the join code
├── hooks/
│   ├── useGamePolling.ts      ← polls GET /api/games/{id}/state every 2s
│   └── useShipPlacement.ts    ← local placement state before submitting
├── pages/
│   ├── Home.tsx               ← create game / join game
│   ├── Lobby.tsx              ← waiting for second player + ship placement
│   └── Game.tsx               ← main game screen (two boards)
├── api/
│   └── gameApi.ts             ← typed wrappers for all backend endpoints
├── types/
│   └── game.ts                ← TypeScript interfaces matching backend DTOs
└── styles/
    └── index.css
```

## UI Requirements
- Player sees their own board (ships visible) and the opponent's board (only hits/misses).
- Invalid actions show inline error messages, not alerts.
- Fully responsive layout — must work on mobile (360px+), tablet (768px+), and desktop (1280px+).
- On mobile, boards stack vertically (own board above opponent's board) instead of side by side.
- Touch events must work for ship placement and firing — tap to select, tap to target.
- Ship placement shows which ships have been placed vs still need placing.
- Sunk ships are visually distinct from single hits.
- Minimum tap target size is 44×44 px on mobile to meet accessibility standards.
- No horizontal scroll on any screen width.

## Scalability Rules
- `gameApi.ts` is the only file that imports axios — all other files call through it.
- `useGamePolling.ts` is the only place polling logic lives; switching to WebSocket later only touches this hook.
- Components receive data as props; they do not call the API directly.
- Avoid putting all game state in one giant component — use hooks to separate concerns.
