package com.stampli.battleship.service;

import com.stampli.battleship.domain.*;
import com.stampli.battleship.dto.GameStateResponse;
import com.stampli.battleship.dto.PlaceShipResponse;
import com.stampli.battleship.repository.GameRepository;
import com.stampli.battleship.repository.MoveRepository;
import com.stampli.battleship.repository.PlayerRepository;
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

    @Mock
    private ComputerPlayerService computerPlayerService;

    @Mock
    private PlayerRepository playerRepository;

    @Mock
    private MoveRepository moveRepository;

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

    // -------------------------------------------------------------------------
    // getGameState — opponent board `hits` reveal (AC-7, AC-11, AC-12)
    // -------------------------------------------------------------------------

    private static final String PLAYER_B_ID = "player-b";

    /**
     * Builds an IN_PROGRESS game where Player B (the opponent) has a CRUISER placed
     * horizontally at (0,0)-(0,2). Returns the game; caller wires the shot history.
     */
    private Game inProgressGameWithOpponentCruiser() {
        Player playerB = new Player(PLAYER_B_ID, GAME_ID);
        gameWaitingForPlayers.addPlayerB(playerB);

        Coordinate anchor = new Coordinate(0, 0);
        Ship cruiser = new Ship(ShipType.CRUISER,
                Board.computeCells(ShipType.CRUISER, anchor, Orientation.HORIZONTAL),
                Orientation.HORIZONTAL);
        playerB.getBoard().placeShip(cruiser);

        gameWaitingForPlayers.startGame();
        return gameWaitingForPlayers;
    }

    @Test
    void getGameState_opponentBoardHitsContainsRequestersNonSunkHitCell() {
        Game game = inProgressGameWithOpponentCruiser();
        // Player A hits one cell of the 3-cell cruiser — ship is NOT sunk
        Player opponent = game.getPlayerB();
        Coordinate hitCell = new Coordinate(0, 0);
        opponent.getBoard().shipAt(hitCell).orElseThrow().recordHit(hitCell);
        game.addShot(new Shot(PLAYER_A_ID, hitCell, ShotResult.HIT));

        when(gameRepository.findById(GAME_ID)).thenReturn(Optional.of(game));

        GameStateResponse state = gameService.getGameState(GAME_ID, PLAYER_A_ID);

        assertThat(state.getOpponentBoard().getHits())
                .extracting("row", "col")
                .containsExactly(org.assertj.core.groups.Tuple.tuple(0, 0));
        // Not-yet-sunk ship is not revealed via ships
        assertThat(state.getOpponentBoard().getShips()).isEmpty();
    }

    @Test
    void getGameState_doesNotRevealUnhitCellsOfNotYetSunkOpponentShip() {
        Game game = inProgressGameWithOpponentCruiser();
        Player opponent = game.getPlayerB();
        Coordinate hitCell = new Coordinate(0, 0);
        opponent.getBoard().shipAt(hitCell).orElseThrow().recordHit(hitCell);
        game.addShot(new Shot(PLAYER_A_ID, hitCell, ShotResult.HIT));

        when(gameRepository.findById(GAME_ID)).thenReturn(Optional.of(game));

        GameStateResponse state = gameService.getGameState(GAME_ID, PLAYER_A_ID);

        // Un-fired ship cells (0,1) and (0,2) must NOT appear in hits or ships
        assertThat(state.getOpponentBoard().getHits())
                .extracting("row", "col")
                .doesNotContain(
                        org.assertj.core.groups.Tuple.tuple(0, 1),
                        org.assertj.core.groups.Tuple.tuple(0, 2));
        assertThat(state.getOpponentBoard().getShips()).isEmpty();
    }

    @Test
    void getGameState_opponentsOwnShotsDoNotAppearInRequestersView() {
        Game game = inProgressGameWithOpponentCruiser();
        Player opponent = game.getPlayerB();
        // Requester (A) hits (0,0)
        Coordinate myHit = new Coordinate(0, 0);
        opponent.getBoard().shipAt(myHit).orElseThrow().recordHit(myHit);
        game.addShot(new Shot(PLAYER_A_ID, myHit, ShotResult.HIT));
        // Opponent (B) records a HIT shot of its own at (5,5) — must never leak into A's opponent view
        game.addShot(new Shot(PLAYER_B_ID, new Coordinate(5, 5), ShotResult.HIT));

        when(gameRepository.findById(GAME_ID)).thenReturn(Optional.of(game));

        GameStateResponse state = gameService.getGameState(GAME_ID, PLAYER_A_ID);

        assertThat(state.getOpponentBoard().getHits())
                .extracting("row", "col")
                .containsExactly(org.assertj.core.groups.Tuple.tuple(0, 0))
                .doesNotContain(org.assertj.core.groups.Tuple.tuple(5, 5));
    }

    @Test
    void getGameState_myBoardHitsIsEmptyList() {
        Game game = inProgressGameWithOpponentCruiser();
        Player opponent = game.getPlayerB();
        Coordinate hitCell = new Coordinate(0, 0);
        opponent.getBoard().shipAt(hitCell).orElseThrow().recordHit(hitCell);
        game.addShot(new Shot(PLAYER_A_ID, hitCell, ShotResult.HIT));

        when(gameRepository.findById(GAME_ID)).thenReturn(Optional.of(game));

        GameStateResponse state = gameService.getGameState(GAME_ID, PLAYER_A_ID);

        // Own-board hits flow via ships[].hits, so the flat myBoard.hits array is always empty
        assertThat(state.getMyBoard().getHits()).isEmpty();
    }
}
