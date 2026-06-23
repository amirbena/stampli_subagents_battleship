package com.stampli.battleship.service;

import com.stampli.battleship.domain.*;
import com.stampli.battleship.dto.PlaceShipResponse;
import com.stampli.battleship.repository.GameRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GameServiceTest {

    @Mock
    private GameRepository gameRepository;

    @Mock
    private PlacementValidationService placementValidationService;

    @InjectMocks
    private GameService gameService;

    private static final String GAME_ID = "GAME01";
    private static final String PLAYER_A_ID = "player-a";

    private Game gameWaitingForPlayers;

    @BeforeEach
    void setUp() {
        Player playerA = new Player(PLAYER_A_ID, GAME_ID);
        // Game starts in WAITING_FOR_PLAYERS — Player B has not joined yet
        gameWaitingForPlayers = new Game(GAME_ID, playerA);
    }

    // -------------------------------------------------------------------------
    // placeShip — phase guard tests
    // -------------------------------------------------------------------------

    @Test
    void placeShip_succeedsWhenGameIsInWaitingForPlayersPhase() {
        // Player A should be able to pre-place ships before Player B joins
        when(gameRepository.findById(GAME_ID)).thenReturn(Optional.of(gameWaitingForPlayers));
        doNothing().when(placementValidationService).validateNotAlreadyPlaced(any(), any());
        doNothing().when(placementValidationService).validate(any(), any(), any(), any());

        PlaceShipResponse response = gameService.placeShip(
                GAME_ID, PLAYER_A_ID,
                ShipType.DESTROYER,
                new Coordinate(0, 0),
                Orientation.HORIZONTAL
        );

        assertThat(response).isNotNull();
        assertThat(response.getShipType()).isEqualTo("DESTROYER");
        verify(gameRepository).save(gameWaitingForPlayers);
    }

    @Test
    void placeShip_succeedsWhenGameIsInPlacingShipsPhase() {
        // Transition to PLACING_SHIPS by adding Player B
        Player playerB = new Player("player-b", GAME_ID);
        gameWaitingForPlayers.addPlayerB(playerB);
        assertThat(gameWaitingForPlayers.getStatus()).isEqualTo(GameStatus.PLACING_SHIPS);

        when(gameRepository.findById(GAME_ID)).thenReturn(Optional.of(gameWaitingForPlayers));
        doNothing().when(placementValidationService).validateNotAlreadyPlaced(any(), any());
        doNothing().when(placementValidationService).validate(any(), any(), any(), any());

        PlaceShipResponse response = gameService.placeShip(
                GAME_ID, PLAYER_A_ID,
                ShipType.DESTROYER,
                new Coordinate(0, 0),
                Orientation.HORIZONTAL
        );

        assertThat(response).isNotNull();
        assertThat(response.getShipType()).isEqualTo("DESTROYER");
    }

    @Test
    void placeShip_throwsWhenGameIsInProgress() {
        // Transition: add Player B → PLACING_SHIPS, then startGame → IN_PROGRESS
        Player playerB = new Player("player-b", GAME_ID);
        gameWaitingForPlayers.addPlayerB(playerB);
        gameWaitingForPlayers.startGame();
        assertThat(gameWaitingForPlayers.getStatus()).isEqualTo(GameStatus.IN_PROGRESS);

        when(gameRepository.findById(GAME_ID)).thenReturn(Optional.of(gameWaitingForPlayers));

        assertThatThrownBy(() -> gameService.placeShip(
                GAME_ID, PLAYER_A_ID,
                ShipType.DESTROYER,
                new Coordinate(0, 0),
                Orientation.HORIZONTAL
        ))
                .isInstanceOf(GameException.class)
                .hasMessageContaining("before the game starts");
    }

    // -------------------------------------------------------------------------
    // removeShip — phase guard tests
    // -------------------------------------------------------------------------

    @Test
    void removeShip_succeedsWhenGameIsInWaitingForPlayersPhase() {
        // Place a ship directly on the board so removal has something to remove
        Player playerA = gameWaitingForPlayers.getPlayerA();
        Coordinate anchor = new Coordinate(0, 0);
        Ship ship = new Ship(ShipType.DESTROYER,
                Board.computeCells(ShipType.DESTROYER, anchor, Orientation.HORIZONTAL),
                Orientation.HORIZONTAL);
        playerA.getBoard().placeShip(ship);

        when(gameRepository.findById(GAME_ID)).thenReturn(Optional.of(gameWaitingForPlayers));

        // Should not throw
        gameService.removeShip(GAME_ID, PLAYER_A_ID, ShipType.DESTROYER);

        verify(gameRepository).save(gameWaitingForPlayers);
    }

    @Test
    void removeShip_throwsWhenGameIsInProgress() {
        Player playerB = new Player("player-b", GAME_ID);
        gameWaitingForPlayers.addPlayerB(playerB);
        gameWaitingForPlayers.startGame();

        when(gameRepository.findById(GAME_ID)).thenReturn(Optional.of(gameWaitingForPlayers));

        assertThatThrownBy(() -> gameService.removeShip(GAME_ID, PLAYER_A_ID, ShipType.DESTROYER))
                .isInstanceOf(GameException.class)
                .hasMessageContaining("before the game starts");
    }
}
