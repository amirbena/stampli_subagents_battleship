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

    // POST /api/v1/games/{gameId}/players/{playerId}/ships — Place Ship
    @PostMapping("/{gameId}/players/{playerId}/ships")
    public ResponseEntity<PlaceShipResponse> placeShip(
            @PathVariable String gameId,
            @PathVariable String playerId,
            @Valid @RequestBody PlaceShipRequest request) {
        Coordinate anchor = new Coordinate(request.getRow(), request.getCol());
        PlaceShipResponse response = gameService.placeShip(
                gameId, playerId, request.getShipType(), anchor, request.getOrientation());
        return ResponseEntity.ok(response);
    }

    // DELETE /api/v1/games/{gameId}/players/{playerId}/ships/{shipType} — Remove Ship
    @DeleteMapping("/{gameId}/players/{playerId}/ships/{shipType}")
    public ResponseEntity<Void> removeShip(
            @PathVariable String gameId,
            @PathVariable String playerId,
            @PathVariable ShipType shipType) {
        gameService.removeShip(gameId, playerId, shipType);
        return ResponseEntity.noContent().build();
    }

    // POST /api/v1/games/{gameId}/players/{playerId}/ready — Confirm Ready
    @PostMapping("/{gameId}/players/{playerId}/ready")
    public ResponseEntity<ConfirmReadyResponse> confirmReady(
            @PathVariable String gameId,
            @PathVariable String playerId) {
        ConfirmReadyResponse response = gameService.setReady(gameId, playerId);
        return ResponseEntity.ok(response);
    }

    // POST /api/v1/games/{gameId}/players/{playerId}/fire — Fire Shot
    @PostMapping("/{gameId}/players/{playerId}/fire")
    public ResponseEntity<FireShotResponse> fireShot(
            @PathVariable String gameId,
            @PathVariable String playerId,
            @Valid @RequestBody FireShotRequest request) {
        Coordinate coordinate = new Coordinate(request.getRow(), request.getCol());
        FireShotResponse response = gameService.fireShot(gameId, playerId, coordinate);
        return ResponseEntity.ok(response);
    }

    // POST /api/v1/games/{gameId}/players/{playerId}/pause — Pause Game
    @PostMapping("/{gameId}/players/{playerId}/pause")
    public ResponseEntity<PauseResumeResponse> pauseGame(
            @PathVariable String gameId,
            @PathVariable String playerId) {
        PauseResumeResponse response = gameService.pauseGame(gameId, playerId);
        return ResponseEntity.ok(response);
    }

    // POST /api/v1/games/{gameId}/players/{playerId}/resume — Resume Game
    @PostMapping("/{gameId}/players/{playerId}/resume")
    public ResponseEntity<PauseResumeResponse> resumeGame(
            @PathVariable String gameId,
            @PathVariable String playerId) {
        PauseResumeResponse response = gameService.resumeGame(gameId, playerId);
        return ResponseEntity.ok(response);
    }

    // POST /api/v1/games/{gameId}/players/{playerId}/stop — Stop Game (idempotent, 204 even if absent)
    @PostMapping("/{gameId}/players/{playerId}/stop")
    public ResponseEntity<Void> stopGame(
            @PathVariable String gameId,
            @PathVariable String playerId) {
        gameService.stopGame(gameId, playerId);
        return ResponseEntity.noContent().build();
    }

    // GET /api/v1/games/{code}/restore — Restore-by-Code (COMPUTER games only; 200 / 404)
    @GetMapping("/{code}/restore")
    public ResponseEntity<RestoreGameResponse> restoreGame(@PathVariable String code) {
        RestoreGameResponse response = gameService.restoreGame(code);
        return ResponseEntity.ok(response);
    }

    // GET /api/v1/games/{gameId}/state?playerId= — Get Game State
    @GetMapping("/{gameId}/state")
    public ResponseEntity<GameStateResponse> getGameState(
            @PathVariable String gameId,
            @RequestParam String playerId) {
        GameStateResponse response = gameService.getGameState(gameId, playerId);
        return ResponseEntity.ok(response);
    }
}
