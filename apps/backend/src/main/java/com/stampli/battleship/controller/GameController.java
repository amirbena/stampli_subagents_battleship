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
            @RequestParam(value = "mode", defaultValue = "HUMAN") String mode) {
        GameMode gameMode = GameMode.valueOf(mode.toUpperCase());
        CreateGameResponse response = gameService.createGame(gameMode);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // POST /api/v1/games/{gameId}/join — Join Game
    @PostMapping("/{gameId}/join")
    public ResponseEntity<JoinGameResponse> joinGame(@PathVariable String gameId) {
        JoinGameResponse response = gameService.joinGame(gameId);
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

    // GET /api/v1/games/{gameId}/state?playerId= — Get Game State
    @GetMapping("/{gameId}/state")
    public ResponseEntity<GameStateResponse> getGameState(
            @PathVariable String gameId,
            @RequestParam String playerId) {
        GameStateResponse response = gameService.getGameState(gameId, playerId);
        return ResponseEntity.ok(response);
    }
}
