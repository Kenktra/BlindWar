import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { OFFICIAL_RULESET_CONFIG } from '../shared/src/index.js';
import { BlindWarDatabase } from '../server/src/database/db.js';
import { resolveDataFilePath, resolveProjectRoot } from '../server/src/database/dataPaths.js';
import { createBlindWarServer } from '../server/src/index.js';

function makeTempDir(tag: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `bw-persist-${tag}-`));
}

describe('Système de sauvegarde persistant, anti-duplication & récupération (§3)', () => {
  it('resolves canonical project data directory consistently even if process.cwd() changes', () => {
    const expectedRoot = resolveProjectRoot();
    const origCwd = process.cwd();
    const otherDir = path.join(expectedRoot, 'server');
    try {
      process.chdir(otherDir);
      const fromOtherCwd = resolveDataFilePath('blind-war-db.json');
      process.chdir(expectedRoot);
      const fromRoot = resolveDataFilePath('blind-war-db.json');
      expect(fromOtherCwd).toBe(fromRoot);
    } finally {
      process.chdir(origCwd);
    }
  });

  it('reuses the exact same database file across multiple server restarts without creating extra files', async () => {
    const tmpDir = makeTempDir('restarts');
    const dbPath = path.join(tmpDir, 'blind-war-db.json');
    const roomsPath = path.join(tmpDir, 'active-rooms.json');

    try {
      // Premier démarrage : initialise le fichier unique
      const srv1 = await createBlindWarServer({
        diskFilePath: dbPath,
        roomsSnapshotFilePath: roomsPath,
        enableP2P: false,
      });
      await srv1.authService.register('JoueurUn', 'MotDePasse123');
      await srv1.authService.register('JoueurDeux', 'MotDePasse456');
      await srv1.close();

      // Redémarrage 2 : réutilisation sans création d'un autre fichier
      const srv2 = await createBlindWarServer({
        diskFilePath: dbPath,
        roomsSnapshotFilePath: roomsPath,
        enableP2P: false,
      });
      expect(srv2.db.getStorageHealth().usersCount).toBe(2);
      const j1 = await srv2.db.findUserByUsername('JoueurUn');
      const j2 = await srv2.db.findUserByUsername('JoueurDeux');
      expect(j1).not.toBeNull();
      expect(j2).not.toBeNull();

      await srv2.db.recordCompletedMatch({
        matchId: 'persist-match-1',
        mode: 'matchmaking_ranked',
        redUserId: j1!.id,
        blackUserId: j2!.id,
        redUsername: j1!.username,
        blackUsername: j2!.username,
        winner: 'red',
        outcomeReason: 'king_eliminated',
        turnsPlayed: 14,
        redEliminations: 5,
        blackEliminations: 2,
        ruleset: OFFICIAL_RULESET_CONFIG,
        startedAt: new Date().toISOString(),
      });
      await srv2.close();

      // Redémarrage 3 : tout est conservé et aucun nouveau fichier parasite n'apparaît
      const srv3 = await createBlindWarServer({
        diskFilePath: dbPath,
        roomsSnapshotFilePath: roomsPath,
        enableP2P: false,
      });
      const health = srv3.db.getStorageHealth();
      expect(health.usersCount).toBe(2);
      expect(health.matchesCount).toBe(1);
      expect(health.eloHistoryCount).toBe(2);

      const refreshedJ1 = await srv3.db.findUserByUsername('JoueurUn');
      expect(refreshedJ1!.wins).toBe(1);
      expect(refreshedJ1!.eloRating).toBeGreaterThan(200);
      await srv3.close();

      const files = fs.readdirSync(tmpDir).sort();
      // Uniquement le fichier DB principal (+ son unique sauvegarde .bak après mutations)
      expect(files.filter((f) => f.endsWith('.tmp'))).toHaveLength(0);
      expect(files).toEqual(['blind-war-db.json', 'blind-war-db.json.bak']);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('serializes concurrent writes cleanly without dropping records or corrupting JSON', async () => {
    const tmpDir = makeTempDir('concurrency');
    const dbPath = path.join(tmpDir, 'blind-war-db.json');

    try {
      const db = new BlindWarDatabase({ diskFilePath: dbPath });
      await Promise.all(
        Array.from({ length: 12 }, (_, idx) =>
          db.createUser({
            id: `u-conc-${idx}`,
            username: `ConcUser${idx}`,
            passwordHash: 'hash',
          }),
        ),
      );

      await Promise.all(
        Array.from({ length: 12 }, (_, idx) =>
          db.updateUserProfile(`u-conc-${idx}`, { bio: `Bio #${idx}` }),
        ),
      );

      const reloaded = new BlindWarDatabase({ diskFilePath: dbPath });
      expect(reloaded.getStorageHealth().usersCount).toBe(12);
      const sample = await reloaded.findUserById('u-conc-9');
      expect(sample?.bio).toBe('Bio #9');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('recovers intact data from .bak automatically when primary file is corrupted', async () => {
    const tmpDir = makeTempDir('recovery');
    const dbPath = path.join(tmpDir, 'blind-war-db.json');

    try {
      const db = new BlindWarDatabase({ diskFilePath: dbPath });
      const u1 = await db.createUser({
        id: 'u-recover-1',
        username: 'PhoenixOne',
        passwordHash: 'h1',
      });
      await db.updateUserProfile(u1.id, { bio: 'Sauvegarde fiable' });
      // Crée une deuxième mutation pour garantir une copie .bak contenant PhoenixOne
      await db.createUser({
        id: 'u-recover-2',
        username: 'PhoenixTwo',
        passwordHash: 'h2',
      });

      // Simule une corruption brutale du fichier principal
      fs.writeFileSync(dbPath, '{ "users": [ CORRUPT_JSON ', 'utf-8');

      const recovered = new BlindWarDatabase({ diskFilePath: dbPath });
      const check1 = await recovered.findUserById(u1.id);
      expect(check1).not.toBeNull();
      expect(check1!.bio).toBe('Sauvegarde fiable');
      // Le fichier principal doit avoir été réparé proprement au rechargement
      expect(() => JSON.parse(fs.readFileSync(dbPath, 'utf-8'))).not.toThrow();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
