import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_PASSWORD_VERIFY_ATTEMPTS, verifyPassword } from '../server/src/auth/authService.js';
import { createBlindWarServer } from '../server/src/index.js';

function makeTempDir(tag: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `bw-pw-${tag}-`));
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

describe('Système sécurisé de modification du mot de passe (§5, §7)', () => {
  it('verifies current password, rejects wrong old password or mismatching confirmation, changes password with bcrypt, invalidates old sessions, and preserves stats', async () => {
    const tmpDir = makeTempDir('flow');
    const dbPath = path.join(tmpDir, 'blind-war-db.json');

    const { srv, baseUrl } = await startEphemeralServer(dbPath);
    try {
      const reg = await srv.authService.register('CmdSecurite', 'AncienPass2026!');
      const otherSession = await srv.authService.login('CmdSecurite', 'AncienPass2026!');

      await srv.db.updateUserProfile(reg.profile.id, {
        bio: 'Compte protégé',
        preferences: { colorMode: 'light', siteThemeId: 'bleu_et_argent' },
      });

      const storedBefore = await srv.db.findUserById(reg.profile.id);
      expect(storedBefore?.passwordHash.startsWith('$2')).toBe(true);
      expect(storedBefore?.passwordHash).not.toContain('AncienPass2026!');

      // 1. Ancien mot de passe correct -> OK
      const verifyOk = await fetch(`${baseUrl}/api/auth/verify-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${reg.token}`,
        },
        body: JSON.stringify({ currentPassword: 'AncienPass2026!' }),
      });
      expect(verifyOk.status).toBe(200);
      expect(((await verifyOk.json()) as { verified: boolean }).verified).toBe(true);

      // 2. Ancien mot de passe incorrect -> refusé (403)
      const verifyBad = await fetch(`${baseUrl}/api/auth/verify-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${reg.token}`,
        },
        body: JSON.stringify({ currentPassword: 'MauvaisPassword!' }),
      });
      expect(verifyBad.status).toBe(403);

      // 3. Nouveaux mots de passe différents -> refusé (400)
      const mismatchRes = await fetch(`${baseUrl}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${reg.token}`,
        },
        body: JSON.stringify({
          currentPassword: 'AncienPass2026!',
          newPassword: 'NouveauPass789!',
          confirmPassword: 'AutrePassDifferent!',
        }),
      });
      expect(mismatchRes.status).toBe(400);

      // 4. Modification avec mauvais ancien mot de passe -> refusé (403)
      const wrongOldChange = await fetch(`${baseUrl}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${reg.token}`,
        },
        body: JSON.stringify({
          currentPassword: 'FauxAncienPassword!',
          newPassword: 'NouveauPass789!',
          confirmPassword: 'NouveauPass789!',
        }),
      });
      expect(wrongOldChange.status).toBe(403);

      // 5. Modification réussie -> nouveau hash bcrypt, ancien jeton invalidé, nouveau jeton valide
      const okChange = await fetch(`${baseUrl}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${reg.token}`,
        },
        body: JSON.stringify({
          currentPassword: 'AncienPass2026!',
          newPassword: 'NouveauPassUltra789!',
          confirmPassword: 'NouveauPassUltra789!',
        }),
      });
      expect(okChange.status).toBe(200);
      const changeRawText = await okChange.text();
      expect(changeRawText).not.toContain('passwordHash');
      expect(changeRawText).not.toContain('NouveauPassUltra789!');
      const changeData = JSON.parse(changeRawText) as {
        token: string;
        profile: { bio: string; preferences: { colorMode: string; siteThemeId: string } };
      };
      expect(changeData.profile.bio).toBe('Compte protégé');
      expect(changeData.profile.preferences.colorMode).toBe('light');

      // Anciennes sessions (sur d'autres navigateurs / avant changement) immédiatement invalidées
      const oldSessionMe = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${otherSession.token}` },
      });
      expect(oldSessionMe.status).toBe(401);

      // Nouveau jeton retourné reste valide
      const newSessionMe = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${changeData.token}` },
      });
      expect(newSessionMe.status).toBe(200);

      // Ancien mot de passe ne fonctionne plus ; nouveau mot de passe fonctionne
      await expect(srv.authService.login('CmdSecurite', 'AncienPass2026!')).rejects.toThrow();
      const relogin = await srv.authService.login('CmdSecurite', 'NouveauPassUltra789!');
      expect(relogin.profile.id).toBe(reg.profile.id);

      const storedAfter = await srv.db.findUserById(reg.profile.id);
      expect(storedAfter?.passwordHash.startsWith('$2')).toBe(true);
      expect(verifyPassword('NouveauPassUltra789!', storedAfter!.passwordHash)).toBe(true);
    } finally {
      await srv.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rate-limits repeated wrong password verification attempts (HTTP 429) and preserves legacy scrypt login compatibility', async () => {
    const tmpDir = makeTempDir('ratelimit');
    const dbPath = path.join(tmpDir, 'blind-war-db.json');

    const { srv, baseUrl } = await startEphemeralServer(dbPath);
    try {
      // Crée un compte au format scrypt historique (identique aux comptes déjà présents dans blind-war-db.json)
      const salt = crypto.randomBytes(16).toString('hex');
      const scryptDerived = crypto.scryptSync('LegacyPass123!', salt, 64).toString('hex');
      await srv.db.createUser({
        id: 'legacy-u1',
        username: 'LegacyVeteran',
        passwordHash: `${salt}:${scryptDerived}`,
      });

      const loginLegacy = await srv.authService.login('LegacyVeteran', 'LegacyPass123!');
      expect(loginLegacy.profile.username).toBe('LegacyVeteran');

      // Épuisement du quota de tentatives incorrectes
      for (let i = 0; i < MAX_PASSWORD_VERIFY_ATTEMPTS; i += 1) {
        const failRes = await fetch(`${baseUrl}/api/auth/verify-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${loginLegacy.token}`,
          },
          body: JSON.stringify({ currentPassword: `Wrong-${i}` }),
        });
        expect(failRes.status).toBe(403);
      }

      // Tentative suivante bloquée en 429 même avec un essai
      const lockedRes = await fetch(`${baseUrl}/api/auth/verify-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loginLegacy.token}`,
        },
        body: JSON.stringify({ currentPassword: 'LegacyPass123!' }),
      });
      expect(lockedRes.status).toBe(429);
    } finally {
      await srv.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
