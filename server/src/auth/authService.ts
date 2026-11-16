import crypto from 'node:crypto';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
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
export const BCRYPT_ROUNDS = 10;
export const MAX_PASSWORD_VERIFY_ATTEMPTS = 5;
export const PASSWORD_VERIFY_WINDOW_MS = 15 * 60 * 1000;

export class PasswordRateLimitError extends Error {
  readonly statusCode = 429;
  constructor(message: string) {
    super(message);
    this.name = 'PasswordRateLimitError';
  }
}

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
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || typeof storedHash !== 'string') {
    return false;
  }
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    return bcrypt.compareSync(password, storedHash);
  }
  // Rétrocompatibilité avec les comptes historiques hachés en scrypt (`salt:derivedHex`)
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
  private readonly passwordAttempts = new Map<
    string,
    { failedCount: number; resetAtMs: number }
  >();

  constructor(private readonly db: BlindWarDatabase) {}

  private assertPasswordAttemptAllowed(userId: string, nowMs: number = Date.now()): void {
    const entry = this.passwordAttempts.get(userId);
    if (!entry) return;
    if (nowMs >= entry.resetAtMs) {
      this.passwordAttempts.delete(userId);
      return;
    }
    if (entry.failedCount >= MAX_PASSWORD_VERIFY_ATTEMPTS) {
      throw new PasswordRateLimitError(
        'Trop de tentatives incorrectes. Veuillez patienter avant de réessayer.',
      );
    }
  }

  private recordFailedPasswordAttempt(userId: string, nowMs: number = Date.now()): void {
    const entry = this.passwordAttempts.get(userId);
    if (!entry || nowMs >= entry.resetAtMs) {
      this.passwordAttempts.set(userId, {
        failedCount: 1,
        resetAtMs: nowMs + PASSWORD_VERIFY_WINDOW_MS,
      });
      return;
    }
    entry.failedCount += 1;
  }

  private clearPasswordAttempts(userId: string): void {
    this.passwordAttempts.delete(userId);
  }

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

  /** Vérifie l'ancien mot de passe côté serveur avec limitation contre le force-brute. */
  async verifyCurrentPassword(userId: string, currentPassword: string): Promise<boolean> {
    this.assertPasswordAttemptAllowed(userId);
    const user = await this.db.findUserById(userId);
    if (!user || user.accountStatus === 'suspended') {
      throw new Error('Compte introuvable ou suspendu.');
    }
    if (!currentPassword || !verifyPassword(currentPassword, user.passwordHash)) {
      this.recordFailedPasswordAttempt(userId);
      throw new Error('Ancien mot de passe incorrect.');
    }
    this.clearPasswordAttempts(userId);
    return true;
  }

  /**
   * Modifie le mot de passe d'un utilisateur après confirmation de l'ancien mot de passe,
   * hache avec bcrypt, invalide les anciennes sessions (`sessionVersion++`) et renvoie un nouveau jeton.
   */
  async changePassword(params: {
    readonly userId: string;
    readonly currentPassword: string;
    readonly newPassword: string;
    readonly confirmPassword: string;
  }): Promise<{ readonly token: string; readonly profile: PublicUserProfile }> {
    this.assertPasswordAttemptAllowed(params.userId);
    const user = await this.db.findUserById(params.userId);
    if (!user || user.accountStatus === 'suspended') {
      throw new Error('Compte introuvable ou suspendu.');
    }
    if (!params.currentPassword || !verifyPassword(params.currentPassword, user.passwordHash)) {
      this.recordFailedPasswordAttempt(params.userId);
      throw new Error('Ancien mot de passe incorrect.');
    }
    if (!params.newPassword || params.newPassword.length < 6 || params.newPassword.length > 128) {
      throw new Error('Le nouveau mot de passe doit contenir entre 6 et 128 caractères.');
    }
    if (params.newPassword !== params.confirmPassword) {
      throw new Error('La confirmation du nouveau mot de passe ne correspond pas.');
    }
    if (params.newPassword === params.currentPassword) {
      throw new Error('Le nouveau mot de passe doit être différent de l’ancien.');
    }

    this.clearPasswordAttempts(params.userId);
    const nextHash = hashPassword(params.newPassword);
    const updatedUser = await this.db.updateUserPasswordHash(params.userId, nextHash);
    const profile = toPublicProfile(updatedUser);
    const token = signSessionToken({
      userId: updatedUser.id,
      username: updatedUser.username,
      issuedAt: Date.now(),
      sessionVersion: updatedUser.sessionVersion ?? 1,
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
