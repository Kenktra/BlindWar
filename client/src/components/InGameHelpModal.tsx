import React, { useMemo, useState } from 'react';
import {
  CARD_DOSSIERS,
  CARD_TYPES,
  CHARACTER_TYPES,
  FAQ_ITEMS,
  PIECE_TUTORIALS,
  RULE_SECTIONS,
  SETTINGS_HELP_ITEMS,
  SPECIAL_RULE_TUTORIALS,
  filterTutorialsByQuery,
  type CharacterType,
  type PlayerColor,
} from '../../../shared/src/index.js';
import { InteractiveBoardDiagram } from './InteractiveBoardDiagram.js';
import { PieceArtwork, PieceDualVariantPreview } from './PieceArtwork.js';

export type InGameHelpTabId = 'rules' | 'characters' | 'mechanics' | 'faq';

export interface InGameHelpModalProps {
  readonly isOpen: boolean;
  readonly viewerColor: PlayerColor;
  readonly initialTab?: InGameHelpTabId;
  readonly dismissedContextualCount: number;
  readonly canResetContextualTips: boolean;
  readonly onResetContextualTips: () => void;
  readonly onClose: () => void;
}

export const InGameHelpModal: React.FC<InGameHelpModalProps> = ({
  isOpen,
  viewerColor,
  initialTab = 'characters',
  dismissedContextualCount,
  canResetContextualTips,
  onResetContextualTips,
  onClose,
}) => {
  const [tab, setTab] = useState<InGameHelpTabId>(initialTab);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedChar, setSelectedChar] = useState<CharacterType>('traqueur');

  const matchingPieces = useMemo(
    () =>
      filterTutorialsByQuery(
        CHARACTER_TYPES.map((c) => PIECE_TUTORIALS[c]),
        searchQuery,
        (p) =>
          [
            p.role,
            p.movements,
            p.attacks,
            p.specialAbilities,
            ...p.specialConditions,
            ...p.restrictions,
          ].join(' '),
      ),
    [searchQuery],
  );

  const matchingSpecialRules = useMemo(
    () =>
      filterTutorialsByQuery(SPECIAL_RULE_TUTORIALS, searchQuery, (r) =>
        [r.summary, ...r.howItWorksSteps, ...r.conditions, ...r.limits].join(' '),
      ),
    [searchQuery],
  );

  const matchingCards = useMemo(
    () =>
      filterTutorialsByQuery(
        CARD_TYPES.map((id) => CARD_DOSSIERS[id]),
        searchQuery,
        (c) => [c.effectDescription, c.durationLabel, ...c.restrictions].join(' '),
      ),
    [searchQuery],
  );

  if (!isOpen) return null;

  const activePiece =
    matchingPieces.find((p) => p.id === selectedChar) ??
    matchingPieces[0] ??
    PIECE_TUTORIALS[selectedChar];

  return (
    <div
      className="bw-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Aide tactique et règles en cours de partie"
      onClick={onClose}
    >
      <div className="bw-modal-dialog bw-ingame-help-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="bw-modal-header">
          <div>
            <h2>📖 Aide en Partie — Règles, Pièces & Capacités</h2>
            <p className="bw-muted-small" style={{ margin: '0.15rem 0 0' }}>
              Votre partie reste intacte et continue en arrière-plan sans interruption.
            </p>
          </div>
          <button
            type="button"
            className="bw-btn bw-btn-ghost bw-btn-sm"
            onClick={onClose}
          >
            ✕ Fermer
          </button>
        </div>

        <div className="bw-ingame-help-search-row">
          <input
            type="search"
            className="bw-learn-search-input"
            value={searchQuery}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              if (val.trim().length > 0 && matchingPieces.length === 0 && matchingSpecialRules.length > 0) {
                setTab('mechanics');
              }
            }}
            placeholder="Rechercher une pièce ou une règle (ex : Exécuteur, Colosse, Kamikaze, Brouillard…)"
            aria-label="Rechercher une pièce ou règle pendant la partie"
          />
          {searchQuery && (
            <button
              type="button"
              className="bw-btn bw-btn-ghost bw-btn-xs"
              onClick={() => setSearchQuery('')}
            >
              ✕
            </button>
          )}
        </div>

        <div className="bw-modal-tabs">
          <button
            type="button"
            className={`bw-btn bw-btn-sm ${tab === 'characters' ? 'bw-btn-primary' : 'bw-btn-secondary'}`}
            onClick={() => setTab('characters')}
          >
            ♟️ 12 Pièces ({matchingPieces.length})
          </button>
          <button
            type="button"
            className={`bw-btn bw-btn-sm ${tab === 'mechanics' ? 'bw-btn-primary' : 'bw-btn-secondary'}`}
            onClick={() => setTab('mechanics')}
          >
            ✨ Règles spéciales ({matchingSpecialRules.length})
          </button>
          <button
            type="button"
            className={`bw-btn bw-btn-sm ${tab === 'rules' ? 'bw-btn-primary' : 'bw-btn-secondary'}`}
            onClick={() => setTab('rules')}
          >
            📜 Règles générales
          </button>
          <button
            type="button"
            className={`bw-btn bw-btn-sm ${tab === 'faq' ? 'bw-btn-primary' : 'bw-btn-secondary'}`}
            onClick={() => setTab('faq')}
          >
            🃏 16 Cartes & FAQ ({matchingCards.length})
          </button>
          {canResetContextualTips && dismissedContextualCount > 0 && (
            <button
              type="button"
              className="bw-btn bw-btn-ghost bw-btn-sm"
              onClick={onResetContextualTips}
            >
              ↺ Réactiver guides auto ({dismissedContextualCount})
            </button>
          )}
        </div>

        <div className="bw-modal-body">
          {tab === 'characters' && (
            matchingPieces.length === 0 ? (
              <p className="bw-muted-small">Aucune pièce trouvée pour « {searchQuery} ».</p>
            ) : (
              <div className="bw-ingame-pieces-view">
                <div className="bw-ingame-piece-pills">
                  {matchingPieces.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`bw-learn-piece-chip${activePiece.id === p.id ? ' active' : ''}`}
                      onClick={() => setSelectedChar(p.id)}
                    >
                      <PieceArtwork character={p.id} owner={viewerColor} size="xs" />
                      <span>{p.name}</span>
                    </button>
                  ))}
                </div>

                <div className="bw-rule-block">
                  <div className="bw-learn-piece-head-left" style={{ marginBottom: '0.65rem' }}>
                    <PieceArtwork character={activePiece.id} owner={viewerColor} size="lg" />
                    <div>
                      <h3 style={{ margin: 0 }}>
                        {activePiece.name} ({activePiece.initialQuantity}/27)
                      </h3>
                      <p className="bw-muted-small" style={{ margin: '0.15rem 0 0' }}>
                        {activePiece.role}
                      </p>
                    </div>
                  </div>

                  <PieceDualVariantPreview character={activePiece.id} size="xs" />

                  <div style={{ marginTop: '0.65rem' }}>
                    <InteractiveBoardDiagram steps={activePiece.demoSteps} compact viewerColor={viewerColor} />
                  </div>

                  <div className="bw-learn-9points-grid" style={{ marginTop: '0.75rem' }}>
                    <div className="bw-learn-point-box">
                      <strong>Déplacements</strong>
                      <p>{activePiece.movements}</p>
                    </div>
                    <div className="bw-learn-point-box">
                      <strong>Attaques</strong>
                      <p>{activePiece.attacks}</p>
                    </div>
                    <div className="bw-learn-point-box">
                      <strong>Capacité spéciale</strong>
                      <p>{activePiece.specialAbilities}</p>
                    </div>
                    <div className="bw-learn-point-box">
                      <strong>Conditions d’utilisation</strong>
                      <ul>
                        {activePiece.specialConditions.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="bw-learn-point-box">
                      <strong>Restrictions</strong>
                      <ul>
                        {activePiece.restrictions.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="bw-learn-point-box bw-learn-point-warn">
                      <strong>Erreurs à éviter</strong>
                      <ul>
                        {activePiece.mistakesToAvoid.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )
          )}

          {tab === 'mechanics' && (
            matchingSpecialRules.length === 0 ? (
              <p className="bw-muted-small">Aucune règle spéciale ne correspond à « {searchQuery} ».</p>
            ) : (
              matchingSpecialRules.map((mech) => (
                <div key={mech.id} className="bw-rule-block">
                  <h3>
                    {mech.badge} {mech.title}
                  </h3>
                  <p>{mech.summary}</p>
                  <InteractiveBoardDiagram steps={mech.demoSteps} compact viewerColor={viewerColor} />
                  <ul style={{ marginTop: '0.55rem' }}>
                    {mech.howItWorksSteps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                    <li>
                      <strong>Conditions :</strong> {mech.conditions.join(' • ')}
                    </li>
                    <li>
                      <strong>Limites :</strong> {mech.limits.join(' • ')}
                    </li>
                  </ul>
                </div>
              ))
            )
          )}

          {tab === 'rules' &&
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

          {tab === 'faq' && (
            <>
              <div className="bw-rule-block">
                <h3>🃏 16 Cartes Tactiques ({matchingCards.length})</h3>
                <ul>
                  {matchingCards.map((c) => (
                    <li key={c.id}>
                      <strong>
                        {c.badge} {c.name} ({c.durationLabel}) :
                      </strong>{' '}
                      {c.effectDescription}
                      {c.restrictions.length > 0 && (
                        <span className="bw-muted-small"> — {c.restrictions[0]}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bw-rule-block">
                <h3>❓ Questions fréquentes (FAQ)</h3>
                {FAQ_ITEMS.map((faq) => (
                  <div key={faq.id} style={{ marginBottom: '0.75rem' }}>
                    <strong>{faq.question}</strong>
                    <p className="bw-muted-small" style={{ marginTop: '0.18rem' }}>
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
  );
};
