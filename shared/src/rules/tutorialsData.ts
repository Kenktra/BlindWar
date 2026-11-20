import type { CardType, CharacterType, Coord } from '../types/core.js';
import { ARMY_COMPOSITION } from '../constants/army.js';
import { CARD_TYPES, COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD } from '../constants/cards.js';

export type DiagramCellHighlightKind =
  | 'selected'
  | 'move'
  | 'attack'
  | 'leap'
  | 'jump'
  | 'recon'
  | 'mark'
  | 'forbidden';

export type DiagramArrowStyleKind =
  | 'move'
  | 'attack'
  | 'leap'
  | 'shoot'
  | 'pierce'
  | 'forbidden';

export interface DiagramPieceItem {
  readonly row: number;
  readonly col: number;
  readonly kind: CharacterType | 'secret';
  readonly owner: 'red' | 'black';
  readonly label?: string;
}

export interface DiagramCellHighlight {
  readonly row: number;
  readonly col: number;
  readonly kind: DiagramCellHighlightKind;
  readonly tag?: string;
}

export interface DiagramArrowSpec {
  readonly from: Coord;
  readonly to: Coord;
  readonly kind: DiagramArrowStyleKind;
}

export interface TutorialDiagramStep {
  readonly id: string;
  readonly stepTitle: string;
  readonly verdictBadge: 'AUTORISÉ' | 'INTERDIT' | 'CAPACITÉ' | 'EXEMPLE';
  readonly explanation: string;
  readonly rows: number;
  readonly cols: number;
  readonly pieces: readonly DiagramPieceItem[];
  readonly highlights: readonly DiagramCellHighlight[];
  readonly arrows?: readonly DiagramArrowSpec[];
}

export interface PieceTutorialDossier {
  readonly id: CharacterType;
  readonly name: string;
  readonly initialQuantity: number;
  readonly maxBoardCapLabel: string;
  readonly linkedScenarioId: string;
  readonly role: string;
  readonly objective: string;
  readonly movements: string;
  readonly attacks: string;
  readonly restrictions: readonly string[];
  readonly specialAbilities: string;
  readonly specialConditions: readonly string[];
  readonly concreteExamples: readonly string[];
  readonly mistakesToAvoid: readonly string[];
  readonly demoSteps: readonly TutorialDiagramStep[];
}

export const PIECE_TUTORIALS: Readonly<Record<CharacterType, PieceTutorialDossier>> = {
  roi: {
    id: 'roi',
    name: 'Roi',
    initialQuantity: ARMY_COMPOSITION.roi,
    maxBoardCapLabel: '1 maximum absolu',
    linkedScenarioId: 'intro-plateau-roi',
    role: 'Chef suprême de votre armée (1 exemplaire). Sa survie conditionne l’issue de toute la partie.',
    objective: 'Protéger votre propre Roi derrière vos lignes ou l’engager en fin de partie pour abattre des cibles critiques, y compris le Colosse.',
    movements: '1 case exactement dans chacune des 8 directions (horizontale, verticale ou diagonale).',
    attacks: 'Élimine toute pièce ennemie adjacente à 1 case (dans les 8 directions), y compris le Colosse adverse.',
    restrictions: [
      'Ne peut jamais recevoir les cartes Kamikaze, Protection ou Invincibilité.',
      'Ne peut jamais être ressuscité par Résurrection s’il est éliminé.',
      'Aucun Soldat ne peut jamais être promu en Roi (strictement 1 par camp).',
    ],
    specialAbilities: 'Condition principale de victoire : éliminer le Roi adverse met immédiatement fin à la partie ; de plus, il fait partie des rares pièces capables de tuer un Colosse en mêlée.',
    specialConditions: [
      'Il n’existe pas de mise en échec bloquante comme aux échecs classiques : si votre Roi reste exposé et inconnu ou connu, l’adversaire peut l’abattre directement.',
      'Même la Frappe traversante de l’Exécuteur ou le Tir de l’Arbalétrier à distance peut éliminer le Roi et gagner instantanément.',
    ],
    concreteExamples: [
      'Fin de partie : votre Roi en E4 élimine le Colosse adverse qui vient d’arriver en D5, alors que vos Soldats et Cavaliers étaient impuissants.',
      'Bluff défensif : laisser votre Roi en 2e rangée entouré de Soldats pousse l’adversaire à gaspiller des cartes d’Espionnage.',
    ],
    mistakesToAvoid: [
      'Avancer le Roi sans couverture alors que l’Arbalétrier ou l’Exécuteur adverse surveille les alignements à 2–3 cases.',
      'Tenter de lui appliquer la carte Protection ou Invincibilité en pensant le sécuriser : le moteur l’interdit strictement.',
    ],
    demoSteps: [
      {
        id: 'roi-step-1',
        stepTitle: '1. Portée complète à 1 case (8 directions)',
        verdictBadge: 'AUTORISÉ',
        explanation: 'Le Roi contrôle les 8 cases autour de lui : déplacement et attaque dans chaque direction, même contre le Colosse.',
        rows: 5,
        cols: 5,
        pieces: [
          { row: 2, col: 2, kind: 'roi', owner: 'red' },
          { row: 1, col: 3, kind: 'colosse', owner: 'black' },
        ],
        highlights: [
          { row: 2, col: 2, kind: 'selected' },
          { row: 1, col: 1, kind: 'move' },
          { row: 1, col: 2, kind: 'move' },
          { row: 1, col: 3, kind: 'attack', tag: 'KO Colosse' },
          { row: 2, col: 1, kind: 'move' },
          { row: 2, col: 3, kind: 'move' },
          { row: 3, col: 1, kind: 'move' },
          { row: 3, col: 2, kind: 'move' },
          { row: 3, col: 3, kind: 'move' },
        ],
        arrows: [{ from: { row: 2, col: 2 }, to: { row: 1, col: 3 }, kind: 'attack' }],
      },
      {
        id: 'roi-step-2',
        stepTitle: '2. Vigilance contre tir et frappe à distance',
        verdictBadge: 'INTERDIT',
        explanation: 'Exposer votre Roi à 3 cases en ligne d’un Arbalétrier révélé ou derrière une autre pièce devant l’Exécuteur entraîne une défaite immédiate.',
        rows: 5,
        cols: 5,
        pieces: [
          { row: 1, col: 2, kind: 'roi', owner: 'red' },
          { row: 4, col: 2, kind: 'arbaletrier', owner: 'black' },
          { row: 2, col: 0, kind: 'soldat', owner: 'red' },
          { row: 2, col: 2, kind: 'soldat', owner: 'red' },
        ],
        highlights: [
          { row: 1, col: 2, kind: 'forbidden', tag: 'Danger !' },
          { row: 4, col: 2, kind: 'selected' },
        ],
        arrows: [{ from: { row: 4, col: 2 }, to: { row: 1, col: 2 }, kind: 'shoot' }],
      },
    ],
  },

  reine: {
    id: 'reine',
    name: 'Reine',
    initialQuantity: ARMY_COMPOSITION.reine,
    maxBoardCapLabel: '1 maximum absolu',
    linkedScenarioId: 'pions-et-promotion',
    role: 'Pièce polyvalente d’élite (1 exemplaire) combinant grande mobilité et puissance d’impact anti-Colosse.',
    objective: 'Contrôler le centre, perforer les failles ouvertes et éliminer les cibles lourdes dont le Colosse.',
    movements: '1 ou 2 cases dans les 8 directions (horizontale, verticale ou diagonale) sur trajectoire dégagée.',
    attacks: 'Élimine jusqu’à 1 pièce ennemie sur sa trajectoire (1 ou 2 cases). Peut abattre le Colosse adverse.',
    restrictions: [
      'Ne peut traverser aucune pièce (alliée ou ennemie) : portée max 2 cases dégagées.',
      'Ne peut jamais être ressuscitée si elle est éliminée.',
      'Limitée strictement à 1 exemplaire en vie (promotion autorisée uniquement si votre Reine initiale est déjà tombée).',
    ],
    specialAbilities: 'Fait partie des très rares unités capables de tuer directement un Colosse en attaque frontale tout en menaçant sur 8 axes jusqu’à 2 cases.',
    specialConditions: [
      'Contrairement aux échecs classiques, sa portée est plafonnée à 2 cases (et non tout le plateau).',
      'Si un ennemi se tient à 1 case, elle peut l’abattre mais ne peut pas continuer sur la 2e case derrière lui.',
    ],
    concreteExamples: [
      'En D4, avec un Colosse ennemi en F6 (diagonale à 2 cases, case E5 libre) : la Reine bondit en F6 et élimine le Colosse.',
      'Si un Soldat allié occupe D5, la Reine en D4 ne peut pas passer en D6.',
    ],
    mistakesToAvoid: [
      'Oublier qu’elle est plafonnée à 2 cases et croire qu’elle traverse tout l’échiquier.',
      'L’envoyer attaquer un pion inconnu susceptible de porter Kamikaze : la perte de la Reine est définitive (aucune Résurrection possible !).',
    ],
    demoSteps: [
      {
        id: 'reine-step-1',
        stepTitle: '1. Portée 1 à 2 cases dans les 8 directions',
        verdictBadge: 'AUTORISÉ',
        explanation: 'La Reine rayonne jusqu’à 2 cases autour d’elle tant que le chemin est libre et peut briser le Colosse.',
        rows: 5,
        cols: 5,
        pieces: [
          { row: 2, col: 2, kind: 'reine', owner: 'red' },
          { row: 0, col: 4, kind: 'colosse', owner: 'black' },
          { row: 2, col: 3, kind: 'soldat', owner: 'red' },
        ],
        highlights: [
          { row: 2, col: 2, kind: 'selected' },
          { row: 1, col: 2, kind: 'move' },
          { row: 0, col: 2, kind: 'move' },
          { row: 1, col: 3, kind: 'move' },
          { row: 0, col: 4, kind: 'attack', tag: 'Tue Colosse' },
          { row: 2, col: 4, kind: 'forbidden', tag: 'Bloqué' },
        ],
        arrows: [
          { from: { row: 2, col: 2 }, to: { row: 0, col: 4 }, kind: 'attack' },
          { from: { row: 2, col: 2 }, to: { row: 0, col: 2 }, kind: 'move' },
        ],
      },
      {
        id: 'reine-step-2',
        stepTitle: '2. Obstacle sur la trajectoire',
        verdictBadge: 'INTERDIT',
        explanation: 'En D3, un allié bloque toute traversée vers D2/D1 ; en cas de perte, la Reine ne pourra pas être ressuscitée.',
        rows: 5,
        cols: 5,
        pieces: [
          { row: 3, col: 2, kind: 'reine', owner: 'red' },
          { row: 2, col: 2, kind: 'soldat', owner: 'black' },
        ],
        highlights: [
          { row: 3, col: 2, kind: 'selected' },
          { row: 2, col: 2, kind: 'attack' },
          { row: 1, col: 2, kind: 'forbidden', tag: 'Bloqué' },
        ],
        arrows: [{ from: { row: 3, col: 2 }, to: { row: 1, col: 2 }, kind: 'forbidden' }],
      },
    ],
  },

  colosse: {
    id: 'colosse',
    name: 'Colosse',
    initialQuantity: ARMY_COMPOSITION.colosse,
    maxBoardCapLabel: '1 maximum absolu',
    linkedScenarioId: 'kamikaze-colosse-v2',
    role: 'Forteresse blindée mobile (1 exemplaire). Absorbe la quasi-totalité des attaques normales pour enfoncer le camp adverse.',
    objective: 'Traverser les lignes ennemies avec un blindage quasi-invulnérable, forcer l’adversaire à dévoiler ses pièces lourdes, puis inverser de sens au bout du plateau.',
    movements: 'Exactement 5 directions d’1 case selon son sens de progression actif : avant droit, diagonale avant gauche, diagonale avant droite, gauche, droite. Ne recule jamais.',
    attacks: 'Élimine tout ennemi dans ses 5 directions d’avancée, y compris le Colosse adverse.',
    restrictions: [
      'Impossible de reculer (sauf via la carte Retreat).',
      'Cartes strictement interdites sur le Colosse : Kamikaze, Invincibilité, Protection, Résurrection.',
      'Plafonné à 1 exemplaire actif sur le plateau.',
    ],
    specialAbilities: `Armure quasi-totale : seuls Roi, Reine, autre Colosse, Frappe traversante (Exécuteur en cible arrière) et ${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD} déclenchements de Kamikaze provoqués par le Colosse lui-même peuvent l’éliminer. En atteignant le bord opposé, il inverse sa direction et est révélé 1 tour complet.`,
    specialConditions: [
      `Règle Kamikaze (${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}/${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}) : le Colosse SURVIT au 1er Kamikaze qu’il frappe (compteur 1/2) et explose au 2e (compteur 2/2).`,
      'Toute attaque normale non autorisée contre un Colosse caché échoue et le révèle 1 tour (sauf le Tir d’arbalète bloqué qui ne révèle rien).',
    ],
    concreteExamples: [
      'Un Cavalier ou un Arbalétrier frappe votre Colosse : l’attaque rebondit, votre Colosse reste vivant et la cible révélée expose ses intentions.',
      'Votre Colosse mange un 1er Soldat Kamikaze : il passe à 1/2 et continue ; s’il mange ensuite un 2e Kamikaze, il est détruit (2/2).',
    ],
    mistakesToAvoid: [
      'Oublier qu’une Frappe traversante de l’Exécuteur derrière une pièce intermédiaire traverse votre blindage et vous tue.',
      'Avancer à portée du Roi ou de la Reine ennemie en croyant être invincible.',
    ],
    demoSteps: [
      {
        id: 'colosse-step-1',
        stepTitle: '1. Exactement 5 directions vers l’avant (aucun recul)',
        verdictBadge: 'AUTORISÉ',
        explanation: 'Tant qu’il progresse vers le haut, le Colosse va tout droit, en diagonales avant ou latéralement — jamais vers l’arrière.',
        rows: 5,
        cols: 5,
        pieces: [{ row: 2, col: 2, kind: 'colosse', owner: 'red' }],
        highlights: [
          { row: 2, col: 2, kind: 'selected' },
          { row: 1, col: 1, kind: 'move' },
          { row: 1, col: 2, kind: 'move' },
          { row: 1, col: 3, kind: 'move' },
          { row: 2, col: 1, kind: 'move' },
          { row: 2, col: 3, kind: 'move' },
          { row: 3, col: 1, kind: 'forbidden', tag: 'Recul interdit' },
          { row: 3, col: 2, kind: 'forbidden', tag: 'Recul interdit' },
          { row: 3, col: 3, kind: 'forbidden', tag: 'Recul interdit' },
        ],
      },
      {
        id: 'colosse-step-2',
        stepTitle: '2. Blindage face au Tir d’arbalète vs Vulnérabilité 2/2 Kamikaze',
        verdictBadge: 'CAPACITÉ',
        explanation: 'Le Tir à distance rebondit sans tuer le Colosse, tandis qu’un 2e ennemi sous Kamikaze abattu par lui met fin à son avancée.',
        rows: 5,
        cols: 5,
        pieces: [
          { row: 2, col: 2, kind: 'colosse', owner: 'red' },
          { row: 4, col: 4, kind: 'arbaletrier', owner: 'black' },
          { row: 1, col: 2, kind: 'soldat', owner: 'black' },
        ],
        highlights: [
          { row: 2, col: 2, kind: 'selected', tag: '1/2 Kamikaze' },
          { row: 1, col: 2, kind: 'attack', tag: '2/2 = KO' },
          { row: 4, col: 4, kind: 'forbidden', tag: 'Tir bloqué' },
        ],
        arrows: [
          { from: { row: 4, col: 4 }, to: { row: 2, col: 2 }, kind: 'forbidden' },
          { from: { row: 2, col: 2 }, to: { row: 1, col: 2 }, kind: 'attack' },
        ],
      },
    ],
  },

  cavalier: {
    id: 'cavalier',
    name: 'Cavalier',
    initialQuantity: ARMY_COMPOSITION.cavalier,
    maxBoardCapLabel: `${ARMY_COMPOSITION.cavalier} au départ (extensible via promotion)`,
    linkedScenarioId: 'cavalier-bond-et-percee',
    role: 'Unité d’infiltration agile à triple option tactique (2 exemplaires au départ).',
    objective: 'Contourner les rideaux défensifs par-dessus les lignes grâce au Bond en « L » ou percer plusieurs ennemis à la suite pour décrocher un Tour Bonus.',
    movements: '1) Pas de mêlée d’1 case H/V ; OU 2) Bond en « L » (2×1 cases) passant par-dessus alliés, ennemis et pièges intermédiaires ; OU 3) Saut Percée style dames (case libre derrière un ennemi adjacent).',
    attacks: 'Élimine sur la case d’arrivée d’un pas H/V ou d’un Bond en « L », OU élimine l’ennemi sauté par le Saut Percée (avec enchaînement possible !).',
    restrictions: [
      'Ne peut plus se déplacer d’1 seule case en diagonale.',
      'Impossible d’éliminer un Colosse (ni en L, ni au contact, ni par Saut Percée ; un Colosse sauté est révélé 1 tour).',
    ],
    specialAbilities: 'Double infiltration sans aucune pénalité à 0 élimination : passer au-dessus d’un Piège durant un Bond en « L » ne le déclenche jamais ; enchaîner 2+ éliminations en Saut Percée déclenche le Tour Bonus immédiat.',
    specialConditions: [
      'Durant un Bond en « L », seule la case d’arrivée compte : si elle contient un Piège, celui-ci s’active.',
      'Lors d’une chaîne de Saut Percée, vous pouvez décider d’arrêter la chaîne à tout moment sans obligation.',
    ],
    concreteExamples: [
      'Rideau ennemi dense devant vous : votre Cavalier bondit en « L » par-dessus deux rangées et se pose derrière la défense.',
      'Deux pions adverses espacés d’1 case vide chacun : votre Cavalier saute le 1er puis le 2e dans le même tour (2 éliminations = Tour Bonus !).',
    ],
    mistakesToAvoid: [
      'Tenter de déplacer le Cavalier d’1 case en diagonale comme avant le rework.',
      'Sauter sur ou par-dessus un Colosse connu en pensant l’abattre : le saut s’interrompt devant le Colosse.',
    ],
    demoSteps: [
      {
        id: 'cavalier-step-1',
        stepTitle: '1. Pas orthogonal 1 case OU Bond en « L » au-dessus des obstacles',
        verdictBadge: 'AUTORISÉ',
        explanation: 'Le Bond en « L » ignore complètement les pièces et pièges intermédiaires pour frapper derrière la ligne.',
        rows: 5,
        cols: 5,
        pieces: [
          { row: 3, col: 2, kind: 'cavalier', owner: 'red' },
          { row: 2, col: 2, kind: 'soldat', owner: 'red' },
          { row: 2, col: 3, kind: 'soldat', owner: 'black' },
          { row: 1, col: 3, kind: 'secret', owner: 'black' },
        ],
        highlights: [
          { row: 3, col: 2, kind: 'selected' },
          { row: 3, col: 1, kind: 'move' },
          { row: 3, col: 3, kind: 'move' },
          { row: 4, col: 2, kind: 'move' },
          { row: 1, col: 1, kind: 'leap', tag: 'Bond L' },
          { row: 1, col: 3, kind: 'attack', tag: 'Capture L' },
          { row: 2, col: 1, kind: 'forbidden', tag: 'Diag interdite' },
        ],
        arrows: [
          { from: { row: 3, col: 2 }, to: { row: 1, col: 3 }, kind: 'leap' },
          { from: { row: 3, col: 2 }, to: { row: 1, col: 1 }, kind: 'leap' },
        ],
      },
      {
        id: 'cavalier-step-2',
        stepTitle: '2. Saut Percée style dames (avec enchaînement)',
        verdictBadge: 'CAPACITÉ',
        explanation: 'Un ennemi adjacent suivi d’une case libre derrière permet de le sauter et l’éliminer, puis de continuer sur un 2e ennemi.',
        rows: 5,
        cols: 5,
        pieces: [
          { row: 4, col: 0, kind: 'cavalier', owner: 'red' },
          { row: 3, col: 1, kind: 'secret', owner: 'black' },
          { row: 1, col: 2, kind: 'secret', owner: 'black' },
        ],
        highlights: [
          { row: 4, col: 0, kind: 'selected' },
          { row: 3, col: 1, kind: 'attack', tag: 'Éliminé 1' },
          { row: 2, col: 2, kind: 'jump', tag: 'Rebond' },
          { row: 1, col: 2, kind: 'attack', tag: 'Éliminé 2' },
          { row: 0, col: 2, kind: 'jump', tag: 'Tour Bonus!' },
        ],
        arrows: [
          { from: { row: 4, col: 0 }, to: { row: 2, col: 2 }, kind: 'move' },
          { from: { row: 2, col: 2 }, to: { row: 0, col: 2 }, kind: 'move' },
        ],
      },
    ],
  },

  berserker: {
    id: 'berserker',
    name: 'Berserker',
    initialQuantity: ARMY_COMPOSITION.berserker,
    maxBoardCapLabel: `${ARMY_COMPOSITION.berserker} au départ (extensible via promotion)`,
    linkedScenarioId: 'eliminations-berserker-rage',
    role: 'Avant-garde choc orthogonale (1 exemplaire au départ) dotée d’une esquive/poussée après capture.',
    objective: 'Frapper une unité sur ligne/colonne puis utiliser le mouvement de Rage pour se replacer hors de danger ou menacer un flanc.',
    movements: '1 ou 2 cases horizontalement ou verticalement (trajectoire dégagée, aucune diagonale).',
    attacks: 'Élimine horizontalement ou verticalement jusqu’à 2 cases (ne peut pas tuer le Colosse).',
    restrictions: [
      'Ne se déplace jamais en diagonale.',
      'Son 2e déplacement gratuit de Rage (après capture) NE PEUT PAS éliminer une deuxième pièce.',
    ],
    specialAbilities: 'Rage guerrière : juste après avoir éliminé un ennemi, le Berserker reçoit 1 second déplacement facultatif de 1–2 cases H/V sur cases vides (max 1 fois par tour).',
    specialConditions: [
      'Si vous ne souhaitez pas utiliser le mouvement de Rage après la capture, vous pouvez cliquer sur « Passer la Rage ».',
      'Le mouvement de Rage est neutralisé si le Berserker déclenche un Piège ou meurt par Kamikaze lors de sa première attaque.',
    ],
    concreteExamples: [
      'Votre Berserker en C4 capture un pion en E4 (+1 élimination), puis recule aussitôt en C4 grâce à la Rage pour échapper à la contre-attaque.',
    ],
    mistakesToAvoid: [
      'Compter sur la Rage pour réaliser une double élimination : la 2e avancée est strictement pacifique (case vide uniquement).',
    ],
    demoSteps: [
      {
        id: 'berserker-step-1',
        stepTitle: '1. Attaque H/V (1–2 cases) puis Rage de repositionnement',
        verdictBadge: 'CAPACITÉ',
        explanation: 'Après avoir abattu la cible en E4, le Berserker peut immédiatement glisser de 1–2 cases H/V vers une case libre.',
        rows: 5,
        cols: 5,
        pieces: [
          { row: 2, col: 1, kind: 'berserker', owner: 'red' },
          { row: 2, col: 3, kind: 'secret', owner: 'black' },
        ],
        highlights: [
          { row: 2, col: 1, kind: 'selected' },
          { row: 2, col: 3, kind: 'attack', tag: 'Capture' },
          { row: 0, col: 3, kind: 'move', tag: 'Rage' },
          { row: 1, col: 3, kind: 'move', tag: 'Rage' },
          { row: 2, col: 2, kind: 'move', tag: 'Rage' },
        ],
        arrows: [
          { from: { row: 2, col: 1 }, to: { row: 2, col: 3 }, kind: 'attack' },
          { from: { row: 2, col: 3 }, to: { row: 0, col: 3 }, kind: 'move' },
        ],
      },
    ],
  },

  assassin: {
    id: 'assassin',
    name: 'Assassin',
    initialQuantity: ARMY_COMPOSITION.assassin,
    maxBoardCapLabel: `${ARMY_COMPOSITION.assassin} au départ (extensible via promotion)`,
    linkedScenarioId: 'assassin-cimetiere',
    role: 'Agent d’élimination & de renseignement permanent au cimetière (3 exemplaires au départ).',
    objective: 'Éliminer des pions adverses clés pour connaître avec certitude les forces restantes de l’ennemi (ex. confirmer si sa Reine ou son Exécuteur est déjà tombé).',
    movements: '1 case dans les 8 directions (horizontale, verticale ou diagonale).',
    attacks: 'Élimine toute pièce ennemie adjacente à 1 case (hors Colosse et Invincible).',
    restrictions: [
      'Ne révèle rien passivement avant d’éliminer sa cible.',
      'S’il meurt en même temps par Kamikaze lors de l’élimination, sa révélation permanente ne s’active pas.',
    ],
    specialAbilities: 'Révélation définitive de la victime : l’identité exacte de toute pièce tuée par un Assassin vous est révélée de manière permanente (même sous Brouillard ou Contre-espionnage), visible directement dans le cimetière.',
    specialConditions: [
      'Indispensable pour savoir si un ennemi éliminé était la Reine, le Colosse ou un simple Soldat (ce que les autres pions ne révèlent pas si l’ennemi était caché).',
    ],
    concreteExamples: [
      'Vous abattez un pion « ? » avec votre Assassin : le cimetière révèle aussitôt qu’il s’agissait de l’Exécuteur adverse !',
    ],
    mistakesToAvoid: [
      'Le confondre avec un Guetteur : placer un Assassin à côté d’un pion ennemi ne le révèle pas tant qu’il ne l’élimine pas.',
    ],
    demoSteps: [
      {
        id: 'assassin-step-1',
        stepTitle: '1. Élimination à 1 case et révélation définitive au cimetière',
        verdictBadge: 'CAPACITÉ',
        explanation: 'L’Assassin élimine l’unité inconnue adjacente et dévoile aussitôt son rôle véritable de façon irréversible.',
        rows: 5,
        cols: 5,
        pieces: [
          { row: 2, col: 2, kind: 'assassin', owner: 'red' },
          { row: 1, col: 3, kind: 'secret', owner: 'black' },
        ],
        highlights: [
          { row: 2, col: 2, kind: 'selected' },
          { row: 1, col: 3, kind: 'attack', tag: 'Révèle ?' },
          { row: 1, col: 2, kind: 'move' },
          { row: 2, col: 3, kind: 'move' },
        ],
        arrows: [{ from: { row: 2, col: 2 }, to: { row: 1, col: 3 }, kind: 'attack' }],
      },
    ],
  },

  guetteur_h: {
    id: 'guetteur_h',
    name: 'Guetteur H',
    initialQuantity: ARMY_COMPOSITION.guetteur_h,
    maxBoardCapLabel: `${ARMY_COMPOSITION.guetteur_h} au départ (extensible via promotion)`,
    linkedScenarioId: 'recon-guetteurs',
    role: 'Éclaireur à croix orthogonale (3 exemplaires au départ) — la pièce se déplace en diagonale mais observe horizontalement et verticalement.',
    objective: 'Démasquer les pièces ennemies alignées horizontalement ou verticalement pour guider votre Traqueur et votre Arbalétrier.',
    movements: '1 case uniquement en diagonale (les 4 diagonales).',
    attacks: 'Élimine en diagonale à 1 case (hors Colosse).',
    restrictions: [
      'Ne se déplace jamais horizontalement ni verticalement.',
      'Sa détection ne fonctionne pas si l’adversaire a activé Brouillard ou Contre-espionnage sur sa cible.',
    ],
    specialAbilities: 'Reconnaissance Orthogonale (H/V) : révèle passivement et temporairement toute pièce ennemie située à 1 case au-dessus, en dessous, à gauche ou à droite tant qu’il reste adjacent et vivant.',
    specialConditions: [
      'Dès que la cible ou le Guetteur s’éloigne (ou si le Guetteur meurt), l’identité redevient cachée (« ? ») — y compris pour les marquages du Traqueur qui en dépendaient.',
    ],
    concreteExamples: [
      'Votre Guetteur H avance en diagonale sur une case adjacente à un pion « ? » sur la même rangée : son identité s’affiche immédiatement, permettant à votre Traqueur de le marquer gratuitement.',
    ],
    mistakesToAvoid: [
      'Inverser son déplacement et sa vision : le « H » signifie qu’il DÉTECTE Horizontalement/Verticalement (H/V) et BOUGE en diagonale !',
    ],
    demoSteps: [
      {
        id: 'gh-step-1',
        stepTitle: '1. Déplacement diagonal + Détection H/V (1 case)',
        verdictBadge: 'AUTORISÉ',
        explanation: 'Cases vertes = déplacements/attaques en diagonale. Cases cyan = zone de reconnaissance passive H/V qui dévoile les ennemis.',
        rows: 5,
        cols: 5,
        pieces: [
          { row: 2, col: 2, kind: 'guetteur_h', owner: 'red' },
          { row: 2, col: 3, kind: 'secret', owner: 'black' },
        ],
        highlights: [
          { row: 2, col: 2, kind: 'selected' },
          { row: 1, col: 1, kind: 'move' },
          { row: 1, col: 3, kind: 'move' },
          { row: 3, col: 1, kind: 'move' },
          { row: 3, col: 3, kind: 'move' },
          { row: 1, col: 2, kind: 'recon', tag: 'Détecte' },
          { row: 3, col: 2, kind: 'recon', tag: 'Détecte' },
          { row: 2, col: 1, kind: 'recon', tag: 'Détecte' },
          { row: 2, col: 3, kind: 'recon', tag: 'Révélé !' },
        ],
      },
    ],
  },

  guetteur_d: {
    id: 'guetteur_d',
    name: 'Guetteur D',
    initialQuantity: ARMY_COMPOSITION.guetteur_d,
    maxBoardCapLabel: `${ARMY_COMPOSITION.guetteur_d} au départ (extensible via promotion)`,
    linkedScenarioId: 'recon-guetteurs',
    role: 'Éclaireur à détection diagonale (3 exemplaires au départ) — se déplace en H/V et observe les 4 coins diagonaux.',
    objective: 'Compléter vos Guetteurs H en surveillant les diagonales d’approche autour des points stratégiques.',
    movements: '1 case uniquement horizontalement ou verticalement (les 4 axes orthogonaux).',
    attacks: 'Élimine en horizontal ou vertical à 1 case (hors Colosse).',
    restrictions: [
      'Ne se déplace jamais en diagonale.',
      'Sa détection est neutralisée par Brouillard et Contre-espionnage.',
    ],
    specialAbilities: 'Reconnaissance Diagonale : révèle passivement et temporairement toute pièce ennemie située à 1 case sur l’une des 4 diagonales.',
    specialConditions: [
      'Combinez 1 Guetteur D + 1 Guetteur H pour verrouiller la quasi-totalité d’un carré contre les approches secrètes.',
    ],
    concreteExamples: [
      'Posté en D5, votre Guetteur D révèle automatiquement un pion ennemi posé en E6 et C6 sans dépenser aucune carte.',
    ],
    mistakesToAvoid: [
      'Croire que la lettre D veut dire « Déplacement Diagonal » : D signifie « Détection Diagonale » (déplacement orthogonal H/V) !',
    ],
    demoSteps: [
      {
        id: 'gd-step-1',
        stepTitle: '1. Déplacement orthogonal H/V + Détection Diagonale (1 case)',
        verdictBadge: 'AUTORISÉ',
        explanation: 'Cases vertes = déplacements/attaques H/V. Cases cyan = 4 coins diagonaux surveillés passivement.',
        rows: 5,
        cols: 5,
        pieces: [
          { row: 2, col: 2, kind: 'guetteur_d', owner: 'red' },
          { row: 1, col: 3, kind: 'secret', owner: 'black' },
        ],
        highlights: [
          { row: 2, col: 2, kind: 'selected' },
          { row: 1, col: 2, kind: 'move' },
          { row: 3, col: 2, kind: 'move' },
          { row: 2, col: 1, kind: 'move' },
          { row: 2, col: 3, kind: 'move' },
          { row: 1, col: 1, kind: 'recon', tag: 'Détecte' },
          { row: 1, col: 3, kind: 'recon', tag: 'Révélé !' },
          { row: 3, col: 1, kind: 'recon', tag: 'Détecte' },
          { row: 3, col: 3, kind: 'recon', tag: 'Détecte' },
        ],
      },
    ],
  },

  traqueur: {
    id: 'traqueur',
    name: 'Traqueur',
    initialQuantity: ARMY_COMPOSITION.traqueur,
    maxBoardCapLabel: '1 maximum absolu (même via promotion/résurrection)',
    linkedScenarioId: 'traqueur-marquage-poursuite',
    role: 'Chasseur orthogonal à portée 2 (étendue jusqu’à 4 cases en Poursuite sur cible traquée).',
    objective: 'Cibler gratuitement sur l’échiquier une cible ennemie révélée (1–4 cases H/V) pour débloquer une percée ou capture jusqu’à 4 cases vers elle.',
    movements: '1 à 2 cases horizontalement ou verticalement (ligne dégagée). Dès qu’une cible est traquée : jusqu’à 4 cases vers la cible marquée uniquement.',
    attacks: 'Élimine jusqu’à 2 cases H/V (hors Colosse). À distance 3 ou 4 (Poursuite), ne peut capturer QUE la cible marquée.',
    restrictions: [
      'Aucun déplacement en diagonale ni saut par-dessus une pièce.',
      'Portée standard limitée à 2 cases (sans cible traquée, 3 ou 4 cases est impossible).',
      'Impossible de marquer un ennemi encore inconnu (« ? ») ou derrière un obstacle.',
      'Impossible d’abattre le Colosse (même avec Poursuite).',
    ],
    specialAbilities: 'Ciblage sur l’échiquier (0 action) & Poursuite (jusqu’à 4 cases) : sélectionnez le Traqueur → cliquez « Cibler » (coûte 0 action) puis cliquez directement sur une cible DÉJÀ révélée alignée à 1–4 cases H/V sur l’échiquier → votre portée s’étend immédiatement jusqu’à 4 cases H/V dans la direction de rapprochement.',
    specialConditions: [
      'Un trajet de 1–2 cases conserve le marquage ; un trajet à distance 3 ou 4 le consomme.',
      'Si la cible meurt ou redevient cachée (Brouillard, sortie de zone d’un Guetteur, fin d’Espionnage), le marquage disparaît instantanément.',
      'Le marquage reste invisible/secret pour votre adversaire.',
    ],
    concreteExamples: [
      'Votre Guetteur révèle la Reine noire à 4 cases de votre Traqueur → cliquez « Cibler » puis cliquez la Reine sur l’échiquier (0 PA) → votre Traqueur fond dessus en 4 cases et l’abat !',
    ],
    mistakesToAvoid: [
      'Oublier qu’une pièce doit être préalablement identifiée pour être ciblée (Guetteur, Espionnage, Révélation ou Colosse révélé).',
      'Croire que la portée de base du Traqueur est de 4 cases (elle est de 2, et ne monte jusqu’à 4 que vers la cible traquée).',
    ],
    demoSteps: [
      {
        id: 'traqueur-step-1',
        stepTitle: 'Étape 1 : Ciblage gratuit (0 action) sur l’échiquier d’une cible révélée 1–4 cases H/V',
        verdictBadge: 'CAPACITÉ',
        explanation: 'Un Guetteur ou une carte révèle un ennemi aligné à 1–4 cases sans obstacle : cliquez « Cibler » puis cliquez le pion sur l’échiquier sans consommer votre tour.',
        rows: 5,
        cols: 5,
        pieces: [
          { row: 4, col: 2, kind: 'traqueur', owner: 'red' },
          { row: 0, col: 2, kind: 'berserker', owner: 'black' },
        ],
        highlights: [
          { row: 4, col: 2, kind: 'selected' },
          { row: 3, col: 2, kind: 'move' },
          { row: 2, col: 2, kind: 'move' },
          { row: 0, col: 2, kind: 'mark', tag: 'Ciblé 0 PA' },
        ],
        arrows: [{ from: { row: 4, col: 2 }, to: { row: 0, col: 2 }, kind: 'attack' }],
      },
      {
        id: 'traqueur-step-2',
        stepTitle: 'Étape 2 : Poursuite étendue jusqu’à 4 cases vers la cible traquée',
        verdictBadge: 'EXEMPLE',
        explanation: 'Dès que la cible est traquée, votre Traqueur s’élance jusqu’à 4 cases H/V sur l’échiquier et l’élimine !',
        rows: 5,
        cols: 5,
        pieces: [
          { row: 4, col: 2, kind: 'traqueur', owner: 'red' },
          { row: 0, col: 2, kind: 'berserker', owner: 'black' },
        ],
        highlights: [
          { row: 4, col: 2, kind: 'selected' },
          { row: 3, col: 2, kind: 'move' },
          { row: 2, col: 2, kind: 'move' },
          { row: 1, col: 2, kind: 'move' },
          { row: 0, col: 2, kind: 'attack', tag: 'Poursuite 4!' },
        ],
        arrows: [{ from: { row: 4, col: 2 }, to: { row: 0, col: 2 }, kind: 'attack' }],
      },
    ],
  },

  executeur: {
    id: 'executeur',
    name: 'Exécuteur',
    initialQuantity: ARMY_COMPOSITION.executeur,
    maxBoardCapLabel: '1 maximum absolu (même via promotion/résurrection)',
    linkedScenarioId: 'executeur-frappe-traversante',
    role: 'Percuteur de ligne anti-Colosse (1 exemplaire unique). Punition redoutable contre les formations alignées.',
    objective: 'Punir tout alignement de 2 pièces adverses devant lui en abattant directement la 2e pièce derrière la 1re — même s’il s’agit du Colosse.',
    movements: '1 ou 2 cases horizontalement ou verticalement (ligne dégagée, sans diagonale).',
    attacks: 'Attaque normale à 1–2 cases (hors Colosse) OU Frappe traversante à exactement 2 cases derrière 1 seule pièce ennemie intermédiaire non-Colosse.',
    restrictions: [
      'Aucun déplacement diagonal ni changement de direction.',
      'Impossible de frapper à travers une pièce alliée, à travers 2 pièces ou à travers un Colosse.',
      'Ne tue pas un Colosse en attaque frontale directe : uniquement s’il est Ennemi 2 lors d’une Frappe traversante !',
    ],
    specialAbilities: 'Frappe traversante : avec l’alignement H/V [Exécuteur → Ennemi 1 (≠ Colosse) → Ennemi 2], l’Exécuteur reste sur sa case et élimine Ennemi 2 sans toucher Ennemi 1. Il traverse et abat le Colosse en cible arrière !',
    specialConditions: [
      'Si vous préférez capturer Ennemi 1 (à 1 case), cliquez sur Ennemi 1 ; si vous visez Ennemi 2 (à 2 cases), cliquez sur Ennemi 2 pour exécuter la Frappe traversante sans bouger.',
      'Kamikaze sur Ennemi 2 s’applique aussi contre l’Exécuteur (sauf s’il porte Protection).',
    ],
    concreteExamples: [
      'Alignement en colonne : votre Exécuteur en D3, un Soldat noir en D4, le Colosse noir (ou le Roi !) en D5 → cliquez D5 : le Colosse/Roi en D5 explose tandis que votre Exécuteur reste en D3 et que le Soldat D4 reste en vie.',
    ],
    mistakesToAvoid: [
      'Tenter d’attaquer directement un Colosse collé à 1 case sans pièce écran devant lui.',
      'Oublier qu’une pièce alliée en position intermédiaire bloque la Frappe traversante.',
    ],
    demoSteps: [
      {
        id: 'executeur-step-1',
        stepTitle: '1. Frappe traversante : [Exécuteur] → [Ennemi 1 intact] → [Ennemi 2 éliminé]',
        verdictBadge: 'CAPACITÉ',
        explanation: 'En cliquant sur le Colosse (Ennemi 2 à 2 cases derrière le Soldat noir), l’Exécuteur reste sur place et l’abat sans déplacer le Soldat intermédiaire.',
        rows: 5,
        cols: 5,
        pieces: [
          { row: 3, col: 2, kind: 'executeur', owner: 'red' },
          { row: 2, col: 2, kind: 'soldat', owner: 'black' },
          { row: 1, col: 2, kind: 'colosse', owner: 'black' },
        ],
        highlights: [
          { row: 3, col: 2, kind: 'selected', tag: 'Reste sur place' },
          { row: 2, col: 2, kind: 'move', tag: 'Épargné' },
          { row: 1, col: 2, kind: 'attack', tag: 'Frappe KO !' },
        ],
        arrows: [{ from: { row: 3, col: 2 }, to: { row: 1, col: 2 }, kind: 'pierce' }],
      },
      {
        id: 'executeur-step-2',
        stepTitle: '2. Interdit à travers un allié ou un Colosse devant',
        verdictBadge: 'INTERDIT',
        explanation: 'Un allié ou un Colosse placé en case intermédiaire bloque toute Frappe traversante derrière lui.',
        rows: 5,
        cols: 5,
        pieces: [
          { row: 3, col: 2, kind: 'executeur', owner: 'red' },
          { row: 2, col: 2, kind: 'soldat', owner: 'red' },
          { row: 1, col: 2, kind: 'roi', owner: 'black' },
        ],
        highlights: [
          { row: 3, col: 2, kind: 'selected' },
          { row: 2, col: 2, kind: 'forbidden', tag: 'Allié bloque' },
          { row: 1, col: 2, kind: 'forbidden', tag: 'Inaccessible' },
        ],
        arrows: [{ from: { row: 3, col: 2 }, to: { row: 1, col: 2 }, kind: 'forbidden' }],
      },
    ],
  },

  arbaletrier: {
    id: 'arbaletrier',
    name: 'Arbalétrier',
    initialQuantity: ARMY_COMPOSITION.arbaletrier,
    maxBoardCapLabel: '1 maximum absolu (même via promotion/résurrection)',
    linkedScenarioId: 'arbaletrier-tir-cadence',
    role: 'Tireur d’élite à distance (1 exemplaire unique) avec recharge stricte par tours personnels.',
    objective: 'Éliminer à distance des unités clés (jusqu’au Roi !) à 1–3 cases sur les 8 directions sans exposer votre position, tout en gérant la cadence de 1 tir tous les 3 tours.',
    movements: 'Déplacement normal d’1 case uniquement horizontalement ou verticalement (jamais en diagonale ; autorisé pendant la recharge).',
    attacks: 'Tir à distance de 1 à 3 cases dans les 8 directions en ligne dégagée, sans déplacer l’Arbalétrier (ou capture au corps à corps à 1 case H/V).',
    restrictions: [
      'Ne se déplace jamais en diagonale (seul le tir vise en diagonale).',
      'Ne peut tirer à travers aucune pièce.',
      'Impossible de tuer le Colosse (même avec Double Action). Un tir bloqué sur une pièce cachée ne révèle JAMAIS son identité.',
      'Cadence stricte : 1 tir tous les 3 tours personnels.',
    ],
    specialAbilities: 'Cadence 1 tir / 3 tours personnels : vous tirez au Tour 1 → recharge obligatoire au Tour 2 (2T restants) et au Tour 3 (1T restant) → prêt à tirer au Tour 4. Les tours adverses ne décomptent pas cette recharge.',
    specialConditions: [
      'Double Action ne permet jamais de tirer deux fois ; Téléportation ne réinitialise jamais le délai.',
      'Si un ennemi est collé à 1 case H/V et que le tir est prêt, vous choisissez librement Tir sur place OU Capture en avançant.',
    ],
    concreteExamples: [
      'Tour 1 : votre Arbalétrier tire à 3 cases en diagonale et abat un ennemi sans bouger. Tour 2 et Tour 3 : il se repositionne d’1 case H/V pendant la recharge. Tour 4 : le tir redevient prêt !',
    ],
    mistakesToAvoid: [
      'Croire que les tours de l’adversaire comptent dans les 3 tours de recharge.',
      'Tirer sur un pion sans Guetteur en espérant apprendre s’il est Colosse s’il survit : un tir bloqué garde son secret complet !',
    ],
    demoSteps: [
      {
        id: 'arbaletrier-step-1',
        stepTitle: '1. Tir dans les 8 directions (1–3 cases dégagées, reste sur place)',
        verdictBadge: 'AUTORISÉ',
        explanation: 'Tant que le tir est prêt et la ligne dégagée, vous frappez jusqu’à 3 cases (y compris en diagonale !) sans quitter votre case.',
        rows: 5,
        cols: 5,
        pieces: [
          { row: 3, col: 1, kind: 'arbaletrier', owner: 'red' },
          { row: 0, col: 4, kind: 'secret', owner: 'black' },
          { row: 2, col: 1, kind: 'soldat', owner: 'red' },
        ],
        highlights: [
          { row: 3, col: 1, kind: 'selected', tag: 'Tir PRÊT' },
          { row: 3, col: 0, kind: 'move' },
          { row: 3, col: 2, kind: 'move' },
          { row: 4, col: 1, kind: 'move' },
          { row: 0, col: 4, kind: 'attack', tag: 'Tir 3 cases' },
          { row: 1, col: 1, kind: 'forbidden', tag: 'Bloqué' },
        ],
        arrows: [{ from: { row: 3, col: 1 }, to: { row: 0, col: 4 }, kind: 'shoot' }],
      },
      {
        id: 'arbaletrier-step-2',
        stepTitle: '2. Cycle exact : Tour 1 Tir → Tour 2 (2T) → Tour 3 (1T) → Tour 4 Prêt',
        verdictBadge: 'CAPACITÉ',
        explanation: 'Pendant les 2 tours de recharge personnels, seul le déplacement normal d’1 case H/V reste utilisable.',
        rows: 5,
        cols: 5,
        pieces: [
          { row: 3, col: 1, kind: 'arbaletrier', owner: 'red' },
          { row: 1, col: 3, kind: 'secret', owner: 'black' },
        ],
        highlights: [
          { row: 3, col: 1, kind: 'mark', tag: 'Recharge 2T' },
          { row: 2, col: 1, kind: 'move' },
          { row: 3, col: 2, kind: 'move' },
          { row: 1, col: 3, kind: 'forbidden', tag: 'Tir verrouillé' },
        ],
      },
    ],
  },

  soldat: {
    id: 'soldat',
    name: 'Soldat',
    initialQuantity: ARMY_COMPOSITION.soldat,
    maxBoardCapLabel: `${ARMY_COMPOSITION.soldat} au départ (recrutable)`,
    linkedScenarioId: 'pions-et-promotion',
    role: 'Infanterie de base (9 exemplaires) destinée à ouvrir le terrain, protéger vos cadres et obtenir une Promotion majeure.',
    objective: 'Percer en diagonale, déclencher les pièges ou effets adverses et atteindre la rangée finale adverse pour se transformer en pièce d’élite.',
    movements: 'Avance d’1 case vers le camp opposé : tout droit (case libre uniquement) ou en diagonale avant gauche/droite.',
    attacks: 'Élimine uniquement en diagonale avant (1 case) — jamais tout droit !',
    restrictions: [
      'Ne peut jamais reculer (sauf carte Retreat).',
      'Ne capture jamais tout droit devant lui.',
      'Ne peut jamais être promu en Roi.',
    ],
    specialAbilities: 'Promotion : en atteignant la dernière rangée adverse, choisissez sa nouvelle identité parmi Guetteur H/D, Assassin, Cavalier, Berserker — et même Reine, Colosse, Traqueur, Exécuteur ou Arbalétrier si votre unique exemplaire a été éliminé ! De plus, seul le Soldat peut être ciblé par Sacrifice ou Recrutement.',
    specialConditions: [
      'Les pièces à plafond strict de 1 (Reine, Colosse, Traqueur, Exécuteur, Arbalétrier) n’apparaissent dans vos choix de promotion que lorsqu’elles sont à 0 exemplaire vivant sur le plateau.',
    ],
    concreteExamples: [
      'Un pion ennemi bloque votre avancée tout droit devant votre Soldat : votre Soldat ne peut pas le prendre tout droit, mais un Soldat voisin en diagonale peut le capturer.',
    ],
    mistakesToAvoid: [
      'Aligner un Soldat droit devant un ennemi en croyant le bloquer ou le manger en avant : seules ses diagonales avant attaquent.',
    ],
    demoSteps: [
      {
        id: 'soldat-step-1',
        stepTitle: '1. Avance tout droit sans capture / Attaque en diagonale avant',
        verdictBadge: 'AUTORISÉ',
        explanation: 'Un Soldat ne capture jamais tout droit devant lui : seules les deux diagonales avant permettent d’éliminer un ennemi.',
        rows: 5,
        cols: 5,
        pieces: [
          { row: 3, col: 2, kind: 'soldat', owner: 'red' },
          { row: 2, col: 2, kind: 'secret', owner: 'black' },
          { row: 2, col: 3, kind: 'secret', owner: 'black' },
        ],
        highlights: [
          { row: 3, col: 2, kind: 'selected' },
          { row: 2, col: 1, kind: 'move' },
          { row: 2, col: 3, kind: 'attack', tag: 'Capture diag' },
          { row: 2, col: 2, kind: 'forbidden', tag: 'Tout droit interdit' },
        ],
        arrows: [{ from: { row: 3, col: 2 }, to: { row: 2, col: 3 }, kind: 'attack' }],
      },
      {
        id: 'soldat-step-2',
        stepTitle: '2. Promotion en atteignant la dernière rangée adverse',
        verdictBadge: 'CAPACITÉ',
        explanation: 'Arrivé tout au bout, le Soldat devient au choix une pièce d’élite disponible.',
        rows: 5,
        cols: 5,
        pieces: [{ row: 1, col: 2, kind: 'soldat', owner: 'red' }],
        highlights: [
          { row: 1, col: 2, kind: 'selected' },
          { row: 0, col: 2, kind: 'mark', tag: 'PROMOTION !' },
        ],
        arrows: [{ from: { row: 1, col: 2 }, to: { row: 0, col: 2 }, kind: 'move' }],
      },
    ],
  },
};

export type LearnCategoryId =
  | 'regles_generales'
  | 'presentation_pieces'
  | 'deplacements'
  | 'attaques_captures'
  | 'regles_speciales'
  | 'situations_particulieres'
  | 'strategies_conseils'
  | 'exemples_parties';

export interface LearnCategoryMeta {
  readonly id: LearnCategoryId;
  readonly label: string;
  readonly icon: string;
  readonly summary: string;
}

export const LEARN_TO_PLAY_CATEGORIES: readonly LearnCategoryMeta[] = [
  {
    id: 'regles_generales',
    label: 'Règles générales',
    icon: '📜',
    summary: 'Plateau 9×9, placement secret initial des 27 pièces, objectif Roi et pendule.',
  },
  {
    id: 'presentation_pieces',
    label: 'Présentation des pièces',
    icon: '♟️',
    summary: 'Fiches détaillées et interactives pour chacune des 12 unités de BlindWar.',
  },
  {
    id: 'deplacements',
    label: 'Déplacements',
    icon: '🧭',
    summary: 'Règles exactes de trajectoires, sauts du Cavalier, restrictions et obstacles.',
  },
  {
    id: 'attaques_captures',
    label: 'Attaques et captures',
    icon: '⚔️',
    summary: 'Corps à corps, diagonale du Soldat, Tir d’arbalète, Frappe traversante et Armure.',
  },
  {
    id: 'regles_speciales',
    label: 'Règles spéciales',
    icon: '✨',
    summary: 'Identités cachées, Guetteurs, Marquage Traqueur, Colosse, Promotions et 16 Cartes.',
  },
  {
    id: 'situations_particulieres',
    label: 'Situations particulières',
    icon: '⚖️',
    summary: 'Tour Bonus 2+ éliminations, Kamikaze 2/2, Invincibilité/Protection, Répétition x5 et Pat.',
  },
  {
    id: 'strategies_conseils',
    label: 'Stratégies et conseils',
    icon: '🧠',
    summary: 'Couverture de reconnaissance, gestion du Brouillard, leurres du Roi et tempo.',
  },
  {
    id: 'exemples_parties',
    label: 'Exemples de parties',
    icon: '🎓',
    summary: 'Scénarios jouables guidés pour pratiquer chaque mécanique sur le véritable plateau.',
  },
];

export interface SpecialRuleTutorial {
  readonly id: string;
  readonly category: LearnCategoryId;
  readonly badge: string;
  readonly title: string;
  readonly summary: string;
  readonly relatedCharacterIds?: readonly CharacterType[];
  readonly relatedCards?: readonly CardType[];
  readonly linkedScenarioId?: string;
  readonly howItWorksSteps: readonly string[];
  readonly whenToUse: string;
  readonly conditions: readonly string[];
  readonly limits: readonly string[];
  readonly examples: readonly string[];
  readonly consequences: readonly string[];
  readonly demoSteps: readonly TutorialDiagramStep[];
}

export const SPECIAL_RULE_TUTORIALS: readonly SpecialRuleTutorial[] = [
  {
    id: 'rule-hidden-identity-and-placement',
    category: 'regles_generales',
    badge: '🕵️',
    title: 'Identités cachées & Placement secret initial (27 pièces)',
    summary: 'Les positions de chaque pion sur les 81 cases sont publiques, mais leur rôle ennemi reste masqué jusqu’à révélation.',
    howItWorksSteps: [
      '1. En début de partie, chaque joueur dispose secrètement ses 27 pièces sur ses 3 rangées arrière (90 secondes max, ou placement automatique à expiration).',
      '2. Sur l’échiquier, votre adversaire voit vos emplacements comme des jetons « ? » voilés — et inversement.',
      '3. Aucune identité non révélée n’est envoyée par le serveur aux joueurs avant une révélation réglementaire.',
    ],
    whenToUse: 'Dès la phase de préparation pour dissimuler votre Roi, excentrer l’Exécuteur ou piéger un axe avec un Soldat Kamikaze.',
    conditions: [
      'Les 27 pièces obligatoires (1 Roi, 1 Reine, 1 Colosse, 2 Cavaliers, 1 Berserker, 3 Assassins, 3 Guetteurs H, 3 Guetteurs D, 1 Traqueur, 1 Exécuteur, 1 Arbalétrier, 9 Soldats) doivent toutes être posées.',
    ],
    limits: [
      'Impossible d’espionner avant le premier tour ou de voir si un pion inconnu porte Protection ou Kamikaze.',
    ],
    examples: [
      'Placer un Guetteur D derrière deux Soldats en pointe pour démasquer le premier attaquant ennemi sans exposer votre Reine.',
    ],
    consequences: [
      'Un adversaire attaquant à l’aveugle risque de rebondir sur votre Colosse (et de vous le révéler gratuitement) ou de tomber sur Kamikaze !',
    ],
    linkedScenarioId: 'intro-plateau-roi',
    demoSteps: [
      {
        id: 'secret-demo-1',
        stepTitle: 'Vue asymétrique : vous voyez vos rôles, l’adversaire reste voilé « ? »',
        verdictBadge: 'EXEMPLE',
        explanation: 'Les pions adverses non révélés affichent le sceau « ? ». Déduisez ou révélez avec vos Guetteurs avant de frapper.',
        rows: 5,
        cols: 5,
        pieces: [
          { row: 0, col: 1, kind: 'secret', owner: 'black' },
          { row: 0, col: 3, kind: 'secret', owner: 'black' },
          { row: 3, col: 1, kind: 'guetteur_d', owner: 'red' },
          { row: 4, col: 2, kind: 'roi', owner: 'red' },
        ],
        highlights: [
          { row: 0, col: 1, kind: 'mark', tag: 'Caché' },
          { row: 0, col: 3, kind: 'mark', tag: 'Caché' },
          { row: 3, col: 1, kind: 'selected' },
        ],
      },
    ],
  },
  {
    id: 'rule-visibility-hierarchy',
    category: 'regles_speciales',
    badge: '👁️',
    title: 'Hiérarchie des Révélations (Guetteurs, Assassin, Brouillard & Espionnage)',
    summary: 'Toutes les sources de révélation et de camouflage suivent un ordre de priorité strict côté serveur.',
    relatedCharacterIds: ['guetteur_h', 'guetteur_d', 'assassin'],
    relatedCards: ['revelation_temporaire', 'revelation_permanente', 'espionnage', 'contre_espionnage', 'brouillard'],
    linkedScenarioId: 'recon-guetteurs',
    howItWorksSteps: [
      '1. Proximité (Guetteur H en H/V, Guetteur D en diagonale à 1 case) : révélation temporaire tant que le Guetteur reste vivant adjacent.',
      '2. Révélation temporaire (carte 👁️ ou attaque ratée sur Colosse) : dure 1 tour complet.',
      '3. Contre-espionnage (🕶️ sur 1 pièce, 3 tours) : bloque Guetteurs et Révélation temporaire.',
      '4. Espionnage (📡 jusqu’à 2 ennemis, 3 tours) : PERCE le Contre-espionnage.',
      '5. Brouillard (🌫️ toute votre armée, 3 tours) : bloque Guetteurs, Révélation temporaire ET Espionnage.',
      '6. Révélation définitive (Assassin tuant sa victime ou carte 🔍) : JAMAIS annulée, ni par Brouillard ni par Contre-espionnage.',
    ],
    whenToUse: 'Activez Brouillard pour casser un Marquage du Traqueur adverse ou masquer un siège devant vos lignes.',
    conditions: [
      'Chaque niveau supérieur neutralise ou contourne exactement les niveaux inférieurs selon l’ordre officiel.',
    ],
    limits: [
      'Un Guetteur H ne révèle que H/V (1 case) ; il ne traverse ni les cases vides au-delà de 1 case ni Brouillard.',
    ],
    examples: [
      'L’ennemi lance Contre-espionnage sur sa Reine puis croit être intouchable : votre carte Espionnage passe à travers et la révèle aussitôt pour votre Traqueur.',
    ],
    consequences: [
      'Dès qu’une cible redevient masquée (expiration ou Brouillard), tout marquage actif du Traqueur sur elle disparaît immédiatement.',
    ],
    demoSteps: [
      {
        id: 'vis-demo-1',
        stepTitle: '1. Guetteur H + Guetteur D dévoilent en croix et en diagonale',
        verdictBadge: 'CAPACITÉ',
        explanation: 'Un pion ennemi entrant dans le rayon orthogonal du Guetteur H ou diagonal du Guetteur D est immédiatement identifié.',
        rows: 5,
        cols: 5,
        pieces: [
          { row: 2, col: 2, kind: 'guetteur_h', owner: 'red' },
          { row: 1, col: 2, kind: 'reine', owner: 'black' },
          { row: 2, col: 3, kind: 'secret', owner: 'black' },
        ],
        highlights: [
          { row: 2, col: 2, kind: 'selected' },
          { row: 1, col: 2, kind: 'recon', tag: 'Reine vue!' },
          { row: 2, col: 3, kind: 'recon', tag: 'Identifié' },
          { row: 3, col: 2, kind: 'recon' },
          { row: 2, col: 1, kind: 'recon' },
        ],
      },
      {
        id: 'vis-demo-2',
        stepTitle: '2. Brouillard / Contre-espionnage recouvre la pièce temporairement',
        verdictBadge: 'INTERDIT',
        explanation: 'Sous Brouillard ou Contre-espionnage, l’ennemi redevient « ? » face aux Guetteurs et le Traqueur perd sa marque.',
        rows: 5,
        cols: 5,
        pieces: [
          { row: 2, col: 2, kind: 'guetteur_h', owner: 'red' },
          { row: 1, col: 2, kind: 'secret', owner: 'black' },
        ],
        highlights: [
          { row: 2, col: 2, kind: 'selected' },
          { row: 1, col: 2, kind: 'forbidden', tag: 'Brouillard' },
        ],
      },
    ],
  },
  {
    id: 'rule-colosse-kamikaze',
    category: 'regles_speciales',
    badge: '💥',
    title: `Colosse : Armure, Bascule d’extrémité & Règle des ${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD} Kamikazes`,
    summary: `Le Colosse résiste aux attaques normales et à l’Arbalétrier, mais tombe après ${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD} déclenchements de Kamikaze qu’il provoque lui-même.`,
    relatedCharacterIds: ['colosse'],
    relatedCards: ['kamikaze', 'protection', 'invincibilite'],
    linkedScenarioId: 'kamikaze-colosse-v2',
    howItWorksSteps: [
      '1. Progression : 5 directions vers l’avant/côtés ; arrivé tout au bout du plateau, il inverse son sens et reste révélé 1 tour complet.',
      '2. Seuls Roi, Reine, autre Colosse et la Frappe traversante de l’Exécuteur (en cible arrière) le tuent directement.',
      `3. Au 1er ennemi sous Kamikaze abattu par ce Colosse : le Kamikaze explose, le Colosse SURVIT à 1/${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}.`,
      `4. Au ${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}e ennemi sous Kamikaze abattu par ce même Colosse : le Colosse est ÉLIMINÉ (${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}/${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}).`,
    ],
    whenToUse: 'Placez deux cartes Kamikaze sur les pions situés sur le chemin d’un Colosse adverse hors de portée de votre Reine.',
    conditions: [
      'Le compteur n’augmente QUE pour les explosions Kamikaze déclenchées par le Colosse en attaquant lui-même.',
    ],
    limits: [
      'Un Kamikaze déclenché contre une autre pièce que le Colosse n’avance JAMAIS le compteur du Colosse.',
      'Le Colosse ne peut jamais recevoir Kamikaze, Protection, Invincibilité ni Résurrection.',
    ],
    examples: [
      'Votre Colosse mange un Soldat Kamikaze (compteur 1/2, survit), puis deux tours plus tard capture un Guetteur Kamikaze (compteur 2/2, éliminé).',
    ],
    consequences: [
      'Le compteur (0/2, 1/2) est persisté côté serveur et affiché dans le panneau gauche du propriétaire.',
    ],
    demoSteps: [
      {
        id: 'col-kam-1',
        stepTitle: 'Étape 1 : 1er Kamikaze provoqué par le Colosse → Survie (1/2)',
        verdictBadge: 'CAPACITÉ',
        explanation: 'L’ennemi Kamikaze explose mais le Colosse encaisse le choc et passe son compteur à 1/2.',
        rows: 5,
        cols: 5,
        pieces: [
          { row: 3, col: 2, kind: 'colosse', owner: 'red' },
          { row: 2, col: 2, kind: 'soldat', owner: 'black' },
        ],
        highlights: [
          { row: 3, col: 2, kind: 'selected', tag: '0/2 → 1/2' },
          { row: 2, col: 2, kind: 'attack', tag: 'Kamikaze 1' },
        ],
        arrows: [{ from: { row: 3, col: 2 }, to: { row: 2, col: 2 }, kind: 'attack' }],
      },
      {
        id: 'col-kam-2',
        stepTitle: 'Étape 2 : 2e Kamikaze provoqué par le Colosse → Élimination (2/2)',
        verdictBadge: 'EXEMPLE',
        explanation: 'Déjà entamé à 1/2, le Colosse ne survit pas à une seconde explosion Kamikaze et disparaît du plateau.',
        rows: 5,
        cols: 5,
        pieces: [
          { row: 2, col: 2, kind: 'colosse', owner: 'red' },
          { row: 1, col: 2, kind: 'berserker', owner: 'black' },
        ],
        highlights: [
          { row: 2, col: 2, kind: 'selected', tag: '1/2 → 2/2 KO' },
          { row: 1, col: 2, kind: 'attack', tag: 'Kamikaze 2' },
        ],
        arrows: [{ from: { row: 2, col: 2 }, to: { row: 1, col: 2 }, kind: 'attack' }],
      },
    ],
  },
  {
    id: 'rule-traqueur-marquage',
    category: 'regles_speciales',
    badge: '🎯',
    title: 'Ciblage sur l’échiquier (0 action) & Poursuite à 4 cases (Traqueur)',
    summary: 'Portée de base de 2 cases H/V ; cibler gratuitement sur l’échiquier un ennemi déjà identifié étend la Poursuite jusqu’à 4 cases.',
    relatedCharacterIds: ['traqueur'],
    linkedScenarioId: 'traqueur-marquage-poursuite',
    howItWorksSteps: [
      '1. Portée de base : le Traqueur se déplace et capture à 1 ou 2 cases orthogonalement sans obstacle.',
      '2. Vérifiez qu’un ennemi est DÉJÀ révélé et aligné H/V à 1–4 cases de votre Traqueur sans obstacle.',
      '3. Sélectionnez votre Traqueur → cliquez sur « Cibler (0 PA) » → cliquez directement sur l’ennemi révélé sur l’échiquier : la marque est posée gratuitement, vous gardez toute votre action du tour.',
      '4. Dès que la cible est traquée, la portée vers la direction qui rapproche de la cible augmente jusqu’à 4 cases H/V.',
    ],
    whenToUse: 'Dès qu’un Guetteur ou Espionnage dévoile une pièce majeure ennemie alignée jusqu’à 4 cases de votre Traqueur.',
    conditions: [
      'Cible strictement déjà révélée (jamais « ? »), alignée orthogonalement (1–4 cases) et sans obstacle.',
    ],
    limits: [
      'Sans cible traquée, la portée reste strictement bloquée à 2 cases H/V.',
      'À distance 3 ou 4, impossible d’éliminer une autre pièce que la cible marquée (et jamais un Colosse).',
      'Si la cible redevient masquée ou meurt, le marquage disparaît instantanément.',
    ],
    examples: [
      'Vous ciblez une Reine ennemie révélée à 4 cases sur l’échiquier (0 PA) — votre Traqueur fond immédiatement sur 4 cases et l’abat.',
    ],
    consequences: [
      'Le déplacement à distance 3 ou 4 consomme le marquage ; un trajet de 1–2 cases ou une Téléportation le conserve actif.',
    ],
    demoSteps: PIECE_TUTORIALS.traqueur.demoSteps,
  },
  {
    id: 'rule-executeur-piercing',
    category: 'attaques_captures',
    badge: '🪓',
    title: 'Frappe traversante de l’Exécuteur',
    summary: 'Frappe à exactement 2 cases derrière une pièce ennemie écran sans toucher la première pièce — perce même le Colosse.',
    relatedCharacterIds: ['executeur'],
    linkedScenarioId: 'executeur-frappe-traversante',
    howItWorksSteps: [
      '1. Alignement orthogonal exact requis : [Exécuteur] → [Ennemi 1 (≠ Colosse)] → [Ennemi 2].',
      '2. Cliquez sur la case d’Ennemi 2 : choisissez « Frappe traversante » si un choix s’affiche.',
      '3. L’Exécuteur reste sur sa case de départ ; Ennemi 1 reste intact sur sa case ; Ennemi 2 est éliminé !',
    ],
    whenToUse: 'Quand l’adversaire protège son Colosse ou son Roi derrière un simple Soldat aligné devant votre Exécuteur.',
    conditions: [
      'Exactement 1 pièce ennemie non-Colosse entre l’Exécuteur et la cible arrière sur la même ligne/colonne.',
    ],
    limits: [
      'Impossible à travers une pièce alliée, à travers 2 pièces ou si l’écran est un Colosse (un Colosse écran cache/bloque la frappe et est révélé 1 tour).',
    ],
    examples: [
      'Exécuteur en D3, Soldat ennemi en D4, Roi (ou Colosse) ennemi en D5 : cliquez D5 pour gagner ou abattre le Colosse sans déplacer D3 !',
    ],
    consequences: [
      'Si Ennemi 2 porte Kamikaze, son explosion atteint l’Exécuteur (sauf Protection) ; si Ennemi 2 porte Protection, sa Protection se brise.',
    ],
    demoSteps: PIECE_TUTORIALS.executeur.demoSteps,
  },
  {
    id: 'rule-arbaletrier-cadence',
    category: 'attaques_captures',
    badge: '🏹',
    title: 'Tir à distance & Cadence (1 tir / 3 tours personnels)',
    summary: 'Tir sur 1–3 cases dans les 8 directions suivi de 2 tours personnels d’attente obligatoire.',
    relatedCharacterIds: ['arbaletrier'],
    linkedScenarioId: 'arbaletrier-tir-cadence',
    howItWorksSteps: [
      '1. Tour 1 (Prêt) : visez une cible ennemie en ligne dégagée à 1, 2 ou 3 cases (8 directions) ; l’Arbalétrier ne se déplace pas.',
      '2. Tour 2 personnel : Tir indisponible (2 tours d’attente restants) — seul le pas d’1 case H/V est autorisé.',
      '3. Tour 3 personnel : Tir indisponible (1 tour d’attente restant).',
      '4. Tour 4 personnel : Le tir redevient disponible automatiquement !',
    ],
    whenToUse: 'Pour éliminer à distance sans subir de Piège sur la case ciblée ni bouger votre ligne de défense.',
    conditions: [
      'Ligne de visée totalement dégagée entre l’Arbalétrier et la cible.',
    ],
    limits: [
      'Les tours de l’adversaire ne font jamais avancer la recharge.',
      'Double Action ne permet jamais de tirer 2 fois ; Téléportation ne réinitialise jamais le compteur.',
      'Ne tue jamais le Colosse et ne révèle pas un Colosse inconnu s’il bloque le tir.',
    ],
    examples: [
      'Après un tir bloqué par Protection au Tour 1, la recharge démarre tout de même (2 tours d’attente).',
    ],
    consequences: [
      'Si la cible abattue à distance porte Kamikaze, l’explosion emporte aussi l’Arbalétrier (sauf Protection).',
    ],
    demoSteps: PIECE_TUTORIALS.arbaletrier.demoSteps,
  },
  {
    id: 'rule-cavalier-mobility',
    category: 'deplacements',
    badge: '🐴',
    title: 'Cavalier : Bond en « L » & Saut Percée sans pénalité',
    summary: 'Triple mobilité orthogonale/équestre permettant de sauter les obstacles et de déclencher un Tour Bonus à 2+ éliminations.',
    relatedCharacterIds: ['cavalier'],
    linkedScenarioId: 'cavalier-bond-et-percee',
    howItWorksSteps: [
      '1. Choisissez soit un pas simple de 1 case H/V, soit un Bond en « L » (2×1), soit un Saut Percée style dames au-dessus d’un ennemi adjacent vers la case vide derrière.',
      '2. Pendant un Bond en « L », vous survolez toutes les pièces (même le Colosse) et tous les pièges intermédiaires sans les déclencher.',
      '3. Pendant un Saut Percée, chaque ennemi sauté est éliminé et vous pouvez enchaîner ou cliquer « Terminer les sauts ».',
    ],
    whenToUse: 'Pour briser une défense verrouillée en début de partie sans aucun risque de pénalité en cas de coup pacifique.',
    conditions: [
      'Pour le Saut Percée, la case de réception immédiatement derrière l’ennemi doit être libre et l’ennemi sauté ne doit pas être un Colosse.',
    ],
    limits: [
      'Plus de déplacement d’1 case en diagonale.',
      'Ne peut tuer aucun Colosse directement.',
    ],
    examples: [
      'Double Saut Percée dans un même tour : 2 ennemis éliminés → Tour Bonus immédiat de 1 mouvement supplémentaire !',
    ],
    consequences: [
      'Seule la case d’arrivée d’un Bond en « L » peut déclencher un Piège.',
    ],
    demoSteps: PIECE_TUTORIALS.cavalier.demoSteps,
  },
  {
    id: 'rule-promotion-cap',
    category: 'regles_speciales',
    badge: '👑',
    title: 'Promotion du Soldat & Plafond strict de 1 exemplaire',
    summary: 'Tout Soldat parvenu sur la dernière rangée ennemie se transforme selon les plafonds actifs de votre armée.',
    relatedCharacterIds: ['soldat'],
    linkedScenarioId: 'pions-et-promotion',
    howItWorksSteps: [
      '1. Amenez un Soldat sur la dernière rangée du camp adverse (rangée 9 pour Rouge, rangée 1 pour Noir).',
      '2. Le moteur ouvre la fenêtre de promotion dès la fin du coup.',
      '3. Choisissez parmi Guetteur H/D, Assassin, Cavalier, Berserker — et parmi Reine, Colosse, Traqueur, Exécuteur, Arbalétrier uniquement si votre exemplaire initial est déjà mort.',
    ],
    whenToUse: 'Dès qu’un couloir s’ouvre, particulièrement pour ressusciter tactiquement votre Reine ou votre Exécuteur tombé.',
    conditions: [
      'Le Roi et le Soldat ne sont jamais sélectionnables en promotion.',
      'Les pièces uniques respectent toujours un plafond strict d’1 vivant sur le plateau.',
    ],
    limits: [
      'Si votre Colosse est promu sur la rangée finale, son sens initial pointe aussitôt vers le camp adverse (il repart dans l’autre sens).',
    ],
    examples: [
      'Votre Arbalétrier unique a été éliminé au tour 12 : au tour 20 votre Soldat atteint la ligne adverse → l’Arbalétrier réapparaît disponible dans les choix de promotion !',
    ],
    consequences: [
      'L’identité promue est conservée même si la pièce est plus tard ciblée par la carte Résurrection.',
    ],
    demoSteps: PIECE_TUTORIALS.soldat.demoSteps,
  },
  {
    id: 'rule-cards-and-draw',
    category: 'regles_speciales',
    badge: '🃏',
    title: 'Les 16 Cartes Tactiques & Pioche toutes les 3 éliminations',
    summary: 'Toute la gestion tactique des cartes : obtention, main de 3 max, visibilité secrète et interdictions.',
    relatedCards: CARD_TYPES,
    linkedScenarioId: 'cartes-tactiques-effet',
    howItWorksSteps: [
      '1. Toutes les 3 pièces ennemies éliminées, vous piochez 1 carte tactique (si vous avez < 3 cartes en main) ; la carte Sacrifice permet aussi de piocher sans compter vers ce palier.',
      '2. Jouer une carte ne consomme PAS votre action de déplacement du tour (sauf les restrictions explicites comme l’absence de carte en Tour Bonus).',
      '3. L’adversaire reçoit une alerte sur la carte utilisée mais ne connaît JAMAIS le pion ou la case secrète ciblée par Kamikaze, Protection, Invincibilité, Espionnage, Contre-espionnage ou Piège.',
    ],
    whenToUse: 'Avant ou entre vos attaques : par exemple Espionnage avant de marquer au Traqueur, ou Double Action pour enchaîner deux coups.',
    conditions: [
      'Kamikaze, Invincibilité et Protection sont interdits sur Roi et Colosse.',
      'Block possède un délai de recharge de 2 tours ; Recrutement et Sacrifice ciblent uniquement vos Soldats.',
      'Un Piège posé sur case vide affecte les pièces des DEUX camps (sauf en cas de survol en Bond L du Cavalier).',
    ],
    limits: [
      'Impossible de jouer 2 cartes pendant un tour sous Double Action, ni aucune carte durant un Tour Bonus.',
    ],
    examples: [
      'Activer Double Action puis déplacer votre Soldat vers la promotion (action 1) et frapper avec votre Reine (action 2).',
    ],
    consequences: [
      'Chaque carte consommée est enregistrée dans l’historique de partie visible depuis l’onglet Partie / Historique.',
    ],
    demoSteps: [
      {
        id: 'cards-demo-1',
        stepTitle: 'Combo Carte + Unité : Espionnage suivi d’un Marquage Traqueur',
        verdictBadge: 'CAPACITÉ',
        explanation: 'Révélez 1–2 cibles secrètes grâce à Espionnage (contournant Contre-espionnage), marquez aussitôt sans coût d’action et préparez la Poursuite !',
        rows: 5,
        cols: 5,
        pieces: [
          { row: 4, col: 2, kind: 'traqueur', owner: 'red' },
          { row: 2, col: 2, kind: 'reine', owner: 'black' },
          { row: 0, col: 4, kind: 'secret', owner: 'black' },
        ],
        highlights: [
          { row: 4, col: 2, kind: 'selected' },
          { row: 2, col: 2, kind: 'mark', tag: 'Espionnée + Marquée' },
          { row: 0, col: 4, kind: 'recon', tag: '2e cible libre' },
        ],
        arrows: [{ from: { row: 4, col: 2 }, to: { row: 2, col: 2 }, kind: 'pierce' }],
      },
    ],
  },
  {
    id: 'rule-bonus-turn-and-end',
    category: 'situations_particulieres',
    badge: '⚡',
    title: 'Tour Bonus (2+ éliminations), Répétitions (5x), Pat & Pendule',
    summary: 'Conditions exactes du Tour Bonus immédiat, de l’avertissement à 3 répétitions, du match nul et des fins de partie.',
    linkedScenarioId: 'gestion-tours-bonus',
    howItWorksSteps: [
      '1. Pénalité supprimée : 0 ou 1 élimination réelle rend toujours 1 action normale à l’adversaire.',
      '2. Tour Bonus : dès que vous éliminez 2+ ennemis réels dans un même tour (Double Action ou Saut Percée en chaîne), vous gagnez 1 Tour Bonus d’un seul déplacement (aucune carte autorisée, pas de 2e Tour Bonus enchaîné).',
      '3. Répétition : une alerte s’affiche à 3 occurrences identiques ; 5 répétitions déclenchent automatiquement un match nul.',
      '4. Pendule 10 min & Pat : manquer de temps (0:00), abandonner ou rester déconnecté > 60s entraîne la défaite ; aucun coup ni carte légale = match nul (Pat).',
    ],
    whenToUse: 'À calculer avant d’engager une double capture en Double Action ou en Saut Cavalier pour gagner une avance de temps décisive.',
    conditions: [
      'Seules les éliminations adverses réelles comptent (une attaque bloquée par Protection/Invincibilité/Colosse ou un Sacrifice allié ne compte jamais).',
    ],
    limits: [
      'Un Tour Bonus ne permet jamais de jouer une carte et ne peut pas déclencher un second Tour Bonus à la suite.',
    ],
    examples: [
      'Avec Double Action, votre Reine élimine 1 ennemi (action 1) puis votre Berserker en élimine un 2e (action 2) → vous obtenez immédiatement 1 déplacement bonus avant que l’adversaire ne joue !',
    ],
    consequences: [
      'Surveillez l’alerte Répétition (⚠️) en haut de l’écran en fin de partie serrée pour éviter le nul involontaire à 5/5.',
    ],
    demoSteps: [
      {
        id: 'turn-demo-1',
        stepTitle: '2+ éliminations dans un tour = Tour Bonus (1 déplacement gratuit)',
        verdictBadge: 'EXEMPLE',
        explanation: 'Enchaîner deux éliminations réelles déclenche un déplacement supplémentaire immédiat avant la main adverse.',
        rows: 5,
        cols: 5,
        pieces: [
          { row: 3, col: 1, kind: 'cavalier', owner: 'red' },
          { row: 2, col: 2, kind: 'soldat', owner: 'black' },
          { row: 0, col: 2, kind: 'assassin', owner: 'black' },
        ],
        highlights: [
          { row: 3, col: 1, kind: 'selected' },
          { row: 2, col: 2, kind: 'attack', tag: 'Kill #1' },
          { row: 1, col: 3, kind: 'jump' },
          { row: 0, col: 2, kind: 'attack', tag: 'Kill #2' },
          { row: 0, col: 0, kind: 'mark', tag: 'Tour Bonus!' },
        ],
        arrows: [
          { from: { row: 3, col: 1 }, to: { row: 1, col: 3 }, kind: 'move' },
          { from: { row: 1, col: 3 }, to: { row: 0, col: 1 }, kind: 'leap' },
        ],
      },
    ],
  },
  {
    id: 'rule-strategy-duo-scouts',
    category: 'strategies_conseils',
    badge: '🧠',
    title: 'Synergies gagnantes : Duo Guetteurs, Appât Colosse & Cadence',
    summary: 'Conseils tactiques avancés pour dominer l’information cachée et contrôler le plateau sans gaspiller vos cadres uniques.',
    howItWorksSteps: [
      '1. Associez Guetteur H et Guetteur D côte à côte : à eux deux, ils surveillent simultanément croix H/V et coins diagonaux tout en couvrant mutuellement leurs déplacements.',
      '2. Utilisez vos cartes Espionnage puis marquez avec le Traqueur le même tour : la Poursuite étend alors sa portée de 2 à 3 cases dès le tour suivant.',
      '3. Gardez toujours un œil sur les alignements H/V pour éviter une Frappe traversante fatale de l’Exécuteur sur votre Roi ou votre Colosse.',
    ],
    whenToUse: 'Pendant tout le milieu de partie pour prendre l’avantage informationnel avant les échanges directs.',
    conditions: [
      'Conservez au moins 1 Soldat en réserve arrière pour convertir une promotion en Reine ou Arbalétrier si votre exemplaire chute.',
    ],
    limits: [
      'Un adversaire averti sous Brouillard neutralise vos Guetteurs et Espionnages pendant 3 tours — gardez alors vos Assassins et Cavaliers en « L » actifs.',
    ],
    examples: [
      'Si l’adversaire pousse son Colosse très vite sans hésiter, posez Kamikaze sur deux défenseurs alignés sur sa trajectoire probable pour atteindre 2/2.',
    ],
    consequences: [
      'Un avantage d’information (3+ ennemis identifiés) vaut souvent plus qu’un échange de Soldat isolé.',
    ],
    demoSteps: [
      {
        id: 'strat-demo-1',
        stepTitle: 'Verrouillage combiné : Guetteur H + Guetteur D + Exécuteur',
        verdictBadge: 'EXEMPLE',
        explanation: 'Les Guetteurs identifient le duo ennemi aligné ; l’Exécuteur frappe la cible prioritaire derrière sans risquer sa case.',
        rows: 5,
        cols: 5,
        pieces: [
          { row: 2, col: 1, kind: 'guetteur_h', owner: 'red' },
          { row: 2, col: 2, kind: 'soldat', owner: 'black' },
          { row: 1, col: 2, kind: 'colosse', owner: 'black' },
          { row: 4, col: 2, kind: 'executeur', owner: 'red' },
        ],
        highlights: [
          { row: 2, col: 1, kind: 'recon' },
          { row: 4, col: 2, kind: 'selected' },
          { row: 2, col: 2, kind: 'recon', tag: 'Écran vu' },
          { row: 1, col: 2, kind: 'attack', tag: 'Cible Colosse!' },
        ],
        arrows: [{ from: { row: 4, col: 2 }, to: { row: 1, col: 2 }, kind: 'pierce' }],
      },
    ],
  },
];

function normalizeSearchText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Search pieces, special rule tutorials, and playable lessons cleanly across accents/case. */
export function filterTutorialsByQuery<T extends { readonly title?: string; readonly name?: string }>(
  items: readonly T[],
  query: string,
  extraTextFn?: (item: T) => string,
): T[] {
  const q = normalizeSearchText(query.trim());
  if (!q) return [...items];
  return items.filter((item) => {
    const haystack = normalizeSearchText(
      [item.title ?? '', item.name ?? '', extraTextFn ? extraTextFn(item) : ''].join(' '),
    );
    return haystack.includes(q);
  });
}
