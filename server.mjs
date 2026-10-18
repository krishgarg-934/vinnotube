import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join as joinPath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';

const root = fileURLToPath(new URL('.', import.meta.url));
const publicDir = joinPath(root, 'public');
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const roomMap = new Map();
const roomCodeAlphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const ROOM_IDLE_TTL_MS = 30 * 60 * 1000;
const MAX_PARTICIPANTS = 25;
const MAX_QUEUE_ITEMS = 50;
const MAX_CHAT_ITEMS = 80;
const MAX_STAMP_BACKDATE_MS = 3000;
const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function roomCode() {
  let result = '';
  for (let index = 0; index < 6; index += 1) {
    result += roomCodeAlphabet[randomBytes(1)[0] % roomCodeAlphabet.length];
  }
  return result;
}

function createRoom() {
  let code = roomCode();
  while (roomMap.has(code)) code = roomCode();
  const room = {
    code,
    participants: new Map(),
    adminId: null,
    queue: [],
    queueSequence: 0,
    nextVotes: new Map(),
    nowPlaying: null,
    playback: { playing: false, currentTime: 0, rate: 1, updatedAt: Date.now() },
    countdown: null,
    countdownTimer: null,
    chat: [],
    reactions: [],
    poll: null,
    idleTimer: null,
    ghosts: new Map(),
  };
  roomMap.set(code, room);
  return room;
}

function safeSend(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

function broadcast(room, payload) {
  const envelope = JSON.stringify({ ...payload, serverReceivedAt: payload.serverReceivedAt || Date.now() });
  for (const participant of room.participants.values()) {
    if (participant.socket.readyState === WebSocket.OPEN) participant.socket.send(envelope);
  }
}

function participantsPayload(room) {
  return [...room.participants.values()].map(({ id, name, joinedAt, ready }) => ({ id, name, joinedAt, ready: Boolean(ready) }));
}

function broadcastParticipants(room) {
  broadcast(room, { type: 'participants', participants: participantsPayload(room), adminId: room.adminId });
}

function voteCount(room, itemId) {
  let count = 0;
  for (const vote of room.nextVotes.values()) if (vote === itemId) count += 1;
  return count;
}

function sortQueue(room) {
  const currentId = room.nowPlaying?.id;
  const current = room.queue.find((item) => item.id === currentId);
  const upcoming = room.queue.filter((item) => item.id !== currentId);
  upcoming.sort((a, b) => voteCount(room, b.id) - voteCount(room, a.id) || a.queueOrder - b.queueOrder);
  room.queue = current ? [current, ...upcoming] : upcoming;
}

function publicQueue(room, viewerId) {
  sortQueue(room);
  return room.queue.map(({ queueOrder, ...item }) => ({
    ...item,
    voteCount: voteCount(room, item.id),
    myVote: room.nextVotes.get(viewerId) === item.id,
  }));
}

function broadcastQueue(room, action, extra = {}) {
  for (const participant of room.participants.values()) {
    safeSend(participant.socket, {
      type: 'queue',
      queue: publicQueue(room, participant.id),
      nowPlaying: room.nowPlaying,
      playback: room.playback,
      action,
      ...extra,
    });
  }
}

function cancelCountdown(room) {
  if (!room.countdown) return false;
  clearTimeout(room.countdownTimer);
  room.countdownTimer = null;
  room.countdown = null;
  broadcast(room, { type: 'countdown', countdown: null });
  return true;
}

function clearReadiness(room) {
  let changed = false;
  for (const participant of room.participants.values()) {
    if (participant.ready) changed = true;
    participant.ready = false;
  }
  if (changed) broadcastParticipants(room);
}

function allReady(room) {
  return room.participants.size > 0 && [...room.participants.values()].every((participant) => participant.ready);
}

function publicPoll(poll) {
  if (!poll) return null;
  return {
    id: poll.id,
    question: poll.question,
    options: poll.options,
    votes: poll.votes,
    createdBy: poll.createdBy,
    open: poll.open,
  };
}

function sendSnapshot(socket, room) {
  safeSend(socket, {
    type: 'snapshot',
    selfId: socket.id,
    serverNow: Date.now(),
    room: {
      code: room.code,
      adminId: room.adminId,
      participants: participantsPayload(room),
      queue: publicQueue(room, socket.id),
      nowPlaying: room.nowPlaying,
      playback: room.playback,
      countdown: room.countdown ? { startsAt: room.countdown.startsAt } : null,
      chat: room.chat,
      poll: publicPoll(room.poll),
    },
  });
}

function cleanName(value) {
  return String(value || 'Guest').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 32) || 'Guest';
}

function cleanText(value, maxLength) {
  return String(value || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, maxLength);
}

function systemChat(room, text) {
  const message = { id: randomUUID(), name: 'Room update', text, system: true, at: Date.now() };
  room.chat.push(message);
  room.chat = room.chat.slice(-MAX_CHAT_ITEMS);
  broadcast(room, { type: 'chat', message });
}

const RESUME_GRACE_MS = 10_000;

// Admin succession: the room always has an admin while anyone is present. The first person in becomes
// admin; when the admin leaves, the participant who joined next (earliest joinedAt) takes over.
// While a refreshing admin's seat is being held (grace period) nobody is promoted, so a page refresh
// doesn't hand the role away.
function ensureAdmin(room) {
  if (room.adminId && room.participants.has(room.adminId)) return;
  room.adminId = null;
  for (const ghost of room.ghosts.values()) if (ghost.wasAdmin) return;
  let next = null;
  for (const candidate of room.participants.values()) {
    if (!next || candidate.joinedAt < next.joinedAt) next = candidate;
  }
  if (!next) return;
  room.adminId = next.id;
  systemChat(room, `${next.name} is now the room admin.`);
  broadcastParticipants(room);
}
const validToken = (value) => typeof value === 'string' && /^[A-Za-z0-9-]{16,64}$/.test(value);

function detach(socket) {
  const room = roomMap.get(socket.roomCode);
  if (!room) return;
  const participant = room.participants.get(socket.id);
  const hadVote = room.nextVotes.delete(socket.id);
  if (room.countdown) cancelCountdown(room);
  room.participants.delete(socket.id);
  socket.roomCode = null;
  if (participant) {
    const wasAdmin = room.adminId === socket.id;
    if (wasAdmin) room.adminId = null;
    const announceAdminLeft = () => {
      if (room.participants.size > 0) systemChat(room, `${participant.name} left the room.`);
      if (wasAdmin && !room.adminId) ensureAdmin(room);
    };
    if (participant.token) {
      // The member may just be refreshing the page. Hold their seat (and admin role) briefly so they
      // come back as the same person instead of a stranger.
      const previous = room.ghosts.get(participant.token);
      if (previous) clearTimeout(previous.timer);
      const timer = setTimeout(() => {
        if (room.ghosts.get(participant.token)?.timer === timer) room.ghosts.delete(participant.token);
        announceAdminLeft();
      }, RESUME_GRACE_MS);
      timer.unref?.();
      room.ghosts.set(participant.token, { id: socket.id, wasAdmin, timer });
    } else {
      announceAdminLeft();
    }
    broadcastParticipants(room);
    if (hadVote) broadcastQueue(room, 'vote');
  }
  if (room.participants.size === 0) {
    clearTimeout(room.idleTimer);
    room.idleTimer = setTimeout(() => roomMap.delete(room.code), ROOM_IDLE_TTL_MS);
    room.idleTimer.unref?.();
  }
}

function join(socket, room, name, token) {
  detach(socket);
  if (room.participants.size && room.countdown) cancelCountdown(room);
  clearTimeout(room.idleTimer);

  // Resume: the same browser tab (same secret token) coming back after a refresh keeps its identity,
  // admin role and seat. Covers both "old connection already closed" and "old one not closed yet".
  let resumed = false;
  if (validToken(token)) {
    let adoptId = null;
    let restoreAdmin = false;
    for (const existing of [...room.participants.values()]) {
      if (existing.token === token && existing.socket !== socket) {
        adoptId = existing.id;
        existing.socket.roomCode = null;
        room.participants.delete(existing.id);
        try { existing.socket.close(); } catch { /* already closed */ }
      }
    }
    const ghost = room.ghosts.get(token);
    if (ghost) {
      clearTimeout(ghost.timer);
      room.ghosts.delete(token);
      if (!adoptId && !room.participants.has(ghost.id)) {
        adoptId = ghost.id;
        restoreAdmin = ghost.wasAdmin && !room.adminId;
      }
    }
    if (adoptId) {
      socket.id = adoptId;
      if (restoreAdmin) room.adminId = adoptId;
      resumed = true;
    }
  }

  socket.roomCode = room.code;
  const participant = { id: socket.id, name: cleanName(name), joinedAt: Date.now(), socket, ready: false, token: validToken(token) ? token : null };
  room.participants.set(socket.id, participant);
  // First person in (or the next one when the room has no admin) becomes admin automatically.
  if (!room.adminId) {
    let pendingAdmin = false;
    for (const ghost of room.ghosts.values()) if (ghost.wasAdmin) pendingAdmin = true;
    if (!pendingAdmin) room.adminId = socket.id;
  }
  sendSnapshot(socket, room);
  broadcastParticipants(room);
  if (!resumed && room.participants.size > 1) systemChat(room, `${participant.name} joined the room.`);
  if (room.adminId === socket.id && !resumed && room.participants.size === 1) systemChat(room, `${participant.name} created the room and is the admin.`);
}

function normalizeMedia(value) {
  if (!value || typeof value !== 'object') return null;
  const title = cleanText(value.title, 100);
  const src = cleanText(value.src, 1200);
  const id = cleanText(value.id, 100);
  if (!title || !src || !id) return null;
  try {
    const parsed = new URL(src);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
  } catch {
    return null;
  }
  return {
    id,
    title,
    src,
    genre: cleanText(value.genre, 36) || 'Shared link',
    year: cleanText(value.year, 8),
    description: cleanText(value.description, 220),
    theme: cleanText(value.theme, 24) || 'violet',
  };
}

function currentRoom(socket) {
  return roomMap.get(socket.roomCode);
}

function requireAdmin(socket, room) {
  if (room.adminId === socket.id) return true;
  safeSend(socket, {
    type: 'error',
    code: 'ADMIN_REQUIRED',
    message: room.adminId ? 'Only the room admin can do that.' : 'No admin is assigned yet. Claim admin controls first.',
  });
  return false;
}

function handleMessage(socket, raw) {
  if (Date.now() - socket.rateWindowAt > 10_000) {
    socket.rateWindowAt = Date.now();
    socket.rateCount = 0;
  }
  socket.rateCount += 1;
  if (socket.rateCount > 120) {
    safeSend(socket, { type: 'error', message: 'Too many actions at once. Please slow down.' });
    return;
  }

  let message;
  try {
    message = JSON.parse(raw.toString());
  } catch {
    safeSend(socket, { type: 'error', message: 'That message could not be read.' });
    return;
  }
  if (!message || typeof message.type !== 'string') return;

  if (message.type === 'ping') {
    safeSend(socket, { type: 'pong', clientSentAt: Number(message.clientSentAt) || 0, serverNow: Date.now() });
    return;
  }

  if (message.type === 'create') {
    const room = createRoom();
    join(socket, room, message.name, message.token);
    return;
  }

  if (message.type === 'join') {
    const code = cleanText(message.room, 8).toUpperCase();
    const room = roomMap.get(code);
    if (!room) {
      safeSend(socket, { type: 'error', code: 'ROOM_NOT_FOUND', message: `Room ${code || 'code'} was not found.` });
      return;
    }
    if (room.participants.size >= MAX_PARTICIPANTS && !room.participants.has(socket.id)) {
      safeSend(socket, { type: 'error', message: `This room has reached its ${MAX_PARTICIPANTS}-person limit.` });
      return;
    }
    join(socket, room, message.name, message.token);
    return;
  }

  const room = currentRoom(socket);
  if (!room) return;
  const participant = room.participants.get(socket.id);
  if (!participant) return;

  switch (message.type) {
    case 'playback': {
      if (!requireAdmin(socket, room)) return;
      if (!room.nowPlaying) return;
      cancelCountdown(room);
      const currentTime = Number(message.currentTime);
      if (!Number.isFinite(currentTime) || currentTime < 0 || currentTime > 24 * 60 * 60) return;
      const rate = Number(message.rate);
      // `at` is the admin's estimate (in server time) of the moment currentTime was sampled. Using it
      // instead of the arrival time removes the admin -> server delay from everyone else's position.
      // It is clamped so a bad clock estimate can never push the room more than a few seconds off.
      const now = Date.now();
      const claimedAt = Number(message.at);
      const updatedAt = Number.isFinite(claimedAt) ? Math.min(now, Math.max(now - MAX_STAMP_BACKDATE_MS, claimedAt)) : now;
      room.playback = { playing: Boolean(message.playing), currentTime, rate: PLAYBACK_RATES.includes(rate) ? rate : 1, updatedAt };
      if (room.playback.playing) clearReadiness(room);
      broadcast(room, { type: 'playback', playback: room.playback, actorId: participant.id });
      break;
    }
    case 'playMovie': {
      if (!requireAdmin(socket, room)) return;
      const item = normalizeMedia(message.item);
      if (!item) {
        safeSend(socket, { type: 'error', message: 'That video link could not be added.' });
        return;
      }
      cancelCountdown(room);
      if (!room.queue.some((entry) => entry.id === item.id)) {
        if (room.queue.length >= MAX_QUEUE_ITEMS) room.queue.shift();
        room.queue.push({ ...item, queueOrder: ++room.queueSequence });
      }
      room.nowPlaying = room.queue.find((entry) => entry.id === item.id);
      for (const [voterId, vote] of room.nextVotes) if (vote === item.id) room.nextVotes.delete(voterId);
      sortQueue(room);
      room.playback = { playing: false, currentTime: 0, rate: 1, updatedAt: Date.now() };
      clearReadiness(room);
      broadcastQueue(room, 'selected');
      break;
    }
    case 'queueAdd': {
      const item = normalizeMedia(message.item);
      if (!item) {
        safeSend(socket, { type: 'error', message: 'That video link could not be added.' });
        return;
      }
      if (room.queue.some((entry) => entry.id === item.id)) return;
      if (room.queue.length >= MAX_QUEUE_ITEMS) {
        safeSend(socket, { type: 'error', message: 'The shared playlist is full.' });
        return;
      }
      room.queue.push({ ...item, queueOrder: ++room.queueSequence });
      sortQueue(room);
      broadcastQueue(room, 'added', { actorName: participant.name, itemId: item.id });
      break;
    }
    case 'queueRemove': {
      if (!requireAdmin(socket, room)) return;
      const id = cleanText(message.id, 100);
      room.queue = room.queue.filter((entry) => entry.id !== id);
      for (const [voterId, vote] of room.nextVotes) if (vote === id) room.nextVotes.delete(voterId);
      if (room.nowPlaying?.id === id) {
        room.nowPlaying = room.queue[0] || null;
        if (room.nowPlaying) {
          for (const [voterId, vote] of room.nextVotes) if (vote === room.nowPlaying.id) room.nextVotes.delete(voterId);
        }
        room.playback = { playing: false, currentTime: 0, rate: 1, updatedAt: Date.now() };
        cancelCountdown(room);
        clearReadiness(room);
      }
      sortQueue(room);
      broadcastQueue(room, 'removed');
      break;
    }
    case 'queuePlay': {
      if (!requireAdmin(socket, room)) return;
      const item = room.queue.find((entry) => entry.id === cleanText(message.id, 100));
      if (!item) return;
      cancelCountdown(room);
      room.nowPlaying = item;
      for (const [voterId, vote] of room.nextVotes) if (vote === item.id) room.nextVotes.delete(voterId);
      sortQueue(room);
      room.playback = { playing: false, currentTime: 0, rate: 1, updatedAt: Date.now() };
      clearReadiness(room);
      broadcastQueue(room, 'selected');
      break;
    }
    case 'queueVote': {
      const id = cleanText(message.id, 100);
      const item = room.queue.find((entry) => entry.id === id);
      if (!item || id === room.nowPlaying?.id) return;
      if (room.nextVotes.get(participant.id) === id) room.nextVotes.delete(participant.id);
      else room.nextVotes.set(participant.id, id);
      sortQueue(room);
      broadcastQueue(room, 'vote', { actorName: participant.name, itemId: id });
      break;
    }
    case 'readySet': {
      const ready = Boolean(message.ready);
      if (ready && (!room.nowPlaying || room.playback.playing)) {
        safeSend(socket, { type: 'error', message: 'Pause a video before marking yourself ready.' });
        return;
      }
      participant.ready = ready;
      if (!participant.ready) cancelCountdown(room);
      broadcastParticipants(room);
      break;
    }
    case 'countdownStart': {
      if (!requireAdmin(socket, room)) return;
      if (!room.nowPlaying) {
        safeSend(socket, { type: 'error', message: 'Choose a video before starting the countdown.' });
        return;
      }
      if (room.playback.playing) {
        safeSend(socket, { type: 'error', message: 'Pause the current video before starting a countdown.' });
        return;
      }
      if (!allReady(room)) {
        safeSend(socket, { type: 'error', message: 'Everyone in the room must be ready first.' });
        return;
      }
      cancelCountdown(room);
      const countdownId = randomUUID();
      const startsAt = Date.now() + 5000;
      room.countdown = { id: countdownId, startsAt, currentTime: Number(room.playback.currentTime) || 0, rate: Number(room.playback.rate) || 1 };
      broadcast(room, { type: 'countdown', countdown: { startsAt } });
      room.countdownTimer = setTimeout(() => {
        if (room.countdown?.id !== countdownId || !room.nowPlaying || !allReady(room)) return;
        const { currentTime, rate } = room.countdown;
        room.countdown = null;
        room.countdownTimer = null;
        room.playback = { playing: true, currentTime, rate, updatedAt: Date.now() };
        broadcast(room, { type: 'countdown', countdown: null });
        clearReadiness(room);
        broadcast(room, { type: 'playback', playback: room.playback, actorId: socket.id });
      }, Math.max(0, startsAt - Date.now()));
      room.countdownTimer.unref?.();
      break;
    }
    case 'countdownCancel': {
      if (!requireAdmin(socket, room)) return;
      cancelCountdown(room);
      break;
    }
    case 'chat': {
      const text = cleanText(message.text, 500);
      if (!text) return;
      const entry = { id: randomUUID(), name: participant.name, participantId: participant.id, text, at: Date.now() };
      room.chat.push(entry);
      room.chat = room.chat.slice(-MAX_CHAT_ITEMS);
      broadcast(room, { type: 'chat', message: entry });
      break;
    }
    case 'reaction': {
      const emoji = String(message.emoji || '');
      if (!['👏', '❤️', '😂', '🔥', '😮', '🥹', '🍿', '🤯', '😭', '😱', '🙌', '😎', '🫶', '💀'].includes(emoji)) return;
      const reaction = { id: randomUUID(), name: participant.name, emoji, at: Date.now() };
      room.reactions.push(reaction);
      room.reactions = room.reactions.slice(-30);
      broadcast(room, { type: 'reaction', reaction });
      break;
    }
    case 'pollCreate': {
      if (!requireAdmin(socket, room)) return;
      const question = cleanText(message.question, 120);
      const optionLabels = Array.isArray(message.options)
        ? message.options.map((option) => cleanText(option, 60)).filter(Boolean).slice(0, 4)
        : [];
      const uniqueOptions = [...new Set(optionLabels)];
      if (!question || uniqueOptions.length < 2) {
        safeSend(socket, { type: 'error', message: 'A poll needs a question and at least two different choices.' });
        return;
      }
      room.poll = {
        id: randomUUID(),
        question,
        options: uniqueOptions.map((label, index) => ({ id: String(index), label })),
        votes: {},
        createdBy: participant.name,
        open: true,
      };
      broadcast(room, { type: 'poll', poll: publicPoll(room.poll) });
      break;
    }
    case 'pollVote': {
      if (!room.poll?.open) return;
      const optionId = cleanText(message.optionId, 8);
      if (!room.poll.options.some((option) => option.id === optionId)) return;
      room.poll.votes[participant.id] = optionId;
      broadcast(room, { type: 'poll', poll: publicPoll(room.poll) });
      break;
    }
    case 'pollClose': {
      if (!requireAdmin(socket, room)) return;
      if (!room.poll) return;
      room.poll.open = false;
      broadcast(room, { type: 'poll', poll: publicPoll(room.poll) });
      break;
    }
    case 'pollClear': {
      if (!requireAdmin(socket, room)) return;
      if (!room.poll) return;
      room.poll = null;
      broadcast(room, { type: 'poll', poll: null });
      break;
    }
    case 'claimAdmin': {
      if (room.adminId && room.adminId !== socket.id) {
        safeSend(socket, { type: 'error', code: 'ADMIN_ALREADY_ASSIGNED', message: 'An admin is already assigned. Ask them to transfer control to you.' });
        return;
      }
      if (room.adminId === socket.id) return;
      room.adminId = socket.id;
      broadcastParticipants(room);
      systemChat(room, `${participant.name} claimed admin controls.`);
      break;
    }
    case 'transferAdmin': {
      if (!requireAdmin(socket, room)) return;
      const nextId = cleanText(message.participantId, 80);
      if (!room.participants.has(nextId)) return;
      room.adminId = nextId;
      broadcastParticipants(room);
      systemChat(room, `${room.participants.get(nextId).name} now has admin controls.`);
      break;
    }
    case 'rename': {
      const name = cleanName(message.name);
      if (name === participant.name) return;
      participant.name = name;
      broadcastParticipants(room);
      systemChat(room, `${name} updated their name.`);
      break;
    }
    default:
      break;
  }
}

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`).pathname;
  if (pathname === '/healthz') {
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end(JSON.stringify({ ok: true, rooms: roomMap.size }));
    return;
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!['index.html', 'styles.css', 'app.js'].includes(relativePath)) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  try {
    const data = await readFile(joinPath(publicDir, relativePath));
    response.writeHead(200, {
      'content-type': MIME_TYPES[extname(relativePath)],
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'content-security-policy': "default-src 'self'; script-src 'self' https://www.youtube.com https://s.ytimg.com; style-src 'self'; img-src 'self' data: https://i.ytimg.com; media-src 'self' https: http: blob:; connect-src 'self' ws: wss: https://www.youtube.com https://*.googlevideo.com; frame-src https://www.youtube.com https://www.youtube-nocookie.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    });
    response.end(data);
  } catch {
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Unable to load the app.');
  }
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`).pathname;
  if (pathname !== '/ws') {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(request, socket, head, (webSocket) => wss.emit('connection', webSocket, request));
});

wss.on('connection', (socket) => {
  socket.id = randomUUID();
  socket.roomCode = null;
  socket.rateWindowAt = Date.now();
  socket.rateCount = 0;
  socket.isAlive = true;
  socket.on('pong', () => { socket.isAlive = true; });
  socket.on('message', (data) => handleMessage(socket, data));
  socket.on('close', () => detach(socket));
  socket.on('error', () => detach(socket));
});

const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    if (!socket.isAlive) {
      socket.terminate();
      continue;
    }
    socket.isAlive = false;
    socket.ping();
  }
}, 10_000);
heartbeat.unref?.();

server.listen(port, host, () => {
  console.log(`VinnoTube is ready at http://localhost:${port}`);
  console.log(`For friends on your local network, share this computer's LAN address and room invite.`);
});

server.on('close', () => clearInterval(heartbeat));
