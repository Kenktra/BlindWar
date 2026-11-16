import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createBlindWarServer } from '../server/src/index.js';

function makeTempDir(tag: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `bw-admin-${tag}-`));
}

async function startEphemeralServer(dbPath: string) {
  const srv = await createBlindWarServer({
    diskFilePath: dbPath,
    roomsSnapshotFilePath: null,
    enableP2P: false,
  });
  await new Promise<void>((resolve) => {
    srv.httpServer.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = srv.httpServer.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return {
    srv,
    baseUrl: `http://127.0.0.1:${port}`,
  };
}

describe('Compte Administrateur Kenktra_7003, Permissions Serveur & Audit (§4, §7)', () => {
  it('assigns admin role exclusively to Kenktra_7003, blocks non-admin HTTP calls with 401/403, and prevents self-promotion', async () => {
    const tmpDir = makeTempDir('rbac');
    const dbPath = path.join(tmpDir, 'blind-war-db.json');

    const { srv, baseUrl } = await startEphemeralServer(dbPath);
    try {
      const adminReg = await srv.authService.register('Kenktra_7003', 'AdminStrongPass123!');
      const playerReg = await srv.authService.register('JoueurNormal', 'PlayerPass123!');

      expect(adminReg.profile.role).toBe('admin');
      expect(playerReg.profile.role).toBe('player');

      // Non-authentifié -> 401
      const unauthRes = await fetch(`${baseUrl}/api/admin/overview`);
      expect(unauthRes.status).toBe(401);

      // Compte normal -> 403 sur toutes les routes admin
      const forbiddenOverview = await fetch(`${baseUrl}/api/admin/overview`, {
        headers: { Authorization: `Bearer ${playerReg.token}` },
      });
      expect(forbiddenOverview.status).toBe(403);

      const forbiddenStats = await fetch(
        `${baseUrl}/api/admin/users/${encodeURIComponent(adminReg.profile.id)}/stats`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${playerReg.token}`,
          },
          body: JSON.stringify({ eloRating: 50 }),
        },
      );
      expect(forbiddenStats.status).toBe(403);

      const forbiddenSuspend = await fetch(
        `${baseUrl}/api/admin/users/${encodeURIComponent(adminReg.profile.id)}/account`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${playerReg.token}`,
          },
          body: JSON.stringify({ accountStatus: 'suspended' }),
        },
      );
      expect(forbiddenSuspend.status).toBe(403);

      // Tentative d'auto-élévation de rôle / ELO via PATCH /api/profile ignorée côté serveur
      const hijackRes = await fetch(`${baseUrl}/api/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${playerReg.token}`,
        },
        body: JSON.stringify({ role: 'admin', eloRating: 9999, bio: 'Honnête' }),
      });
      expect(hijackRes.status).toBe(200);
      const hijackBody = (await hijackRes.json()) as { profile: { role: string; eloRating: number } };
      expect(hijackBody.profile.role).toBe('player');
      expect(hijackBody.profile.eloRating).toBe(200);

      // Protection P2P contre élévation de rôle injectée par un pair distant
      const fakePeerSnapshot = srv.db.exportSyncSnapshot();
      await srv.db.mergeRemoteSnapshot({
        users: fakePeerSnapshot.users.map((u) =>
          u.username === 'JoueurNormal' ? { ...u, role: 'admin', gamesPlayed: 99 } : u,
        ),
      });
      const playerAfterMerge = await srv.db.findUserById(playerReg.profile.id);
      expect(playerAfterMerge?.role).toBe('player');
    } finally {
      await srv.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('allows Kenktra_7003 to inspect users without password hashes, update stats/ELO, suspend/reactivate accounts, and persist changes', async () => {
    const tmpDir = makeTempDir('ops');
    const dbPath = path.join(tmpDir, 'blind-war-db.json');

    const { srv, baseUrl } = await startEphemeralServer(dbPath);
    let adminToken = '';
    let playerId = '';
    let playerToken = '';

    try {
      const adminReg = await srv.authService.register('Kenktra_7003', 'AdminStrongPass123!');
      const playerReg = await srv.authService.register('TacticianBeta', 'BetaPass123!');
      adminToken = adminReg.token;
      playerId = playerReg.profile.id;
      playerToken = playerReg.token;

      // Liste utilisateurs via admin : zéro fuite de passwordHash
      const ovRes = await fetch(`${baseUrl}/api/admin/overview`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(ovRes.status).toBe(200);
      const ovRawText = await ovRes.text();
      expect(ovRawText).not.toContain('passwordHash');
      expect(ovRawText).not.toContain('password_hash');

      // Modification ELO + statistiques d'un autre joueur par l'administrateur
      const editStatsRes = await fetch(
        `${baseUrl}/api/admin/users/${encodeURIComponent(playerId)}/stats`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            eloRating: 485,
            wins: 7,
            losses: 2,
            draws: 1,
            gamesPlayed: 10,
            totalEliminations: 33,
            newMechanicsStats: {
              arbaletrierShotsSucceeded: 4,
            },
            reason: 'Correction ELO tournoi',
          }),
        },
      );
      expect(editStatsRes.status).toBe(200);
      const editStatsJson = (await editStatsRes.json()) as {
        profile: { eloRating: number; wins: number; newMechanicsStats: { arbaletrierShotsSucceeded: number } };
        logEntry: { actionType: string; targetUsername: string };
      };
      expect(editStatsJson.profile.eloRating).toBe(485);
      expect(editStatsJson.profile.wins).toBe(7);
      expect(editStatsJson.profile.newMechanicsStats.arbaletrierShotsSucceeded).toBe(4);
      expect(editStatsJson.logEntry.actionType).toBe('update_stats');

      // L'administrateur ne peut pas s'auto-suspendre
      const selfSuspendRes = await fetch(
        `${baseUrl}/api/admin/users/${encodeURIComponent(adminReg.profile.id)}/account`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ accountStatus: 'suspended' }),
        },
      );
      expect(selfSuspendRes.status).toBe(400);

      // Suspension d'un joueur normal -> connexion & session existante refusées immédiatement
      const suspendRes = await fetch(
        `${baseUrl}/api/admin/users/${encodeURIComponent(playerId)}/account`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            accountStatus: 'suspended',
            suspendedReason: 'Test modération',
          }),
        },
      );
      expect(suspendRes.status).toBe(200);

      const suspendedMeRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${playerToken}` },
      });
      expect(suspendedMeRes.status).toBe(403);
      await expect(srv.authService.login('TacticianBeta', 'BetaPass123!')).rejects.toThrow(/suspendu/i);

      // Réactivation du compte
      const reactivateRes = await fetch(
        `${baseUrl}/api/admin/users/${encodeURIComponent(playerId)}/account`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ accountStatus: 'active' }),
        },
      );
      expect(reactivateRes.status).toBe(200);
      const relogin = await srv.authService.login('TacticianBeta', 'BetaPass123!');
      expect(relogin.profile.eloRating).toBe(485);
      expect(relogin.profile.accountStatus).toBe('active');
    } finally {
      await srv.close();
    }

    // Vérification de la persistance après redémarrage complet du serveur
    const { srv: srv2, baseUrl: baseUrl2 } = await startEphemeralServer(dbPath);
    try {
      const ov2Res = await fetch(`${baseUrl2}/api/admin/overview`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(ov2Res.status).toBe(200);
      const ov2 = (await ov2Res.json()) as {
        users: Array<{ id: string; eloRating: number; wins: number; gamesPlayed: number }>;
        adminLogs: Array<{ actionType: string }>;
      };
      const modifiedPlayer = ov2.users.find((u) => u.id === playerId)!;
      expect(modifiedPlayer.eloRating).toBe(485);
      expect(modifiedPlayer.wins).toBe(7);
      expect(modifiedPlayer.gamesPlayed).toBe(10);
      expect(ov2.adminLogs.length).toBeGreaterThanOrEqual(3);
    } finally {
      await srv2.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
