import React, { useEffect, useState } from 'react';
import {
  DEFAULT_USER_PREFERENCES,
  SETTINGS_HELP_ITEMS,
  THEME_LIST,
  getThemeDefinition,
  type ThemeId,
  type UserPreferences,
} from '../../../shared/src/index.js';
import {
  apiChangePassword,
  apiVerifyCurrentPassword,
  playTacticalSfx,
  type ClientUserProfile,
} from '../services/apiClient.js';
import { ThemePreviewPanel } from './ThemePreviewPanel.js';

export type SettingsTabId = 'appearance' | 'gameplay' | 'notifications' | 'accessibility' | 'profile';

export interface SettingsScreenProps {
  readonly preferences: UserPreferences;
  readonly userProfile: ClientUserProfile | null;
  readonly onUpdatePreferences: (next: UserPreferences) => Promise<void> | void;
  readonly onPasswordChanged?: (updatedProfile: ClientUserProfile) => void;
  readonly onResetAll: () => Promise<void> | void;
  readonly onGoToProfile: () => void;
  readonly onGoToAuth: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  preferences,
  userProfile,
  onUpdatePreferences,
  onPasswordChanged,
  onResetAll,
  onGoToProfile,
  onGoToAuth,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTabId>('appearance');
  const [draftAppearance, setDraftAppearance] = useState<UserPreferences>(preferences);
  const [showAllExplanations, setShowAllExplanations] = useState<boolean>(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  // Two-step secure password change states (§5)
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwIdentityVerified, setPwIdentityVerified] = useState(false);
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);

  useEffect(() => {
    setDraftAppearance(preferences);
  }, [preferences]);

  const commitPreferences = async (next: UserPreferences, feedbackMessage?: string) => {
    await onUpdatePreferences(next);
    if (feedbackMessage) {
      setStatusNote(feedbackMessage);
      window.setTimeout(() => setStatusNote(null), 3200);
    }
  };

  const handleApplyDraftTheme = async () => {
    const next: UserPreferences = {
      ...preferences,
      colorMode: draftAppearance.colorMode,
      siteThemeId: draftAppearance.siteThemeId,
      boardThemeId: draftAppearance.boardThemeId,
      brightness: draftAppearance.brightness,
    };
    const chosen = getThemeDefinition(next.siteThemeId);
    await commitPreferences(
      next,
      `Thème « ${chosen.name} » (${next.colorMode === 'light' ? 'Mode clair' : 'Mode sombre'}) appliqué immédiatement !`,
    );
  };

  const handleResetThemeToDefault = async () => {
    const next: UserPreferences = {
      ...preferences,
      colorMode: DEFAULT_USER_PREFERENCES.colorMode,
      siteThemeId: DEFAULT_USER_PREFERENCES.siteThemeId,
      boardThemeId: DEFAULT_USER_PREFERENCES.boardThemeId,
      brightness: DEFAULT_USER_PREFERENCES.brightness,
    };
    setDraftAppearance(next);
    await commitPreferences(next, 'Apparence d’origine (Mode sombre • Rouge et noir) rétablie.');
  };

  return (
    <div className="bw-panel-page">
      <div className="bw-panel">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            marginBottom: '0.75rem',
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>⚙️ Paramètres & Personnalisation</h2>
            <p className="bw-muted-small" style={{ margin: '0.25rem 0 0' }}>
              {userProfile
                ? `Préférences synchronisées sur le compte de ${userProfile.displayName ?? userProfile.username} (aucun impact sur l’affichage de vos adversaires).`
                : 'Mode invité : préférences sauvegardées sur cet appareil. Connectez-vous pour les retrouver sur tous vos appareils.'}
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
            <button
              type="button"
              className="bw-btn bw-btn-ghost bw-btn-sm"
              onClick={() => setShowAllExplanations((v) => !v)}
            >
              {showAllExplanations ? 'Masquer l’aide' : '❓ Expliquer les paramètres'}
            </button>
            <button
              type="button"
              className="bw-btn bw-btn-secondary bw-btn-sm"
              onClick={async () => {
                await onResetAll();
                setStatusNote('Tous les paramètres ont été réinitialisés par défaut.');
              }}
            >
              ↺ Tout réinitialiser
            </button>
          </div>
        </div>

        {statusNote && (
          <div className="bw-success-note" role="status" style={{ marginBottom: '0.8rem' }}>
            ✅ {statusNote}
          </div>
        )}

        <div className="bw-settings-tabs" role="tablist" aria-label="Catégories de paramètres">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'appearance'}
            className={`bw-settings-tab-btn ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            🎨 Apparence & Thèmes
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'gameplay'}
            className={`bw-settings-tab-btn ${activeTab === 'gameplay' ? 'active' : ''}`}
            onClick={() => setActiveTab('gameplay')}
          >
            🎮 Préférences de jeu
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'notifications'}
            className={`bw-settings-tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            🔔 Notifications
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'accessibility'}
            className={`bw-settings-tab-btn ${activeTab === 'accessibility' ? 'active' : ''}`}
            onClick={() => setActiveTab('accessibility')}
          >
            ♿ Accessibilité
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'profile'}
            className={`bw-settings-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            👤 Profil & Compte
          </button>
        </div>

        {showAllExplanations && (
          <div
            className="bw-rule-block"
            style={{
              marginTop: '0.75rem',
              padding: '0.85rem',
              borderRadius: '10px',
              background: 'var(--bw-bg-panel-alt)',
              border: '1px solid var(--bw-border-bright)',
            }}
          >
            <h4 style={{ margin: '0 0 0.5rem' }}>💡 Aide rapide sur chaque réglage</h4>
            <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
              {SETTINGS_HELP_ITEMS.map((h) => (
                <li key={h.id} style={{ marginBottom: '0.3rem', fontSize: '0.84rem' }}>
                  <strong>{h.section} :</strong> {h.summary}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* TAB 1 : APPARENCE & THÈMES + APERÇU AVANT APPLICATION */}
      {activeTab === 'appearance' && (
        <>
          <div className="bw-panel">
            <h3>1. Mode d’affichage principal (Sombre / Clair)</h3>
            <p className="bw-muted-small">
              Basculez instantanément entre le mode sombre et le mode clair sans recharger la page.
              Votre choix est enregistré automatiquement dans vos préférences.
            </p>
            <div className="bw-color-mode-switch" role="group" aria-label="Mode d’affichage sombre ou clair" style={{ marginTop: '0.65rem', marginBottom: '1.1rem' }}>
              <button
                type="button"
                className={`bw-btn ${preferences.colorMode === 'dark' ? 'bw-btn-primary' : 'bw-btn-secondary'}`}
                onClick={() => {
                  const next: UserPreferences = { ...preferences, colorMode: 'dark' };
                  setDraftAppearance((prev) => ({ ...prev, colorMode: 'dark' }));
                  void commitPreferences(next, 'Mode sombre activé et sauvegardé.');
                }}
              >
                🌙 Mode sombre {preferences.colorMode === 'dark' ? '• Actif' : ''}
              </button>
              <button
                type="button"
                className={`bw-btn ${preferences.colorMode === 'light' ? 'bw-btn-primary' : 'bw-btn-secondary'}`}
                onClick={() => {
                  const next: UserPreferences = { ...preferences, colorMode: 'light' };
                  setDraftAppearance((prev) => ({ ...prev, colorMode: 'light' }));
                  void commitPreferences(next, 'Mode clair activé et sauvegardé.');
                }}
              >
                ☀️ Mode clair {preferences.colorMode === 'light' ? '• Actif' : ''}
              </button>
            </div>

            <h3>2. Choisissez le thème global du site et du jeu</h3>
            <p className="bw-muted-small">
              Cliquez sur un thème pour le prévisualiser ci-dessous, puis cliquez sur{' '}
              <strong>Appliquer ce thème</strong> pour transformer immédiatement toute l’interface
              (navigation, boutons, panneaux, notifications, plateau et médaillons originaux).
            </p>
            <div className="bw-theme-grid" style={{ marginTop: '0.8rem' }}>
              {THEME_LIST.map((t) => {
                const selected = draftAppearance.siteThemeId === t.id;
                const active = preferences.siteThemeId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`bw-theme-card ${selected ? 'selected' : ''}`}
                    onClick={() =>
                      setDraftAppearance((prev) => ({
                        ...prev,
                        siteThemeId: t.id,
                      }))
                    }
                  >
                    <div className="bw-theme-card-top">
                      <span className="bw-theme-card-name">{t.name}</span>
                      <div className="bw-theme-swatches">
                        <span
                          className="bw-theme-swatch"
                          style={{ backgroundColor: t.swatchA }}
                        />
                        <span
                          className="bw-theme-swatch"
                          style={{ backgroundColor: t.swatchB }}
                        />
                      </div>
                    </div>
                    <span className="bw-theme-card-sub">{t.subtitle}</span>
                    {t.isDefault ? (
                      <span className="bw-theme-default-pill">
                        Thème par défaut {active ? '• Actif' : ''}
                      </span>
                    ) : active ? (
                      <span className="bw-theme-default-pill">Actif</span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
              <label className="bw-setting-control-row">
                <span className="bw-setting-control-info">
                  <span className="bw-setting-control-title">Thème du plateau 9×9</span>
                  <span className="bw-setting-control-desc">
                    Par défaut, le plateau suit automatiquement le thème du site.
                  </span>
                </span>
                <select
                  className="bw-history-filter-select"
                  value={draftAppearance.boardThemeId}
                  onChange={(e) =>
                    setDraftAppearance((prev) => ({
                      ...prev,
                      boardThemeId: e.target.value as ThemeId | 'match_site',
                    }))
                  }
                >
                  <option value="match_site">Suivre le thème du site</option>
                  {THEME_LIST.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.board.squareALabel} / {t.board.squareBLabel})
                    </option>
                  ))}
                </select>
              </label>

              <label className="bw-setting-control-row">
                <span className="bw-setting-control-info">
                  <span className="bw-setting-control-title">Luminosité globale</span>
                  <span className="bw-setting-control-desc">
                    Adapte le confort de lecture selon l’éclairage ambiant.
                  </span>
                </span>
                <select
                  className="bw-history-filter-select"
                  value={draftAppearance.brightness}
                  onChange={(e) =>
                    setDraftAppearance((prev) => ({
                      ...prev,
                      brightness: e.target.value as UserPreferences['brightness'],
                    }))
                  }
                >
                  <option value="standard">Standard</option>
                  <option value="bright">Éclaircie (+)</option>
                  <option value="dim">Adoucie (-)</option>
                </select>
              </label>
            </div>
          </div>

          <div className="bw-panel">
            <h3>2. Aperçu interactif avant application</h3>
            <ThemePreviewPanel
              previewPrefs={draftAppearance}
              activePrefs={preferences}
              onApplyDraft={handleApplyDraftTheme}
              onResetDefaults={handleResetThemeToDefault}
            />
          </div>
        </>
      )}

      {/* TAB 2 : PRÉFÉRENCES DE JEU */}
      {activeTab === 'gameplay' && (
        <div className="bw-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <h3>🎮 Confort et Préférences de Partie</h3>

          <label className="bw-setting-control-row">
            <span className="bw-setting-control-info">
              <span className="bw-setting-control-title">Effets sonores tactiques</span>
              <span className="bw-setting-control-desc">
                Active les sons lors des déplacements, éliminations, cartes et victoires.
              </span>
            </span>
            <input
              type="checkbox"
              checked={preferences.soundEnabled}
              onChange={(e) =>
                commitPreferences({ ...preferences, soundEnabled: e.target.checked })
              }
            />
          </label>

          <div className="bw-setting-control-row">
            <span className="bw-setting-control-info">
              <span className="bw-setting-control-title">
                Volume des effets ({preferences.soundVolume}%)
              </span>
              <span className="bw-setting-control-desc">
                Ajuste l’intensité audio sans couper les notifications visuelles.
              </span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                disabled={!preferences.soundEnabled}
                value={preferences.soundVolume}
                onChange={(e) =>
                  commitPreferences({ ...preferences, soundVolume: Number(e.target.value) })
                }
                className="bw-range-input"
              />
              <button
                type="button"
                className="bw-btn bw-btn-secondary bw-btn-sm"
                disabled={!preferences.soundEnabled || preferences.soundVolume === 0}
                onClick={() => playTacticalSfx('card')}
              >
                🔊 Tester
              </button>
            </div>
          </div>

          <label className="bw-setting-control-row">
            <span className="bw-setting-control-info">
              <span className="bw-setting-control-title">Vitesse des animations</span>
              <span className="bw-setting-control-desc">
                Accélère les transitions du plateau ou réduit les mouvements visuels.
              </span>
            </span>
            <select
              className="bw-history-filter-select"
              value={preferences.animationSpeed}
              onChange={(e) =>
                commitPreferences({
                  ...preferences,
                  animationSpeed: e.target.value as UserPreferences['animationSpeed'],
                })
              }
            >
              <option value="normal">Normale</option>
              <option value="fast">Rapide</option>
              <option value="reduced">Minimale</option>
            </select>
          </label>

          <label className="bw-setting-control-row">
            <span className="bw-setting-control-info">
              <span className="bw-setting-control-title">
                Confirmer les actions importantes (abandon, match nul, quitter)
              </span>
              <span className="bw-setting-control-desc">
                Évite les erreurs de manipulation pendant une partie critique.
              </span>
            </span>
            <input
              type="checkbox"
              checked={preferences.confirmImportantActions}
              onChange={(e) =>
                commitPreferences({
                  ...preferences,
                  confirmImportantActions: e.target.checked,
                })
              }
            />
          </label>

          <label className="bw-setting-control-row">
            <span className="bw-setting-control-info">
              <span className="bw-setting-control-title">Afficher les coordonnées A–I / 1–9</span>
              <span className="bw-setting-control-desc">
                Affiche la notation algébrique directement sur les bordures du damier.
              </span>
            </span>
            <input
              type="checkbox"
              checked={preferences.showCoordinates}
              onChange={(e) =>
                commitPreferences({ ...preferences, showCoordinates: e.target.checked })
              }
            />
          </label>

          <label className="bw-setting-control-row">
            <span className="bw-setting-control-info">
              <span className="bw-setting-control-title">
                Afficher la portée de détection des Guetteurs
              </span>
              <span className="bw-setting-control-desc">
                Met en évidence les cases surveillées par vos Guetteurs horizontaux et diagonaux.
              </span>
            </span>
            <input
              type="checkbox"
              checked={preferences.showReconZones}
              onChange={(e) =>
                commitPreferences({ ...preferences, showReconZones: e.target.checked })
              }
            />
          </label>

          <label className="bw-setting-control-row">
            <span className="bw-setting-control-info">
              <span className="bw-setting-control-title">
                Guides contextuels intelligents en partie
              </span>
              <span className="bw-setting-control-desc">
                Affiche une aide discrète lors de votre première situation avec une nouvelle unité.
              </span>
            </span>
            <input
              type="checkbox"
              checked={preferences.enableContextualTutorials}
              onChange={(e) =>
                commitPreferences({
                  ...preferences,
                  enableContextualTutorials: e.target.checked,
                })
              }
            />
          </label>
        </div>
      )}

      {/* TAB 3 : NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div className="bw-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <h3>🔔 Gestion des Notifications</h3>
          <p className="bw-muted-small">
            Choisissez quelles alertes apparaissent dans la cloche de notifications en haut de
            l’écran. Les notifications tactiques de cartes pendant le combat restent toujours actives.
          </p>

          {(
            [
              [
                'notifyInvitations',
                'Invitations & salons privés',
                'Alerte lors de la création ou de l’entrée dans un salon multijoueur.',
              ],
              [
                'notifyMatchStart',
                'Début et issue des parties',
                'Confirme le démarrage des affrontements et l’enregistrement des résultats.',
              ],
              [
                'notifyMessages',
                'Messages réseau & P2P',
                'Affiche l’état de connexion serveur et des relais décentralisés.',
              ],
              [
                'notifyAccountEvents',
                'Activité du compte & profil',
                'Confirme vos modifications d’avatar, de cosmétiques ou de session.',
              ],
              [
                'notifyUpdates',
                'Nouveautés & équilibres BLIND WAR',
                'Signale les mises à jour de fonctionnalités dans l’application.',
              ],
            ] as const
          ).map(([key, label, desc]) => (
            <label key={key} className="bw-setting-control-row">
              <span className="bw-setting-control-info">
                <span className="bw-setting-control-title">{label}</span>
                <span className="bw-setting-control-desc">{desc}</span>
              </span>
              <input
                type="checkbox"
                checked={preferences[key]}
                onChange={(e) => commitPreferences({ ...preferences, [key]: e.target.checked })}
              />
            </label>
          ))}
        </div>
      )}

      {/* TAB 4 : ACCESSIBILITÉ */}
      {activeTab === 'accessibility' && (
        <div className="bw-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <h3>♿ Accessibilité & Lisibilité</h3>

          <label className="bw-setting-control-row">
            <span className="bw-setting-control-info">
              <span className="bw-setting-control-title">Taille globale du texte</span>
              <span className="bw-setting-control-desc">
                Agrandit les menus, cartes et descriptions sans briser la mise en page.
              </span>
            </span>
            <select
              className="bw-history-filter-select"
              value={preferences.textScale}
              onChange={(e) =>
                commitPreferences({
                  ...preferences,
                  textScale: e.target.value as UserPreferences['textScale'],
                })
              }
            >
              <option value="normal">Normale (100%)</option>
              <option value="large">Grande (112%)</option>
              <option value="xlarge">Très grande (124%)</option>
            </select>
          </label>

          <label className="bw-setting-control-row">
            <span className="bw-setting-control-info">
              <span className="bw-setting-control-title">Contraste renforcé</span>
              <span className="bw-setting-control-desc">
                Épaissit les bordures et renforce le contraste des textes secondaires.
              </span>
            </span>
            <input
              type="checkbox"
              checked={preferences.highContrast}
              onChange={(e) =>
                commitPreferences({ ...preferences, highContrast: e.target.checked })
              }
            />
          </label>

          <label className="bw-setting-control-row">
            <span className="bw-setting-control-info">
              <span className="bw-setting-control-title">Réduire les animations</span>
              <span className="bw-setting-control-desc">
                Désactive les effets de pulsation et réduit toutes les transitions visuelles.
              </span>
            </span>
            <input
              type="checkbox"
              checked={preferences.reduceMotion}
              onChange={(e) =>
                commitPreferences({ ...preferences, reduceMotion: e.target.checked })
              }
            />
          </label>

          <label className="bw-setting-control-row">
            <span className="bw-setting-control-info">
              <span className="bw-setting-control-title">Surbrillance de sélection renforcée</span>
              <span className="bw-setting-control-desc">
                Ajoute un contour blanc net sur la pièce sélectionnée et les cases ciblées.
              </span>
            </span>
            <input
              type="checkbox"
              checked={preferences.highlightSelectionStrong}
              onChange={(e) =>
                commitPreferences({
                  ...preferences,
                  highlightSelectionStrong: e.target.checked,
                })
              }
            />
          </label>

          <label className="bw-setting-control-row">
            <span className="bw-setting-control-info">
              <span className="bw-setting-control-title">
                Repères visuels distinctifs (daltonisme)
              </span>
              <span className="bw-setting-control-desc">
                Affiche des symboles géométriques (• déplacement, ⚔ attaque, ✦ saut, ◎ marquage) sur
                les cases disponibles en plus de la couleur.
              </span>
            </span>
            <input
              type="checkbox"
              checked={preferences.showPatternMarkers}
              onChange={(e) =>
                commitPreferences({
                  ...preferences,
                  showPatternMarkers: e.target.checked,
                })
              }
            />
          </label>
        </div>
      )}

      {/* TAB 5 : PROFIL RAPIDE & MODIFIER MON MOT DE PASSE */}
      {activeTab === 'profile' && (
        <div className="bw-panel-page">
          <div className="bw-panel">
            <h3>👤 Compte & Synchronisation</h3>
            {userProfile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <p>
                  Connecté en tant que{' '}
                  <strong>{userProfile.displayName ?? userProfile.username}</strong> (@
                  {userProfile.username}) • <strong>{userProfile.eloRating} ELO</strong>.
                </p>
                <p className="bw-muted-small">
                  Gérez votre photo de profil recadrée, votre nom affiché, votre biographie, vos
                  bannières débloquées, titres et badges sur votre page Profil.
                </p>
                <button
                  type="button"
                  className="bw-btn bw-btn-primary"
                  style={{ width: 'fit-content' }}
                  onClick={onGoToProfile}
                >
                  👤 Ouvrir la personnalisation complète du Profil
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <p>Vous naviguez actuellement en mode invité.</p>
                <p className="bw-muted-small">
                  Créez un compte ou connectez-vous pour enregistrer votre thème personnalisé, importer
                  votre photo de profil, débloquer bannières et titres, et accéder au classement.
                </p>
                <button
                  type="button"
                  className="bw-btn bw-btn-primary"
                  style={{ width: 'fit-content' }}
                  onClick={onGoToAuth}
                >
                  🔐 Se connecter ou créer un compte
                </button>
              </div>
            )}
          </div>

          <div className="bw-panel" aria-label="Modifier mon mot de passe">
            <h3>🔒 Modifier mon mot de passe</h3>
            {!userProfile ? (
              <p className="bw-muted-small">
                Connectez-vous à votre compte pour modifier votre mot de passe en toute sécurité.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxWidth: 480 }}>
                <p className="bw-muted-small" style={{ margin: 0 }}>
                  Par sécurité, confirmez d’abord votre identité en saisissant votre ancien mot de passe.
                  Vos autres sessions actives seront automatiquement invalidées après la modification.
                </p>

                {pwSuccess && (
                  <div className="bw-success-box" role="status">
                    ✅ {pwSuccess}
                  </div>
                )}
                {pwError && (
                  <div className="bw-error-box" role="alert" style={{ margin: 0 }}>
                    ⚠️ {pwError}
                  </div>
                )}

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setPwError(null);
                    setPwSuccess(null);
                    setPwBusy(true);
                    try {
                      await apiVerifyCurrentPassword(pwCurrent);
                      setPwIdentityVerified(true);
                    } catch (err) {
                      setPwIdentityVerified(false);
                      setPwError(
                        err instanceof Error ? err.message : 'Ancien mot de passe incorrect.',
                      );
                    } finally {
                      setPwBusy(false);
                    }
                  }}
                >
                  <label className="bw-field">
                    <span>Étape 1 : Ancien mot de passe (vérification d’identité)</span>
                    <input
                      type="password"
                      required
                      disabled={pwBusy || pwIdentityVerified}
                      value={pwCurrent}
                      onChange={(e) => setPwCurrent(e.target.value)}
                      placeholder="Saisissez votre mot de passe actuel"
                      autoComplete="current-password"
                    />
                  </label>
                  {!pwIdentityVerified ? (
                    <button
                      type="submit"
                      className="bw-btn bw-btn-secondary"
                      disabled={pwBusy || !pwCurrent}
                    >
                      {pwBusy ? 'Vérification...' : '🛡️ Confirmer mon identité'}
                    </button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="bw-mode-pill">✅ Identité confirmée</span>
                      <button
                        type="button"
                        className="bw-btn bw-btn-ghost bw-btn-sm"
                        onClick={() => {
                          setPwIdentityVerified(false);
                          setPwCurrent('');
                          setPwNew('');
                          setPwConfirm('');
                          setPwError(null);
                        }}
                      >
                        Annuler
                      </button>
                    </div>
                  )}
                </form>

                {pwIdentityVerified && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setPwError(null);
                      setPwSuccess(null);
                      if (pwNew.length < 6) {
                        setPwError('Le nouveau mot de passe doit contenir au moins 6 caractères.');
                        return;
                      }
                      if (pwNew !== pwConfirm) {
                        setPwError('Les deux nouveaux mots de passe ne correspondent pas.');
                        return;
                      }
                      setPwBusy(true);
                      try {
                        const updated = await apiChangePassword(pwCurrent, pwNew, pwConfirm);
                        onPasswordChanged?.(updated.profile);
                        setPwCurrent('');
                        setPwNew('');
                        setPwConfirm('');
                        setPwIdentityVerified(false);
                        setPwSuccess(
                          'Votre mot de passe a été modifié avec succès. Les anciennes sessions ont été invalidées.',
                        );
                      } catch (err) {
                        setPwError(
                          err instanceof Error ? err.message : 'Modification du mot de passe refusée.',
                        );
                      } finally {
                        setPwBusy(false);
                      }
                    }}
                  >
                    <label className="bw-field">
                      <span>Étape 2 : Nouveau mot de passe (6 caractères minimum)</span>
                      <input
                        type="password"
                        required
                        minLength={6}
                        maxLength={128}
                        value={pwNew}
                        onChange={(e) => setPwNew(e.target.value)}
                        placeholder="Nouveau mot de passe"
                        autoComplete="new-password"
                      />
                    </label>
                    <label className="bw-field">
                      <span>Confirmer le nouveau mot de passe</span>
                      <input
                        type="password"
                        required
                        minLength={6}
                        maxLength={128}
                        value={pwConfirm}
                        onChange={(e) => setPwConfirm(e.target.value)}
                        placeholder="Retapez le nouveau mot de passe"
                        autoComplete="new-password"
                      />
                    </label>
                    <button
                      type="submit"
                      className="bw-btn bw-btn-primary"
                      disabled={pwBusy}
                    >
                      {pwBusy ? 'Enregistrement...' : '🔑 Enregistrer le nouveau mot de passe'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
