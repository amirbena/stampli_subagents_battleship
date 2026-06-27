package com.stampli.battleship.controller;

import com.stampli.battleship.domain.Coordinate;
import com.stampli.battleship.domain.GameMode;
import com.stampli.battleship.domain.ShipType;
import com.stampli.battleship.dto.*;
import com.stampli.battleship.service.GameService;
import jakarta.validation.Valid;
import lombok.AllArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/games")
@AllArgsConstructor
public class GameController {

    private final GameService gameService;

    // POST /api/v1/games — Create Game
    @PostMapping
    public ResponseEntity<CreateGameResponse> createGame(
            @RequestParam(value = "mode", defaultValue = "HUMAN") String mode,
            @RequestBody(required = false) CreateGameRequest body) {
        GameMode gameMode = GameMode.valueOf(mode.toUpperCase());
        String playerId = (body != null) ? body.getPlayerId() : null;
        CreateGameResponse response = gameService.createGame(gameMode, playerId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // POST /api/v1/games/{gameId}/join — Join Game
    @PostMapping("/{gameId}/join")
    public ResponseEntity<JoinGameResponse> joinGame(
            @PathVariable String gameId,
            @RequestBody(required = false) JoinGameRequest body) {
        String playerId = (body != null) ? body.getPlayerId() : null;
        JoinGameResponse response = gameService.joinGame(gameId, playerId);
        return ResponseEntity.ok(response);
    }

    // Header carrying the per-seat belonging secret on every authenticated request.
    private static final String SESSION_TOKEN_HEADER = "X-Session-Token";
    // Header carrying the caller's asserted seat id on the restore probe (path stays {code}).
    private static final String PLAYER_ID_HEADER = "X-Player-Id";

    // POST /api/v1/games/{gameId}/players/{playerId}/ships — Place Ship (belonging required)
    @PostMapping("/{gameId}/players/{playerId}/ships")
    public ResponseEntity<PlaceShipResponse> placeShip(
            @PathVariable String gameId,
            @PathVariable String playerId,
            @RequestHeader(value = SESSION_TOKEN_HEADER, required = false) String sessionToken,
            @Valid @RequestBody PlaceShipRequest request) {
        Coordinate anchor = new Coordinate(request.getRow(), request.getCol());
        PlaceShipResponse response = gameService.placeShip(
                gameId, playerId, sessionToken, request.getShipType(), anchor, request.getOrientation());
        return ResponseEntity.ok(response);
    }

    // DELETE /api/v1/games/{gameId}/players/{playerId}/ships/{shipType} — Remove Ship (belonging required)
    @DeleteMapping("/{gameId}/players/{playerId}/ships/{shipType}")
    public ResponseEntity<Void> removeShip(
            @PathVariable String gameId,
            @PathVariable String playerId,
            @RequestHeader(value = SESSION_TOKEN_HEADER, required = false) String sessionToken,
            @PathVariable ShipType shipType) {
        gameService.removeShip(gameId, playerId, sessionToken, shipType);
        return ResponseEntity.noContent().build();
    }

    // POST /api/v1/games/{gameId}/players/{playerId}/ready — Confirm Ready (belonging required)
    @PostMapping("/{gameId}/players/{playerId}/ready")
    public ResponseEntity<ConfirmReadyResponse> confirmReady(
            @PathVariable String gameId,
            @PathVariable String playerId,
            @RequestHeader(value = SESSION_TOKEN_HEADER, required = false) String sessionToken) {
        ConfirmReadyResponse response = gameService.setReady(gameId, playerId, sessionToken);
        return ResponseEntity.ok(response);
    }

    // POST /api/v1/games/{gameId}/players/{playerId}/fire — Fire Shot (belonging required)
    @PostMapping("/{gameId}/players/{playerId}/fire")
    public ResponseEntity<FireShotResponse> fireShot(
            @PathVariable String gameId,
            @PathVariable String playerId,
            @RequestHeader(value = SESSION_TOKEN_HEADER, required = false) String sessionToken,
            @Valid @RequestBody FireShotRequest request) {
        Coordinate coordinate = new Coordinate(request.getRow(), request.getCol());
        FireShotResponse response = gameService.fireShot(gameId, playerId, sessionToken, coordinate);
        return ResponseEntity.ok(response);
    }

    // POST /api/v1/games/{gameId}/players/{playerId}/pause — Pause Game (belonging required)
    @PostMapping("/{gameId}/players/{playerId}/pause")
    public ResponseEntity<PauseResumeResponse> pauseGame(
            @PathVariable String gameId,
            @PathVariable String playerId,
            @RequestHeader(value = SESSION_TOKEN_HEADER, required = false) String sessionToken) {
        PauseResumeResponse response = gameService.pauseGame(gameId, playerId, sessionToken);
        return ResponseEntity.ok(response);
    }

    // POST /api/v1/games/{gameId}/players/{playerId}/resume — Resume Game (belonging required)
    @PostMapping("/{gameId}/players/{playerId}/resume")
    public ResponseEntity<PauseResumeResponse> resumeGame(
            @PathVariable String gameId,
            @PathVariable String playerId,
            @RequestHeader(value = SESSION_TOKEN_HEADER, required = false) String sessionToken) {
        PauseResumeResponse response = gameService.resumeGame(gameId, playerId, sessionToken);
        return ResponseEntity.ok(response);
    }

    // POST /api/v1/games/{gameId}/players/{playerId}/stop — Stop Game (idempotent for owner; belonging required)
    @PostMapping("/{gameId}/players/{playerId}/stop")
    public ResponseEntity<Void> stopGame(
            @PathVariable String gameId,
            @PathVariable String playerId,
            @RequestHeader(value = SESSION_TOKEN_HEADER, required = false) String sessionToken) {
        gameService.stopGame(gameId, playerId, sessionToken);
        return ResponseEntity.noContent().build();
    }

    // GET /api/v1/games/{code}/restore — Restore-by-Code (belonging required; both modes; 200 / 404)
    @GetMapping("/{code}/restore")
    public ResponseEntity<RestoreGameResponse> restoreGame(
            @PathVariable String code,
            @RequestHeader(value = PLAYER_ID_HEADER, required = false) String playerId,
            @RequestHeader(value = SESSION_TOKEN_HEADER, required = false) String sessionToken) {
        RestoreGameResponse response = gameService.restoreGame(code, playerId, sessionToken);
        return ResponseEntity.ok(response);
    }

    // GET /api/v1/games/{gameId}/state?playerId= — Get Game State (belonging required; non-owner → 404)
    @GetMapping("/{gameId}/state")
    public ResponseEntity<GameStateResponse> getGameState(
            @PathVariable String gameId,
            @RequestParam String playerId,
            @RequestHeader(value = SESSION_TOKEN_HEADER, required = false) String sessionToken) {
        GameStateResponse response = gameService.getGameState(gameId, playerId, sessionToken);
        return ResponseEntity.ok(response);
    }
}
