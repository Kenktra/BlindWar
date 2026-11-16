import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ARMY_COMPOSITION,
  CARD_CATALOG,
  CARD_DOSSIERS,
  CHARACTER_CATALOG,
  CHARACTER_DOSSIERS,
  CHARACTER_TYPES,
  FAQ_ITEMS,
  MECHANIC_DOSSIERS,
  RULE_SECTIONS,
  SETTINGS_HELP_ITEMS,
  TOTAL_PIECES_PER_PLAYER,
  autoCompletePlacement,
  canPlayerPlayCard,
  computeGuetteurReconZoneKeys,
  coordKey,
  coordToNotation,
  countCharacters,
  executePieceMove,
  finalizePlacementOnTimerExpired,
  generateCavalierJumpCandidates,
  generateMoveCandidatesForPiece,
  generateRetreatCandidatesForPiece,
  generateTeleportCandidatesForPiece,
  generateTraqueurMarkCandidates,
  getOwnEdgeRow,
  isCardAllowedOnCharacter,
  isInPlacementZone,
  markTraqueurTarget,
  playCard,
  projectMatchStateForViewer,
  proposeOrAcceptMutualDraw,
  resignMatch,
  runDefaultTutorialOpponentStep,
  selectSoldierPromotion,
  skipBerserkerRageMove,
  stopCavalierJumpChain,
  submitPlayerPlacement,
  tickMatchClock,
  type AnnotationColor,
  type AnnotationTool,
  type CardDrawNotificationView,
  type CardNotificationCategory,
  type CardNotificationView,
  type CardPlayPayload,
  type CardType,
  type CharacterType,
  type ClientMatchView,
  type Coord,
  type GameEventType,
  type LastMoveInfo,
  type MoveCandidate,
  type MoveCandidateKind,
  type PersonalBoardAnnotations,
  type PlacementEntry,
  type PlayerColor,
  type ServerMatchState,
  type ServerPieceRecord,
  type TutorialScenarioSpec,
  type VisibilityContext,
} from '../../../shared/src/index.js';
import {
  clearAllPersonalAnnotations,
  countPersonalAnnotations,
  createInitialAnnotationsByPlayer,
  eraseAnnotationsAtSquare,
  removeArrowById,
  toggleOrReplaceSquareMark,
  toggleOrUpsertArrow,
} from '../board/annotations.js';
import { PhaserBoardCanvas } from '../board/PhaserBoardCanvas.js';
import { selectContextualTip } from '../board/contextualTutorials.js';
import { PieceArtwork, PieceDualVariantPreview } from '../components/PieceArtwork.js';
import { PieceDescriptionPanel } from '../components/PieceDescriptionPanel.js';
import {
  type UserSettings,
  dismissContextualTip,
  loadDismissedContextualTips,
  markTutorialScenarioCompleted,
  playTacticalSfx,
  resetContextualTips,
} from '../services/apiClient.js';

type MobileDrawerTab = 'none' | 'cards' | 'log' | 'graveyard' | 'effects' | 'menu';

const EVENT_TYPE_META: Readonly<
  Record<GameEventType, { readonly icon: string; readonly label: string; readonly colorClass: string }>
> = {
  PIECE_MOVED: { icon: 'DEPL', label: 'Déplacement', colorClass: 'bw-ev-move' },
  PIECE_CAPTURED: { icon: 'ELIM', label: 'Élimination', colorClass: 'bw-ev-capture' },
  CARD_PLAYED: { icon: '🃏', label: 'Carte jouée', colorClass: 'bw-ev-card' },
  EFFECT_ACTIVATED: { icon: '⚡', label: 'Effet déclenché', colorClass: 'bw-ev-effect' },
  PIECE_REVEALED: { icon: '👁️', label: 'Révélation', colorClass: 'bw-ev-reveal' },
  TURN_CHANGED: { icon: '🔄', label: 'Changement de tour', colorClass: 'bw-ev-turn' },
  GAME_ENDED: { icon: '🏁', label: 'Fin de partie', colorClass: 'bw-ev-end' },
};

const CARD_CATEGORY_META: Readonly<
  Record<CardNotificationCategory, { readonly label: string; readonly className: string }>
> = {
  offensive: { label: 'CARTE OFFENSIVE', className: 'bw-card-cat-offensive' },
  defensive: { label: 'CARTE DÉFENSIVE', className: 'bw-card-cat-defensive' },
  recon: { label: 'RECONNAISSANCE', className: 'bw-card-cat-recon' },
  tactical: { label: 'MANŒUVRE TACTIQUE', className: 'bw-card-cat-control' },
};

function formatLastMoveSummary(lastMove: LastMoveInfo): {
  readonly badge: string;
  readonly mainText: string;
  readonly detailText: string | null;
} {
  const actorLabel = lastMove.actor === 'red' ? '🔴 Rouge' : '⚫ Noir';
  const fromNot = lastMove.from ? coordToNotation(lastMove.from) : null;
  const toNot = coordToNotation(lastMove.to);
  const elimNots = lastMove.eliminatedCoords.map(coordToNotation);

  switch (lastMove.kind) {
    case 'cavalier_leap':
      return {
        badge: 'Bond Équestre (L)',
        mainText: `${actorLabel} : Cavalier ${fromNot ?? '?'} ↷ ${toNot}`,
        detailText:
          elimNots.length > 0
            ? `Élimination après bond en ${elimNots.join(', ')}`
            : 'Bond en « L » par-dessus les obstacles intermédiaires',
      };
    case 'cavalier_jump': {
      const chainPath =
        lastMove.steps.length > 1
          ? [
              coordToNotation(lastMove.steps[0]!.from),
              ...lastMove.steps.map((s) => coordToNotation(s.to)),
            ].join(' → ')
          : `${fromNot ?? '?'} → ${toNot}`;
      return {
        badge: 'Saut Percée (Cavalier)',
        mainText: `${actorLabel} : ${chainPath}`,
        detailText:
          elimNots.length > 0
            ? `Pièce(s) éliminée(s) en ${elimNots.join(', ')}`
            : null,
      };
    }
    case 'berserker_rage': {
      const chainPath =
        lastMove.steps.length > 1
          ? [
              coordToNotation(lastMove.steps[0]!.from),
              ...lastMove.steps.map((s) => coordToNotation(s.to)),
            ].join(' → ')
          : `${fromNot ?? '?'} → ${toNot}`;
      return {
        badge: '⚔ Rage Berserker',
        mainText: `${actorLabel} : ${chainPath}`,
        detailText:
          elimNots.length > 0
            ? `Élimination en ${elimNots.join(', ')} + 2e déplacement`
            : '2e déplacement de Rage',
      };
    }
    case 'teleportation':
      return {
        badge: '🌀 Téléportation',
        mainText: `${actorLabel} : ${fromNot ?? '?'} ⇢ ${toNot}`,
        detailText: 'Déplacement par carte Téléportation',
      };
    case 'retreat_move':
      return {
        badge: '↩️ Retreat',
        mainText: `${actorLabel} : ${fromNot ?? '?'} → ${toNot}`,
        detailText: 'Repli tactique d’1 case en arrière',
      };
    case 'retreat_capture':
      return {
        badge: 'Retreat Offensif',
        mainText: `${actorLabel} : ${fromNot ?? '?'} → ${toNot}`,
        detailText:
          elimNots.length > 0
            ? `Élimination arrière en ${elimNots.join(', ')}`
            : 'Attaque arrière',
      };
    case 'resurrection':
      return {
        badge: '✨ Résurrection',
        mainText: `${actorLabel} : Déploiement en ${toNot}`,
        detailText: 'Retour d’une pièce alliée sur sa ligne de départ',
      };
    case 'recrutement':
      return {
        badge: '🎺 Recrutement',
        mainText: `${actorLabel} : Soldat déployé en ${toNot}`,
        detailText: 'Renfort Soldat sur la ligne de départ',
      };
    case 'piercing_strike':
      return {
        badge: 'Frappe Traversante',
        mainText: `${actorLabel} : Exécuteur ${fromNot ?? '?'} → ${toNot}`,
        detailText:
          elimNots.length > 0
            ? `Cible arrière abattue en ${elimNots.join(', ')}${lastMove.passedThroughCoord ? ` (à travers ${coordToNotation(lastMove.passedThroughCoord)})` : ''}`
            : lastMove.blockedAtCoord
              ? `Frappe bloquée en ${coordToNotation(lastMove.blockedAtCoord)}`
              : 'Frappe traversante sans mouvement',
      };
    case 'crossbow_shot':
      return {
        badge: 'Tir d’Arbalète',
        mainText: `${actorLabel} : Arbalétrier ${fromNot ?? '?'} → ${toNot}`,
        detailText:
          elimNots.length > 0
            ? `Cible éliminée à distance en ${elimNots.join(', ')}`
            : lastMove.blockedAtCoord
              ? `Tir bloqué en ${coordToNotation(lastMove.blockedAtCoord)}`
              : 'Tir à distance sans déplacement',
      };
    case 'capture_move':
      return {
        badge: 'Élimination',
        mainText: `${actorLabel} : ${fromNot ?? '?'} → ${toNot}`,
        detailText:
          elimNots.length > 0
            ? `Pièce éliminée en ${elimNots.join(', ')}${lastMove.promotedAtCoord ? ' • Soldat promu !' : ''}`
            : lastMove.blockedAtCoord
              ? `Attaque bloquée en ${coordToNotation(lastMove.blockedAtCoord)}`
              : null,
      };
    case 'promotion':
      return {
        badge: 'Promotion',
        mainText: `${actorLabel} : ${fromNot ?? '?'} → ${toNot}`,
        detailText: 'Soldat promu au bord adverse !',
      };
    case 'normal_move':
    default:
      return {
        badge: lastMove.promotedAtCoord ? 'Promotion' : 'Dernier coup',
        mainText: `${actorLabel} : ${fromNot ?? '?'} → ${toNot}`,
        detailText: lastMove.promotedAtCoord
          ? 'Soldat promu au bord adverse !'
          : lastMove.blockedAtCoord
            ? `🛡️ Attaque bloquée en ${coordToNotation(lastMove.blockedAtCoord)}`
            : null,
      };
  }
}

/**
 * Reconstructs a client-safe ServerPieceRecord array & VisibilityContext from the
 * viewer's projected view for move, Traqueur-mark, and card target highlighting.
 */
function buildPseudoServerPiecesAndContext(
  view: ClientMatchView,
  viewerColor: PlayerColor,
): { readonly pieces: ServerPieceRecord[]; readonly visContext: VisibilityContext } {
  const viewerMarkedTargetId =
    view.pieces.find((ep) => ep.owner !== viewerColor && ep.traqueurMarkedByViewer)?.id ?? null;

  const pieces: ServerPieceRecord[] = view.pieces.map((pv) => ({
    id: pv.id,
    owner: pv.owner,
    character: pv.character ?? 'soldat',
    promotedFrom: null,
    position: pv.position,
    alive: true,
    progressionDirection:
      pv.progressionDirectionVisible ?? (pv.owner === 'red' ? -1 : 1),
    reversalCount: 0,
    kamikazeHitsTaken: pv.kamikazeHitsTakenVisible ?? 0,
    hasKamikaze: pv.hasKamikazeVisible,
    invincibleTicksRemaining: pv.isInvincible ? 2 : 0,
    hasProtection: pv.isProtectedVisible,
    counterEspionageTicksRemaining: pv.hasCounterEspionageVisible ? 2 : 0,
    espionageRevealedTicksTo: { red: 0, black: 0 },
    tempRevealedTicksTo: {
      red:
        (pv.revealKind === 'temporary' || pv.revealKind === 'proximity') &&
        viewerColor === 'red'
          ? 2
          : 0,
      black:
        (pv.revealKind === 'temporary' || pv.revealKind === 'proximity') &&
        viewerColor === 'black'
          ? 2
          : 0,
    },
    permanentlyRevealedTo: {
      red: pv.revealKind === 'permanent' && viewerColor === 'red',
      black: pv.revealKind === 'permanent' && viewerColor === 'black',
    },
    immobilizedTicksRemaining: pv.isImmobilized ? 2 : 0,
    traqueurMarkedTargetId:
      pv.character === 'traqueur' && pv.owner === viewerColor ? viewerMarkedTargetId : null,
    traqueurPursuitReady: pv.traqueurPursuitReadyVisible ?? false,
    arbaletrierCooldownTurnsRemaining: pv.arbaletrierCooldownTurnsVisible ?? 0,
  }));

  const visContext: VisibilityContext = {
    fogTurnsRemainingByOwner: {
      red: view.fogActiveByPlayer.red ? 2 : 0,
      black: view.fogActiveByPlayer.black ? 2 : 0,
    },
    viewerGuetteurReconKeys: computeGuetteurReconZoneKeys(pieces, viewerColor),
  };

  return { pieces, visContext };
}

export interface GameBoardScreenProps {
  readonly mode: 'local' | 'online' | 'tutorial';
  readonly initialLocalState?: ServerMatchState;
  readonly onlineView?: ClientMatchView | null;
  readonly onlineRoomId?: string | null;
  readonly onlinePrepRemainingSec?: number | null;
  readonly tutorialScenario?: TutorialScenarioSpec | null;
  readonly settings: UserSettings;
  readonly onOnlineAction?: {
    readonly submitPlacement: (entries: readonly PlacementEntry[]) => void;
    readonly movePiece: (
      pieceId: string,
      destination: Coord,
      preferredKind?: MoveCandidateKind,
    ) => void;
    readonly markTraqueur?: (traqueurPieceId: string, targetEnemyPieceId: string) => void;
    readonly stopJump: () => void;
    readonly skipRage: () => void;
    readonly promoteSoldier: (chosen: CharacterType) => void;
    readonly playCard: (payload: CardPlayPayload) => void;
    readonly offerDraw: () => void;
    readonly resign: () => void;
  };
  readonly onMatchConcluded: (summary: {
    readonly winner: PlayerColor | 'draw';
    readonly perspectiveColor: PlayerColor;
    readonly reason: string;
    readonly turnsPlayed: number;
    readonly mode: string;
  }) => void;
  readonly onExitToMenu: () => void;
  readonly onNextTutorialStep?: () => void;
  readonly onTutorialCompleted?: (scenarioId: string) => void;
}

function formatClockMs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export const GameBoardScreen: React.FC<GameBoardScreenProps> = ({
  mode,
  initialLocalState,
  onlineView,
  onlinePrepRemainingSec,
  tutorialScenario,
  settings,
  onOnlineAction,
  onMatchConcluded,
  onExitToMenu,
  onNextTutorialStep,
  onTutorialCompleted,
}) => {
  const [localState, setLocalState] = useState<ServerMatchState>(() =>
    initialLocalState
      ? initialLocalState
      : tutorialScenario
        ? tutorialScenario.createInitialState()
        : (() => {
            throw new Error('État local initial requis');
          })(),
  );

  // Reset state when switching tutorial scenarios
  useEffect(() => {
    if (mode === 'tutorial' && tutorialScenario) {
      setLocalState(tutorialScenario.createInitialState());
      setSelectedSquare(null);
      setActiveCardInUse(null);
      setCardSourcePieceId(null);
      setEspionageSelectedIds([]);
      setTraqueurMarkModePieceId(null);
      setPendingMoveDisambiguation(null);
      setStatusError(null);
      setShowTutorialHints(false);
      emittedTutorialCompletionRef.current = null;
    }
  }, [mode, tutorialScenario]);

  // Local mode active viewer & privacy curtain (§12.1)
  const [localPlacementTurn, setLocalPlacementTurn] = useState<PlayerColor>('red');
  const [privacyCurtainFor, setPrivacyCurtainFor] = useState<PlayerColor | null>(null);
  const [stagedPlacement, setStagedPlacement] = useState<PlacementEntry[]>([]);
  const [selectedBrushCharacter, setSelectedBrushCharacter] = useState<CharacterType>('soldat');
  const [localPrepSecondsLeft, setLocalPrepSecondsLeft] = useState<number>(
    initialLocalState?.ruleset.prepDurationSeconds ?? 90,
  );

  // Board interaction states
  const [selectedSquare, setSelectedSquare] = useState<Coord | null>(null);
  const [inspectedSquare, setInspectedSquare] = useState<Coord | null>(null);
  const [traqueurMarkModePieceId, setTraqueurMarkModePieceId] = useState<string | null>(null);
  const [pendingMoveDisambiguation, setPendingMoveDisambiguation] = useState<{
    readonly pieceId: string;
    readonly destination: Coord;
    readonly candidates: readonly MoveCandidate[];
    readonly isCaptureTarget: boolean;
  } | null>(null);
  const [activeCardInUse, setActiveCardInUse] = useState<CardType | null>(null);
  const [confirmingCard, setConfirmingCard] = useState<CardType | null>(null);
  const [cardSourcePieceId, setCardSourcePieceId] = useState<string | null>(null);
  const [selectedGraveyardPieceId, setSelectedGraveyardPieceId] = useState<string | null>(null);
  const [espionageSelectedIds, setEspionageSelectedIds] = useState<string[]>([]);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [showInGameRulesModal, setShowInGameRulesModal] = useState<boolean>(false);
  const [rulesModalTab, setRulesModalTab] = useState<'rules' | 'mechanics' | 'characters' | 'faq'>('rules');
  const [showTutorialHints, setShowTutorialHints] = useState<boolean>(false);
  const [dismissedContextualIds, setDismissedContextualIds] = useState<string[]>(() =>
    loadDismissedContextualTips(),
  );
  const emittedTutorialCompletionRef = useRef<string | null>(null);
  const onTutorialCompletedRef = useRef(onTutorialCompleted);
  onTutorialCompletedRef.current = onTutorialCompleted;
  const [showCardHistoryModal, setShowCardHistoryModal] = useState<boolean>(false);
  const [confirmingResign, setConfirmingResign] = useState<boolean>(false);
  const [pendingImportantConfirm, setPendingImportantConfirm] = useState<'draw' | 'exit' | null>(null);
  const [mobileDrawer, setMobileDrawer] = useState<MobileDrawerTab>('none');
  const [activeOpponentCardAlert, setActiveOpponentCardAlert] =
    useState<CardNotificationView | null>(null);
  const [lastSeenCardAlertId, setLastSeenCardAlertId] = useState<string | null>(null);

  // Feature 1: Own Newly Obtained Card Indicator
  const [activeNewCardAlert, setActiveNewCardAlert] =
    useState<CardDrawNotificationView | null>(null);
  const [highlightedNewCardKey, setHighlightedNewCardKey] = useState<string | null>(null);
  const seenCardDrawKeysRef = useRef<Set<string>>(new Set());
  const drawMountTimeRef = useRef<number>(Date.now());

  // Feature 2: Match-start transition banner when both placements complete
  const [showMatchStartBanner, setShowMatchStartBanner] = useState<boolean>(false);

  // Feature 3: Strictly personal tactical annotations (isolated per viewerColor)
  const [annotationsByPlayer, setAnnotationsByPlayer] = useState<
    Record<PlayerColor, PersonalBoardAnnotations>
  >(() => createInitialAnnotationsByPlayer());
  const [annotationModeActive, setAnnotationModeActive] = useState<boolean>(false);
  const [annotationTool, setAnnotationTool] = useState<AnnotationTool>('arrow');
  const [activeAnnotationColor, setActiveAnnotationColor] = useState<AnnotationColor>('red');
  const [pendingArrowStart, setPendingArrowStart] = useState<Coord | null>(null);
  const [autoClearAnnotationsOnMove, setAutoClearAnnotationsOnMove] = useState<boolean>(false);

  // Determine current viewer color and projected view
  const viewerColor: PlayerColor = useMemo(() => {
    if (mode === 'online' && onlineView) {
      return onlineView.viewerColor;
    }
    if (mode === 'tutorial') {
      return 'red';
    }
    if (localState.phase === 'placement') {
      return localPlacementTurn;
    }
    return localState.turn.activePlayer;
  }, [mode, onlineView, localState.phase, localState.turn.activePlayer, localPlacementTurn]);

  const view: ClientMatchView = useMemo(() => {
    if (mode === 'online' && onlineView) {
      return onlineView;
    }
    return projectMatchStateForViewer(localState, viewerColor);
  }, [mode, onlineView, localState, viewerColor]);

  const ownPlacementConfirmed = view.placementStatus.ownConfirmed;
  const effectiveStagedPlacement = useMemo(
    () =>
      ownPlacementConfirmed && view.ownConfirmedPlacement.length > 0
        ? view.ownConfirmedPlacement
        : stagedPlacement,
    [ownPlacementConfirmed, view.ownConfirmedPlacement, stagedPlacement],
  );
  const currentViewerAnnotations = annotationsByPlayer[viewerColor];
  const currentViewerAnnotationCount = countPersonalAnnotations(currentViewerAnnotations);

  // Detect new opponent card notification and display high-visibility animated alert (§2.2 - §2.4)
  useEffect(() => {
    if (mode === 'local' && privacyCurtainFor !== null) {
      return;
    }
    const opponentCards = view.cardNotifications.filter((n) => n.actor !== viewerColor);
    if (opponentCards.length === 0) {
      return;
    }
    const latest = opponentCards[opponentCards.length - 1]!;
    if (latest.id !== lastSeenCardAlertId) {
      setLastSeenCardAlertId(latest.id);
      setActiveOpponentCardAlert(latest);
      playTacticalSfx('card');
    }
  }, [view.cardNotifications, viewerColor, lastSeenCardAlertId, mode, privacyCurtainFor]);

  // Auto-fade opponent card notification after 9 seconds while keeping manual close available
  useEffect(() => {
    if (!activeOpponentCardAlert) {
      return;
    }
    const timer = setTimeout(() => {
      setActiveOpponentCardAlert((curr) =>
        curr?.id === activeOpponentCardAlert.id ? null : curr,
      );
    }, 9000);
    return () => clearTimeout(timer);
  }, [activeOpponentCardAlert]);

  // Feature 1: Detect new card drawn into own hand & trigger immediate notification + glow highlight
  useEffect(() => {
    if (mode === 'local' && privacyCurtainFor !== null) {
      return;
    }
    const latestDraw = view.ownLastCardDraw;
    if (!latestDraw) {
      return;
    }
    const uniqueKey = `${view.matchId}:${viewerColor}:${latestDraw.id}`;
    if (seenCardDrawKeysRef.current.has(uniqueKey)) {
      return;
    }
    seenCardDrawKeysRef.current.add(uniqueKey);

    // Avoid flashing stale historical draws upon late reconnect in online games
    if (mode !== 'local' && latestDraw.timestampMs < drawMountTimeRef.current - 8000) {
      return;
    }

    setActiveNewCardAlert(latestDraw);
    const matchingIdx = view.ownHand.lastIndexOf(latestDraw.card);
    if (matchingIdx !== -1) {
      setHighlightedNewCardKey(`${latestDraw.card}-${matchingIdx}`);
    }
    playTacticalSfx('card');
  }, [
    view.matchId,
    view.ownLastCardDraw,
    view.ownHand,
    viewerColor,
    mode,
    privacyCurtainFor,
  ]);

  useEffect(() => {
    if (!activeNewCardAlert) {
      return;
    }
    const timer = setTimeout(() => {
      setActiveNewCardAlert((curr) => (curr?.id === activeNewCardAlert.id ? null : curr));
    }, 6500);
    return () => clearTimeout(timer);
  }, [activeNewCardAlert]);

  useEffect(() => {
    if (!highlightedNewCardKey) {
      return;
    }
    const timer = setTimeout(() => {
      setHighlightedNewCardKey(null);
    }, 7000);
    return () => clearTimeout(timer);
  }, [highlightedNewCardKey]);

  // Feature 2: Detect transition from placement -> playing (both players confirmed)
  const prevPhaseRef = useRef(view.phase);
  useEffect(() => {
    if (prevPhaseRef.current === 'placement' && view.phase === 'playing') {
      setShowMatchStartBanner(true);
    }
    prevPhaseRef.current = view.phase;
  }, [view.phase]);

  useEffect(() => {
    if (!showMatchStartBanner) {
      return;
    }
    const timer = setTimeout(() => setShowMatchStartBanner(false), 5000);
    return () => clearTimeout(timer);
  }, [showMatchStartBanner]);

  // Keep tactical touch interaction cleanly reset across local player transitions
  useEffect(() => {
    if (privacyCurtainFor !== null) {
      setPendingArrowStart(null);
      setAnnotationModeActive(false);
      setTraqueurMarkModePieceId(null);
      setPendingMoveDisambiguation(null);
    }
  }, [privacyCurtainFor]);

  const handleUpsertPersonalArrow = (from: Coord, to: Coord) => {
    setAnnotationsByPlayer((prev) => ({
      ...prev,
      [viewerColor]: toggleOrUpsertArrow(prev[viewerColor], from, to, activeAnnotationColor),
    }));
  };

  const handleTogglePersonalSquareMark = (coord: Coord) => {
    setAnnotationsByPlayer((prev) => ({
      ...prev,
      [viewerColor]: toggleOrReplaceSquareMark(prev[viewerColor], coord, activeAnnotationColor),
    }));
  };

  const handleRemovePersonalArrow = (arrowId: string) => {
    setAnnotationsByPlayer((prev) => ({
      ...prev,
      [viewerColor]: removeArrowById(prev[viewerColor], arrowId),
    }));
  };

  const handleClearViewerAnnotations = () => {
    setPendingArrowStart(null);
    setAnnotationsByPlayer((prev) => ({
      ...prev,
      [viewerColor]: clearAllPersonalAnnotations(),
    }));
  };

  const maybeAutoClearViewerAnnotations = () => {
    if (!autoClearAnnotationsOnMove) {
      return;
    }
    setPendingArrowStart(null);
    setAnnotationsByPlayer((prev) => ({
      ...prev,
      [viewerColor]: clearAllPersonalAnnotations(),
    }));
  };

  // Local preparation countdown timer (§3.2)
  useEffect(() => {
    if (mode !== 'local' || localState.phase !== 'placement' || privacyCurtainFor !== null) {
      return;
    }
    const id = setInterval(() => {
      setLocalPrepSecondsLeft((prev) => {
        if (prev <= 1) {
          // Auto-complete remaining pieces when prep timer hits 0 (§3.2)
          const completed = autoCompletePlacement(localPlacementTurn, stagedPlacement);
          handleConfirmPlacementEntries(completed);
          return localState.ruleset.prepDurationSeconds;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [mode, localState.phase, localPlacementTurn, privacyCurtainFor, stagedPlacement]);

  // Local playing dual chess clock ticker (§11)
  useEffect(() => {
    if (mode !== 'local' || localState.phase !== 'playing' || privacyCurtainFor !== null) {
      return;
    }
    const id = setInterval(() => {
      setLocalState((prev) => tickMatchClock(prev, Date.now()));
    }, 500);
    return () => clearInterval(id);
  }, [mode, localState.phase, privacyCurtainFor]);

  // Trigger conclusion callback when match ends (except in tutorial where we show lesson victory banner)
  useEffect(() => {
    if (mode === 'tutorial') {
      return;
    }
    if (view.phase === 'finished' && view.winner && view.outcomeReason) {
      playTacticalSfx('victory');
      onMatchConcluded({
        winner: view.winner,
        perspectiveColor: viewerColor,
        reason: view.outcomeReason,
        turnsPlayed: view.turn.turnNumber,
        mode: view.mode,
      });
    }
  }, [view.phase, view.winner, view.outcomeReason, mode, viewerColor, view.turn.turnNumber, view.mode, onMatchConcluded]);

  const tutorialCompleted = useMemo(() => {
    if (mode !== 'tutorial' || !tutorialScenario) return false;
    return tutorialScenario.checkCompleted(localState);
  }, [mode, tutorialScenario, localState]);

  useEffect(() => {
    if (mode === 'tutorial' && tutorialScenario && tutorialCompleted) {
      if (emittedTutorialCompletionRef.current === tutorialScenario.id) {
        return;
      }
      emittedTutorialCompletionRef.current = tutorialScenario.id;
      markTutorialScenarioCompleted(tutorialScenario.id);
      onTutorialCompletedRef.current?.(tutorialScenario.id);
    }
  }, [mode, tutorialScenario, tutorialCompleted]);

  // Smoothly advance opponent turn in interactive multi-turn tutorial lessons
  useEffect(() => {
    if (
      mode !== 'tutorial' ||
      !tutorialScenario ||
      localState.phase !== 'playing' ||
      localState.turn.activePlayer !== 'black' ||
      tutorialCompleted
    ) {
      return;
    }
    const timer = setTimeout(() => {
      setLocalState((prev) => {
        if (prev.phase !== 'playing' || prev.turn.activePlayer !== 'black') {
          return prev;
        }
        return (
          (tutorialScenario.stepOpponentTurn
            ? tutorialScenario.stepOpponentTurn(prev)
            : runDefaultTutorialOpponentStep(prev)) ?? prev
        );
      });
    }, 450);
    return () => clearTimeout(timer);
  }, [mode, tutorialScenario, localState.phase, localState.turn.activePlayer, tutorialCompleted]);

  const placedCounts = useMemo(
    () => countCharacters(effectiveStagedPlacement.map((e) => e.character)),
    [effectiveStagedPlacement],
  );

  const handleConfirmPlacementEntries = (entriesToSubmit: readonly PlacementEntry[]) => {
    setStatusError(null);
    if (ownPlacementConfirmed) {
      setStatusError('Votre placement a déjà été validé et verrouillé.');
      return;
    }
    try {
      if (mode === 'online' && onOnlineAction) {
        onOnlineAction.submitPlacement(entriesToSubmit);
        playTacticalSfx('card');
        return;
      }

      const prevPlayer = localPlacementTurn;
      const nextState = submitPlayerPlacement(localState, prevPlayer, entriesToSubmit, Date.now());
      setLocalState(nextState);
      setStagedPlacement([]);
      playTacticalSfx('card');

      if (prevPlayer === 'red' && nextState.phase === 'placement') {
        setLocalPlacementTurn('black');
        setLocalPrepSecondsLeft(localState.ruleset.prepDurationSeconds);
        setPrivacyCurtainFor('black');
      } else if (nextState.phase === 'playing') {
        setPrivacyCurtainFor('red');
      }
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Placement invalide');
    }
  };

  const selectedOwnPieceView = useMemo(() => {
    if (view.phase !== 'playing' || !selectedSquare || view.turn.activePlayer !== viewerColor) {
      return null;
    }
    return (
      view.pieces.find(
        (p) =>
          p.position.row === selectedSquare.row &&
          p.position.col === selectedSquare.col &&
          p.owner === viewerColor,
      ) ?? null
    );
  }, [view.phase, view.pieces, view.turn.activePlayer, selectedSquare, viewerColor]);

  // Compute legal moves for the currently selected piece
  const highlightedMoves: readonly MoveCandidate[] = useMemo(() => {
    if (
      view.phase !== 'playing' ||
      !selectedOwnPieceView ||
      activeCardInUse !== null ||
      traqueurMarkModePieceId !== null
    ) {
      return [];
    }

    const { pieces: pseudoServerPieces, visContext } = buildPseudoServerPiecesAndContext(
      view,
      viewerColor,
    );
    const selectedPseudo = pseudoServerPieces.find((p) => p.id === selectedOwnPieceView.id);
    if (!selectedPseudo) return [];

    if (view.turn.pendingCavalierJumpPieceId) {
      if (view.turn.pendingCavalierJumpPieceId !== selectedPseudo.id) return [];
      return generateCavalierJumpCandidates(selectedPseudo, pseudoServerPieces, visContext);
    }

    if (view.turn.pendingBerserkerRagePieceId) {
      if (view.turn.pendingBerserkerRagePieceId !== selectedPseudo.id) return [];
      return generateMoveCandidatesForPiece(selectedPseudo, pseudoServerPieces, visContext, true);
    }

    return generateMoveCandidatesForPiece(selectedPseudo, pseudoServerPieces, visContext, false);
  }, [view, selectedOwnPieceView, activeCardInUse, traqueurMarkModePieceId, viewerColor]);

  // Compute legal enemy pieces markable by the currently selected Traqueur (§3.3)
  const traqueurMarkTargets = useMemo(() => {
    if (
      view.phase !== 'playing' ||
      !selectedOwnPieceView ||
      selectedOwnPieceView.character !== 'traqueur' ||
      activeCardInUse !== null ||
      view.turn.pendingCavalierJumpPieceId ||
      view.turn.pendingBerserkerRagePieceId ||
      view.turn.pendingPromotionPieceId
    ) {
      return [];
    }
    const { pieces: pseudoServerPieces, visContext } = buildPseudoServerPiecesAndContext(
      view,
      viewerColor,
    );
    const selectedPseudo = pseudoServerPieces.find((p) => p.id === selectedOwnPieceView.id);
    if (!selectedPseudo) return [];
    return generateTraqueurMarkCandidates(selectedPseudo, pseudoServerPieces, visContext);
  }, [view, selectedOwnPieceView, activeCardInUse, viewerColor]);

  const highlightedTraqueurMarkCoords: readonly Coord[] = useMemo(() => {
    if (!selectedOwnPieceView || traqueurMarkModePieceId !== selectedOwnPieceView.id) {
      return [];
    }
    return traqueurMarkTargets
      .map((t) => t.position)
      .filter((c): c is Coord => c !== null);
  }, [selectedOwnPieceView, traqueurMarkModePieceId, traqueurMarkTargets]);

  const activeContextualTip = useMemo(() => {
    if (mode === 'tutorial') {
      return null;
    }
    return selectContextualTip({
      view,
      selectedPiece: selectedOwnPieceView,
      dismissedIds: dismissedContextualIds,
      enabled: settings.enableContextualTutorials,
    });
  }, [
    mode,
    view,
    selectedOwnPieceView,
    dismissedContextualIds,
    settings.enableContextualTutorials,
  ]);

  // Compute valid target squares when a card is active
  const highlightedCardSquares: readonly Coord[] = useMemo(() => {
    if (view.phase !== 'playing' || !activeCardInUse) {
      return [];
    }

    const { pieces: pseudoServerPieces, visContext } = buildPseudoServerPiecesAndContext(
      view,
      viewerColor,
    );

    if (
      activeCardInUse === 'kamikaze' ||
      activeCardInUse === 'invincibilite' ||
      activeCardInUse === 'protection' ||
      activeCardInUse === 'contre_espionnage'
    ) {
      return view.pieces
        .filter((pv) => {
          if (pv.owner !== viewerColor || !pv.character) return false;
          if (!isCardAllowedOnCharacter(activeCardInUse, pv.character)) return false;
          if (activeCardInUse === 'kamikaze' && pv.hasKamikazeVisible) return false;
          if (activeCardInUse === 'protection' && pv.isProtectedVisible) return false;
          return true;
        })
        .map((pv) => pv.position);
    }

    if (activeCardInUse === 'sacrifice') {
      return view.pieces
        .filter((pv) => pv.owner === viewerColor && pv.character === 'soldat')
        .map((pv) => pv.position);
    }

    if (
      activeCardInUse === 'revelation_temporaire' ||
      activeCardInUse === 'revelation_permanente' ||
      activeCardInUse === 'espionnage'
    ) {
      return view.pieces
        .filter((pv) => pv.owner !== viewerColor)
        .map((pv) => pv.position);
    }

    if (activeCardInUse === 'teleportation' && cardSourcePieceId) {
      const src = pseudoServerPieces.find((p) => p.id === cardSourcePieceId);
      return src ? generateTeleportCandidatesForPiece(src, pseudoServerPieces) : [];
    }

    if (activeCardInUse === 'retreat' && cardSourcePieceId) {
      const src = pseudoServerPieces.find((p) => p.id === cardSourcePieceId);
      return src
        ? generateRetreatCandidatesForPiece(src, pseudoServerPieces, visContext).map((m) => m.to)
        : [];
    }

    if (activeCardInUse === 'resurrection' || activeCardInUse === 'recrutement') {
      const backRow = getOwnEdgeRow(viewerColor);
      const occupied = new Set(view.pieces.map((p) => coordKey(p.position)));
      const coords: Coord[] = [];
      for (let col = 0; col < 9; col += 1) {
        const c = { row: backRow, col };
        if (!occupied.has(coordKey(c))) {
          coords.push(c);
        }
      }
      return coords;
    }

    if (activeCardInUse === 'piege') {
      const occupied = new Set(view.pieces.map((p) => coordKey(p.position)));
      const traps = new Set(view.ownTraps.map(coordKey));
      const coords: Coord[] = [];
      for (let row = 0; row < 9; row += 1) {
        for (let col = 0; col < 9; col += 1) {
          const c = { row, col };
          if (!occupied.has(coordKey(c)) && !traps.has(coordKey(c))) {
            coords.push(c);
          }
        }
      }
      return coords;
    }

    return [];
  }, [view, activeCardInUse, cardSourcePieceId, viewerColor]);

  const dispatchCardPlay = (payload: CardPlayPayload) => {
    setStatusError(null);
    try {
      if (mode === 'online' && onOnlineAction) {
        onOnlineAction.playCard(payload);
      } else {
        const prevTurnPlayer = localState.turn.activePlayer;
        const next = playCard(localState, viewerColor, payload, Date.now());
        setLocalState(next);
        if (
          mode === 'local' &&
          next.phase === 'playing' &&
          next.turn.activePlayer !== prevTurnPlayer
        ) {
          setPrivacyCurtainFor(next.turn.activePlayer);
        }
      }
      playTacticalSfx('card');
      setActiveCardInUse(null);
      setConfirmingCard(null);
      setCardSourcePieceId(null);
      setSelectedGraveyardPieceId(null);
      setEspionageSelectedIds([]);
      setTraqueurMarkModePieceId(null);
      setPendingMoveDisambiguation(null);
      setSelectedSquare(null);
      setMobileDrawer('none');
      maybeAutoClearViewerAnnotations();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Impossible de jouer cette carte');
    }
  };

  const dispatchPieceMove = (
    pieceId: string,
    destination: Coord,
    preferredKind: MoveCandidateKind | undefined,
    isCaptureTarget: boolean,
  ) => {
    setStatusError(null);
    setPendingMoveDisambiguation(null);
    setTraqueurMarkModePieceId(null);
    try {
      if (mode === 'online' && onOnlineAction) {
        onOnlineAction.movePiece(pieceId, destination, preferredKind);
        setInspectedSquare(destination);
      } else {
        const prevPlayer = localState.turn.activePlayer;
        const next = executePieceMove(
          localState,
          viewerColor,
          pieceId,
          destination,
          Date.now(),
          Math.random,
          preferredKind,
        );
        setLocalState(next);
        setInspectedSquare(destination);
        if (next.turn.pendingCavalierJumpPieceId || next.turn.pendingBerserkerRagePieceId) {
          setSelectedSquare(destination);
        } else {
          setSelectedSquare(null);
        }
        if (
          mode === 'local' &&
          next.phase === 'playing' &&
          next.turn.activePlayer !== prevPlayer
        ) {
          setPrivacyCurtainFor(next.turn.activePlayer);
        }
      }
      maybeAutoClearViewerAnnotations();
      playTacticalSfx(
        isCaptureTarget || preferredKind === 'piercing_strike' || preferredKind === 'crossbow_shot'
          ? 'capture'
          : 'move',
      );
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Déplacement refusé');
    }
  };

  const handleExecuteTraqueurMark = (traqueurPieceId: string, targetEnemyPieceId: string) => {
    setStatusError(null);
    try {
      if (mode === 'online' && onOnlineAction?.markTraqueur) {
        onOnlineAction.markTraqueur(traqueurPieceId, targetEnemyPieceId);
      } else {
        const next = markTraqueurTarget(
          localState,
          viewerColor,
          traqueurPieceId,
          targetEnemyPieceId,
          Date.now(),
        );
        setLocalState(next);
      }
      setTraqueurMarkModePieceId(null);
      playTacticalSfx('card');
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Marquage impossible');
    }
  };

  const handleBoardSquareClick = (coord: Coord) => {
    setStatusError(null);

    // 0. Personal Tactical Annotation Mode: never triggers game actions, piece moves, or cards
    if (annotationModeActive) {
      if (annotationTool === 'erase') {
        setAnnotationsByPlayer((prev) => ({
          ...prev,
          [viewerColor]: eraseAnnotationsAtSquare(prev[viewerColor], coord),
        }));
        setPendingArrowStart(null);
        return;
      }
      if (annotationTool === 'square') {
        handleTogglePersonalSquareMark(coord);
        setPendingArrowStart(null);
        return;
      }
      if (!pendingArrowStart) {
        setPendingArrowStart(coord);
        return;
      }
      if (pendingArrowStart.row === coord.row && pendingArrowStart.col === coord.col) {
        setPendingArrowStart(null);
        return;
      }
      handleUpsertPersonalArrow(pendingArrowStart, coord);
      setPendingArrowStart(null);
      return;
    }

    // 1. Preparation Phase: place or remove piece in own 3-row zone
    if (view.phase === 'placement') {
      if (ownPlacementConfirmed) {
        setStatusError(
          `Placement validé et verrouillé : en attente de la validation de votre adversaire.`,
        );
        return;
      }
      if (!isInPlacementZone(viewerColor, coord)) {
        setStatusError(`Placez vos pièces uniquement dans vos 3 rangées.`);
        return;
      }
      const existingIdx = stagedPlacement.findIndex(
        (e) => e.coord.row === coord.row && e.coord.col === coord.col,
      );
      if (existingIdx !== -1) {
        // Remove piece on click if already occupied
        setStagedPlacement(stagedPlacement.filter((_, i) => i !== existingIdx));
        playTacticalSfx('move');
        return;
      }

      if (placedCounts[selectedBrushCharacter] >= ARMY_COMPOSITION[selectedBrushCharacter]) {
        // Automatically switch brush to next character with remaining pieces
        const nextAvailable = CHARACTER_TYPES.find(
          (ch) => placedCounts[ch] < ARMY_COMPOSITION[ch],
        );
        if (!nextAvailable) {
          setStatusError(`Les 27 pièces sont déjà placées. Validez votre armée.`);
          return;
        }
        setSelectedBrushCharacter(nextAvailable);
        setStagedPlacement([...stagedPlacement, { character: nextAvailable, coord }]);
      } else {
        setStagedPlacement([...stagedPlacement, { character: selectedBrushCharacter, coord }]);
      }
      playTacticalSfx('move');
      return;
    }

    const clickedPiece = view.pieces.find(
      (p) => p.position.row === coord.row && p.position.col === coord.col,
    );

    // Always allow touch inspection of any piece on the board (even during opponent's turn)
    const clickedSameInspected =
      inspectedSquare !== null &&
      inspectedSquare.row === coord.row &&
      inspectedSquare.col === coord.col;
    const isTargetingAction =
      activeCardInUse !== null || traqueurMarkModePieceId !== null;

    if (clickedPiece) {
      if (
        clickedSameInspected &&
        !isTargetingAction &&
        (view.phase !== 'playing' || view.turn.activePlayer !== viewerColor)
      ) {
        setInspectedSquare(null);
      } else {
        setInspectedSquare(coord);
      }
    } else if (
      view.phase !== 'playing' ||
      view.turn.activePlayer !== viewerColor ||
      (!selectedSquare && !isTargetingAction)
    ) {
      setInspectedSquare(null);
    }

    if (view.phase !== 'playing' || view.turn.activePlayer !== viewerColor) {
      return;
    }

    // 2. Active Card Targeting
    if (activeCardInUse !== null) {
      if (
        activeCardInUse === 'kamikaze' ||
        activeCardInUse === 'invincibilite' ||
        activeCardInUse === 'protection' ||
        activeCardInUse === 'contre_espionnage'
      ) {
        if (!clickedPiece || clickedPiece.owner !== viewerColor) {
          setStatusError(`Sélectionnez l’une de vos propres pièces.`);
          return;
        }
        if (
          clickedPiece.character &&
          !isCardAllowedOnCharacter(activeCardInUse, clickedPiece.character)
        ) {
          setStatusError(
            `Impossible : ${CARD_CATALOG[activeCardInUse].name} ne peut pas être joué sur ${CHARACTER_CATALOG[clickedPiece.character].name} (interdit sur le Roi et le Colosse).`,
          );
          return;
        }
        dispatchCardPlay({ card: activeCardInUse, targetPieceId: clickedPiece.id });
        return;
      }

      if (activeCardInUse === 'sacrifice') {
        if (
          !clickedPiece ||
          clickedPiece.owner !== viewerColor ||
          clickedPiece.character !== 'soldat'
        ) {
          setStatusError(`Sélectionnez un Soldat allié vivant à sacrifier.`);
          return;
        }
        dispatchCardPlay({ card: 'sacrifice', targetSoldierPieceId: clickedPiece.id });
        return;
      }

      if (
        activeCardInUse === 'revelation_temporaire' ||
        activeCardInUse === 'revelation_permanente'
      ) {
        if (!clickedPiece || clickedPiece.owner === viewerColor) {
          setStatusError(`Sélectionnez une pièce ennemie.`);
          return;
        }
        dispatchCardPlay({ card: activeCardInUse, targetEnemyPieceId: clickedPiece.id });
        return;
      }

      if (activeCardInUse === 'espionnage') {
        if (!clickedPiece || clickedPiece.owner === viewerColor) {
          setStatusError(`Sélectionnez jusqu’à 2 pièces ennemies à espionner.`);
          return;
        }
        const nextIds = espionageSelectedIds.includes(clickedPiece.id)
          ? espionageSelectedIds.filter((id) => id !== clickedPiece.id)
          : [...espionageSelectedIds, clickedPiece.id];
        setEspionageSelectedIds(nextIds);
        if (nextIds.length === 2) {
          dispatchCardPlay({ card: 'espionnage', targetEnemyPieceIds: nextIds });
        }
        return;
      }

      if (activeCardInUse === 'teleportation' || activeCardInUse === 'retreat') {
        if (!cardSourcePieceId) {
          if (!clickedPiece || clickedPiece.owner !== viewerColor) {
            setStatusError(`Sélectionnez d’abord la pièce alliée à déplacer.`);
            return;
          }
          setCardSourcePieceId(clickedPiece.id);
          return;
        }
        if (clickedPiece && clickedPiece.owner === viewerColor) {
          setCardSourcePieceId(clickedPiece.id);
          return;
        }
        dispatchCardPlay({
          card: activeCardInUse,
          targetPieceId: cardSourcePieceId,
          destination: coord,
        });
        return;
      }

      if (activeCardInUse === 'piege' || activeCardInUse === 'recrutement') {
        dispatchCardPlay({ card: activeCardInUse, destination: coord });
        return;
      }

      if (activeCardInUse === 'resurrection') {
        if (!selectedGraveyardPieceId) {
          setStatusError(`Sélectionnez d’abord la pièce à ressusciter dans votre cimetière.`);
          return;
        }
        dispatchCardPlay({
          card: 'resurrection',
          graveyardPieceId: selectedGraveyardPieceId,
          destination: coord,
        });
        return;
      }
    }

    // 2.5. Active Traqueur Mark Targeting (0 action cost, revealed ortho 1..3 enemy only)
    if (traqueurMarkModePieceId !== null) {
      if (clickedPiece && clickedPiece.id === traqueurMarkModePieceId) {
        setTraqueurMarkModePieceId(null);
        return;
      }
      if (clickedPiece && traqueurMarkTargets.some((t) => t.id === clickedPiece.id)) {
        handleExecuteTraqueurMark(traqueurMarkModePieceId, clickedPiece.id);
        return;
      }
      if (clickedPiece && clickedPiece.owner === viewerColor) {
        setTraqueurMarkModePieceId(null);
        setSelectedSquare(coord);
        return;
      }
      setStatusError(
        `Sélectionnez une cible ennemie déjà révélée à 1–3 cases orthogonales sans obstacle (ou annulez le marquage).`,
      );
      return;
    }

    // 3. Normal / Jump / Rage / Piercing / Crossbow Piece Movement & Attack
    if (selectedSquare) {
      const selectedPiece = view.pieces.find(
        (p) =>
          p.position.row === selectedSquare.row &&
          p.position.col === selectedSquare.col &&
          p.owner === viewerColor,
      );
      const matchingCandidates = highlightedMoves.filter(
        (m) => m.to.row === coord.row && m.to.col === coord.col,
      );

      if (selectedPiece && matchingCandidates.length > 1) {
        setPendingMoveDisambiguation({
          pieceId: selectedPiece.id,
          destination: coord,
          candidates: matchingCandidates,
          isCaptureTarget: Boolean(clickedPiece),
        });
        return;
      }

      if (selectedPiece && matchingCandidates.length === 1) {
        dispatchPieceMove(
          selectedPiece.id,
          coord,
          matchingCandidates[0]!.kind,
          Boolean(clickedPiece),
        );
        return;
      }
    }

    setPendingMoveDisambiguation(null);
    setTraqueurMarkModePieceId(null);
    const clickedSameSelected =
      selectedSquare !== null &&
      selectedSquare.row === coord.row &&
      selectedSquare.col === coord.col;
    if (clickedPiece && clickedPiece.owner === viewerColor) {
      if (clickedSameSelected) {
        setSelectedSquare(null);
        setInspectedSquare(null);
      } else {
        setSelectedSquare(coord);
      }
    } else {
      setSelectedSquare(null);
      if (!clickedPiece) {
        setInspectedSquare(null);
      } else if (clickedSameInspected) {
        setInspectedSquare(null);
      }
    }
  };

  // Local Privacy Transition Screen (§12.1)
  if (mode === 'local' && privacyCurtainFor !== null) {
    return (
      <div className="bw-privacy-curtain">
        <div className="bw-privacy-card">
          <div className="bw-privacy-badge">CONFIDENTIALITÉ MODE LOCAL (§12.1)</div>
          <h2>
            Tour du Joueur{' '}
            <span className={privacyCurtainFor === 'red' ? 'bw-text-red' : 'bw-text-silver'}>
              {privacyCurtainFor === 'red' ? 'ROUGE' : 'NOIR'}
            </span>
          </h2>
          <p>
            Les identités de vos pièces et vos informations de reconnaissance privées sont masquées
            pendant le changement de joueur. Assurez-vous que seul le joueur{' '}
            <strong>{privacyCurtainFor === 'red' ? 'Rouge' : 'Noir'}</strong> regarde l’écran.
          </p>
          <button
            type="button"
            className="bw-btn bw-btn-primary bw-btn-lg"
            onClick={() => setPrivacyCurtainFor(null)}
          >
            Je suis le Joueur {privacyCurtainFor === 'red' ? 'Rouge' : 'Noir'} — Révéler le Plateau
          </button>
        </div>
      </div>
    );
  }

  const ownGraveyard = view.graveyard.filter((g) => g.owner === viewerColor);
  const enemyGraveyard = view.graveyard.filter((g) => g.owner !== viewerColor);
  const lastMoveSummary = view.lastMove ? formatLastMoveSummary(view.lastMove) : null;
  const inspectedPiece = inspectedSquare
    ? view.pieces.find(
        (p) =>
          p.position.row === inspectedSquare.row && p.position.col === inspectedSquare.col,
      ) ?? null
    : null;

  const handleOpenCardConfirm = (cardId: CardType) => {
    setTraqueurMarkModePieceId(null);
    setPendingMoveDisambiguation(null);
    if (activeCardInUse === cardId) {
      setActiveCardInUse(null);
      setCardSourcePieceId(null);
      setEspionageSelectedIds([]);
      return;
    }
    setConfirmingCard(cardId);
  };

  return (
    <div className="bw-game-layout">
      {/* Top Tactical HUD Bar */}
      <header className="bw-game-topbar">
        <div className="bw-topbar-left">
          <button
            type="button"
            className="bw-btn bw-btn-ghost"
            onClick={() => {
              if (settings.confirmImportantActions && view.phase === 'playing' && mode !== 'tutorial') {
                setPendingImportantConfirm('exit');
              } else {
                onExitToMenu();
              }
            }}
          >
            ← Quitter
          </button>
          <span className="bw-mode-pill">
            {mode === 'tutorial'
              ? `TUTORIEL — ${tutorialScenario?.title ?? ''}`
              : mode === 'local'
                ? 'MODE LOCAL 2 JOUEURS'
                : `MULTIJOUEUR (${view.mode})`}
          </span>
          {view.phase === 'playing' && (
            <span
              className={`bw-turn-clarity-pill ${view.turn.activePlayer === viewerColor ? 'yours' : ''}`}
              title={
                view.turn.activePlayer === viewerColor
                  ? 'C’est à vous de jouer'
                  : 'En attente de l’action adverse'
              }
            >
              {view.turn.activePlayer === viewerColor
                ? `🟢 À vous (${view.turn.remainingActions} action${view.turn.remainingActions > 1 ? 's' : ''})`
                : '⏳ Tour adverse'}
            </span>
          )}
          {view.repetitionWarningActive && (
            <span className="bw-warning-pill" title="5 répétitions = Match nul automatique">
              ⚠️ Alerte Répétition ({view.maxRepetitionCountSeen}/5)
            </span>
          )}
        </div>

        {/* Dual 10-Minute Authoritative Chess Clocks (§11) */}
        <div className="bw-clocks-bar">
          <div
            className={`bw-clock-box bw-clock-red ${view.turn.activePlayer === 'red' && view.phase === 'playing' ? 'bw-clock-active' : ''}`}
          >
            <span className="bw-clock-team">🔴 ROUGE</span>
            <span className="bw-clock-time">{formatClockMs(view.clock.remainingMs.red)}</span>
          </div>

          <div className="bw-turn-center-badge">
            {view.phase === 'placement' ? (
              <span>
                PRÉPARATION :{' '}
                <strong>
                  {mode === 'online'
                    ? `${onlinePrepRemainingSec ?? 90}s`
                    : `${localPrepSecondsLeft}s`}
                </strong>
              </span>
            ) : (
              <span>
                TOUR #{view.turn.turnNumber} —{' '}
                <strong className={view.turn.activePlayer === 'red' ? 'bw-text-red' : ''}>
                  {view.turn.activePlayer === 'red' ? 'ROUGE' : 'NOIR'}
                </strong>{' '}
                ({view.turn.remainingActions} action{view.turn.remainingActions > 1 ? 's' : ''})
              </span>
            )}
          </div>

          <div
            className={`bw-clock-box bw-clock-black ${view.turn.activePlayer === 'black' && view.phase === 'playing' ? 'bw-clock-active' : ''}`}
          >
            <span className="bw-clock-team">⚫ NOIR</span>
            <span className="bw-clock-time">{formatClockMs(view.clock.remainingMs.black)}</span>
          </div>
        </div>

        <div className="bw-topbar-right">
          {view.cardNotifications.length > 0 && (
            <button
              type="button"
              className="bw-btn bw-btn-secondary"
              onClick={() => setShowCardHistoryModal(true)}
              title="Consulter les dernières cartes jouées"
            >
              🔔 Cartes ({view.cardNotifications.length})
            </button>
          )}
          <button
            type="button"
            className="bw-btn bw-btn-secondary"
            onClick={() => setShowInGameRulesModal(true)}
          >
            📖 Règles
          </button>
          {view.phase === 'playing' && mode !== 'tutorial' && (
            <>
              <button
                type="button"
                className="bw-btn bw-btn-secondary"
                onClick={() => {
                  if (settings.confirmImportantActions) {
                    setPendingImportantConfirm('draw');
                    return;
                  }
                  if (mode === 'online' && onOnlineAction) {
                    onOnlineAction.offerDraw();
                  } else {
                    setLocalState(proposeOrAcceptMutualDraw(localState, viewerColor, Date.now()));
                  }
                }}
              >
                {view.drawOfferFrom && view.drawOfferFrom !== viewerColor
                  ? '🤝 Accepter Nul'
                  : '🤝 Proposer Nul'}
              </button>
              <button
                type="button"
                className="bw-btn bw-btn-danger"
                onClick={() => {
                  if (settings.confirmImportantActions) {
                    setConfirmingResign(true);
                  } else if (mode === 'online' && onOnlineAction) {
                    onOnlineAction.resign();
                  } else {
                    setLocalState(resignMatch(localState, viewerColor, Date.now()));
                  }
                }}
              >
                🏳️ Abandonner
              </button>
            </>
          )}
        </div>
      </header>

      {/* High-Visibility Animated Opponent Card Notification Spotlight (§2.2 - §2.5) */}
      {activeOpponentCardAlert && (
        <div
          className={`bw-card-spotlight ${CARD_CATEGORY_META[activeOpponentCardAlert.category].className}`}
          role="alert"
          aria-live="assertive"
        >
          <div className="bw-card-spotlight-inner">
            <div className="bw-card-spotlight-illustration">
              <span className="bw-card-spotlight-icon">{activeOpponentCardAlert.badge}</span>
              <span className="bw-card-spotlight-cat">
                {CARD_CATEGORY_META[activeOpponentCardAlert.category].label}
              </span>
            </div>

            <div className="bw-card-spotlight-content">
              <div className="bw-card-spotlight-kicker">
                <span>
                  ⚡ CARTE UTILISÉE PAR LE JOUEUR{' '}
                  <strong>{activeOpponentCardAlert.actor === 'red' ? 'ROUGE 🔴' : 'NOIR ⚫'}</strong>
                </span>
                <span className="bw-card-spotlight-turn">
                  Tour #{activeOpponentCardAlert.turnNumber}
                </span>
              </div>

              <h3 className="bw-card-spotlight-title">
                {activeOpponentCardAlert.cardName.toUpperCase()}
              </h3>

              <p className="bw-card-spotlight-desc">
                {activeOpponentCardAlert.shortDescription}
              </p>

              <div className="bw-card-spotlight-consequence">
                <strong>Conséquence visible :</strong> {activeOpponentCardAlert.consequenceText}
              </div>
            </div>

            <div className="bw-card-spotlight-actions">
              <button
                type="button"
                className="bw-btn bw-btn-primary bw-btn-sm"
                onClick={() => setActiveOpponentCardAlert(null)}
              >
                ✕ Compris
              </button>
              <button
                type="button"
                className="bw-btn bw-btn-ghost bw-btn-sm"
                onClick={() => {
                  setActiveOpponentCardAlert(null);
                  setShowCardHistoryModal(true);
                }}
              >
                📜 Historique
              </button>
            </div>
          </div>
          <div className="bw-card-spotlight-progress" />
        </div>
      )}

      {/* High-Visibility Animated Own New Card Draw Indicator (§1 Indicateur nouvelle carte) */}
      {activeNewCardAlert && (
        <div
          className={`bw-new-card-banner ${CARD_CATEGORY_META[activeNewCardAlert.category].className}`}
          role="status"
          aria-live="polite"
        >
          <div className="bw-new-card-banner-inner">
            <div className="bw-new-card-illustration">
              <span className="bw-new-card-sparkle" aria-hidden="true">✨</span>
              <span className="bw-new-card-artwork">{activeNewCardAlert.badge}</span>
              <span className="bw-new-card-cat">
                {CARD_CATEGORY_META[activeNewCardAlert.category].label}
              </span>
            </div>

            <div className="bw-new-card-body">
              <div className="bw-new-card-kicker-row">
                <span className="bw-new-card-kicker">🎁 Nouvelle carte obtenue !</span>
                <span className="bw-new-card-source-pill">
                  {activeNewCardAlert.source === 'sacrifice'
                    ? 'Via Sacrifice'
                    : 'Bonus 3 éliminations'}
                </span>
                <span className="bw-new-card-hand-pill">
                  Main : {view.ownHand.length}/{activeNewCardAlert.maxHandSize}
                </span>
              </div>
              <h3 className="bw-new-card-title">{activeNewCardAlert.cardName}</h3>
              <p className="bw-new-card-desc">{activeNewCardAlert.shortDescription}</p>
            </div>

            <div className="bw-new-card-actions">
              <button
                type="button"
                className="bw-btn bw-btn-primary bw-btn-sm"
                onClick={() => setActiveNewCardAlert(null)}
              >
                ✓ Super !
              </button>
            </div>
          </div>
          <div className="bw-new-card-progress" />
        </div>
      )}

      {/* Piece Placement Validation Status & Waiting Confirmation Indicator (§2 Validation placement) */}
      {view.phase === 'placement' && (
        <div className="bw-placement-sync-section">
          <div className="bw-placement-player-pills" role="status" aria-label="Statut de validation du placement">
            <div
              className={`bw-placement-player-pill ${view.placementStatus.redConfirmed ? 'bw-placement-pill-ready' : 'bw-placement-pill-pending'}`}
            >
              <span>🔴 Joueur Rouge</span>
              <strong>
                {view.placementStatus.redConfirmed ? '✅ Validé' : '⏳ Placement en cours…'}
              </strong>
            </div>
            <div
              className={`bw-placement-player-pill ${view.placementStatus.blackConfirmed ? 'bw-placement-pill-ready' : 'bw-placement-pill-pending'}`}
            >
              <span>⚫ Joueur Noir</span>
              <strong>
                {view.placementStatus.blackConfirmed ? '✅ Validé' : '⏳ Placement en cours…'}
              </strong>
            </div>
          </div>

          {ownPlacementConfirmed && (
            <div className="bw-placement-validated-banner" role="status" aria-live="polite">
              <div className="bw-placement-check-orb" aria-hidden="true">
                ✅
              </div>
              <div className="bw-placement-validated-text">
                <h3>Placement validé</h3>
                <p>Votre placement est terminé. En attente de l’autre joueur…</p>
              </div>
              <div className="bw-placement-wait-spinner" aria-label="En attente de l'adversaire">
                <span className="bw-spinner-ring" />
                <span>Synchronisation en attente…</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Animated Match-Start Transition Banner when both placements are confirmed */}
      {showMatchStartBanner && view.phase === 'playing' && (
        <div className="bw-match-start-banner" role="status" aria-live="polite">
          <span className="bw-match-start-icon">
            <PieceArtwork character="soldat" owner={viewerColor} size="xs" />
          </span>
          <div>
            <strong>Début de la partie !</strong>
            <span> Les deux placements sont validés. Place au combat !</span>
          </div>
          <button
            type="button"
            className="bw-btn bw-btn-ghost bw-btn-sm"
            onClick={() => setShowMatchStartBanner(false)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Tutorial Coaching Banner (§12.5) */}
      {mode === 'tutorial' && tutorialScenario && (
        <div className="bw-tutorial-banner bw-tutorial-banner-compact">
          <div className="bw-tutorial-banner-info">
            <div className="bw-tutorial-banner-head">
              <span className="bw-tutorial-theme-badge">
                Thème {tutorialScenario.themeNumber}/10 — {tutorialScenario.themeTitle}
              </span>
              <h3>{tutorialScenario.subtitle}</h3>
            </div>
            <p className="bw-tutorial-obj">{tutorialScenario.objectiveDescription}</p>
            {showTutorialHints && tutorialScenario.coachingTips.length > 0 && (
              <ul className="bw-tutorial-tips">
                {tutorialScenario.coachingTips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="bw-tutorial-actions">
            {tutorialScenario.coachingTips.length > 0 && (
              <button
                type="button"
                className="bw-btn bw-btn-ghost bw-btn-sm"
                onClick={() => setShowTutorialHints((curr) => !curr)}
              >
                {showTutorialHints ? 'Masquer indices' : '💡 Indices'}
              </button>
            )}
            {tutorialCompleted ? (
              <div className="bw-tutorial-success">
                <span>✅ Objectif accompli !</span>
                {onNextTutorialStep && (
                  <button
                    type="button"
                    className="bw-btn bw-btn-primary bw-btn-sm"
                    onClick={onNextTutorialStep}
                  >
                    Leçon Suivante →
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="bw-btn bw-btn-secondary bw-btn-sm"
                onClick={() => setLocalState(tutorialScenario.createInitialState())}
              >
                ↺ Réinitialiser
              </button>
            )}
          </div>
        </div>
      )}

      {/* Single-Window Contextual In-Game Guide (Auto-triggers cleanly in local/online matches) */}
      {activeContextualTip && (
        <div className="bw-contextual-tip-bar" role="status" aria-live="polite">
          <div className="bw-contextual-tip-left">
            {activeContextualTip.relatedCharacter && (
              <PieceArtwork
                character={activeContextualTip.relatedCharacter}
                owner={viewerColor}
                size="sm"
              />
            )}
            <div className="bw-contextual-tip-copy">
              <div className="bw-contextual-tip-meta">
                <span className="bw-contextual-tip-pill">{activeContextualTip.badge}</span>
                <strong>{activeContextualTip.title}</strong>
              </div>
              <p>{activeContextualTip.message}</p>
            </div>
          </div>
          <button
            type="button"
            className="bw-btn bw-btn-secondary bw-btn-sm"
            onClick={() =>
              setDismissedContextualIds(dismissContextualTip(activeContextualTip.id))
            }
          >
            ✓ Compris
          </button>
        </div>
      )}

      {/* Special Sub-Turn Action Prompts (Bonus Turn, Cavalier Jump Chain, Berserker Rage, Soldier Promotion) */}
      {view.phase === 'playing' && view.turn.activePlayer === viewerColor && (
        <div className="bw-subturn-alerts">
          {view.turn.isBonusTurn && (
            <div className="bw-alert-banner bw-alert-gold">
              ⚡{' '}
              <strong>
                Tour Bonus actif (
                {view.turn.bonusTurnReason ?? '2+ éliminations dans le même tour'}) :
              </strong>{' '}
              vous disposez d’1 déplacement supplémentaire (aucune carte autorisée).
            </div>
          )}
          {view.turn.doubleActionActive && (
            <div className="bw-alert-banner bw-alert-red">
              ⏩ <strong>Double Action active :</strong> {view.turn.remainingActions} action(s) restante(s) (aucune 2e carte autorisée).
            </div>
          )}
          {view.turn.pendingCavalierJumpPieceId && (
            <div className="bw-alert-banner bw-alert-gold">
              <span className="bw-btn-icon-label">
                <PieceArtwork character="cavalier" owner={viewerColor} size="xs" />{' '}
                <span>
                  <strong>Enchaînement de saut du Cavalier possible !</strong> Cliquez sur une case
                  de saut dorée pour continuer, ou arrêtez votre enchaînement :
                </span>
              </span>
              <button
                type="button"
                className="bw-btn bw-btn-primary"
                onClick={() => {
                  if (mode === 'online' && onOnlineAction) {
                    onOnlineAction.stopJump();
                  } else {
                    const prev = localState.turn.activePlayer;
                    const next = stopCavalierJumpChain(localState, viewerColor, Date.now());
                    setLocalState(next);
                    setSelectedSquare(null);
                    if (mode === 'local' && next.turn.activePlayer !== prev) {
                      setPrivacyCurtainFor(next.turn.activePlayer);
                    }
                  }
                }}
              >
                Terminer l’enchaînement de sauts
              </button>
            </div>
          )}
          {view.turn.pendingBerserkerRagePieceId && (
            <div className="bw-alert-banner bw-alert-red">
              <span className="bw-btn-icon-label">
                <PieceArtwork character="berserker" owner={viewerColor} size="xs" />{' '}
                <span>
                  <strong>Rage du Berserker déclenchée !</strong> Effectuez un 2e déplacement gratuit
                  (sans élimination) ou passez :
                </span>
              </span>
              <button
                type="button"
                className="bw-btn bw-btn-secondary"
                onClick={() => {
                  if (mode === 'online' && onOnlineAction) {
                    onOnlineAction.skipRage();
                  } else {
                    const prev = localState.turn.activePlayer;
                    const next = skipBerserkerRageMove(localState, viewerColor, Date.now());
                    setLocalState(next);
                    setSelectedSquare(null);
                    if (mode === 'local' && next.turn.activePlayer !== prev) {
                      setPrivacyCurtainFor(next.turn.activePlayer);
                    }
                  }
                }}
              >
                Ignorer le déplacement de Rage
              </button>
            </div>
          )}
          {view.turn.pendingPromotionPieceId && (
            <div className="bw-promotion-modal">
              <h4>🎖️ Promotion du Soldat (§6.9) — Choisissez votre nouveau personnage :</h4>
              <div className="bw-promotion-choices">
                {view.turn.availablePromotionChoices.map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    className="bw-btn bw-btn-primary bw-btn-icon-label"
                    onClick={() => {
                      if (mode === 'online' && onOnlineAction) {
                        onOnlineAction.promoteSoldier(ch);
                      } else {
                        const prev = localState.turn.activePlayer;
                        const next = selectSoldierPromotion(localState, viewerColor, ch, Date.now());
                        setLocalState(next);
                        setSelectedSquare(null);
                        if (mode === 'local' && next.turn.activePlayer !== prev) {
                          setPrivacyCurtainFor(next.turn.activePlayer);
                        }
                      }
                    }}
                  >
                    <PieceArtwork character={ch} owner={viewerColor} size="xs" />{' '}
                    <span>{CHARACTER_DOSSIERS[ch].name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active Card Targeting Helper Banner */}
      {activeCardInUse && (
        <div className="bw-active-card-targeting-bar" role="status">
          <div>
            <strong>
              Ciblage actif : {CARD_DOSSIERS[activeCardInUse].badge}{' '}
              {CARD_DOSSIERS[activeCardInUse].name}
            </strong>{' '}
            —{' '}
            <span>
              {activeCardInUse === 'resurrection' && !selectedGraveyardPieceId
                ? 'Choisissez d’abord une pièce alliée dans votre Cimetière, puis cliquez sur votre ligne de départ.'
                : (activeCardInUse === 'teleportation' || activeCardInUse === 'retreat') &&
                    !cardSourcePieceId
                  ? 'Cliquez d’abord sur la pièce alliée à déplacer.'
                  : 'Cliquez sur une case ou pièce en surbrillance sur le plateau.'}
            </span>
          </div>
          <div className="bw-active-card-targeting-actions">
            {activeCardInUse === 'espionnage' && espionageSelectedIds.length === 1 && (
              <button
                type="button"
                className="bw-btn bw-btn-primary bw-btn-sm"
                onClick={() =>
                  dispatchCardPlay({
                    card: 'espionnage',
                    targetEnemyPieceIds: espionageSelectedIds,
                  })
                }
              >
                ✅ Confirmer sur 1 pièce
              </button>
            )}
            <button
              type="button"
              className="bw-btn bw-btn-ghost bw-btn-sm"
              onClick={() => {
                setActiveCardInUse(null);
                setCardSourcePieceId(null);
                setEspionageSelectedIds([]);
              }}
            >
              ✕ Annuler la carte
            </button>
          </div>
        </div>
      )}

      {statusError && (
        <div className="bw-error-toast" role="alert">
          ⚠️ {statusError}
        </div>
      )}

      {/* Main 3-Column Tactical Arena */}
      <div className="bw-arena-columns">
        {/* Left Sidebar: Dynamic Piece Description Panel + Placement Palette / Cards Hand */}
        <aside className="bw-sidebar bw-sidebar-left">
          <PieceDescriptionPanel
            viewerColor={viewerColor}
            phase={view.phase}
            inspectedCoord={inspectedSquare}
            piece={inspectedPiece}
            placementBrushChar={selectedBrushCharacter}
            onClearSelection={() => {
              setSelectedSquare(null);
              setInspectedSquare(null);
            }}
          />
          {view.phase === 'placement' ? (
            <div className="bw-panel">
              <h3>
                Placement Armée {viewerColor === 'red' ? 'Rouge 🔴' : 'Noire ⚫'} (
                {effectiveStagedPlacement.length}/{TOTAL_PIECES_PER_PLAYER})
              </h3>
              {ownPlacementConfirmed ? (
                <div className="bw-placement-locked-box">
                  <p>
                    <strong>✅ Placement validé et verrouillé (27/27)</strong>
                  </p>
                  <p className="bw-muted-small">
                    Votre armée est enregistrée et confidentielle. En attente de la validation de votre adversaire…
                  </p>
                </div>
              ) : (
                <p className="bw-muted-small">
                  Cliquez sur un personnage puis sur vos 3 rangées en surbrillance :
                </p>
              )}
              <div className="bw-roster-palette">
                {CHARACTER_TYPES.map((ch) => {
                  const placed = placedCounts[ch];
                  const max = ARMY_COMPOSITION[ch];
                  const remaining = max - placed;
                  return (
                    <button
                      key={ch}
                      type="button"
                      disabled={ownPlacementConfirmed}
                      className={`bw-palette-item ${selectedBrushCharacter === ch ? 'bw-palette-active' : ''} ${remaining === 0 ? 'bw-palette-done' : ''}`}
                      onClick={() => setSelectedBrushCharacter(ch)}
                    >
                      <span className="bw-palette-symbol">
                        <PieceArtwork character={ch} owner={viewerColor} size="sm" />
                      </span>
                      <span className="bw-palette-name">{CHARACTER_CATALOG[ch].name}</span>
                      <span className="bw-palette-count">
                        {remaining} restant{remaining > 1 ? 's' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="bw-placement-buttons">
                <button
                  type="button"
                  className="bw-btn bw-btn-secondary"
                  disabled={ownPlacementConfirmed}
                  onClick={() =>
                    setStagedPlacement(autoCompletePlacement(viewerColor, stagedPlacement))
                  }
                >
                  ⚡ Compléter auto (27/27)
                </button>
                <button
                  type="button"
                  className="bw-btn bw-btn-ghost"
                  disabled={ownPlacementConfirmed}
                  onClick={() => setStagedPlacement([])}
                >
                  🗑️ Vider
                </button>
                <button
                  type="button"
                  className="bw-btn bw-btn-primary"
                  disabled={
                    ownPlacementConfirmed ||
                    effectiveStagedPlacement.length !== TOTAL_PIECES_PER_PLAYER
                  }
                  onClick={() => handleConfirmPlacementEntries(effectiveStagedPlacement)}
                >
                  {ownPlacementConfirmed ? '🔒 Placement validé' : '✅ Valider mes 27 pièces'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Hand of Cards (§8) */}
              <div className="bw-panel">
                <div className="bw-panel-header-row">
                  <h3>🃏 Vos Cartes ({view.ownHand.length}/3)</h3>
                  <span className="bw-kill-counter-badge" title="Une carte piochée toutes les 3 éliminations (si < 3 cartes en main)">
                    Pioche : {view.ownKillCounterTowardCard}/3 éliminations
                  </span>
                </div>

                {view.ownHand.length === 0 ? (
                  <p className="bw-muted-small">
                    Aucune carte en main. Éliminez 3 pièces ennemies pour piocher !
                  </p>
                ) : (
                  <div className="bw-cards-list">
                    {view.ownHand.map((cardId, idx) => {
                      const dossier = CARD_DOSSIERS[cardId];
                      const isSelectedCard = activeCardInUse === cardId;
                      const isNewlyObtained = `${cardId}-${idx}` === highlightedNewCardKey;
                      return (
                        <div
                          key={`${cardId}-${idx}`}
                          className={`bw-card-item ${isSelectedCard ? 'bw-card-selected' : ''} ${isNewlyObtained ? 'bw-card-newly-obtained' : ''}`}
                        >
                          <div className="bw-card-top">
                            <span className="bw-card-title">
                              {dossier.badge} {dossier.name}
                              {isNewlyObtained && (
                                <span className="bw-new-card-badge">NOUVELLE !</span>
                              )}
                            </span>
                            <span className="bw-card-duration">{dossier.durationLabel}</span>
                          </div>
                          <p className="bw-card-desc">{dossier.effectDescription}</p>
                          <div className="bw-card-actions">
                            <button
                              type="button"
                              className={`bw-btn ${isSelectedCard ? 'bw-btn-ghost' : 'bw-btn-primary'} bw-btn-sm`}
                              disabled={!view.turn.canPlayCardNow}
                              onClick={() => handleOpenCardConfirm(cardId)}
                            >
                              {isSelectedCard ? '✕ Annuler le ciblage' : '🃏 Utiliser cette carte'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeCardInUse === 'espionnage' && (
                  <div className="bw-card-helper-box">
                    <p>
                      Sélectionnez 1 ou 2 pièces ennemies sur le plateau ({espionageSelectedIds.length}/2).
                    </p>
                    {espionageSelectedIds.length === 1 && (
                      <button
                        type="button"
                        className="bw-btn bw-btn-primary bw-btn-sm"
                        onClick={() =>
                          dispatchCardPlay({
                            card: 'espionnage',
                            targetEnemyPieceIds: espionageSelectedIds,
                          })
                        }
                      >
                        Confirmer sur 1 pièce
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Active Effects & Reconnaissance Status (§12, §15) */}
              <div className="bw-panel">
                <div className="bw-panel-header-row">
                  <h3>📡 Effets & Reconnaissance</h3>
                  {view.cardNotifications.length > 0 && (
                    <button
                      type="button"
                      className="bw-btn bw-btn-ghost bw-btn-sm"
                      onClick={() => setShowCardHistoryModal(true)}
                    >
                      🔔 Cartes ({view.cardNotifications.length})
                    </button>
                  )}
                </div>
                <ul className="bw-status-list">
                  <li>
                    Brouillard Rouge :{' '}
                    <strong>{view.fogActiveByPlayer.red ? '🌫️ ACTIF' : 'Inactif'}</strong>
                  </li>
                  <li>
                    Brouillard Noir :{' '}
                    <strong>{view.fogActiveByPlayer.black ? '🌫️ ACTIF' : 'Inactif'}</strong>
                  </li>
                  <li>
                    Cases surveillées par vos Guetteurs :{' '}
                    <strong>{view.guetteurReconCoords.length}</strong>
                  </li>
                  <li>
                    Alertes Pièges posés dans la partie :{' '}
                    <strong>{view.totalActiveTrapNotifications}</strong>
                  </li>
                  <li>
                    Cartes en main adverse : <strong>{view.opponentHandCount}/3</strong>
                  </li>
                  {view.ownBlockCooldownTurns > 0 && (
                    <li>
                      Recharge Block : <strong>{view.ownBlockCooldownTurns} tour(s)</strong>
                    </li>
                  )}
                  {(() => {
                    const ownTraq = view.pieces.find(
                      (p) => p.owner === viewerColor && p.character === 'traqueur',
                    );
                    const markedEnemy = view.pieces.find(
                      (p) => p.owner !== viewerColor && p.traqueurMarkedByViewer,
                    );
                    const ownArb = view.pieces.find(
                      (p) => p.owner === viewerColor && p.character === 'arbaletrier',
                    );
                    return (
                      <>
                        {ownTraq && (
                          <li>
                            Traqueur :{' '}
                            <strong>
                              {markedEnemy
                                ? `Cible ${coordToNotation(markedEnemy.position)} (${ownTraq.traqueurPursuitReadyVisible ? 'Poursuite +1 PRÊTE (élimination)' : 'Poursuite active au tour suivant'})`
                                : 'Aucune cible marquée (0 action)'}
                            </strong>
                          </li>
                        )}
                        {ownArb && (
                          <li>
                            Arbalétrier :{' '}
                            <strong>
                              {ownArb.arbaletrierCooldownTurnsVisible &&
                              ownArb.arbaletrierCooldownTurnsVisible > 0
                                ? `Recharge : encore ${ownArb.arbaletrierCooldownTurnsVisible} tour(s) perso`
                                : 'Tir PRÊT (1–3 cases • 1 tir / 3 tours)'}
                            </strong>
                          </li>
                        )}
                      </>
                    );
                  })()}
                </ul>
              </div>
            </>
          )}
        </aside>

        {/* Center Column: 9x9 Phaser 3 + Interactive Grid + Last Move Bar + Touch Inspector */}
        <main className="bw-board-center">
          {/* Persistent Last-Move Visual Summary Bar (§1.2 - §1.6) */}
          {view.phase !== 'placement' && (
            <div
              className={`bw-last-move-bar ${lastMoveSummary ? 'bw-last-move-bar-active' : ''}`}
              role="region"
              aria-label="Dernier déplacement effectué sur le plateau"
            >
              {lastMoveSummary ? (
                <>
                  <span className="bw-last-move-pill">{lastMoveSummary.badge}</span>
                  <span className="bw-last-move-main">{lastMoveSummary.mainText}</span>
                  {lastMoveSummary.detailText && (
                    <span className="bw-last-move-detail">{lastMoveSummary.detailText}</span>
                  )}
                  <span className="bw-last-move-legend">
                    <span className="bw-legend-dot bw-legend-from" /> Départ
                    <span className="bw-legend-dot bw-legend-to" /> Arrivée
                    {view.lastMove && view.lastMove.eliminatedCoords.length > 0 && (
                      <>
                        <span className="bw-legend-dot bw-legend-elim" /> Élimination
                      </>
                    )}
                  </span>
                </>
              ) : (
                <span className="bw-muted-small">
                  Aucun déplacement effectué pour le moment — le dernier coup restera affiché ici en permanence.
                </span>
              )}
            </div>
          )}

          <PhaserBoardCanvas
            phase={view.phase}
            viewerColor={viewerColor}
            pieces={view.pieces}
            stagedPlacement={effectiveStagedPlacement}
            selectedCoord={selectedSquare}
            highlightedMoves={highlightedMoves}
            highlightedCardSquares={highlightedCardSquares}
            highlightedTraqueurMarkCoords={highlightedTraqueurMarkCoords}
            selectedEspionageIds={espionageSelectedIds}
            guetteurReconCoords={view.guetteurReconCoords}
            ownTraps={view.ownTraps}
            lastMove={view.lastMove}
            annotationArrows={currentViewerAnnotations.arrows}
            annotationMarks={currentViewerAnnotations.marks}
            annotationModeActive={annotationModeActive}
            activeAnnotationColor={activeAnnotationColor}
            pendingArrowStart={pendingArrowStart}
            showCoordinates={settings.showCoordinates}
            showReconZones={settings.showReconZones}
            onSquareClick={handleBoardSquareClick}
            onUpsertArrow={handleUpsertPersonalArrow}
            onToggleSquareMark={handleTogglePersonalSquareMark}
            onRemoveArrow={handleRemovePersonalArrow}
          />

          {/* Disambiguation Prompt when 2 attack modes share a target square (e.g. Arbalétrier adjacent capture vs ranged shot) */}
          {pendingMoveDisambiguation && (
            <div className="bw-disambiguation-bar" role="dialog" aria-label="Choix du type d'action">
              <div className="bw-disambiguation-title">
                Plusieurs actions possibles vers{' '}
                <strong>{coordToNotation(pendingMoveDisambiguation.destination)}</strong> :
              </div>
              <div className="bw-disambiguation-actions">
                {pendingMoveDisambiguation.candidates.map((cand) => (
                  <button
                    key={cand.kind}
                    type="button"
                    className={`bw-btn bw-btn-sm ${cand.kind === 'crossbow_shot' ? 'bw-btn-primary' : 'bw-btn-secondary'}`}
                    onClick={() =>
                      dispatchPieceMove(
                        pendingMoveDisambiguation.pieceId,
                        pendingMoveDisambiguation.destination,
                        cand.kind,
                        pendingMoveDisambiguation.isCaptureTarget,
                      )
                    }
                  >
                    {cand.kind === 'crossbow_shot'
                      ? 'Tir d’arbalète (reste sur place • 1 tir / 3 tours)'
                      : cand.kind === 'capture_move'
                        ? 'Capture au corps à corps (se déplace)'
                        : cand.kind === 'piercing_strike'
                          ? 'Frappe traversante (cible arrière)'
                          : `Action (${cand.kind})`}
                  </button>
                ))}
                <button
                  type="button"
                  className="bw-btn bw-btn-ghost bw-btn-sm"
                  onClick={() => setPendingMoveDisambiguation(null)}
                >
                  ✕ Annuler
                </button>
              </div>
            </div>
          )}

          {/* Contextual Controls Strip for Selected Special Units (Traqueur Mark & Arbalétrier Cadence) */}
          {selectedOwnPieceView &&
            activeCardInUse === null &&
            (selectedOwnPieceView.character === 'traqueur' ||
              selectedOwnPieceView.character === 'arbaletrier') && (
              <div className="bw-unit-ability-bar" role="region" aria-label="Capacité spéciale de la pièce">
                {selectedOwnPieceView.character === 'traqueur' && (
                  <>
                    <div className="bw-unit-ability-info">
                      <strong>Traqueur — Marquage (0 action) :</strong>{' '}
                      {traqueurMarkModePieceId === selectedOwnPieceView.id ? (
                        <span className="bw-ability-accent">
                          Cliquez sur un ennemi déjà révélé en violet (1–3 cases H/V sans obstacle).
                        </span>
                      ) : selectedOwnPieceView.traqueurHasActiveMarkVisible ? (
                        <span>
                          Cible marquée — Poursuite +1 case (4 cases pour l’éliminer) :{' '}
                          <strong>
                            {selectedOwnPieceView.traqueurPursuitReadyVisible
                              ? 'ACTIVE ce tour !'
                              : 'active dès votre prochain tour'}
                          </strong>
                        </span>
                      ) : (
                        <span>
                          Aucune cible marquée. {traqueurMarkTargets.length > 0
                            ? `${traqueurMarkTargets.length} cible(s) révélée(s) à portée (marquage gratuit : ne consomme pas votre tour).`
                            : 'Révélez un ennemi à 1–3 cases H/V sans obstacle pour le marquer gratuitement.'}
                        </span>
                      )}
                    </div>
                    <div className="bw-unit-ability-actions">
                      <button
                        type="button"
                        className={`bw-btn bw-btn-sm ${traqueurMarkModePieceId === selectedOwnPieceView.id ? 'bw-btn-ghost' : 'bw-btn-primary'}`}
                        disabled={
                          traqueurMarkModePieceId !== selectedOwnPieceView.id &&
                          traqueurMarkTargets.length === 0
                        }
                        onClick={() =>
                          setTraqueurMarkModePieceId((curr) =>
                            curr === selectedOwnPieceView.id ? null : selectedOwnPieceView.id,
                          )
                        }
                      >
                        {traqueurMarkModePieceId === selectedOwnPieceView.id
                          ? '✕ Quitter mode Marquage'
                          : selectedOwnPieceView.traqueurHasActiveMarkVisible
                            ? 'Changer de cible (0 action)'
                            : 'Marquer une cible (0 action)'}
                      </button>
                    </div>
                  </>
                )}

                {selectedOwnPieceView.character === 'arbaletrier' && (
                  <div className="bw-unit-ability-info">
                    <strong>Arbalétrier — Tir (portée 1–3, 8 dir. • 1 tir / 3 tours) :</strong>{' '}
                    {selectedOwnPieceView.arbaletrierCooldownTurnsVisible &&
                    selectedOwnPieceView.arbaletrierCooldownTurnsVisible > 0 ? (
                      <span className="bw-ability-cooldown">
                        En recharge : encore {selectedOwnPieceView.arbaletrierCooldownTurnsVisible}{' '}
                        tour(s) personnel(s) avant le prochain tir (déplacement 1 case H/V autorisé).
                      </span>
                    ) : (
                      <span className="bw-ability-ready">
                        Tir prêt ! Cliquez sur un ennemi ciblé (violet) pour tirer sans bouger
                        (recharge ensuite pendant 2 de vos tours personnels, prêt au 3e).
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

          {/* Strictly Personal Tactical Annotations Toolbar (Chess.com style, Desktop & Mobile) */}
          <div
            className={`bw-annotation-toolbar ${annotationModeActive ? 'bw-annotation-toolbar-active' : ''}`}
            role="region"
            aria-label="Barre d'annotations tactiques personnelles"
          >
            <div className="bw-anno-row-main">
              <button
                type="button"
                className={`bw-btn bw-btn-sm ${annotationModeActive ? 'bw-btn-primary bw-anno-toggle-on' : 'bw-btn-secondary'}`}
                onClick={() => {
                  setAnnotationModeActive((prev) => !prev);
                  setPendingArrowStart(null);
                }}
              >
                {annotationModeActive ? '✏️ Annotations : ACTIF (Quitter)' : '✏️ Annotations'}
              </button>

              <div className="bw-anno-tools" role="group" aria-label="Outil d'annotation tactile">
                <button
                  type="button"
                  className={`bw-anno-tool-btn ${annotationModeActive && annotationTool === 'arrow' ? 'bw-anno-tool-active' : ''}`}
                  onClick={() => {
                    setAnnotationTool('arrow');
                    setAnnotationModeActive(true);
                    setPendingArrowStart(null);
                  }}
                  title="Dessiner une flèche en touchant Départ puis Arrivée"
                >
                  ↗️ Flèche
                </button>
                <button
                  type="button"
                  className={`bw-anno-tool-btn ${annotationModeActive && annotationTool === 'square' ? 'bw-anno-tool-active' : ''}`}
                  onClick={() => {
                    setAnnotationTool('square');
                    setAnnotationModeActive(true);
                    setPendingArrowStart(null);
                  }}
                  title="Colorer / décolorer une case"
                >
                  🟩 Case
                </button>
                <button
                  type="button"
                  className={`bw-anno-tool-btn ${annotationModeActive && annotationTool === 'erase' ? 'bw-anno-tool-active' : ''}`}
                  onClick={() => {
                    setAnnotationTool('erase');
                    setAnnotationModeActive(true);
                    setPendingArrowStart(null);
                  }}
                  title="Effacer une case ou flèche"
                >
                  🧹 Gomme
                </button>
              </div>

              <div className="bw-anno-colors" role="group" aria-label="Couleur tactique">
                {(
                  [
                    { id: 'red', label: 'Rouge (Attaque)' },
                    { id: 'green', label: 'Vert (Déplacement)' },
                    { id: 'blue', label: 'Bleu (Stratégie)' },
                    { id: 'yellow', label: 'Jaune (Attention)' },
                  ] as const
                ).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-label={c.label}
                    title={c.label}
                    className={`bw-anno-color-dot bw-anno-dot-${c.id} ${activeAnnotationColor === c.id ? 'bw-anno-dot-selected' : ''}`}
                    onClick={() => setActiveAnnotationColor(c.id)}
                  />
                ))}
              </div>

              <button
                type="button"
                className={`bw-anno-autoclear-btn ${autoClearAnnotationsOnMove ? 'bw-anno-autoclear-on' : ''}`}
                onClick={() => setAutoClearAnnotationsOnMove((v) => !v)}
                title="Effacer automatiquement vos annotations dès que vous jouez un coup"
              >
                {autoClearAnnotationsOnMove ? '✅ Auto-effacer' : '↺ Garder après coup'}
              </button>

              <button
                type="button"
                className="bw-btn bw-btn-ghost bw-btn-sm"
                disabled={currentViewerAnnotationCount === 0}
                onClick={handleClearViewerAnnotations}
              >
                🗑️ Tout effacer ({currentViewerAnnotationCount})
              </button>
            </div>

            {annotationModeActive ? (
              <div className="bw-anno-active-banner" role="status">
                <span>
                  ✏️ <strong>Mode annotation privé actif :</strong>{' '}
                  {annotationTool === 'arrow'
                    ? pendingArrowStart
                      ? `Départ ${coordToNotation(pendingArrowStart)} choisi — touchez la case d’arrivée.`
                      : 'Touchez la case de départ puis la case d’arrivée de votre flèche.'
                    : annotationTool === 'square'
                      ? 'Touchez une case pour appliquer ou retirer la couleur.'
                      : 'Touchez une case ou une flèche pour l’effacer.'}
                </span>
                <button
                  type="button"
                  className="bw-btn bw-btn-primary bw-btn-sm"
                  onClick={() => {
                    setAnnotationModeActive(false);
                    setPendingArrowStart(null);
                  }}
                >
                  ✅ Quitter
                </button>
              </div>
            ) : (
              <div className="bw-anno-hint-row">
                <span>
                  🔒 Visibles uniquement par vous • PC : <strong>clic droit glissé</strong> = flèche,{' '}
                  <strong>clic droit</strong> = case, <strong>clic sur flèche</strong> = supprimer
                </span>
              </div>
            )}
          </div>

          {/* Mobile & Tablet Compact Piece Dossier Slot (desktop shows full dossier in left sidebar) */}
          <div className="bw-mobile-piece-dossier-slot">
            <PieceDescriptionPanel
              viewerColor={viewerColor}
              phase={view.phase}
              inspectedCoord={inspectedSquare}
              piece={inspectedPiece}
              placementBrushChar={selectedBrushCharacter}
              compact
              onClearSelection={() => {
                setSelectedSquare(null);
                setInspectedSquare(null);
              }}
            />
          </div>

          {/* Mobile Quick Placement / Quick Card Strip right below the board */}
          <div className="bw-mobile-quick-strip">
            {view.phase === 'placement' ? (
              <div className="bw-mobile-placement-quick">
                {ownPlacementConfirmed ? (
                  <div className="bw-mobile-placement-locked">
                    <strong>✅ Placement validé (27/27)</strong> —{' '}
                    <span>En attente de l’autre joueur…</span>
                  </div>
                ) : (
                  <>
                    <div className="bw-mobile-placement-scroll">
                      {CHARACTER_TYPES.map((ch) => {
                        const remaining = ARMY_COMPOSITION[ch] - placedCounts[ch];
                        return (
                          <button
                            key={ch}
                            type="button"
                            className={`bw-mobile-brush-chip ${selectedBrushCharacter === ch ? 'bw-mobile-brush-active' : ''} ${remaining === 0 ? 'bw-palette-done' : ''}`}
                            onClick={() => setSelectedBrushCharacter(ch)}
                          >
                            <PieceArtwork character={ch} owner={viewerColor} size="xs" />
                            <span>{CHARACTER_CATALOG[ch].name}</span>
                            <strong>{remaining}</strong>
                          </button>
                        );
                      })}
                    </div>
                    <div className="bw-mobile-placement-actions">
                      <button
                        type="button"
                        className="bw-btn bw-btn-secondary bw-btn-sm"
                        onClick={() =>
                          setStagedPlacement(autoCompletePlacement(viewerColor, stagedPlacement))
                        }
                      >
                        ⚡ Auto (27/27)
                      </button>
                      <button
                        type="button"
                        className="bw-btn bw-btn-ghost bw-btn-sm"
                        onClick={() => setStagedPlacement([])}
                      >
                        🗑️ Vider
                      </button>
                      <button
                        type="button"
                        className="bw-btn bw-btn-primary bw-btn-sm"
                        disabled={effectiveStagedPlacement.length !== TOTAL_PIECES_PER_PLAYER}
                        onClick={() => handleConfirmPlacementEntries(effectiveStagedPlacement)}
                      >
                        ✅ Valider ({effectiveStagedPlacement.length}/27)
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="bw-mobile-cards-quick">
                <span className="bw-mobile-cards-label">
                  🃏 Main ({view.ownHand.length}/3) • Pioche {view.ownKillCounterTowardCard}/3
                </span>
                {view.ownHand.length === 0 ? (
                  <span className="bw-muted-small">Aucune carte en main</span>
                ) : (
                  <div className="bw-mobile-cards-chips">
                    {view.ownHand.map((cardId, idx) => {
                      const dossier = CARD_DOSSIERS[cardId];
                      const isSelected = activeCardInUse === cardId;
                      const isNewlyObtained = `${cardId}-${idx}` === highlightedNewCardKey;
                      return (
                        <button
                          key={`mob-${cardId}-${idx}`}
                          type="button"
                          disabled={!view.turn.canPlayCardNow}
                          className={`bw-mobile-card-chip ${isSelected ? 'bw-mobile-card-chip-active' : ''} ${isNewlyObtained ? 'bw-card-newly-obtained' : ''}`}
                          onClick={() => handleOpenCardConfirm(cardId)}
                        >
                          <span>{dossier.badge}</span>
                          <span>{dossier.name}</span>
                          {isNewlyObtained && <span className="bw-new-chip-dot">★</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar: Confidential Graveyard (§4.4) & Enhanced Action Log (§2.6) */}
        <aside className="bw-sidebar bw-sidebar-right">
          <div className="bw-panel">
            <h3>⚰️ Cimetière Confidentiel (§4.4)</h3>
            <div className="bw-graveyard-section">
              <h4>Pertes Adverses ({enemyGraveyard.length})</h4>
              {enemyGraveyard.length === 0 ? (
                <p className="bw-muted-small">Aucune pièce adverse éliminée.</p>
              ) : (
                <div className="bw-graveyard-chips">
                  {enemyGraveyard.map((g) => (
                    <span
                      key={g.pieceId}
                      className={`bw-grave-chip ${g.known ? 'bw-grave-known' : 'bw-grave-anonymous'}`}
                    >
                      <PieceArtwork
                        character={g.known && g.character ? g.character : 'secret'}
                        owner={viewerColor === 'red' ? 'black' : 'red'}
                        size="xs"
                      />{' '}
                      <span>{g.known && g.character ? g.label : 'Pièce éliminée'}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="bw-graveyard-section">
              <h4>Vos Pertes ({ownGraveyard.length})</h4>
              {ownGraveyard.length === 0 ? (
                <p className="bw-muted-small">Aucune perte dans votre armée.</p>
              ) : (
                <div className="bw-graveyard-chips">
                  {ownGraveyard.map((g) => {
                    const selectableForRes =
                      activeCardInUse === 'resurrection' &&
                      g.character !== null &&
                      isCardAllowedOnCharacter('resurrection', g.character);
                    return (
                      <button
                        key={g.pieceId}
                        type="button"
                        disabled={!selectableForRes}
                        className={`bw-grave-chip bw-grave-own ${selectedGraveyardPieceId === g.pieceId ? 'bw-grave-selected' : ''}`}
                        onClick={() => {
                          if (selectableForRes) {
                            setSelectedGraveyardPieceId(g.pieceId);
                          }
                        }}
                      >
                        {g.character && (
                          <PieceArtwork character={g.character} owner={viewerColor} size="xs" />
                        )}{' '}
                        <span>{g.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="bw-panel bw-log-panel">
            <div className="bw-panel-header-row">
              <h3>📜 Historique des Actions</h3>
              <span className="bw-muted-small">{view.actionLog.length} évén.</span>
            </div>
            <div className="bw-action-log">
              {view.actionLog.length === 0 ? (
                <p className="bw-muted-small">En attente du déploiement...</p>
              ) : (
                [...view.actionLog].reverse().map((entry) => {
                  const evMeta = EVENT_TYPE_META[entry.eventType ?? 'PIECE_MOVED'];
                  const timeStr = new Date(entry.timestampMs).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });
                  return (
                    <div key={entry.seq} className={`bw-log-entry ${evMeta.colorClass}`}>
                      <div className="bw-log-entry-head">
                        <span className="bw-log-seq">#{entry.seq}</span>
                        <span className="bw-log-type-badge">
                          {evMeta.icon} {evMeta.label}
                        </span>
                        <span className={`bw-log-actor bw-log-${entry.actor}`}>
                          {entry.actor === 'red' ? '🔴 Rouge' : '⚫ Noir'} • T{entry.turnNumber}
                        </span>
                        <span className="bw-log-time">{timeStr}</span>
                      </div>
                      <div className="bw-log-entry-body">{entry.text}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Dedicated Mobile Bottom Game Dock (§3.4 - §3.6) */}
      <nav className="bw-mobile-game-dock" aria-label="Menu tactique mobile">
        <button
          type="button"
          className={`bw-mobile-dock-btn ${mobileDrawer === 'cards' ? 'bw-mobile-dock-active' : ''} ${highlightedNewCardKey && view.phase !== 'placement' ? 'bw-mobile-dock-new-card' : ''}`}
          onClick={() => setMobileDrawer(mobileDrawer === 'cards' ? 'none' : 'cards')}
        >
          <span className="bw-mobile-dock-icon">
            {view.phase === 'placement' ? <PieceArtwork character="soldat" owner={viewerColor} size="xs" /> : '🃏'}
          </span>
          <span className="bw-mobile-dock-label">
            {view.phase === 'placement'
              ? ownPlacementConfirmed
                ? 'Validé ✓'
                : `Armée (${effectiveStagedPlacement.length}/27)`
              : `Cartes (${view.ownHand.length}/3)`}
          </span>
          {highlightedNewCardKey && view.phase !== 'placement' && (
            <span className="bw-mobile-dock-pulse-dot" aria-label="Nouvelle carte" />
          )}
        </button>

        <button
          type="button"
          className={`bw-mobile-dock-btn ${mobileDrawer === 'log' ? 'bw-mobile-dock-active' : ''}`}
          onClick={() => setMobileDrawer(mobileDrawer === 'log' ? 'none' : 'log')}
        >
          <span className="bw-mobile-dock-icon">📜</span>
          <span className="bw-mobile-dock-label">Historique ({view.actionLog.length})</span>
        </button>

        <button
          type="button"
          className={`bw-mobile-dock-btn ${mobileDrawer === 'graveyard' ? 'bw-mobile-dock-active' : ''}`}
          onClick={() => setMobileDrawer(mobileDrawer === 'graveyard' ? 'none' : 'graveyard')}
        >
          <span className="bw-mobile-dock-icon">⚰️</span>
          <span className="bw-mobile-dock-label">Cimetière ({view.graveyard.length})</span>
        </button>

        <button
          type="button"
          className={`bw-mobile-dock-btn ${mobileDrawer === 'effects' ? 'bw-mobile-dock-active' : ''}`}
          onClick={() => setMobileDrawer(mobileDrawer === 'effects' ? 'none' : 'effects')}
        >
          <span className="bw-mobile-dock-icon">📡</span>
          <span className="bw-mobile-dock-label">
            Effets ({view.cardNotifications.length})
          </span>
        </button>

        <button
          type="button"
          className={`bw-mobile-dock-btn ${mobileDrawer === 'menu' ? 'bw-mobile-dock-active' : ''}`}
          onClick={() => setMobileDrawer(mobileDrawer === 'menu' ? 'none' : 'menu')}
        >
          <span className="bw-mobile-dock-icon">📖</span>
          <span className="bw-mobile-dock-label">Options</span>
        </button>
      </nav>

      {/* Sliding Mobile Bottom Drawer (§3.6) */}
      {mobileDrawer !== 'none' && (
        <div className="bw-mobile-drawer-backdrop" onClick={() => setMobileDrawer('none')}>
          <div className="bw-mobile-drawer-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="bw-mobile-drawer-handle" />
            <div className="bw-mobile-drawer-header">
              <h3>
                {mobileDrawer === 'cards' &&
                  (view.phase === 'placement'
                    ? `Placement de votre Armée (${effectiveStagedPlacement.length}/27)`
                    : `🃏 Vos Cartes en Main (${view.ownHand.length}/3)`)}
                {mobileDrawer === 'log' && `📜 Historique des Actions (${view.actionLog.length})`}
                {mobileDrawer === 'graveyard' && '⚰️ Cimetière Confidentiel (§4.4)'}
                {mobileDrawer === 'effects' && '📡 Effets Actifs & Cartes Jouées'}
                {mobileDrawer === 'menu' && '📖 Règles & Options de Partie'}
              </h3>
              <button
                type="button"
                className="bw-btn bw-btn-ghost bw-btn-sm"
                onClick={() => setMobileDrawer('none')}
              >
                ✕ Fermer
              </button>
            </div>

            <div className="bw-mobile-drawer-body">
              {mobileDrawer === 'cards' &&
                (view.phase === 'placement' ? (
                  <div>
                    {ownPlacementConfirmed && (
                      <div className="bw-placement-locked-box">
                        <strong>✅ Placement validé et verrouillé (27/27)</strong> — en attente de
                        l’autre joueur…
                      </div>
                    )}
                    <div className="bw-roster-palette">
                      {CHARACTER_TYPES.map((ch) => {
                        const placed = placedCounts[ch];
                        const max = ARMY_COMPOSITION[ch];
                        const remaining = max - placed;
                        return (
                          <button
                            key={ch}
                            type="button"
                            disabled={ownPlacementConfirmed}
                            className={`bw-palette-item ${selectedBrushCharacter === ch ? 'bw-palette-active' : ''} ${remaining === 0 ? 'bw-palette-done' : ''}`}
                            onClick={() => {
                              setSelectedBrushCharacter(ch);
                              setMobileDrawer('none');
                            }}
                          >
                            <span className="bw-palette-symbol">
                              <PieceArtwork character={ch} owner={viewerColor} size="sm" />
                            </span>
                            <span className="bw-palette-name">{CHARACTER_CATALOG[ch].name}</span>
                            <span className="bw-palette-count">
                              {remaining} restant{remaining > 1 ? 's' : ''}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="bw-cards-list">
                    {view.ownHand.length === 0 ? (
                      <p className="bw-muted-small">
                        Aucune carte en main. Compteur pioche : {view.ownKillCounterTowardCard}/3
                      </p>
                    ) : (
                      view.ownHand.map((cardId, idx) => {
                        const dossier = CARD_DOSSIERS[cardId];
                        const isSelectedCard = activeCardInUse === cardId;
                        const isNewlyObtained = `${cardId}-${idx}` === highlightedNewCardKey;
                        return (
                          <div
                            key={`drawer-${cardId}-${idx}`}
                            className={`bw-card-item ${isSelectedCard ? 'bw-card-selected' : ''} ${isNewlyObtained ? 'bw-card-newly-obtained' : ''}`}
                          >
                            <div className="bw-card-top">
                              <span className="bw-card-title">
                                {dossier.badge} {dossier.name}
                                {isNewlyObtained && (
                                  <span className="bw-new-card-badge">NOUVELLE !</span>
                                )}
                              </span>
                              <span className="bw-card-duration">{dossier.durationLabel}</span>
                            </div>
                            <p className="bw-card-desc">{dossier.effectDescription}</p>
                            <button
                              type="button"
                              className="bw-btn bw-btn-primary bw-btn-sm"
                              disabled={!view.turn.canPlayCardNow}
                              onClick={() => {
                                setMobileDrawer('none');
                                handleOpenCardConfirm(cardId);
                              }}
                            >
                              {isSelectedCard ? 'Annuler le ciblage' : '🃏 Préparer cette carte'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                ))}

              {mobileDrawer === 'log' && (
                <div className="bw-action-log">
                  {view.actionLog.length === 0 ? (
                    <p className="bw-muted-small">Aucun événement enregistré.</p>
                  ) : (
                    [...view.actionLog].reverse().map((entry) => {
                      const evMeta = EVENT_TYPE_META[entry.eventType ?? 'PIECE_MOVED'];
                      const timeStr = new Date(entry.timestampMs).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      });
                      return (
                        <div key={entry.seq} className={`bw-log-entry ${evMeta.colorClass}`}>
                          <div className="bw-log-entry-head">
                            <span className="bw-log-seq">#{entry.seq}</span>
                            <span className="bw-log-type-badge">
                              {evMeta.icon} {evMeta.label}
                            </span>
                            <span className={`bw-log-actor bw-log-${entry.actor}`}>
                              {entry.actor === 'red' ? '🔴 Rouge' : '⚫ Noir'} • T{entry.turnNumber}
                            </span>
                            <span className="bw-log-time">{timeStr}</span>
                          </div>
                          <div className="bw-log-entry-body">{entry.text}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {mobileDrawer === 'graveyard' && (
                <div>
                  <div className="bw-graveyard-section">
                    <h4>Pertes Adverses ({enemyGraveyard.length})</h4>
                    {enemyGraveyard.length === 0 ? (
                      <p className="bw-muted-small">Aucune pièce adverse éliminée.</p>
                    ) : (
                      <div className="bw-graveyard-chips">
                        {enemyGraveyard.map((g) => (
                          <span
                            key={g.pieceId}
                            className={`bw-grave-chip ${g.known ? 'bw-grave-known' : 'bw-grave-anonymous'}`}
                          >
                            <PieceArtwork
                              character={g.known && g.character ? g.character : 'secret'}
                              owner={viewerColor === 'red' ? 'black' : 'red'}
                              size="xs"
                            />{' '}
                            <span>{g.known && g.character ? g.label : 'Pièce éliminée'}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="bw-graveyard-section">
                    <h4>Vos Pertes ({ownGraveyard.length})</h4>
                    {ownGraveyard.length === 0 ? (
                      <p className="bw-muted-small">Aucune perte dans votre armée.</p>
                    ) : (
                      <div className="bw-graveyard-chips">
                        {ownGraveyard.map((g) => {
                          const selectableForRes =
                            activeCardInUse === 'resurrection' &&
                            g.character !== null &&
                            isCardAllowedOnCharacter('resurrection', g.character);
                          return (
                            <button
                              key={g.pieceId}
                              type="button"
                              disabled={!selectableForRes}
                              className={`bw-grave-chip bw-grave-own ${selectedGraveyardPieceId === g.pieceId ? 'bw-grave-selected' : ''}`}
                              onClick={() => {
                                if (selectableForRes) {
                                  setSelectedGraveyardPieceId(g.pieceId);
                                  setMobileDrawer('none');
                                }
                              }}
                            >
                              {g.character && (
                                <PieceArtwork
                                  character={g.character}
                                  owner={viewerColor}
                                  size="xs"
                                />
                              )}{' '}
                              <span>{g.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {mobileDrawer === 'effects' && (
                <div>
                  <ul className="bw-status-list">
                    <li>
                      Brouillard Rouge :{' '}
                      <strong>{view.fogActiveByPlayer.red ? '🌫️ ACTIF' : 'Inactif'}</strong>
                    </li>
                    <li>
                      Brouillard Noir :{' '}
                      <strong>{view.fogActiveByPlayer.black ? '🌫️ ACTIF' : 'Inactif'}</strong>
                    </li>
                    <li>
                      Cases surveillées par vos Guetteurs :{' '}
                      <strong>{view.guetteurReconCoords.length}</strong>
                    </li>
                    <li>
                      Alertes Pièges posés : <strong>{view.totalActiveTrapNotifications}</strong>
                    </li>
                    <li>
                      Cartes en main adverse : <strong>{view.opponentHandCount}/3</strong>
                    </li>
                    {(() => {
                      const ownTraq = view.pieces.find(
                        (p) => p.owner === viewerColor && p.character === 'traqueur',
                      );
                      const ownArb = view.pieces.find(
                        (p) => p.owner === viewerColor && p.character === 'arbaletrier',
                      );
                      return (
                        <>
                          {ownTraq && (
                            <li>
                              Traqueur :{' '}
                              <strong>
                                {ownTraq.traqueurHasActiveMarkVisible
                                  ? ownTraq.traqueurPursuitReadyVisible
                                    ? 'Poursuite +1 PRÊTE (élimination)'
                                    : 'Cible marquée (tour suivant)'
                                  : 'Aucune cible'}
                              </strong>
                            </li>
                          )}
                          {ownArb && (
                            <li>
                              Arbalétrier :{' '}
                              <strong>
                                {ownArb.arbaletrierCooldownTurnsVisible &&
                                ownArb.arbaletrierCooldownTurnsVisible > 0
                                  ? `Recharge (${ownArb.arbaletrierCooldownTurnsVisible} tour(s) perso)`
                                  : 'Tir PRÊT (1 tir / 3 tours)'}
                              </strong>
                            </li>
                          )}
                        </>
                      );
                    })()}
                  </ul>
                  <h4 style={{ marginTop: '1rem' }}>
                    🔔 Dernières Cartes Jouées ({view.cardNotifications.length})
                  </h4>
                  {view.cardNotifications.length === 0 ? (
                    <p className="bw-muted-small">Aucune carte jouée dans cette partie.</p>
                  ) : (
                    <div className="bw-card-history-list">
                      {[...view.cardNotifications].reverse().map((notif) => (
                        <div key={notif.id} className="bw-card-history-item">
                          <div className="bw-card-history-top">
                            <span>
                              <strong>
                                {notif.badge} {notif.cardName}
                              </strong>{' '}
                              — {notif.actor === 'red' ? '🔴 Rouge' : '⚫ Noir'} (Tour #
                              {notif.turnNumber})
                            </span>
                          </div>
                          <p className="bw-muted-small">{notif.consequenceText}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {mobileDrawer === 'menu' && (
                <div className="bw-mobile-menu-actions">
                  <button
                    type="button"
                    className="bw-btn bw-btn-secondary"
                    onClick={() => {
                      setMobileDrawer('none');
                      setShowInGameRulesModal(true);
                    }}
                  >
                    📖 Ouvrir l’Encyclopédie & les Règles
                  </button>
                  <button
                    type="button"
                    className="bw-btn bw-btn-secondary"
                    onClick={() => {
                      setMobileDrawer('none');
                      setShowCardHistoryModal(true);
                    }}
                  >
                    🔔 Historique des Cartes ({view.cardNotifications.length})
                  </button>
                  {view.phase === 'playing' && mode !== 'tutorial' && (
                    <>
                      <button
                        type="button"
                        className="bw-btn bw-btn-secondary"
                        onClick={() => {
                          setMobileDrawer('none');
                          if (mode === 'online' && onOnlineAction) {
                            onOnlineAction.offerDraw();
                          } else {
                            setLocalState(
                              proposeOrAcceptMutualDraw(localState, viewerColor, Date.now()),
                            );
                          }
                        }}
                      >
                        {view.drawOfferFrom && view.drawOfferFrom !== viewerColor
                          ? '🤝 Accepter la proposition de Nul'
                          : '🤝 Proposer un Match Nul'}
                      </button>
                      <button
                        type="button"
                        className="bw-btn bw-btn-danger"
                        onClick={() => {
                          setMobileDrawer('none');
                          setConfirmingResign(true);
                        }}
                      >
                        🏳️ Abandonner la partie
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="bw-btn bw-btn-ghost"
                    onClick={() => {
                      setMobileDrawer('none');
                      onExitToMenu();
                    }}
                  >
                    ← Retourner au Menu Principal
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Touch-Friendly Card Confirmation Modal (§3.8) */}
      {confirmingCard && (
        <div className="bw-modal-backdrop" onClick={() => setConfirmingCard(null)}>
          <div className="bw-modal-dialog bw-modal-compact" onClick={(e) => e.stopPropagation()}>
            <div className="bw-modal-header">
              <h2>
                {CARD_DOSSIERS[confirmingCard].badge} {CARD_DOSSIERS[confirmingCard].name}
              </h2>
              <button
                type="button"
                className="bw-btn bw-btn-ghost bw-btn-sm"
                onClick={() => setConfirmingCard(null)}
              >
                ✕
              </button>
            </div>
            <div className="bw-modal-body">
              <p>
                <strong>Effet :</strong> {CARD_DOSSIERS[confirmingCard].effectDescription}
              </p>
              <p className="bw-muted-small">
                <strong>Durée :</strong> {CARD_DOSSIERS[confirmingCard].durationLabel} •{' '}
                <strong>Visibilité :</strong> {CARD_DOSSIERS[confirmingCard].visibilityLabel}
              </p>
              {CARD_CATALOG[confirmingCard].forbiddenOnCharacters.length > 0 && (
                <p className="bw-card-restriction-note">
                  ⚠️ Restriction officielle : ne peut pas cibler{' '}
                  {CARD_CATALOG[confirmingCard].forbiddenOnCharacters
                    .map((c) => CHARACTER_CATALOG[c].name)
                    .join(' ni ')}
                  .
                </p>
              )}
              <div className="bw-modal-footer-btns">
                {confirmingCard === 'block' ||
                confirmingCard === 'brouillard' ||
                confirmingCard === 'double_action' ? (
                  <button
                    type="button"
                    className="bw-btn bw-btn-primary"
                    disabled={!view.turn.canPlayCardNow}
                    onClick={() => dispatchCardPlay({ card: confirmingCard })}
                  >
                    ✅ Confirmer et Activer Immédiatement
                  </button>
                ) : (
                  <button
                    type="button"
                    className="bw-btn bw-btn-primary"
                    disabled={!view.turn.canPlayCardNow}
                    onClick={() => {
                      const cardToTarget = confirmingCard;
                      setConfirmingCard(null);
                      setActiveCardInUse(cardToTarget);
                      setCardSourcePieceId(null);
                      setEspionageSelectedIds([]);
                      if (cardToTarget === 'resurrection') {
                        setMobileDrawer('graveyard');
                      }
                    }}
                  >
                    Choisir la Cible sur le Plateau
                  </button>
                )}
                <button
                  type="button"
                  className="bw-btn bw-btn-ghost"
                  onClick={() => setConfirmingCard(null)}
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resignation Confirmation Modal (§3.10) */}
      {confirmingResign && (
        <div className="bw-modal-backdrop" onClick={() => setConfirmingResign(false)}>
          <div className="bw-modal-dialog bw-modal-compact" onClick={(e) => e.stopPropagation()}>
            <div className="bw-modal-header">
              <h2>🏳️ Confirmer l’Abandon</h2>
              <button
                type="button"
                className="bw-btn bw-btn-ghost bw-btn-sm"
                onClick={() => setConfirmingResign(false)}
              >
                ✕
              </button>
            </div>
            <div className="bw-modal-body">
              <p>
                Êtes-vous sûr de vouloir abandonner cette partie ? Cette action est irréversible et
                accordera immédiatement la victoire à votre adversaire.
              </p>
              <div className="bw-modal-footer-btns">
                <button
                  type="button"
                  className="bw-btn bw-btn-danger"
                  onClick={() => {
                    setConfirmingResign(false);
                    if (mode === 'online' && onOnlineAction) {
                      onOnlineAction.resign();
                    } else {
                      setLocalState(resignMatch(localState, viewerColor, Date.now()));
                    }
                  }}
                >
                  🏳️ Oui, Abandonner
                </button>
                <button
                  type="button"
                  className="bw-btn bw-btn-secondary"
                  onClick={() => setConfirmingResign(false)}
                >
                  Continuer le combat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Important Action Confirmation Modal (Exit / Mutual Draw) */}
      {pendingImportantConfirm && (
        <div className="bw-modal-backdrop" onClick={() => setPendingImportantConfirm(null)}>
          <div className="bw-modal-dialog bw-modal-compact" onClick={(e) => e.stopPropagation()}>
            <div className="bw-modal-header">
              <h2>
                {pendingImportantConfirm === 'exit'
                  ? '🚪 Quitter la partie ?'
                  : view.drawOfferFrom && view.drawOfferFrom !== viewerColor
                    ? '🤝 Accepter le match nul ?'
                    : '🤝 Proposer un match nul ?'}
              </h2>
              <button
                type="button"
                className="bw-btn bw-btn-ghost bw-btn-sm"
                onClick={() => setPendingImportantConfirm(null)}
              >
                ✕
              </button>
            </div>
            <div className="bw-modal-body">
              <p>
                {pendingImportantConfirm === 'exit'
                  ? 'Une partie est actuellement en cours. Voulez-vous vraiment revenir au menu principal ?'
                  : view.drawOfferFrom && view.drawOfferFrom !== viewerColor
                    ? 'Accepter le match nul mettra immédiatement fin à la partie sur une égalité.'
                    : 'Envoyer une proposition de match nul à votre adversaire ?'}
              </p>
              <div className="bw-modal-footer-btns">
                <button
                  type="button"
                  className="bw-btn bw-btn-primary"
                  onClick={() => {
                    const action = pendingImportantConfirm;
                    setPendingImportantConfirm(null);
                    if (action === 'exit') {
                      onExitToMenu();
                    } else if (mode === 'online' && onOnlineAction) {
                      onOnlineAction.offerDraw();
                    } else {
                      setLocalState(proposeOrAcceptMutualDraw(localState, viewerColor, Date.now()));
                    }
                  }}
                >
                  ✅ Confirmer
                </button>
                <button
                  type="button"
                  className="bw-btn bw-btn-secondary"
                  onClick={() => setPendingImportantConfirm(null)}
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Card Notifications History Modal (§2.4 - §2.5) */}
      {showCardHistoryModal && (
        <div className="bw-modal-backdrop" onClick={() => setShowCardHistoryModal(false)}>
          <div className="bw-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="bw-modal-header">
              <h2>🔔 Historique des Cartes Utilisées ({view.cardNotifications.length})</h2>
              <button
                type="button"
                className="bw-btn bw-btn-ghost"
                onClick={() => setShowCardHistoryModal(false)}
              >
                ✕ Fermer
              </button>
            </div>
            <div className="bw-modal-body">
              {view.cardNotifications.length === 0 ? (
                <p className="bw-muted-small">Aucune carte n’a encore été jouée dans cette partie.</p>
              ) : (
                <div className="bw-card-history-list">
                  {[...view.cardNotifications].reverse().map((notif) => (
                    <div
                      key={notif.id}
                      className={`bw-card-history-item ${CARD_CATEGORY_META[notif.category].className}`}
                    >
                      <div className="bw-card-history-top">
                        <span className="bw-card-history-name">
                          {notif.badge} <strong>{notif.cardName}</strong>
                        </span>
                        <span className="bw-card-history-meta">
                          Joueur {notif.actor === 'red' ? 'Rouge 🔴' : 'Noir ⚫'} • Tour #
                          {notif.turnNumber}
                        </span>
                      </div>
                      <p className="bw-card-history-desc">{notif.shortDescription}</p>
                      <div className="bw-card-history-consequence">
                        <strong>Conséquence :</strong> {notif.consequenceText}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* In-Game Encyclopedia & Rules Modal (§16) */}
      {showInGameRulesModal && (
        <div className="bw-modal-backdrop" onClick={() => setShowInGameRulesModal(false)}>
          <div className="bw-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="bw-modal-header">
              <h2>📖 Encyclopédie & Règles Officielles de BLIND WAR</h2>
              <button
                type="button"
                className="bw-btn bw-btn-ghost"
                onClick={() => setShowInGameRulesModal(false)}
              >
                ✕ Fermer
              </button>
            </div>
            <div className="bw-modal-tabs">
              <button
                type="button"
                className={`bw-btn bw-btn-sm ${rulesModalTab === 'rules' ? 'bw-btn-primary' : 'bw-btn-secondary'}`}
                onClick={() => setRulesModalTab('rules')}
              >
                📜 Règles officielles
              </button>
              <button
                type="button"
                className={`bw-btn bw-btn-sm ${rulesModalTab === 'mechanics' ? 'bw-btn-primary' : 'bw-btn-secondary'}`}
                onClick={() => setRulesModalTab('mechanics')}
              >
                ✨ Mécaniques & Nouveautés
              </button>
              <button
                type="button"
                className={`bw-btn bw-btn-sm ${rulesModalTab === 'characters' ? 'bw-btn-primary' : 'bw-btn-secondary'}`}
                onClick={() => setRulesModalTab('characters')}
              >
                12 Personnages (27 pions)
              </button>
              <button
                type="button"
                className={`bw-btn bw-btn-sm ${rulesModalTab === 'faq' ? 'bw-btn-primary' : 'bw-btn-secondary'}`}
                onClick={() => setRulesModalTab('faq')}
              >
                ❓ FAQ & Guide
              </button>
              {mode !== 'tutorial' && dismissedContextualIds.length > 0 && (
                <button
                  type="button"
                  className="bw-btn bw-btn-ghost bw-btn-sm"
                  onClick={() => {
                    resetContextualTips();
                    setDismissedContextualIds([]);
                  }}
                >
                  ↺ Réactiver guides contextuels ({dismissedContextualIds.length})
                </button>
              )}
            </div>
            <div className="bw-modal-body">
              {rulesModalTab === 'rules' &&
                RULE_SECTIONS.map((sec) => (
                  <div key={sec.id} className="bw-rule-block">
                    <h3>{sec.title}</h3>
                    <p>{sec.summary}</p>
                    <ul>
                      {sec.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </div>
                ))}

              {rulesModalTab === 'mechanics' &&
                MECHANIC_DOSSIERS.map((mech) => (
                  <div key={mech.id} className="bw-rule-block">
                    <h3>
                      {mech.badge} {mech.title}
                    </h3>
                    <p>{mech.summary}</p>
                    <ul>
                      {mech.rules.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                    {mech.edgeCases.length > 0 && (
                      <p className="bw-muted-small">
                        <strong>Cas particuliers :</strong> {mech.edgeCases.join(' • ')}
                      </p>
                    )}
                  </div>
                ))}

              {rulesModalTab === 'characters' &&
                CHARACTER_TYPES.map((ch) => {
                  const d = CHARACTER_DOSSIERS[ch];
                  return (
                    <div key={ch} className="bw-rule-block">
                      <h3 className="bw-rule-char-heading">
                        <PieceArtwork character={ch} owner={viewerColor} size="sm" />{' '}
                        <span>
                          {d.name} ({d.initialQuantity}/27)
                        </span>
                      </h3>
                      <PieceDualVariantPreview character={ch} size="xs" />
                      <p>
                        <strong>Rôle :</strong> {d.roleSummary}
                      </p>
                      <ul>
                        <li>
                          <strong>Déplacement :</strong> {d.movementSummary}
                        </li>
                        <li>
                          <strong>Capacité spéciale :</strong> {d.specialAbility}
                        </li>
                        {d.interactionsSummary.length > 0 && (
                          <li>
                            <strong>Interactions :</strong> {d.interactionsSummary.join(' • ')}
                          </li>
                        )}
                      </ul>
                    </div>
                  );
                })}

              {rulesModalTab === 'faq' && (
                <>
                  <div className="bw-rule-block">
                    <h3>❓ Questions fréquentes (FAQ)</h3>
                    {FAQ_ITEMS.map((faq) => (
                      <div key={faq.id} style={{ marginBottom: '0.8rem' }}>
                        <strong>{faq.question}</strong>
                        <p className="bw-muted-small" style={{ marginTop: '0.2rem' }}>
                          {faq.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="bw-rule-block">
                    <h3>⚙️ Guide des paramètres</h3>
                    <ul>
                      {SETTINGS_HELP_ITEMS.map((item) => (
                        <li key={item.id}>
                          <strong>{item.section} :</strong> {item.summary}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
