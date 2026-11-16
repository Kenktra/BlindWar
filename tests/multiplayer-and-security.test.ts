import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  INITIAL_ELO_RATING,
  OFFICIAL_RECONNECT_GRACE_MS,
  autoCompletePlacement,
} from '../shared/src/index.js';
import {
  AuthService,
  SESSION_TOKEN_TTL_MS,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from '../server/src/auth/authService.js';
import { BlindWarDatabase } from '../server/src/database/db.js';
import { GameRoomManager } from '../server/src/rooms/roomManager.js';

describe('6. Multijoueur, Comptes, Matchmaking, Reconnexion 60s et Sécurité Anti-Fuite (§12–19)', () => {
  let tempDbPath: string;
  let db: BlindWarDatabase;
  let auth: AuthService;
  let rooms: GameRoomManager;

  beforeEach(() => {
    tempDbPath = path.join(os.tmpdir(), `blind-war-test-${Date.now()}-${Math.random()}.json`);
    db = new BlindWarDatabase({ diskFilePath: tempDbPath });
    auth = new AuthService(db);
    rooms = new GameRoomManager(db);
  });

  afterEach(() => {
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });

  it('registers users at 200 ELO with scrypt password hashing, logs in, and persists profile updates (§13, §17)', async () => {
    const reg1 = await auth.register('GeneralRouge', 'SecretPass123!', '♔');
    expect(reg1.profile.username).toBe('GeneralRouge');
    expect(reg1.profile.eloRating).toBe(INITIAL_ELO_RATING);
    expect(reg1.profile.eloRating).toBe(200);

    const stored = await db.findUserByUsername('generalrouge');
    expect(stored).not.toBeNull();
    expect(stored!.passwordHash).not.toContain('SecretPass123!');
    expect(verifyPassword('SecretPass123!', stored!.passwordHash)).toBe(true);

    const loginRes = await auth.login('GeneralRouge', 'SecretPass123!');
    expect(loginRes.profile.id).toBe(reg1.profile.id);

    const updated = await db.updateUserProfile(reg1.profile.id, {
      avatarBadge: '♕',
      bio: 'Stratège de Blind War',
    });
    expect(updated.avatarBadge).toBe('♕');
    expect(updated.bio).toBe('Stratège de Blind War');

    // Impossible d'avoir 2 comptes avec le même nom (insensible à la casse et aux espaces)
    await expect(auth.register('GeneralRouge', 'AnotherPass123!')).rejects.toThrow(/déjà pris/);
    await expect(auth.register('generalrouge', 'AnotherPass123!')).rejects.toThrow(/déjà pris/);
    await expect(auth.register('  GENERALROUGE  ', 'AnotherPass123!')).rejects.toThrow(/déjà pris/);
    await expect(
      db.createUser({
        id: 'dup-id',
        username: 'generalrouge',
        passwordHash: 'hash',
      }),
    ).rejects.toThrow(/déjà utilisé/);
  });

  it('pairs players in Ranked Matchmaking, enforces zero identity leakage in network views, and updates ELO on completion (§4.5, §12.3, §13, §19)', async () => {
    const u1 = await auth.register('CommandantAlpha', 'AlphaPass123');
    const u2 = await auth.register('CommandantBravo', 'BravoPass123');

    const firstQueue = rooms.enqueueMatchmaking({
      userId: u1.profile.id,
      username: u1.profile.username,
      eloRating: u1.profile.eloRating,
      socketId: 'sock-1',
      mode: 'matchmaking_ranked',
      joinedAtMs: 1000,
    });
    expect(firstQueue).toBeNull();

    const matchedRoom = rooms.enqueueMatchmaking({
      userId: u2.profile.id,
      username: u2.profile.username,
      eloRating: u2.profile.eloRating,
      socketId: 'sock-2',
      mode: 'matchmaking_ranked',
      joinedAtMs: 1100,
    });
    expect(matchedRoom).not.toBeNull();
    expect(matchedRoom!.matchState?.phase).toBe('placement');

    // Both players submit their 27-piece placements
    await rooms.applyPlacement(
      matchedRoom!.roomId,
      u1.profile.id,
      autoCompletePlacement('red', [], () => 0.2),
      2000,
    );
    await rooms.applyPlacement(
      matchedRoom!.roomId,
      u2.profile.id,
      autoCompletePlacement('black', [], () => 0.7),
      2100,
    );

    expect(matchedRoom!.matchState?.phase).toBe('playing');

    // SECURITY AUDIT: Verify Red's projected network payload contains 0 leaked Black identities
    const redNetworkPayload = rooms.getProjectedViewForUser(matchedRoom!, u1.profile.id)!;
    const blackPiecesInRedPayload = redNetworkPayload.pieces.filter((p) => p.owner === 'black');
    expect(blackPiecesInRedPayload).toHaveLength(27);
    for (const enemyPiece of blackPiecesInRedPayload) {
      expect(enemyPiece.character).toBeNull();
      expect(enemyPiece.revealKind).toBe('none');
      expect(enemyPiece.isProtectedVisible).toBe(false);
      expect(enemyPiece.hasKamikazeVisible).toBe(false);
      expect(enemyPiece.hasCounterEspionageVisible).toBe(false);
    }

    // Black resigns -> Red wins ranked match -> ELO ratings and history are updated
    await rooms.applyResign(matchedRoom!.roomId, u2.profile.id, 5000);
    const leaderboard = await db.getLeaderboard();
    const alphaAfter = leaderboard.find((p) => p.id === u1.profile.id)!;
    const bravoAfter = leaderboard.find((p) => p.id === u2.profile.id)!;
    expect(alphaAfter.eloRating).toBeGreaterThan(200);
    expect(bravoAfter.eloRating).toBeLessThan(200);
    expect(alphaAfter.wins).toBe(1);
    expect(bravoAfter.losses).toBe(1);
  });

  it('handles custom private rooms with room codes, rule customization, reconnection within 60s, and forfeit after 60s (§12.2, §12.4, §21.30)', async () => {
    const host = await auth.register('HostPlayer', 'HostPass123');
    const guest = await auth.register('GuestPlayer', 'GuestPass123');

    const customRoom = rooms.createCustomRoom(
      {
        userId: host.profile.id,
        username: host.profile.username,
        eloRating: host.profile.eloRating,
        socketId: 'sock-host',
      },
      {
        prepDurationSeconds: 60,
        clockDurationSeconds: 300,
      },
    );

    expect(customRoom.roomCode).toMatch(/^BW-[A-Z0-9]{4}$/);
    expect(customRoom.ruleset.prepDurationSeconds).toBe(60);
    expect(customRoom.ruleset.clockDurationSeconds).toBe(300);

    const joined = rooms.joinCustomRoomByCode(customRoom.roomCode, {
      userId: guest.profile.id,
      username: guest.profile.username,
      eloRating: guest.profile.eloRating,
      socketId: 'sock-guest',
    });
    expect(joined.roomId).toBe(customRoom.roomId);

    rooms.startMatchInRoom(customRoom.roomId, 10_000);

    // Guest disconnects at t=15_000 and reconnects at t=40_000 (< 60s) -> match continues!
    rooms.handleDisconnect(guest.profile.id, 15_000);
    await rooms.tickAllActiveRooms(40_000);
    expect(customRoom.matchState?.phase).toBe('placement');

    const reconnected = rooms.handleReconnect(guest.profile.id, 'sock-guest-2');
    expect(reconnected?.room.roomId).toBe(customRoom.roomId);

    // Guest disconnects again at t=50_000 and does NOT return after 60s -> forfeit at t=110_001!
    rooms.handleDisconnect(guest.profile.id, 50_000);
    await rooms.tickAllActiveRooms(50_000 + OFFICIAL_RECONNECT_GRACE_MS + 1);
    expect(customRoom.matchState?.phase).toBe('finished');
    expect(customRoom.matchState?.winner).toBe('red');
    expect(customRoom.matchState?.outcomeReason).toBe('disconnect_forfeit');
  });

  it('enforces progressive ELO window, P2P decentralized account/matchmaking sync, host-only room start, token expiration, and room snapshot recovery', async () => {
    // 1. Decentralized P2P database sync between PC 1 and PC 2
    const friendDbPath = path.join(os.tmpdir(), `blind-war-friend-${Date.now()}-${Math.random()}.json`);
    const friendDb = new BlindWarDatabase({ diskFilePath: friendDbPath });
    const friendAuth = new AuthService(friendDb);
    const friendAccount = await friendAuth.register('AmiDistant', 'PassAmi123!', '♕');

    // Merge friend's P2P snapshot into local db -> local leaderboard now includes AmiDistant!
    const changed = db.mergeRemoteSnapshot(friendDb.exportSyncSnapshot());
    expect(changed).toBe(true);
    const localLookup = await db.findUserByUsername('AmiDistant');
    expect(localLookup?.id).toBe(friendAccount.profile.id);
    if (fs.existsSync(friendDbPath)) {
      fs.unlinkSync(friendDbPath);
    }

    // 2. Decentralized P2P matchmaking pairing between local PC and remote friend PC
    rooms.enqueueMatchmaking({
      userId: 'local-player-1',
      username: 'JoueurLocal',
      eloRating: 200,
      socketId: 'sock-local-1',
      mode: 'matchmaking_ranked',
      joinedAtMs: 500,
    });
    const p2pRoom = rooms.pairLocalWithRemoteCandidate('local-player-1', {
      userId: friendAccount.profile.id,
      username: friendAccount.profile.username,
      eloRating: 200,
      socketId: `p2p:node-friend:${friendAccount.profile.id}`,
      mode: 'matchmaking_ranked',
      joinedAtMs: 800,
    });
    expect(p2pRoom).not.toBeNull();
    expect(p2pRoom?.players.red?.userId).toBe('local-player-1');
    expect(p2pRoom?.players.black?.socketId).toBe(`p2p:node-friend:${friendAccount.profile.id}`);

    // 3. Ranked ELO window: 200 ELO vs 450 ELO (diff 250 > initial ±100 window) waits until 30s (+150 -> ±250 window)
    rooms.enqueueMatchmaking({
      userId: 'user-low',
      username: 'LowElo',
      eloRating: 200,
      socketId: 's1',
      mode: 'matchmaking_ranked',
      joinedAtMs: 0,
      isGuest: false,
    });
    const immediateMatch = rooms.enqueueMatchmaking({
      userId: 'user-high',
      username: 'HighElo',
      eloRating: 450,
      socketId: 's2',
      mode: 'matchmaking_ranked',
      joinedAtMs: 1000,
      isGuest: false,
    });
    expect(immediateMatch).toBeNull();

    // At t = 10_000ms, window is 150 (< 250) -> still waiting
    expect(rooms.tryMatchQueues(10_000)).toHaveLength(0);

    // At t = 30_000ms, window is 100 + 3*50 = 250 -> paired!
    const delayedMatches = rooms.tryMatchQueues(30_000);
    expect(delayedMatches).toHaveLength(1);
    expect(delayedMatches[0].players.red?.userId).toBe('user-low');
    expect(delayedMatches[0].players.black?.userId).toBe('user-high');

    // 3. Session token TTL expiration
    const token = signSessionToken({ userId: 'u1', username: 'Test', issuedAt: 1_000 });
    expect(verifySessionToken(token, 2_000)?.userId).toBe('u1');
    expect(verifySessionToken(token, 1_000 + SESSION_TOKEN_TTL_MS + 1)).toBeNull();

    // 4. Host-only start & disk snapshot persistence across server restart
    const snapPath = `${tempDbPath}.rooms.json`;
    const manager1 = new GameRoomManager(db, { snapshotFilePath: snapPath });
    const room = manager1.createCustomRoom({
      userId: 'host-1',
      username: 'Host1',
      eloRating: 200,
      socketId: 'sh',
    });
    manager1.joinCustomRoomByCode(room.roomCode, {
      userId: 'guest-1',
      username: 'Guest1',
      eloRating: 200,
      socketId: 'sg',
    });
    expect(() => manager1.requestStartByUser(room.roomId, 'guest-1')).toThrow(/Seul l'hôte/);
    manager1.requestStartByUser(room.roomId, 'host-1', 5_000);
    manager1.dispose();

    // Simulate server restart: manager2 restores the active match from disk
    const manager2 = new GameRoomManager(db, { snapshotFilePath: snapPath });
    const restored = manager2.getRoom(room.roomId);
    expect(restored).not.toBeNull();
    expect(restored?.matchState?.phase).toBe('placement');
    manager2.dispose();
    if (fs.existsSync(snapPath)) {
      fs.unlinkSync(snapPath);
    }
  });

  it('synchronizes placement confirmation status across players, locks confirmed armies, and preserves status across reconnection', async () => {
    const p1 = await auth.register('SyncRedPlayer', 'PassRed123!');
    const p2 = await auth.register('SyncBlackPlayer', 'PassBlack123!');

    const syncRoom = rooms.createCustomRoom({
      userId: p1.profile.id,
      username: p1.profile.username,
      eloRating: p1.profile.eloRating,
      socketId: 'sock-p1',
    });
    rooms.joinCustomRoomByCode(syncRoom.roomCode, {
      userId: p2.profile.id,
      username: p2.profile.username,
      eloRating: p2.profile.eloRating,
      socketId: 'sock-p2',
    });
    rooms.startMatchInRoom(syncRoom.roomId, 1_000);

    // 1. Initially both players show unconfirmed status
    const redBefore = rooms.getProjectedViewForUser(syncRoom, p1.profile.id)!;
    expect(redBefore.placementStatus.ownConfirmed).toBe(false);
    expect(redBefore.placementStatus.opponentConfirmed).toBe(false);

    // 2. Red confirms placement -> synced to both, locked against re-submission
    await rooms.applyPlacement(
      syncRoom.roomId,
      p1.profile.id,
      autoCompletePlacement('red', [], () => 0.1),
      2_000,
    );
    expect(syncRoom.matchState?.phase).toBe('placement');

    const redAfter = rooms.getProjectedViewForUser(syncRoom, p1.profile.id)!;
    const blackWhileRedWaits = rooms.getProjectedViewForUser(syncRoom, p2.profile.id)!;
    expect(redAfter.placementStatus).toEqual({
      redConfirmed: true,
      blackConfirmed: false,
      ownConfirmed: true,
      opponentConfirmed: false,
    });
    expect(redAfter.ownConfirmedPlacement).toHaveLength(27);

    expect(blackWhileRedWaits.placementStatus).toEqual({
      redConfirmed: true,
      blackConfirmed: false,
      ownConfirmed: false,
      opponentConfirmed: true,
    });
    expect(blackWhileRedWaits.ownConfirmedPlacement).toHaveLength(0);

    // Re-submitting Red placement must be rejected
    await expect(
      rooms.applyPlacement(
        syncRoom.roomId,
        p1.profile.id,
        autoCompletePlacement('red', [], () => 0.9),
        2_500,
      ),
    ).rejects.toThrow(/déjà été validé/);

    // 3. Red disconnects & reconnects while Black is still placing -> confirmation + locked 27 pieces persist!
    rooms.handleDisconnect(p1.profile.id, 3_000);
    const reconn = rooms.handleReconnect(p1.profile.id, 'sock-p1-reconn');
    expect(reconn).not.toBeNull();
    const redReconnectedView = rooms.getProjectedViewForUser(reconn!.room, p1.profile.id)!;
    expect(redReconnectedView.placementStatus.ownConfirmed).toBe(true);
    expect(redReconnectedView.ownConfirmedPlacement).toHaveLength(27);
    expect(redReconnectedView.phase).toBe('placement');

    // 4. Black confirms placement -> both confirmed, match starts!
    await rooms.applyPlacement(
      syncRoom.roomId,
      p2.profile.id,
      autoCompletePlacement('black', [], () => 0.8),
      4_000,
    );
    expect(syncRoom.matchState?.phase).toBe('playing');
    expect(
      rooms.getProjectedViewForUser(syncRoom, p1.profile.id)!.placementStatus.opponentConfirmed,
    ).toBe(true);
  });

  it('blocks unauthenticated or guest players from entering ranked matchmaking while allowing unranked/quick modes', async () => {
    // Guest flagged as isGuest: true cannot enter matchmaking_ranked
    expect(() =>
      rooms.enqueueMatchmaking({
        userId: 'anon-1',
        username: 'Invité1',
        eloRating: 200,
        socketId: 'sock-g1',
        mode: 'matchmaking_ranked',
        joinedAtMs: 1_000,
        isGuest: true,
      }),
    ).toThrow(/Compte requis/);

    // Guest-prefixed ID without isGuest flag is also blocked from matchmaking_ranked
    expect(() =>
      rooms.enqueueMatchmaking({
        userId: 'guest-abc123',
        username: 'Invité2 (invité)',
        eloRating: 200,
        socketId: 'sock-g2',
        mode: 'matchmaking_ranked',
        joinedAtMs: 1_100,
      }),
    ).toThrow(/Compte requis/);

    // Guests are still allowed to enter unranked and quick matchmaking
    expect(
      rooms.enqueueMatchmaking({
        userId: 'guest-abc123',
        username: 'Invité2 (invité)',
        eloRating: 200,
        socketId: 'sock-g2',
        mode: 'matchmaking_unranked',
        joinedAtMs: 1_200,
        isGuest: true,
      }),
    ).toBeNull();

    // Authenticated registered player CAN enter matchmaking_ranked
    const registered = await auth.register('RankedPlayerOne', 'StrongPass123!');
    expect(
      rooms.enqueueMatchmaking({
        userId: registered.profile.id,
        username: registered.profile.username,
        eloRating: registered.profile.eloRating,
        socketId: 'sock-reg1',
        mode: 'matchmaking_ranked',
        joinedAtMs: 1_500,
        isGuest: false,
      }),
    ).toBeNull();

    // Remote guest P2P candidate cannot be paired into a ranked match with a registered player
    const blockedPair = rooms.pairLocalWithRemoteCandidate(registered.profile.id, {
      userId: 'guest-remote-1',
      username: 'RemoteGuest (invité)',
      eloRating: 200,
      socketId: 'p2p:remote-node:guest-remote-1',
      mode: 'matchmaking_ranked',
      joinedAtMs: 1_600,
      isGuest: true,
    });
    expect(blockedPair).toBeNull();
  });
});
