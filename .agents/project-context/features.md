# Fonctionnalités — Blind-War (`features.md`)

> Dernière mise à jour : `2026-11-19` (initialisation factuelle à partir du dépôt réel)

## 1. Fonctionnalités existantes (vérifiées dans le dépôt)

- **Moteur de règles déterministe partagé (`shared/src/`)** :
  - Plateau `9×9`, armée de `27` pièces réparties en `12` rôles asymétriques (`constants/board.ts`, `constants/army.ts`, `constants/boardVisuals.ts`).
  - `16` cartes stratégiques (`constants/cards.ts`, `rules/engine.ts`, `rules/combat.ts`).
  - Placement initial & auto-complétion (`rules/placement.ts`), déplacements verrouillés (`rules/movement-locked.ts`), promotions (`rules/promotion.ts`), pendule (`rules/clock.ts`), ELO départ `200` (`rules/elo.ts`).
  - Visibilité anti-fuite et projection par observateur (`rules/visibility.ts`, `types/core.ts`).
  - Encyclopédie, tutoriels de pièces et préférences/thèmes (`rules/encyclopedia.ts`, `rules/tutorial.ts`, `rules/tutorialsData.ts`, `constants/themes.ts`, `types/preferences.ts`).
- **Serveur autoritaire & multijoueur (`server/src/`)** :
  - Express + Socket.IO (`server/src/index.ts`), gestion de salles (`rooms/roomManager.ts`), maillage P2P (`p2p/p2pMesh.ts`).
  - Authentification, changement de mot de passe, validation d'avatars (`auth/authService.ts`, `auth/avatarValidation.ts`).
  - Persistance PostgreSQL (`database/schema.sql`, `database/db.ts`) avec bascule transparente JSON (`data/blind-war-db.json`, `database/dataPaths.ts`).
- **Client Web React 18 + Phaser 3 (`client/src/`)** :
  - Plateau Phaser 3 (`client/src/board/PhaserBoardCanvas.tsx`, `annotations.ts`, `contextualTutorials.ts`).
  - UI complète React (`App.tsx`, `ui/GameBoardScreen.tsx`, composants `AvatarCropperModal.tsx`, `NotificationCenter.tsx`, `PieceArtwork.tsx`, `SettingsScreen.tsx`, `ThemePreviewPanel.tsx`, `themes/themeManager.tsx`).
  - Services client REST et moteur P2P navigateur (`services/apiClient.ts`, `services/browserP2PEngine.ts`).
- **Suite de tests automatisés Vitest (`tests/` — 16 fichiers)** :
  - `engine.test.ts`, `cards-and-combinations.test.ts`, `rebalance-and-rework.test.ts`, `update-v2-rules-and-consistency.test.ts`, `multiplayer-and-security.test.ts`, `password-change-and-security.test.ts`, `admin-rbac-and-management.test.ts`, `persistence-and-recovery.test.ts`, `themes-customization-and-security.test.ts`, `card-assets-and-themes.test.ts`, `game-ui-layout.test.ts`, `home-landing-page.test.ts`, `piece-description-panel.test.ts`, `piece-tutorials.test.ts`, `special-rules-and-learn-hub.test.ts`, `ui-consistency-and-responsive.test.ts`.

## 2. Fonctionnalités demandées (en attente)

- *(Aucune demande produit en attente lors de l'initialisation.)*

## 3. Fonctionnalités en cours

- *(Aucune fonctionnalité produit en cours lors de l'initialisation.)*

## 4. Fonctionnalités terminées et vérifiées (suivi Prompt Engineer)

- **Refonte UI/UX Pixel Art Minimaliste & Améliorations Complètes (`2026-11-20`)** :
  - **Sprites Pixel Art 16×16 (`shapeRendering="crispEdges"`, grille `64×64` au pas `4px`)** : créés pour les **13 pions** (`client/src/assets/pieces/silhouettes.tsx`) et les **16 cartes tactiques** (`client/src/assets/cards/base/silhouettes.tsx`), ainsi que les **81 tuiles de l'échiquier** (`bw-pixel-tile-sprite`) et l'habillage Pixel Art 16-bit intégral du site.
  - **Accès direct aux 7 Thèmes Pixel Art en 1 clic** : sélecteur rapide `👾` dans la barre de navigation supérieure (`App.tsx`), sélecteur rapide en pleine partie (`GameBoardScreen.tsx`), et application immédiate au clic dans `⚙️ Paramètres → 🎨 Apparence & Thèmes` (`SettingsScreen.tsx`).
  - **Équilibrage & Ciblage sur l'échiquier du Traqueur** : portée de base `1–2 cases` H/V ; bouton `🎯 Cibler sur l’échiquier (0 PA)` mettant en surbrillance les ennemis révélés alignés (`1–4 cases` H/V) directement sur l'échiquier ; dès qu'un pion est ciblé, la portée de Poursuite du Traqueur vers cette cible s'étend jusqu'à **`4 cases`**.
  - **Tutoriels épurés aux seules mécaniques** : suppression des popups contextuels génériques (`ctx_placement`, `ctx_turn_rules`, `ctx_cards_secret`), du scénario trivial `intro-plateau-roi` et des fiches redondantes (`rule-hidden-identity-and-placement`, `rule-strategy-duo-scouts`) pour ne conserver que les tutoriels introduisant une mécanique réelle.
  - **Échiquier dynamique selon le tour** : agrandissement subtil (`bw-board-turn-yours`) lors de notre tour et réduction subtile (`bw-board-turn-opponent`) lors du tour adverse sans décalage d'interface, plus réglage de taille (`boardScale`: `compact` | `normal` | `large`) et option `dynamicBoardScale`.
  - **Panneau d'historique des coups à gauche** (`bw-left-move-history-panel`) : structuré par tour (Joueur 1 / Joueur 2, pièce connue, captures, actions importantes), défilement automatique, mise en évidence du dernier coup, navigation historique (`←` / `→`), export JSON d'analyse et bouton ouvrir/réduire (`bw-left-history-toggle`).
  - **Sound Design Pixel Art WebAudio** : 9 événements sonores (`select`, `move`, `capture`, `ability`, `turn`, `alert`, `victory`, `defeat`, `menu`) avec contrôles indépendants (`soundEnabled`, `masterVolume`, `soundVolume`).
  - **Mode Entraînement contre IA (`shared/src/rules/ai.ts`) & Mode Spectateur** : IA anti-triche à 3 niveaux de difficulté (`easy`, `medium`, `hard`), 4 situations tactiques prédéfinies (`TRAINING_SITUATIONS`), Mode Partie Rapide, bouton « Passer le tutoriel », et Mode Spectateur à projection neutre (`projectMatchStateForSpectator`).

## 5. Fonctionnalités refusées ou abandonnées

- `[SUPPRIMÉE — règle historique]` Pénalité `0 élimination = 2 actions` du `Cavalier` (supprimée selon `README.md` §4 : quel que soit le pion, `0 élimination = 1 action`, `1 élimination = 1 action`, `2+ éliminations = 1 Tour Bonus immédiat`).
