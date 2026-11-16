import React, { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  CARD_DOSSIERS,
  CARD_TYPES,
  CHARACTER_DOSSIERS,
  CHARACTER_TYPES,
  CUSTOM_CLOCK_PRESETS_SECONDS,
  DEFAULT_USER_PREFERENCES,
  FAQ_ITEMS,
  MECHANIC_DOSSIERS,
  OFFICIAL_RULESET_CONFIG,
  PREP_DURATION_PRESETS_SECONDS,
  RULE_SECTIONS,
  SETTINGS_HELP_ITEMS,
  TUTORIAL_SCENARIOS,
  computeEloUpdate,
  computeProfileCosmetics,
  createMatchState,
  createZeroNewMechanicsStats,
  isDesignatedAdminUsername,
  sanitizeUserPreferences,
  type CardPlayPayload,
  type CardType,
  type CharacterType,
  type ClientMatchView,
  type ClientNotificationItem,
  type Coord,
  type CustomRulesetConfig,
  type MoveCandidateKind,
  type NotificationCategory,
  type PlacementEntry,
  type PlayerColor,
  type ProfileAchievementId,
  type ProfileBannerId,
  type ProfileTitleId,
  type ServerMatchState,
  type UserPreferences,
} from '../../shared/src/index.js';
import type { RoomLobbySnapshot } from '../../server/src/rooms/roomManager.js';
import {
  apiFetchCurrentUser,
  apiFetchEloHistory,
  apiFetchLeaderboard,
  apiFetchMatchHistory,
  apiLogin,
  apiRegister,
  apiUpdateProfile,
  getOrCreateGuestId,
  getSavedAuthToken,
  isNotificationCategoryEnabled,
  isStandaloneFileMode,
  loadCompletedTutorialIds,
  loadDismissedContextualTips,
  loadNotifications,
  loadUserSettings,
  markTutorialScenarioCompleted,
  playTacticalSfx,
  resetContextualTips,
  resetUserSettings,
  saveNotifications,
  saveUserSettings,
  setSavedAuthToken,
  type ClientEloHistoryItem,
  type ClientMatchHistoryItem,
  type ClientUserProfile,
  type UserSettings,
} from './services/apiClient.js';
import { getBrowserStandaloneNode } from './services/browserP2PEngine.js';
import { AdminDashboardScreen } from './components/AdminDashboardScreen.js';
import { AvatarCropperModal } from './components/AvatarCropperModal.js';
import { NotificationCenter } from './components/NotificationCenter.js';
import {
  AVATAR_CHARACTER_OPTIONS,
  PieceArtwork,
  PieceAvatar,
  PieceDualVariantPreview,
  resolveCharacterFromLegacyBadge,
} from './components/PieceArtwork.js';
import { SettingsScreen } from './components/SettingsScreen.js';
import { ThemeProvider } from './themes/themeManager.js';
import { GameBoardScreen } from './ui/GameBoardScreen.js';

export type ScreenId =
  | 'home' // 1. Accueil
  | 'login' // 2. Connexion
  | 'register' // 3. Inscription
  | 'main_menu' // 4. Menu principal
  | 'matchmaking' // 5. Matchmaking
  | 'waiting_room' // 6. Salle d'attente
  | 'custom_create' // 7. Création de partie personnalisée
  | 'board' // 8. Plateau
  | 'characters_collection' // 9. Collection des personnages
  | 'cards_collection' // 10. Collection des cartes
  | 'rules' // 11. Règles
  | 'tutorial' // 12. Tutoriel
  | 'profile' // 13. Profil
  | 'stats' // 14. Statistiques
  | 'history' // 15. Historique
  | 'leaderboard' // 16. Classement
  | 'settings' // 17. Paramètres
  | 'admin' // Administration Kenktra_7003
  | 'victory' // 18. Victoire
  | 'defeat'; // 19. Défaite

export const App: React.FC = () => {
  const [screen, setScreen] = useState<ScreenId>('home');
  const [userProfile, setUserProfile] = useState<ClientUserProfile | null>(null);
  const [settings, setSettings] = useState<UserSettings>(() => loadUserSettings());

  // Auth form states
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authAvatar, setAuthAvatar] = useState('roi');
  const [authError, setAuthError] = useState<string | null>(null);

  // Profile edit states
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatar, setEditAvatar] = useState('roi');
  const [editBanner, setEditBanner] = useState<ProfileBannerId>('classic');
  const [editTitle, setEditTitle] = useState<ProfileTitleId>('recrue');
  const [editBadge, setEditBadge] = useState<ProfileAchievementId | null>(null);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [showAvatarCropper, setShowAvatarCropper] = useState(false);

  // Persistent app notifications & global anytime help modal
  const [notifications, setNotifications] = useState<ClientNotificationItem[]>(() => {
    const initial = loadNotifications();
    if (initial.length > 0) return initial;
    const initPrefs = loadUserSettings();
    if (!initPrefs.notifyUpdates) return [];
    return saveNotifications([
      {
        id: 'welcome-themes-v1',
        category: 'update',
        title: 'Thèmes & personnalisation disponibles',
        message:
          'Personnalisez votre thème (Rouge et noir, Vert et beige, Noir et blanc, Bleu et argent), photo de profil et accessibilité dans Paramètres.',
        createdAtIso: new Date().toISOString(),
        read: false,
        targetScreen: 'settings',
      },
    ]);
  });
  const [showGlobalHelpModal, setShowGlobalHelpModal] = useState(false);
  const [globalHelpTab, setGlobalHelpTab] = useState<'faq' | 'rules' | 'settings'>('faq');

  // Match history interactive filters
  const [historyFilterResult, setHistoryFilterResult] = useState<'all' | 'win' | 'loss' | 'draw'>('all');
  const [historyFilterMode, setHistoryFilterMode] = useState<string>('all');
  const [historyFilterPeriod, setHistoryFilterPeriod] = useState<'all' | 'today' | '7d' | '30d'>('all');

  // Data lists for Leaderboard, History, Stats
  const [leaderboard, setLeaderboard] = useState<ClientUserProfile[]>([]);
  const [matchHistory, setMatchHistory] = useState<ClientMatchHistoryItem[]>([]);
  const [eloHistory, setEloHistory] = useState<ClientEloHistoryItem[]>([]);

  // Active Match & Multiplayer Socket states
  const socketRef = useRef<Socket | null>(null);
  const socketIdentityRef = useRef<string | null>(null);
  const [myIdentity, setMyIdentity] = useState<{
    userId: string;
    username: string;
    isGuest: boolean;
  } | null>(null);
  const [connectionLost, setConnectionLost] = useState(false);
  const [queueInfo, setQueueInfo] = useState<{
    mode: string;
    waitingSeconds: number;
    playersInQueue: number;
    eloWindow: number | null;
  } | null>(null);
  const [p2pStatus, setP2pStatus] = useState<{
    nodeId?: string;
    connectedRelays: number;
    knownPeersCount: number;
    remotePlayersInQueue: number;
  }>({ connectedRelays: 0, knownPeersCount: 0, remotePlayersInQueue: 0 });
  const [mmError, setMmError] = useState<string | null>(null);
  const [boardSessionKind, setBoardSessionKind] = useState<'local' | 'online' | 'tutorial'>('local');
  const [localMatchState, setLocalMatchState] = useState<ServerMatchState>(() =>
    createMatchState('local-default', 'local'),
  );
  const [tutorialIndex, setTutorialIndex] = useState<number>(0);

  const [lobbySnapshot, setLobbySnapshot] = useState<RoomLobbySnapshot | null>(null);
  const [onlineMatchView, setOnlineMatchView] = useState<ClientMatchView | null>(null);
  const [matchmakingStatus, setMatchmakingStatus] = useState<string | null>(null);
  const [matchmakingMode, setMatchmakingMode] = useState<
    'matchmaking_quick' | 'matchmaking_ranked' | 'matchmaking_unranked'
  >('matchmaking_unranked');

  useEffect(() => {
    if (!userProfile && matchmakingMode === 'matchmaking_ranked') {
      setMatchmakingMode('matchmaking_unranked');
    }
  }, [userProfile, matchmakingMode]);

  // Custom room configuration form
  const [customPrepSec, setCustomPrepSec] = useState<number>(90);
  const [customClockSec, setCustomClockSec] = useState<number>(600);
  const [customMaxHand, setCustomMaxHand] = useState<number>(3);
  const [customEnabledCards, setCustomEnabledCards] = useState<CardType[]>([...CARD_TYPES]);
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [roomError, setRoomError] = useState<string | null>(null);

  // Post-match conclusion state for Victory (18) & Defeat (19) screens
  const [lastMatchResult, setLastMatchResult] = useState<{
    winner: PlayerColor | 'draw';
    perspectiveColor: PlayerColor;
    reason: string;
    turnsPlayed: number;
    mode: string;
    eloChange?: {
      myBefore: number;
      myAfter: number;
      myDelta: number;
      oppBefore: number;
      oppUsername: string;
    } | null;
  } | null>(null);

  // Selected character / card in collections & persistent tutorial progress
  const [selectedCharacterDossier, setSelectedCharacterDossier] =
    useState<CharacterType>('roi');
  const [selectedCardDossier, setSelectedCardDossier] = useState<CardType>('kamikaze');
  const [completedTutorialIds, setCompletedTutorialIds] = useState<string[]>(() =>
    loadCompletedTutorialIds(),
  );
  const [dismissedContextualIds, setDismissedContextualIds] = useState<string[]>(() =>
    loadDismissedContextualTips(),
  );

  const validCompletedTutorialIds = completedTutorialIds.filter((id) =>
    TUTORIAL_SCENARIOS.some((s) => s.id === id),
  );

  const handleTutorialCompleted = useCallback((scenId: string) => {
    const next = markTutorialScenarioCompleted(scenId);
    setCompletedTutorialIds(next);
  }, []);

  const syncProfileFormAndSettings = useCallback(
    (prof: ClientUserProfile) => {
      setUserProfile(prof);
      setEditDisplayName(prof.displayName ?? prof.username);
      setEditBio(prof.bio);
      setEditAvatar(prof.avatarBadge);
      setEditBanner(prof.profileBanner ?? 'classic');
      setEditTitle(prof.selectedTitle ?? 'recrue');
      setEditBadge(prof.selectedBadge ?? null);
      if (prof.preferences) {
        const synced = saveUserSettings(sanitizeUserPreferences(prof.preferences), prof.id);
        setSettings(synced);
      } else {
        setSettings(loadUserSettings(prof.id));
      }
    },
    [],
  );

  const pushAppNotification = useCallback(
    (
      category: NotificationCategory,
      title: string,
      message: string,
      targetScreen?: string,
    ) => {
      setSettings((currentPrefs) => {
        if (!isNotificationCategoryEnabled(category, currentPrefs)) {
          return currentPrefs;
        }
        const entry: ClientNotificationItem = {
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          category,
          title,
          message,
          createdAtIso: new Date().toISOString(),
          read: false,
          targetScreen,
        };
        setNotifications((prev) => saveNotifications([entry, ...prev]));
        return currentPrefs;
      });
    },
    [],
  );

  const handleUpdateSettings = useCallback(
    async (nextPrefs: UserPreferences) => {
      const saved = saveUserSettings(nextPrefs, userProfile?.id);
      setSettings(saved);
      if (userProfile) {
        try {
          const updated = await apiUpdateProfile({ preferences: saved });
          setUserProfile(updated);
        } catch {
          // Keeps saved local preferences immediately even if offline momentarily
        }
      }
    },
    [userProfile],
  );

  const handleResetAllSettings = useCallback(async () => {
    const reset = resetUserSettings(userProfile?.id);
    setSettings(reset);
    if (userProfile) {
      try {
        const updated = await apiUpdateProfile({ preferences: reset });
        setUserProfile(updated);
      } catch {
        // Ignore offline fallback
      }
    }
    pushAppNotification(
      'account',
      'Paramètres réinitialisés',
      'Tous les paramètres et le thème d’origine ont été rétablis.',
    );
  }, [userProfile, pushAppNotification]);

  useEffect(() => {
    void apiFetchCurrentUser().then((prof) => {
      if (prof) {
        syncProfileFormAndSettings(prof);
      }
      // Connexion temps réel dès l'ouverture : permet de reprendre automatiquement une partie
      // en ligne après un rechargement de page (reconnexion < 60 s, §12.2).
      ensureSocket(prof?.username);
    });
    return () => {
      if (typeof (socketRef.current as any)?.disconnect === 'function') {
        (socketRef.current as any).disconnect();
      }
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Ferme la connexion temps réel (changement de compte : connexion / déconnexion). */
  const resetSocket = () => {
    socketRef.current?.removeAllListeners();
    if (typeof (socketRef.current as any)?.disconnect === 'function') {
      (socketRef.current as any).disconnect();
    }
    socketRef.current = null;
    socketIdentityRef.current = null;
    setMyIdentity(null);
    setQueueInfo(null);
    setMatchmakingStatus(null);
  };

  // Connect Socket.IO client or Browser Standalone P2P Node (when opened directly from BLIND-WAR-JOUER.html)
  const ensureSocket = (usernameOverride?: string): Socket => {
    const token = getSavedAuthToken();
    const identityKey = token ?? 'guest';
    if (socketRef.current && socketIdentityRef.current === identityKey) {
      return socketRef.current;
    }
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      if (typeof (socketRef.current as any)?.disconnect === 'function') {
        (socketRef.current as any).disconnect();
      }
    }
    const guestId = getOrCreateGuestId();
    const effectiveUsername =
      usernameOverride ?? userProfile?.username ?? `Commandant-${guestId.slice(-4)}`;

    const sock: any = isStandaloneFileMode()
      ? getBrowserStandaloneNode()
      : io({
          auth: {
            token,
            guestId,
            username: effectiveUsername,
          },
        });

    sock.on('connect', () => setConnectionLost(false));
    sock.on('disconnect', () => setConnectionLost(true));

    sock.on('session:identity', (identity: { userId: string; username: string; isGuest: boolean }) => {
      setMyIdentity(identity);
    });

    sock.on(
      'p2p:status',
      (st: {
        nodeId?: string;
        connectedRelays: number;
        knownPeersCount: number;
        remotePlayersInQueue: number;
      }) => {
        setP2pStatus(st);
      },
    );

    sock.on(
      'matchmaking:status',
      (status: {
        mode: string;
        waitingSeconds: number;
        playersInQueue: number;
        eloWindow: number | null;
      }) => {
        setQueueInfo(status);
      },
    );

    sock.on('room:closed', (payload: { reason: string }) => {
      setLobbySnapshot(null);
      setRoomError(payload.reason);
      pushAppNotification('message', 'Salon fermé', payload.reason, 'custom_create');
      setScreen('custom_create');
    });

    sock.on('room:lobby_sync', (lobby: RoomLobbySnapshot) => {
      setLobbySnapshot((prevLobby) => {
        if (!prevLobby && lobby) {
          pushAppNotification(
            'invitation',
            `Salon #${lobby.roomId}`,
            'Vous avez rejoint un salon multijoueur.',
            'waiting_room',
          );
        }
        return lobby;
      });
      if (!lobby.matchStarted) {
        setScreen('waiting_room');
      }
    });

    sock.on('game:state_sync', (view: ClientMatchView) => {
      setOnlineMatchView((prev) => {
        if (!prev) {
          pushAppNotification(
            'match_start',
            'Partie démarrée',
            `Votre affrontement (${view.mode}) a commencé.`,
          );
        }
        return view;
      });
      setMatchmakingStatus(null);
      setQueueInfo(null);
      setBoardSessionKind('online');
      setScreen('board');
    });

    socketRef.current = sock;
    socketIdentityRef.current = identityKey;
    if (isStandaloneFileMode() && typeof sock.configureIdentity === 'function') {
      sock.configureIdentity({ token, guestId, username: effectiveUsername });
    }
    return sock;
  };

  useEffect(() => {
    if (screen === 'leaderboard') {
      void apiFetchLeaderboard().then(setLeaderboard);
    } else if (screen === 'history' || screen === 'stats' || screen === 'profile') {
      void apiFetchMatchHistory(userProfile?.id).then(setMatchHistory);
      if (userProfile) {
        void apiFetchEloHistory(userProfile.id).then(setEloHistory);
      }
    }
  }, [screen, userProfile]);

  const startNewLocalGame = (customRules?: Partial<CustomRulesetConfig>) => {
    setLocalMatchState(createMatchState(`local-${Date.now()}`, 'local', customRules));
    setBoardSessionKind('local');
    setScreen('board');
  };

  const startTutorialScenario = (idx: number) => {
    setTutorialIndex(idx);
    setBoardSessionKind('tutorial');
    setScreen('board');
  };

  const handleMatchConcluded = (summary: {
    winner: PlayerColor | 'draw';
    perspectiveColor: PlayerColor;
    reason: string;
    turnsPlayed: number;
    mode: string;
  }) => {
    let eloChange: {
      myBefore: number;
      myAfter: number;
      myDelta: number;
      oppBefore: number;
      oppUsername: string;
    } | null = null;

    if (summary.mode === 'matchmaking_ranked') {
      const redBefore =
        lobbySnapshot?.eloResult?.redPrevious ??
        lobbySnapshot?.redPlayer?.eloRating ??
        (summary.perspectiveColor === 'red' ? (userProfile?.eloRating ?? 200) : 200);
      const blackBefore =
        lobbySnapshot?.eloResult?.blackPrevious ??
        lobbySnapshot?.blackPlayer?.eloRating ??
        (summary.perspectiveColor === 'black' ? (userProfile?.eloRating ?? 200) : 200);
      const computed =
        lobbySnapshot?.eloResult ??
        computeEloUpdate('matchmaking_ranked', redBefore, blackBefore, summary.winner);
      const isRed = summary.perspectiveColor === 'red';
      eloChange = {
        myBefore: isRed ? computed.redPrevious : computed.blackPrevious,
        myAfter: isRed ? computed.redNext : computed.blackNext,
        myDelta: isRed ? computed.redDelta : computed.blackDelta,
        oppBefore: isRed ? computed.blackPrevious : computed.redPrevious,
        oppUsername: isRed
          ? (lobbySnapshot?.blackPlayer?.username ?? 'Adversaire')
          : (lobbySnapshot?.redPlayer?.username ?? 'Adversaire'),
      };

      if (userProfile) {
        const nextWins = userProfile.wins + (summary.winner === summary.perspectiveColor ? 1 : 0);
        const nextDraws = userProfile.draws + (summary.winner === 'draw' ? 1 : 0);
        const nextLosses =
          userProfile.losses +
          (summary.winner !== 'draw' && summary.winner !== summary.perspectiveColor ? 1 : 0);
        const nextGames = userProfile.gamesPlayed + 1;
        setUserProfile({
          ...userProfile,
          eloRating: eloChange.myAfter,
          wins: nextWins,
          draws: nextDraws,
          losses: nextLosses,
          gamesPlayed: nextGames,
          winRatePercent: nextGames > 0 ? Math.round((nextWins / nextGames) * 1000) / 10 : 0,
        });
      }
    }

    setLastMatchResult({ ...summary, eloChange });
    pushAppNotification(
      'match_start',
      summary.winner === summary.perspectiveColor
        ? 'Victoire enregistrée !'
        : summary.winner === 'draw'
          ? 'Match nul enregistré'
          : 'Fin de partie enregistrée',
      `Résultat (${summary.mode}) en ${summary.turnsPlayed} tour(s).`,
      'history',
    );
    void apiFetchCurrentUser().then((prof) => {
      if (prof) setUserProfile(prof);
    });
    setTimeout(() => {
      void apiFetchCurrentUser().then((prof) => {
        if (prof) setUserProfile(prof);
      });
    }, 350);
    if (summary.winner === summary.perspectiveColor) {
      setScreen('victory');
    } else {
      setScreen('defeat');
    }
  };

  // Top persistent navigation bar (visible on all non-board screens)
  const renderGlobalNavbar = () => (
    <nav className="bw-navbar" aria-label="Navigation principale BLIND WAR">
      <div className="bw-nav-brand" onClick={() => setScreen('home')}>
        <span className="bw-brand-emblem">
          <PieceArtwork character="roi" owner="red" size="xs" />
        </span>
        <span className="bw-brand-title">BLIND WAR</span>
        <span className="bw-brand-tag">9×9 • IDENTITÉS CACHÉES</span>
      </div>

      <div className="bw-nav-links">
        <button
          type="button"
          className={`bw-nav-link ${screen === 'main_menu' ? 'active' : ''}`}
          onClick={() => setScreen('main_menu')}
        >
          Menu
        </button>
        <button
          type="button"
          className="bw-btn bw-btn-primary bw-btn-sm"
          onClick={() => startNewLocalGame()}
        >
          ▶ Jouer
        </button>
        <button
          type="button"
          className={`bw-nav-link ${screen === 'matchmaking' ? 'active' : ''}`}
          onClick={() => setScreen('matchmaking')}
        >
          Multijoueur
        </button>
        <button
          type="button"
          className={`bw-nav-link ${screen === 'tutorial' ? 'active' : ''}`}
          onClick={() => setScreen('tutorial')}
        >
          Tutoriel
        </button>
        <button
          type="button"
          className={`bw-nav-link ${
            screen === 'characters_collection' || screen === 'cards_collection' || screen === 'rules'
              ? 'active'
              : ''
          }`}
          onClick={() => setScreen('characters_collection')}
        >
          Encyclopédie
        </button>
        <button
          type="button"
          className={`bw-nav-link ${
            screen === 'history' || screen === 'leaderboard' || screen === 'stats' ? 'active' : ''
          }`}
          onClick={() => setScreen('leaderboard')}
        >
          Classement
        </button>
        <button
          type="button"
          className={`bw-nav-link ${screen === 'settings' ? 'active' : ''}`}
          onClick={() => setScreen('settings')}
          title="Paramètres et Thèmes"
        >
          ⚙️ Thèmes & Options
        </button>
        {userProfile?.role === 'admin' && isDesignatedAdminUsername(userProfile.username) && (
          <button
            type="button"
            className={`bw-nav-link ${screen === 'admin' ? 'active' : ''}`}
            onClick={() => setScreen('admin')}
            title="Panneau d'administration sécurisé"
          >
            🛡️ Admin
          </button>
        )}
      </div>

      <div className="bw-nav-auth">
        <button
          type="button"
          className="bw-btn bw-btn-ghost bw-btn-sm"
          onClick={() =>
            void handleUpdateSettings({
              ...settings,
              colorMode: settings.colorMode === 'dark' ? 'light' : 'dark',
            })
          }
          title={
            settings.colorMode === 'dark'
              ? 'Passer en mode clair immédiatement'
              : 'Passer en mode sombre immédiatement'
          }
          aria-label="Basculer entre mode sombre et mode clair"
        >
          {settings.colorMode === 'dark' ? '☀️ Clair' : '🌙 Sombre'}
        </button>

        <button
          type="button"
          className="bw-btn bw-btn-ghost bw-btn-sm"
          onClick={() => setShowGlobalHelpModal(true)}
          title="Aide rapide, FAQ et Règles à tout moment"
        >
          ❓ Aide
        </button>

        <NotificationCenter
          notifications={notifications}
          onMarkRead={(id) =>
            setNotifications((prev) =>
              saveNotifications(prev.map((n) => (n.id === id ? { ...n, read: true } : n))),
            )
          }
          onMarkAllRead={() =>
            setNotifications((prev) => saveNotifications(prev.map((n) => ({ ...n, read: true }))))
          }
          onClearAll={() => setNotifications(saveNotifications([]))}
          onNavigate={(target) => setScreen(target as ScreenId)}
        />

        {userProfile ? (
          <button
            type="button"
            className="bw-user-chip"
            onClick={() => setScreen('profile')}
          >
            <PieceAvatar
              badge={userProfile.avatarBadge}
              avatarImage={userProfile.avatarImage}
              alt={userProfile.displayName ?? userProfile.username}
              owner="red"
              size="xs"
            />
            <span>{userProfile.displayName ?? userProfile.username}</span>
            <span className="bw-elo-pill">{userProfile.eloRating} ELO</span>
          </button>
        ) : (
          <div className="bw-auth-buttons">
            <button
              type="button"
              className="bw-btn bw-btn-ghost bw-btn-sm"
              onClick={() => setScreen('login')}
            >
              Connexion
            </button>
            <button
              type="button"
              className="bw-btn bw-btn-secondary bw-btn-sm"
              onClick={() => setScreen('register')}
            >
              Inscription
            </button>
          </div>
        )}
      </div>
    </nav>
  );

  // Page 8: Plateau de jeu
  if (screen === 'board') {
    const activeTutorial = TUTORIAL_SCENARIOS[tutorialIndex] ?? TUTORIAL_SCENARIOS[0];
    const activeOnlineRoomId = lobbySnapshot?.roomId ?? onlineMatchView?.matchId ?? null;
    return (
      <ThemeProvider preferences={settings}>
        <GameBoardScreen
        mode={boardSessionKind}
        initialLocalState={localMatchState}
        onlineView={onlineMatchView}
        onlineRoomId={activeOnlineRoomId}
        onlinePrepRemainingSec={lobbySnapshot?.prepRemainingSeconds ?? null}
        tutorialScenario={boardSessionKind === 'tutorial' ? activeTutorial : null}
        settings={settings}
        onOnlineAction={
          boardSessionKind === 'online' && activeOnlineRoomId
            ? {
                submitPlacement: (entries: readonly PlacementEntry[]) => {
                  ensureSocket().emit('game:place', {
                    roomId: activeOnlineRoomId,
                    entries,
                  });
                },
                movePiece: (
                  pieceId: string,
                  destination: Coord,
                  preferredKind?: MoveCandidateKind,
                ) => {
                  ensureSocket().emit('game:move', {
                    roomId: activeOnlineRoomId,
                    pieceId,
                    destination,
                    preferredKind,
                  });
                },
                markTraqueur: (traqueurPieceId: string, targetEnemyPieceId: string) => {
                  ensureSocket().emit('game:mark_traqueur', {
                    roomId: activeOnlineRoomId,
                    traqueurPieceId,
                    targetEnemyPieceId,
                  });
                },
                stopJump: () => {
                  ensureSocket().emit('game:stop_jump', { roomId: activeOnlineRoomId });
                },
                skipRage: () => {
                  ensureSocket().emit('game:skip_rage', { roomId: activeOnlineRoomId });
                },
                promoteSoldier: (chosenCharacter: CharacterType) => {
                  ensureSocket().emit('game:promote', {
                    roomId: activeOnlineRoomId,
                    chosenCharacter,
                  });
                },
                playCard: (cardPayload: CardPlayPayload) => {
                  ensureSocket().emit('game:play_card', {
                    roomId: activeOnlineRoomId,
                    cardPayload,
                  });
                },
                offerDraw: () => {
                  ensureSocket().emit('game:draw_offer', { roomId: activeOnlineRoomId });
                },
                resign: () => {
                  ensureSocket().emit('game:resign', { roomId: activeOnlineRoomId });
                },
              }
            : undefined
        }
        onMatchConcluded={handleMatchConcluded}
        onExitToMenu={() => setScreen('main_menu')}
        onTutorialCompleted={handleTutorialCompleted}
        onNextTutorialStep={
          boardSessionKind === 'tutorial'
            ? () => {
                if (tutorialIndex + 1 < TUTORIAL_SCENARIOS.length) {
                  setTutorialIndex(tutorialIndex + 1);
                } else {
                  setScreen('tutorial');
                }
              }
            : undefined
        }
      />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider preferences={settings}>
      <div className="bw-app-shell">
      {renderGlobalNavbar()}

      <main className="bw-page-container">
        {/* 1. PAGE D'ACCUEIL */}
        {screen === 'home' && (
          <section className="bw-hero-section">
            <div className="bw-hero-badge">STRATÉGIE MILITAIRE À IDENTITÉS CACHÉES</div>
            <h1 className="bw-hero-title">BLIND WAR</h1>
            <p className="bw-hero-subtitle">
              9 × 9 cases. 27 pièces par armée. Toutes les positions sont visibles, mais chaque
              identité adverse est un secret mortel. Anticipez, infiltrez avec vos Guetteurs et vos
              Assassins, maîtrisez les 16 cartes tactiques et éliminez le Roi ennemi.
            </p>
            <div className="bw-hero-cta-row">
              <button
                type="button"
                className="bw-btn bw-btn-primary bw-btn-lg"
                onClick={() => startNewLocalGame()}
              >
                Jouer en Mode Local (2 Joueurs)
              </button>
              <button
                type="button"
                className="bw-btn bw-btn-secondary bw-btn-lg"
                onClick={() => setScreen('matchmaking')}
              >
                🌐 Multijoueur & Matchmaking ELO
              </button>
              <button
                type="button"
                className="bw-btn bw-btn-secondary bw-btn-lg"
                onClick={() => setScreen('tutorial')}
              >
                🎓 Mode Entraînement & Tutoriel
              </button>
            </div>

            <div className="bw-feature-grid">
              <div className="bw-feature-card" onClick={() => setScreen('characters_collection')}>
                <h3>12 Rôles Asymétriques (27 Pièces)</h3>
                <p>
                  Roi, Reine, Colosse, Cavalier, Berserker, Assassin, Guetteurs H & D, Soldats
                  promouvables, ainsi que le Traqueur, l’Exécuteur et l’Arbalétrier.
                </p>
              </div>
              <div className="bw-feature-card" onClick={() => setScreen('cards_collection')}>
                <h3>🃏 16 Cartes Tactiques</h3>
                <p>
                  Kamikaze, Invincibilité, Protection, Espionnage (2 cibles au choix), Brouillard,
                  Double action, Piège, Téléportation, Résurrection, Sacrifice...
                </p>
              </div>
              <div className="bw-feature-card" onClick={() => setScreen('rules')}>
                <h3>🔒 Serveur Autoritaire & Anti-Triche</h3>
                <p>
                  Pendule d’échecs de 10 minutes par joueur, départ officiel à 200 ELO, cimetière
                  confidentiel et zéro fuite d’identité réseau.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* 2. PAGE CONNEXION */}
        {screen === 'login' && (
          <section className="bw-auth-card">
            <h2>Connexion au Quartier Général</h2>
            <p className="bw-muted-small">
              Retrouvez votre profil, votre classement ELO et votre historique de parties.
            </p>
            {authError && <div className="bw-error-box">{authError}</div>}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setAuthError(null);
                try {
                  const res = await apiLogin(authUsername, authPassword);
                  syncProfileFormAndSettings(res.profile);
                  resetSocket();
                  ensureSocket(res.profile.username);
                  pushAppNotification(
                    'account',
                    'Connexion réussie',
                    `Bienvenue, ${res.profile.displayName ?? res.profile.username} ! Votre thème et vos réglages ont été chargés.`,
                  );
                  playTacticalSfx('card');
                  setScreen('main_menu');
                } catch (err) {
                  setAuthError(err instanceof Error ? err.message : 'Erreur de connexion');
                }
              }}
            >
              <label className="bw-field">
                <span>Nom d’utilisateur</span>
                <input
                  type="text"
                  required
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  placeholder="Ex: CommandantRouge"
                />
              </label>
              <label className="bw-field">
                <span>Mot de passe</span>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </label>
              <div className="bw-form-actions">
                <button type="submit" className="bw-btn bw-btn-primary">
                  Se Connecter
                </button>
                <button
                  type="button"
                  className="bw-btn bw-btn-ghost"
                  onClick={() => setScreen('register')}
                >
                  Créer un compte (200 ELO)
                </button>
              </div>
            </form>
          </section>
        )}

        {/* 3. PAGE INSCRIPTION */}
        {screen === 'register' && (
          <section className="bw-auth-card">
            <h2>Inscription Officielle (Départ : 200 ELO)</h2>
            <p className="bw-muted-small">
              Créez votre compte sécurisé pour participer au classement officiel de BLIND WAR.
            </p>
            {authError && <div className="bw-error-box">{authError}</div>}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setAuthError(null);
                try {
                  const res = await apiRegister(authUsername, authPassword, authAvatar);
                  syncProfileFormAndSettings(res.profile);
                  resetSocket();
                  ensureSocket(res.profile.username);
                  pushAppNotification(
                    'account',
                    'Compte créé à 200 ELO',
                    `Bienvenue dans BLIND WAR, ${res.profile.displayName ?? res.profile.username} !`,
                    'profile',
                  );
                  playTacticalSfx('card');
                  setScreen('main_menu');
                } catch (err) {
                  setAuthError(err instanceof Error ? err.message : 'Erreur d’inscription');
                }
              }}
            >
              <label className="bw-field">
                <span>Nom d’utilisateur (3 à 24 caractères)</span>
                <input
                  type="text"
                  required
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  placeholder="Ex: StrategeNoir"
                />
              </label>
              <label className="bw-field">
                <span>Mot de passe (minimum 6 caractères)</span>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </label>
              <label className="bw-field">
                <span>Emblème d’unité</span>
                <div className="bw-avatar-picker">
                  {AVATAR_CHARACTER_OPTIONS.map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      className={`bw-avatar-btn ${resolveCharacterFromLegacyBadge(authAvatar) === ch ? 'selected' : ''}`}
                      onClick={() => setAuthAvatar(ch)}
                      title={CHARACTER_DOSSIERS[ch].name}
                    >
                      <PieceArtwork character={ch} owner="red" size="sm" />
                    </button>
                  ))}
                </div>
              </label>
              <div className="bw-form-actions">
                <button type="submit" className="bw-btn bw-btn-primary">
                  S’inscrire à 200 ELO
                </button>
                <button
                  type="button"
                  className="bw-btn bw-btn-ghost"
                  onClick={() => setScreen('login')}
                >
                  Déjà inscrit ? Connexion
                </button>
              </div>
            </form>
          </section>
        )}

        {/* 4. MENU PRINCIPAL */}
        {screen === 'main_menu' && (
          <section className="bw-dashboard">
            <h2>Menu Principal — Centre de Commandement</h2>
            <div className="bw-menu-grid">
              <div className="bw-menu-card bw-menu-card-highlight">
                <h3>Mode Local (2 Joueurs)</h3>
                <p>
                  Affrontez un adversaire sur le même écran avec rideau de confidentialité privé
                  entre chaque tour.
                </p>
                <button
                  type="button"
                  className="bw-btn bw-btn-primary"
                  onClick={() => startNewLocalGame()}
                >
                  Lancer une Partie Locale
                </button>
              </div>

              <div className="bw-menu-card">
                <h3>🌐 Matchmaking En Ligne</h3>
                <p>
                  Partie rapide, Matchmaking Classé (ELO officiel) ou Non Classé avec
                  synchronisation serveur temps réel.
                </p>
                <button
                  type="button"
                  className="bw-btn bw-btn-secondary"
                  onClick={() => setScreen('matchmaking')}
                >
                  Ouvrir le Matchmaking
                </button>
              </div>

              <div className="bw-menu-card">
                <h3>🛠️ Partie Personnalisée</h3>
                <p>
                  Créez une salle privée avec code d’invitation, pendule 3 à 30 min, temps de
                  préparation et sélection des cartes.
                </p>
                <button
                  type="button"
                  className="bw-btn bw-btn-secondary"
                  onClick={() => setScreen('custom_create')}
                >
                  Créer / Rejoindre une Salle
                </button>
              </div>

              <div className="bw-menu-card">
                <h3>🎓 Entraînement & Tutoriel</h3>
                <p>
                  {TUTORIAL_SCENARIOS.length} scénarios interactifs guidés pour maîtriser les
                  Guetteurs, l’Assassin, le Cavalier, le Colosse, le Traqueur, l’Exécuteur,
                  l’Arbalétrier et les 16 cartes.
                </p>
                <button
                  type="button"
                  className="bw-btn bw-btn-secondary"
                  onClick={() => setScreen('tutorial')}
                >
                  Lancer le Tutoriel
                </button>
              </div>

              <div className="bw-menu-card">
                <h3>Collection des Personnages</h3>
                <p>Consultez les fiches détaillées et schémas de déplacement des 12 personnages.</p>
                <button
                  type="button"
                  className="bw-btn bw-btn-ghost"
                  onClick={() => setScreen('characters_collection')}
                >
                  Voir les 12 Personnages
                </button>
              </div>

              <div className="bw-menu-card">
                <h3>🃏 Collection des 16 Cartes</h3>
                <p>Découvrez toutes les cartes, leurs durées, restrictions et secrets.</p>
                <button
                  type="button"
                  className="bw-btn bw-btn-ghost"
                  onClick={() => setScreen('cards_collection')}
                >
                  Voir les 16 Cartes
                </button>
              </div>

              <div className="bw-menu-card">
                <h3>🏆 Classement, Profil & Stats</h3>
                <p>Consultez le classement ELO, vos statistiques et l’historique des parties.</p>
                <div className="bw-card-btn-group">
                  <button
                    type="button"
                    className="bw-btn bw-btn-ghost bw-btn-sm"
                    onClick={() => setScreen('leaderboard')}
                  >
                    Classement
                  </button>
                  <button
                    type="button"
                    className="bw-btn bw-btn-ghost bw-btn-sm"
                    onClick={() => setScreen('stats')}
                  >
                    Statistiques
                  </button>
                  <button
                    type="button"
                    className="bw-btn bw-btn-ghost bw-btn-sm"
                    onClick={() => setScreen('history')}
                  >
                    Historique
                  </button>
                  <button
                    type="button"
                    className="bw-btn bw-btn-ghost bw-btn-sm"
                    onClick={() => setScreen('profile')}
                  >
                    Profil
                  </button>
                </div>
              </div>

              <div className="bw-menu-card">
                <h3>📖 Règles & Paramètres</h3>
                <p>Encyclopédie complète des règles officielles et préférences de jeu.</p>
                <div className="bw-card-btn-group">
                  <button
                    type="button"
                    className="bw-btn bw-btn-ghost bw-btn-sm"
                    onClick={() => setScreen('rules')}
                  >
                    Encyclopédie
                  </button>
                  <button
                    type="button"
                    className="bw-btn bw-btn-ghost bw-btn-sm"
                    onClick={() => setScreen('settings')}
                  >
                    Paramètres
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 5. PAGE MATCHMAKING */}
        {screen === 'matchmaking' && (
          <section className="bw-panel-page">
            <h2>🌐 Matchmaking Automatique (§12.3)</h2>
            <p>
              Sélectionnez votre file de recherche. Les parties classées sont réservées aux joueurs
              inscrits et mettent à jour votre classement ELO (départ officiel : 200 ELO, fenêtre
              d’appariement ±100 ELO qui s’élargit toutes les 10s).
            </p>

            {connectionLost && (
              <div className="bw-error-box">
                ⚠️ Connexion au serveur temps réel interrompue. Tentative de reconnexion...
              </div>
            )}

            {mmError && <div className="bw-error-box">⚠️ {mmError}</div>}

            <div className="bw-panel">
              <div className="bw-panel-header-row">
                <span>
                  🌐 <strong>Réseau Décentralisé P2P (Multi-PC sans configuration) :</strong>{' '}
                  {p2pStatus.connectedRelays > 0 ? (
                    <span className="bw-text-green">
                      Actif ({p2pStatus.connectedRelays} relais mondiaux + LAN)
                    </span>
                  ) : (
                    <span>LAN local actif (connexion aux relais mondiaux...)</span>
                  )}
                </span>
                <span className="bw-mode-pill">
                  🖥️ Autres PC détectés : {p2pStatus.knownPeersCount} • En recherche distante :{' '}
                  {p2pStatus.remotePlayersInQueue}
                </span>
              </div>
              <p className="bw-muted-small">
                Si un ami lance aussi <code>LANCER-BLIND-WAR.bat</code> sur son propre PC (même à
                distance sur un autre Wi-Fi), vos comptes, le classement ELO et le matchmaking sont
                automatiquement reliés en pair-à-pair.
              </p>
            </div>

            {!userProfile && (
              <div className="bw-panel bw-ranked-lock-callout">
                <p>
                  🔒 <strong>Mode Classé réservé aux comptes connectés :</strong> vous jouez
                  actuellement en tant qu’<strong>Invité</strong> ({myIdentity?.username ?? 'Invité'}
                  ). Inscrivez-vous ou connectez-vous avec un compte pour pouvoir lancer des parties{' '}
                  <strong>Classées (ELO)</strong>. Vous pouvez tout de même jouer en{' '}
                  <strong>Non Classé</strong> ou <strong>Partie Rapide</strong>.
                </p>
                <div className="bw-form-actions">
                  <button
                    type="button"
                    className="bw-btn bw-btn-primary bw-btn-sm"
                    onClick={() => setScreen('register')}
                  >
                    Créer un Compte (200 ELO)
                  </button>
                  <button
                    type="button"
                    className="bw-btn bw-btn-secondary bw-btn-sm"
                    onClick={() => setScreen('login')}
                  >
                    Se Connecter
                  </button>
                </div>
              </div>
            )}

            <div className="bw-mm-modes">
              {[
                {
                  id: 'matchmaking_ranked' as const,
                  title: '🏆 Matchmaking Classé (ELO)',
                  desc: 'Règles officielles (90s prépa, 10 min pendule, 16 cartes). Compte requis, modifie votre ELO.',
                },
                {
                  id: 'matchmaking_unranked' as const,
                  title: 'Matchmaking Non Classé',
                  desc: 'Règles officielles sans impact sur votre classement ELO (ouvert aux invités).',
                },
                {
                  id: 'matchmaking_quick' as const,
                  title: '⚡ Partie Rapide',
                  desc: 'Association immédiate avec le premier adversaire disponible (ouvert aux invités).',
                },
              ].map((m) => {
                const isLockedForGuest = m.id === 'matchmaking_ranked' && !userProfile;
                return (
                  <div
                    key={m.id}
                    aria-disabled={isLockedForGuest}
                    className={`bw-mm-card ${matchmakingMode === m.id ? 'selected' : ''} ${isLockedForGuest ? 'bw-mm-card-locked' : ''}`}
                    onClick={() => {
                      if (isLockedForGuest) {
                        setMmError(
                          'Compte requis : veuillez vous inscrire ou vous connecter pour jouer en Classé.',
                        );
                        return;
                      }
                      setMmError(null);
                      setMatchmakingMode(m.id);
                    }}
                  >
                    <div className="bw-mm-card-head">
                      <h3>{m.title}</h3>
                      {isLockedForGuest && (
                        <span className="bw-mm-lock-badge">🔒 Compte requis</span>
                      )}
                    </div>
                    <p>{m.desc}</p>
                  </div>
                );
              })}
            </div>

            <div className="bw-mm-controls">
              {matchmakingStatus ? (
                <div className="bw-mm-searching">
                  <div className="bw-spinner" />
                  <div>
                    <div>
                      <strong>{matchmakingStatus}</strong>
                    </div>
                    {queueInfo && (
                      <small className="bw-muted-small">
                        Attente : {queueInfo.waitingSeconds}s • Joueurs dans cette file :{' '}
                        {queueInfo.playersInQueue}
                        {queueInfo.eloWindow !== null
                          ? ` • Fenêtre ELO : ±${queueInfo.eloWindow}`
                          : ''}
                      </small>
                    )}
                  </div>
                  <button
                    type="button"
                    className="bw-btn bw-btn-danger"
                    onClick={() => {
                      ensureSocket().emit('matchmaking:leave');
                      setMatchmakingStatus(null);
                      setQueueInfo(null);
                    }}
                  >
                    Annuler la recherche
                  </button>
                </div>
              ) : (
                <div className="bw-form-actions">
                  <button
                    type="button"
                    className="bw-btn bw-btn-primary bw-btn-lg"
                    disabled={!userProfile && matchmakingMode === 'matchmaking_ranked'}
                    onClick={() => {
                      if (!userProfile && matchmakingMode === 'matchmaking_ranked') {
                        setMmError(
                          'Compte requis : veuillez vous inscrire ou vous connecter pour jouer en Classé.',
                        );
                        return;
                      }
                      setMmError(null);
                      const sock = ensureSocket();
                      setMatchmakingStatus(`Recherche d’un adversaire (${matchmakingMode})...`);
                      sock.emit(
                        'matchmaking:join',
                        { mode: matchmakingMode },
                        (res: { ok: boolean; matched?: boolean; error?: string }) => {
                          if (!res.ok) {
                            setMatchmakingStatus(null);
                            setQueueInfo(null);
                            setMmError(res.error ?? 'Erreur réseau');
                          }
                        },
                      );
                    }}
                  >
                    🔍 Rechercher un Adversaire
                  </button>

                  <button
                    type="button"
                    className="bw-btn bw-btn-secondary bw-btn-lg"
                    onClick={() => {
                      window.open(`${window.location.pathname}?isolatedTab=1`, '_blank', 'noopener');
                    }}
                    title="Ouvre un second onglet avec une session indépendante pour tester le matchmaking sur le même PC"
                  >
                    🧪 Ouvrir un 2e Onglet Joueur (Test Localhost)
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 6. SALLE D'ATTENTE */}
        {screen === 'waiting_room' && lobbySnapshot && (
          <section className="bw-panel-page">
            <h2>⏳ Salle d’Attente — Code : {lobbySnapshot.roomCode}</h2>
            <p>
              Partagez le code <strong>{lobbySnapshot.roomCode}</strong> avec votre ami (ou ouvrez un{' '}
              <button
                type="button"
                className="bw-btn bw-btn-ghost bw-btn-sm"
                onClick={() => window.open(`${window.location.pathname}?isolatedTab=1`, '_blank', 'noopener')}
              >
                2e onglet joueur isolé
              </button>
              ) pour qu’il rejoigne la salle. Les règles ci-dessous sont visibles par les deux
              joueurs avant le lancement (§12.4).
            </p>
            {roomError && <div className="bw-error-box">{roomError}</div>}

            <div className="bw-lobby-players">
              <div className="bw-lobby-slot bw-slot-red">
                <h4>🔴 Camp Rouge (Hôte — Commence la partie)</h4>
                {lobbySnapshot.redPlayer ? (
                  <p>
                    <strong>{lobbySnapshot.redPlayer.username}</strong> (
                    {lobbySnapshot.redPlayer.eloRating} ELO)
                  </p>
                ) : (
                  <p>En attente...</p>
                )}
              </div>
              <div className="bw-lobby-slot bw-slot-black">
                <h4>⚫ Camp Noir</h4>
                {lobbySnapshot.blackPlayer ? (
                  <p>
                    <strong>{lobbySnapshot.blackPlayer.username}</strong> (
                    {lobbySnapshot.blackPlayer.eloRating} ELO)
                  </p>
                ) : (
                  <p>En attente d’un second joueur...</p>
                )}
              </div>
            </div>

            <div className="bw-panel">
              <h3>Règles configurées pour cette partie :</h3>
              <ul className="bw-status-list">
                <li>
                  Temps de préparation :{' '}
                  <strong>{lobbySnapshot.ruleset.prepDurationSeconds} secondes</strong>
                </li>
                <li>
                  Pendule par joueur :{' '}
                  <strong>
                    {Math.round(lobbySnapshot.ruleset.clockDurationSeconds / 60)} minutes
                  </strong>
                </li>
                <li>
                  Limite de cartes en main :{' '}
                  <strong>{lobbySnapshot.ruleset.maxHandSize} cartes</strong>
                </li>
                <li>
                  Cartes activées : <strong>{lobbySnapshot.ruleset.enabledCards.length}/16</strong>
                </li>
              </ul>
            </div>

            <div className="bw-form-actions">
              {(!myIdentity || lobbySnapshot.redPlayer?.userId === myIdentity.userId) ? (
                <button
                  type="button"
                  className="bw-btn bw-btn-primary bw-btn-lg"
                  disabled={!lobbySnapshot.redPlayer || !lobbySnapshot.blackPlayer}
                  onClick={() => {
                    setRoomError(null);
                    ensureSocket().emit(
                      'room:start',
                      { roomId: lobbySnapshot.roomId },
                      (res: { ok: boolean; error?: string }) => {
                        if (!res.ok) {
                          setRoomError(res.error ?? 'Démarrage impossible');
                        }
                      },
                    );
                  }}
                >
                  🚀 Lancer la Partie
                </button>
              ) : (
                <span className="bw-mode-pill">
                  ⏳ En attente que l’hôte ({lobbySnapshot.redPlayer?.username}) lance la partie...
                </span>
              )}
              <button
                type="button"
                className="bw-btn bw-btn-ghost"
                onClick={() => {
                  ensureSocket().emit('room:leave');
                  setLobbySnapshot(null);
                  setScreen('main_menu');
                }}
              >
                Quitter la salle
              </button>
            </div>
          </section>
        )}

        {/* 7. CRÉATION DE PARTIE PERSONNALISÉE */}
        {screen === 'custom_create' && (
          <section className="bw-panel-page">
            <h2>🛠️ Parties Personnalisées & Salles Privées (§12.4)</h2>
            {roomError && <div className="bw-error-box">{roomError}</div>}

            <div className="bw-two-col-grid">
              <div className="bw-panel">
                <h3>Rejoindre une Salle Privée avec un Code</h3>
                <div className="bw-inline-form">
                  <input
                    type="text"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder="Ex: BW-7K9P"
                  />
                  <button
                    type="button"
                    className="bw-btn bw-btn-primary"
                    onClick={() => {
                      setRoomError(null);
                      ensureSocket().emit(
                        'room:join',
                        { roomCode: joinCodeInput },
                        (res: { ok: boolean; error?: string }) => {
                          if (!res.ok) {
                            setRoomError(res.error ?? 'Code de salle introuvable');
                          }
                        },
                      );
                    }}
                  >
                    Rejoindre la Salle
                  </button>
                </div>
              </div>

              <div className="bw-panel">
                <h3>Configurer les Paramètres de Partie</h3>
                <label className="bw-field">
                  <span>Chronomètre de préparation (§3.2)</span>
                  <select
                    value={customPrepSec}
                    onChange={(e) => setCustomPrepSec(Number(e.target.value))}
                  >
                    {PREP_DURATION_PRESETS_SECONDS.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec} secondes {sec === 90 ? '(Officiel)' : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="bw-field">
                  <span>Pendule par joueur (Q26 : 3, 5, 10, 15 ou 30 min)</span>
                  <select
                    value={customClockSec}
                    onChange={(e) => setCustomClockSec(Number(e.target.value))}
                  >
                    {CUSTOM_CLOCK_PRESETS_SECONDS.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec / 60} minutes {sec === 600 ? '(Officiel 10 min)' : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="bw-field">
                  <span>Nombre maximum de cartes en main (1 à 3)</span>
                  <select
                    value={customMaxHand}
                    onChange={(e) => setCustomMaxHand(Number(e.target.value))}
                  >
                    {[1, 2, 3].map((n) => (
                      <option key={n} value={n}>
                        {n} carte{n > 1 ? 's' : ''} {n === 3 ? '(Officiel)' : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="bw-field">
                  <span>Activer / Désactiver certaines cartes ({customEnabledCards.length}/16)</span>
                  <div className="bw-card-toggles">
                    {CARD_TYPES.map((cid) => {
                      const active = customEnabledCards.includes(cid);
                      return (
                        <button
                          key={cid}
                          type="button"
                          className={`bw-chip-toggle ${active ? 'active' : ''}`}
                          onClick={() => {
                            if (active) {
                              setCustomEnabledCards(customEnabledCards.filter((c) => c !== cid));
                            } else {
                              setCustomEnabledCards([...customEnabledCards, cid]);
                            }
                          }}
                        >
                          {CARD_DOSSIERS[cid].badge} {CARD_DOSSIERS[cid].name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bw-form-actions">
                  <button
                    type="button"
                    className="bw-btn bw-btn-primary"
                    onClick={() => {
                      setRoomError(null);
                      ensureSocket().emit(
                        'room:create',
                        {
                          ruleset: {
                            ...OFFICIAL_RULESET_CONFIG,
                            prepDurationSeconds: customPrepSec,
                            clockDurationSeconds: customClockSec,
                            maxHandSize: customMaxHand,
                            enabledCards: customEnabledCards,
                          },
                        },
                        (res: { ok: boolean; error?: string }) => {
                          if (!res.ok) {
                            setRoomError(res.error ?? 'Impossible de créer la salle');
                          }
                        },
                      );
                    }}
                  >
                    🌐 Créer une Salle Privée En Ligne
                  </button>
                  <button
                    type="button"
                    className="bw-btn bw-btn-secondary"
                    onClick={() =>
                      startNewLocalGame({
                        prepDurationSeconds: customPrepSec,
                        clockDurationSeconds: customClockSec,
                        maxHandSize: customMaxHand,
                        enabledCards: customEnabledCards,
                      })
                    }
                  >
                    🖥️ Lancer en Mode Local avec ces Règles
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Sub-navigation bar for Collection / Encyclopédie pages */}
        {(screen === 'characters_collection' ||
          screen === 'cards_collection' ||
          screen === 'rules') && (
          <div className="bw-subnav-pills">
            <button
              type="button"
              className={`bw-btn ${screen === 'characters_collection' ? 'bw-btn-primary' : 'bw-btn-secondary'} bw-btn-sm`}
              onClick={() => setScreen('characters_collection')}
            >
              12 Personnages
            </button>
            <button
              type="button"
              className={`bw-btn ${screen === 'cards_collection' ? 'bw-btn-primary' : 'bw-btn-secondary'} bw-btn-sm`}
              onClick={() => setScreen('cards_collection')}
            >
              🃏 16 Cartes
            </button>
            <button
              type="button"
              className={`bw-btn ${screen === 'rules' ? 'bw-btn-primary' : 'bw-btn-secondary'} bw-btn-sm`}
              onClick={() => setScreen('rules')}
            >
              📖 Règles Officielles
            </button>
          </div>
        )}

        {/* Sub-navigation bar for Historique / Classement / Statistiques pages */}
        {(screen === 'history' || screen === 'leaderboard' || screen === 'stats') && (
          <div className="bw-subnav-pills">
            <button
              type="button"
              className={`bw-btn ${screen === 'history' ? 'bw-btn-primary' : 'bw-btn-secondary'} bw-btn-sm`}
              onClick={() => setScreen('history')}
            >
              📜 Historique
            </button>
            <button
              type="button"
              className={`bw-btn ${screen === 'leaderboard' ? 'bw-btn-primary' : 'bw-btn-secondary'} bw-btn-sm`}
              onClick={() => setScreen('leaderboard')}
            >
              🏆 Classement ELO
            </button>
            <button
              type="button"
              className={`bw-btn ${screen === 'stats' ? 'bw-btn-primary' : 'bw-btn-secondary'} bw-btn-sm`}
              onClick={() => setScreen('stats')}
            >
              📊 Statistiques
            </button>
          </div>
        )}

        {/* Sub-navigation bar for Profil / Paramètres / Connexion */}
        {(screen === 'profile' ||
          screen === 'settings' ||
          screen === 'login' ||
          screen === 'register') && (
          <div className="bw-subnav-pills">
            <button
              type="button"
              className={`bw-btn ${screen === 'profile' || screen === 'login' || screen === 'register' ? 'bw-btn-primary' : 'bw-btn-secondary'} bw-btn-sm`}
              onClick={() => setScreen('profile')}
            >
              👤 Mon Profil
            </button>
            <button
              type="button"
              className={`bw-btn ${screen === 'settings' ? 'bw-btn-primary' : 'bw-btn-secondary'} bw-btn-sm`}
              onClick={() => setScreen('settings')}
            >
              ⚙️ Paramètres
            </button>
          </div>
        )}

        {/* 9. COLLECTION DES PERSONNAGES */}
        {screen === 'characters_collection' && (
          <section className="bw-panel-page">
            <h2>Collection Officielle des 12 Personnages (27 Pièces par Armée)</h2>
            <p className="bw-muted-small">
              Identité visuelle uniforme Rouge &amp; Noir : sur le plateau, un pion est toujours{' '}
              <strong>Noir sur case Rouge</strong> et <strong>Rouge sur case Noire</strong>.
            </p>
            <div className="bw-collection-layout">
              <div className="bw-collection-list">
                {CHARACTER_TYPES.map((ch) => {
                  const d = CHARACTER_DOSSIERS[ch];
                  return (
                    <button
                      key={ch}
                      type="button"
                      className={`bw-collection-tab ${selectedCharacterDossier === ch ? 'active' : ''}`}
                      onClick={() => setSelectedCharacterDossier(ch)}
                    >
                      <span className="bw-tab-sym">
                        <PieceArtwork character={ch} owner="red" size="sm" />
                      </span>
                      <div>
                        <strong>{d.name}</strong>
                        <small>Quantité départ : {d.initialQuantity}</small>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="bw-dossier-detail">
                {(() => {
                  const d = CHARACTER_DOSSIERS[selectedCharacterDossier];
                  const maxDelta = Math.max(
                    2,
                    ...d.diagramMoves.map((m) => Math.max(Math.abs(m.dRow), Math.abs(m.dCol))),
                  );
                  const gridSize = maxDelta * 2 + 1;
                  const DIAGRAM_SYMBOLS: Record<string, string> = {
                    recon: 'R',
                    leap: '↷',
                    jump: '⤴',
                    move_only: '↑',
                    move_and_attack: '✕',
                    pursuit: '+1',
                    pierce: '⇥',
                    shoot: '◎',
                    mark: '◇',
                  };
                  const DIAGRAM_LABELS: Record<string, string> = {
                    recon: 'Reconnaissance Guetteur',
                    leap: 'Bond en « L » (Cavalier, saute au-dessus des obstacles)',
                    jump: 'Saut Percée (Cavalier, capture style dames)',
                    move_only: 'Déplacement seul',
                    move_and_attack: 'Déplacement et capture',
                    pursuit: 'Poursuite (+1 case pour éliminer la cible marquée)',
                    pierce: 'Frappe traversante (Exécuteur)',
                    shoot: 'Tir à distance (Arbalétrier • 1 tir / 3 tours)',
                    mark: 'Portée de marquage (Traqueur • 0 action)',
                  };
                  return (
                    <>
                      <div className="bw-dossier-header">
                        <span className="bw-dossier-big-sym">
                          <PieceArtwork character={d.id} owner="red" size="xl" />
                        </span>
                        <div>
                          <h3>{d.name}</h3>
                          <span className="bw-mode-pill">
                            Départ : {d.initialQuantity} | Plafond : {d.maxBoardCapLabel}
                          </span>
                        </div>
                      </div>
                      <PieceDualVariantPreview character={d.id} size="md" showLabels={true} />
                      <p>
                        <strong>Rôle tactique :</strong> {d.roleSummary}
                      </p>
                      <p>
                        <strong>Déplacement :</strong> {d.movementSummary}
                      </p>
                      <p>
                        <strong>Combat :</strong> {d.attackSummary}
                      </p>
                      <p>
                        <strong>Capacité spéciale :</strong> {d.specialAbility}
                      </p>
                      {d.interactionsSummary.length > 0 && (
                        <>
                          <h4>Interactions notables :</h4>
                          <ul>
                            {d.interactionsSummary.map((inter, i) => (
                              <li key={i}>{inter}</li>
                            ))}
                          </ul>
                        </>
                      )}
                      <h4>Restrictions officielles :</h4>
                      <ul>
                        {d.restrictions.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>

                      <h4>Schéma Tactique (Camp Rouge orienté vers le haut) :</h4>
                      <div
                        className="bw-mini-diagram"
                        style={{
                          gridTemplateColumns: `repeat(${gridSize}, minmax(30px, 38px))`,
                        }}
                      >
                        {Array.from({ length: gridSize }, (_, r) =>
                          Array.from({ length: gridSize }, (_, c) => {
                            const dRow = r - maxDelta;
                            const dCol = c - maxDelta;
                            const isCenter = dRow === 0 && dCol === 0;
                            const match = d.diagramMoves.find(
                              (m) => m.dRow === dRow && m.dCol === dCol,
                            );
                            return (
                              <div
                                key={`${r},${c}`}
                                className={`bw-mini-cell ${isCenter ? 'center' : ''} ${match ? `kind-${match.kind}` : ''}`}
                                title={match ? DIAGRAM_LABELS[match.kind] : isCenter ? d.name : undefined}
                              >
                                {isCenter ? (
                                  <PieceArtwork character={d.id} owner="red" size="xs" />
                                ) : match ? (
                                  (DIAGRAM_SYMBOLS[match.kind] ?? '•')
                                ) : (
                                  ''
                                )}
                              </div>
                            );
                          }),
                        )}
                      </div>
                      <div className="bw-diagram-legend">
                        <span>↑ Dépl. seul</span>
                        <span>✕ Dépl.+Attaque</span>
                        <span>R Reconnaissance</span>
                        <span>↷ Bond en L</span>
                        <span>⤴ Saut Percée</span>
                        <span>+1 Poursuite</span>
                        <span>⇥ Frappe trav.</span>
                        <span>◎ Tir (1/3T)</span>
                        <span>◇ Marquage</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </section>
        )}

        {/* 10. COLLECTION DES CARTES */}
        {screen === 'cards_collection' && (
          <section className="bw-panel-page">
            <h2>🃏 Collection Officielle des 16 Cartes Stratégiques (§8)</h2>
            <p>
              Maximum 3 cartes en main. Une nouvelle carte est piochée aléatoirement toutes les 3
              éliminations ennemies lorsque vous avez moins de 3 cartes en main.
            </p>
            <div className="bw-collection-layout">
              <div className="bw-collection-list">
                {CARD_TYPES.map((cid) => {
                  const c = CARD_DOSSIERS[cid];
                  return (
                    <button
                      key={cid}
                      type="button"
                      className={`bw-collection-tab ${selectedCardDossier === cid ? 'active' : ''}`}
                      onClick={() => setSelectedCardDossier(cid)}
                    >
                      <span className="bw-tab-sym">{c.badge}</span>
                      <div>
                        <strong>{c.name}</strong>
                        <small>{c.durationLabel}</small>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="bw-dossier-detail">
                {(() => {
                  const c = CARD_DOSSIERS[selectedCardDossier];
                  return (
                    <>
                      <div className="bw-dossier-header">
                        <span className="bw-dossier-big-sym">{c.badge}</span>
                        <div>
                          <h3>{c.name}</h3>
                          <span className="bw-mode-pill">Durée : {c.durationLabel}</span>
                        </div>
                      </div>
                      <p>
                        <strong>Confidentialité / Visibilité :</strong> {c.visibilityLabel}
                      </p>
                      <p>
                        <strong>Effet officiel :</strong> {c.effectDescription}
                      </p>
                      <h4>Règles et interactions :</h4>
                      <ul>
                        {c.restrictions.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </>
                  );
                })()}
              </div>
            </div>
          </section>
        )}

        {/* 11. RÈGLES DU JEU & ENCYCLOPÉDIE */}
        {screen === 'rules' && (
          <section className="bw-panel-page">
            <h2>📖 Encyclopédie Complète & Règles Officielles de BLIND WAR (§16)</h2>
            {RULE_SECTIONS.map((sec) => (
              <div key={sec.id} className="bw-panel bw-rule-block">
                <h3>{sec.title}</h3>
                <p>{sec.summary}</p>
                <ul>
                  {sec.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
            <h2 style={{ marginTop: '1.5rem' }}>
              ✨ Mécaniques Clés & Nouvelles Règles Officielles
            </h2>
            {MECHANIC_DOSSIERS.map((mech) => (
              <div key={mech.id} className="bw-panel bw-rule-block">
                <h3 className="bw-rule-char-heading">
                  {mech.relatedCharacter ? (
                    <PieceArtwork character={mech.relatedCharacter} owner="red" size="sm" />
                  ) : (
                    <span>{mech.badge}</span>
                  )}{' '}
                  <span>{mech.title}</span>
                </h3>
                <p>{mech.summary}</p>
                <ul>
                  {mech.rules.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
                {mech.edgeCases.length > 0 && (
                  <p className="bw-muted-small">
                    <strong>Cas particuliers :</strong> {mech.edgeCases.join(' • ')}
                  </p>
                )}
              </div>
            ))}
            <div className="bw-form-actions">
              <button
                type="button"
                className="bw-btn bw-btn-primary"
                onClick={() => setScreen('characters_collection')}
              >
                Fiches des 12 Personnages →
              </button>
              <button
                type="button"
                className="bw-btn bw-btn-secondary"
                onClick={() => setScreen('cards_collection')}
              >
                Fiches des 16 Cartes →
              </button>
            </div>
          </section>
        )}

        {/* 12. TUTORIEL & MODE ENTRAÎNEMENT */}
        {screen === 'tutorial' && (
          <section className="bw-panel-page">
            <h2>🎓 Programme d’Entraînement — 10 Thèmes Progressifs (§12.5)</h2>
            <p>
              Apprenez BLIND WAR étape par étape sans surcharge d’information (
              <strong>{validCompletedTutorialIds.length}/{TUTORIAL_SCENARIOS.length}</strong>{' '}
              leçons validées) :
            </p>

            <div className="bw-panel bw-tutorial-controls-panel">
              <div className="bw-tutorial-controls-row">
                <div>
                  <strong>Aides contextuelles en partie :</strong>{' '}
                  <span className="bw-muted-small">
                    {settings.enableContextualTutorials
                      ? 'Activées (affiche 1 guide ciblé selon la pièce sélectionnée ou l’événement, une seule fois).'
                      : 'Désactivées (réactivables à tout moment).'}
                  </span>
                </div>
                <div className="bw-form-actions">
                  <button
                    type="button"
                    className={`bw-btn bw-btn-sm ${settings.enableContextualTutorials ? 'bw-btn-secondary' : 'bw-btn-primary'}`}
                    onClick={() => {
                      const next = {
                        ...settings,
                        enableContextualTutorials: !settings.enableContextualTutorials,
                      };
                      setSettings(next);
                      saveUserSettings(next);
                    }}
                  >
                    {settings.enableContextualTutorials
                      ? '🔕 Désactiver les guides auto'
                      : '🔔 Activer les guides auto'}
                  </button>
                  <button
                    type="button"
                    className="bw-btn bw-btn-ghost bw-btn-sm"
                    disabled={dismissedContextualIds.length === 0}
                    onClick={() => {
                      resetContextualTips();
                      setDismissedContextualIds([]);
                    }}
                  >
                    ↺ Réinitialiser conseils vus ({dismissedContextualIds.length})
                  </button>
                </div>
              </div>
            </div>

            {Array.from(new Set(TUTORIAL_SCENARIOS.map((s) => s.themeNumber)))
              .sort((a, b) => a - b)
              .map((themeNum) => {
                const lessonsInTheme = TUTORIAL_SCENARIOS.filter(
                  (s) => s.themeNumber === themeNum,
                );
                const firstLesson = lessonsInTheme[0];
                if (!firstLesson) return null;
                const doneInTheme = lessonsInTheme.filter((s) =>
                  validCompletedTutorialIds.includes(s.id),
                ).length;
                return (
                  <div key={themeNum} className="bw-tutorial-theme-group">
                    <div className="bw-tutorial-theme-header">
                      <h3>
                        Thème {themeNum}/10 — {firstLesson.themeTitle}
                      </h3>
                      <span className="bw-mode-pill">
                        {doneInTheme}/{lessonsInTheme.length} terminée
                        {doneInTheme > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="bw-menu-grid">
                      {lessonsInTheme.map((scen) => {
                        const globalIdx = TUTORIAL_SCENARIOS.findIndex((s) => s.id === scen.id);
                        const isDone = validCompletedTutorialIds.includes(scen.id);
                        return (
                          <div
                            key={scen.id}
                            className={`bw-menu-card ${isDone ? 'bw-tutorial-card-done' : ''} ${scen.isNewUpdate ? 'bw-tutorial-card-new' : ''}`}
                          >
                            <div className="bw-tutorial-card-badges">
                              {scen.isNewUpdate && <span className="bw-badge-new">Mis à jour</span>}
                              {isDone && <span className="bw-badge-done">✅ Validée</span>}
                              {scen.relatedCharacterIds && (
                                <span className="bw-tutorial-chars-pill">
                                  {scen.relatedCharacterIds.map((ch) => (
                                    <PieceArtwork
                                      key={ch}
                                      character={ch}
                                      owner="red"
                                      size="xs"
                                    />
                                  ))}
                                </span>
                              )}
                            </div>
                            <h4>{scen.title}</h4>
                            <p>{scen.subtitle}</p>
                            <button
                              type="button"
                              className={`bw-btn ${isDone ? 'bw-btn-secondary' : 'bw-btn-primary'}`}
                              onClick={() => startTutorialScenario(globalIdx)}
                            >
                              {isDone
                                ? `↻ Rejouer la Leçon #${scen.stepNumber}`
                                : `▶ Jouer la Leçon #${scen.stepNumber}`}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </section>
        )}

        {/* 13. PROFIL JOUEUR */}
        {screen === 'profile' && (
          <section className="bw-panel-page">
            <h2>👤 Profil Joueur & Cosmétiques (§17)</h2>
            {!userProfile ? (
              <div className="bw-panel">
                <p>
                  Vous n’êtes pas connecté. Connectez-vous ou créez un compte pour personnaliser
                  votre avatar, débloquer des titres/bannières et synchroniser vos thèmes.
                </p>
                <div className="bw-form-actions">
                  <button
                    type="button"
                    className="bw-btn bw-btn-primary"
                    onClick={() => setScreen('login')}
                  >
                    Se Connecter
                  </button>
                  <button
                    type="button"
                    className="bw-btn bw-btn-secondary"
                    onClick={() => setScreen('register')}
                  >
                    Créer un Compte
                  </button>
                </div>
              </div>
            ) : (
              (() => {
                const nm = userProfile.newMechanicsStats ?? createZeroNewMechanicsStats();
                const cosmetics = computeProfileCosmetics({
                  wins: userProfile.wins,
                  gamesPlayed: userProfile.gamesPlayed,
                  eloRating: userProfile.eloRating,
                  totalEliminations: userProfile.totalEliminations,
                  newMechanicsStats: nm,
                });
                const activeTitleObj =
                  cosmetics.titles.find(
                    (t) => t.id === (userProfile.selectedTitle ?? 'recrue'),
                  ) ?? cosmetics.titles[0];
                const activeBadgeObj = userProfile.selectedBadge
                  ? cosmetics.badges.find((b) => b.id === userProfile.selectedBadge)
                  : null;

                return (
                  <>
                    {/* Hero Profile Banner */}
                    <div
                      className={`bw-profile-banner-hero bw-banner-${userProfile.profileBanner ?? 'classic'}`}
                    >
                      <div className="bw-profile-identity-row">
                        <PieceAvatar
                          badge={userProfile.avatarBadge}
                          avatarImage={userProfile.avatarImage}
                          alt={userProfile.displayName ?? userProfile.username}
                          owner="red"
                          size="xl"
                        />
                        <div>
                          <h3 className="bw-profile-display-name">
                            {userProfile.displayName ?? userProfile.username}
                          </h3>
                          <span className="bw-profile-handle">
                            @{userProfile.username} • Membre depuis{' '}
                            {new Date(userProfile.createdAt).toLocaleDateString('fr-FR')}
                          </span>
                          <div className="bw-profile-tags-row">
                            <span className="bw-elo-pill">{userProfile.eloRating} ELO</span>
                            {activeTitleObj && (
                              <span className="bw-title-pill">🎖️ {activeTitleObj.label}</span>
                            )}
                            {activeBadgeObj && (
                              <span className="bw-achievement-pill">
                                🏅 {activeBadgeObj.label}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="bw-form-actions">
                        <button
                          type="button"
                          className="bw-btn bw-btn-secondary bw-btn-sm"
                          onClick={() => setShowAvatarCropper(true)}
                        >
                          🖼️ Photo de profil
                        </button>
                        <button
                          type="button"
                          className="bw-btn bw-btn-secondary bw-btn-sm"
                          onClick={() => setScreen('settings')}
                        >
                          🎨 Thème & Apparence
                        </button>
                        <button
                          type="button"
                          className="bw-btn bw-btn-danger bw-btn-sm"
                          onClick={() => {
                            setSavedAuthToken(null);
                            setUserProfile(null);
                            setSettings(loadUserSettings(null));
                            resetSocket();
                            ensureSocket(`Commandant-${getOrCreateGuestId().slice(-4)}`);
                            pushAppNotification(
                              'account',
                              'Déconnexion',
                              'Vous êtes revenu en mode invité.',
                            );
                            setScreen('home');
                          }}
                        >
                          Déconnexion
                        </button>
                      </div>
                    </div>

                    <div className="bw-two-col-grid">
                      {/* Left column: Summary + Mechanics + Recent Matches */}
                      <div className="bw-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        <h3>📊 Résumé du Commandant</h3>
                        <p>
                          <strong>Biographie :</strong>{' '}
                          {userProfile.bio || 'Aucune devise renseignée.'}
                        </p>
                        <p>
                          <strong>Bilan global :</strong> {userProfile.gamesPlayed} partie(s) —{' '}
                          {userProfile.wins}V / {userProfile.losses}D / {userProfile.draws}N (
                          <strong>{userProfile.winRatePercent}%</strong> de victoires) •{' '}
                          {userProfile.totalEliminations} élimination(s)
                        </p>
                        <p className="bw-muted-small">
                          <strong>Mécaniques spéciales :</strong> {nm.traqueurEliminations} élim.
                          Traqueur ({nm.traqueurPursuitsSucceeded} poursuites) •{' '}
                          {nm.executeurPiercingStrikes} frappes trav. •{' '}
                          {nm.arbaletrierShotsSucceeded}/{nm.arbaletrierShotsTotal} tirs réussis •{' '}
                          {nm.colossiEliminatedByKamikaze} Colosses (2 Kamikaze)
                        </p>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <button
                            type="button"
                            className="bw-btn bw-btn-secondary bw-btn-sm"
                            onClick={() => setScreen('stats')}
                          >
                            📊 Statistiques détaillées
                          </button>
                          <button
                            type="button"
                            className="bw-btn bw-btn-secondary bw-btn-sm"
                            onClick={() => setScreen('history')}
                          >
                            📜 Historique complet
                          </button>
                        </div>

                        <div style={{ marginTop: '0.4rem' }}>
                          <h4 style={{ margin: '0 0 0.4rem' }}>🕒 Dernières parties</h4>
                          {matchHistory.length === 0 ? (
                            <p className="bw-muted-small">Aucune partie enregistrée pour l’instant.</p>
                          ) : (
                            <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.84rem' }}>
                              {matchHistory.slice(0, 5).map((m) => (
                                <li key={m.id} style={{ marginBottom: '0.25rem' }}>
                                  <strong>
                                    {m.redUsername} vs {m.blackUsername}
                                  </strong>{' '}
                                  —{' '}
                                  {m.winner === 'draw'
                                    ? 'Match nul'
                                    : m.winner === 'red'
                                      ? `Victoire ${m.redUsername}`
                                      : `Victoire ${m.blackUsername}`}{' '}
                                  ({m.turnsPlayed} tours)
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>

                      {/* Right column: Edit Profile & Cosmetics */}
                      <div className="bw-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        <h3 style={{ margin: 0 }}>✏️ Personnaliser mon Profil</h3>
                        {profileNotice && <div className="bw-success-box">{profileNotice}</div>}
                        {profileError && <div className="bw-error-box">{profileError}</div>}

                        <label className="bw-field">
                          <span>Nom affiché (2 à 24 caractères)</span>
                          <input
                            type="text"
                            value={editDisplayName}
                            minLength={2}
                            maxLength={24}
                            onChange={(e) => setEditDisplayName(e.target.value)}
                            placeholder={userProfile.username}
                          />
                        </label>

                        <label className="bw-field">
                          <span>Emblème de secours (si aucune photo n’est définie)</span>
                          <div className="bw-avatar-picker">
                            {AVATAR_CHARACTER_OPTIONS.map((ch) => (
                              <button
                                key={ch}
                                type="button"
                                className={`bw-avatar-btn ${resolveCharacterFromLegacyBadge(editAvatar) === ch ? 'selected' : ''}`}
                                onClick={() => setEditAvatar(ch)}
                                title={CHARACTER_DOSSIERS[ch].name}
                              >
                                <PieceArtwork character={ch} owner="red" size="sm" />
                              </button>
                            ))}
                          </div>
                        </label>

                        <label className="bw-field">
                          <span>Biographie / Devise tactique</span>
                          <textarea
                            rows={2}
                            value={editBio}
                            onChange={(e) => setEditBio(e.target.value)}
                          />
                        </label>

                        <div className="bw-field">
                          <span>Bannière du profil</span>
                          <div className="bw-cosmetic-selector-grid">
                            {cosmetics.banners.map((b) => (
                              <button
                                key={b.id}
                                type="button"
                                disabled={!b.unlocked}
                                className={`bw-cosmetic-option ${editBanner === b.id ? 'selected' : ''} ${!b.unlocked ? 'locked' : ''}`}
                                onClick={() => setEditBanner(b.id)}
                              >
                                <strong>
                                  {b.unlocked ? '✓ ' : '🔒 '}
                                  {b.label}
                                </strong>
                                <small className="bw-muted-small">{b.requirementLabel}</small>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="bw-field">
                          <span>Titre de commandant</span>
                          <div className="bw-cosmetic-selector-grid">
                            {cosmetics.titles.map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                disabled={!t.unlocked}
                                className={`bw-cosmetic-option ${editTitle === t.id ? 'selected' : ''} ${!t.unlocked ? 'locked' : ''}`}
                                onClick={() => setEditTitle(t.id)}
                              >
                                <strong>
                                  {t.unlocked ? '✓ ' : '🔒 '}
                                  {t.label}
                                </strong>
                                <small className="bw-muted-small">{t.requirementLabel}</small>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="bw-field">
                          <span>Badge d’accomplissement affiché</span>
                          <div className="bw-cosmetic-selector-grid">
                            <button
                              type="button"
                              className={`bw-cosmetic-option ${editBadge === null ? 'selected' : ''}`}
                              onClick={() => setEditBadge(null)}
                            >
                              <strong>Aucun badge</strong>
                              <small className="bw-muted-small">Profil épuré</small>
                            </button>
                            {cosmetics.badges.map((badge) => (
                              <button
                                key={badge.id}
                                type="button"
                                disabled={!badge.unlocked}
                                className={`bw-cosmetic-option ${editBadge === badge.id ? 'selected' : ''} ${!badge.unlocked ? 'locked' : ''}`}
                                onClick={() => setEditBadge(badge.id)}
                              >
                                <strong>
                                  {badge.unlocked ? '🏅 ' : '🔒 '}
                                  {badge.label}
                                </strong>
                                <small className="bw-muted-small">{badge.requirementLabel}</small>
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="bw-btn bw-btn-primary"
                          onClick={async () => {
                            setProfileNotice(null);
                            setProfileError(null);
                            try {
                              const updated = await apiUpdateProfile({
                                displayName: editDisplayName,
                                avatarBadge: editAvatar,
                                bio: editBio,
                                profileBanner: editBanner,
                                selectedTitle: editTitle,
                                selectedBadge: editBadge,
                              });
                              syncProfileFormAndSettings(updated);
                              setProfileNotice('Profil et cosmétiques enregistrés avec succès.');
                              pushAppNotification(
                                'account',
                                'Profil mis à jour',
                                'Votre profil personnalisé a bien été sauvegardé.',
                                'profile',
                              );
                            } catch (err) {
                              setProfileError(
                                err instanceof Error ? err.message : 'Sauvegarde refusée.',
                              );
                            }
                          }}
                        >
                          ✅ Enregistrer les modifications
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()
            )}
          </section>
        )}

        {/* 14. STATISTIQUES */}
        {screen === 'stats' && (
          <section className="bw-panel-page">
            <h2>📊 Statistiques & Progression ELO (§13)</h2>
            <div className="bw-stats-cards">
              <div className="bw-stat-card">
                <span className="bw-stat-label">Classement ELO</span>
                <strong className="bw-stat-value">{userProfile?.eloRating ?? 200}</strong>
              </div>
              <div className="bw-stat-card">
                <span className="bw-stat-label">Victoires</span>
                <strong className="bw-stat-value">{userProfile?.wins ?? 0}</strong>
              </div>
              <div className="bw-stat-card">
                <span className="bw-stat-label">Défaites</span>
                <strong className="bw-stat-value">{userProfile?.losses ?? 0}</strong>
              </div>
              <div className="bw-stat-card">
                <span className="bw-stat-label">Matchs Nuls</span>
                <strong className="bw-stat-value">{userProfile?.draws ?? 0}</strong>
              </div>
              <div className="bw-stat-card">
                <span className="bw-stat-label">Taux de Victoire</span>
                <strong className="bw-stat-value">{userProfile?.winRatePercent ?? 0}%</strong>
              </div>
              <div className="bw-stat-card">
                <span className="bw-stat-label">Éliminations Totales</span>
                <strong className="bw-stat-value">{userProfile?.totalEliminations ?? 0}</strong>
              </div>
            </div>

            {(() => {
              const nm = userProfile?.newMechanicsStats ?? createZeroNewMechanicsStats();
              return (
                <div className="bw-panel" style={{ marginBottom: '1rem' }}>
                  <h3>✨ Statistiques : Traqueur, Exécuteur, Arbalétrier & Colosse</h3>
                  <div className="bw-stats-cards">
                    <div className="bw-stat-card">
                      <span className="bw-stat-label">Marquages Traqueur</span>
                      <strong className="bw-stat-value">{nm.traqueurMarks}</strong>
                    </div>
                    <div className="bw-stat-card">
                      <span className="bw-stat-label">Poursuites Réussies</span>
                      <strong className="bw-stat-value">{nm.traqueurPursuitsSucceeded}</strong>
                    </div>
                    <div className="bw-stat-card">
                      <span className="bw-stat-label">Élim. Traqueur</span>
                      <strong className="bw-stat-value">{nm.traqueurEliminations}</strong>
                    </div>
                    <div className="bw-stat-card">
                      <span className="bw-stat-label">Frappes Traversantes</span>
                      <strong className="bw-stat-value">{nm.executeurPiercingStrikes}</strong>
                    </div>
                    <div className="bw-stat-card">
                      <span className="bw-stat-label">Élim. Exécuteur</span>
                      <strong className="bw-stat-value">{nm.executeurEliminations}</strong>
                    </div>
                    <div className="bw-stat-card">
                      <span className="bw-stat-label">Tirs Arbalétrier (Réussis / Total)</span>
                      <strong className="bw-stat-value">
                        {nm.arbaletrierShotsSucceeded}/{nm.arbaletrierShotsTotal}
                      </strong>
                    </div>
                    <div className="bw-stat-card">
                      <span className="bw-stat-label">Tirs Arbalétrier Bloqués</span>
                      <strong className="bw-stat-value">{nm.arbaletrierShotsBlocked}</strong>
                    </div>
                    <div className="bw-stat-card">
                      <span className="bw-stat-label">Colosses Abattus (2 Kamikaze)</span>
                      <strong className="bw-stat-value">{nm.colossiEliminatedByKamikaze}</strong>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="bw-panel">
              <h3>Historique des Variations ELO (Parties Classées)</h3>
              {eloHistory.length === 0 ? (
                <p className="bw-muted-small">Aucune variation ELO enregistrée pour le moment.</p>
              ) : (
                <table className="bw-table">
                  <thead>
                    <tr>
                      <th>Partie</th>
                      <th>ELO Avant</th>
                      <th>ELO Après</th>
                      <th>Variation</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eloHistory.map((item) => (
                      <tr key={item.id}>
                        <td>{item.matchId}</td>
                        <td>{item.eloBefore}</td>
                        <td>{item.eloAfter}</td>
                        <td className={item.delta >= 0 ? 'bw-text-green' : 'bw-text-red'}>
                          {item.delta >= 0 ? `+${item.delta}` : item.delta}
                        </td>
                        <td>{new Date(item.recordedAt).toLocaleString('fr-FR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {/* 15. HISTORIQUE DES PARTIES */}
        {screen === 'history' && (
          <section className="bw-panel-page">
            <h2>📜 Historique des Parties (§15)</h2>

            {(() => {
              const nowMs = Date.now();
              const filteredMatches = matchHistory.filter((m) => {
                if (historyFilterMode !== 'all' && m.mode !== historyFilterMode) {
                  return false;
                }
                if (historyFilterPeriod !== 'all') {
                  const endedMs = new Date(m.endedAt).getTime();
                  if (historyFilterPeriod === 'today') {
                    const startOfDay = new Date();
                    startOfDay.setHours(0, 0, 0, 0);
                    if (endedMs < startOfDay.getTime()) return false;
                  } else if (historyFilterPeriod === '7d') {
                    if (nowMs - endedMs > 7 * 86_400_000) return false;
                  } else if (historyFilterPeriod === '30d') {
                    if (nowMs - endedMs > 30 * 86_400_000) return false;
                  }
                }
                if (historyFilterResult !== 'all') {
                  if (historyFilterResult === 'draw') {
                    if (m.winner !== 'draw') return false;
                  } else if (userProfile) {
                    const isRed = m.redUsername === userProfile.username;
                    const isBlack = m.blackUsername === userProfile.username;
                    const won =
                      (isRed && m.winner === 'red') || (isBlack && m.winner === 'black');
                    const lost =
                      m.winner !== 'draw' &&
                      ((isRed && m.winner === 'black') || (isBlack && m.winner === 'red'));
                    if (historyFilterResult === 'win' && !won) return false;
                    if (historyFilterResult === 'loss' && !lost) return false;
                  } else {
                    if (historyFilterResult === 'win' && m.winner !== 'red') return false;
                    if (historyFilterResult === 'loss' && m.winner !== 'black') return false;
                  }
                }
                return true;
              });

              const hasActiveFilters =
                historyFilterResult !== 'all' ||
                historyFilterMode !== 'all' ||
                historyFilterPeriod !== 'all';

              return (
                <>
                  <div className="bw-history-filters" aria-label="Filtres de l’historique">
                    <select
                      className="bw-history-filter-select"
                      value={historyFilterResult}
                      onChange={(e) =>
                        setHistoryFilterResult(e.target.value as 'all' | 'win' | 'loss' | 'draw')
                      }
                      aria-label="Filtrer par résultat"
                    >
                      <option value="all">Tous les résultats</option>
                      <option value="win">{userProfile ? 'Mes victoires' : 'Victoires Rouge'}</option>
                      <option value="loss">{userProfile ? 'Mes défaites' : 'Victoires Noir'}</option>
                      <option value="draw">Matchs nuls</option>
                    </select>

                    <select
                      className="bw-history-filter-select"
                      value={historyFilterMode}
                      onChange={(e) => setHistoryFilterMode(e.target.value)}
                      aria-label="Filtrer par mode"
                    >
                      <option value="all">Tous les modes</option>
                      <option value="matchmaking_ranked">Classé ELO</option>
                      <option value="matchmaking_unranked">Non classé</option>
                      <option value="matchmaking_quick">Rapide</option>
                      <option value="custom_online">Salon privé</option>
                      <option value="local">Local</option>
                    </select>

                    <select
                      className="bw-history-filter-select"
                      value={historyFilterPeriod}
                      onChange={(e) =>
                        setHistoryFilterPeriod(e.target.value as 'all' | 'today' | '7d' | '30d')
                      }
                      aria-label="Filtrer par période"
                    >
                      <option value="all">Toute période</option>
                      <option value="today">Aujourd’hui</option>
                      <option value="7d">7 derniers jours</option>
                      <option value="30d">30 derniers jours</option>
                    </select>

                    <span className="bw-muted-small">
                      {filteredMatches.length} / {matchHistory.length} partie(s)
                    </span>

                    {hasActiveFilters && (
                      <button
                        type="button"
                        className="bw-btn bw-btn-ghost bw-btn-sm"
                        onClick={() => {
                          setHistoryFilterResult('all');
                          setHistoryFilterMode('all');
                          setHistoryFilterPeriod('all');
                        }}
                      >
                        ↺ Réinitialiser
                      </button>
                    )}
                  </div>

                  <div className="bw-panel">
                    {filteredMatches.length === 0 ? (
                      <p className="bw-muted-small">
                        {matchHistory.length === 0
                          ? 'Aucune partie enregistrée pour l’instant.'
                          : 'Aucune partie ne correspond aux filtres sélectionnés.'}
                      </p>
                    ) : (
                      <table className="bw-table">
                        <thead>
                          <tr>
                            <th>Mode</th>
                            <th>Rouge</th>
                            <th>Noir</th>
                            <th>Résultat</th>
                            <th>Motif</th>
                            <th>Tours</th>
                            <th>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredMatches.map((m) => (
                            <tr key={m.id}>
                              <td>{m.mode}</td>
                              <td>
                                {m.redUsername} ({m.redEloBefore}→{m.redEloAfter})
                              </td>
                              <td>
                                {m.blackUsername} ({m.blackEloBefore}→{m.blackEloAfter})
                              </td>
                              <td>
                                <strong>
                                  {m.winner === 'draw'
                                    ? 'Match Nul'
                                    : m.winner === 'red'
                                      ? 'Victoire Rouge'
                                      : 'Victoire Noir'}
                                </strong>
                              </td>
                              <td>{m.outcomeReason}</td>
                              <td>{m.turnsPlayed}</td>
                              <td>{new Date(m.endedAt).toLocaleDateString('fr-FR')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              );
            })()}
          </section>
        )}

        {/* 16. CLASSEMENT GÉNÉRAL */}
        {screen === 'leaderboard' && (
          <section className="bw-panel-page">
            <h2>🏆 Classement Général ELO (Départ : 200 ELO)</h2>
            <div className="bw-panel">
              {leaderboard.length === 0 ? (
                <p className="bw-muted-small">
                  Aucun joueur inscrit pour l’instant. Inscrivez-vous pour inaugurer le classement !
                </p>
              ) : (
                <table className="bw-table">
                  <thead>
                    <tr>
                      <th>Rang</th>
                      <th>Commandant</th>
                      <th>ELO</th>
                      <th>Victoires</th>
                      <th>Défaites</th>
                      <th>Nuls</th>
                      <th>Win %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((u, idx) => (
                      <tr key={u.id}>
                        <td>#{idx + 1}</td>
                        <td>
                          <span className="bw-leaderboard-user-cell">
                            <PieceAvatar
                              badge={u.avatarBadge}
                              avatarImage={u.avatarImage}
                              alt={u.displayName ?? u.username}
                              owner="red"
                              size="xs"
                            />{' '}
                            <strong>{u.displayName ?? u.username}</strong>
                          </span>
                        </td>
                        <td>
                          <span className="bw-elo-pill">{u.eloRating} ELO</span>
                        </td>
                        <td>{u.wins}</td>
                        <td>{u.losses}</td>
                        <td>{u.draws}</td>
                        <td>{u.winRatePercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {/* 17. PARAMÈTRES & PERSONNALISATION */}
        {screen === 'settings' && (
          <SettingsScreen
            preferences={settings}
            userProfile={userProfile}
            onUpdatePreferences={handleUpdateSettings}
            onResetAll={handleResetAllSettings}
            onGoToProfile={() => setScreen('profile')}
            onGoToAuth={() => setScreen('login')}
          />
        )}

        {/* ADMINISTRATION DÉDIÉE (Kenktra_7003) */}
        {screen === 'admin' && (
          <AdminDashboardScreen
            currentUser={userProfile}
            onAdminProfileSynced={(updated) => {
              syncProfileFormAndSettings(updated);
              void apiFetchLeaderboard().then(setLeaderboard);
            }}
            onBackToMenu={() => setScreen('main_menu')}
          />
        )}

        {/* 18. ÉCRAN DE VICTOIRE */}
        {screen === 'victory' && (
          <section className="bw-outcome-screen bw-outcome-victory">
            <div className="bw-outcome-badge">🏆 VICTOIRE STRATÉGIQUE</div>
            <h1>Victoire du Camp {lastMatchResult?.winner === 'red' ? 'Rouge 🔴' : 'Noir ⚫'} !</h1>
            <p>
              Motif officiel : <strong>{lastMatchResult?.reason ?? 'king_eliminated'}</strong> en{' '}
              <strong>{lastMatchResult?.turnsPlayed ?? 1}</strong> tours.
            </p>
            {lastMatchResult?.eloChange && (
              <div className="bw-panel" style={{ maxWidth: 520, margin: '16px auto' }}>
                <h3>🏆 Bilan de Classement ELO (Match Classé)</h3>
                <p>
                  Votre ELO : <strong>{lastMatchResult.eloChange.myBefore}</strong> →{' '}
                  <strong>{lastMatchResult.eloChange.myAfter} ELO</strong> (
                  <strong className="bw-text-green">
                    +{lastMatchResult.eloChange.myDelta} ELO
                  </strong>
                  )
                </p>
                <p className="bw-muted-small">
                  Adversaire ({lastMatchResult.eloChange.oppUsername}) :{' '}
                  <strong>{lastMatchResult.eloChange.oppBefore} ELO</strong> — Plus votre adversaire
                  a un ELO faible par rapport à vous, moins vous gagnez de points ; plus il est fort,
                  plus votre gain est élevé.
                </p>
              </div>
            )}
            <div className="bw-hero-cta-row">
              <button
                type="button"
                className="bw-btn bw-btn-primary bw-btn-lg"
                onClick={() =>
                  lastMatchResult?.mode?.startsWith('matchmaking')
                    ? setScreen('matchmaking')
                    : startNewLocalGame()
                }
              >
                Rejouer une Partie
              </button>
              <button
                type="button"
                className="bw-btn bw-btn-secondary bw-btn-lg"
                onClick={() => setScreen('leaderboard')}
              >
                🏆 Voir le Classement ELO
              </button>
              <button
                type="button"
                className="bw-btn bw-btn-secondary bw-btn-lg"
                onClick={() => setScreen('history')}
              >
                📜 Voir l’Historique
              </button>
              <button
                type="button"
                className="bw-btn bw-btn-ghost bw-btn-lg"
                onClick={() => setScreen('main_menu')}
              >
                Retour au Menu Principal
              </button>
            </div>
          </section>
        )}

        {/* 19. ÉCRAN DE DÉFAITE (OU MATCH NUL) */}
        {screen === 'defeat' && (
          <section className="bw-outcome-screen bw-outcome-defeat">
            <div className="bw-outcome-badge">
              {lastMatchResult?.winner === 'draw' ? '🤝 MATCH NUL' : '💀 DÉFAITE'}
            </div>
            <h1>
              {lastMatchResult?.winner === 'draw'
                ? 'Égalité Stratégique'
                : `Victoire du Camp ${lastMatchResult?.winner === 'red' ? 'Rouge' : 'Noir'}`}
            </h1>
            <p>
              Motif officiel : <strong>{lastMatchResult?.reason ?? 'king_eliminated'}</strong> après{' '}
              <strong>{lastMatchResult?.turnsPlayed ?? 1}</strong> tours.
            </p>
            {lastMatchResult?.eloChange && (
              <div className="bw-panel" style={{ maxWidth: 520, margin: '16px auto' }}>
                <h3>📊 Bilan de Classement ELO (Match Classé)</h3>
                <p>
                  Votre ELO : <strong>{lastMatchResult.eloChange.myBefore}</strong> →{' '}
                  <strong>{lastMatchResult.eloChange.myAfter} ELO</strong> (
                  <strong
                    className={
                      lastMatchResult.eloChange.myDelta >= 0 ? 'bw-text-green' : 'bw-text-red'
                    }
                  >
                    {lastMatchResult.eloChange.myDelta >= 0
                      ? `+${lastMatchResult.eloChange.myDelta}`
                      : lastMatchResult.eloChange.myDelta}{' '}
                    ELO
                  </strong>
                  )
                </p>
                <p className="bw-muted-small">
                  Adversaire ({lastMatchResult.eloChange.oppUsername}) :{' '}
                  <strong>{lastMatchResult.eloChange.oppBefore} ELO</strong> — Plus votre adversaire
                  était faible par rapport à vous, plus la perte d’ELO est élevée ; plus il était
                  fort, moins vous perdez de points.
                </p>
              </div>
            )}
            <div className="bw-hero-cta-row">
              <button
                type="button"
                className="bw-btn bw-btn-primary bw-btn-lg"
                onClick={() =>
                  lastMatchResult?.mode?.startsWith('matchmaking')
                    ? setScreen('matchmaking')
                    : startNewLocalGame()
                }
              >
                Prendre sa Revanche
              </button>
              <button
                type="button"
                className="bw-btn bw-btn-secondary bw-btn-lg"
                onClick={() => setScreen('leaderboard')}
              >
                🏆 Voir le Classement ELO
              </button>
              <button
                type="button"
                className="bw-btn bw-btn-secondary bw-btn-lg"
                onClick={() => setScreen('tutorial')}
              >
                🎓 S’entraîner au Tutoriel
              </button>
              <button
                type="button"
                className="bw-btn bw-btn-ghost bw-btn-lg"
                onClick={() => setScreen('main_menu')}
              >
                Retour au Menu Principal
              </button>
            </div>
          </section>
        )}
      </main>

      {/* Dedicated Mobile Bottom Navigation Bar (§3.3) */}
      <nav className="bw-mobile-bottom-nav" aria-label="Navigation mobile principale">
        <button
          type="button"
          className={`bw-mobile-nav-item ${screen === 'home' ? 'active' : ''}`}
          onClick={() => setScreen('home')}
        >
          <span className="bw-mobile-nav-icon">🏠</span>
          <span className="bw-mobile-nav-label">Accueil</span>
        </button>

        <button
          type="button"
          className={`bw-mobile-nav-item ${
            screen === 'main_menu' ||
            screen === 'matchmaking' ||
            screen === 'waiting_room' ||
            screen === 'custom_create' ||
            screen === 'tutorial'
              ? 'active'
              : ''
          }`}
          onClick={() => setScreen('main_menu')}
        >
          <span className="bw-mobile-nav-icon">
            <PieceArtwork character="soldat" owner="red" size="xs" />
          </span>
          <span className="bw-mobile-nav-label">Jouer</span>
        </button>

        <button
          type="button"
          className={`bw-mobile-nav-item ${
            screen === 'characters_collection' ||
            screen === 'cards_collection' ||
            screen === 'rules'
              ? 'active'
              : ''
          }`}
          onClick={() => setScreen('characters_collection')}
        >
          <span className="bw-mobile-nav-icon">📚</span>
          <span className="bw-mobile-nav-label">Collection</span>
        </button>

        <button
          type="button"
          className={`bw-mobile-nav-item ${
            screen === 'history' || screen === 'leaderboard' || screen === 'stats' ? 'active' : ''
          }`}
          onClick={() => setScreen('history')}
        >
          <span className="bw-mobile-nav-icon">🏆</span>
          <span className="bw-mobile-nav-label">Historique</span>
        </button>

        <button
          type="button"
          className={`bw-mobile-nav-item ${
            screen === 'profile' ||
            screen === 'login' ||
            screen === 'register' ||
            screen === 'settings'
              ? 'active'
              : ''
          }`}
          onClick={() => setScreen('profile')}
        >
          <span className="bw-mobile-nav-icon">👤</span>
          <span className="bw-mobile-nav-label">Profil</span>
        </button>
      </nav>

      {/* Avatar Photo Cropper Modal (§4) */}
      <AvatarCropperModal
        open={showAvatarCropper}
        currentAvatarImage={userProfile?.avatarImage}
        onClose={() => setShowAvatarCropper(false)}
        onSaveAvatar={async (dataUrl) => {
          const updated = await apiUpdateProfile({ avatarImage: dataUrl });
          syncProfileFormAndSettings(updated);
          setProfileNotice('Photo de profil enregistrée !');
          pushAppNotification(
            'account',
            'Photo de profil mise à jour',
            'Votre nouvelle photo de profil est maintenant affichée.',
            'profile',
          );
        }}
        onRemoveAvatar={async () => {
          const updated = await apiUpdateProfile({ removeAvatarImage: true });
          syncProfileFormAndSettings(updated);
          setProfileNotice('Photo de profil supprimée (avatar de pion rétabli).');
        }}
      />

      {/* Global Anytime Help & FAQ Modal (§6) */}
      {showGlobalHelpModal && (
        <div className="bw-modal-backdrop" onClick={() => setShowGlobalHelpModal(false)}>
          <div className="bw-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="bw-modal-header">
              <h2>❓ Aide Rapide, FAQ & Paramètres BLIND WAR</h2>
              <button
                type="button"
                className="bw-btn bw-btn-ghost"
                onClick={() => setShowGlobalHelpModal(false)}
              >
                ✕ Fermer
              </button>
            </div>
            <div className="bw-modal-tabs">
              <button
                type="button"
                className={`bw-btn bw-btn-sm ${globalHelpTab === 'faq' ? 'bw-btn-primary' : 'bw-btn-secondary'}`}
                onClick={() => setGlobalHelpTab('faq')}
              >
                ❓ FAQ
              </button>
              <button
                type="button"
                className={`bw-btn bw-btn-sm ${globalHelpTab === 'settings' ? 'bw-btn-primary' : 'bw-btn-secondary'}`}
                onClick={() => setGlobalHelpTab('settings')}
              >
                ⚙️ Guide Paramètres
              </button>
              <button
                type="button"
                className={`bw-btn bw-btn-sm ${globalHelpTab === 'rules' ? 'bw-btn-primary' : 'bw-btn-secondary'}`}
                onClick={() => setGlobalHelpTab('rules')}
              >
                📜 Règles essentielles
              </button>
            </div>
            <div className="bw-modal-body">
              {globalHelpTab === 'faq' &&
                FAQ_ITEMS.map((faq) => (
                  <div key={faq.id} className="bw-rule-block">
                    <h4>{faq.question}</h4>
                    <p className="bw-muted-small">{faq.answer}</p>
                  </div>
                ))}
              {globalHelpTab === 'settings' &&
                SETTINGS_HELP_ITEMS.map((item) => (
                  <div key={item.id} className="bw-rule-block">
                    <h4>{item.section}</h4>
                    <p className="bw-muted-small">{item.summary}</p>
                  </div>
                ))}
              {globalHelpTab === 'rules' &&
                RULE_SECTIONS.slice(0, 4).map((sec) => (
                  <div key={sec.id} className="bw-rule-block">
                    <h4>{sec.title}</h4>
                    <p>{sec.summary}</p>
                    <ul>
                      {sec.bullets.slice(0, 4).map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
    </ThemeProvider>
  );
};
