import React, { useMemo, useState } from 'react';
import {
  CARD_DOSSIERS,
  CHARACTER_TYPES,
  LEARN_TO_PLAY_CATEGORIES,
  PIECE_TUTORIALS,
  RULE_SECTIONS,
  SPECIAL_RULE_TUTORIALS,
  TUTORIAL_SCENARIOS,
  filterTutorialsByQuery,
  type CardType,
  type CharacterType,
  type LearnCategoryId,
} from '../../../shared/src/index.js';
import { CardArtwork } from './CardArtwork.js';
import { CardDescriptionPanel } from './CardDescriptionPanel.js';
import { InteractiveBoardDiagram } from './InteractiveBoardDiagram.js';
import { PieceArtwork } from './PieceArtwork.js';

export interface LearnToPlayHubProps {
  readonly completedTutorialIds: readonly string[];
  readonly dismissedContextualCount: number;
  readonly enableContextualTutorials: boolean;
  readonly onToggleContextualTutorials: () => void;
  readonly onResetContextualTips: () => void;
  readonly onStartScenario: (scenarioIndex: number) => void;
}

export const LearnToPlayHub: React.FC<LearnToPlayHubProps> = ({
  completedTutorialIds,
  dismissedContextualCount,
  enableContextualTutorials,
  onToggleContextualTutorials,
  onResetContextualTips,
  onStartScenario,
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | LearnCategoryId>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPieceId, setSelectedPieceId] = useState<CharacterType>('traqueur');
  const [selectedRuleCardId, setSelectedRuleCardId] = useState<CardType>('espionnage');

  const scenarioIndexById = useMemo(
    () => new Map(TUTORIAL_SCENARIOS.map((s, idx) => [s.id, idx])),
    [],
  );

  const filteredPieces = useMemo(
    () =>
      filterTutorialsByQuery(
        CHARACTER_TYPES.map((c) => PIECE_TUTORIALS[c]),
        searchQuery,
        (p) =>
          [
            p.role,
            p.objective,
            p.movements,
            p.attacks,
            p.specialAbilities,
            ...p.restrictions,
            ...p.specialConditions,
            ...p.concreteExamples,
            ...p.mistakesToAvoid,
          ].join(' '),
      ),
    [searchQuery],
  );

  const filteredSpecialRules = useMemo(() => {
    const byCat =
      activeCategory === 'all'
        ? SPECIAL_RULE_TUTORIALS
        : SPECIAL_RULE_TUTORIALS.filter((r) => r.category === activeCategory);
    return filterTutorialsByQuery(byCat, searchQuery, (r) =>
      [
        r.summary,
        r.whenToUse,
        ...r.howItWorksSteps,
        ...r.conditions,
        ...r.limits,
        ...r.examples,
        ...r.consequences,
      ].join(' '),
    );
  }, [activeCategory, searchQuery]);

  const filteredScenarios = useMemo(
    () =>
      filterTutorialsByQuery(TUTORIAL_SCENARIOS, searchQuery, (s) =>
        [s.themeTitle, s.subtitle, s.objectiveDescription, ...s.coachingTips].join(' '),
      ),
    [searchQuery],
  );

  const activePieceTutorial =
    filteredPieces.find((p) => p.id === selectedPieceId) ??
    filteredPieces[0] ??
    PIECE_TUTORIALS[selectedPieceId];

  const showGeneralRules =
    activeCategory === 'all' || activeCategory === 'regles_generales';
  const showPieces =
    activeCategory === 'all' || activeCategory === 'presentation_pieces';
  const showSpecialRules =
    activeCategory === 'all' ||
    activeCategory === 'regles_generales' ||
    activeCategory === 'deplacements' ||
    activeCategory === 'attaques_captures' ||
    activeCategory === 'regles_speciales' ||
    activeCategory === 'situations_particulieres' ||
    activeCategory === 'strategies_conseils';
  const showScenarios =
    activeCategory === 'all' || activeCategory === 'exemples_parties';

  return (
    <section className="bw-panel-page bw-learn-hub" aria-label="Apprendre à jouer à BlindWar">
      <div className="bw-learn-hero-bar">
        <div>
          <h2>🎓 Apprendre à jouer — Guide Complet & Tutoriels</h2>
          <p className="bw-muted-small">
            Explorez chaque pièce, chaque règle spéciale de BlindWar avec démonstrations visuelles et{' '}
            <strong>
              {completedTutorialIds.length}/{TUTORIAL_SCENARIOS.length}
            </strong>{' '}
            leçons interactives sur plateau.
          </p>
        </div>

        <div className="bw-learn-search-wrap">
          <input
            type="search"
            className="bw-learn-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une pièce, règle, capacité (ex : Colosse, Frappe, Cadence…)"
            aria-label="Rechercher dans les tutoriels et règles"
          />
          {searchQuery && (
            <button
              type="button"
              className="bw-btn bw-btn-ghost bw-btn-xs"
              onClick={() => setSearchQuery('')}
            >
              ✕ Effacer
            </button>
          )}
        </div>
      </div>

      {/* Catégories officielles §3.4 */}
      <div className="bw-learn-categories-bar" role="tablist" aria-label="Catégories d'apprentissage">
        <button
          type="button"
          role="tab"
          aria-selected={activeCategory === 'all'}
          className={`bw-learn-cat-btn${activeCategory === 'all' ? ' active' : ''}`}
          onClick={() => setActiveCategory('all')}
        >
          📚 Tout voir
        </button>
        {LEARN_TO_PLAY_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={activeCategory === cat.id}
            className={`bw-learn-cat-btn${activeCategory === cat.id ? ' active' : ''}`}
            onClick={() => setActiveCategory(cat.id)}
            title={cat.summary}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Contrôle Aides contextuelles */}
      <div className="bw-panel bw-tutorial-controls-panel">
        <div className="bw-tutorial-controls-row">
          <div>
            <strong>Aides contextuelles en partie :</strong>{' '}
            <span className="bw-muted-small">
              {enableContextualTutorials
                ? 'Activées (affiche 1 guide ciblé selon la pièce sélectionnée ou l’événement).'
                : 'Désactivées (réactivables à tout moment).'}
            </span>
          </div>
          <div className="bw-form-actions">
            <button
              type="button"
              className={`bw-btn bw-btn-sm ${enableContextualTutorials ? 'bw-btn-secondary' : 'bw-btn-primary'}`}
              onClick={onToggleContextualTutorials}
            >
              {enableContextualTutorials
                ? '🔕 Désactiver les guides auto'
                : '🔔 Activer les guides auto'}
            </button>
            <button
              type="button"
              className="bw-btn bw-btn-ghost bw-btn-sm"
              disabled={dismissedContextualCount === 0}
              onClick={onResetContextualTips}
            >
              ↺ Réactiver conseils vus ({dismissedContextualCount})
            </button>
          </div>
        </div>
      </div>

      {/* Règles Générales synthétiques */}
      {showGeneralRules && searchQuery.trim() === '' && (
        <div className="bw-learn-section">
          <h3>📜 Règles générales essentielles</h3>
          <div className="bw-learn-general-grid">
            {RULE_SECTIONS.map((sec) => (
              <article key={sec.id} className="bw-panel bw-rule-block">
                <h4>{sec.title}</h4>
                <p>{sec.summary}</p>
                <ul>
                  {sec.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* Tutoriels Individuels des 12 Pièces (§3.1) */}
      {showPieces && (
        <div className="bw-learn-section">
          <div className="bw-learn-section-head">
            <h3>♟️ Tutoriels individuels des 12 pièces ({filteredPieces.length})</h3>
            <span className="bw-muted-small">
              Sélectionnez une unité pour voir ses 9 points clés et ses démonstrations interactives :
            </span>
          </div>

          {filteredPieces.length === 0 ? (
            <p className="bw-muted-small">Aucune pièce ne correspond à « {searchQuery} ».</p>
          ) : (
            <div className="bw-learn-pieces-split">
              <div className="bw-learn-piece-selector" role="listbox" aria-label="Liste des 12 pièces">
                {filteredPieces.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={activePieceTutorial.id === p.id}
                    className={`bw-learn-piece-chip${activePieceTutorial.id === p.id ? ' active' : ''}`}
                    onClick={() => setSelectedPieceId(p.id)}
                  >
                    <PieceArtwork character={p.id} owner="red" size="sm" />
                    <span className="bw-learn-piece-chip-info">
                      <strong>{p.name}</strong>
                      <small>{p.initialQuantity}/27</small>
                    </span>
                  </button>
                ))}
              </div>

              <article className="bw-panel bw-learn-piece-card">
                <div className="bw-learn-piece-card-head">
                  <div className="bw-learn-piece-head-left">
                    <PieceArtwork character={activePieceTutorial.id} owner="red" size="lg" />
                    <div>
                      <h4>
                        {activePieceTutorial.name} ({activePieceTutorial.initialQuantity}/27)
                      </h4>
                      <span className="bw-mode-pill">{activePieceTutorial.maxBoardCapLabel}</span>
                    </div>
                  </div>
                  {scenarioIndexById.has(activePieceTutorial.linkedScenarioId) && (
                    <button
                      type="button"
                      className="bw-btn bw-btn-primary bw-btn-sm"
                      onClick={() =>
                        onStartScenario(scenarioIndexById.get(activePieceTutorial.linkedScenarioId)!)
                      }
                    >
                      ▶ Pratiquer sur le plateau
                    </button>
                  )}
                </div>

                <InteractiveBoardDiagram steps={activePieceTutorial.demoSteps} />

                <div className="bw-learn-9points-grid">
                  <div className="bw-learn-point-box">
                    <strong>1. Rôle</strong>
                    <p>{activePieceTutorial.role}</p>
                  </div>
                  <div className="bw-learn-point-box">
                    <strong>2. Objectif</strong>
                    <p>{activePieceTutorial.objective}</p>
                  </div>
                  <div className="bw-learn-point-box">
                    <strong>3. Déplacements</strong>
                    <p>{activePieceTutorial.movements}</p>
                  </div>
                  <div className="bw-learn-point-box">
                    <strong>4. Attaques & captures</strong>
                    <p>{activePieceTutorial.attacks}</p>
                  </div>
                  <div className="bw-learn-point-box">
                    <strong>5. Restrictions</strong>
                    <ul>
                      {activePieceTutorial.restrictions.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="bw-learn-point-box">
                    <strong>6. Capacités particulières</strong>
                    <p>{activePieceTutorial.specialAbilities}</p>
                  </div>
                  <div className="bw-learn-point-box">
                    <strong>7. Conditions spéciales</strong>
                    <ul>
                      {activePieceTutorial.specialConditions.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="bw-learn-point-box">
                    <strong>8. Exemples concrets</strong>
                    <ul>
                      {activePieceTutorial.concreteExamples.map((ex, i) => (
                        <li key={i}>{ex}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="bw-learn-point-box bw-learn-point-warn">
                    <strong>9. Erreurs à éviter</strong>
                    <ul>
                      {activePieceTutorial.mistakesToAvoid.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            </div>
          )}
        </div>
      )}

      {/* Tutoriels Détaillés des Règles Spéciales (§3.2) */}
      {showSpecialRules && (
        <div className="bw-learn-section">
          <h3>✨ Tutoriels détaillés des règles spéciales ({filteredSpecialRules.length})</h3>
          {filteredSpecialRules.length === 0 ? (
            <p className="bw-muted-small">Aucune règle trouvée dans cette sélection.</p>
          ) : (
            <div className="bw-learn-rules-list">
              {filteredSpecialRules.map((rule) => (
                <article key={rule.id} className="bw-panel bw-learn-special-card">
                  <div className="bw-learn-special-head">
                    <div className="bw-learn-special-title-row">
                      <span className="bw-learn-special-badge">{rule.badge}</span>
                      <div>
                        <h4>{rule.title}</h4>
                        <p className="bw-muted-small">{rule.summary}</p>
                      </div>
                    </div>
                    {rule.linkedScenarioId && scenarioIndexById.has(rule.linkedScenarioId) && (
                      <button
                        type="button"
                        className="bw-btn bw-btn-secondary bw-btn-sm"
                        onClick={() =>
                          onStartScenario(scenarioIndexById.get(rule.linkedScenarioId!)!)
                        }
                      >
                        ▶ Essayer en leçon interactive
                      </button>
                    )}
                  </div>

                  {rule.demoSteps.length > 0 && (
                    <InteractiveBoardDiagram steps={rule.demoSteps} />
                  )}

                  {rule.relatedCards && rule.relatedCards.length > 0 && (
                    <div className="bw-learn-cards-strip">
                      <div className="bw-learn-cards-pills" role="list" aria-label="Cartes illustrées associées">
                        {rule.relatedCards.map((cid) => {
                          const isSelected = selectedRuleCardId === cid;
                          return (
                            <button
                              key={`${rule.id}-${cid}`}
                              type="button"
                              className={`bw-learn-piece-chip${isSelected ? ' active' : ''}`}
                              onClick={() => setSelectedRuleCardId(cid)}
                            >
                              <CardArtwork card={cid} size="sm" framed />
                              <span>{CARD_DOSSIERS[cid].name}</span>
                            </button>
                          );
                        })}
                      </div>
                      {rule.relatedCards.includes(selectedRuleCardId) && (
                        <CardDescriptionPanel card={selectedRuleCardId} compact />
                      )}
                    </div>
                  )}

                  <div className="bw-learn-rule-cols">
                    <div className="bw-learn-point-box">
                      <strong>Fonctionnement pas à pas</strong>
                      <ul>
                        {rule.howItWorksSteps.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="bw-learn-point-box">
                      <strong>Quand l’utiliser & Conditions</strong>
                      <p>{rule.whenToUse}</p>
                      <ul>
                        {rule.conditions.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="bw-learn-point-box">
                      <strong>Limites & Exemples</strong>
                      <ul>
                        {rule.limits.map((l, i) => (
                          <li key={i}>{l}</li>
                        ))}
                        {rule.examples.map((ex, i) => (
                          <li key={`ex-${i}`}>
                            <em>Exemple :</em> {ex}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bw-learn-point-box">
                      <strong>Conséquences possibles</strong>
                      <ul>
                        {rule.consequences.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Leçons interactives jouables (§3.4 Exemples de parties) */}
      {showScenarios && (
        <div className="bw-learn-section">
          <h3>🎓 Leçons pratiques sur véritable plateau ({filteredScenarios.length})</h3>
          {filteredScenarios.length === 0 ? (
            <p className="bw-muted-small">Aucune leçon ne correspond à votre recherche.</p>
          ) : (
            <div className="bw-menu-grid">
              {filteredScenarios.map((scen) => {
                const globalIdx = scenarioIndexById.get(scen.id) ?? 0;
                const isDone = completedTutorialIds.includes(scen.id);
                return (
                  <div
                    key={scen.id}
                    className={`bw-menu-card ${isDone ? 'bw-tutorial-card-done' : ''} ${scen.isNewUpdate ? 'bw-tutorial-card-new' : ''}`}
                  >
                    <div className="bw-tutorial-card-badges">
                      <span className="bw-mode-pill">{scen.themeTitle}</span>
                      {isDone && <span className="bw-badge-done">✅ Validée</span>}
                      {scen.relatedCharacterIds && (
                        <span className="bw-tutorial-chars-pill">
                          {scen.relatedCharacterIds.map((ch) => (
                            <PieceArtwork key={ch} character={ch} owner="red" size="xs" />
                          ))}
                        </span>
                      )}
                    </div>
                    <h4>{scen.title}</h4>
                    <p>{scen.subtitle}</p>
                    <button
                      type="button"
                      className={`bw-btn ${isDone ? 'bw-btn-secondary' : 'bw-btn-primary'}`}
                      onClick={() => onStartScenario(globalIdx)}
                    >
                      {isDone
                        ? `↻ Rejouer la Leçon #${scen.stepNumber}`
                        : `▶ Jouer la Leçon #${scen.stepNumber}`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
