import React from 'react';
import {
  CHARACTER_CATALOG,
  CHARACTER_DOSSIERS,
  COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD,
  coordToNotation,
  type CharacterType,
  type ClientPieceView,
  type Coord,
  type MatchPhase,
  type PlayerColor,
} from '../../../shared/src/index.js';
import { PieceArtwork } from './PieceArtwork.js';

export interface PieceDescriptionPanelProps {
  readonly viewerColor: PlayerColor;
  readonly phase: MatchPhase;
  readonly inspectedCoord: Coord | null;
  readonly piece: ClientPieceView | null;
  readonly placementBrushChar?: CharacterType | null;
  readonly compact?: boolean;
  readonly onClearSelection?: () => void;
}

const REVEAL_KIND_LABELS: Readonly<Record<ClientPieceView['revealKind'], string>> = {
  none: 'Identité secrète',
  temporary: 'Révélation temporaire',
  proximity: 'Repérée par Guetteur',
  permanent: 'Révélation définitive',
};

export const PieceDescriptionPanel: React.FC<PieceDescriptionPanelProps> = ({
  viewerColor,
  phase,
  inspectedCoord,
  piece,
  placementBrushChar = null,
  compact = false,
  onClearSelection,
}) => {
  const activePlacementChar = phase === 'placement' && !piece ? placementBrushChar : null;

  if (!piece && !activePlacementChar) {
    return (
      <section
        className={`bw-panel bw-piece-dossier-panel bw-piece-dossier-idle${compact ? ' bw-piece-dossier-compact' : ''}`}
        aria-label="Description de la pièce sélectionnée"
      >
        <div className="bw-piece-dossier-idle-inner">
          <PieceArtwork character="secret" owner="neutral" size="md" title="Pièce non sélectionnée" />
          <div>
            <h3 className="bw-piece-dossier-heading">Fiche de pièce</h3>
            <p className="bw-piece-dossier-empty-text">
              Cliquez sur un pion pour afficher ses déplacements, attaques et capacités.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (piece && piece.character === null) {
    const coord = inspectedCoord ?? piece.position;
    const isEnemyRed = piece.owner === 'red';
    return (
      <section
        className={`bw-panel bw-piece-dossier-panel bw-piece-dossier-secret${compact ? ' bw-piece-dossier-compact' : ''}`}
        aria-label="Description de la pièce sélectionnée"
      >
        <div className="bw-piece-dossier-header">
          <div className="bw-piece-dossier-artbox">
            <PieceArtwork
              character="secret"
              owner={piece.owner}
              coord={coord}
              size={compact ? 'sm' : 'md'}
              title="Unité adverse à identité secrète"
            />
          </div>
          <div className="bw-piece-dossier-titles">
            <div className="bw-piece-dossier-name-row">
              <h3 className="bw-piece-dossier-title">Unité adverse secrète</h3>
              {onClearSelection && (
                <button
                  type="button"
                  className="bw-btn bw-btn-ghost bw-btn-xs"
                  onClick={onClearSelection}
                  aria-label="Désélectionner la pièce"
                >
                  ✕
                </button>
              )}
            </div>
            <p className="bw-piece-dossier-role">Identité non révélée</p>
            <div className="bw-piece-dossier-badges">
              <span className="bw-dossier-pill">Case {coordToNotation(coord)}</span>
              <span className="bw-dossier-pill">{isEnemyRed ? 'Camp Rouge' : 'Camp Noir'}</span>
              <span className="bw-dossier-pill bw-dossier-pill-muted">Identité masquée</span>
            </div>
          </div>
        </div>

        {(piece.isInvincible ||
          piece.isImmobilized ||
          piece.traqueurMarkedByViewer ||
          piece.isExposedByEnemyEspionage) && (
          <div className="bw-piece-dossier-status-row">
            {piece.isInvincible && (
              <span className="bw-dossier-status bw-status-warn">Invincible</span>
            )}
            {piece.isImmobilized && (
              <span className="bw-dossier-status bw-status-danger">Immobilisée</span>
            )}
            {piece.traqueurMarkedByViewer && (
              <span className="bw-dossier-status bw-status-info">Marquée par votre Traqueur</span>
            )}
            {piece.isExposedByEnemyEspionage && (
              <span className="bw-dossier-status bw-status-info">Espionnée</span>
            )}
          </div>
        )}

        <div className="bw-piece-dossier-section">
          <div className="bw-dossier-label">Confidentialité</div>
          <p className="bw-dossier-text">
            Type, mouvements et protections secrètes masqués jusqu’à révélation (reconnaissance alliée, Espionnage ou Révélation).
          </p>
        </div>
      </section>
    );
  }

  const charId: CharacterType = piece ? piece.character! : activePlacementChar!;
  const owner: PlayerColor = piece ? piece.owner : viewerColor;
  const dossier = CHARACTER_DOSSIERS[charId];
  const catalog = CHARACTER_CATALOG[charId];
  const coord = piece ? (inspectedCoord ?? piece.position) : null;
  const isAlly = owner === viewerColor;

  return (
    <section
      className={`bw-panel bw-piece-dossier-panel${compact ? ' bw-piece-dossier-compact' : ''}`}
      aria-label="Description de la pièce sélectionnée"
    >
      <div className="bw-piece-dossier-header">
        <div className="bw-piece-dossier-artbox">
          <PieceArtwork
            character={charId}
            owner={owner}
            coord={coord ?? undefined}
            size={compact ? 'sm' : 'md'}
            title={dossier.name}
          />
        </div>
        <div className="bw-piece-dossier-titles">
          <div className="bw-piece-dossier-name-row">
            <h3 className="bw-piece-dossier-title">{dossier.name}</h3>
            {onClearSelection && (
              <button
                type="button"
                className="bw-btn bw-btn-ghost bw-btn-xs"
                onClick={onClearSelection}
                aria-label="Désélectionner la pièce"
              >
                ✕
              </button>
            )}
          </div>
          <p className="bw-piece-dossier-role">{dossier.roleSummary}</p>
          <div className="bw-piece-dossier-badges">
            <span className="bw-dossier-pill">
              {coord ? `Case ${coordToNotation(coord)}` : 'Placement'}
            </span>
            <span className="bw-dossier-pill">
              {owner === 'red' ? 'Rouge' : 'Noir'}
            </span>
            <span className="bw-dossier-pill bw-dossier-pill-muted">
              {dossier.initialQuantity}/27
            </span>
          </div>
        </div>
      </div>

      {piece && (
        <div className="bw-piece-dossier-status-row">
          <span className="bw-dossier-status bw-status-neutral">
            {isAlly ? 'Alliée' : REVEAL_KIND_LABELS[piece.revealKind]}
          </span>
          {piece.isInvincible && (
            <span className="bw-dossier-status bw-status-warn">Invincible</span>
          )}
          {piece.isImmobilized && (
            <span className="bw-dossier-status bw-status-danger">Immobilisée</span>
          )}
          {piece.isProtectedVisible && (
            <span className="bw-dossier-status bw-status-ok">Protection active</span>
          )}
          {piece.hasKamikazeVisible && (
            <span className="bw-dossier-status bw-status-danger">Kamikaze armé</span>
          )}
          {piece.hasCounterEspionageVisible && (
            <span className="bw-dossier-status bw-status-info">Contre-espionnage</span>
          )}
          {piece.isExposedByEnemyEspionage && (
            <span className="bw-dossier-status bw-status-warn">Espionnée</span>
          )}
          {piece.traqueurMarkedByViewer && (
            <span className="bw-dossier-status bw-status-info">Cible marquée</span>
          )}
          {piece.character === 'colosse' && piece.kamikazeHitsTakenVisible !== null && (
            <span className="bw-dossier-status bw-status-warn">
              Kamikaze encaissés : {piece.kamikazeHitsTakenVisible}/{COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}
            </span>
          )}
          {isAlly && piece.character === 'traqueur' && (
            <span className="bw-dossier-status bw-status-info">
              {piece.traqueurHasActiveMarkVisible
                ? piece.traqueurPursuitReadyVisible
                  ? 'Poursuite (+1) prête'
                  : 'Poursuite au tour suivant'
                : 'Marquage (0 action) prêt'}
            </span>
          )}
          {isAlly && piece.character === 'arbaletrier' && (
            <span className="bw-dossier-status bw-status-info">
              {piece.arbaletrierCooldownTurnsVisible && piece.arbaletrierCooldownTurnsVisible > 0
                ? `Tir en recharge : ${piece.arbaletrierCooldownTurnsVisible} tour(s) perso`
                : 'Tir à distance prêt (1 / 3 tours)'}
            </span>
          )}
        </div>
      )}

      <div className="bw-piece-dossier-grid">
        <div className="bw-piece-dossier-duo">
          <div className="bw-piece-dossier-section">
            <div className="bw-dossier-label">Déplacements</div>
            <p className="bw-dossier-text">{dossier.movementSummary}</p>
          </div>
          <div className="bw-piece-dossier-section">
            <div className="bw-dossier-label">
              Attaques {catalog.canKillColossus ? '• Tue Colosse' : ''}
            </div>
            <p className="bw-dossier-text">{dossier.attackSummary}</p>
          </div>
        </div>

        <div className="bw-piece-dossier-section">
          <div className="bw-dossier-label">Capacité spéciale</div>
          <p className="bw-dossier-text">{dossier.specialAbility}</p>
        </div>

        {!compact && (dossier.interactionsSummary.length > 0 || dossier.restrictions.length > 0) && (
          <details className="bw-piece-dossier-details">
            <summary className="bw-dossier-details-summary">
              Règles, interactions & restrictions ({dossier.interactionsSummary.length + dossier.restrictions.length})
            </summary>
            <div className="bw-piece-dossier-details-body">
              {dossier.interactionsSummary.length > 0 && (
                <div className="bw-piece-dossier-section">
                  <div className="bw-dossier-label">Particularités & interactions</div>
                  <ul className="bw-dossier-list">
                    {dossier.interactionsSummary.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {dossier.restrictions.length > 0 && (
                <div className="bw-piece-dossier-section">
                  <div className="bw-dossier-label">Restrictions</div>
                  <ul className="bw-dossier-list">
                    {dossier.restrictions.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </details>
        )}

        {compact && dossier.restrictions.length > 0 && (
          <div className="bw-piece-dossier-section">
            <div className="bw-dossier-label">Restrictions</div>
            <ul className="bw-dossier-list">
              {dossier.restrictions.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
};
