import type { CardType, CharacterType } from '../types/core.js';
import { ARMY_COMPOSITION, ARMY_TOTAL_PIECES, CHARACTER_CATALOG } from '../constants/army.js';
import { CARD_CATALOG, COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD } from '../constants/cards.js';

export type DiagramMoveKind =
  | 'move_and_attack'
  | 'move_only'
  | 'attack_only'
  | 'recon'
  | 'leap'
  | 'jump'
  | 'mark'
  | 'pursuit'
  | 'pierce'
  | 'shoot';

export interface CharacterDossier {
  readonly id: CharacterType;
  readonly name: string;
  readonly symbol: string;
  readonly roleSummary: string;
  readonly initialQuantity: number;
  readonly maxBoardCapLabel: string;
  readonly movementSummary: string;
  readonly attackSummary: string;
  readonly specialAbility: string;
  readonly interactionsSummary: readonly string[];
  readonly restrictions: readonly string[];
  /** Relative (dRow, dCol) diagram vectors for the interactive movement visualizer. */
  readonly diagramMoves: readonly { readonly dRow: number; readonly dCol: number; readonly kind: DiagramMoveKind }[];
}

export interface MechanicDossier {
  readonly id: string;
  readonly title: string;
  readonly badge: string;
  readonly relatedCharacter?: CharacterType;
  readonly category: 'Traqueur' | 'Exécuteur' | 'Arbalétrier' | 'Cavalier' | 'Colosse & Kamikaze' | 'Gestion des tours';
  readonly summary: string;
  readonly rules: readonly string[];
  readonly edgeCases: readonly string[];
}

export interface CardDossier {
  readonly id: CardType;
  readonly name: string;
  readonly badge: string;
  readonly durationLabel: string;
  readonly visibilityLabel: string;
  readonly effectDescription: string;
  readonly restrictions: readonly string[];
}

export interface RuleSection {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly bullets: readonly string[];
}

export const CHARACTER_DOSSIERS: Readonly<Record<CharacterType, CharacterDossier>> = {
  roi: {
    id: 'roi',
    name: CHARACTER_CATALOG.roi.name,
    symbol: 'R',
    roleSummary: CHARACTER_CATALOG.roi.roleSummary,
    initialQuantity: ARMY_COMPOSITION.roi,
    maxBoardCapLabel: '1 maximum absolu',
    movementSummary: '1 case dans les 8 directions (horizontale, verticale, diagonale).',
    attackSummary: 'Élimine toute pièce ennemie adjacente (y compris le Colosse).',
    specialAbility: 'Condition principale de victoire : son élimination met immédiatement fin à la partie.',
    interactionsSummary: [
      'Peut être éliminé directement par n’importe quelle attaque légale (y compris Frappe traversante et Tir d’arbalète).',
      'Peut être la pièce intermédiaire de la Frappe traversante de l’Exécuteur sans subir de dégâts si la cible arrière est choisie.',
    ],
    restrictions: [
      'Ne peut jamais être ressuscité.',
      'Ne peut pas recevoir Invincibilité, Protection ni Kamikaze.',
      'Limité strictement à 1 Roi par camp.',
    ],
    diagramMoves: [
      { dRow: -1, dCol: 0, kind: 'move_and_attack' },
      { dRow: 1, dCol: 0, kind: 'move_and_attack' },
      { dRow: 0, dCol: -1, kind: 'move_and_attack' },
      { dRow: 0, dCol: 1, kind: 'move_and_attack' },
      { dRow: -1, dCol: -1, kind: 'move_and_attack' },
      { dRow: -1, dCol: 1, kind: 'move_and_attack' },
      { dRow: 1, dCol: -1, kind: 'move_and_attack' },
      { dRow: 1, dCol: 1, kind: 'move_and_attack' },
    ],
  },
  reine: {
    id: 'reine',
    name: CHARACTER_CATALOG.reine.name,
    symbol: 'D',
    roleSummary: CHARACTER_CATALOG.reine.roleSummary,
    initialQuantity: ARMY_COMPOSITION.reine,
    maxBoardCapLabel: '1 maximum absolu',
    movementSummary: 'Jusqu’à 2 cases dans les 8 directions sans jamais traverser d’obstacle.',
    attackSummary: 'Élimine jusqu’à 1 pièce par déplacement (peut éliminer le Colosse).',
    specialAbility: 'Grande mobilité tactique et capacité à abattre le Colosse adverse.',
    interactionsSummary: [
      'Reste vulnérable au Tir d’arbalète, à la Frappe traversante, au Marquage/Poursuite du Traqueur et aux cartes défensives.',
    ],
    restrictions: [
      'Ne peut pas traverser une autre pièce.',
      'Ne peut pas être ressuscitée par la carte Résurrection.',
      'Limitée strictement à 1 Reine sur le plateau (promouvable uniquement si la Reine est éliminée).',
    ],
    diagramMoves: [
      { dRow: -1, dCol: 0, kind: 'move_and_attack' },
      { dRow: -2, dCol: 0, kind: 'move_and_attack' },
      { dRow: 1, dCol: 0, kind: 'move_and_attack' },
      { dRow: 2, dCol: 0, kind: 'move_and_attack' },
      { dRow: 0, dCol: -1, kind: 'move_and_attack' },
      { dRow: 0, dCol: -2, kind: 'move_and_attack' },
      { dRow: 0, dCol: 1, kind: 'move_and_attack' },
      { dRow: 0, dCol: 2, kind: 'move_and_attack' },
      { dRow: -1, dCol: -1, kind: 'move_and_attack' },
      { dRow: -2, dCol: -2, kind: 'move_and_attack' },
      { dRow: -1, dCol: 1, kind: 'move_and_attack' },
      { dRow: -2, dCol: 2, kind: 'move_and_attack' },
      { dRow: 1, dCol: -1, kind: 'move_and_attack' },
      { dRow: 2, dCol: -2, kind: 'move_and_attack' },
      { dRow: 1, dCol: 1, kind: 'move_and_attack' },
      { dRow: 2, dCol: 2, kind: 'move_and_attack' },
    ],
  },
  colosse: {
    id: 'colosse',
    name: CHARACTER_CATALOG.colosse.name,
    symbol: 'CO',
    roleSummary: CHARACTER_CATALOG.colosse.roleSummary,
    initialQuantity: ARMY_COMPOSITION.colosse,
    maxBoardCapLabel: '1 maximum absolu',
    movementSummary:
      'Exactement 5 directions selon son sens de progression (avant, diagonales avant gauche/droite, gauche, droite). Ne recule jamais.',
    attackSummary: 'Élimine dans ses 5 directions de progression (y compris le Colosse adverse).',
    specialAbility:
      `Immunité contre les attaques normales et le Tir d’arbalète. Peut être éliminé uniquement par le Roi, la Reine, un autre Colosse, la Frappe traversante de l’Exécuteur ou ${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD} déclenchements de Kamikaze provoqués par le Colosse lui-même. Inverse son sens à chaque extrémité en se révélant 1 tour.`,
    interactionsSummary: [
      'Frappe traversante (Exécuteur) : peut être éliminé s’il est visé derrière une autre pièce, mais ne peut jamais servir de pièce intermédiaire.',
      'Tir d’arbalète (Arbalétrier) : totalement immunisé (même sous Double Action) ; un tir contre un Colosse caché ne révèle pas son identité.',
      `Kamikaze : survit au 1er déclenchement qu’il provoque (${1}/${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}) et est éliminé au ${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}e (${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}/${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}).`,
      'Traqueur : la Poursuite ne permet jamais d’éliminer directement le Colosse.',
    ],
    restrictions: [
      'Ne peut jamais reculer par rapport à son sens de progression actif.',
      'Ne peut pas recevoir Kamikaze, Invincibilité, Protection ni Résurrection.',
      'Une attaque de mêlée ou saut de Cavalier contre un Colosse caché échoue et révèle temporairement le Colosse (le tir à distance de l’Arbalétrier bloqué ne le révèle pas).',
    ],
    diagramMoves: [
      { dRow: -1, dCol: 0, kind: 'move_and_attack' },
      { dRow: -1, dCol: -1, kind: 'move_and_attack' },
      { dRow: -1, dCol: 1, kind: 'move_and_attack' },
      { dRow: 0, dCol: -1, kind: 'move_and_attack' },
      { dRow: 0, dCol: 1, kind: 'move_and_attack' },
    ],
  },
  cavalier: {
    id: 'cavalier',
    name: CHARACTER_CATALOG.cavalier.name,
    symbol: 'CA',
    roleSummary: CHARACTER_CATALOG.cavalier.roleSummary,
    initialQuantity: ARMY_COMPOSITION.cavalier,
    maxBoardCapLabel: `Peut dépasser ${ARMY_COMPOSITION.cavalier} via promotion`,
    movementSummary:
      'Double mobilité tactique : pas de mêlée d’1 case orthogonale (H/V) OU Bond équestre en « L » (2 cases dans un axe + 1 case perpendiculaire) sautant par-dessus toutes les pièces et pièges intermédiaires.',
    attackSummary:
      'Élimine à l’arrivée d’un pas orthogonal (1 case H/V), d’un Bond en « L », OU via son Saut Percée (saut style dames par-dessus un ennemi adjacent vers une case libre derrière, avec enchaînement facultatif).',
    specialAbility:
      'Infiltration & Percée en chaîne : franchit la ligne de front grâce au Bond en « L » sans être arrêté par les obstacles ni déclencher les pièges traversés (seule la case d’arrivée compte). Enchaîner 2+ éliminations déclenche le Tour Bonus global.',
    interactionsSummary: [
      'Colosse : le Cavalier peut passer PAR-DESSUS un Colosse durant son Bond en « L », mais ne peut ni l’éliminer à l’arrivée ni le sauter avec la Percée style dames (interrompu et révélé s’il était caché).',
      'Cartes & Gestion des tours : 0 ou 1 élimination accorde normalement 1 action à l’adversaire (aucune pénalité). Compatible Téléportation (1–2 cases dégagées), Double Action et Retreat.',
      'Faiblesse tactique : ne se déplace plus directement en diagonale d’1 case (vulnérable aux Guetteurs H et Assassins au contact diagonal).',
    ],
    restrictions: [
      'Impossible de se déplacer directement d’1 case en diagonale.',
      'Impossible de s’arrêter sur une case occupée par une pièce alliée ou d’éliminer directement le Colosse.',
      'Un Piège posé sur la case d’arrivée s’active normalement ; les cases survolées durant le Bond en « L » ne déclenchent aucun piège.',
    ],
    diagramMoves: [
      { dRow: -1, dCol: 0, kind: 'move_and_attack' },
      { dRow: 1, dCol: 0, kind: 'move_and_attack' },
      { dRow: 0, dCol: -1, kind: 'move_and_attack' },
      { dRow: 0, dCol: 1, kind: 'move_and_attack' },
      { dRow: -2, dCol: -1, kind: 'leap' },
      { dRow: -2, dCol: 1, kind: 'leap' },
      { dRow: -1, dCol: -2, kind: 'leap' },
      { dRow: -1, dCol: 2, kind: 'leap' },
      { dRow: 1, dCol: -2, kind: 'leap' },
      { dRow: 1, dCol: 2, kind: 'leap' },
      { dRow: 2, dCol: -1, kind: 'leap' },
      { dRow: 2, dCol: 1, kind: 'leap' },
      { dRow: -2, dCol: 0, kind: 'jump' },
      { dRow: 2, dCol: 0, kind: 'jump' },
      { dRow: 0, dCol: -2, kind: 'jump' },
      { dRow: 0, dCol: 2, kind: 'jump' },
      { dRow: -2, dCol: -2, kind: 'jump' },
      { dRow: -2, dCol: 2, kind: 'jump' },
    ],
  },
  berserker: {
    id: 'berserker',
    name: CHARACTER_CATALOG.berserker.name,
    symbol: 'BK',
    roleSummary: CHARACTER_CATALOG.berserker.roleSummary,
    initialQuantity: ARMY_COMPOSITION.berserker,
    maxBoardCapLabel: `1 au départ (peut dépasser ${ARMY_COMPOSITION.berserker} via promotion)`,
    movementSummary: 'Jusqu’à 2 cases horizontalement ou verticalement, sans traverser de pièce.',
    attackSummary: 'Élimine horizontalement ou verticalement jusqu’à 2 cases.',
    specialAbility:
      'Rage : après avoir éliminé une pièce ennemie, obtient immédiatement un 2e déplacement facultatif (jusqu’à 2 cases H/V) qui ne peut pas éliminer une autre pièce (max 1 fois par tour).',
    interactionsSummary: [
      'Son exemplarité de départ passe à 1 par joueur dans la composition officielle de 27 pièces.',
    ],
    restrictions: [
      'Ne se déplace jamais en diagonale.',
      'Ne possède aucune capacité de reconnaissance.',
      'Son déplacement de Rage ne permet pas de capturer une seconde pièce.',
    ],
    diagramMoves: [
      { dRow: -1, dCol: 0, kind: 'move_and_attack' },
      { dRow: -2, dCol: 0, kind: 'move_and_attack' },
      { dRow: 1, dCol: 0, kind: 'move_and_attack' },
      { dRow: 2, dCol: 0, kind: 'move_and_attack' },
      { dRow: 0, dCol: -1, kind: 'move_and_attack' },
      { dRow: 0, dCol: -2, kind: 'move_and_attack' },
      { dRow: 0, dCol: 1, kind: 'move_and_attack' },
      { dRow: 0, dCol: 2, kind: 'move_and_attack' },
    ],
  },
  assassin: {
    id: 'assassin',
    name: CHARACTER_CATALOG.assassin.name,
    symbol: 'AS',
    roleSummary: CHARACTER_CATALOG.assassin.roleSummary,
    initialQuantity: ARMY_COMPOSITION.assassin,
    maxBoardCapLabel: `Peut dépasser ${ARMY_COMPOSITION.assassin} via promotion`,
    movementSummary: '1 case dans les 8 directions.',
    attackSummary: 'Élimine toute pièce ennemie adjacente (hors Colosse et Invincible).',
    specialAbility:
      'Révèle définitivement l’identité de chaque pièce ennemie qu’il élimine (visible aussi dans le cimetière).',
    interactionsSummary: [
      'Traverse Contre-espionnage et Brouillard au moment de l’élimination (sauf décès simultané par Kamikaze).',
    ],
    restrictions: [
      'Ne révèle pas les pièces autour de lui sans les éliminer.',
      'Si l’Assassin est tué par un effet Kamikaze lors de son attaque, sa capacité de révélation permanente ne se déclenche pas.',
    ],
    diagramMoves: [
      { dRow: -1, dCol: 0, kind: 'move_and_attack' },
      { dRow: 1, dCol: 0, kind: 'move_and_attack' },
      { dRow: 0, dCol: -1, kind: 'move_and_attack' },
      { dRow: 0, dCol: 1, kind: 'move_and_attack' },
      { dRow: -1, dCol: -1, kind: 'move_and_attack' },
      { dRow: -1, dCol: 1, kind: 'move_and_attack' },
      { dRow: 1, dCol: -1, kind: 'move_and_attack' },
      { dRow: 1, dCol: 1, kind: 'move_and_attack' },
    ],
  },
  guetteur_h: {
    id: 'guetteur_h',
    name: CHARACTER_CATALOG.guetteur_h.name,
    symbol: 'GH',
    roleSummary: CHARACTER_CATALOG.guetteur_h.roleSummary,
    initialQuantity: ARMY_COMPOSITION.guetteur_h,
    maxBoardCapLabel: `${ARMY_COMPOSITION.guetteur_h} au départ (peut dépasser ${ARMY_COMPOSITION.guetteur_h} via promotion)`,
    movementSummary: '1 case en diagonale (dans les 4 directions diagonales).',
    attackSummary: 'Élimine à 1 case en diagonale.',
    specialAbility:
      'Reconnaissance H/V : révèle temporairement l’identité des pièces ennemies situées à 1 case horizontalement ou verticalement tant qu’elles restent dans sa zone et qu’il est en vie.',
    interactionsSummary: [
      'Traqueur : les cibles détectées par ce Guetteur peuvent être marquées si le Traqueur est aligné.',
      'Arbalétrier : révèle la cible sur sa ligne de tir sans modifier la portée ni la récupération.',
    ],
    restrictions: [
      'Sa reconnaissance s’arrête si la pièce quitte la zone, si le Guetteur est éliminé, ou si Brouillard / Contre-espionnage est actif.',
      'Ne transforme jamais une révélation de proximité en révélation permanente.',
    ],
    diagramMoves: [
      { dRow: -1, dCol: -1, kind: 'move_and_attack' },
      { dRow: -1, dCol: 1, kind: 'move_and_attack' },
      { dRow: 1, dCol: -1, kind: 'move_and_attack' },
      { dRow: 1, dCol: 1, kind: 'move_and_attack' },
      { dRow: -1, dCol: 0, kind: 'recon' },
      { dRow: 1, dCol: 0, kind: 'recon' },
      { dRow: 0, dCol: -1, kind: 'recon' },
      { dRow: 0, dCol: 1, kind: 'recon' },
    ],
  },
  guetteur_d: {
    id: 'guetteur_d',
    name: CHARACTER_CATALOG.guetteur_d.name,
    symbol: 'GD',
    roleSummary: CHARACTER_CATALOG.guetteur_d.roleSummary,
    initialQuantity: ARMY_COMPOSITION.guetteur_d,
    maxBoardCapLabel: `${ARMY_COMPOSITION.guetteur_d} au départ (peut dépasser ${ARMY_COMPOSITION.guetteur_d} via promotion)`,
    movementSummary:
      '1 case horizontalement ou verticalement (dans les 4 directions orthogonales : avant, arrière, gauche, droite).',
    attackSummary: 'Élimine à 1 case horizontalement ou verticalement.',
    specialAbility:
      'Reconnaissance Diagonale : révèle temporairement l’identité des pièces ennemies situées à 1 case en diagonale tant qu’elles restent dans sa zone et qu’il est en vie.',
    interactionsSummary: [
      'Traqueur & Arbalétrier : facilite la détection des pièces cachées sur les colonnes et diagonales.',
    ],
    restrictions: [
      'Ne se déplace jamais en diagonale.',
      'Sa reconnaissance est bloquée par Brouillard et Contre-espionnage.',
    ],
    diagramMoves: [
      { dRow: -1, dCol: 0, kind: 'move_and_attack' },
      { dRow: 1, dCol: 0, kind: 'move_and_attack' },
      { dRow: 0, dCol: -1, kind: 'move_and_attack' },
      { dRow: 0, dCol: 1, kind: 'move_and_attack' },
      { dRow: -1, dCol: -1, kind: 'recon' },
      { dRow: -1, dCol: 1, kind: 'recon' },
      { dRow: 1, dCol: -1, kind: 'recon' },
      { dRow: 1, dCol: 1, kind: 'recon' },
    ],
  },
  traqueur: {
    id: 'traqueur',
    name: CHARACTER_CATALOG.traqueur.name,
    symbol: 'TQ',
    roleSummary: CHARACTER_CATALOG.traqueur.roleSummary,
    initialQuantity: ARMY_COMPOSITION.traqueur,
    maxBoardCapLabel: '1 maximum absolu (même via promotion/résurrection)',
    movementSummary:
      'Déplacement standard de 1 à 2 cases horizontalement ou verticalement (ligne dégagée, sans diagonale ni saut). Lorsque la Poursuite est prête (à partir de votre tour suivant le marquage d’un ennemi révélé), sa portée passe à 3 cases H/V uniquement dans la direction qui s’en rapproche.',
    attackSummary:
      'Élimine jusqu’à 1 ennemi à portée sur sa case d’arrivée (hors Colosse). À distance 3 (Poursuite), ne peut capturer QUE la cible marquée (impossible d’éliminer un pion caché ou une autre cible à 3 cases).',
    specialAbility:
      'Marquage (0 action) & Poursuite (+1 case = portée 3) : 1) Objectif : récompenser la détection d’une cible en étendant la portée de 2 à 3 cases. 2) Condition : ennemi DÉJÀ révélé (Guetteur, carte, Colosse révélé), aligné H/V à 1–2 cases sans obstacle. 3) Activation gratuite (0 action) sur le Traqueur sélectionné avant de jouer votre coup. 4) Durée : tant que la cible reste en vie et identifiable. 5) Effet : dès votre tour suivant, un trajet orthogonal vers elle monte à 3 cases ; l’utilisation d’un trajet de 3 cases consomme le marquage (un trajet de 1–2 cases le conserve). Exemple concret : Tour N, votre Guetteur révèle un ennemi à 2 cases du Traqueur → marquez-le (gratuit), puis bougez normalement. Tour N+1, l’ennemi recule à 3 cases → votre Traqueur fond sur lui en 3 cases !',
    interactionsSummary: [
      'Visibilité & Fin d’effet : personne ne peut marquer une pièce inconnue (« ? ») ; le marquage est secret pour l’adversaire et disparaît aussitôt si la cible meurt ou redevient cachée (Brouillard, Contre-espionnage, sortie de zone d’un Guetteur ou expiration de Révélation temporaire).',
      'Autres pions : peut marquer un Colosse révélé pour approcher plus vite à 3 cases, mais ne peut JAMAIS l’éliminer directement ; respecte Protection, Invincibilité et Kamikaze ; un seul Traqueur par camp.',
      'Cartes : fonctionne avec Révélation temporaire/permanente et Espionnage pour marquer ; Téléportation ne consomme pas la Poursuite ; une seule cible marquée active à la fois (re-marquer remplace l’ancienne et réarme pour le tour suivant).',
    ],
    restrictions: [
      'Portée standard strictement limitée à 1–2 cases H/V ; impossible de marquer une pièce ennemie cachée (« ? ») ni à travers une autre pièce.',
      'La Poursuite à 3 cases n’est jamais disponible au tour même du marquage (elle s’arme dès votre tour personnel suivant) et ne se déclenche que pour un trajet qui réduit la distance avec la cible.',
      'À distance 3, impossible d’éliminer une autre pièce que la cible marquée.',
    ],
    diagramMoves: [
      { dRow: -1, dCol: 0, kind: 'move_and_attack' },
      { dRow: -2, dCol: 0, kind: 'move_and_attack' },
      { dRow: -3, dCol: 0, kind: 'pursuit' },
      { dRow: 1, dCol: 0, kind: 'move_and_attack' },
      { dRow: 2, dCol: 0, kind: 'move_and_attack' },
      { dRow: 3, dCol: 0, kind: 'pursuit' },
      { dRow: 0, dCol: -1, kind: 'move_and_attack' },
      { dRow: 0, dCol: -2, kind: 'move_and_attack' },
      { dRow: 0, dCol: -3, kind: 'pursuit' },
      { dRow: 0, dCol: 1, kind: 'move_and_attack' },
      { dRow: 0, dCol: 2, kind: 'move_and_attack' },
      { dRow: 0, dCol: 3, kind: 'pursuit' },
    ],
  },
  executeur: {
    id: 'executeur',
    name: CHARACTER_CATALOG.executeur.name,
    symbol: 'EX',
    roleSummary: CHARACTER_CATALOG.executeur.roleSummary,
    initialQuantity: ARMY_COMPOSITION.executeur,
    maxBoardCapLabel: '1 maximum absolu (même via promotion/résurrection)',
    movementSummary:
      '1 ou 2 cases horizontalement ou verticalement, sans diagonale ni changement de direction ni traversée de pièce alliée.',
    attackSummary:
      'Attaque directe à 1–2 cases (ligne dégagée) OU Frappe traversante à 2 cases derrière exactement 1 pièce ennemie non-Colosse.',
    specialAbility:
      'Frappe traversante : si [Exécuteur, Ennemi 1, Ennemi 2] sont alignés orthogonalement et qu’Ennemi 1 n’est pas un Colosse, l’Exécuteur peut rester sur sa case pour éliminer Ennemi 2 en laissant Ennemi 1 intact. Seule capacité (hors Roi/Reine/Colosse/Kamikaze) capable d’éliminer un Colosse !',
    interactionsSummary: [
      'Colosse : immunisé aux attaques normales de l’Exécuteur (1–2 cases directes), mais ÉLIMINABLE s’il est pris comme cible arrière de la Frappe traversante. Un Colosse intermédiaire bloque et interrompt la frappe (et est révélé temporairement s’il était caché).',
      'Roi : peut être la pièce intermédiaire (intacte si vous frappez derrière) ou la cible arrière (victoire immédiate).',
      'Protection / Invincibilité / Kamikaze : bloquent normalement la Frappe traversante ; Kamikaze sur la cible élimine aussi l’Exécuteur (sauf Protection).',
      'Double Action / Téléportation : ne déclenchent aucune frappe automatique.',
    ],
    restrictions: [
      'Aucun déplacement diagonal ; une seule pièce éliminée maximum.',
      'Impossible de frapper à travers une pièce alliée, à travers 2 pièces ou à travers un Colosse.',
      'Ne peut jamais avoir 2 Exécuteurs simultanément en jeu.',
    ],
    diagramMoves: [
      { dRow: -1, dCol: 0, kind: 'move_and_attack' },
      { dRow: -2, dCol: 0, kind: 'pierce' },
      { dRow: 1, dCol: 0, kind: 'move_and_attack' },
      { dRow: 2, dCol: 0, kind: 'pierce' },
      { dRow: 0, dCol: -1, kind: 'move_and_attack' },
      { dRow: 0, dCol: -2, kind: 'pierce' },
      { dRow: 0, dCol: 1, kind: 'move_and_attack' },
      { dRow: 0, dCol: 2, kind: 'pierce' },
    ],
  },
  arbaletrier: {
    id: 'arbaletrier',
    name: CHARACTER_CATALOG.arbaletrier.name,
    symbol: 'AR',
    roleSummary: CHARACTER_CATALOG.arbaletrier.roleSummary,
    initialQuantity: ARMY_COMPOSITION.arbaletrier,
    maxBoardCapLabel: '1 maximum absolu (même via promotion/résurrection)',
    movementSummary:
      'Déplacement normal uniquement d’1 case horizontalement ou verticalement (jamais en diagonale ; ne tire pas dans la même action ; autorisé pendant la recharge).',
    attackSummary:
      'Tir d’arbalète à distance de 1 à 3 cases dans les 8 directions, en ligne dégagée, sans déplacer l’Arbalétrier.',
    specialAbility:
      'Tir à distance & Cadence stricte (1 tir / 3 tours personnels) : après un tir (Tour 1), l’Arbalétrier est indisponible au Tour 2 et au Tour 3 de son propriétaire, puis redevient disponible au Tour 4. Les tours adverses ne font jamais avancer cette recharge. Peut viser une pièce inconnue sans la révéler si le tir est bloqué !',
    interactionsSummary: [
      'Colosse : le Tir d’arbalète ne peut JAMAIS éliminer le Colosse (même sous Double Action) ; si le Colosse était caché, son identité reste secrète après un tir bloqué.',
      'Protection / Invincibilité : la Protection absorbe le tir et se brise ; l’Invincibilité bloque le tir ; tout tir effectué déclenche le délai de recharge de 3 tours personnels.',
      'Kamikaze : si une cible possédant Kamikaze est éliminée par un tir, l’explosion emporte l’Arbalétrier à distance (sauf s’il porte Protection).',
      'Guetteurs : peuvent révéler la cible sur la ligne de tir sans modifier ni la portée (3 cases) ni la cadence de 3 tours.',
      'Téléportation / Double Action / Block : Téléportation ne réinitialise jamais le temps de recharge, Double Action n’autorise jamais 2 tirs dans le même tour, et les tours adverses ne réduisent pas la recharge.',
    ],
    restrictions: [
      'Ne se déplace jamais en diagonale (seul le tir vise en diagonale).',
      'Ne peut pas tirer à travers une pièce alliée ou ennemie.',
      'Impossible de tirer et de bouger dans la même action ; se déplacer reste possible pendant la récupération.',
      'Ne peut jamais avoir 2 Arbalétriers simultanément en jeu.',
    ],
    diagramMoves: [
      { dRow: -1, dCol: 0, kind: 'move_and_attack' },
      { dRow: 1, dCol: 0, kind: 'move_and_attack' },
      { dRow: 0, dCol: -1, kind: 'move_and_attack' },
      { dRow: 0, dCol: 1, kind: 'move_and_attack' },
      { dRow: -2, dCol: 0, kind: 'shoot' },
      { dRow: -3, dCol: 0, kind: 'shoot' },
      { dRow: 2, dCol: 0, kind: 'shoot' },
      { dRow: 3, dCol: 0, kind: 'shoot' },
      { dRow: 0, dCol: -2, kind: 'shoot' },
      { dRow: 0, dCol: -3, kind: 'shoot' },
      { dRow: 0, dCol: 2, kind: 'shoot' },
      { dRow: 0, dCol: 3, kind: 'shoot' },
      { dRow: -1, dCol: -1, kind: 'shoot' },
      { dRow: -2, dCol: -2, kind: 'shoot' },
      { dRow: -3, dCol: -3, kind: 'shoot' },
      { dRow: -1, dCol: 1, kind: 'shoot' },
      { dRow: -2, dCol: 2, kind: 'shoot' },
      { dRow: -3, dCol: 3, kind: 'shoot' },
      { dRow: 1, dCol: -1, kind: 'shoot' },
      { dRow: 2, dCol: -2, kind: 'shoot' },
      { dRow: 3, dCol: -3, kind: 'shoot' },
      { dRow: 1, dCol: 1, kind: 'shoot' },
      { dRow: 2, dCol: 2, kind: 'shoot' },
      { dRow: 3, dCol: 3, kind: 'shoot' },
    ],
  },
  soldat: {
    id: 'soldat',
    name: CHARACTER_CATALOG.soldat.name,
    symbol: 'SO',
    roleSummary: CHARACTER_CATALOG.soldat.roleSummary,
    initialQuantity: ARMY_COMPOSITION.soldat,
    maxBoardCapLabel: `${ARMY_COMPOSITION.soldat} au départ (recrutable)`,
    movementSummary:
      'Avance d’1 case vers le camp adverse : tout droit (case libre uniquement) ou en diagonale avant gauche/droite.',
    attackSummary: 'Élimine uniquement en diagonale avant (ne peut jamais éliminer tout droit).',
    specialAbility:
      'Promotion : en atteignant la dernière rangée adverse, est promu au choix (Guetteur H/D, Assassin, Cavalier, Berserker, ou Reine / Colosse / Traqueur / Exécuteur / Arbalétrier si votre exemplaire unique est déjà éliminé).',
    interactionsSummary: [
      'Respecte le plafond strict de 1 exemplaire en jeu pour Reine, Colosse, Traqueur, Exécuteur et Arbalétrier.',
      `Un plateau complet démarre toujours à ${ARMY_TOTAL_PIECES} pièces par camp.`,
    ],
    restrictions: [
      'Ne peut jamais reculer (sauf carte Retreat).',
      'Ne peut jamais être promu en Roi.',
    ],
    diagramMoves: [
      { dRow: -1, dCol: 0, kind: 'move_only' },
      { dRow: -1, dCol: -1, kind: 'move_and_attack' },
      { dRow: -1, dCol: 1, kind: 'move_and_attack' },
    ],
  },
};

export const CARD_DOSSIERS: Readonly<Record<CardType, CardDossier>> = {
  kamikaze: {
    id: 'kamikaze',
    name: CARD_CATALOG.kamikaze.name,
    badge: '💥',
    durationLabel: 'Permanent jusqu’à élimination',
    visibilityLabel: 'Adversaire averti de la carte, pion cible secret',
    effectDescription: CARD_CATALOG.kamikaze.description,
    restrictions: [
      'Interdit sur le Roi et sur le Colosse.',
      `Un Colosse survit au 1er déclenchement Kamikaze qu’il provoque (1/${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}) et est éliminé au ${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}e (${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}/${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}).`,
      'Les déclenchements Kamikaze provoqués par d’autres pièces ne comptent jamais dans le compteur du Colosse.',
      'S’applique également contre Traqueur, Exécuteur (Frappe traversante incluse) et Arbalétrier à distance.',
      'Une pièce attaquante protégée par Protection absorbe l’explosion Kamikaze en brisant sa Protection.',
      'Si un Assassin meurt par Kamikaze, sa révélation permanente ne se déclenche pas.',
    ],
  },
  invincibilite: {
    id: 'invincibilite',
    name: CARD_CATALOG.invincibilite.name,
    badge: '🛡️',
    durationLabel: '1 tour complet',
    visibilityLabel: 'Adversaire averti de la carte, pion cible secret',
    effectDescription: CARD_CATALOG.invincibilite.description,
    restrictions: [
      'Interdit sur le Roi et sur le Colosse.',
      'Bloque toute attaque directe, saut de Cavalier, Frappe traversante ou Tir d’arbalète pendant 1 tour complet.',
      'Aucune capacité spéciale (y compris l’Exécuteur ou le Traqueur) ne contourne l’Invincibilité.',
    ],
  },
  block: {
    id: 'block',
    name: CARD_CATALOG.block.name,
    badge: '⛓️',
    durationLabel: '1 tour adverse sauté',
    visibilityLabel: 'Effet annoncé publiquement',
    effectDescription: CARD_CATALOG.block.description,
    restrictions: [
      'Temps de recharge (cooldown) de 2 tours avant de pouvoir rejouer Block.',
      'Empêche également le Traqueur ou l’Arbalétrier adverse d’agir pendant le tour sauté ; votre propre tour suivant progresse normalement.',
    ],
  },
  retreat: {
    id: 'retreat',
    name: CARD_CATALOG.retreat.name,
    badge: '↩️',
    durationLabel: 'Immédiat',
    visibilityLabel: 'Déplacement visible',
    effectDescription: CARD_CATALOG.retreat.description,
    restrictions: [
      'Permet aux pièces ne pouvant normalement pas reculer (Soldat, Colosse) de reculer d’1 case (y compris Traqueur, Exécuteur, Arbalétrier).',
      'L’élimination en reculant doit respecter les immunités (Colosse, Invincibilité) et le seuil Kamikaze du Colosse (2 déclenchements).',
    ],
  },
  revelation_temporaire: {
    id: 'revelation_temporaire',
    name: CARD_CATALOG.revelation_temporaire.name,
    badge: '👁️',
    durationLabel: '1 tour complet (jusqu’à votre prochain tour)',
    visibilityLabel: 'Cible secrète',
    effectDescription: CARD_CATALOG.revelation_temporaire.description,
    restrictions: [
      'Bloquée par Brouillard et Contre-espionnage.',
      'Permet au Traqueur de marquer la pièce révélée, mais le marquage disparaît dès que la révélation temporaire expire.',
    ],
  },
  revelation_permanente: {
    id: 'revelation_permanente',
    name: CARD_CATALOG.revelation_permanente.name,
    badge: '🔍',
    durationLabel: 'Jusqu’à la fin de la partie',
    visibilityLabel: 'Cible secrète',
    effectDescription: CARD_CATALOG.revelation_permanente.description,
    restrictions: [
      'Ne peut jamais être annulée par Brouillard ni Contre-espionnage.',
      'Une pièce révélée définitivement reste éligible au Marquage du Traqueur (tant que la ligne orthogonale 1–2 est dégagée).',
    ],
  },
  resurrection: {
    id: 'resurrection',
    name: CARD_CATALOG.resurrection.name,
    badge: '✨',
    durationLabel: 'Immédiat',
    visibilityLabel: 'Apparition visible en 1re rangée',
    effectDescription: CARD_CATALOG.resurrection.description,
    restrictions: [
      'Interdit sur le Roi, la Reine et le Colosse.',
      'Autorisée sur Traqueur, Exécuteur et Arbalétrier uniquement s’il n’en existe pas déjà 1 exemplaire vivant sur le plateau (plafond strict de 1).',
      'La case d’apparition sur la première rangée doit être libre.',
      'Une pièce promue avant son élimination conserve son rôle promu à la résurrection (et réinitialise marquage / récupération).',
    ],
  },
  brouillard: {
    id: 'brouillard',
    name: CARD_CATALOG.brouillard.name,
    badge: '🌫️',
    durationLabel: '3 tours complets',
    visibilityLabel: 'Actif sur toute votre armée',
    effectDescription: CARD_CATALOG.brouillard.description,
    restrictions: [
      'Bloque les Guetteurs H/D adverses, Révélation temporaire et Espionnage.',
      'Empêche le Traqueur adverse de marquer vos pièces cachées et fait immédiatement disparaître tout marquage qui reposait sur une révélation temporaire ou un Guetteur.',
      'N’annule pas les révélations permanentes déjà acquises ni celles de l’Assassin.',
    ],
  },
  espionnage: {
    id: 'espionnage',
    name: CARD_CATALOG.espionnage.name,
    badge: '📡',
    durationLabel: '3 tours complets',
    visibilityLabel: 'Adversaire averti de la carte, pions cibles secrets',
    effectDescription: CARD_CATALOG.espionnage.description,
    restrictions: [
      'Traverse Contre-espionnage, mais reste bloqué par Brouillard.',
      'Tant qu’Espionnage révèle une pièce ennemie, le Traqueur peut la marquer.',
    ],
  },
  teleportation: {
    id: 'teleportation',
    name: CARD_CATALOG.teleportation.name,
    badge: '⚡',
    durationLabel: 'Immédiat',
    visibilityLabel: 'Déplacement visible',
    effectDescription: CARD_CATALOG.teleportation.description,
    restrictions: [
      'Utilisable sur Traqueur, Exécuteur et Arbalétrier en respectant leurs directions autorisées (sans traverser d’obstacle ni capturer).',
      'Ne réinitialise jamais le temps de récupération du tir de l’Arbalétrier et ne déclenche ni tir, ni Frappe traversante, ni Poursuite automatique.',
    ],
  },
  protection: {
    id: 'protection',
    name: CARD_CATALOG.protection.name,
    badge: '🔰',
    durationLabel: 'Permanent jusqu’au 1er coup subi',
    visibilityLabel: 'Cible secrète pour l’adversaire',
    effectDescription: CARD_CATALOG.protection.description,
    restrictions: [
      'Interdit sur le Roi et sur le Colosse.',
      'Bloque une attaque directe, un saut de Cavalier, une Frappe traversante, un Tir d’arbalète ou une explosion Kamikaze, puis disparaît.',
      'N’interagit pas avec les révélations d’identité ni avec le marquage du Traqueur.',
    ],
  },
  recrutement: {
    id: 'recrutement',
    name: CARD_CATALOG.recrutement.name,
    badge: '📯',
    durationLabel: 'Immédiat (1 fois max par partie)',
    visibilityLabel: 'Apparition visible en 1re rangée',
    effectDescription: CARD_CATALOG.recrutement.description,
    restrictions: ['Réservée strictement au Soldat (jamais utilisable sur Traqueur, Exécuteur ou Arbalétrier).'],
  },
  double_action: {
    id: 'double_action',
    name: CARD_CATALOG.double_action.name,
    badge: '⏩',
    durationLabel: 'Ce tour (2 actions immédiates)',
    visibilityLabel: 'Effet annoncé',
    effectDescription: CARD_CATALOG.double_action.description,
    restrictions: [
      'Interdit de jouer une 2e carte pendant les 2 actions.',
      'Ne contourne pas la récupération du tir de l’Arbalétrier (1 tir max par séquence, même sous Double Action).',
      'Ne permet ni d’ignorer les immunités du Colosse ni de doubler automatiquement les capacités spéciales au-delà de leurs conditions normales.',
    ],
  },
  piege: {
    id: 'piege',
    name: CARD_CATALOG.piege.name,
    badge: '🕸️',
    durationLabel: 'Reste posé jusqu’au déclenchement ; immobilise 1 tour',
    visibilityLabel: 'Adversaire averti de la pose, case secrète',
    effectDescription: CARD_CATALOG.piege.description,
    restrictions: [
      'Une fois posé sur une case libre, affecte les pièces des DEUX camps (y compris Traqueur, Exécuteur et Arbalétrier s’ils s’y déplacent) !',
      'La Frappe traversante et le Tir d’arbalète ne déplacent pas l’attaquant sur la case cible.',
    ],
  },
  contre_espionnage: {
    id: 'contre_espionnage',
    name: CARD_CATALOG.contre_espionnage.name,
    badge: '🕶️',
    durationLabel: '3 tours complets',
    visibilityLabel: 'Cible secrète pour l’adversaire',
    effectDescription: CARD_CATALOG.contre_espionnage.description,
    restrictions: [
      'Bloque Révélation temporaire et les Guetteurs (ce qui retire également le marquage du Traqueur si la pièce redevient cachée).',
      'Ne bloque pas Espionnage, Révélation permanente ni la capacité de l’Assassin.',
    ],
  },
  sacrifice: {
    id: 'sacrifice',
    name: CARD_CATALOG.sacrifice.name,
    badge: '🩸',
    durationLabel: 'Immédiat',
    visibilityLabel: 'Annoncé à l’adversaire',
    effectDescription: CARD_CATALOG.sacrifice.description,
    restrictions: [
      'Réservée strictement au Soldat (jamais utilisable sur Traqueur, Exécuteur ou Arbalétrier).',
      'Utilisable même avec 3 cartes en main et ne donne aucun point de pioche à l’adversaire.',
    ],
  },
};

export const RULE_SECTIONS: readonly RuleSection[] = [
  {
    id: 'concept',
    title: '1. Plateau 9×9, Nouvelle Composition (27 Pièces) & Préparation',
    summary:
      `Deux armées identiques de ${ARMY_TOTAL_PIECES} pièces (Rouge et Noir) s’affrontent sur 81 cases. Rouge commence toujours.`,
    bullets: [
      `Composition officielle (${ARMY_TOTAL_PIECES} pièces) : 1 Roi, 1 Reine, 1 Colosse, ${ARMY_COMPOSITION.cavalier} Cavaliers, ${ARMY_COMPOSITION.berserker} Berserker, ${ARMY_COMPOSITION.assassin} Assassins, ${ARMY_COMPOSITION.guetteur_h} Guetteurs H, ${ARMY_COMPOSITION.guetteur_d} Guetteurs D, ${ARMY_COMPOSITION.traqueur} Traqueur, ${ARMY_COMPOSITION.executeur} Exécuteur, ${ARMY_COMPOSITION.arbaletrier} Arbalétrier, ${ARMY_COMPOSITION.soldat} Soldats.`,
      'Placement libre sur vos 3 premières rangées en 90 s (complétion automatique si temps écoulé) ; pendule de 10 minutes par joueur.',
      'Reine, Colosse, Traqueur, Exécuteur et Arbalétrier sont chacun limités strictement à 1 exemplaire vivant maximum sur le plateau (y compris après Promotion ou Résurrection).',
      'Apparence personnalisable : par défaut en Rouge et Noir, chaque camp conserve une palette claire ou sombre nettement différenciée sur fond 100 % transparent et automatiquement adaptée au thème sélectionné, sans jamais révéler d’identité cachée.',
    ],
  },
  {
    id: 'visibility',
    title: '2. Identités Cachées, Révélations, Guetteurs, Traqueur & Arbalétrier',
    summary:
      'Les positions sont publiques, mais l’identité des pièces adverses reste cachée par défaut et jamais divulguée indûment.',
    bullets: [
      'Guetteurs H (3/camp : bougent en diagonale, détectent H/V) et Guetteurs D (3/camp : bougent H/V, détectent en diagonale) révèlent temporairement les ennemis à 1 case ; s’ils détectent une cible sur la ligne de l’Arbalétrier, son identité devient visible sans augmenter portée ni cadence.',
      'Traqueur & révélations : le Traqueur possède une portée standard de 1–2 cases et ne peut marquer qu’une pièce ennemie DÉJÀ révélée (Guetteur, Révélation temporaire/permanente, Espionnage, Colosse révélé) à 1–2 cases orthogonales dégagées pour étendre sa Poursuite à 3 cases. Si la cible redevient inconnue (Brouillard, Contre-espionnage, expiration), le marquage disparaît immédiatement.',
      'Arbalétrier & cibles inconnues : l’Arbalétrier peut tirer sur une pièce ennemie cachée, mais un tir bloqué (Colosse, Invincibilité, Protection) ne révèle jamais son identité ; si elle est éliminée inconnue, le cimetière affiche « Pièce éliminée ».',
      'L’Assassin révèle définitivement chaque pièce qu’il élimine (sauf s’il meurt simultanément par Kamikaze).',
    ],
  },
  {
    id: 'colosse-et-specials',
    title: '3. Règles Officielles du Colosse, Kamikaze (2/2) & Capacités Spéciales',
    summary:
      `Le Colosse possède une immunité renforcée mise à jour avec la règle définitive des ${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD} déclenchements Kamikaze et la Frappe traversante.`,
    bullets: [
      `Kamikaze contre Colosse : le Colosse survit au 1er déclenchement Kamikaze qu’il provoque (1/${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}) et est ÉLIMINÉ au ${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}e (${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}/${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}). Les déclenchements Kamikaze provoqués par d’autres pièces ne comptent pas.`,
      'Attaques contre le Colosse : Roi, Reine et autre Colosse l’éliminent normalement ; la Frappe traversante de l’Exécuteur peut l’éliminer s’il est visé derrière une autre pièce ennemie non-Colosse ; le Tir d’arbalète et toutes les attaques normales (y compris Poursuite du Traqueur et Bond/Saut du Cavalier) ne peuvent JAMAIS l’éliminer.',
      'Frappe traversante (Exécuteur) : sur [Exécuteur, Ennemi 1, Ennemi 2] alignés H/V (Ennemi 1 ≠ Colosse), l’Exécuteur reste sur sa case et choisit Ennemi 1 (attaque normale) ou Ennemi 2 (Frappe traversante, Ennemi 1 reste intact).',
      'Tir d’arbalète & recharge (1 tir / 3 tours) : 1 à 3 cases dans les 8 directions en ligne dégagée, ne déplace pas l’Arbalétrier, puis temps de recharge de 2 tours personnels d’attente (Tour 1 tir → Tour 2 attente → Tour 3 attente → Tour 4 prêt ; non réinitialisé par Téléportation ; non contourné par Double Action).',
      'Cavalier reworké (Bond en « L » & Percée) : effectue soit un pas orthogonal d’1 case (H/V), soit un Bond en « L » (2×1) sautant par-dessus toute pièce ou piège intermédiaire, soit un Saut Percée style dames en chaîne par-dessus un ennemi adjacent.',
    ],
  },
  {
    id: 'cards-and-turns',
    title: '4. Nouvelle Gestion des Tours, Cartes & Fin de Partie',
    summary:
      '0 ou 1 élimination = 1 action pour l’adversaire. 2+ éliminations dans un tour = Tour Bonus immédiat (1 déplacement, sans carte). Toutes les 3 éliminations ennemies, vous piochez 1 carte aléatoire (3 max en main).',
    bullets: [
      'Gestion des tours unifiée (sans pénalité) : aucune pièce n’offre plus 2 actions gratuites à l’adversaire en cas d’échec (l’ancienne pénalité à 0 élimination du Cavalier est supprimée).',
      'Tour Bonus (2+ éliminations) : toute action ou combinaison d’actions dans un même tour éliminant au moins 2 pièces ennemies réelles accorde immédiatement un Tour Bonus d’1 seul déplacement sans carte (une attaque bloquée ou annulée ne compte jamais).',
      'Kamikaze, Protection et Invincibilité sont strictement interdits sur le Roi et sur le Colosse ; Protection/Invincibilité bloquent aussi Frappe traversante et Tir d’arbalète.',
      'Double Action accorde 2 actions consécutives dans ce tour (sans 2e carte ni 2e tir d’Arbalétrier) ; Téléportation respecte les directions de chaque pion.',
      'Victoire immédiate par élimination du Roi adverse (y compris par Frappe traversante ou Tir d’arbalète), pendule à 0:00, abandon ou déconnexion > 60 s.',
      'Match nul par accord mutuel, Pat (aucun coup ni carte jouable) ou 5 répétitions (avertissement à 3 répétitions).',
    ],
  },
];

export const MECHANIC_DOSSIERS: readonly MechanicDossier[] = [
  {
    id: 'gestion-tours-bonus',
    title: 'Gestion des Tours (0 = 1, 1 = 1, 2+ = Tour Bonus)',
    badge: '⚡',
    category: 'Gestion des tours',
    summary:
      'La pénalité du Cavalier est supprimée. Le rythme des tours dépend désormais uniquement du nombre réel d’éliminations ennemies obtenues dans votre tour.',
    rules: [
      '0 élimination réelle dans le tour : l’adversaire reçoit normalement 1 action à son tour.',
      '1 élimination réelle dans le tour : l’adversaire reçoit normalement 1 action à son tour.',
      '2 éliminations réelles ou plus dans un même tour (saut en chaîne, Double Action, combo) : vous obtenez immédiatement un Tour Bonus composé uniquement d’1 déplacement, sans carte autorisée.',
    ],
    edgeCases: [
      'Une élimination bloquée par Protection, Invincibilité ou immunité du Colosse n’est pas comptabilisée.',
      'Sacrifier son propre Soldat (carte Sacrifice) ou subir une riposte Kamikaze ne compte jamais comme une élimination vers votre Tour Bonus.',
      'Un Tour Bonus ne peut jamais enchaîner un deuxième Tour Bonus.',
    ],
  },
  {
    id: 'cavalier-rework',
    title: 'Rework du Cavalier (Bond en « L » & Percée en Chaîne)',
    badge: 'CAV',
    relatedCharacter: 'cavalier',
    category: 'Cavalier',
    summary:
      'Le Cavalier quitte son rôle rigide de pion lent puni à 0 élimination pour devenir une pièce d’infiltration agile capable de contourner le front en « L » ou de percer en chaîne.',
    rules: [
      'Bond en « L » : se déplace ou attaque en L (2 cases sur un axe + 1 case perpendiculaire) en sautant par-dessus alliés, ennemis, Colosse et pièges intermédiaires.',
      'Pas de mêlée : peut aussi avancer ou capturer à 1 case horizontale/verticale (H/V), mais pas à 1 case en diagonale.',
      'Percée (Saut style dames) : peut toujours sauter par-dessus un ennemi adjacent vers la case libre située derrière lui, avec enchaînement facultatif (et déclencher le Tour Bonus à 2+ éliminations).',
    ],
    edgeCases: [
      'Aucune pénalité en cas de 0 élimination : déplacer un Cavalier sans capturer rend toujours 1 action normale à l’adversaire.',
      'Un Piège posé sur la case d’arrivée d’un Bond en « L » s’active normalement ; les cases survolées sont ignorées.',
      'Ne peut ni s’arrêter sur une case alliée ni éliminer un Colosse (il peut toutefois passer par-dessus un Colosse lors d’un Bond en « L »).',
    ],
  },
  {
    id: 'frappe-traversante',
    title: 'Frappe traversante (Exécuteur)',
    badge: 'EXE',
    relatedCharacter: 'executeur',
    category: 'Exécuteur',
    summary:
      'Permet à l’Exécuteur d’abattre une pièce ennemie située à 2 cases derrière un premier ennemi aligné H/V, en choisissant librement sa cible.',
    rules: [
      'Alignement horizontal ou vertical obligatoire sur exactement 2 cases : [Exécuteur] → [Ennemi 1] → [Ennemi 2].',
      'L’Exécuteur reste sur sa case de départ et élimine Ennemi 2 à travers la ligne ; Ennemi 1 reste intact.',
      'Si vous préférez abattre Ennemi 1, sélectionnez simplement la case à 1 case (attaque normale).',
      'Seule capacité spéciale autorisée à éliminer le Colosse (lorsqu’il est la cible arrière Ennemi 2).',
    ],
    edgeCases: [
      'Impossible à travers une pièce alliée, à travers 2 pièces, ou si Ennemi 1 est un Colosse (un Colosse intermédiaire caché interrompt la frappe et est révélé temporairement).',
      'Si Ennemi 1 est le Roi adverse, frapper Ennemi 2 laisse le Roi intact ; choisir directement le Roi gagne immédiatement la partie.',
      'Respecte Protection, Invincibilité et Kamikaze (si Ennemi 2 explose en Kamikaze, l’Exécuteur est emporté sauf Protection).',
    ],
  },
  {
    id: 'marquage-poursuite',
    title: 'Marquage & Poursuite (Traqueur — Guide Détaillé)',
    badge: 'TRQ',
    relatedCharacter: 'traqueur',
    category: 'Traqueur',
    summary:
      'Portée de base réduite à 2 cases ; le Marquage (0 coût) prépare dès votre tour personnel suivant une Poursuite étendue à 3 cases vers une cible déjà identifiée.',
    rules: [
      'Objectif & Conditions : ciblez une pièce ennemie DÉJÀ révélée (Guetteur H/D, Espionnage, Révélation temporaire/permanente, Colosse révélé) située à 1–2 cases orthogonales en ligne dégagée (aucune pièce inconnue « ? »).',
      'Activation & Portée : sélectionnez le Traqueur → cliquez sur « Marquer une cible (0 action) » → cliquez sur l’ennemi révélé (alignement H/V, 1–2 cases). Vous pouvez ensuite jouer votre véritable coup du tour.',
      'Déplacements & Bonus Poursuite : normalement 1–2 cases H/V. À partir de votre tour suivant (et tant que la marque reste valide), vous gagnez +1 case (jusqu’à 3 cases H/V) uniquement dans la direction qui vous rapproche de la cible marquée.',
      'Exemple concret : Tour 1, votre Guetteur révèle un Assassin adverse en E5 à 2 cases de votre Traqueur en E3. Vous marquez E5 gratuitement (0 action) puis jouez votre tour. Tour 2, l’Assassin recule en E6 (3 cases de E3) : votre Traqueur fonce jusqu’à E6 et l’élimine !',
    ],
    edgeCases: [
      'Limites strictes : une seule cible marquée maximum (re-marquer remplace l’ancienne et réarme la Poursuite pour le tour suivant) ; à distance 3, impossible d’éliminer une autre pièce que la cible marquée.',
      'Durée & Fin d’effet : persiste tant que la cible est en vie et identifiable ; consomme le bonus quand vous effectuez un déplacement de 3 cases (un déplacement de 1–2 cases conserve le marquage).',
      'Disparition immédiate : si la cible meurt ou redevient cachée (expiration de Révélation temporaire/Espionnage, sortie d’un Guetteur, Brouillard, Contre-espionnage), le marquage disparaît.',
      'Colosse & Cartes : le Colosse révélé peut être marqué pour se rapprocher rapidement, mais la Poursuite ne l’élimine jamais ; respecte Protection, Invincibilité et Kamikaze ; Téléportation n’annule pas le marquage.',
    ],
  },
  {
    id: 'tir-arbalete',
    title: 'Tir d’arbalète (Arbalétrier)',
    badge: 'ARB',
    relatedCharacter: 'arbaletrier',
    category: 'Arbalétrier',
    summary:
      'Attaque à distance sur 1 à 3 cases dans les 8 directions, avec ligne de vue dégagée, sans déplacer l’Arbalétrier.',
    rules: [
      'Portée : 1, 2 ou 3 cases horizontalement, verticalement ou en diagonale, sans aucune pièce sur les cases intermédiaires.',
      'Action complète : tirer consomme votre action du tour (impossible de bouger et tirer dans la même action).',
      'Cible inconnue autorisée : le tir peut viser une pièce ennemie cachée (« ? ») ; si elle est éliminée, le cimetière affiche « Pièce éliminée ».',
    ],
    edgeCases: [
      'Si une pièce se trouve à 1 case orthogonale (adjacente), l’interface vous permet de choisir entre Capture au corps à corps (déplacement) et Tir d’arbalète à distance (reste sur place).',
      'Un tir bloqué par Protection, Invincibilité ou Colosse ne révèle JAMAIS l’identité d’une cible inconnue.',
    ],
  },
  {
    id: 'recuperation-tir',
    title: 'Recharge du Tir de l’Arbalétrier (1 tir / 3 tours personnels)',
    badge: 'ARB',
    relatedCharacter: 'arbaletrier',
    category: 'Arbalétrier',
    summary:
      'Après chaque tir (réussi ou bloqué), l’Arbalétrier ne peut tirer qu’une fois tous les 3 tours de son propriétaire : 2 tours personnels d’attente obligatoires avant le prochain tir.',
    rules: [
      'Cycle exact : Tour 1 (Disponible → vous tirez) → Tour 2 (Indisponible : 2 tours restants) → Tour 3 (Indisponible : 1 tour restant) → Tour 4 (Disponible à nouveau !).',
      'Les tours de l’adversaire ne font jamais avancer ce délai ; seul le déplacement normal d’1 case H/V reste autorisé pendant la recharge.',
      'Le délai s’applique même si le tir a été bloqué par Invincibilité, Protection ou un Colosse.',
    ],
    edgeCases: [
      'Double Action : ne permet jamais de tirer deux fois ni de contourner la recharge (la 2e action sert à bouger l’Arbalétrier ou une autre pièce).',
      'Téléportation & Block : Téléportation ne réinitialise jamais le temps de recharge ; l’état de recharge est strictement géré côté serveur et restauré après reconnexion.',
    ],
  },
  {
    id: 'interactions-colosse',
    title: 'Interactions avec le Colosse',
    badge: 'CO',
    relatedCharacter: 'colosse',
    category: 'Colosse & Kamikaze',
    summary:
      'Récapitulatif officiel de toutes les capacités spéciales face à l’immunité du Colosse.',
    rules: [
      'Éliminations directes autorisées : Roi, Reine, autre Colosse et Frappe traversante de l’Exécuteur (lorsque le Colosse est la cible arrière).',
      'Attaques inefficaces : Tir d’arbalète, Poursuite/attaque du Traqueur, attaque normale 1–2 cases de l’Exécuteur, Cavalier (Bond/Saut), Berserker, Assassin, Guetteurs, Soldat.',
      'Pièce intermédiaire : le Colosse ne peut jamais être sauté par le Saut Percée style dames du Cavalier ni traversé par la Frappe traversante ; le Cavalier peut toutefois passer par-dessus lors d’un Bond en « L ».',
    ],
    edgeCases: [
      'Une attaque de mêlée, un Bond offensif sur lui ou un saut de Cavalier contre un Colosse caché échoue et le révèle temporairement.',
      'Au contraire, un Tir d’arbalète contre un Colosse caché échoue SANS révéler son identité.',
    ],
  },
  {
    id: 'kamikaze-colosse',
    title: `Kamikaze contre le Colosse (${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}/${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD})`,
    badge: '💥',
    category: 'Colosse & Kamikaze',
    summary:
      `Règle définitive : le Colosse est éliminé au ${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}e déclenchement de Kamikaze qu’il provoque lui-même.`,
    rules: [
      `1er déclenchement provoqué par le Colosse : la pièce Kamikaze explose, le Colosse SURVIT (compteur à 1/${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}).`,
      `2e déclenchement provoqué par ce même Colosse : le Colosse est ÉLIMINÉ à son tour (${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}/${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}).`,
      'Les explosions Kamikaze déclenchées par d’autres pièces alliées ou ennemies n’incrémentent jamais le compteur du Colosse.',
    ],
    edgeCases: [
      'Le compteur (0/2, 1/2) est propre à chaque Colosse, conservé entre les tours et après reconnexion, et strictement calculé par le serveur.',
      'Le Roi et le Colosse ne peuvent jamais recevoir eux-mêmes les cartes Kamikaze, Protection ou Invincibilité.',
    ],
  },
];

export interface FaqEntry {
  readonly id: string;
  readonly category: 'regles' | 'pions_cartes' | 'themes_profil' | 'multijoueur';
  readonly question: string;
  readonly answer: string;
}

export const FAQ_ITEMS: readonly FaqEntry[] = [
  {
    id: 'faq-hidden-identities',
    category: 'regles',
    question: 'Pourquoi les pions adverses affichent-ils « Inconnu » sur le plateau ?',
    answer:
      'BLIND WAR est un jeu à informations cachées : vous connaissez uniquement l’identité de vos propres pièces. Pour révéler l’ennemi, utilisez vos Guetteurs H/D, l’Assassin (révèle sa victime), ou des cartes comme Espionnage et Révélation.',
  },
  {
    id: 'faq-piece-colors',
    category: 'themes_profil',
    question: 'Comment s’adaptent les couleurs des pièces selon le thème choisi ?',
    answer:
      'Chaque thème applique automatiquement une palette harmonieuse claire pour un camp et foncée/contrastée pour l’autre sur un fond 100 % transparent, afin que chaque silhouette reste immédiatement lisible sur les cases claires, foncées, sélectionnées ou visées sans jamais changer de camp.',
  },
  {
    id: 'faq-themes-sync',
    category: 'themes_profil',
    question: 'Mon adversaire voit-il le thème que j’ai choisi ?',
    answer:
      'Non. Le thème (Rouge et noir, Vert et beige, Noir et blanc, Bleu et argent, etc.) est une préférence strictement personnelle : chaque joueur affiche l’interface et le plateau avec son propre thème.',
  },
  {
    id: 'faq-arb-cooldown',
    category: 'pions_cartes',
    question: 'Comment fonctionne le temps de recharge de l’Arbalétrier ?',
    answer:
      'L’Arbalétrier peut tirer une fois tous les 3 tours de son propriétaire (Tour 1 tir → Tour 2 recharge → Tour 3 recharge → Tour 4 prêt). Son déplacement normal d’1 case H/V reste disponible pendant la recharge.',
  },
  {
    id: 'faq-colosse-kamikaze',
    category: 'pions_cartes',
    question: 'Comment éliminer un Colosse adverse ?',
    answer:
      'Un Colosse peut être éliminé par le Roi, la Reine, un autre Colosse, la Frappe traversante de l’Exécuteur (lorsqu’il est la cible arrière), ou en lui faisant déclencher 2 fois une pièce Kamikaze (2/2).',
  },
  {
    id: 'faq-ranked-account',
    category: 'multijoueur',
    question: 'Comment jouer en Matchmaking Classé ELO ?',
    answer:
      'Connectez-vous ou créez un compte gratuit (départ à 200 ELO). Vos préférences de thème, votre photo de profil, votre historique et votre classement sont automatiquement synchronisés.',
  },
];

export interface SettingsHelpEntry {
  readonly id: string;
  readonly section: string;
  readonly summary: string;
}

export const SETTINGS_HELP_ITEMS: readonly SettingsHelpEntry[] = [
  {
    id: 'help-appearance',
    section: 'Apparence & Thèmes',
    summary:
      'Choisissez le thème global du site (Rouge et noir par défaut, Vert et beige, Noir et blanc, Bleu et argent, Ambre et ébène), personnalisez séparément le plateau si souhaité et prévisualisez chaque rendu avant de l’appliquer.',
  },
  {
    id: 'help-profile',
    section: 'Profil & Photo',
    summary:
      'Importez une image PNG, JPEG ou WebP recadrée directement depuis votre appareil, personnalisez votre nom affiché, choisissez une bannière, un titre ou un badge débloqué grâce à vos parties réelles.',
  },
  {
    id: 'help-gameplay',
    section: 'Préférences de jeu',
    summary:
      'Réglez le volume sonore (0 à 100 %), la vitesse des animations, l’affichage des coordonnées A–I / 1–9, les zones des Guetteurs et les confirmations avant d’abandonner ou quitter une partie.',
  },
  {
    id: 'help-a11y',
    section: 'Accessibilité',
    summary:
      'Augmentez la taille des textes, activez le contraste renforcé, réduisez les animations, renforcez la bordure de sélection et affichez des marqueurs géométriques sur les coups possibles.',
  },
];

export interface CardUsageDetails {
  readonly id: CardType;
  readonly targetSummary: string;
  readonly usageConditions: readonly string[];
  readonly restrictions: readonly string[];
  readonly particularities: readonly string[];
}

const TARGET_KIND_CONDITION_LABELS: Readonly<Record<string, string>> = {
  none: 'S’active directement sans sélectionner de case ni de pièce sur l’échiquier.',
  own_piece: 'Cible : 1 pièce alliée vivante sur le plateau.',
  enemy_piece: 'Cible : 1 pièce ennemie vivante sur le plateau.',
  two_enemy_pieces: 'Cible : 1 ou 2 pièces ennemies vivantes sur le plateau.',
  own_graveyard_piece: 'Cible : 1 pièce alliée éliminée au cimetière + 1 case libre sur votre 1re rangée.',
  empty_square: 'Cible : 1 case libre autorisée par les règles de la carte.',
  own_soldier: 'Cible : 1 Soldat allié vivant sur le plateau.',
};

const CARD_PARTICULARITY_EXTRA: Readonly<Partial<Record<CardType, readonly string[]>>> = {
  kamikaze: [
    'Réplique automatiquement contre toute capture ou tir adverse, sauf le 1er impact sur un Colosse (seuil 2/2).',
  ],
  invincibilite: [
    'Protège la pièce ciblée contre 100 % des captures et éliminations pendant 1 tour complet.',
  ],
  block: [
    'L’adversaire saute intégralement son prochain tour (temps de recharge : 2 tours).',
  ],
  retreat: [
    'Permet une retraite tactique d’une case vers l’arrière, y compris pour Soldat et Colosse.',
  ],
  revelation_temporaire: [
    'Dévoile un rôle caché 1 tour complet pour orienter une capture ou un Marquage Traqueur.',
  ],
  revelation_permanente: [
    'Verrouille l’identité ennemie jusqu’au terme de la partie sans blocage possible par Brouillard.',
  ],
  resurrection: [
    'Restaure le rôle réel (y compris s’il s’agissait d’un pion promu avant son élimination).',
  ],
  brouillard: [
    'Camoufle l’ensemble de votre armée contre Guetteurs H/D, Révélation temporaire et Espionnage.',
  ],
  espionnage: [
    'Traverse Contre-espionnage pendant 3 tours sur 1 ou 2 pièces ennemies sans en révéler le ciblage.',
  ],
  teleportation: [
    'Relocalise jusqu’à 2 cases selon les axes autorisés de l’unité sans déclencher de capture.',
  ],
  protection: [
    'Bouclier secret à usage unique absorbant la 1re attaque, tir ou explosion Kamikaze subie.',
  ],
  recrutement: [
    'Renfort unique (1 fois max par partie) ramenant exclusivement un Soldat en 1re rangée.',
  ],
  double_action: [
    'Enchaîne deux actions de déplacement/attaque lors du même tour sans consommer une seconde carte.',
  ],
  piege: [
    'Effet symétrique : toute pièce alliée comme ennemie entrant sur la case piégée est immobilisée 1 tour.',
  ],
  contre_espionnage: [
    'Dissimule secrètement 1 unité alliée pendant 3 tours face aux Guetteurs et à Révélation temporaire.',
  ],
  sacrifice: [
    'Retire 1 Soldat allié du plateau pour piocher aussitôt 1 carte sans offrir d’élimination à l’adversaire.',
  ],
};

/**
 * Derive structured UI inspection details (usage conditions, restrictions, particularities)
 * directly from the authoritative card catalog & encyclopedia dossiers.
 */
export function getCardUsageDetails(card: CardType): CardUsageDetails {
  const meta = CARD_CATALOG[card];
  const dossier = CARD_DOSSIERS[card];
  const targetCondition = TARGET_KIND_CONDITION_LABELS[meta.targetKind] ?? '';

  const usageConditions: string[] = [
    targetCondition,
    'Jouable pendant votre tour principal avant d’avoir épuisé vos actions (interdit durant un Tour Bonus).',
    '1 seule carte jouable par tour ; jouer une carte ne consomme pas votre déplacement normal.',
  ];
  if (card === 'recrutement') {
    usageConditions.push('Nécessite au moins 1 Soldat éliminé, 1 case libre sur votre 1re rangée, et 1 seule utilisation par partie.');
  }
  if (card === 'resurrection') {
    usageConditions.push('Nécessite au moins 1 pièce alliée éligible au cimetière et 1 case libre sur votre 1re rangée.');
  }
  if (card === 'sacrifice') {
    usageConditions.push('Nécessite au moins 1 Soldat allié vivant sur le plateau (autorisé même avec 3 cartes en main).');
  }
  if (card === 'piege') {
    usageConditions.push('Doit cibler une case actuellement inoccupée sans autre piège allié actif.');
  }

  const secretNotice = meta.isTargetSecretToOpponent
    ? 'Confidentialité : l’adversaire voit quelle carte est jouée mais ignore sur quel pion ou quelle case.'
    : 'Visibilité : effet ou déplacement annoncé publiquement selon les règles officielles.';

  const particularities: string[] = [
    secretNotice,
    ...(CARD_PARTICULARITY_EXTRA[card] ?? []),
  ];

  return {
    id: card,
    targetSummary: targetCondition,
    usageConditions,
    restrictions: [...dossier.restrictions],
    particularities,
  };
}

