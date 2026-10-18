import WebSocket from 'ws';

const wsUrl = process.env.VINNOTUBE_WS_URL || 'ws://127.0.0.1:3000/ws';
const clientsArg = process.argv.find((arg) => arg.startsWith('--clients='));
const clientCount = Math.max(2, Math.min(25, Number(clientsArg?.split('=')[1]) || 10));
const clients = [];

function makeClient(name) {
  const socket = new WebSocket(wsUrl);
  const messages = [];
  const listeners = new Set();
  let lastError = null;
  socket.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      Object.defineProperty(message, '_receivedAt', { value: Date.now() });
      messages.push(message);
      for (const listener of listeners) listener(message);
    } catch { /* Ignore malformed server responses in the smoke test. */ }
  });
  socket.on('error', (error) => { lastError = error; });
  return {
    name,
    socket,
    messages,
    get error() { return lastError; },
    waitForOpen() {
      if (socket.readyState === WebSocket.OPEN) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`Timed out connecting to ${wsUrl}`)), 5000);
        socket.once('open', () => { clearTimeout(timeout); resolve(); });
        socket.once('error', (error) => { clearTimeout(timeout); reject(error); });
      });
    },
    waitFor(predicate, fromIndex = 0) {
      const existing = messages.slice(fromIndex).find(predicate);
      if (existing) return Promise.resolve(existing);
      if (lastError) return Promise.reject(lastError);
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          listeners.delete(onMessage);
          reject(new Error(`Timed out waiting for a room update for ${name}`));
        }, 5000);
        const onMessage = (message) => {
          if (!predicate(message)) return;
          clearTimeout(timeout);
          listeners.delete(onMessage);
          resolve(message);
        };
        listeners.add(onMessage);
      });
    },
    send(message) {
      if (socket.readyState !== WebSocket.OPEN) throw new Error(`${name} disconnected before sending`);
      socket.send(JSON.stringify(message));
    },
    close() {
      if (socket.readyState === WebSocket.OPEN) socket.close();
      else if (socket.readyState !== WebSocket.CLOSED) socket.terminate();
    },
  };
}

try {
  for (let index = 0; index < clientCount; index += 1) clients.push(makeClient(`Test viewer ${index + 1}`));
  await Promise.all(clients.map((client) => client.waitForOpen()));

  const first = clients[0];
  let cursor = first.messages.length;
  first.send({ type: 'create', name: first.name });
  const created = await first.waitFor((message) => message.type === 'snapshot', cursor);
  const roomCode = created.room.code;
  const adminId = created.selfId;

  await Promise.all(clients.slice(1).map(async (client) => {
    const start = client.messages.length;
    client.send({ type: 'join', room: roomCode, name: client.name });
    await client.waitFor((message) => message.type === 'snapshot', start);
  }));

  await Promise.all(clients.map((client) => client.waitFor(
    (message) => message.type === 'participants' && message.participants?.length === clientCount,
  )));

  // The room creator is made admin automatically, so no claim is needed: every client should
  // already have been told that the first participant is the admin.
  await Promise.all(clients.map((client) => client.waitFor(
    (message) => message.type === 'participants' && message.adminId === adminId,
    0,
  )));

  cursor = first.messages.length;
  first.send({
    type: 'playMovie',
    item: {
      id: 'vinnotube-load-test',
      title: 'VinnoTube room test',
      src: 'https://www.youtube.com/watch?v=eRsGyueVLvQ',
      genre: 'Test',
      year: 'TEST',
      description: 'Temporary video for a local room sync check.',
    },
  });
  await first.waitFor((message) => message.type === 'queue' && message.nowPlaying?.id === 'vinnotube-load-test', cursor);

  const playbackCursors = clients.map((client) => client.messages.length);
  const sentAt = Date.now();
  first.send({ type: 'playback', playing: true, currentTime: 12, rate: 1.5 });
  const received = await Promise.all(clients.map((client, index) => client.waitFor(
    (message) => message.type === 'playback' && message.playback?.rate === 1.5,
    playbackCursors[index],
  )));
  const deliveryMs = received.map((message) => message._receivedAt - sentAt).sort((a, b) => a - b);
  const p95 = deliveryMs[Math.ceil(deliveryMs.length * 0.95) - 1];
  console.log(`PASS: ${clientCount} simulated viewers joined room ${roomCode}.`);
  console.log(`PASS: admin playback at 1.5× reached every viewer (server relay estimate p95 ${p95} ms).`);
  console.log('This checks WebSocket room and playback-state propagation; use real browser tabs/devices to verify video playback and network latency.');
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
} finally {
  for (const client of clients) client.close();
}
