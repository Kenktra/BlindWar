import React from 'react';
import {
  CARD_CATALOG,
  CARD_DOSSIERS,
  CHARACTER_CATALOG,
  getCardUsageDetails,
  type CardType,
} from '../../../shared/src/index.js';
import { CardArtwork } from './CardArtwork.js';

export interface CardDescriptionPanelProps {
  readonly card: CardType;
  readonly compact?: boolean;
  readonly hidePlayActionsNote?: boolean;
  readonly footer?: React.ReactNode;
}

/**
 * Detailed tactical card preview & description component (§6):
 * displays the themed transparent vector illustration, name, effect,
 * usage conditions, restrictions, and gameplay particularities cleanly across desktop/tablet/mobile.
 */
export const CardDescriptionPanel: React.FC<CardDescriptionPanelProps> = ({
  card,
  compact = false,
  footer,
}) => {
  const dossier = CARD_DOSSIERS[card];
  const meta = CARD_CATALOG[card];
  const details = getCardUsageDetails(card);

  return (
    <div
      className={`bw-card-dossier-panel${compact ? ' bw-card-dossier-compact' : ''}`}
      data-card-dossier={card}
    >
      <div className="bw-card-dossier-header">
        <div className="bw-card-dossier-artbox">
          <CardArtwork card={card} size={compact ? 'lg' : 'xl'} framed />
        </div>
        <div className="bw-card-dossier-titles">
          <h3 className="bw-card-dossier-title">{dossier.name}</h3>
          <div className="bw-card-dossier-badges">
            <span className="bw-dossier-pill">⏱️ {dossier.durationLabel}</span>
            <span className="bw-dossier-pill">
              {meta.isTargetSecretToOpponent ? '🔒 Cible secrète' : '👁️ Effet public'}
            </span>
          </div>
          <p className="bw-card-dossier-vis-note">{dossier.visibilityLabel}</p>
        </div>
      </div>

      <div className="bw-card-dossier-section">
        <div className="bw-dossier-label">Effet officiel</div>
        <p className="bw-dossier-text">{dossier.effectDescription}</p>
      </div>

      <div className="bw-card-dossier-cols">
        <div className="bw-card-dossier-section">
          <div className="bw-dossier-label">Conditions d’utilisation</div>
          <ul className="bw-dossier-list">
            {details.usageConditions.map((cond, idx) => (
              <li key={idx}>{cond}</li>
            ))}
          </ul>
        </div>

        <div className="bw-card-dossier-section">
          <div className="bw-dossier-label">Restrictions</div>
          {meta.forbiddenOnCharacters.length > 0 && (
            <p className="bw-card-restriction-inline">
              ⛔ Interdit sur :{' '}
              {meta.forbiddenOnCharacters.map((ch) => CHARACTER_CATALOG[ch].name).join(', ')}.
            </p>
          )}
          <ul className="bw-dossier-list">
            {details.restrictions.map((rest, idx) => (
              <li key={idx}>{rest}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bw-card-dossier-section">
        <div className="bw-dossier-label">Particularités & interactions</div>
        <ul className="bw-dossier-list">
          {details.particularities.map((part, idx) => (
            <li key={idx}>{part}</li>
          ))}
        </ul>
      </div>

      {footer && <div className="bw-card-dossier-footer">{footer}</div>}
    </div>
  );
};
