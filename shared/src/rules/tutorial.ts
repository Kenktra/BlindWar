import type {
  CardType,
  CharacterType,
  Coord,
  PlayerColor,
  ServerPieceRecord,
} from '../types/core.js';
import { ARMY_COMPOSITION } from '../constants/army.js';
import { COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD } from '../constants/cards.js';
import {
  createMatchState,
  executePieceMove,
  type ServerMatchState,
} from './engine.js';
import { generateMoveCandidatesForPiece } from './movement-locked.js';
import { computeGuetteurReconZoneKeys } from './visibility.js';

export interface TutorialScenarioSpec {
  readonly id: string;
  readonly themeNumber: number;
  readonly themeTitle: string;
  readonly stepNumber: number;
  readonly title: string;
  readonly subtitle: string;
  readonly objectiveDescription: string;
  readonly coachingTips: readonly string[];
  readonly isNewUpdate?: boolean;
  readonly relatedCharacterIds?: readonly CharacterType[];
  readonly createInitialState: () => ServerMatchState;
  /** Optionnel : coup automatique de l'adversaire noir afin que l'entraînement ne reste jamais bloqué sur un tour adverse. */
  readonly stepOpponentTurn?: (state: ServerMatchState) => ServerMatchState | null;
  readonly checkCompleted: (state: ServerMatchState) => boolean;
}

function makeTutorialPiece(
  id: string,
  owner: PlayerColor,
  character: CharacterType,
  coord: Coord,
  overrides: Partial<ServerPieceRecord> = {},
): ServerPieceRecord {
  return {
    id,
    owner,
    character,
    promotedFrom: null,
    position: coord,
    alive: true,
    progressionDirection: owner === 'red' ? -1 : 1,
    reversalCount: 0,
    kamikazeHitsTaken: 0,
    hasKamikaze: false,
    invincibleTicksRemaining: 0,
    hasProtection: false,
    counterEspionageTicksRemaining: 0,
    espionageRevealedTicksTo: { red: 0, black: 0 },
    tempRevealedTicksTo: { red: 0, black: 0 },
    permanentlyRevealedTo: { red: false, black: false },
    immobilizedTicksRemaining: 0,
    traqueurMarkedTargetId: null,
    traqueurPursuitReady: false,
    arbaletrierCooldownTurnsRemaining: 0,
    ...overrides,
  };
}

function buildPlayingState(
  id: string,
  pieces: ServerPieceRecord[],
  redHand: readonly CardType[] = [],
): ServerMatchState {
  const base = createMatchState(`tutorial-${id}`, 'training');
  return {
    ...base,
    phase: 'playing',
    pieces,
    players: {
      ...base.players,
      red: {
        ...base.players.red,
        hand: redHand,
      },
    },
  };
}

/** Exécute un coup sûr pour Noir s'il devient actif pendant un scénario interactif. */
export function runDefaultTutorialOpponentStep(state: ServerMatchState): ServerMatchState | null {
  if (state.phase !== 'playing' || state.turn.activePlayer !== 'black') {
    return null;
  }
  const vis = {
    fogTurnsRemainingByOwner: {
      red: state.players.red.fogTicksRemaining,
      black: state.players.black.fogTicksRemaining,
    },
    viewerGuetteurReconKeys: computeGuetteurReconZoneKeys(state.pieces, 'black'),
  };
  const blackPieces = state.pieces.filter((p) => p.alive && p.owner === 'black' && p.position);
  // Prioriser un pion non-roi puis le roi sur un déplacement sans capture
  const sorted = [...blackPieces].sort((a, b) =>
    a.character === 'roi' ? 1 : b.character === 'roi' ? -1 : 0,
  );
  for (const p of sorted) {
    const moves = generateMoveCandidatesForPiece(p, state.pieces, vis, false);
    const safeMove = moves.find((m) => m.kind === 'normal_move') ?? moves[0];
    if (safeMove) {
      return executePieceMove(state, 'black', p.id, safeMove.to, Date.now(), undefined, safeMove.kind);
    }
  }
  return null;
}

export const TUTORIAL_SCENARIOS: readonly TutorialScenarioSpec[] = [
  // THÈME 1 : Soldat & Promotion
  {
    id: 'pions-et-promotion',
    themeNumber: 1,
    themeTitle: '1. Soldat : Attaque Diagonale & Promotion',
    stepNumber: 1,
    relatedCharacterIds: ['soldat'],
    title: 'Mécanique 1 : Attaque Diagonale du Soldat & Promotion',
    subtitle: 'Faites progresser votre Soldat jusqu’à la dernière rangée et choisissez sa promotion.',
    objectiveDescription:
      `Votre armée réunit 12 rôles distincts (dont 9 Soldats). Le Soldat avance d’1 case (tout droit ou diagonale avant) mais élimine uniquement en diagonale avant : capturez en (F9) puis choisissez votre nouveau rôle.`,
    coachingTips: [
      'Un Soldat ne peut jamais capturer tout droit devant lui ni reculer (hors carte Retreat).',
      `Reine, Colosse, Traqueur, Exécuteur et Arbalétrier sont plafonnés à 1 exemplaire en vie ; Guetteurs H (${ARMY_COMPOSITION.guetteur_h}), D (${ARMY_COMPOSITION.guetteur_d}), Assassin, Cavalier et Berserker peuvent dépasser leur dotation.`,
    ],
    createInitialState: () =>
      buildPlayingState('pions-et-promotion', [
        makeTutorialPiece('r-king', 'red', 'roi', { row: 8, col: 4 }),
        makeTutorialPiece('r-sol', 'red', 'soldat', { row: 1, col: 4 }),
        makeTutorialPiece('b-ahead', 'black', 'soldat', { row: 0, col: 4 }),
        makeTutorialPiece('b-diag', 'black', 'soldat', { row: 0, col: 5 }),
        makeTutorialPiece('b-king', 'black', 'roi', { row: 0, col: 8 }),
      ]),
    checkCompleted: (state) => {
      const promoted = state.pieces.find((p) => p.id === 'r-sol');
      return Boolean(promoted && promoted.character !== 'soldat');
    },
  },

  // THÈME 2 : Bond en « L » du Cavalier
  {
    id: 'cavalier-bond-et-percee',
    themeNumber: 2,
    themeTitle: '2. Cavalier : Bond en « L » par-dessus obstacles',
    stepNumber: 2,
    isNewUpdate: true,
    relatedCharacterIds: ['cavalier'],
    title: 'Mécanique 2 : Bond en « L » du Cavalier',
    subtitle: 'Franchissez vos lignes en « L » avec le Cavalier sans déclencher les obstacles ni pénalité.',
    objectiveDescription:
      'Votre Cavalier (C3) est bloqué par vos propres Soldats devant lui ! Sélectionnez-le pour effectuer un Bond en « L » (2 cases + 1 case) par-dessus vos pièces et éliminer l’ennemi en D5 (ou repositionnez-vous sur la ligne arrière adverse).',
    coachingTips: [
      'Cavalier : pas orthogonal d’1 case (H/V), Bond en « L » sautant toute pièce ou piège intermédiaire, et Saut Percée style dames par-dessus un ennemi adjacent.',
      'Aucune pénalité en cas de 0 élimination : vous pouvez manœuvrer librement.',
    ],
    createInitialState: () =>
      buildPlayingState('cavalier-bond-et-percee', [
        makeTutorialPiece('r-king', 'red', 'roi', { row: 8, col: 4 }),
        makeTutorialPiece('r-cav', 'red', 'cavalier', { row: 6, col: 2 }),
        makeTutorialPiece('r-wall1', 'red', 'soldat', { row: 5, col: 1 }),
        makeTutorialPiece('r-wall2', 'red', 'soldat', { row: 5, col: 2 }),
        makeTutorialPiece('r-wall3', 'red', 'soldat', { row: 5, col: 3 }),
        makeTutorialPiece('b-flank', 'black', 'soldat', { row: 4, col: 3 }),
        makeTutorialPiece('b-king', 'black', 'roi', { row: 0, col: 4 }),
      ]),
    checkCompleted: (state) => {
      const cav = state.pieces.find((p) => p.id === 'r-cav');
      const target = state.pieces.find((p) => p.id === 'b-flank');
      return Boolean(cav && target && !target.alive) || state.lastMove?.kind === 'cavalier_leap';
    },
  },

  // THÈME 3 : Rage du Berserker
  {
    id: 'eliminations-berserker-rage',
    themeNumber: 3,
    themeTitle: '3. Berserker : Repositionnement Rage',
    stepNumber: 3,
    relatedCharacterIds: ['berserker'],
    title: 'Mécanique 3 : Élimination & Rage du Berserker',
    subtitle: 'Capturez une pièce avec votre Berserker puis profitez de son 2e déplacement gratuit (Rage).',
    objectiveDescription:
      `Éliminez l’ennemi en E5 avec votre Berserker (${ARMY_COMPOSITION.berserker}/camp) puis utilisez immédiatement sa Rage pour vous repositionner de 1 à 2 cases H/V.`,
    coachingTips: [
      'Berserker : se déplace et élimine sur 1 à 2 cases horizontalement ou verticalement.',
      'Rage : après 1 élimination, offre immédiatement 1 déplacement gratuit (1–2 cases H/V) sans nouvelle capture possible.',
    ],
    createInitialState: () =>
      buildPlayingState('eliminations-berserker-rage', [
        makeTutorialPiece('r-king', 'red', 'roi', { row: 8, col: 4 }),
        makeTutorialPiece('r-ber', 'red', 'berserker', { row: 6, col: 4 }),
        makeTutorialPiece('b-victim', 'black', 'soldat', { row: 4, col: 4 }),
        makeTutorialPiece('b-king', 'black', 'roi', { row: 0, col: 4 }),
      ]),
    checkCompleted: (state) => {
      const v = state.pieces.find((p) => p.id === 'b-victim');
      return Boolean(v && !v.alive && state.turn.pendingBerserkerRagePieceId === null);
    },
  },

  // THÈME 4 : Saut Percée en chaîne & Tour Bonus (2+ éliminations)
  {
    id: 'gestion-tours-bonus',
    themeNumber: 4,
    themeTitle: '4. Saut Percée & Tour Bonus (2+ Éliminations)',
    stepNumber: 4,
    isNewUpdate: true,
    relatedCharacterIds: ['cavalier'],
    title: 'Mécanique 4 : Saut Percée en Chaîne & Tour Bonus',
    subtitle: 'Réalisez 2+ éliminations en un tour pour débloquer un Tour Bonus immédiat.',
    objectiveDescription:
      'Sélectionnez votre Cavalier en C3 : sautez par-dessus l’ennemi en C4 vers C5, puis enchaînez sur C6 vers C7 ! Dès votre 2e élimination réelle dans ce tour, vous obtenez immédiatement un Tour Bonus d’1 déplacement (sans carte).',
    coachingTips: [
      '0 ou 1 élimination réelle : l’adversaire joue normalement 1 action au tour suivant.',
      '2+ éliminations réelles dans le même tour (saut en chaîne, Double Action, combo) → Tour Bonus immédiat (1 déplacement, 0 carte).',
      'Une attaque bloquée (Protection, Invincibilité, Colosse) n’est jamais comptée comme une élimination.',
    ],
    createInitialState: () =>
      buildPlayingState('gestion-tours-bonus', [
        makeTutorialPiece('r-king', 'red', 'roi', { row: 8, col: 4 }),
        makeTutorialPiece('r-cav', 'red', 'cavalier', { row: 6, col: 2 }),
        makeTutorialPiece('b-1', 'black', 'soldat', { row: 5, col: 2 }),
        makeTutorialPiece('b-2', 'black', 'soldat', { row: 3, col: 2 }),
        makeTutorialPiece('b-king', 'black', 'roi', { row: 0, col: 4 }),
      ]),
    checkCompleted: (state) => state.turn.isBonusTurn,
  },

  // THÈME 5 : Cartes Stratégiques Secrètes
  {
    id: 'cartes-tactiques-effet',
    themeNumber: 5,
    themeTitle: '5. Cartes Stratégiques & Confidentialité',
    stepNumber: 5,
    relatedCharacterIds: ['reine', 'roi'],
    title: 'Mécanique 5 : Cartes Tactiques Secrètes & Double Action',
    subtitle: 'Activez une carte tactique de votre main puis déclenchez votre offensive royale.',
    objectiveDescription:
      'Vous piochez 1 carte aléatoire toutes les 3 éliminations (3 cartes max en main). Activez « Double action » (⏩) ou « Espionnage » (📡) puis éliminez le Roi adverse en E6.',
    coachingTips: [
      'L’adversaire est averti de la carte jouée, mais ignore sur quel pion secret s’applique son effet (Kamikaze, Protection, Invincibilité, Espionnage, Révélation, Piège).',
      'Impossible de jouer 2 cartes sous Double Action, ni aucune carte pendant un Tour Bonus.',
    ],
    createInitialState: () =>
      buildPlayingState(
        'cartes-tactiques-effet',
        [
          makeTutorialPiece('r-king', 'red', 'roi', { row: 8, col: 4 }),
          makeTutorialPiece('r-queen', 'red', 'reine', { row: 5, col: 4 }),
          makeTutorialPiece('b-king', 'black', 'roi', { row: 3, col: 4 }),
          makeTutorialPiece('b-guard', 'black', 'soldat', { row: 3, col: 3 }),
        ],
        ['espionnage', 'double_action', 'protection'],
      ),
    checkCompleted: (state) => state.phase === 'finished' && state.winner === 'red',
  },

  // THÈME 6 : Reconnaissance des Guetteurs H et D
  {
    id: 'recon-guetteurs',
    themeNumber: 6,
    themeTitle: '6. Reconnaissance des Guetteurs (H et D)',
    stepNumber: 6,
    relatedCharacterIds: ['guetteur_h', 'guetteur_d'],
    title: 'Mécanique 6 : Identités Cachées & Zones de Reconnaissance',
    subtitle: 'Approchez un Guetteur pour percer temporairement le brouillard d’identité adverse.',
    objectiveDescription:
      'Approchez votre Guetteur H (diagonale) en E4 ou déplacez horizontalement votre Guetteur D (G4 → F4) pour révéler l’identité de la pièce inconnue en E5.',
    coachingTips: [
      `Guetteur H (${ARMY_COMPOSITION.guetteur_h}/camp) : bouge en diagonale (1 case), détecte H/V à 1 case.`,
      `Guetteur D (${ARMY_COMPOSITION.guetteur_d}/camp) : bouge H/V (1 case), détecte en diagonale à 1 case.`,
      'Brouillard et Contre-espionnage bloquent la reconnaissance des Guetteurs.',
    ],
    createInitialState: () =>
      buildPlayingState('recon-guetteurs', [
        makeTutorialPiece('r-king', 'red', 'roi', { row: 8, col: 4 }),
        makeTutorialPiece('r-gh', 'red', 'guetteur_h', { row: 6, col: 3 }),
        makeTutorialPiece('r-gd', 'red', 'guetteur_d', { row: 5, col: 6 }),
        makeTutorialPiece('b-mystery', 'black', 'reine', { row: 4, col: 4 }),
        makeTutorialPiece('b-king', 'black', 'roi', { row: 0, col: 4 }),
      ]),
    checkCompleted: (state) => {
      const gh = state.pieces.find((p) => p.id === 'r-gh');
      const gd = state.pieces.find((p) => p.id === 'r-gd');
      return (
        Boolean(gh?.position && gh.position.row === 5 && gh.position.col === 4) ||
        Boolean(gd?.position && gd.position.row === 5 && gd.position.col === 5)
      );
    },
  },

  // THÈME 7 : Assassin & Cimetière Confidentiel
  {
    id: 'assassin-cimetiere',
    themeNumber: 7,
    themeTitle: '7. Assassin & Cimetière Confidentiel',
    stepNumber: 7,
    relatedCharacterIds: ['assassin'],
    title: 'Mécanique 7 : L’Assassin & Révélation au Cimetière',
    subtitle: 'Éliminez un ennemi inconnu avec l’Assassin pour révéler définitivement sa véritable nature.',
    objectiveDescription:
      'Normalement, éliminer une pièce inconnue affiche « Pièce éliminée ». Éliminez la pièce secrète en E5 avec votre Assassin en E4 pour dévoiler son identité au cimetière.',
    coachingTips: [
      'L’Assassin bouge et attaque d’1 case dans les 8 directions.',
      'Sa révélation au cimetière traverse même Contre-espionnage (sauf s’il périt d’un Kamikaze au même coup).',
    ],
    createInitialState: () =>
      buildPlayingState('assassin-cimetiere', [
        makeTutorialPiece('r-king', 'red', 'roi', { row: 8, col: 4 }),
        makeTutorialPiece('r-ass', 'red', 'assassin', { row: 5, col: 4 }),
        makeTutorialPiece('b-target', 'black', 'berserker', { row: 4, col: 4 }),
        makeTutorialPiece('b-king', 'black', 'roi', { row: 0, col: 4 }),
      ]),
    checkCompleted: (state) =>
      state.graveyard.some((g) => g.pieceId === 'b-target' && g.knownToOpponentAtDeath),
  },

  // THÈME 8 : Traqueur (Ciblage sur l'échiquier & Poursuite 4 cases) & Exécuteur (Frappe traversante)
  {
    id: 'traqueur-marquage-poursuite',
    themeNumber: 8,
    themeTitle: '8. Capacités Spéciales : Traqueur & Exécuteur',
    stepNumber: 8,
    isNewUpdate: true,
    relatedCharacterIds: ['traqueur'],
    title: 'Mécanique 8A : Le Traqueur (Portée 2 → Poursuite 4 Cases)',
    subtitle: 'Ciblez gratuitement un ennemi révélé sur l’échiquier pour étendre votre portée de 2 à 4 cases.',
    objectiveDescription:
      '1) Sélectionnez le Traqueur (E2) → cliquez « Cibler (0 PA) » (ou cliquez directement l’ennemi révélé en E6 sur l’échiquier). 2) Dès qu’il est ciblé, votre Poursuite s’étend jusqu’à 4 cases : bondissez de E2 à E6 pour l’éliminer !',
    coachingTips: [
      'Portée standard : 1 à 2 cases H/V (ligne dégagée, sans diagonale).',
      'Condition stricte : la cible doit DÉJÀ être révélée (Guetteur, Espionnage, Révélation) et alignée H/V à 1–4 cases sans obstacle.',
      'Activation sans coût (0 action) : cibler sur l’échiquier ne consomme pas votre tour et débloque immédiatement la Poursuite jusqu’à 4 cases vers cette cible.',
      'Fin d’effet : le marquage disparaît après un trajet de 3–4 cases, ou si la cible meurt / redevient cachée (Brouillard, Contre-espionnage, expiration).',
    ],
    createInitialState: () =>
      buildPlayingState('traqueur-marquage-poursuite', [
        makeTutorialPiece('r-king', 'red', 'roi', { row: 8, col: 4 }),
        makeTutorialPiece('r-traq', 'red', 'traqueur', { row: 7, col: 4 }),
        makeTutorialPiece('r-sol', 'red', 'soldat', { row: 6, col: 0 }),
        makeTutorialPiece('b-known', 'black', 'reine', { row: 3, col: 4 }, {
          permanentlyRevealedTo: { red: true, black: false },
        }),
        makeTutorialPiece('b-unknown', 'black', 'soldat', { row: 7, col: 6 }),
        makeTutorialPiece('b-king', 'black', 'roi', { row: 0, col: 4 }),
      ]),
    stepOpponentTurn: (state) => {
      const target = state.pieces.find((p) => p.id === 'b-known' && p.alive && p.position);
      if (target && target.position && target.position.row === 5 && target.position.col === 4) {
        const occUp = state.pieces.some(
          (p) => p.alive && p.position && p.position.row === 4 && p.position.col === 4,
        );
        if (!occUp) {
          return executePieceMove(state, 'black', 'b-known', { row: 4, col: 4 }, Date.now());
        }
      }
      return runDefaultTutorialOpponentStep(state);
    },
    checkCompleted: (state) => {
      const stats = state.players.red.newMechanicsStats;
      return Boolean(stats && stats.traqueurMarks >= 1 && stats.traqueurPursuitsSucceeded >= 1);
    },
  },
  {
    id: 'executeur-frappe-traversante',
    themeNumber: 8,
    themeTitle: '8. Capacités Spéciales : Traqueur & Exécuteur',
    stepNumber: 9,
    isNewUpdate: true,
    relatedCharacterIds: ['executeur'],
    title: 'Mécanique 8B : L’Exécuteur & la Frappe Traversante',
    subtitle: 'Abattez une cible protégée en 2e position (y compris le Colosse !) en épargnant l’ennemi devant elle.',
    objectiveDescription:
      'Votre Exécuteur (E4) fait face à un Soldat en E5 devant un Colosse en E6. Cliquez E4 puis frappez E6 : vous restez sur votre case, E5 reste intact et le Colosse en E6 est éliminé !',
    coachingTips: [
      'Alignement obligatoire H/V : [Exécuteur] → [Ennemi 1 ≠ Colosse] → [Ennemi 2].',
      'Seule attaque spéciale capable d’abattre un Colosse s’il est Ennemi 2 (mais s’il est en Ennemi 1, il bloque la frappe).',
    ],
    createInitialState: () =>
      buildPlayingState('executeur-frappe-traversante', [
        makeTutorialPiece('r-king', 'red', 'roi', { row: 8, col: 4 }),
        makeTutorialPiece('r-exec', 'red', 'executeur', { row: 5, col: 4 }),
        makeTutorialPiece('r-ally', 'red', 'soldat', { row: 5, col: 5 }),
        makeTutorialPiece('b-front', 'black', 'soldat', { row: 4, col: 4 }, {
          permanentlyRevealedTo: { red: true, black: false },
        }),
        makeTutorialPiece('b-colosse', 'black', 'colosse', { row: 3, col: 4 }, {
          permanentlyRevealedTo: { red: true, black: false },
        }),
        makeTutorialPiece('b-blocked-by-ally', 'black', 'soldat', { row: 5, col: 6 }),
        makeTutorialPiece('b-king', 'black', 'roi', { row: 0, col: 4 }),
      ]),
    checkCompleted: (state) => {
      const stats = state.players.red.newMechanicsStats;
      const bCol = state.pieces.find((p) => p.id === 'b-colosse');
      const bFront = state.pieces.find((p) => p.id === 'b-front');
      return Boolean(
        stats && stats.executeurPiercingStrikes >= 1 && bCol && !bCol.alive && bFront && bFront.alive,
      );
    },
  },

  // THÈME 9 : Arbalétrier (Tir à distance & Cadence 1 tir / 3 tours)
  {
    id: 'arbaletrier-tir-cadence',
    themeNumber: 9,
    themeTitle: '9. Arbalétrier : Tir à Distance & Cadence 1/3',
    stepNumber: 10,
    isNewUpdate: true,
    relatedCharacterIds: ['arbaletrier'],
    title: 'Mécanique 9 : Arbalétrier & Cadence (1 Tir / 3 Tours Personnels)',
    subtitle: 'Effectuez un tir à distance 1–3 cases, puis observez la recharge stricte pendant vos 2 tours suivants.',
    objectiveDescription:
      'Votre Arbalétrier (C3) est prêt : tirez sur la cible détectée en F6 (diagonale à 3 cases). Vous verrez la recharge démarrer (Tour 2 et Tour 3 indisponibles → Tour 4 prêt à nouveau), tandis que le déplacement d’1 case H/V reste possible.',
    coachingTips: [
      'Cadence stricte : Tour 1 Tir → Tour 2 attente (2T) → Tour 3 attente (1T) → Tour 4 Tir disponible.',
      'Double Action ne permet jamais de tirer 2 fois, Téléportation ne réinitialise pas le compteur, et un tir bloqué sur une cible cachée ne révèle jamais son identité.',
    ],
    createInitialState: () =>
      buildPlayingState(
        'arbaletrier-tir-cadence',
        [
          makeTutorialPiece('r-king', 'red', 'roi', { row: 8, col: 4 }),
          makeTutorialPiece('r-arb', 'red', 'arbaletrier', { row: 6, col: 2 }),
          makeTutorialPiece('r-gd', 'red', 'guetteur_d', { row: 4, col: 6 }),
          makeTutorialPiece('b-target', 'black', 'berserker', { row: 3, col: 5 }),
          makeTutorialPiece('b-obstacle', 'black', 'soldat', { row: 5, col: 2 }),
          makeTutorialPiece('b-unknown', 'black', 'soldat', { row: 6, col: 4 }),
          makeTutorialPiece('b-king', 'black', 'roi', { row: 0, col: 4 }),
        ],
        ['double_action'],
      ),
    checkCompleted: (state) => {
      const arb = state.pieces.find((p) => p.id === 'r-arb');
      return Boolean(
        (state.players.red.newMechanicsStats?.arbaletrierShotsSucceeded ?? 0) >= 1 &&
          arb &&
          (arb.arbaletrierCooldownTurnsRemaining ?? 0) >= 2,
      );
    },
  },

  // THÈME 10 : Colosse (Bascule + Kamikaze 2/2)
  {
    id: 'kamikaze-colosse-v2',
    themeNumber: 10,
    themeTitle: '10. Colosse : Bascule & Règle des 2 Kamikazes',
    stepNumber: 11,
    relatedCharacterIds: ['colosse'],
    title: 'Mécanique 10 : Le Colosse (Bascule & Règle des 2 Kamikazes)',
    subtitle: 'Vérifiez la survie du Colosse au 1er Kamikaze (1/2) et son élimination au 2e déclenchement (2/2).',
    objectiveDescription:
      'Activez Double Action (⏩), puis avec votre Colosse (E4) capturez le 1er ennemi Kamikaze en E5 (Colosse survit à 1/2), puis le 2e ennemi Kamikaze en E6 (Colosse éliminé à 2/2 !).',
    coachingTips: [
      'Le Colosse possède 5 directions sans jamais reculer et inverse son sens en touchant la dernière rangée (révélé 1 tour).',
      `Seuls Roi, Reine, Colosse, Frappe traversante (Exécuteur) ou ${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD} déclenchements Kamikaze provoqués par le Colosse peuvent l’abattre.`,
    ],
    createInitialState: () =>
      buildPlayingState(
        'kamikaze-colosse-v2',
        [
          makeTutorialPiece('r-king', 'red', 'roi', { row: 8, col: 4 }),
          makeTutorialPiece('r-col', 'red', 'colosse', { row: 5, col: 4 }, {
            progressionDirection: -1,
          }),
          makeTutorialPiece('r-other', 'red', 'soldat', { row: 5, col: 2 }),
          makeTutorialPiece('b-k1', 'black', 'soldat', { row: 4, col: 4 }, {
            hasKamikaze: true,
            permanentlyRevealedTo: { red: true, black: false },
          }),
          makeTutorialPiece('b-k2', 'black', 'soldat', { row: 3, col: 4 }, {
            hasKamikaze: true,
            permanentlyRevealedTo: { red: true, black: false },
          }),
          makeTutorialPiece('b-king', 'black', 'roi', { row: 0, col: 4 }),
        ],
        ['double_action'],
      ),
    checkCompleted: (state) => {
      const col = state.pieces.find((p) => p.id === 'r-col');
      return Boolean(col && !col.alive && col.kamikazeHitsTaken >= COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD);
    },
  },
];
