# BLIND WAR — Architecture Technique et Plan de Développement

> Référence technique officielle conforme au cahier des charges (§18, §19, §21, §23, §24).

---

## 1. Architecture Globale Recommandée

### Stack Technique (§18, §22.30–31)
- **Moteur & Types partagés (`shared/`) :** TypeScript strict, fonctions pures déterministes partagées entre serveur et client, tests unitaires et combinatoires exhaustifs.
- **Serveur Autoritaire (`server/`) :** Node.js + TypeScript + Express (API REST comptes/profils/stats) + Socket.IO (temps réel, salles, matchmaking, horloge serveur, reconnexion 60 s).
- **Base de données :** PostgreSQL (utilisateurs, hash Argon2/bcrypt, classement ELO initialisé à `200`, historique des parties, snapshots de reprise, variations ELO).
- **Client Web (`client/`) :** Recommandation : **React + Vite + TypeScript + Phaser 3** :
  - **Phaser 3** pilote le plateau 9 × 9, les animations de déplacement/capture/révélation, les zones de reconnaissance des Guetteurs et les effets visuels.
  - **React + Vite** structure proprement les **19 pages obligatoires** (§15), l'encyclopédie interactive (§16), le tutoriel scénarisé (§12.5), le mode local avec écran de transition confidentiel (§12.1) et les tableaux de classement/statistiques.

---

## 2. Arborescence Modulaire du Projet

```text
Blind-War/
├── ARCHITECTURE.md
├── README.md
├── shared/
│   └── src/
│       ├── types/
│       │   └── core.ts                 # Types serveur vs projections client anti-fuite
│       ├── constants/
│       │   ├── board.ts                # Grille 9x9, zones 3 rangées, pendule 10 min, ELO 200
│       │   ├── army.ts                 # 27 pièces (12 rôles), quotas initiaux et plafonds absolus (Roi/Reine/Colosse/Traqueur/Exécuteur/Arbalétrier = 1)
│       │   └── cards.ts                # 16 cartes, secret des cibles, compteur de pioche (< 3 cartes)
│       ├── rules/
│       │   ├── placement.ts            # Validation placement libre + auto-complétion à 0s
│       │   ├── movement-locked.ts      # Déplacements verrouillés, saut Cavalier unique, Soldat diag
│       │   ├── visibility.ts           # Guetteurs H/D, Brouillard (3 tours), Cimetière (§4.4)
│       │   ├── combat.ts               # Résolution attaques, Colosse, Kamikaze, Protection, Invincibilité
│       │   ├── cards.ts                # Logique des 16 cartes et interactions
│       │   ├── turns.ts                # Machine à états des tours (Normal, Double action, Cavalier, Rage)
│       │   ├── clock.ts                # Pendule d'échecs 10 min par joueur + forfait à 0
│       │   └── elo.ts                  # Calcul ELO standard (départ 200 ELO)
│       └── index.ts
├── server/
│   └── src/
│       ├── auth/                       # Inscription, connexion, sessions sécurisées, hash mot de passe
│       ├── database/                   # Schéma SQL PostgreSQL, repositories, transactions
│       ├── game/                       # Orchestrateur autoritaire, pendules serveur, reconnexion 60s
│       ├── rooms/                      # Salles privées, code de salle, règles personnalisées
│       ├── matchmaking/                # Files rapide, classée (ELO), non classée
│       └── security/                   # Projection par joueur, anti-triche, rate-limiting
├── client/
│   └── src/
│       ├── scenes/                     # Scène Phaser 3 du plateau 9x9 et animations
│       ├── board/                      # Rendu cases, indicateurs Invincibilité/Reconnaissance
│       ├── characters/                 # Visuels distincts propriétaire vs apparence neutre ennemie
│       ├── cards/                      # Main (max 3), ciblage, notifications d'effets secrets
│       ├── matchmaking/                # Interfaces de recherche d'adversaire
│       ├── multiplayer/                # Client Socket.IO, synchronisation temps réel, reconnexion
│       ├── rules/                      # Encyclopédie synchronisée & scénarios du tutoriel
│       ├── ui/                         # Les 19 pages fonctionnelles (Accueil -> Victoire/Défaite)
│       └── services/                   # Client API REST & stockage session
└── tests/
    ├── unit/                           # Tests unitaires plateau, personnages, cartes, tours, pendule, ELO
    ├── combinations/                   # Tests croisés personnages × cartes × effets temporaires
    ├── security/                       # Audit automatisé d'absence de fuite d'identité dans les payloads
    └── integration/                    # Parties complètes, déconnexion/reconnexion 60s, matchmaking
```

---

## 3. Sécurité & Projection Anti-Fuite (§4.5, §9, §19)

1. **Séparation stricte `ServerPieceRecord` / `ClientPieceView` :**
   - `projectPieceForViewer()` (dans `shared/src/rules/visibility.ts`) filtre chaque pièce avant envoi réseau.
   - Si une pièce ennemie n'est ni révélée définitivement, ni révélée temporairement, ni détectée par un Guetteur (ou si le camp adverse est sous `Brouillard`), `character` vaut strictement `null`.
   - Les effets secrets (`Kamikaze`, `Protection`, `Contre-espionnage`, `Piège`) ne sont jamais exposés sur la pièce ou la case dans la vue envoyée à l'adversaire (`isProtectedVisible: false`, `hasKamikazeVisible: false`, `hasCounterEspionageVisible: false`).
2. **Cimetière conforme aux décisions §4.4 et §21.2 :**
   - `createGraveyardRecordOnElimination()` fige au moment exact de la mort si la pièce était visible par l'adversaire (révélation permanente, temporaire, Guetteur, carte) ou tuée par un Assassin (sauf si l'Assassin meurt par `Kamikaze` selon §7 & §21.13).
   - Sinon, `projectGraveyardEntryForViewer()` renvoie exclusivement `label: "Pièce éliminée"` et `character: null`.

---

## 4. Plan de Développement Détaillé (10 Étapes)

1. **Étape 1 — Analyse & Référentiel des règles** *(Fait — en attente uniquement des validations §22)*
2. **Étape 2 — Architecture & Socle partagé verrouillé** *(En cours — `core.ts`, `board.ts`, `army.ts`, `cards.ts`, `placement.ts`, `visibility.ts`, `movement-locked.ts`, `clock.ts`, `elo.ts` créés)*
3. **Étape 3 — Moteur de jeu complet** : Finalisation combat, promotion, sauts Cavalier, Colosse, Rage Berserker et machine à états des tours dès validation des questions §22.1–11 et §22.23–25.
4. **Étape 4 — Identités cachées & Sécurité** : Intégration complète des durées de révélation, Guetteurs, Brouillard, Contre-espionnage, Cimetière et tests d'étanchéité réseau.
5. **Étape 5 — Système des 16 Cartes** : Implémentation et tests individuels + combinatoires des 16 cartes (§8.1–8.16).
6. **Étape 6 — Mode Local (2 joueurs sur le même écran)** : Partie complète du placement à la victoire avec écran de transition confidentiel et pendule 10 min.
7. **Étape 7 — Backend Multijoueur & PostgreSQL** : Authentification, profils, classement 200 ELO, salles personnalisées, matchmaking (rapide/classé/non classé), reconnexion 60 s.
8. **Étape 8 — Interface Utilisateur (19 pages) & Encyclopédie / Tutoriel** : Toutes les pages connectées, plateau Phaser 3 responsive, encyclopédie et scénarios guidés.
9. **Étape 9 — Campagne de Tests Automatisés (§20)** : Exécution de la suite complète (unitaires, combinaisons, sécurité, intégration) et correction de tout écart.
10. **Étape 10 — Finalisation & Documentation** : Vérification bout-en-bout, scripts de lancement et guide d'installation complet.
