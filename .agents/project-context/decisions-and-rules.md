# Règles, Contraintes et Décisions Validées — Blind-War (`decisions-and-rules.md`)

> Dernière mise à jour : `2026-11-19`
> **Règle stricte :** Ne jamais déplacer une proposition dans « Décisions validées » sans accord explicite de l'utilisateur.

## 1. Règles permanentes du projet (à ne pas modifier sans accord explicite)

- **Identités cachées & sécurité anti-fuite (règle d'or) :**
  - Le serveur est autoritaire ; aucune identité secrète ennemie ni effet secret (`Kamikaze`, `Protection`, `Contre-espionnage`, marquage du `Traqueur`, coordonnées de `Piège`, main adverse) ne doit fuiter vers le client adverse (`projectMatchStateForViewer` / `projectPieceForViewer` dans `shared/src/rules/visibility.ts`).
  - Les coups légaux (`legalMoves`) ne doivent pas révéler indirectement une identité cachée (seule `Invincibilité` est publique).
  - En mode local sur même écran, un écran de transition opaque protège la confidentialité entre tours.
- **Règles cœur du plateau et des pièces (cf. `README.md` §4) :**
  - Plateau `9×9`, Joueur 1 Rouge (lignes `6..8`, joue toujours en premier) contre Joueur 2 Noir (lignes `0..2`), `27` pièces / `12` rôles chacun.
  - Plafond absolu de `1` exemplaire vivant pour `Roi`, `Reine`, `Colosse`, `Traqueur`, `Exécuteur` et `Arbalétrier`.
  - Perte du `Roi` = défaite immédiate (`Roi` interdit de `Kamikaze`, `Invincibilité`, `Protection`, `Résurrection`).
  - Gestion des tours : `0` ou `1` élimination = `1` action (sans pénalité sur le `Cavalier`), `2+` éliminations dans le même tour = `1` Tour Bonus immédiat (déplacement gratuit sans carte).
  - Main de cartes limitée à `3` cartes max, pioche toutes les `3` éliminations (si `< 3` cartes, sauf `Sacrifice` utilisable à `3` cartes).
  - Départ officiel à `200` ELO, reconnexion `60 s`, Pat ou `5` répétitions (avertissement à `3`).

## 2. Contraintes techniques (vérifiées dans `package.json`)

- **Stack épinglée :**
  - TypeScript `^5.7.3` (strict), Vite `^6.0.7`, React `^18.3.1`, **Phaser `^3.87.0`** *(ne pas introduire d'API Phaser 4 sans migration validée)*, Express `^4.21.2`, Socket.IO `^4.8.1`, PostgreSQL `pg ^8.13.3` (+ fallback persistant `data/blind-war-db.json`), Vitest `^2.1.8`.
- **Architecture :**
  - `shared/src/` reste du TypeScript pur, déterministe, sans import `Phaser` ni DOM afin de tourner côté serveur et sous Vitest.
  - Ne jamais commiter `data/`, `.env`, clés ou bases locales (cf. `.gitignore`).
- **Commandes officielles de vérification :**
  - Typecheck : `npm run typecheck` (`tsc --noEmit`)
  - Tests : `npm test` (`vitest run`)
  - Build : `npm run build` (`tsc --noEmit && vite build`)

## 3. Décisions validées par l'utilisateur

| ID | Date | Décision validée | Contexte / Impact | Statut |
| :--- | :--- | :--- | :--- | :--- |
| `DEC-001` | `2026-11-19` | Mode par défaut du `prompt-engineer` réglé sur **`validation`** (`~/.gemini/config/skills/prompt-engineer/config.json`). | Toute demande passe par analyse + prompt 14 sections + accord utilisateur avant écriture (sauf surcharge explicite). | Validée |
| `DEC-002` | `2026-11-19` | Initialisation de la mémoire projet dans `Blind-War/.agents/project-context/` à partir de l'état réel du dépôt. | Point de référence partagé entre `prompt-engineer`, `game-director` et les sous-agents. | Validée |
| `DEC-003` | `2026-11-20` | Refonte UI/UX Pixel Art Minimaliste, échiquier dynamique selon le tour, historique des coups à gauche, ciblage direct du Traqueur sur l'échiquier, 5 thèmes (dont `Purple Night`), sons WebAudio à double volume (`masterVolume` + `soundVolume`), Mode Entraînement IA (3 difficultés + 4 situations) et Mode Spectateur, sans aucune altération des règles fondamentales de BLIND WAR. | Livré, vérifié par 17 suites Vitest (100 tests) + build Vite et publié sur GitHub. | Validée |
| `DEC-004` | `2026-11-20` | Traqueur : portée de base `2 cases` H/V et extension jusqu'à `4 cases` dès qu'un pion ennemi révélé (`1–4 cases` H/V) est ciblé sur l'échiquier via `🎯 Cibler (0 PA)` ; élagage des tutoriels aux seules mécaniques ; refonte Pixel Art 16×16 (`crispEdges`) des 13 pions, 16 cartes, 81 cases de l'échiquier et du site entier avec sélecteur rapide `👾` en 1 clic et commits atomiques par fonctionnalité. | Validé et livré en commits atomiques sur `origin/main`. | Validée |

## 4. Propositions en attente d'avis (NON validées)

- *(Aucune proposition en attente.)*
