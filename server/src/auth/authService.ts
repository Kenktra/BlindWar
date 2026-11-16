import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  type BlindWarDatabase,
  type PublicUserProfile,
  type StoredUserRecord,
  toPublicProfile,
} from '../database/db.js';
import {
  atomicWriteTextFileSync,
  resolveDataFilePath,
} from '../database/dataPaths.js';

/** Durée de validité d'une session : 7 jours. */
export const SESSION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let cachedSecret: string | null = null;

/**
 * Clé de signature des sessions :
 * 1. Variable d'environnement `BLIND_WAR_AUTH_SECRET` si définie (recommandé en production).
 * 2. Sinon, clé aléatoire générée une seule fois et conservée dans `data/auth-secret.key`
 *    (jamais écrite dans le code source, survit aux redémarrages).
 */
function getTokenSecret(): string {
  if (cachedSecret) {
    return cachedSecret;
  }
  const fromEnv = process.env.BLIND_WAR_AUTH_SECRET;
  if (fromEnv && fromEnv.length >= 16) {
    cachedSecret = fromEnv;
    return cachedSecret;
  }
  const secretPath = resolveDataFilePath('auth-secret.key');
  try {
    if (fs.existsSync(secretPath)) {
      const stored = fs.readFileSync(secretPath, 'utf-8').trim();
      if (stored.length >= 32) {
        cachedSecret = stored;
        return cachedSecret;
      }
    }
    const generated = crypto.randomBytes(48).toString('hex');
    atomicWriteTextFileSync(secretPath, generated, {
      createBackup: false,
      validateJsonBackup: false,
      mode: 0o600,
    });
    cachedSecret = generated;
  } catch {
    // Disque non accessible : clé aléatoire en mémoire (les sessions expirent au redémarrage)
    cachedSecret = crypto.randomBytes(48).toString('hex');
  }
  return cachedSecret;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) {
    return false;
  }
  const [salt, expectedHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(derived, expectedBuf);
}

export interface SessionTokenPayload {
  readonly userId: string;
  readonly username: string;
  readonly issuedAt: number;
  readonly sessionVersion?: number;
}

export function signSessionToken(payload: SessionTokenPayload): string {
  const data = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', getTokenSecret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifySessionToken(
  token: string,
  nowMs: number = Date.now(),
): SessionTokenPayload | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return null;
  }
  const [data, sig] = token.split('.');
  if (!data || !sig) {
    return null;
  }
  const expectedSig = crypto.createHmac('sha256', getTokenSecret()).update(data).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(data, 'base64url').toString('utf-8'),
    ) as SessionTokenPayload;
    if (!parsed.userId || !parsed.username || typeof parsed.issuedAt !== 'number') {
      return null;
    }
    // Expiration de session (7 jours) et rejet des jetons datés du futur
    if (nowMs - parsed.issuedAt > SESSION_TOKEN_TTL_MS || parsed.issuedAt - nowMs > 60_000) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export class AuthService {
  constructor(private readonly db: BlindWarDatabase) {}

  async register(
    username: string,
    password: string,
    avatarBadge: string = '♔',
  ): Promise<{ readonly token: string; readonly profile: PublicUserProfile }> {
    const cleanUsername = username.trim().replace(/\s+/g, ' ');
    if (cleanUsername.length < 3 || cleanUsername.length > 24) {
      throw new Error(`Le nom d'utilisateur doit contenir entre 3 et 24 caractères.`);
    }
    if (/\(invit[eé]\)/i.test(cleanUsername)) {
      throw new Error(`Ce nom d'utilisateur contient une mention réservée.`);
    }
    if (password.length < 6) {
      throw new Error(`Le mot de passe doit contenir au moins 6 caractères.`);
    }

    const existing = await this.db.findUserByUsername(cleanUsername);
    if (existing) {
      throw new Error(`Ce nom d'utilisateur est déjà pris. Impossible d'avoir deux comptes avec le même nom.`);
    }

    const user = await this.db.createUser({
      id: crypto.randomUUID(),
      username: cleanUsername,
      passwordHash: hashPassword(password),
      avatarBadge,
    });

    const profile = toPublicProfile(user);
    const token = signSessionToken({
      userId: user.id,
      username: user.username,
      issuedAt: Date.now(),
      sessionVersion: user.sessionVersion ?? 1,
    });

    return { token, profile };
  }

  async login(
    username: string,
    password: string,
  ): Promise<{ readonly token: string; readonly profile: PublicUserProfile }> {
    const user = await this.db.findUserByUsername(username);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new Error(`Identifiants invalides.`);
    }
    if (user.accountStatus === 'suspended') {
      const reasonSuffix = user.suspendedReason ? ` Motif : ${user.suspendedReason}` : '';
      throw new Error(`Ce compte est suspendu.${reasonSuffix}`);
    }

    const profile = toPublicProfile(user);
    const token = signSessionToken({
      userId: user.id,
      username: user.username,
      issuedAt: Date.now(),
      sessionVersion: user.sessionVersion ?? 1,
    });

    return { token, profile };
  }
}

export async function authenticateSession(
  db: BlindWarDatabase,
  token: string | null,
): Promise<{ readonly session: SessionTokenPayload; readonly user: StoredUserRecord } | null> {
  if (!token) return null;
  const session = verifySessionToken(token);
  if (!session) return null;
  const user = await db.findUserById(session.userId);
  if (!user) return null;
  const tokenVer = session.sessionVersion ?? 1;
  const currentVer = user.sessionVersion ?? 1;
  if (tokenVer !== currentVer) {
    return null;
  }
  return { session, user };
}
