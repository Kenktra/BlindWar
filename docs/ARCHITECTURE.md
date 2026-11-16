# BLIND WAR — Architecture Technique (Étape 2)

> Document de référence architecturale conforme au cahier des charges officiel (§15, §16, §18 Étape 2).
> Les paramètres dépendant des questions §19 non encore tranchées restent explicitement isolés dans une configuration centralisée `RulesetConfig`.

---

## 1. Organisation complète des fichiers

```text
Blind-War/
├── docs/
│   └── ARCHITECTURE.md
├── shared/
│   └── src/
│       ├── types/
│       │   ├── core.ts              # Types de base, projections client anti-fuite
│       │   ├── actions.ts           # Commandes joueur, payloads Socket.IO, résultats
│       │   └── ruleset.ts           # Configuration centralisée des règles & parties perso
│       ├── constants/
│       │   ├── board.ts             # Grille 9x9, zones de placement, timers préparation
│       │   ├── army.ts              # Composition exacte des 27 pièces par camp
│       │   └── cards.ts             # Catalogue des 16 cartes et restrictions verrouillées
│       ├── rules/
│       │   ├── placement.ts         # Validation placement 27 pièces + auto-complétion
│       │   ├── movement.ts          # Génération des coups légaux par personnage (hors fuites)
│       │   ├── combat.ts            # Moteur de combat centralisé & résolution Kamikaze/Colosse
│       │   ├── cards.ts             # Effets, durées, restrictions des 16 cartes
│       │   ├── visibility.ts        # Calcul Guetteurs, révélations temp/perm, projection client
│       │   └── turns.ts             # Machine à états des tours (Normal, Double action, Cavalier, Rage)
│       └── index.ts
├── server/
│   └── src/
│       ├── auth/                    # Inscription, connexion, hash Argon2/bcrypt, JWT/sessions
│       ├── database/                # Pool PostgreSQL, migrations SQL, repositories
│       ├── rooms/                   # Salles privées, codes d'invitation, paramètres personnalisés
│       ├── matchmaking/             # Files rapide / classée / non classée, appariement ELO
│       ├── game/                    # Orchestrateur de partie autoritaire, timers, reconnexion
│       ├── security/                # Rate limiting, validation schémas, filtrage par joueur
│       └── socket/                  # Handlers Socket.IO + gestion déconnexion/reprise
├── client/
│   └── src/
│       ├── scenes/                  # Scène plateau 9x9, animations déplacements/captures/révélations
│       ├── board/                   # Rendu cases, surbrillances, marqueurs protection/invincibilité/détection
│       ├── characters/              # Sprites/icônes distincts alliés & jeton neutre ennemi
│       ├── cards/                   # Main de 3 cartes, ciblage, confirmation, effets actifs
│       ├── local/                   # Contrôleur mode local + écran de transition confidentialité
│       ├── multiplayer/             # Client Socket.IO, synchronisation, reconnexion
│       ├── matchmaking/             # État file d'attente classée/non classée/rapide
│       ├── rules/                   # Données encyclopédie & scénarios guidés du tutoriel
│       ├── ui/                      # Les 19 pages/vues UI connectées aux services réels
│       └── services/                # Appels API REST (auth, profil, stats, historique, classement)
├── tests/
│   ├── unit/                        # Tests plateau, armée, mouvements, combats, cartes, tours
│   ├── security/                    # Vérification stricte anti-fuite d'identités dans les payloads
│   └── integration/                 # Parties complètes, reconnexions, matchmaking, BDD
└── README.md
```

---

## 2. Séparation des responsabilités (Serveur autoritaire & Zéro fuite)

### Règle d'or de sécurité (§4.5, §16)
Le moteur complet tourne côté **serveur** (ou dans un **coffre isolé** en mode local avec projection stricte par joueur actif).

1. **Aucune identité secrète ne quitte le serveur** :
   - Avant toute émission réseau (`game:state`, `game:action_result`, `game:legal_moves`), le module `visibility.ts` projette l'état complet (`ServerMatchState`) en deux vues distinctes : `ClientMatchView` pour `red` et `ClientMatchView` pour `black`.
   - Toute pièce ennemie non révélée a `character: null` et aucun champ dérivé (`colossusDirection`, `kamikazeHitsTaken` secret, etc.) permettant de déduire son rôle.
2. **Zéro fuite via les coups possibles (`legalMoves`)** :
   - Le serveur ne pré-bloque pas un coup d'une manière qui trahirait l'identité cachée de la cible (à l'exception de `Invincibilité` qui est explicitement publique selon §7 & §8.2).
   - Exemple : pour le saut du Cavalier sur un Colosse encore inconnu (§6.5), la case derrière la pièce reste proposée ; la tentative déclenche côté serveur l'interruption officielle du saut et la révélation du Colosse.
3. **Mode local confidentiel (§11.1)** :
   - Les deux joueurs utilisent le même poste avec un **écran de transition opaque** entre chaque tour.
   - Le composant local ne reçoit que la `ClientMatchView` du joueur courant pendant son tour, et masque toute identité privée durant l'écran intermédiaire.

---

## 3. Structures de données & Machine à états des tours

### État autoritaire d'une partie (`ServerMatchState`)
- `matchId`, `mode` (`local | online_custom | quick | ranked | unranked | tutorial`)
- `phase`: `placement | playing | finished`
- `ruleset`: instance de `RulesetConfig` (temps prépa, temps par tour, cartes activées, variantes validées en §19)
- `board`: grille `9 × 9` indexant `pieceId | null` + `traps[]` (posés par la carte `Piège`)
- `pieces`: `Map<pieceId, ServerPieceRecord>` (54 pièces max : 27 rouges, 27 noires)
- `players[red | black]`:
  - `hand`: `CardType[]` (max 3)
  - `killCounterTowardCard`: `0..3`
  - `recruitmentUsed`: `boolean`
  - `fogTurnsRemaining`: `number`
  - `blockCooldown`: `number`
- `turn`:
  - `activePlayer`: `PlayerColor`
  - `remainingActions`: `number` (1 en normal, 2 via Double action ou pénalité Cavalier)
  - `isCavalierBonusTurn`: `boolean` (verrou anti-boucle infinie)
  - `pendingChain`: `null | { type: 'cavalier_jump', pieceId, killsInChain } | { type: 'berserker_rage', pieceId }`
  - `pendingPromotion`: `null | { pieceId, coord }`
  - `rageUsedThisTurn`: `boolean`
- `graveyard`: enregistrements autoritaires avec provenance (`assassin`, `permanent_revelation`, etc.) projetés selon §4.4
- `actionLog`: historique horodaté filtré par observateur (aucun nom de pièce secrète ni marquage Traqueur adverse dans le log envoyé à l'adversaire)

---

## 4. Base de données PostgreSQL (Schéma logique)

| Table | Rôle | Colonnes clés |
|---|---|---|
| `users` | Comptes joueurs (§14) | `id (UUID PK)`, `username (UNIQUE)`, `email (UNIQUE)`, `password_hash`, `avatar_id`, `created_at`, `updated_at` |
| `player_ratings` | Classement & statistiques | `user_id (PK/FK)`, `rating` (système ELO à confirmer en §19.31), `wins`, `losses`, `draws`, `games_played`, `kills_total`, `king_captures` |
| `matches` | Métadonnées & issue des parties | `id (UUID PK)`, `mode`, `status`, `ruleset_json (JSONB)`, `red_user_id (FK)`, `black_user_id (FK)`, `winner_color`, `end_reason`, `started_at`, `ended_at` |
| `match_snapshots` | Reprise après crash / reconnexion | `match_id (PK/FK)`, `state_json (JSONB)`, `turn_number`, `updated_at` |
| `match_actions` | Audit & historique consultable | `id (BIGSERIAL PK)`, `match_id (FK)`, `seq`, `actor_color`, `action_type`, `public_summary_red`, `public_summary_black`, `created_at` |

---

## 5. Communications Client ↔ Serveur

### Endpoints HTTP REST (`/api/...`)
- `POST /api/auth/register` — Création compte + hash mot de passe sécurisé
- `POST /api/auth/login` — Authentification + émission jeton session / cookie HttpOnly
- `POST /api/auth/logout` — Révocation session
- `GET /api/users/me`, `PATCH /api/users/me` — Profil et préférences
- `GET /api/stats/:userId`, `GET /api/matches/history`, `GET /api/leaderboard` — Stats, historique, classement

### Événements temps réel Socket.IO
- **Matchmaking & Salles :**
  - `matchmaking:join` (`ranked | unranked | quick`) / `matchmaking:leave` / `matchmaking:matched`
  - `room:create` (avec `RulesetConfig` visible avant lancement) / `room:join` (`code`) / `room:ready` / `room:update_rules`
- **Phase de placement (§3.2) :**
  - `game:place_army` (envoie uniquement son propre placement de 27 pièces)
  - `game:placement_confirmed` / `game:placement_timer_sync`
- **Phase de jeu (§6–§9) :**
  - Client → Serveur : `game:select_piece` (ou calcul validé), `game:move` (avec `preferredKind` si ambiguïté), `game:mark_traqueur`, `game:jump_continue` / `game:jump_stop`, `game:rage_move` / `game:rage_skip`, `game:promote`, `game:play_card`, `game:resign`
  - Serveur → Client (strictement filtré par joueur) : `game:state_sync`, `game:turn_changed`, `game:action_applied`, `game:timer_tick`, `game:opponent_disconnected`, `game:ended`
