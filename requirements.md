# Requirements

## What I want to build
A multiplayer Battleship game where two players compete in real time. Player A creates a room and shares a code, Player B joins with that code. Both players select ship positions on their own board before the game starts. Players then take turns firing at each other's hidden fleet until one player sinks all opponent ships.

## Core features
- Player A creates a game room and receives a shareable room code
- Player B joins the room using the room code
- Each player places their fleet on a 10x10 grid before the game begins (click to place, click to rotate)
- Standard fleet: Carrier(5), Battleship(4), Cruiser(3), Submarine(3), Destroyer(2)
- Game does not start until both players have placed all ships and confirmed ready
- Players alternate turns firing at coordinates on the opponent's board
- Backend enforces turn order — frontend cannot bypass this
- Hit, miss, and sunk states are shown visually
- Win condition: all opponent ships sunk
- UI is mobile-first and works on phones, tablets, and desktop

## Out of scope (v1)
- User authentication or accounts
- Persistent storage (in-memory only)
- Spectator mode
- Turn timeout
- Chat
- GitHub PR — this is an initial build only

## Open decisions
- Polling interval for game state updates (default to 2 seconds)
