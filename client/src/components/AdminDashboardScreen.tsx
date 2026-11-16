import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createZeroNewMechanicsStats,
  isDesignatedAdminUsername,
  type NewMechanicsStats,
} from '../../../shared/src/index.js';
import {
  apiAdminManageUserAccount,
  apiAdminUpdateUserStats,
  apiFetchAdminOverview,
  type ClientAdminOverview,
  type ClientUserProfile,
} from '../services/apiClient.js';
import { PieceAvatar } from './PieceArtwork.js';

export type AdminSectionId =
  | 'users'
  | 'elo'
  | 'stats'
  | 'matches'
  | 'accounts'
  | 'logs';

export interface AdminDashboardScreenProps {
  readonly currentUser: ClientUserProfile | null;
  readonly initialOverview?: ClientAdminOverview | null;
  readonly onAdminProfileSynced?: (updated: ClientUserProfile) => void;
  readonly onBackToMenu: () => void;
}

export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({
  currentUser,
  initialOverview = null,
  onAdminProfileSynced,
  onBackToMenu,
}) => {
  const isAdmin =
    currentUser?.role === 'admin' && isDesignatedAdminUsername(currentUser.username);

  const [section, setSection] = useState<AdminSectionId>('users');
  const [overview, setOverview] = useState<ClientAdminOverview | null>(initialOverview);
  const [loading, setLoading] = useState<boolean>(!initialOverview);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>(
    initialOverview?.users[0]?.id ?? currentUser?.id ?? '',
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Editable form buffers for selected user
  const [eloInput, setEloInput] = useState<number>(200);
  const [eloReason, setEloReason] = useState<string>('');
  const [winsInput, setWinsInput] = useState<number>(0);
  const [lossesInput, setLossesInput] = useState<number>(0);
  const [drawsInput, setDrawsInput] = useState<number>(0);
  const [gamesInput, setGamesInput] = useState<number>(0);
  const [elimsInput, setElimsInput] = useState<number>(0);
  const [nmStatsInput, setNmStatsInput] = useState<NewMechanicsStats>(() =>
    createZeroNewMechanicsStats(),
  );
  const [statsReason, setStatsReason] = useState<string>('');

  const [editDisplayName, setEditDisplayName] = useState<string>('');
  const [editBio, setEditBio] = useState<string>('');
  const [suspendReasonInput, setSuspendReasonInput] = useState<string>('');
  const [matchSearchQuery, setMatchSearchQuery] = useState<string>('');

  const loadOverview = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiFetchAdminOverview();
      setOverview(data);
      setSelectedUserId((prev) =>
        prev && data.users.some((u) => u.id === prev)
          ? prev
          : (data.users[0]?.id ?? ''),
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur de chargement administrateur.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!initialOverview && isAdmin) {
      void loadOverview();
    }
  }, [initialOverview, isAdmin, loadOverview]);

  const selectedUser = useMemo(() => {
    if (!overview) return null;
    return overview.users.find((u) => u.id === selectedUserId) ?? overview.users[0] ?? null;
  }, [overview, selectedUserId]);

  useEffect(() => {
    if (!selectedUser) return;
    setEloInput(selectedUser.eloRating);
    setWinsInput(selectedUser.wins);
    setLossesInput(selectedUser.losses);
    setDrawsInput(selectedUser.draws);
    setGamesInput(selectedUser.gamesPlayed);
    setElimsInput(selectedUser.totalEliminations);
    setNmStatsInput({
      ...createZeroNewMechanicsStats(),
      ...(selectedUser.newMechanicsStats ?? {}),
    });
    setEditDisplayName(selectedUser.displayName ?? selectedUser.username);
    setEditBio(selectedUser.bio ?? '');
    setSuspendReasonInput(selectedUser.suspendedReason ?? '');
  }, [selectedUser]);

  const filteredUsers = useMemo(() => {
    if (!overview) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return overview.users;
    return overview.users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.displayName ?? '').toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q),
    );
  }, [overview, searchQuery]);

  const filteredMatches = useMemo(() => {
    if (!overview) return [];
    const q = matchSearchQuery.trim().toLowerCase();
    if (!q) return overview.matches;
    return overview.matches.filter(
      (m) =>
        m.redUsername.toLowerCase().includes(q) ||
        m.blackUsername.toLowerCase().includes(q) ||
        m.mode.toLowerCase().includes(q),
    );
  }, [overview, matchSearchQuery]);

  if (!isAdmin) {
    return (
      <section className="bw-panel-page" aria-label="Accès administrateur refusé">
        <div className="bw-panel">
          <h2>🛡️ Accès restreint</h2>
          <p className="bw-error-box">
            Cette interface d’administration est strictement réservée au compte administrateur{' '}
            <strong>Kenktra_7003</strong>. Toutes les actions sont vérifiées côté serveur.
          </p>
          <button type="button" className="bw-btn bw-btn-secondary" onClick={onBackToMenu}>
            Retour au menu
          </button>
        </div>
      </section>
    );
  }

  const handleSaveElo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setFeedback(null);
    setErrorMsg(null);
    try {
      const res = await apiAdminUpdateUserStats(selectedUser.id, {
        eloRating: eloInput,
        reason: eloReason.trim() || 'Ajustement manuel ELO par administrateur',
      });
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              users: prev.users.map((u) => (u.id === res.profile.id ? res.profile : u)),
              adminLogs: [res.logEntry, ...prev.adminLogs],
            }
          : prev,
      );
      if (res.profile.id === currentUser?.id) {
        onAdminProfileSynced?.(res.profile);
      }
      setEloReason('');
      setFeedback(`ELO de ${res.profile.username} mis à jour à ${res.profile.eloRating} ELO.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors de la mise à jour ELO.');
    }
  };

  const handleSaveStats = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setFeedback(null);
    setErrorMsg(null);
    try {
      const res = await apiAdminUpdateUserStats(selectedUser.id, {
        wins: winsInput,
        losses: lossesInput,
        draws: drawsInput,
        gamesPlayed: gamesInput,
        totalEliminations: elimsInput,
        newMechanicsStats: nmStatsInput,
        reason: statsReason.trim() || 'Modification statistiques administrateur',
      });
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              users: prev.users.map((u) => (u.id === res.profile.id ? res.profile : u)),
              adminLogs: [res.logEntry, ...prev.adminLogs],
            }
          : prev,
      );
      if (res.profile.id === currentUser?.id) {
        onAdminProfileSynced?.(res.profile);
      }
      setStatsReason('');
      setFeedback(`Statistiques de ${res.profile.username} enregistrées dans la base.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
    }
  };

  const handleUpdateAccount = async (nextStatus?: 'active' | 'suspended') => {
    if (!selectedUser) return;
    setFeedback(null);
    setErrorMsg(null);
    try {
      const res = await apiAdminManageUserAccount(selectedUser.id, {
        accountStatus: nextStatus ?? selectedUser.accountStatus,
        suspendedReason: nextStatus === 'suspended' ? suspendReasonInput : undefined,
        displayName: editDisplayName,
        bio: editBio,
      });
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              users: prev.users.map((u) => (u.id === res.profile.id ? res.profile : u)),
              adminLogs: [res.logEntry, ...prev.adminLogs],
            }
          : prev,
      );
      if (res.profile.id === currentUser?.id) {
        onAdminProfileSynced?.(res.profile);
      }
      setFeedback(
        nextStatus === 'suspended'
          ? `Compte ${res.profile.username} suspendu et sessions révoquées.`
          : nextStatus === 'active'
            ? `Compte ${res.profile.username} réactivé.`
            : `Profil administratif de ${res.profile.username} mis à jour.`,
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Action refusée.');
    }
  };

  return (
    <section className="bw-panel-page bw-admin-layout" aria-label="Panneau d'administration BLIND WAR">
      <div className="bw-panel">
        <div className="bw-admin-header-row">
          <div>
            <h2 style={{ margin: 0 }}>🛡️ Administration BLIND WAR ({currentUser?.username})</h2>
            <p className="bw-muted-small" style={{ margin: '0.25rem 0 0' }}>
              Gestion sécurisée des comptes, classements Elo, statistiques et audit. Aucun mot de passe
              n’est jamais consultable ou transmis.
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button
              type="button"
              className="bw-btn bw-btn-secondary bw-btn-sm"
              onClick={() => void loadOverview()}
              disabled={loading}
            >
              🔄 Actualiser
            </button>
            <button type="button" className="bw-btn bw-btn-ghost bw-btn-sm" onClick={onBackToMenu}>
              Retour
            </button>
          </div>
        </div>

        {overview && (
          <div className="bw-admin-kpi-strip">
            <span className="bw-mode-pill">👥 Utilisateurs : {overview.users.length}</span>
            <span className="bw-mode-pill">⚔️ Parties enregistrées : {overview.matches.length}</span>
            <span className="bw-mode-pill">🎮 Salles actives : {overview.activeRoomsCount}</span>
            <span className="bw-mode-pill" title={overview.storage.diskFilePath}>
              💾 Stockage persistant : {overview.storage.backupExists ? 'Actif + Backup .bak' : 'Actif'}
            </span>
          </div>
        )}

        {feedback && (
          <div className="bw-success-box" role="status" style={{ marginTop: '0.75rem' }}>
            ✅ {feedback}
          </div>
        )}
        {errorMsg && (
          <div className="bw-error-box" role="alert" style={{ marginTop: '0.75rem', marginLeft: 0, marginRight: 0 }}>
            ⚠️ {errorMsg}
          </div>
        )}

        <div className="bw-settings-tabs bw-admin-section-tabs" role="tablist" aria-label="Sections d'administration">
          {(
            [
              ['users', '1. Gestion des utilisateurs'],
              ['elo', '2. Gestion des classements Elo'],
              ['stats', '3. Gestion des statistiques'],
              ['matches', '4. Historique des parties'],
              ['accounts', '5. Gestion des comptes'],
              ['logs', '6. Journal des actions administrateur'],
            ] as const
          ).map(([tabId, label]) => (
            <button
              key={tabId}
              type="button"
              role="tab"
              aria-selected={section === tabId}
              className={`bw-settings-tab-btn ${section === tabId ? 'active' : ''}`}
              onClick={() => setSection(tabId)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Selected player quick banner for sections editing a specific player */}
      {selectedUser && (section === 'elo' || section === 'stats' || section === 'accounts') && (
        <div className="bw-panel bw-admin-selected-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <PieceAvatar
              badge={selectedUser.avatarBadge}
              avatarImage={selectedUser.avatarImage}
              alt={selectedUser.username}
              size="sm"
            />
            <div>
              <strong>
                Joueur sélectionné : {selectedUser.displayName ?? selectedUser.username} (@{selectedUser.username})
              </strong>
              <div className="bw-muted-small">
                {selectedUser.eloRating} ELO • {selectedUser.wins}V / {selectedUser.losses}D /{' '}
                {selectedUser.draws}N • Statut :{' '}
                {selectedUser.accountStatus === 'suspended' ? '⛔ Suspendu' : '✅ Actif'}
              </div>
            </div>
          </div>
          <label className="bw-field" style={{ margin: 0, minWidth: 230 }}>
            <span>Changer de joueur ciblé</span>
            <select
              value={selectedUser.id}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              {(overview?.users ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} ({u.eloRating} ELO){u.accountStatus === 'suspended' ? ' [Suspendu]' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* 1. GESTION DES UTILISATEURS */}
      {section === 'users' && (
        <div className="bw-panel">
          <h3>1. Gestion des utilisateurs</h3>
          <div className="bw-inline-form" style={{ marginBottom: '0.85rem' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom d'utilisateur, nom affiché ou ID..."
            />
          </div>
          {loading ? (
            <p className="bw-muted-small">Chargement des utilisateurs...</p>
          ) : (
            <div className="bw-admin-table-wrap">
              <table className="bw-history-table">
                <thead>
                  <tr>
                    <th>Joueur</th>
                    <th>Rôle</th>
                    <th>Statut</th>
                    <th>ELO</th>
                    <th>Parties (V/D/N)</th>
                    <th>Éliminations</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <PieceAvatar
                            badge={u.avatarBadge}
                            avatarImage={u.avatarImage}
                            alt={u.username}
                            size="xs"
                          />
                          <div>
                            <strong>{u.username}</strong>
                            {u.displayName && u.displayName !== u.username && (
                              <div className="bw-muted-small">{u.displayName}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="bw-mode-pill">
                          {u.role === 'admin' ? '🛡️ Admin' : 'Joueur'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`bw-admin-status-pill ${
                            u.accountStatus === 'suspended' ? 'suspended' : 'active'
                          }`}
                        >
                          {u.accountStatus === 'suspended' ? 'Suspendu' : 'Actif'}
                        </span>
                      </td>
                      <td>
                        <strong>{u.eloRating}</strong>
                      </td>
                      <td>
                        {u.gamesPlayed} ({u.wins}V / {u.losses}D / {u.draws}N)
                      </td>
                      <td>{u.totalEliminations}</td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          <button
                            type="button"
                            className="bw-btn bw-btn-primary bw-btn-sm"
                            onClick={() => {
                              setSelectedUserId(u.id);
                              setSection('elo');
                            }}
                          >
                            ELO / Stats
                          </button>
                          <button
                            type="button"
                            className="bw-btn bw-btn-secondary bw-btn-sm"
                            onClick={() => {
                              setSelectedUserId(u.id);
                              setSection('accounts');
                            }}
                          >
                            Compte
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 2. GESTION DES CLASSEMENTS ELO */}
      {section === 'elo' && selectedUser && (
        <div className="bw-panel">
          <h3>2. Gestion des classements Elo — {selectedUser.username}</h3>
          <form onSubmit={handleSaveElo} className="bw-admin-form-grid">
            <label className="bw-field">
              <span>Classement ELO (0 à 5000)</span>
              <input
                type="number"
                min={0}
                max={5000}
                value={eloInput}
                onChange={(e) => setEloInput(Number(e.target.value))}
                required
              />
            </label>
            <label className="bw-field">
              <span>Motif de l’ajustement (journalisé)</span>
              <input
                type="text"
                value={eloReason}
                onChange={(e) => setEloReason(e.target.value)}
                placeholder="Ex : Rééquilibrage ou correction incident"
              />
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'center' }}>
              {[-50, -25, -10, +10, +25, +50].map((delta) => (
                <button
                  key={delta}
                  type="button"
                  className="bw-btn bw-btn-secondary bw-btn-sm"
                  onClick={() => setEloInput((v) => Math.max(0, Math.min(5000, v + delta)))}
                >
                  {delta > 0 ? `+${delta}` : delta} ELO
                </button>
              ))}
              <button
                type="button"
                className="bw-btn bw-btn-ghost bw-btn-sm"
                onClick={() => setEloInput(200)}
              >
                Réinitialiser à 200
              </button>
            </div>
            <div>
              <button type="submit" className="bw-btn bw-btn-primary">
                💾 Enregistrer le nouvel ELO
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. GESTION DES STATISTIQUES */}
      {section === 'stats' && selectedUser && (
        <div className="bw-panel">
          <h3>3. Gestion des statistiques — {selectedUser.username}</h3>
          <form onSubmit={handleSaveStats}>
            <div className="bw-admin-stats-grid">
              <label className="bw-field">
                <span>Victoires</span>
                <input
                  type="number"
                  min={0}
                  value={winsInput}
                  onChange={(e) => setWinsInput(Number(e.target.value))}
                />
              </label>
              <label className="bw-field">
                <span>Défaites</span>
                <input
                  type="number"
                  min={0}
                  value={lossesInput}
                  onChange={(e) => setLossesInput(Number(e.target.value))}
                />
              </label>
              <label className="bw-field">
                <span>Matchs nuls</span>
                <input
                  type="number"
                  min={0}
                  value={drawsInput}
                  onChange={(e) => setDrawsInput(Number(e.target.value))}
                />
              </label>
              <label className="bw-field">
                <span>Matchs joués</span>
                <input
                  type="number"
                  min={0}
                  value={gamesInput}
                  onChange={(e) => setGamesInput(Number(e.target.value))}
                />
              </label>
              <label className="bw-field">
                <span>Éliminations totales</span>
                <input
                  type="number"
                  min={0}
                  value={elimsInput}
                  onChange={(e) => setElimsInput(Number(e.target.value))}
                />
              </label>
              <label className="bw-field">
                <span>Éliminations Traqueur</span>
                <input
                  type="number"
                  min={0}
                  value={nmStatsInput.traqueurEliminations}
                  onChange={(e) =>
                    setNmStatsInput((p) => ({ ...p, traqueurEliminations: Number(e.target.value) }))
                  }
                />
              </label>
              <label className="bw-field">
                <span>Frappes traversantes Exécuteur</span>
                <input
                  type="number"
                  min={0}
                  value={nmStatsInput.executeurPiercingStrikes}
                  onChange={(e) =>
                    setNmStatsInput((p) => ({
                      ...p,
                      executeurPiercingStrikes: Number(e.target.value),
                    }))
                  }
                />
              </label>
              <label className="bw-field">
                <span>Tirs réussis Arbalétrier</span>
                <input
                  type="number"
                  min={0}
                  value={nmStatsInput.arbaletrierShotsSucceeded}
                  onChange={(e) =>
                    setNmStatsInput((p) => ({
                      ...p,
                      arbaletrierShotsSucceeded: Number(e.target.value),
                    }))
                  }
                />
              </label>
              <label className="bw-field">
                <span>Colosses éliminés (2 Kamikaze)</span>
                <input
                  type="number"
                  min={0}
                  value={nmStatsInput.colossiEliminatedByKamikaze}
                  onChange={(e) =>
                    setNmStatsInput((p) => ({
                      ...p,
                      colossiEliminatedByKamikaze: Number(e.target.value),
                    }))
                  }
                />
              </label>
            </div>
            <label className="bw-field">
              <span>Motif de modification</span>
              <input
                type="text"
                value={statsReason}
                onChange={(e) => setStatsReason(e.target.value)}
                placeholder="Ex : Restauration de statistiques"
              />
            </label>
            <button type="submit" className="bw-btn bw-btn-primary">
              💾 Enregistrer les statistiques
            </button>
          </form>
        </div>
      )}

      {/* 4. HISTORIQUE DES PARTIES */}
      {section === 'matches' && (
        <div className="bw-panel">
          <h3>4. Historique des parties</h3>
          <div className="bw-inline-form" style={{ marginBottom: '0.85rem' }}>
            <input
              type="text"
              value={matchSearchQuery}
              onChange={(e) => setMatchSearchQuery(e.target.value)}
              placeholder="Filtrer par joueur ou mode (matchmaking_ranked, local...)"
            />
          </div>
          {filteredMatches.length === 0 ? (
            <p className="bw-muted-small">Aucune partie trouvée.</p>
          ) : (
            <div className="bw-admin-table-wrap">
              <table className="bw-history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Mode</th>
                    <th>Rouge</th>
                    <th>Noir</th>
                    <th>Vainqueur</th>
                    <th>Tours</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMatches.map((m) => (
                    <tr key={m.id}>
                      <td>{new Date(m.endedAt).toLocaleString('fr-FR')}</td>
                      <td>{m.mode}</td>
                      <td>
                        {m.redUsername} ({m.redEloBefore}→{m.redEloAfter})
                      </td>
                      <td>
                        {m.blackUsername} ({m.blackEloBefore}→{m.blackEloAfter})
                      </td>
                      <td>
                        {m.winner === 'draw'
                          ? 'Nul'
                          : m.winner === 'red'
                            ? m.redUsername
                            : m.blackUsername}
                      </td>
                      <td>{m.turnsPlayed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5. GESTION DES COMPTES */}
      {section === 'accounts' && selectedUser && (
        <div className="bw-panel">
          <h3>5. Gestion des comptes — {selectedUser.username}</h3>
          <p className="bw-muted-small">
            ID : <code>{selectedUser.id}</code> • Rôle :{' '}
            <strong>{selectedUser.role ?? 'player'}</strong> • Créé le{' '}
            {new Date(selectedUser.createdAt).toLocaleDateString('fr-FR')}
          </p>
          <div className="bw-admin-stats-grid">
            <label className="bw-field">
              <span>Nom affiché</span>
              <input
                type="text"
                minLength={2}
                maxLength={24}
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
              />
            </label>
            <label className="bw-field">
              <span>Motif de suspension éventuel</span>
              <input
                type="text"
                value={suspendReasonInput}
                onChange={(e) => setSuspendReasonInput(e.target.value)}
                placeholder="Ex : Comportement inapproprié ou vérification requise"
              />
            </label>
          </div>
          <label className="bw-field">
            <span>Biographie publique</span>
            <textarea
              rows={2}
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
            />
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
            <button
              type="button"
              className="bw-btn bw-btn-primary"
              onClick={() => void handleUpdateAccount()}
            >
              💾 Enregistrer les informations du compte
            </button>
            {selectedUser.accountStatus !== 'suspended' ? (
              <button
                type="button"
                className="bw-btn bw-btn-danger"
                disabled={selectedUser.role === 'admin'}
                title={
                  selectedUser.role === 'admin'
                    ? 'Le compte administrateur principal ne peut pas être suspendu.'
                    : 'Suspendre ce compte et révoquer ses sessions actives'
                }
                onClick={() => void handleUpdateAccount('suspended')}
              >
                ⛔ Suspendre ce compte
              </button>
            ) : (
              <button
                type="button"
                className="bw-btn bw-btn-secondary"
                onClick={() => void handleUpdateAccount('active')}
              >
                ✅ Réactiver ce compte
              </button>
            )}
          </div>
        </div>
      )}

      {/* 6. JOURNAL DES ACTIONS ADMINISTRATEUR */}
      {section === 'logs' && (
        <div className="bw-panel">
          <h3>6. Journal des actions administrateur</h3>
          {!overview || overview.adminLogs.length === 0 ? (
            <p className="bw-muted-small">Aucune action administrateur enregistrée pour le moment.</p>
          ) : (
            <div className="bw-admin-table-wrap">
              <table className="bw-history-table">
                <thead>
                  <tr>
                    <th>Horodatage</th>
                    <th>Admin</th>
                    <th>Action</th>
                    <th>Cible</th>
                    <th>Résumé</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.adminLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{new Date(log.createdAtIso).toLocaleString('fr-FR')}</td>
                      <td>{log.adminUsername}</td>
                      <td>
                        <code>{log.actionType}</code>
                      </td>
                      <td>{log.targetUsername}</td>
                      <td>{log.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
