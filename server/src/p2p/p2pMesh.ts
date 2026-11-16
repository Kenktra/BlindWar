import crypto from 'node:crypto';
import dgram from 'node:dgram';
import tls from 'node:tls';
import type {
  CardPlayPayload,
  CharacterType,
  ClientMatchView,
  Coord,
  MoveCandidateKind,
  PlacementEntry,
} from '../../../shared/src/index.js';
import type { BlindWarDatabase } from '../database/db.js';
import {
  type GameRoomManager,
  type ManagedRoom,
  type QueueCandidate,
  type RoomLobbySnapshot,
  computeRankedEloWindow,
} from '../rooms/roomManager.js';

const MESH_TOPIC = 'blind-war/v1/global-mesh';
const UDP_DISCOVERY_PORT = 43001;
const PUBLIC_TLS_BROKERS: readonly { host: string; port: number }[] = [
  { host: 'broker.emqx.io', port: 8883 },
  { host: 'broker.hivemq.com', port: 8883 },
];

export type P2PGameActionPayload =
  | { kind: 'place'; entries: readonly PlacementEntry[] }
  | { kind: 'move'; pieceId: string; destination: Coord; preferredKind?: MoveCandidateKind }
  | { kind: 'mark_traqueur'; traqueurPieceId: string; targetEnemyPieceId: string }
  | { kind: 'stop_jump' }
  | { kind: 'skip_rage' }
  | { kind: 'promote'; chosenCharacter: CharacterType }
  | { kind: 'play_card'; cardPayload: CardPlayPayload }
  | { kind: 'draw_offer' }
  | { kind: 'resign' }
  | { kind: 'leave_room' };

type MeshPacket =
  | {
      readonly type: 'db_sync';
      readonly msgId: string;
      readonly senderNodeId: string;
      readonly snapshot: ReturnType<BlindWarDatabase['exportSyncSnapshot']>;
    }
  | {
      readonly type: 'sync_request';
      readonly msgId: string;
      readonly senderNodeId: string;
    }
  | {
      readonly type: 'queue_heartbeat';
      readonly msgId: string;
      readonly senderNodeId: string;
      readonly candidates: readonly {
        readonly userId: string;
        readonly username: string;
        readonly eloRating: number;
        readonly mode: QueueCandidate['mode'];
        readonly joinedAtMs: number;
      }[];
      readonly customRoomCodes: readonly string[];
    }
  | {
      readonly type: 'p2p_state_push';
      readonly msgId: string;
      readonly senderNodeId: string;
      readonly targetNodeId: string;
      readonly targetUserId: string;
      readonly roomId: string;
      readonly lobby: RoomLobbySnapshot;
      readonly view: ClientMatchView | null;
    }
  | {
      readonly type: 'p2p_custom_join';
      readonly msgId: string;
      readonly senderNodeId: string;
      readonly targetNodeId: string;
      readonly roomCode: string;
      readonly guest: {
        readonly userId: string;
        readonly username: string;
        readonly eloRating: number;
      };
    }
  | {
      readonly type: 'p2p_game_action';
      readonly msgId: string;
      readonly senderNodeId: string;
      readonly targetNodeId: string;
      readonly roomId: string;
      readonly actorUserId: string;
      readonly action: P2PGameActionPayload;
    };

/** Encode MQTT remaining length (1 to 4 bytes). */
function encodeMqttLength(len: number): Buffer {
  const bytes: number[] = [];
  let x = len;
  do {
    let encodedByte = x % 128;
    x = Math.floor(x / 128);
    if (x > 0) {
      encodedByte |= 128;
    }
    bytes.push(encodedByte);
  } while (x > 0);
  return Buffer.from(bytes);
}

/** Build an MQTT 3.1.1 PUBLISH (QoS 0) packet. */
function buildMqttPublishPacket(topic: string, payloadStr: string): Buffer {
  const topicBuf = Buffer.from(topic, 'utf-8');
  const topicHeader = Buffer.alloc(2);
  topicHeader.writeUInt16BE(topicBuf.length, 0);
  const payloadBuf = Buffer.from(payloadStr, 'utf-8');
  const remLen = topicHeader.length + topicBuf.length + payloadBuf.length;
  return Buffer.concat([Buffer.from([0x30]), encodeMqttLength(remLen), topicHeader, topicBuf, payloadBuf]);
}

/** Build an MQTT 3.1.1 SUBSCRIBE packet. */
function buildMqttSubscribePacket(packetId: number, topic: string): Buffer {
  const topicBuf = Buffer.from(topic, 'utf-8');
  const vh = Buffer.alloc(2);
  vh.writeUInt16BE(packetId, 0);
  const tl = Buffer.alloc(2);
  tl.writeUInt16BE(topicBuf.length, 0);
  const body = Buffer.concat([vh, tl, topicBuf, Buffer.from([0x00])]);
  return Buffer.concat([Buffer.from([0x82]), encodeMqttLength(body.length), body]);
}

export interface P2PMeshStatus {
  readonly nodeId: string;
  readonly connectedRelays: number;
  readonly knownPeersCount: number;
  readonly remotePlayersInQueue: number;
}

/**
 * Réseau Décentralisé P2P (BLIND WAR Mesh) :
 * Relie automatiquement plusieurs instances `localhost:3001` (votre PC et celui d'un ami)
 * sans serveur central dédié ni ouverture de port routeur :
 * 1. Synchronise les comptes inscrits, le classement ELO et l'historique des parties.
 * 2. Apparie les joueurs en Matchmaking (Classé, Non Classé, Partie Rapide) entre deux PC distants.
 * 3. Permet de rejoindre une Salle Personnalisée (`BW-XXXX`) créée sur le PC d'un ami.
 */
export class BlindWarP2PMesh {
  readonly nodeId: string = `node-${crypto.randomUUID().slice(0, 8)}`;
  private readonly seenMsgIds = new Set<string>();
  private readonly relaySockets = new Map<string, tls.TLSSocket>();
  private udpSocket: dgram.Socket | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private disposed = false;

  /** Peers seen in the last 20 seconds: nodeId -> lastSeenMs */
  private readonly activePeers = new Map<string, { lastSeenMs: number; queuedCount: number }>();
  /** Custom room codes advertised by remote peers: roomCode -> hostNodeId */
  private readonly remoteRoomNodeByCode = new Map<string, string>();
  /** Remote rooms where a local user is playing as guest: localUserId -> { hostNodeId, roomId } */
  private readonly remoteSessionByLocalUser = new Map<
    string,
    { hostNodeId: string; roomId: string }
  >();

  constructor(
    private readonly db: BlindWarDatabase,
    private readonly roomManager: GameRoomManager,
    private readonly callbacks: {
      /** Deliver a remote P2P room state directly to a local user's browser socket(s). */
      readonly deliverRemoteStateToLocalUser: (
        localUserId: string,
        lobby: RoomLobbySnapshot,
        view: ClientMatchView | null,
      ) => void;
      /** Trigger a sync of a locally hosted room to all its participants (local + P2P). */
      readonly onLocalRoomUpdated: (room: ManagedRoom) => void;
    },
    private readonly options?: { enabled?: boolean },
  ) {
    if (this.options?.enabled !== false) {
      this.start();
    }
  }

  getStatus(nowMs: number = Date.now()): P2PMeshStatus {
    let knownPeersCount = 0;
    let remotePlayersInQueue = 0;
    for (const [peerId, info] of this.activePeers.entries()) {
      if (nowMs - info.lastSeenMs <= 20_000) {
        knownPeersCount += 1;
        remotePlayersInQueue += info.queuedCount;
      } else {
        this.activePeers.delete(peerId);
      }
    }
    return {
      nodeId: this.nodeId,
      connectedRelays: this.relaySockets.size,
      knownPeersCount,
      remotePlayersInQueue,
    };
  }

  /** Check if `localUserId` is currently playing in a room hosted on a remote peer node. */
  getRemoteSessionForUser(localUserId: string): { hostNodeId: string; roomId: string } | null {
    return this.remoteSessionByLocalUser.get(localUserId) ?? null;
  }

  /** Clear remote session tracking for `localUserId` (e.g., when leaving room). */
  clearRemoteSessionForUser(localUserId: string): void {
    this.remoteSessionByLocalUser.delete(localUserId);
  }

  /** Broadcast local DB accounts, ELOs, and matches to all connected P2P nodes. */
  broadcastDatabaseSync(): void {
    this.publish({
      type: 'db_sync',
      msgId: crypto.randomUUID(),
      senderNodeId: this.nodeId,
      snapshot: this.db.exportSyncSnapshot(),
    });
  }

  /**
   * If a participant in a locally-hosted room is a remote P2P player (`socketId` starts with `p2p:`),
   * push their strictly projected view over the mesh.
   */
  pushStateToRemoteParticipant(
    p2pSocketId: string,
    roomId: string,
    lobby: RoomLobbySnapshot,
    view: ClientMatchView | null,
  ): void {
    // Format: p2p:<targetNodeId>:<targetUserId>
    const parts = p2pSocketId.split(':');
    if (parts.length < 3 || parts[0] !== 'p2p') return;
    const targetNodeId = parts[1];
    const targetUserId = parts.slice(2).join(':');

    this.publish({
      type: 'p2p_state_push',
      msgId: crypto.randomUUID(),
      senderNodeId: this.nodeId,
      targetNodeId,
      targetUserId,
      roomId,
      lobby,
      view,
    });
  }

  /** Try joining a custom room code hosted on a remote peer node. */
  tryJoinRemoteCustomRoom(
    roomCode: string,
    guest: { userId: string; username: string; eloRating: number },
  ): boolean {
    const normalized = roomCode.trim().toUpperCase();
    const hostNodeId = this.remoteRoomNodeByCode.get(normalized);
    if (!hostNodeId || hostNodeId === this.nodeId) {
      return false;
    }
    this.publish({
      type: 'p2p_custom_join',
      msgId: crypto.randomUUID(),
      senderNodeId: this.nodeId,
      targetNodeId: hostNodeId,
      roomCode: normalized,
      guest,
    });
    return true;
  }

  /** Forward an in-game action from a local browser to the remote Host Node. */
  sendRemoteGameAction(
    localUserId: string,
    action: P2PGameActionPayload,
  ): boolean {
    const session = this.remoteSessionByLocalUser.get(localUserId);
    if (!session) return false;
    this.publish({
      type: 'p2p_game_action',
      msgId: crypto.randomUUID(),
      senderNodeId: this.nodeId,
      targetNodeId: session.hostNodeId,
      roomId: session.roomId,
      actorUserId: localUserId,
      action,
    });
    if (action.kind === 'leave_room') {
      this.remoteSessionByLocalUser.delete(localUserId);
    }
    return true;
  }

  private start(): void {
    for (const broker of PUBLIC_TLS_BROKERS) {
      this.connectTlsBroker(broker.host, broker.port);
    }
    this.startUdpLanDiscovery();

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, 1500);
    this.heartbeatTimer.unref?.();
  }

  dispose(): void {
    this.disposed = true;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    for (const sock of this.relaySockets.values()) {
      sock.destroy();
    }
    this.relaySockets.clear();
    if (this.udpSocket) {
      try {
        this.udpSocket.close();
      } catch {
        // Ignore
      }
      this.udpSocket = null;
    }
  }

  private sendHeartbeat(): void {
    const candidates = this.roomManager.getQueuedCandidates().map((c) => ({
      userId: c.userId,
      username: c.username,
      eloRating: c.eloRating,
      mode: c.mode,
      joinedAtMs: c.joinedAtMs,
    }));

    const customRoomCodes = this.roomManager.getOpenCustomRoomCodes();
    this.publish({
      type: 'queue_heartbeat',
      msgId: crypto.randomUUID(),
      senderNodeId: this.nodeId,
      candidates,
      customRoomCodes,
    });
  }

  private publish(packet: MeshPacket): void {
    if (this.disposed) return;
    this.seenMsgIds.add(packet.msgId);
    if (this.seenMsgIds.size > 2000) {
      const first = this.seenMsgIds.values().next().value;
      if (first) this.seenMsgIds.delete(first);
    }

    const json = JSON.stringify(packet);
    const mqttFrame = buildMqttPublishPacket(MESH_TOPIC, json);
    for (const sock of this.relaySockets.values()) {
      if (!sock.destroyed && sock.writable) {
        sock.write(mqttFrame);
      }
    }

    if (this.udpSocket && Buffer.byteLength(json, 'utf-8') < 60_000) {
      const buf = Buffer.from(json, 'utf-8');
      try {
        this.udpSocket.send(buf, UDP_DISCOVERY_PORT, '255.255.255.255');
      } catch {
        // Ignore UDP broadcast errors on restricted interfaces
      }
    }
  }

  private handleIncomingJson(rawJson: string): void {
    let packet: MeshPacket;
    try {
      packet = JSON.parse(rawJson) as MeshPacket;
    } catch {
      return;
    }
    if (!packet || !packet.msgId || !packet.senderNodeId || packet.senderNodeId === this.nodeId) {
      return;
    }
    if (this.seenMsgIds.has(packet.msgId)) {
      return;
    }
    this.seenMsgIds.add(packet.msgId);

    const nowMs = Date.now();
    const prevPeer = this.activePeers.get(packet.senderNodeId);
    this.activePeers.set(packet.senderNodeId, {
      lastSeenMs: nowMs,
      queuedCount: prevPeer?.queuedCount ?? 0,
    });

    switch (packet.type) {
      case 'sync_request': {
        this.broadcastDatabaseSync();
        break;
      }

      case 'db_sync': {
        this.db.mergeRemoteSnapshot(packet.snapshot);
        break;
      }

      case 'queue_heartbeat': {
        this.activePeers.set(packet.senderNodeId, {
          lastSeenMs: nowMs,
          queuedCount: packet.candidates.length,
        });
        for (const code of packet.customRoomCodes) {
          this.remoteRoomNodeByCode.set(code, packet.senderNodeId);
        }
        this.tryPairWithRemoteCandidates(packet.senderNodeId, packet.candidates, nowMs);
        break;
      }

      case 'p2p_state_push': {
        if (packet.targetNodeId !== this.nodeId) return;
        // If this user was waiting in our local matchmaking queue, remove them now!
        this.roomManager.leaveMatchmaking(packet.targetUserId);
        if (packet.view?.phase === 'finished') {
          this.remoteSessionByLocalUser.delete(packet.targetUserId);
          if (packet.view.winner && packet.view.outcomeReason) {
            void this.db
              .recordCompletedMatch({
                matchId: packet.roomId,
                mode: packet.lobby.mode,
                redUserId: packet.lobby.redPlayer?.userId ?? null,
                blackUserId: packet.lobby.blackPlayer?.userId ?? null,
                redUsername: packet.lobby.redPlayer?.username ?? 'Joueur Rouge',
                blackUsername: packet.lobby.blackPlayer?.username ?? 'Joueur Noir',
                redEloBeforeHint:
                  packet.lobby.eloResult?.redPrevious ?? packet.lobby.redPlayer?.eloRating,
                blackEloBeforeHint:
                  packet.lobby.eloResult?.blackPrevious ?? packet.lobby.blackPlayer?.eloRating,
                winner: packet.view.winner,
                outcomeReason: packet.view.outcomeReason,
                turnsPlayed: packet.view.turn.turnNumber,
                redEliminations: 0,
                blackEliminations: 0,
                ruleset: packet.lobby.ruleset,
                startedAt: new Date().toISOString(),
              })
              .then(() => {
                this.callbacks.deliverRemoteStateToLocalUser(
                  packet.targetUserId,
                  packet.lobby,
                  packet.view,
                );
              });
            break;
          }
        } else {
          this.remoteSessionByLocalUser.set(packet.targetUserId, {
            hostNodeId: packet.senderNodeId,
            roomId: packet.roomId,
          });
        }
        this.callbacks.deliverRemoteStateToLocalUser(
          packet.targetUserId,
          packet.lobby,
          packet.view,
        );
        break;
      }

      case 'p2p_custom_join': {
        if (packet.targetNodeId !== this.nodeId) return;
        try {
          const p2pSocketId = `p2p:${packet.senderNodeId}:${packet.guest.userId}`;
          const room = this.roomManager.joinCustomRoomByCode(packet.roomCode, {
            userId: packet.guest.userId,
            username: packet.guest.username,
            eloRating: packet.guest.eloRating,
            socketId: p2pSocketId,
          });
          this.callbacks.onLocalRoomUpdated(room);
        } catch {
          // Room full or no longer exists
        }
        break;
      }

      case 'p2p_game_action': {
        if (packet.targetNodeId !== this.nodeId) return;
        void this.executeRemoteActionOnHost(packet.roomId, packet.actorUserId, packet.action);
        break;
      }
    }
  }

  private tryPairWithRemoteCandidates(
    remoteNodeId: string,
    remoteCandidates: readonly {
      readonly userId: string;
      readonly username: string;
      readonly eloRating: number;
      readonly mode: QueueCandidate['mode'];
      readonly joinedAtMs: number;
    }[],
    nowMs: number,
  ): void {
    const localCandidates = this.roomManager.getQueuedCandidates();
    if (localCandidates.length === 0 || remoteCandidates.length === 0) {
      return;
    }

    for (const local of localCandidates) {
      for (const remote of remoteCandidates) {
        if (local.mode !== remote.mode || local.userId === remote.userId) {
          continue;
        }
        if (local.mode === 'matchmaking_ranked') {
          if (
            local.isGuest === true ||
            local.userId.startsWith('guest-') ||
            remote.userId.startsWith('guest-')
          ) {
            continue;
          }
          const diff = Math.abs(local.eloRating - remote.eloRating);
          const allowed = Math.max(
            computeRankedEloWindow(local.joinedAtMs, nowMs),
            computeRankedEloWindow(remote.joinedAtMs, nowMs),
          );
          if (diff > allowed) {
            continue;
          }
        }

        // Deterministic Host election: the node with the candidate who joined earlier
        // (or smaller nodeId on tie) hosts the authoritative room.
        const localIsHost =
          local.joinedAtMs < remote.joinedAtMs ||
          (local.joinedAtMs === remote.joinedAtMs && this.nodeId < remoteNodeId);

        if (localIsHost) {
          const room = this.roomManager.pairLocalWithRemoteCandidate(local.userId, {
            userId: remote.userId,
            username: remote.username,
            eloRating: remote.eloRating,
            socketId: `p2p:${remoteNodeId}:${remote.userId}`,
            mode: remote.mode,
            joinedAtMs: remote.joinedAtMs,
          });
          if (room) {
            this.callbacks.onLocalRoomUpdated(room);
            return;
          }
        }
      }
    }
  }

  private async executeRemoteActionOnHost(
    roomId: string,
    actorUserId: string,
    action: P2PGameActionPayload,
  ): Promise<void> {
    try {
      let room: ManagedRoom | null = null;
      switch (action.kind) {
        case 'place':
          room = await this.roomManager.applyPlacement(roomId, actorUserId, action.entries);
          break;
        case 'move':
          room = await this.roomManager.applyMove(
            roomId,
            actorUserId,
            action.pieceId,
            action.destination,
            Date.now(),
            action.preferredKind,
          );
          break;
        case 'mark_traqueur':
          room = await this.roomManager.applyTraqueurMark(
            roomId,
            actorUserId,
            action.traqueurPieceId,
            action.targetEnemyPieceId,
          );
          break;
        case 'stop_jump':
          room = await this.roomManager.applyStopJumpChain(roomId, actorUserId);
          break;
        case 'skip_rage':
          room = await this.roomManager.applySkipRage(roomId, actorUserId);
          break;
        case 'promote':
          room = await this.roomManager.applyPromotion(
            roomId,
            actorUserId,
            action.chosenCharacter,
          );
          break;
        case 'play_card':
          room = await this.roomManager.applyCard(roomId, actorUserId, action.cardPayload);
          break;
        case 'draw_offer':
          room = await this.roomManager.applyMutualDraw(roomId, actorUserId);
          break;
        case 'resign':
          room = await this.roomManager.applyResign(roomId, actorUserId);
          break;
        case 'leave_room': {
          const left = this.roomManager.leaveRoom(actorUserId);
          room = left?.room ?? null;
          break;
        }
      }
      if (room) {
        this.callbacks.onLocalRoomUpdated(room);
        if (room.matchState?.phase === 'finished') {
          this.broadcastDatabaseSync();
        }
      }
    } catch {
      // Invalid action from remote peer ignored by authoritative host
    }
  }

  private connectTlsBroker(host: string, port: number): void {
    if (this.disposed) return;
    const key = `${host}:${port}`;

    const socket = tls.connect({ host, port, rejectUnauthorized: false }, () => {
      if (this.disposed) {
        socket.destroy();
        return;
      }
      const clientId = `bw-${this.nodeId}-${Math.random().toString(16).slice(2, 6)}`;
      const idBuf = Buffer.from(clientId, 'utf-8');
      const vh = Buffer.from([0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, 0x04, 0x02, 0x00, 0x3c]);
      const pl = Buffer.concat([Buffer.from([0x00, idBuf.length]), idBuf]);
      socket.write(Buffer.concat([Buffer.from([0x10]), encodeMqttLength(vh.length + pl.length), vh, pl]));
    });

    socket.unref?.();

    let rxBuffer = Buffer.alloc(0);
    const pingInterval = setInterval(() => {
      if (!socket.destroyed && socket.writable) {
        socket.write(Buffer.from([0xc0, 0x00])); // MQTT PINGREQ
      }
    }, 25_000);
    pingInterval.unref?.();

    socket.on('data', (chunk: Buffer) => {
      rxBuffer = Buffer.concat([rxBuffer, chunk]);
      while (rxBuffer.length >= 2) {
        const packetType = rxBuffer[0] >> 4;
        let multiplier = 1;
        let remLen = 0;
        let offset = 1;
        let encodedByte = 0;
        do {
          if (offset >= rxBuffer.length) return; // Wait for more bytes
          encodedByte = rxBuffer[offset];
          remLen += (encodedByte & 127) * multiplier;
          multiplier *= 128;
          offset += 1;
        } while ((encodedByte & 128) !== 0);

        const totalFrameLen = offset + remLen;
        if (rxBuffer.length < totalFrameLen) {
          return; // Wait for full frame
        }

        const frame = rxBuffer.subarray(0, totalFrameLen);
        rxBuffer = rxBuffer.subarray(totalFrameLen);

        if (packetType === 2) {
          // CONNACK -> subscribe to mesh topic and announce DB sync
          this.relaySockets.set(key, socket);
          socket.write(buildMqttSubscribePacket(1, MESH_TOPIC));
          this.publish({
            type: 'sync_request',
            msgId: crypto.randomUUID(),
            senderNodeId: this.nodeId,
          });
          this.broadcastDatabaseSync();
        } else if (packetType === 3) {
          // PUBLISH -> extract topic and UTF-8 JSON payload
          const topicLen = frame.readUInt16BE(offset);
          const payloadStart = offset + 2 + topicLen;
          const jsonStr = frame.subarray(payloadStart, totalFrameLen).toString('utf-8');
          this.handleIncomingJson(jsonStr);
        }
      }
    });

    const cleanupAndRetry = () => {
      clearInterval(pingInterval);
      this.relaySockets.delete(key);
      if (!this.disposed) {
        const retryTimer = setTimeout(() => this.connectTlsBroker(host, port), 5000);
        retryTimer.unref?.();
      }
    };

    socket.on('error', () => {
      socket.destroy();
    });
    socket.on('close', cleanupAndRetry);
  }

  private startUdpLanDiscovery(): void {
    try {
      const udp = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      udp.on('error', () => {
        try {
          udp.close();
        } catch {
          // Ignore
        }
      });
      udp.on('message', (msg) => {
        this.handleIncomingJson(msg.toString('utf-8'));
      });
      udp.bind(UDP_DISCOVERY_PORT, () => {
        try {
          udp.setBroadcast(true);
        } catch {
          // Ignore
        }
      });
      udp.unref?.();
      this.udpSocket = udp;
    } catch {
      // Ignore if UDP port binding is restricted
    }
  }
}
