import type { CharacterType, Coord } from '../types/core.js';
import { ARMY_COMPOSITION } from '../constants/army.js';
import { COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD } from '../constants/cards.js';

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
    role: 'Chasseur rapide orthogonal (1 exemplaire unique). Punit les cibles déjà identifiées.',
    objective: 'Marquer gratuitement une cible ennemie révélée pour débloquer dès votre tour suivant une percée ou capture à 4 cases vers elle.',
    movements: '1 à 3 cases horizontalement ou verticalement (ligne dégagée). Avec Poursuite prête : jusqu’à 4 cases vers la cible marquée uniquement.',
    attacks: 'Élimine jusqu’à 3 cases H/V (hors Colosse). À distance 4 (Poursuite), ne peut capturer QUE la cible marquée.',
    restrictions: [
      'Aucun déplacement en diagonale ni saut par-dessus une pièce.',
      'Impossible de marquer un ennemi encore inconnu (« ? ») ou derrière un obstacle.',
      'La Poursuite +1 case n’est jamais active le tour même où vous posez le marquage.',
      'Impossible d’abattre le Colosse (même avec Poursuite).',
    ],
    specialAbilities: 'Marquage (0 action) & Poursuite (+1 case = 4) : sélectionnez le Traqueur → cliquez « Marquer » (coûte 0 action) sur une cible DÉJÀ révélée alignée à 1–3 cases H/V → vous jouez votre coup normal du tour. Dès votre tour personnel suivant, la portée s’étend à 4 cases H/V dans la direction de rapprochement.',
    specialConditions: [
      'Un trajet de 1–3 cases conserve le marquage ; un trajet à distance 4 le consomme.',
      'Si la cible meurt ou redevient cachée (Brouillard, sortie de zone d’un Guetteur, fin d’Espionnage), le marquage disparaît instantanément.',
      'Le marquage reste invisible/secret pour votre adversaire.',
    ],
    concreteExamples: [
      'Tour 1 : votre Guetteur révèle la Reine noire à 2 cases de votre Traqueur → marquez-la gratuitement, puis jouez. Tour 2 : la Reine s’enfuit à 4 cases → votre Traqueur fond dessus en 4 cases et l’abat !',
    ],
    mistakesToAvoid: [
      'Oublier qu’une pièce doit être préalablement identifiée pour être marquée (Guetteur, Espionnage, Révélation ou Colosse révélé).',
      'Croire que la Poursuite 4 cases permet de tuer une autre pièce que la cible marquée ou un Colosse.',
    ],
    demoSteps: [
      {
        id: 'traqueur-step-1',
        stepTitle: 'Étape 1 (Tour N) : Marquage gratuit (0 action) d’une cible révélée 1–3 cases H/V',
        verdictBadge: 'CAPACITÉ',
        explanation: 'Un Guetteur ou une carte révèle un ennemi aligné à 1–3 cases sans obstacle : marquez-le sans consommer votre tour.',
        rows: 5,
        cols: 5,
        pieces: [
          { row: 4, col: 2, kind: 'traqueur', owner: 'red' },
          { row: 2, col: 2, kind: 'berserker', owner: 'black' },
        ],
        highlights: [
          { row: 4, col: 2, kind: 'selected' },
          { row: 3, col: 2, kind: 'move' },
          { row: 2, col: 2, kind: 'mark', tag: 'Marqué 0 PA' },
        ],
        arrows: [{ from: { row: 4, col: 2 }, to: { row: 2, col: 2 }, kind: 'attack' }],
      },
      {
        id: 'traqueur-step-2',
        stepTitle: 'Étape 2 (Tour N+1) : Poursuite étendue à 4 cases vers la cible marquée',
        verdictBadge: 'EXEMPLE',
        explanation: 'Même si la cible marquée recule à distance 4, votre Traqueur s’élance sur 4 cases H/V dès votre tour suivant et l’élimine !',
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
          { row: 4, col: 0, kind: 'move' },
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
