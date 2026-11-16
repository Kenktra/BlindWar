# BLIND WAR — Jeu de Stratégie Multijoueur à Identités Cachées (9×9)

**BLIND WAR** est un jeu de stratégie sur plateau 9×9 inspiré des échecs et des dames où deux joueurs (**Rouge** et **Noir**) s'affrontent avec **27 pièces chacun** réparties en **12 rôles asymétriques** et **16 cartes tactiques**. Toutes les positions sur le plateau sont publiques, mais les identités des pièces adverses restent secrètes tant qu'elles n'ont pas été révélées par un Guetteur, un Assassin, une carte de reconnaissance ou la capacité du Colosse.

---

## 1. Architecture Technique (§19)

- **Moteur de règles partagé (`shared/src/`)** : TypeScript strict, 100 % déterministe, utilisé par le serveur autoritaire et le client local/tutoriel.
- **Serveur Autoritaire (`server/src/`)** : Node.js + Express + Socket.IO avec filtrage anti-triche (`projectMatchStateForViewer`) garantissant qu'aucune identité cachée ni aucun effet secret (`Kamikaze`, `Protection`, `Contre-espionnage`, marquage du `Traqueur`, coordonnées de `Piège`, main adverse) ne transite vers le client adverse.
- **Base de données (`server/src/database/`)** : PostgreSQL (`schema.sql` + `pg`) avec bascule transparente sur stockage transactionnel JSON persistant (`data/blind-war-db.json`) lorsqu'aucune variable `DATABASE_URL` externe n'est fournie.
- **Client Web (`client/src/`)** : React 18 + TypeScript + Phaser 3 + Vite, proposant les **19 pages obligatoires** (§18.2) et un thème militaire sombre responsive (Rouge, Noir, Gris, Blanc).
- **Tests Automatisés (`tests/`)** : Suite complète Vitest couvrant toutes les règles officielles, les 12 personnages, les 16 cartes, les cas complexes (§21) et l'anti-fuite réseau.

---

## 2. Prérequis et Installation

1. **Node.js 20+** et **npm**.
2. Installer les dépendances à la racine du projet :

```bash
npm install
```

3. *(Optionnel)* **PostgreSQL** :
   - Si vous souhaitez utiliser une base PostgreSQL dédiée, exécutez le schéma SQL :
     ```bash
     psql -U postgres -d blind_war -f server/src/database/schema.sql
     ```
   - Puis définissez la variable d'environnement `DATABASE_URL` :
     ```bash
     export DATABASE_URL="postgresql://postgres:password@localhost:5432/blind_war"
     ```
   - Sans `DATABASE_URL`, le serveur utilise automatiquement la base persistante locale `data/blind-war-db.json` (aucune configuration requise).

---

## 3. Commandes de Lancement & Tests

### Exécuter la suite complète de tests automatisés (§20)
```bash
npm test
```

### Lancer le serveur + le client en mode développement
- Terminal 1 (Serveur API + Socket.IO sur `http://localhost:3001`) :
  ```bash
  npm run dev:server
  ```
- Terminal 2 (Client Vite + React + Phaser sur `http://localhost:5173`) :
  ```bash
  npm run dev
  ```

### Compiler et lancer en production
```bash
npm run build
npm start
```
Puis ouvrez `http://localhost:3001` dans votre navigateur.

---

## 4. Récapitulatif des Règles Officielles Implémentées

- **Plateau 9×9 (81 cases)** : Joueur 1 Rouge (lignes du bas `6..8`, commence toujours la partie) contre Joueur 2 Noir (lignes du haut `0..2`).
- **Phase de préparation** : 90 secondes en officiel (personnalisable : 30s, 60s, 90s, 120s, 180s) avec placement automatique des pièces restantes à `00:00`.
- **27 pièces par joueur (12 rôles)** :
  - `Roi` (1) : 1 case dans les 8 directions ; sa perte entraîne la défaite immédiate ; interdit de `Kamikaze`, `Invincibilité`, `Protection`, `Résurrection`.
  - `Reine` (1) : jusqu'à 2 cases dans les 8 directions sans sauter d'obstacle ; peut tuer le `Colosse` ; non ressuscitée ; max 1 vivante.
  - `Colosse` (1) : 5 directions (`avant`, `avant-gauche`, `avant-droite`, `gauche`, `droite`) ; inverse son sens au bord opposé et se ré-inverse à son bord de départ en se révélant temporairement pendant **1 tour complet** ; invulnérable sauf contre `Roi`, `Reine`, un autre `Colosse`, la `Frappe traversante` de l’`Exécuteur`, ou **2 déclenchements `Kamikaze` par le `Colosse` (`2/2`)**.
  - `Cavalier` (2) : **1 case orthogonale (H/V)**, **Bond en « L » (`±2, ±1` / `±1, ±2`)** par-dessus tous les pions et pièges intermédiaires sans déclencher ces pièges, OU **Saut Percée style dames (8 directions)** avec enchaînement optionnel multiple (la règle de pénalité `0 élimination = 2 actions` est supprimée).
  - `Berserker` (1) : jusqu'à 2 cases H/V ; **Rage** après élimination offrant un 2e déplacement optionnel gratuit (jusqu'à 2 cases H/V sans capture, max 1 fois par tour).
  - `Assassin` (3) : 1 case (8 directions) ; révèle définitivement toute pièce qu'il élimine sauf s'il meurt sur un `Kamikaze`.
  - `Guetteur H` (3) : se déplace d'1 case en diagonale (4 sens) ; révèle les pièces ennemies adjacentes horizontalement/verticalement.
  - `Guetteur D` (3) : se déplace d'1 case horizontalement ou verticalement (avant, arrière, gauche, droite) ; révèle les pièces ennemies adjacentes en diagonale.
  - `Traqueur` (1) : se déplace de 1 à 3 cases H/V (sans diagonale ni obstacle) ; **Marquage de cible** (coût **0 action**, sur ennemi déjà révélé à 1–3 cases H/V sans obstacle) activant **Poursuite** dès son **tour suivant** : **+1 case (4e case)** utilisable uniquement pour **éliminer** cette cible marquée (impossible si la 4e case est vide ou bloquée, et ne traverse pas une cible intermédiaire) ; max 1 exemplaire vivant.
  - `Exécuteur` (1) : se déplace de 1 à 2 cases H/V ; **Frappe traversante** permettant d'éliminer l'ennemi en 2e case derrière une pièce ennemie sans quitter sa case ; seul personnage spécial capable d'abattre un `Colosse` via `Frappe traversante` (même si le `Colosse` est l'obstacle frontal ou la cible arrière) ; max 1 exemplaire vivant.
  - `Arbalétrier` (1) : se déplace d'1 case H/V (autorisé pendant la recharge) ; **Tir d'arbalète** sans se déplacer dans les 8 directions à 1–3 cases sans obstacle avec une cadence de **1 tir tous les 3 tours personnels** (Tour 1 prêt → Tours 2 et 3 indisponibles → Tour 4 prêt ; les tours adverses et `Double Action` ne contournent pas la recharge), bloqué par le `Colosse` sans le révéler ; max 1 exemplaire vivant.
  - `Soldat` (9) : avance d'1 case (3 directions avant) mais **capture uniquement sur les 2 diagonales avant** ; promu au bord opposé en tout personnage sauf `Roi`/`Soldat` (plafond max 1 exemplaire vivant pour `Reine`, `Colosse`, `Traqueur`, `Exécuteur` et `Arbalétrier`).
- **Gestion des Tours & Tours Bonus** : Quel que soit le pion utilisé, **0 élimination = 1 action** (aucune pénalité), **1 élimination = 1 action**, et **2+ éliminations dans le même tour = 1 Tour Bonus immédiat** (1 déplacement gratuit sans carte autorisée ; l'état/compteur du Tour Bonus reste synchronisé côté serveur).
- **16 Cartes Stratégiques** : Maximum 3 cartes en main, pioche aléatoire infinie toutes les 3 éliminations (uniquement si `< 3` cartes en main, sauf `Sacrifice` utilisable même à 3 cartes).
- **Pendule & Matchs Nuls** : 10 minutes par joueur en officiel (personnalisable : 3, 5, 10, 15, 30 min), reconnexion 60s, départ officiel à **200 ELO**, nul par accord mutuel, **Pat** (aucun coup ni carte jouable) ou **5 répétitions** (avertissement à 3 répétitions).
