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
    badge: 'Traqueur • Ciblage & Poursuite',
    title: 'Ciblage sur l’échiquier (0 action) + Poursuite jusqu’à 4 cases',
    message:
      'Portée de base : 1–2 cases H/V. Cliquez sur « 🎯 Cibler » puis cliquez directement sur un ennemi révélé (1–4 cases H/V) sur l’échiquier (gratuit : 0 PA) pour étendre votre portée jusqu’à 4 cases vers cette cible !',
    relatedCharacter: 'traqueur',
  },
  ctx_cavalier_rework: {
    id: 'ctx_cavalier_rework',
    badge: 'Cavalier • Mobilité',
    title: '1 case H/V, Bond en « L » par-dessus tout, ou Percée en chaîne',
    message:
      'Le Cavalier dispose du Bond en « L » (2+1 cases) : il saute au-dessus de n’importe quel pion ou piège intermédiaire sans déclencher les pièges survolés ! Il conserve 1 case H/V et ses sauts Percée en chaîne style dames.',
    relatedCharacter: 'cavalier',
  },
  ctx_executeur_pierce: {
    id: 'ctx_executeur_pierce',
    badge: 'Exécuteur • Frappe Traversante',
    title: 'Percer le bouclier frontal pour abattre la pièce derrière',
    message:
      'Lorsque l’Exécuteur fait face à un ennemi (non-Colosse) dont la case juste derrière est occupée par un second ennemi, il élimine uniquement la cible arrière (y compris un Colosse !) et reste sur sa case.',
    relatedCharacter: 'executeur',
  },
  ctx_colossus_selected: {
    id: 'ctx_colossus_selected',
    badge: 'Colosse • Unité Blindée',
    title: 'Force frontale et règle des 2 Kamikazes',
    message:
      'Le Colosse avance dans 5 directions, bascule de sens au bout du plateau et résiste aux attaques ordinaires. Seuls le Roi, la Reine, un autre Colosse, la Frappe Traversante arrière de l’Exécuteur ou 2 déclenchements Kamikaze qu’il provoque peuvent l’abattre.',
    relatedCharacter: 'colosse',
  },
};

export function getAllContextualTips(): readonly ContextualTipSpec[] {
  return Object.values(CONTEXTUAL_TIPS);
}

/**
 * Selects AT MOST ONE contextual tip introducing a concrete special mechanic in play.
 * Never shows generic turn/placement noise and respects dismissed IDs strictly.
 */
export function selectContextualTip(params: {
  readonly view: ClientMatchView;
  readonly selectedPiece: ClientPieceView | null;
  readonly dismissedIds: readonly string[];
  readonly enabled: boolean;
}): ContextualTipSpec | null {
  const { view, selectedPiece, dismissedIds, enabled } = params;
  if (!enabled || view.phase !== 'playing') {
    return null;
  }

  const dismissed = new Set(dismissedIds);
  const pick = (id: string): ContextualTipSpec | null =>
    dismissed.has(id) ? null : CONTEXTUAL_TIPS[id] ?? null;

  // Prioritize active/selected special mechanics, strictly 1 window.
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

  return null;
}
