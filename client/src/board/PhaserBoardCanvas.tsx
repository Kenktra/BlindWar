import React, { useEffect, useRef, useState } from 'react';
import type Phaser from 'phaser';
import {
  BOARD_COLS,
  BOARD_ROWS,
  CHARACTER_DOSSIERS,
  COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD,
  COL_LABELS,
  coordKey,
  getBoardSquareColor,
  getBoardSquareSlot,
  getPieceVisualVariantAtCoord,
  isInPlacementZone,
  type AnnotationColor,
  type BoardArrowAnnotation,
  type BoardSquareMark,
  type CharacterType,
  type ClientPieceView,
  type Coord,
  type LastMoveInfo,
  type MoveCandidate,
  type PlacementEntry,
  type PlayerColor,
} from '../../../shared/src/index.js';
import { PieceArtwork } from '../components/PieceArtwork.js';
import { useBlindWarTheme } from '../themes/themeManager.js';

const ANNOTATION_SVG_PALETTE: Readonly<
  Record<AnnotationColor, { readonly stroke: string; readonly halo: string; readonly label: string }>
> = {
  red: {
    stroke: 'rgba(248, 113, 113, 0.95)',
    halo: 'rgba(127, 29, 29, 0.55)',
    label: 'Rouge',
  },
  green: {
    stroke: 'rgba(74, 222, 128, 0.95)',
    halo: 'rgba(20, 83, 45, 0.55)',
    label: 'Vert',
  },
  blue: {
    stroke: 'rgba(56, 189, 248, 0.96)',
    halo: 'rgba(12, 74, 110, 0.55)',
    label: 'Bleu',
  },
  yellow: {
    stroke: 'rgba(250, 204, 21, 0.96)',
    halo: 'rgba(113, 63, 18, 0.55)',
    label: 'Jaune',
  },
};

export interface PhaserBoardCanvasProps {
  readonly phase: 'placement' | 'playing' | 'finished';
  readonly viewerColor: PlayerColor;
  readonly isViewerTurn?: boolean;
  readonly isSpectator?: boolean;
  readonly opponentStatusLabel?: string | null;
  readonly dynamicBoardScale?: boolean;
  readonly boardScale?: 'compact' | 'normal' | 'large';
  readonly recentlyMarkedCoord?: Coord | null;
  readonly pieces: readonly ClientPieceView[];
  readonly stagedPlacement?: readonly PlacementEntry[];
  readonly selectedCoord: Coord | null;
  readonly highlightedMoves: readonly MoveCandidate[];
  readonly highlightedCardSquares: readonly Coord[];
  readonly highlightedTraqueurMarkCoords?: readonly Coord[];
  readonly selectedEspionageIds?: readonly string[];
  readonly guetteurReconCoords: readonly Coord[];
  readonly ownTraps: readonly Coord[];
  readonly lastMove?: LastMoveInfo | null;
  readonly annotationArrows?: readonly BoardArrowAnnotation[];
  readonly annotationMarks?: readonly BoardSquareMark[];
  readonly annotationModeActive?: boolean;
  readonly activeAnnotationColor?: AnnotationColor;
  readonly pendingArrowStart?: Coord | null;
  readonly showCoordinates: boolean;
  readonly showReconZones: boolean;
  readonly onSquareClick: (coord: Coord) => void;
  readonly onUpsertArrow?: (from: Coord, to: Coord) => void;
  readonly onToggleSquareMark?: (coord: Coord) => void;
  readonly onRemoveArrow?: (arrowId: string) => void;
}

export const PhaserBoardCanvas: React.FC<PhaserBoardCanvasProps> = ({
  phase,
  viewerColor,
  isViewerTurn = true,
  isSpectator = false,
  opponentStatusLabel = null,
  dynamicBoardScale = true,
  boardScale = 'normal',
  recentlyMarkedCoord = null,
  pieces,
  stagedPlacement = [],
  selectedCoord,
  highlightedMoves,
  highlightedCardSquares,
  highlightedTraqueurMarkCoords = [],
  selectedEspionageIds = [],
  guetteurReconCoords,
  ownTraps,
  lastMove = null,
  annotationArrows = [],
  annotationMarks = [],
  annotationModeActive = false,
  activeAnnotationColor = 'red',
  pendingArrowStart = null,
  showCoordinates,
  showReconZones,
  onSquareClick,
  onUpsertArrow,
  onToggleSquareMark,
  onRemoveArrow,
}) => {
  const phaserHostRef = useRef<HTMLDivElement | null>(null);
  const phaserGameRef = useRef<Phaser.Game | null>(null);
  const pulseGraphicsRef = useRef<Phaser.GameObjects.Graphics | null>(null);
  const themeState = useBlindWarTheme();
  const phaserThemeRef = useRef<{ pulseHex: number; reduceMotion: boolean }>({
    pulseHex: themeState.boardTheme.ui.phaserPulseHex,
    reduceMotion: themeState.effectiveMotionReduced,
  });
  phaserThemeRef.current = {
    pulseHex: themeState.boardTheme.ui.phaserPulseHex,
    reduceMotion: themeState.effectiveMotionReduced,
  };
  const [rightDragStart, setRightDragStart] = useState<Coord | null>(null);
  const [rightDragCurrent, setRightDragCurrent] = useState<Coord | null>(null);

  useEffect(() => {
    if (rightDragStart === null) {
      return;
    }
    const handleGlobalMouseUp = (ev: MouseEvent) => {
      if (ev.button !== 2) {
        return;
      }
      const target = rightDragCurrent ?? rightDragStart;
      if (rightDragStart.row === target.row && rightDragStart.col === target.col) {
        onToggleSquareMark?.(rightDragStart);
      } else {
        onUpsertArrow?.(rightDragStart, target);
      }
      setRightDragStart(null);
      setRightDragCurrent(null);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [rightDragStart, rightDragCurrent, onToggleSquareMark, onUpsertArrow]);

  // Initialize Phaser 3 tactical ambient canvas layer for particle/pulse effects
  useEffect(() => {
    if (typeof window === 'undefined' || !phaserHostRef.current || phaserGameRef.current) {
      return;
    }

    let cancelled = false;
    const host = phaserHostRef.current;

    void import('phaser')
      .then((mod) => {
        if (cancelled || !host || phaserGameRef.current) return;
        const PhaserLib = mod.default ?? mod;
        class TacticalEffectScene extends PhaserLib.Scene {
          private t = 0;
          create() {
            pulseGraphicsRef.current = this.add.graphics();
          }
          update(_time: number, delta: number) {
            const g = pulseGraphicsRef.current;
            if (!g) return;
            g.clear();
            const { pulseHex, reduceMotion } = phaserThemeRef.current;
            if (!reduceMotion) {
              this.t += delta * 0.003;
            }
            const alpha = reduceMotion ? 0.08 : 0.08 + Math.sin(this.t) * 0.04;
            g.lineStyle(1, pulseHex, alpha);
            for (let i = 0; i <= 9; i += 1) {
              const pos = (i / 9) * 540;
              g.lineBetween(pos, 0, pos, 540);
              g.lineBetween(0, pos, 540, pos);
            }
          }
        }

        try {
          phaserGameRef.current = new PhaserLib.Game({
            type: PhaserLib.CANVAS,
            parent: host,
            width: 540,
            height: 540,
            transparent: true,
            scene: TacticalEffectScene,
            audio: { noAudio: true },
            banner: false,
          });
        } catch {
          // Fallback gracefully if headless environment lacks WebGL/Canvas context
        }
      })
      .catch(() => {
        // Ignore in headless test environment
      });

    return () => {
      cancelled = true;
      if (phaserGameRef.current) {
        phaserGameRef.current.destroy(true);
        phaserGameRef.current = null;
      }
    };
  }, []);

  const pieceBySquare = new Map<string, ClientPieceView>();
  for (const p of pieces) {
    pieceBySquare.set(coordKey(p.position), p);
  }

  const stagedBySquare = new Map<string, CharacterType>();
  if (phase === 'placement') {
    for (const entry of stagedPlacement) {
      stagedBySquare.set(coordKey(entry.coord), entry.character);
    }
  }

  const movesBySquare = new Map<string, MoveCandidate[]>();
  for (const m of highlightedMoves) {
    const k = coordKey(m.to);
    const list = movesBySquare.get(k);
    if (list) list.push(m);
    else movesBySquare.set(k, [m]);
  }
  const moveBySquare = new Map<string, MoveCandidate>();
  for (const [k, list] of movesBySquare.entries()) {
    moveBySquare.set(k, list[0]!);
  }

  const cardTargetSet = new Set(highlightedCardSquares.map(coordKey));
  const traqueurMarkSet = new Set(highlightedTraqueurMarkCoords.map(coordKey));
  const reconSet = new Set(guetteurReconCoords.map(coordKey));
  const trapSet = new Set(ownTraps.map(coordKey));
  const annoMarkBySquare = new Map<string, AnnotationColor>();
  for (const mark of annotationMarks) {
    annoMarkBySquare.set(coordKey(mark.coord), mark.color);
  }
  const pendingArrowKey = pendingArrowStart ? coordKey(pendingArrowStart) : null;

  const lastFromKey = lastMove?.from ? coordKey(lastMove.from) : null;
  const lastToKey = lastMove?.to ? coordKey(lastMove.to) : null;
  const lastPassedThroughKey = lastMove?.passedThroughCoord
    ? coordKey(lastMove.passedThroughCoord)
    : null;
  const lastEliminatedSet = new Set((lastMove?.eliminatedCoords ?? []).map(coordKey));
  const lastBlockedKey = lastMove?.blockedAtCoord ? coordKey(lastMove.blockedAtCoord) : null;
  const lastIntermediateSet = new Set<string>();
  if (lastMove && lastMove.steps.length > 1) {
    for (let i = 0; i < lastMove.steps.length - 1; i += 1) {
      lastIntermediateSet.add(coordKey(lastMove.steps[i]!.to));
    }
  }

  const rows: number[] = [];
  for (let r = 0; r < BOARD_ROWS; r += 1) {
    rows.push(r);
  }

  const recentlyMarkedKey = recentlyMarkedCoord ? coordKey(recentlyMarkedCoord) : null;
  const turnScaleClass =
    !dynamicBoardScale || phase === 'finished' || isSpectator
      ? 'bw-board-turn-neutral'
      : isViewerTurn
        ? 'bw-board-turn-yours'
        : 'bw-board-turn-opponent';

  return (
    <div
      className={`bw-board-stage bw-board-scale-${boardScale}`}
      data-board-turn-state={isViewerTurn ? 'yours' : 'opponent'}
      data-dynamic-scale={dynamicBoardScale ? 'true' : 'false'}
    >
      <div
        className={`bw-board-wrapper ${turnScaleClass} ${annotationModeActive ? 'bw-board-annotation-mode' : ''}`}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Discrete Turn & Dynamic Board State Indicator (§3) */}
        <div className={`bw-board-turn-ribbon ${isViewerTurn ? 'yours' : 'opponent'}`} aria-live="polite">
          {isSpectator ? (
            <span className="bw-ribbon-text">👁️ MODE SPECTATEUR — OBSERVATION EN DIRECT</span>
          ) : phase === 'placement' ? (
            <span className="bw-ribbon-text">
              {isViewerTurn
                ? '♟️ PHASE DE PRÉPARATION — PLACEZ VOS 27 UNITÉS'
                : '⏳ EN ATTENTE DU PLACEMENT ADVERSE…'}
            </span>
          ) : phase === 'finished' ? (
            <span className="bw-ribbon-text">🏁 AFFRONTEMENT TERMINÉ</span>
          ) : isViewerTurn ? (
            <span className="bw-ribbon-text">
              <span className="bw-pixel-dot bw-pixel-dot-active" aria-hidden="true" /> À VOTRE TOUR — INTERACTIONS ACTIVES
            </span>
          ) : (
            <span className="bw-ribbon-text">
              <span className="bw-pixel-dot bw-pixel-dot-wait" aria-hidden="true" />{' '}
              {opponentStatusLabel ?? '⏳ TOUR ADVERSE — L’ADVERSAIRE RÉFLÉCHIT…'}
            </span>
          )}
        </div>
        <div ref={phaserHostRef} className="bw-phaser-backdrop" aria-hidden="true" />
        <div
          className="bw-board-grid bw-pixel-board-grid"
          role="grid"
          aria-label="Plateau BLIND WAR 9x9"
          data-pixel-board="true"
        >
        {rows.map((row) =>
          Array.from({ length: BOARD_COLS }, (_, col) => {
            const coord: Coord = { row, col };
            const key = coordKey(coord);
            const squareColor = getBoardSquareColor(coord);
            const squareSlot = getBoardSquareSlot(coord);
            const pieceVariant = getPieceVisualVariantAtCoord(coord);
            const isSelected =
              selectedCoord !== null &&
              selectedCoord.row === row &&
              selectedCoord.col === col;
            const squareCandidates = movesBySquare.get(key) ?? [];
            const moveCandidate = moveBySquare.get(key);
            const hasMoveKind = (kind: MoveCandidate['kind']) =>
              squareCandidates.some((c) => c.kind === kind);
            const isCardTarget = cardTargetSet.has(key);
            const isTraqueurMarkTarget = traqueurMarkSet.has(key);
            const isRecon = showReconZones && reconSet.has(key);
            const hasOwnTrap = trapSet.has(key);
            const annoColor = annoMarkBySquare.get(key) ?? null;
            const isPendingArrowOrigin = pendingArrowKey === key;
            const inOwnPlacementZone =
              phase === 'placement' && isInPlacementZone(viewerColor, coord);

            const isLastFrom = phase !== 'placement' && lastFromKey === key;
            const isLastTo = phase !== 'placement' && lastToKey === key;
            const isLastPassed = phase !== 'placement' && lastPassedThroughKey === key;
            const isLastEliminated = phase !== 'placement' && lastEliminatedSet.has(key);
            const isLastBlocked = phase !== 'placement' && lastBlockedKey === key;
            const isLastIntermediate = phase !== 'placement' && lastIntermediateSet.has(key);

            const boardPiece = pieceBySquare.get(key);
            const stagedChar = stagedBySquare.get(key);
            const isSelectedForEspionage =
              boardPiece !== undefined && selectedEspionageIds.includes(boardPiece.id);

            const cellClasses = [
              'bw-board-cell',
              squareSlot === 'a' ? 'bw-cell-square-a' : 'bw-cell-square-b',
              squareColor === 'red' ? 'bw-cell-red' : 'bw-cell-black',
              isSelected ? 'bw-cell-selected' : '',
              inOwnPlacementZone ? 'bw-cell-placement-zone' : '',
              isLastFrom ? 'bw-cell-last-from' : '',
              isLastTo ? 'bw-cell-last-to' : '',
              isLastPassed ? 'bw-cell-last-passed' : '',
              isLastEliminated ? 'bw-cell-last-eliminated' : '',
              isLastBlocked ? 'bw-cell-last-blocked' : '',
              isLastIntermediate ? 'bw-cell-last-intermediate' : '',
              hasMoveKind('normal_move') ? 'bw-cell-move-valid' : '',
              hasMoveKind('capture_move') ? 'bw-cell-attack-valid' : '',
              hasMoveKind('cavalier_jump') ? 'bw-cell-jump-valid' : '',
              hasMoveKind('piercing_strike') ? 'bw-cell-piercing-valid' : '',
              hasMoveKind('crossbow_shot') ? 'bw-cell-crossbow-valid' : '',
              isTraqueurMarkTarget ? 'bw-cell-traqueur-mark-valid' : '',
              isCardTarget ? 'bw-cell-card-target' : '',
              isRecon ? 'bw-cell-recon' : '',
              isSelectedForEspionage ? 'bw-cell-espionage-pick' : '',
              isPendingArrowOrigin ? 'bw-cell-anno-pending' : '',
            ]
              .filter(Boolean)
              .join(' ');

            const notation = `${COL_LABELS[col]}${BOARD_ROWS - row}`;

            return (
              <button
                key={key}
                type="button"
                className={cellClasses}
                data-coord={key}
                data-notation={notation}
                onClick={() => onSquareClick(coord)}
                onMouseDown={(e) => {
                  if (e.button === 2) {
                    e.preventDefault();
                    setRightDragStart(coord);
                    setRightDragCurrent(coord);
                  }
                }}
                onMouseEnter={() => {
                  if (rightDragStart !== null) {
                    setRightDragCurrent(coord);
                  }
                }}
                onContextMenu={(e) => e.preventDefault()}
                title={`Case ${notation}`}
              >
                <span className="bw-pixel-tile-sprite" aria-hidden="true" />
                {annoColor && (
                  <span
                    className={`bw-anno-square-mark bw-anno-mark-${annoColor}`}
                    aria-hidden="true"
                  />
                )}
                {isPendingArrowOrigin && (
                  <span className="bw-anno-pending-tag" aria-hidden="true">
                    ORIGINE
                  </span>
                )}
                {showCoordinates && col === 0 && (
                  <span className="bw-coord-rank">{BOARD_ROWS - row}</span>
                )}
                {showCoordinates && row === BOARD_ROWS - 1 && (
                  <span className="bw-coord-file">{COL_LABELS[col]}</span>
                )}

                {hasOwnTrap && <span className="bw-trap-indicator" title="Votre Piège secret">🕸️</span>}

                {/* Last Move Indicators directly on squares */}
                {isLastFrom && !isLastTo && (
                  <span className="bw-lastmove-tag bw-lastmove-tag-from" aria-hidden="true">
                    DÉPART
                  </span>
                )}
                {isLastIntermediate && !isLastTo && (
                  <span className="bw-lastmove-tag bw-lastmove-tag-step" aria-hidden="true">
                    ÉTAPE
                  </span>
                )}
                {isLastPassed && !isLastTo && (
                  <span className="bw-lastmove-tag bw-lastmove-tag-step" aria-hidden="true">
                    TRAVERSÉE
                  </span>
                )}
                {isLastTo && (
                  <span className="bw-lastmove-tag bw-lastmove-tag-to" aria-hidden="true">
                    {lastMove?.kind === 'promotion' || lastMove?.promotedAtCoord
                      ? 'PROMU'
                      : lastMove?.kind === 'resurrection'
                        ? 'RÉSURR.'
                        : lastMove?.kind === 'recrutement'
                          ? 'RECRUE'
                          : lastMove?.kind === 'piercing_strike'
                            ? 'FRAPPE'
                            : lastMove?.kind === 'crossbow_shot'
                              ? 'TIR'
                              : lastMove?.kind === 'cavalier_leap'
                                ? 'BOND L'
                                : 'ARRIVÉE'}
                  </span>
                )}
                {isLastEliminated && (
                  <span
                    className="bw-lastmove-elim-badge"
                    title="Élimination lors du dernier coup"
                    aria-hidden="true"
                  >
                    ⚔️
                  </span>
                )}
                {isLastBlocked && (
                  <span
                    className="bw-lastmove-blocked-badge"
                    title="Attaque bloquée lors du dernier coup"
                    aria-hidden="true"
                  >
                    🛡️
                  </span>
                )}

                {/* Placement phase preview */}
                {phase === 'placement' && stagedChar && (
                  <div
                    className="bw-piece bw-piece-ally"
                    data-owner={viewerColor}
                    data-piece-variant={pieceVariant}
                    data-square-color={squareColor}
                  >
                    <span className="bw-piece-symbol">
                      <PieceArtwork
                        character={stagedChar}
                        owner={viewerColor}
                        coord={coord}
                        theme={themeState.boardTheme}
                        size="lg"
                      />
                    </span>
                    <span className="bw-piece-label">
                      {CHARACTER_DOSSIERS[stagedChar].name}
                    </span>
                  </div>
                )}

                {/* Playing / Finished phase piece */}
                {phase !== 'placement' && boardPiece && (
                  <div
                    className={[
                      'bw-piece',
                      boardPiece.owner === viewerColor ? 'bw-piece-ally' : 'bw-piece-enemy',
                      boardPiece.character === null ? 'bw-piece-hidden-identity' : 'bw-piece-known',
                      boardPiece.isInvincible ? 'bw-piece-invincible' : '',
                      boardPiece.isImmobilized ? 'bw-piece-immobilized' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    data-owner={boardPiece.owner}
                    data-piece-variant={pieceVariant}
                    data-square-color={squareColor}
                  >
                    <span className="bw-piece-symbol">
                      <PieceArtwork
                        character={boardPiece.character ?? 'secret'}
                        owner={boardPiece.owner}
                        coord={coord}
                        theme={themeState.boardTheme}
                        size="lg"
                      />
                    </span>
                    <span className="bw-piece-label">
                      {boardPiece.character !== null
                        ? CHARACTER_DOSSIERS[boardPiece.character].name
                        : 'Inconnu'}
                    </span>

                    {/* Status & Reconnaissance Badges */}
                    <div className="bw-piece-badges">
                      {boardPiece.owner !== viewerColor && (
                        <span className="bw-badge bw-badge-enemy" title="Pion adverse">
                          ADV
                        </span>
                      )}
                      {boardPiece.owner !== viewerColor &&
                        boardPiece.revealKind !== 'none' && (
                          <span className={`bw-badge bw-badge-reveal-${boardPiece.revealKind}`}>
                            {boardPiece.revealKind === 'permanent'
                              ? 'PERM'
                              : boardPiece.revealKind === 'proximity'
                                ? 'GUET'
                                : 'TEMP'}
                          </span>
                        )}
                      {boardPiece.isInvincible && (
                        <span className="bw-badge bw-badge-invincible" title="Invincible">
                          🛡️
                        </span>
                      )}
                      {boardPiece.isProtectedVisible && (
                        <span className="bw-badge bw-badge-protection" title="Protection active">
                          🔰
                        </span>
                      )}
                      {boardPiece.hasKamikazeVisible && (
                        <span className="bw-badge bw-badge-kamikaze" title="Kamikaze actif">
                          💥
                        </span>
                      )}
                      {boardPiece.hasCounterEspionageVisible && (
                        <span className="bw-badge bw-badge-ce" title="Contre-espionnage actif">
                          🕶️
                        </span>
                      )}
                      {boardPiece.isExposedByEnemyEspionage && (
                        <span
                          className="bw-badge bw-badge-espionage-alert"
                          title="Vu par Espionnage adverse !"
                        >
                          📡VU
                        </span>
                      )}
                      {boardPiece.isImmobilized && (
                        <span className="bw-badge bw-badge-immobilized" title="Immobilisé par un Piège">
                          ⛓️
                        </span>
                      )}
                      {boardPiece.kamikazeHitsTakenVisible !== null &&
                        boardPiece.kamikazeHitsTakenVisible > 0 && (
                          <span
                            className="bw-badge bw-badge-colossus-hits"
                            title={`Déclenchements Kamikaze subis par ce Colosse (${boardPiece.kamikazeHitsTakenVisible}/${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD})`}
                          >
                            💥{boardPiece.kamikazeHitsTakenVisible}/{COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}
                          </span>
                        )}
                      {boardPiece.traqueurMarkedByViewer && (
                        <span
                          className="bw-badge bw-badge-traqueur-marked"
                          title="Cible marquée par votre Traqueur (Poursuite jusqu’à 4 cases pour l’éliminer)"
                        >
                          CIBLE
                        </span>
                      )}
                      {boardPiece.owner === viewerColor &&
                        boardPiece.traqueurHasActiveMarkVisible && (
                          <span
                            className="bw-badge bw-badge-pursuit"
                            title={
                              boardPiece.traqueurPursuitReadyVisible
                                ? 'Poursuite active (portée jusqu’à 4 cases pour éliminer la cible marquée)'
                                : 'Cible marquée (Poursuite jusqu’à 4 cases)'
                            }
                          >
                            {boardPiece.traqueurPursuitReadyVisible ? 'POURSUITE' : 'MARQUÉ'}
                          </span>
                        )}
                      {boardPiece.owner === viewerColor &&
                        boardPiece.character === 'arbaletrier' &&
                        boardPiece.arbaletrierCooldownTurnsVisible !== undefined &&
                        boardPiece.arbaletrierCooldownTurnsVisible !== null && (
                          <span
                            className={`bw-badge ${
                              boardPiece.arbaletrierCooldownTurnsVisible === 0
                                ? 'bw-badge-shot-ready'
                                : 'bw-badge-shot-cooldown'
                            }`}
                            title={
                              boardPiece.arbaletrierCooldownTurnsVisible === 0
                                ? 'Tir d’arbalète prêt (1 tir / 3 tours personnels)'
                                : `Recharge du tir : encore ${boardPiece.arbaletrierCooldownTurnsVisible} tour(s) personnel(s)`
                            }
                          >
                            {boardPiece.arbaletrierCooldownTurnsVisible === 0
                              ? 'TIR PRÊT'
                              : `RECH ${boardPiece.arbaletrierCooldownTurnsVisible}T`}
                          </span>
                        )}
                    </div>
                  </div>
                )}

                {isSelected && (
                  <span className="bw-pixel-select-corners" aria-hidden="true" />
                )}

                {recentlyMarkedKey === key && (
                  <span className="bw-pixel-lock-burst" role="status">
                    🎯 VERROUILLÉ
                  </span>
                )}

                {isTraqueurMarkTarget && (
                  <>
                    <span className="bw-move-marker bw-move-marker-mark" aria-hidden="true" />
                    <span
                      className="bw-pixel-target-reticle"
                      title="Cliquez directement sur ce pion révélé pour le marquer avec votre Traqueur (0 action)"
                      aria-hidden="true"
                    >
                      🎯 VISER
                    </span>
                    {themeState.preferences.showPatternMarkers && (
                      <span className="bw-pattern-marker" aria-hidden="true">◎</span>
                    )}
                  </>
                )}
                {moveCandidate ? (
                  <>
                    <span
                      className={`bw-move-marker bw-move-marker-${
                        hasMoveKind('crossbow_shot') && hasMoveKind('capture_move')
                          ? 'dual_crossbow'
                          : moveCandidate.kind
                      }`}
                      aria-hidden="true"
                    />
                    {hasMoveKind('piercing_strike') && (
                      <span className="bw-pixel-ability-tag bw-pixel-pierce-tag" aria-hidden="true">
                        ⚡ FRAPPE
                      </span>
                    )}
                    {hasMoveKind('crossbow_shot') && (
                      <span className="bw-pixel-ability-tag bw-pixel-shot-tag" aria-hidden="true">
                        🏹 TIR
                      </span>
                    )}
                    {hasMoveKind('capture_move') && !isTraqueurMarkTarget && (
                      <span className="bw-pixel-danger-corner" aria-hidden="true" />
                    )}
                    {themeState.preferences.showPatternMarkers && (
                      <span className="bw-pattern-marker" aria-hidden="true">
                        {moveCandidate.kind === 'capture_move' ||
                        moveCandidate.kind === 'piercing_strike'
                          ? '⚔'
                          : moveCandidate.kind === 'crossbow_shot'
                            ? '🏹'
                            : moveCandidate.kind === 'cavalier_jump'
                              ? '✦'
                              : '•'}
                      </span>
                    )}
                  </>
                ) : isCardTarget && themeState.preferences.showPatternMarkers ? (
                  <span className="bw-pattern-marker" aria-hidden="true">★</span>
                ) : null}
              </button>
            );
          }),
        )}
      </div>

      {/* SVG Trajectory & Elimination Overlay for Last Move (§1.2 - §1.5) */}
      {phase !== 'placement' && lastMove && (
        <svg
          className="bw-last-move-svg"
          viewBox="0 0 900 900"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <marker
              id="bw-arrow-move"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="5.5"
              markerHeight="5.5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="rgba(56, 189, 248, 0.92)" />
            </marker>
            <marker
              id="bw-arrow-attack"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="5.5"
              markerHeight="5.5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="rgba(251, 191, 36, 0.95)" />
            </marker>
          </defs>

          {lastMove.steps.map((step, idx) => {
            const x1 = step.from.col * 100 + 50;
            const y1 = step.from.row * 100 + 50;
            const x2 = step.to.col * 100 + 50;
            const y2 = step.to.row * 100 + 50;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.hypot(dx, dy);
            const padStart = len > 40 ? 22 : 0;
            const padEnd = len > 40 ? 26 : 0;
            const sx = len > 0 ? x1 + (dx / len) * padStart : x1;
            const sy = len > 0 ? y1 + (dy / len) * padStart : y1;
            const ex = len > 0 ? x2 - (dx / len) * padEnd : x2;
            const ey = len > 0 ? y2 - (dy / len) * padEnd : y2;
            const isElimOrSpecial =
              lastMove.eliminatedCoords.length > 0 ||
              lastMove.kind === 'cavalier_jump' ||
              lastMove.kind === 'cavalier_leap' ||
              lastMove.kind === 'piercing_strike' ||
              lastMove.kind === 'crossbow_shot' ||
              lastMove.kind === 'teleportation';

            return (
              <g key={`step-${idx}`}>
                <line
                  x1={sx}
                  y1={sy}
                  x2={ex}
                  y2={ey}
                  stroke={isElimOrSpecial ? 'rgba(251, 191, 36, 0.35)' : 'rgba(56, 189, 248, 0.35)'}
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                <line
                  x1={sx}
                  y1={sy}
                  x2={ex}
                  y2={ey}
                  stroke={isElimOrSpecial ? 'rgba(251, 191, 36, 0.95)' : 'rgba(56, 189, 248, 0.92)'}
                  strokeWidth="5"
                  strokeDasharray={
                    lastMove.kind === 'teleportation' || lastMove.kind === 'cavalier_leap'
                      ? '10 6'
                      : undefined
                  }
                  strokeLinecap="round"
                  markerEnd={isElimOrSpecial ? 'url(#bw-arrow-attack)' : 'url(#bw-arrow-move)'}
                />
              </g>
            );
          })}

          {lastMove.eliminatedCoords.map((elim, idx) => {
            const cx = elim.col * 100 + 50;
            const cy = elim.row * 100 + 50;
            return (
              <circle
                key={`elim-ring-${idx}`}
                cx={cx}
                cy={cy}
                r="38"
                fill="none"
                stroke="rgba(239, 68, 68, 0.85)"
                strokeWidth="4"
                strokeDasharray="10 6"
              />
            );
          })}
        </svg>
      )}

      {/* Strictly Personal Tactical Annotations SVG Layer (Chess.com-style) */}
      {(annotationArrows.length > 0 ||
        (rightDragStart !== null &&
          rightDragCurrent !== null &&
          (rightDragStart.row !== rightDragCurrent.row ||
            rightDragStart.col !== rightDragCurrent.col))) && (
        <svg
          className="bw-annotations-svg"
          viewBox="0 0 900 900"
          preserveAspectRatio="none"
          aria-label="Annotations tactiques personnelles"
        >
          <defs>
            {(['red', 'green', 'blue', 'yellow'] as const).map((colKey) => (
              <marker
                key={`anno-marker-${colKey}`}
                id={`bw-anno-head-${colKey}`}
                viewBox="0 0 10 10"
                refX="6.5"
                refY="5"
                markerWidth="5.2"
                markerHeight="5.2"
                orient="auto-start-reverse"
              >
                <path
                  d="M 0 1.2 L 9 5 L 0 8.8 z"
                  fill={ANNOTATION_SVG_PALETTE[colKey].stroke}
                />
              </marker>
            ))}
          </defs>

          {annotationArrows.map((arrow) => {
            const palette = ANNOTATION_SVG_PALETTE[arrow.color];
            const x1 = arrow.from.col * 100 + 50;
            const y1 = arrow.from.row * 100 + 50;
            const x2 = arrow.to.col * 100 + 50;
            const y2 = arrow.to.row * 100 + 50;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.hypot(dx, dy);
            const padStart = len > 45 ? 18 : 0;
            const padEnd = len > 45 ? 24 : 0;
            const hitPad = len > 76 ? 33 : Math.max(0, len * 0.25);

            const sx = len > 0 ? x1 + (dx / len) * padStart : x1;
            const sy = len > 0 ? y1 + (dy / len) * padStart : y1;
            const ex = len > 0 ? x2 - (dx / len) * padEnd : x2;
            const ey = len > 0 ? y2 - (dy / len) * padEnd : y2;

            const hx1 = len > 0 ? x1 + (dx / len) * hitPad : x1;
            const hy1 = len > 0 ? y1 + (dy / len) * hitPad : y1;
            const hx2 = len > 0 ? x2 - (dx / len) * hitPad : x2;
            const hy2 = len > 0 ? y2 - (dy / len) * hitPad : y2;

            return (
              <g key={arrow.id} className="bw-anno-arrow-group">
                <line
                  x1={sx}
                  y1={sy}
                  x2={ex}
                  y2={ey}
                  stroke={palette.halo}
                  strokeWidth="15"
                  strokeLinecap="round"
                />
                <line
                  x1={sx}
                  y1={sy}
                  x2={ex}
                  y2={ey}
                  stroke={palette.stroke}
                  strokeWidth="7.5"
                  strokeLinecap="round"
                  markerEnd={`url(#bw-anno-head-${arrow.color})`}
                />
                <line
                  className="bw-anno-hit-line"
                  x1={hx1}
                  y1={hy1}
                  x2={hx2}
                  y2={hy2}
                  stroke="transparent"
                  strokeWidth="26"
                  strokeLinecap="round"
                  pointerEvents="stroke"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveArrow?.(arrow.id);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRemoveArrow?.(arrow.id);
                  }}
                >
                  <title>Cliquer sur cette flèche pour l’effacer</title>
                </line>
              </g>
            );
          })}

          {rightDragStart !== null &&
            rightDragCurrent !== null &&
            (rightDragStart.row !== rightDragCurrent.row ||
              rightDragStart.col !== rightDragCurrent.col) && (() => {
              const palette = ANNOTATION_SVG_PALETTE[activeAnnotationColor];
              const x1 = rightDragStart.col * 100 + 50;
              const y1 = rightDragStart.row * 100 + 50;
              const x2 = rightDragCurrent.col * 100 + 50;
              const y2 = rightDragCurrent.row * 100 + 50;
              const dx = x2 - x1;
              const dy = y2 - y1;
              const len = Math.hypot(dx, dy);
              const padStart = len > 45 ? 18 : 0;
              const padEnd = len > 45 ? 24 : 0;
              const sx = len > 0 ? x1 + (dx / len) * padStart : x1;
              const sy = len > 0 ? y1 + (dy / len) * padStart : y1;
              const ex = len > 0 ? x2 - (dx / len) * padEnd : x2;
              const ey = len > 0 ? y2 - (dy / len) * padEnd : y2;
              return (
                <line
                  x1={sx}
                  y1={sy}
                  x2={ex}
                  y2={ey}
                  stroke={palette.stroke}
                  strokeWidth="7"
                  strokeDasharray="14 10"
                  strokeLinecap="round"
                  opacity="0.82"
                  markerEnd={`url(#bw-anno-head-${activeAnnotationColor})`}
                />
              );
            })()}
        </svg>
      )}
      </div>
    </div>
  );
};
