import React, { useState } from 'react';
import {
  CARD_DOSSIERS,
  CHARACTER_DOSSIERS,
  DEFAULT_THEME_ID,
  getThemeDefinition,
  type CharacterType,
  type Coord,
} from '../../../shared/src/index.js';
import type { ClientUserProfile } from '../services/apiClient.js';
import { useOptionalBlindWarTheme } from '../themes/themeManager.js';
import { CardArtwork } from './CardArtwork.js';
import { PieceArtwork } from './PieceArtwork.js';

export interface HomeLandingPageProps {
  readonly userProfile: ClientUserProfile | null;
  readonly onPlayLocal: () => void;
  readonly onOpenMatchmaking: () => void;
  readonly onOpenCustomCreate: () => void;
  readonly onOpenTutorial: () => void;
  readonly onOpenLeaderboard: () => void;
  readonly onOpenProfileOrAuth: () => void;
  readonly onOpenRegister: () => void;
  readonly onOpenCharacters: () => void;
  readonly onOpenCards: () => void;
  readonly onOpenRules: () => void;
  readonly onOpenSettings: () => void;
}

interface LandingBoardSample {
  readonly coord: Coord;
  readonly kind: CharacterType | 'secret';
  readonly owner: 'red' | 'black';
  readonly label: string;
  readonly summary: string;
}

const LANDING_BOARD_SAMPLES: readonly LandingBoardSample[] = [
  {
    coord: { row: 0, col: 0 },
    kind: 'secret',
    owner: 'black',
    label: 'Unité adverse masquée',
    summary: 'Votre adversaire voit les positions, jamais les rôles non révélés.',
  },
  {
    coord: { row: 0, col: 3 },
    kind: 'arbaletrier',
    owner: 'black',
    label: 'Arbalétrier ennemi repéré',
    summary: 'Identifié par reconnaissance : tire à distance une fois tous les 3 tours.',
  },
  {
    coord: { row: 1, col: 2 },
    kind: 'guetteur_h',
    owner: 'red',
    label: 'Guetteur H allié',
    summary: 'Sonde les lignes orthogonales pour percer le brouillard ennemi.',
  },
  {
    coord: { row: 2, col: 1 },
    kind: 'traqueur',
    owner: 'red',
    label: 'Traqueur allié',
    summary: 'Marque une cible ennemie repérée pour foncer à 4 cases au tour suivant.',
  },
  {
    coord: { row: 3, col: 2 },
    kind: 'roi',
    owner: 'red',
    label: 'Roi allié',
    summary: 'Cœur de votre armée : protégez-le tout en traquant le Roi adverse.',
  },
];

const FEATURED_ROLES: readonly CharacterType[] = [
  'roi',
  'reine',
  'traqueur',
  'executeur',
  'arbaletrier',
  'colosse',
  'assassin',
  'guetteur_h',
];

const FEATURED_CARDS = [
  CARD_DOSSIERS.espionnage,
  CARD_DOSSIERS.kamikaze,
  CARD_DOSSIERS.invincibilite,
  CARD_DOSSIERS.piege,
] as const;

export const HomeLandingPage: React.FC<HomeLandingPageProps> = ({
  userProfile,
  onPlayLocal,
  onOpenMatchmaking,
  onOpenCustomCreate,
  onOpenTutorial,
  onOpenLeaderboard,
  onOpenProfileOrAuth,
  onOpenRegister,
  onOpenCharacters,
  onOpenCards,
  onOpenRules,
  onOpenSettings,
}) => {
  const themeCtx = useOptionalBlindWarTheme();
  const boardTheme = themeCtx?.boardTheme ?? getThemeDefinition(DEFAULT_THEME_ID);
  const [selectedSampleCoord, setSelectedSampleCoord] = useState<string>('3,2');

  const sampleByKey = new Map<string, LandingBoardSample>(
    LANDING_BOARD_SAMPLES.map((s) => [`${s.coord.row},${s.coord.col}`, s]),
  );
  const activeSample = sampleByKey.get(selectedSampleCoord) ?? LANDING_BOARD_SAMPLES[4]!;

  return (
    <div className="bw-landing-page">
      {/* HERO STRATÉGIQUE SPLIT */}
      <section className="bw-landing-hero" aria-label="Présentation de BLIND WAR">
        <div className="bw-landing-hero-copy">
          <div className="bw-landing-eyebrow">
            <PieceArtwork character="roi" owner="red" size="xs" />
            <span>STRATÉGIE COMPÉTITIVE 9×9 • IDENTITÉS SECRÈTES</span>
          </div>

          <h1 className="bw-landing-title">BLIND WAR</h1>
          <p className="bw-landing-lead">
            Chaque armée déploie <strong>27 unités sur un échiquier 9×9</strong>. Toutes les
            positions sont visibles, mais l’identité ennemie reste secrète : déduisez, bluffez,
            révélez grâce à vos Guetteurs et abattez le Roi adverse.
          </p>

          {userProfile ? (
            <div className="bw-landing-commander-bar">
              <span>
                Commandant actif : <strong>{userProfile.displayName ?? userProfile.username}</strong>{' '}
                • <span className="bw-landing-elo-tag">{userProfile.eloRating} ELO</span>
              </span>
              <button type="button" className="bw-btn bw-btn-ghost bw-btn-xs" onClick={onOpenProfileOrAuth}>
                Voir mon profil →
              </button>
            </div>
          ) : (
            <div className="bw-landing-commander-bar bw-landing-commander-guest">
              <span>Créez un compte pour jouer en mode Classé ELO et sauvegarder vos records.</span>
              <button type="button" className="bw-btn bw-btn-ghost bw-btn-xs" onClick={onOpenRegister}>
                Inscription rapide →
              </button>
            </div>
          )}

          {/* ACTIONS PRINCIPALES */}
          <div className="bw-landing-cta-primary">
            <button
              type="button"
              className="bw-btn bw-btn-primary bw-btn-lg"
              onClick={onOpenMatchmaking}
            >
              🌐 Rejoindre une partie / Matchmaking
            </button>
            <button
              type="button"
              className="bw-btn bw-btn-secondary bw-btn-lg"
              onClick={onPlayLocal}
            >
              ⚔️ Jouer en Local (2 Joueurs)
            </button>
          </div>

          {/* RACCOURCIS RAPIDES (§5.2) */}
          <div className="bw-landing-quick-actions" role="navigation" aria-label="Accès rapides">
            <button
              type="button"
              className="bw-landing-quick-btn"
              onClick={onOpenCustomCreate}
            >
              🛠️ Créer une partie personnalisée
            </button>
            <button
              type="button"
              className="bw-landing-quick-btn"
              onClick={onOpenMatchmaking}
            >
              🎯 Jouer contre un adversaire
            </button>
            <button
              type="button"
              className="bw-landing-quick-btn"
              onClick={onOpenTutorial}
            >
              🎓 Tutoriel interactif
            </button>
            <button
              type="button"
              className="bw-landing-quick-btn"
              onClick={onOpenLeaderboard}
            >
              🏆 Classements ELO
            </button>
            <button
              type="button"
              className="bw-landing-quick-btn"
              onClick={onOpenProfileOrAuth}
            >
              {userProfile ? '👤 Mon Profil' : '🔐 Connexion / Profil'}
            </button>
          </div>
        </div>

        {/* APERÇU TACTIQUE LIVE RESPECTANT LE THÈME ACTIF */}
        <div className="bw-landing-showcase-card" aria-label="Aperçu interactif du plateau Blind War">
          <div className="bw-landing-showcase-top">
            <div>
              <span className="bw-landing-showcase-kicker">Aperçu tactique en direct</span>
              <h2 className="bw-landing-showcase-heading">
                Thème : {boardTheme.name}
              </h2>
            </div>
            <button
              type="button"
              className="bw-btn bw-btn-ghost bw-btn-xs"
              onClick={onOpenSettings}
            >
              🎨 Personnaliser
            </button>
          </div>

          <div
            className="bw-landing-mini-board"
            style={{
              backgroundColor: boardTheme.board.frameBg,
              borderColor: boardTheme.board.frameBorder,
            }}
          >
            {[0, 1, 2, 3].flatMap((row) =>
              [0, 1, 2, 3].map((col) => {
                const key = `${row},${col}`;
                const isSlotA = (row + col) % 2 === 0;
                const bg = isSlotA ? boardTheme.board.squareA : boardTheme.board.squareB;
                const sample = sampleByKey.get(key);
                const isSelected = key === selectedSampleCoord;
                const isReconHint = row === 1 && col === 3;
                const isMoveHint = row === 2 && col === 2;
                const { interactions } = boardTheme.board;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`bw-landing-mini-cell${sample ? ' bw-landing-mini-cell-active' : ''}`}
                    style={{
                      backgroundColor: bg,
                      outline: isSelected
                        ? `2px solid ${interactions.selectionBorder}`
                        : isReconHint
                          ? `2px dashed ${interactions.specialZoneBorder}`
                          : isMoveHint
                            ? `2px solid ${interactions.moveValidBorder}`
                            : undefined,
                      outlineOffset: '-2px',
                    }}
                    onClick={() => sample && setSelectedSampleCoord(key)}
                    aria-label={sample ? sample.label : `Case ${row}-${col}`}
                  >
                    {sample ? (
                      <PieceArtwork
                        character={sample.kind}
                        owner={sample.owner}
                        coord={sample.coord}
                        theme={boardTheme}
                        size="md"
                      />
                    ) : isMoveHint ? (
                      <span
                        className="bw-landing-move-dot"
                        style={{ backgroundColor: interactions.moveValidBorder }}
                      />
                    ) : isReconHint ? (
                      <span
                        className="bw-landing-recon-ping"
                        style={{ color: interactions.specialZoneBorder }}
                      >
                        ◎
                      </span>
                    ) : null}
                  </button>
                );
              }),
            )}
          </div>

          <div className="bw-landing-sample-caption">
            <PieceArtwork
              character={activeSample.kind}
              owner={activeSample.owner}
              coord={activeSample.coord}
              theme={boardTheme}
              size="sm"
            />
            <div>
              <strong>{activeSample.label}</strong>
              <p>{activeSample.summary}</p>
            </div>
          </div>
        </div>
      </section>

      {/* PILIERS DU CONCEPT */}
      <section className="bw-landing-pillars" aria-label="Piliers stratégiques de Blind War">
        <article className="bw-landing-pillar-card">
          <div className="bw-landing-pillar-icon">🕵️</div>
          <h3>Brouillard de Guerre Asymétrique</h3>
          <p>
            Les 27 pièces sont disposées secrètement dans votre zone de 3 rangées. Aucune
            identité adverse n’est divulguée sans action de reconnaissance, carte dédiée ou
            élimination ciblée.
          </p>
        </article>
        <article className="bw-landing-pillar-card">
          <div className="bw-landing-pillar-icon">🛡️</div>
          <h3>12 Unités & Rôles Complémentaires</h3>
          <p>
            Combinez la frappe traversante de l’Exécuteur, le marquage du Traqueur, le tir
            tactique de l’Arbalétrier, l’armure du Colosse et la promotion des Soldats.
          </p>
        </article>
        <article className="bw-landing-pillar-card">
          <div className="bw-landing-pillar-icon">⏱️</div>
          <h3>Serveur Autoritaire & Compétition ELO</h3>
          <p>
            Matchmaking classé dès 200 ELO avec pendule officielle de 10 minutes, salons
            personnalisés sur mesure, historique complet et protection anti-triche côté serveur.
          </p>
        </article>
      </section>

      {/* APERÇU ARSENAL : UNITÉS & CARTES TACTIQUES */}
      <section className="bw-landing-arsenal">
        <div className="bw-landing-arsenal-box">
          <div className="bw-landing-arsenal-head">
            <div>
              <h2>Unité & Rôles emblématiques</h2>
              <p>Cliquez sur une silhouette transparente pour explorer toute l’encyclopédie.</p>
            </div>
            <button type="button" className="bw-btn bw-btn-ghost bw-btn-sm" onClick={onOpenCharacters}>
              Les 12 Personnages →
            </button>
          </div>
          <div className="bw-landing-units-strip">
            {FEATURED_ROLES.map((charId, idx) => {
              const doc = CHARACTER_DOSSIERS[charId];
              return (
                <button
                  key={charId}
                  type="button"
                  className="bw-landing-unit-chip"
                  onClick={onOpenCharacters}
                  title={`${doc.name} — ${doc.roleSummary}`}
                >
                  <PieceArtwork
                    character={charId}
                    owner={idx % 2 === 0 ? 'red' : 'black'}
                    theme={boardTheme}
                    size="md"
                  />
                  <span className="bw-landing-unit-name">{doc.name}</span>
                  <span className="bw-landing-unit-role">{doc.roleSummary}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bw-landing-arsenal-box">
          <div className="bw-landing-arsenal-head">
            <div>
              <h2>16 Cartes Tactiques & Règles Officielles</h2>
              <p>Retournez un combat tendu grâce au renseignement, aux pièges et aux contres.</p>
            </div>
            <div className="bw-landing-arsenal-links">
              <button type="button" className="bw-btn bw-btn-ghost bw-btn-sm" onClick={onOpenCards}>
                16 Cartes →
              </button>
              <button type="button" className="bw-btn bw-btn-ghost bw-btn-sm" onClick={onOpenRules}>
                Règles →
              </button>
            </div>
          </div>
          <div className="bw-landing-cards-mini-grid">
            {FEATURED_CARDS.map((card) => (
              <div
                key={card.id}
                className="bw-landing-card-pill"
                onClick={onOpenCards}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenCards();
                  }
                }}
              >
                <div className="bw-landing-card-pill-top">
                  <CardArtwork card={card.id} size="sm" framed />
                  <strong>{card.name}</strong>
                </div>
                <p>{card.effectDescription}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
