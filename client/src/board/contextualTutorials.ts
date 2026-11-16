import type {
  CharacterType,
  ClientMatchView,
  ClientPieceView,
} from '../../../shared/src/index.js';

export interface ContextualTipSpec {
  readonly id: string;
  readonly title: string;
  readonly badge: string;
  readonly message: string;
  readonly relatedCharacter?: CharacterType;
}

const CONTEXTUAL_TIPS: Readonly<Record<string, ContextualTipSpec>> = {
  ctx_placement: {
    id: 'ctx_placement',
    badge: 'Phase de Placement',
    title: 'Déploiement secret de votre armée (27 pions)',
    message:
      'Disposez vos 27 pions dans vos 3 rangées arrière. Toutes vos identités sont cachées à l’adversaire tant qu’aucune reconnaissance ou capacité ne les dévoile.',
  },
  ctx_bonus_turn: {
    id: 'ctx_bonus_turn',
    badge: 'Tour Bonus Débloqué',
    title: 'Règle des Tours Bonus (2+ éliminations)',
    message:
      'Vous venez d’éliminer au moins 2 pièces adverses dans le même tour ! Vous obtenez automatiquement 1 Tour Bonus (1 déplacement supplémentaire, aucune carte jouable pendant ce Tour Bonus).',
  },
  ctx_arbaletrier_cooldown: {
    id: 'ctx_arbaletrier_cooldown',
    badge: 'Arbalétrier • Cadence',
    title: 'Tir à distance : 1 tir tous les 3 tours personnels',
    message:
      'L’Arbalétrier tire jusqu’à 3 cases en ligne droite (8 dir.) sans traverser les obstacles ni se déplacer. Après un tir, il recharge pendant 2 de vos propres tours (prêt au 3e). Pendant la recharge, il peut se déplacer de 1 case H/V.',
    relatedCharacter: 'arbaletrier',
  },
  ctx_traqueur_guide: {
    id: 'ctx_traqueur_guide',
    badge: 'Traqueur • Marquage & Poursuite',
    title: 'Marquage (0 action) + Poursuite +1 case au tour suivant',
    message:
      'Sélectionnez un ennemi avec « Marquer une cible » (gratuit : ne consomme pas votre tour). Vous pouvez encore jouer normalement ce tour-ci, et dès votre TOUR SUIVANT le Traqueur gagnera +1 case en Poursuite uniquement pour éliminer cette cible.',
    relatedCharacter: 'traqueur',
  },
  ctx_cavalier_rework: {
    id: 'ctx_cavalier_rework',
    badge: 'Cavalier • Rework',
    title: '1 case H/V, Bond en « L » par-dessus tout, ou Percée en chaîne',
    message:
      'Le Cavalier dispose désormais du Bond en « L » (2+1 cases) : il saute au-dessus de n’importe quel pion ou piège intermédiaire sans déclencher les pièges survolés ! Il conserve 1 case H/V et ses sauts Percée en chaîne style dames. 0 élimination n’entraîne plus aucune pénalité.',
    relatedCharacter: 'cavalier',
  },
  ctx_executeur_pierce: {
    id: 'ctx_executeur_pierce',
    badge: 'Exécuteur • Frappe Traversante',
    title: 'Percer le bouclier frontal pour abattre la pièce derrière',
    message:
      'Lorsque l’Exécuteur avance de 1 case H/V contre un ennemi dont la case juste derrière est occupée par un autre ennemi, il élimine uniquement la cible arrière (même si la pièce frontale est un Colosse !) et reste sur sa case.',
    relatedCharacter: 'executeur',
  },
  ctx_colossus_selected: {
    id: 'ctx_colossus_selected',
    badge: 'Colosse • Unité Blindée',
    title: 'Force frontale et vulnérabilités spécifiques',
    message:
      'Le Colosse se déplace jusqu’à 2 cases et résiste aux attaques ordinaires. Il ne peut être vaincu que par le Roi, la Reine, une Bombe, un Piège, Trahison, Sacrifice, la Frappe Traversante arrière de l’Exécuteur ou 2 cartes Kamikaze cumulées.',
    relatedCharacter: 'colosse',
  },
  ctx_cards_secret: {
    id: 'ctx_cards_secret',
    badge: 'Cartes Tactiques',
    title: 'Nouvelle carte en main (pioche toutes les 3 éliminations)',
    message:
      'Vous avez une carte tactique ! Jouez-la AVANT votre déplacement durant un tour normal (jamais pendant un Tour Bonus). Limite stricte : 3 cartes en main maximum.',
  },
  ctx_turn_rules: {
    id: 'ctx_turn_rules',
    badge: 'Gestion des Tours',
    title: 'Cadence standard : 0 ou 1 élimination = 1 action',
    message:
      'À votre tour, vous jouez 1 action (éventuellement précédée de cartes). Terminer avec 0 ou 1 élimination passe normalement la main à l’adversaire ; atteindre 2+ éliminations dans le tour déclenche 1 Tour Bonus.',
  },
};

export function getAllContextualTips(): readonly ContextualTipSpec[] {
  return Object.values(CONTEXTUAL_TIPS);
}

/**
 * Selects AT MOST ONE contextual tip matching the exact situation in play.
 * Never stacks multiple overlays and respects dismissed IDs strictly.
 */
export function selectContextualTip(params: {
  readonly view: ClientMatchView;
  readonly selectedPiece: ClientPieceView | null;
  readonly dismissedIds: readonly string[];
  readonly enabled: boolean;
}): ContextualTipSpec | null {
  const { view, selectedPiece, dismissedIds, enabled } = params;
  if (!enabled || view.phase === 'finished') {
    return null;
  }

  const dismissed = new Set(dismissedIds);
  const pick = (id: string): ContextualTipSpec | null =>
    dismissed.has(id) ? null : CONTEXTUAL_TIPS[id] ?? null;

  if (view.phase === 'placement') {
    return pick('ctx_placement');
  }

  // Playing phase: prioritize active/selected contextual events, strictly 1 window.
  if (view.turn.isBonusTurn) {
    const bonusTip = pick('ctx_bonus_turn');
    if (bonusTip) return bonusTip;
  }

  if (selectedPiece && selectedPiece.owner === view.viewerColor && selectedPiece.character) {
    switch (selectedPiece.character) {
      case 'arbaletrier': {
        const tip = pick('ctx_arbaletrier_cooldown');
        if (tip) return tip;
        break;
      }
      case 'traqueur': {
        const tip = pick('ctx_traqueur_guide');
        if (tip) return tip;
        break;
      }
      case 'cavalier': {
        const tip = pick('ctx_cavalier_rework');
        if (tip) return tip;
        break;
      }
      case 'executeur': {
        const tip = pick('ctx_executeur_pierce');
        if (tip) return tip;
        break;
      }
      case 'colosse': {
        const tip = pick('ctx_colossus_selected');
        if (tip) return tip;
        break;
      }
      default:
        break;
    }
  }

  if (view.ownHand.length > 0 && view.turn.activePlayer === view.viewerColor) {
    const cardTip = pick('ctx_cards_secret');
    if (cardTip) return cardTip;
  }

  if (view.turn.turnNumber >= 1 && view.turn.activePlayer === view.viewerColor) {
    const turnTip = pick('ctx_turn_rules');
    if (turnTip) return turnTip;
  }

  return null;
}
