# Historique, Problèmes Connus et Risques — Blind-War (`changelog-and-issues.md`)

> Dernière mise à jour : `2026-11-19`

## 1. Historique des modifications vérifiées

| Date | Résumé | Fichiers clés | Vérifications exécutées |
| :--- | :--- | :--- | :--- |
| `2026-11-19` | Initialisation de la mémoire de projet `.agents/project-context/` pour l'intégration de `prompt-engineer`. | `.agents/project-context/*.md` | Vérification de cohérence contre `package.json`, `README.md`, `shared/src/`, `server/src/`, `client/src/`, `tests/`. |
| `2026-11-20` | Refonte UI/UX Pixel Art Minimaliste, échiquier dynamique selon le tour, panneau d'historique des coups à gauche, ciblage direct du Traqueur sur l'échiquier, thème `Purple Night`, synthèse audio pixel-art à volume général/effets indépendants, Mode Entraînement IA + situations prédéfinies et Mode Spectateur. | `shared/src/constants/themes.ts`, `shared/src/types/preferences.ts`, `shared/src/rules/ai.ts`, `client/src/board/PhaserBoardCanvas.tsx`, `client/src/ui/GameBoardScreen.tsx`, `client/src/components/SettingsScreen.tsx`, `client/src/components/HomeLandingPage.tsx`, `client/src/App.tsx`, `client/src/styles.css`, `tests/pixel-art-ui-ux-overhaul.test.ts` | `npm.cmd run typecheck` (0 erreur), `npm.cmd test` (17 fichiers / 100 tests passés), `npm.cmd run build` (succès). |

## 2. Problèmes connus et risques de régression

- `[DOC-DRIFT]` Les fichiers historiques `ARCHITECTURE.md` et `docs/ARCHITECTURE.md` décrivent une arborescence plus ancienne (ex. `tests/unit/`, `shared/src/rules/cards.ts`, `turns.ts`, ancienne mention de pénalité Cavalier dans `docs/ARCHITECTURE.md`) alors que le dépôt réel utilise `shared/src/rules/engine.ts`, `promotion.ts`, `encyclopedia.ts`, `tutorialsData.ts`, `server/src/p2p/p2pMesh.ts` et 16 fichiers plats dans `tests/*.test.ts`. Toujours vérifier le code réel et `README.md` avant de modifier une règle.
- `[PHASER-VERSION]` `package.json` épingle `phaser: ^3.87.0` : veiller à ne pas injecter de snippets spécifiques Phaser 4 (filtres/pipelines v4) lors des interventions `phaser-specialist` ou `game-feel-specialist`.
- `[GIT-TRACKING]` `.agents/` n'est pas listé dans `.gitignore` : les fichiers de `.agents/project-context/` apparaîtront dans `git status` (ce qui permet de les versionner avec le projet si souhaité).

## 3. Améliorations proposées (Bloc C — non implémentées)

- `[PROPOSÉE]` Synchroniser `ARCHITECTURE.md` / `docs/ARCHITECTURE.md` avec l'arborescence réelle actuelle (`shared/src/`, `server/src/`, `client/src/`, `tests/`). — Statut : En attente de décision utilisateur.
