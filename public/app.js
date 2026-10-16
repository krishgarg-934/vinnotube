const catalog = [
  {
    id: 'avengers-endgame-clip', title: 'Avengers: Endgame — Film Clip', year: '2019', genre: 'Movie Clip',
    description: 'An official Marvel Studios clip from Avengers: Endgame.',
    src: 'https://www.youtube.com/watch?v=9QbltzIUV6w', poster: 'https://i.ytimg.com/vi/9QbltzIUV6w/hqdefault.jpg', theme: 'tears',
  },
  {
    id: 'avengers-endgame-to-the-end', title: 'Avengers: Endgame — To the End', year: '2019', genre: 'Featurette',
    description: 'A Marvel look back at the heroes and their final promise.',
    src: 'https://www.youtube.com/watch?v=0jNvJU52LvU', poster: 'https://i.ytimg.com/vi/0jNvJU52LvU/hqdefault.jpg', theme: 'escape',
  },
  {
    id: 'avengers-endgame-trailer', title: 'Avengers: Endgame — Official Trailer', year: '2019', genre: 'Trailer',
    description: 'The official Marvel Studios trailer. Whatever it takes.',
    src: 'https://www.youtube.com/watch?v=TcMBFSGVi1c', poster: 'https://i.ytimg.com/vi/TcMBFSGVi1c/hqdefault.jpg', theme: 'joyride',
  },
  {
    id: 'avengers-infinity-war-trailer', title: 'Avengers: Infinity War — Official Trailer', year: '2017', genre: 'Trailer',
    description: 'The Avengers and their allies face their biggest threat.',
    src: 'https://www.youtube.com/watch?v=6ZfuNTqbHE8', poster: 'https://i.ytimg.com/vi/6ZfuNTqbHE8/hqdefault.jpg', theme: 'fun',
  },
];

const genres = ['All picks', ...new Set(catalog.map((movie) => movie.genre)), 'Saved'];
const local = {
  get(key, fallback) {
    try { const value = localStorage.getItem(key); return value === null ? fallback : value; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* Storage can be disabled by the browser. */ }
  },
};

const queryRoom = new URLSearchParams(location.search).get('room')?.trim().toUpperCase() || '';
const savedFavorites = (() => {
  try { return new Set(JSON.parse(local.get('vinnotube-favorites', local.get('reelroom-favorites', '[]')))); } catch { return new Set(); }
})();
const savedVolume = Math.min(100, Math.max(0, Number(local.get('vinnotube-volume', '100')) || 0));
const savedMuted = local.get('vinnotube-muted', 'false') === 'true';
const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const state = {
  socket: null,
  connected: false,
  roomCode: queryRoom,
  userId: null,
  adminId: null,
  userName: local.get('vinnotube-name', local.get('reelroom-name', `Guest ${Math.floor(Math.random() * 90) + 10}`)),
  participants: [],
  queue: [],
  nowPlaying: null,
  playback: { playing: false, currentTime: 0, rate: 1, updatedAt: Date.now() },
  volume: savedVolume,
  muted: savedMuted,
  chat: [],
  poll: null,
  countdown: null,
  countdownTimer: null,
  pollFormOpen: false,
  pendingRoomCode: '',
  previousRoomCode: '',
  selectedGenre: 'All picks',
  search: '',
  favorites: savedFavorites,
  syncOffsetMs: 0,
  latencySamples: [],
  reconnectAttempt: 0,
  reconnectTimer: null,
  suppressPlayerEvents: false,
  suppressTimer: null,
  playbackRateTimer: null,
  syncTimer: null,
  currentSource: '',
  youtubePlayer: null,
  youtubeVideoId: '',
  youtubeLoadingId: '',
  youtubeReady: false,
  youtubeRemoteCommandUntil: 0,
  localPlaybackGestureRequired: false,
};

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const video = $('#videoPlayer');
let youtubeApiPromise = null;

function isAdmin() {
  return Boolean(state.userId && state.adminId === state.userId);
}

function getYouTubeVideoId(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    let id = '';
    if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
    else if (['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)) {
      id = url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] || '';
    }
    return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : '';
  } catch {
    return '';
  }
}

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  const request = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('YouTube player timed out')), 15_000);
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('YouTube player could not load'));
    };
    document.head.append(script);
  });
  youtubeApiPromise = request.catch((error) => {
    youtubeApiPromise = null;
    throw error;
  });
  return youtubeApiPromise;
}

function formatTime(seconds) {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

function renderYouTubeControls() {
  const controls = $('#youtubeControls');
  const seek = $('#youtubeSeek');
  const button = $('#youtubePlayButton');
  const player = state.youtubePlayer;
  const youtube = Boolean(state.nowPlaying && getYouTubeVideoId(state.nowPlaying.src));
  const available = Boolean(state.nowPlaying);
  controls.hidden = !available;
  if (!available) return;
  const ready = youtube ? Boolean(player && state.youtubeReady && !$('#youtubePlayerFrame').hidden) : video.readyState >= 1;
  const admin = isAdmin();
  button.disabled = !admin || !ready;
  seek.disabled = !admin || !ready;
  const rateSelect = $('#playbackRateSelect');
  rateSelect.disabled = !admin || !ready;
  $('#qualityOption').textContent = youtube ? 'Auto' : 'Source';
  $('#qualitySelect').title = youtube
    ? 'YouTube chooses playback quality automatically.'
    : 'A single direct video link has one source quality.';
  const rate = Number(state.playback.rate) || 1;
  rateSelect.value = String(rate);
  let rateOptions = PLAYBACK_RATES;
  if (youtube && ready) {
    try {
      const availableRates = player.getAvailablePlaybackRates();
      if (availableRates?.length) rateOptions = [...new Set([...availableRates, 1])].sort((a, b) => a - b);
    } catch { /* The iframe may still be reporting its available rates. */ }
  }
  const existingRates = [...rateSelect.options].map((option) => Number(option.value));
  if (existingRates.length !== rateOptions.length || existingRates.some((value, index) => value !== rateOptions[index])) {
    rateSelect.replaceChildren(...rateOptions.map((value) => {
      const option = document.createElement('option');
      option.value = String(value);
      option.textContent = `${value}×`;
      return option;
    }));
  }
  rateSelect.value = [...rateSelect.options].some((option) => option.value === String(rate)) ? String(rate) : '1';
  $('#volumeRange').value = String(state.volume);
  $('#volumeValue').textContent = `${state.volume}%`;
  $('#muteButton').textContent = state.muted || state.volume === 0 ? '🔇' : '🔊';
  $('#muteButton').setAttribute('aria-label', state.muted || state.volume === 0 ? 'Unmute video' : 'Mute video');
  $('#muteButton').title = state.muted || state.volume === 0 ? 'Unmute' : 'Mute';
  if (!ready) {
    $('#youtubeTime').textContent = '0:00 / 0:00';
    return;
  }
  let current = 0;
  let duration = 0;
  let playing = false;
  try {
    if (youtube) {
      current = player.getCurrentTime() || 0;
      duration = player.getDuration() || 0;
      playing = player.getPlayerState() === window.YT.PlayerState.PLAYING;
    } else {
      current = video.currentTime || 0;
      duration = Number.isFinite(video.duration) ? video.duration : 0;
      playing = !video.paused;
    }
  } catch { return; }
  seek.max = String(Math.max(duration, 1));
  if (document.activeElement !== seek) seek.value = String(Math.min(current, duration || current));
  $('#youtubeTime').textContent = `${formatTime(current)} / ${formatTime(duration)}`;
  button.textContent = playing ? 'Ⅱ' : '▶';
  button.setAttribute('aria-label', playing ? 'Pause video' : 'Play video');
}

function applyLocalVolume() {
  try {
    if (state.nowPlaying && getYouTubeVideoId(state.nowPlaying.src)) {
      if (!state.youtubePlayer || !state.youtubeReady) return;
      state.youtubePlayer.setVolume(state.volume);
      if (state.muted || state.volume === 0) state.youtubePlayer.mute();
      else state.youtubePlayer.unMute();
      return;
    }
    video.volume = state.volume / 100;
    video.muted = state.muted || state.volume === 0;
  } catch { /* Media may be between source changes. */ }
}

function setLocalVolume(value) {
  state.volume = Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
  if (state.volume > 0) state.muted = false;
  local.set('vinnotube-volume', String(state.volume));
  local.set('vinnotube-muted', String(state.muted));
  applyLocalVolume();
  renderYouTubeControls();
}

function renderJoinPlaybackButton() {
  const button = $('#joinPlaybackButton');
  button.hidden = isAdmin() || !state.playback.playing || !state.localPlaybackGestureRequired;
}

function handleYouTubeStateChange(event) {
  renderYouTubeControls();
  if (event.data === window.YT.PlayerState.PLAYING) {
    state.localPlaybackGestureRequired = false;
    renderJoinPlaybackButton();
  }
  if (state.suppressPlayerEvents || Date.now() < state.youtubeRemoteCommandUntil) return;
  if (!isAdmin()) {
    syncPlayer(true);
    return;
  }
  const playerState = event.data;
  if (playerState === window.YT.PlayerState.PLAYING) {
    send({ type: 'playback', playing: true, currentTime: state.youtubePlayer.getCurrentTime() || 0, rate: state.youtubePlayer.getPlaybackRate?.() || 1 });
  } else if (playerState === window.YT.PlayerState.PAUSED) {
    send({ type: 'playback', playing: false, currentTime: state.youtubePlayer.getCurrentTime() || 0, rate: state.youtubePlayer.getPlaybackRate?.() || 1 });
  }
}

function handleYouTubeRateChange(event) {
  renderYouTubeControls();
  if (state.suppressPlayerEvents || Date.now() < state.youtubeRemoteCommandUntil || !isAdmin()) return;
  const currentTime = state.youtubePlayer?.getCurrentTime?.() || 0;
  const playing = state.youtubePlayer?.getPlayerState?.() === window.YT.PlayerState.PLAYING;
  send({ type: 'playback', playing, currentTime, rate: Number(event.data) || 1 });
}

function ensureYouTubePlayer(videoId) {
  $('#youtubePlayerFrame').hidden = false;
  renderYouTubeControls();
  video.hidden = true;
  video.controls = false;
  if (state.youtubePlayer) {
    if (state.youtubeReady && state.youtubeVideoId !== videoId) {
      state.youtubeVideoId = videoId;
      state.youtubeRemoteCommandUntil = Date.now() + 1500;
      setRemoteSuppression();
      state.youtubePlayer.cueVideoById(videoId);
      state.youtubePlayer.seekTo(0, true);
    }
    return;
  }
  if (state.youtubeLoadingId === videoId) return;
  state.youtubeLoadingId = videoId;
  loadYouTubeApi().then((YT) => {
    if (getYouTubeVideoId(state.nowPlaying?.src) !== videoId) {
      state.youtubeLoadingId = '';
      return;
    }
    state.youtubePlayer = new YT.Player('youtubePlayer', {
      videoId,
      width: '100%',
      height: '100%',
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        enablejsapi: 1,
        playsinline: 1,
        origin: location.origin,
      },
      events: {
        onReady: () => {
          const activeVideoId = getYouTubeVideoId(state.nowPlaying?.src) || videoId;
          state.youtubeVideoId = activeVideoId;
          state.youtubeLoadingId = '';
          state.youtubeReady = true;
          state.youtubeRemoteCommandUntil = Date.now() + 1500;
          setRemoteSuppression();
          if (activeVideoId !== videoId) state.youtubePlayer.cueVideoById(activeVideoId);
          syncPlayer(true);
          applyLocalVolume();
          renderYouTubeControls();
        },
        onStateChange: handleYouTubeStateChange,
        onPlaybackRateChange: handleYouTubeRateChange,
        onError: () => {
          $('#syncText').textContent = 'This YouTube video cannot be embedded';
          showToast('YouTube could not play that video here. It may be private or have embedding disabled.');
        },
        onAutoplayBlocked: () => {
          if (!isAdmin()) {
            state.localPlaybackGestureRequired = true;
            renderJoinPlaybackButton();
          }
        },
      },
    });
  }).catch(() => {
    state.youtubeLoadingId = '';
    $('#syncText').textContent = 'YouTube player unavailable';
    showToast('Could not load the YouTube player. Check your connection and try again.');
  });
}

function send(payload) {
  if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
    showToast('Reconnecting to your room…');
    return false;
  }
  state.socket.send(JSON.stringify(payload));
  return true;
}

function setConnection(status, text) {
  const indicator = $('#connectionIndicator');
  indicator.classList.toggle('offline', status === 'offline');
  indicator.classList.toggle('connecting', status === 'connecting');
  $('#connectionText').textContent = text;
  state.connected = status === 'online';
}

function connect() {
  clearTimeout(state.reconnectTimer);
  setConnection('connecting', 'Connecting');
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${location.host}/ws`);
  state.socket = socket;

  socket.addEventListener('open', () => {
    state.reconnectAttempt = 0;
    setConnection('online', 'Connected');
    if (state.roomCode) send({ type: 'join', room: state.roomCode, name: state.userName });
    else send({ type: 'create', name: state.userName });
    beginClockPings();
  });
  socket.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    handleMessage(message);
  });
  socket.addEventListener('close', () => {
    if (socket !== state.socket) return;
    setConnection('offline', 'Reconnecting');
    clearInterval(state.pingTimer);
    const delay = Math.min(1000 * (2 ** state.reconnectAttempt), 12_000);
    state.reconnectAttempt += 1;
    state.reconnectTimer = setTimeout(connect, delay);
  });
  socket.addEventListener('error', () => setConnection('offline', 'Reconnecting'));
}

function beginClockPings() {
  clearInterval(state.pingTimer);
  clearInterval(state.syncTimer);
  const ping = () => {
    if (state.socket?.readyState === WebSocket.OPEN) send({ type: 'ping', clientSentAt: Date.now() });
  };
  ping();
  state.pingTimer = setInterval(ping, 5000);
  state.syncTimer = setInterval(() => {
    if (state.nowPlaying && state.playback.playing) syncPlayer(false);
  }, 2000);
}

function recordLatency(message) {
  if (message.type !== 'playback' || !message.serverReceivedAt) return;
  const observed = Date.now() + state.syncOffsetMs - message.serverReceivedAt;
  if (observed < -250 || observed > 10_000) return;
  state.latencySamples.push(Math.max(0, observed));
  state.latencySamples = state.latencySamples.slice(-100);
  if (state.latencySamples.length < 3) return;
  const sorted = [...state.latencySamples].sort((a, b) => a - b);
  const p95 = sorted[Math.ceil(sorted.length * .95) - 1];
  $('#latencyPill').hidden = false;
  $('#latencyPill').textContent = `p95 ${Math.round(p95)} ms`;
  $('#latencyPill').title = `Estimated room event delivery over the last ${sorted.length} messages`;
}

function handleMessage(message) {
  if (message.type === 'pong') {
    const receivedAt = Date.now();
    const sentAt = Number(message.clientSentAt) || receivedAt;
    state.syncOffsetMs = Number(message.serverNow) - ((sentAt + receivedAt) / 2);
    return;
  }
  recordLatency(message);
  switch (message.type) {
    case 'snapshot':
      applySnapshot(message.room, message.serverNow, message.selfId);
      break;
    case 'participants':
      state.participants = message.participants || [];
      state.adminId = message.adminId || null;
      if (!isAdmin()) state.pollFormOpen = false;
      renderPeople();
      renderQueue();
      renderMovies();
      renderPoll();
      renderReadyCheck();
      break;
    case 'queue':
      state.queue = message.queue || [];
      state.nowPlaying = message.nowPlaying || null;
      state.playback = { rate: 1, ...state.playback, ...(message.playback || {}) };
      renderQueue();
      renderNowPlaying();
      renderReadyCheck();
      if (state.nowPlaying) syncPlayer(true);
      else clearPlayer();
      if (message.action === 'added') showToast(`${message.actorName || 'Someone'} added “${message.queue?.find((item) => item.id === message.itemId)?.title || 'a video'}” to the playlist.`);
      break;
    case 'playback':
      state.playback = { ...state.playback, ...(message.playback || {}), rate: Number(message.playback?.rate) || 1 };
      renderSyncStatus();
      renderReadyCheck();
      syncPlayer(false);
      break;
    case 'countdown':
      state.countdown = message.countdown || null;
      clearInterval(state.countdownTimer);
      state.countdownTimer = state.countdown ? setInterval(renderReadyCheck, 200) : null;
      renderReadyCheck();
      break;
    case 'chat':
      if (message.message) state.chat = [...state.chat, message.message].slice(-80);
      renderChat(true);
      break;
    case 'reaction':
      showReaction(message.reaction);
      break;
    case 'poll':
      state.poll = message.poll || null;
      renderPoll();
      break;
    case 'error':
      {
        const wasJoiningFromPrompt = Boolean(state.pendingRoomCode);
        if (wasJoiningFromPrompt) {
          state.roomCode = state.previousRoomCode;
          if (state.roomCode) setRoomUrl(state.roomCode); else clearRoomUrl();
          state.pendingRoomCode = '';
          state.previousRoomCode = '';
        }
        showToast(message.message || 'Something went wrong.');
        if (message.code === 'ROOM_NOT_FOUND' && !wasJoiningFromPrompt) {
          state.roomCode = '';
          clearRoomUrl();
          send({ type: 'create', name: state.userName });
        }
      }
      break;
    default:
      break;
  }
}

function applySnapshot(room, serverNow, selfId) {
  if (!room) return;
  state.roomCode = room.code;
  state.userId = selfId || state.userId;
  state.participants = room.participants || [];
  state.pendingRoomCode = '';
  state.previousRoomCode = '';
  state.adminId = room.adminId || null;
  state.queue = room.queue || [];
  state.nowPlaying = room.nowPlaying || null;
  state.playback = { rate: 1, ...state.playback, ...(room.playback || {}) };
  state.chat = room.chat || [];
  state.poll = room.poll || null;
  state.countdown = room.countdown || null;
  if (Number.isFinite(serverNow)) state.syncOffsetMs = serverNow - Date.now();
  setRoomUrl(room.code);
  $('#roomCode').textContent = room.code;
  renderPeople();
  renderQueue();
  renderMovies();
  renderChat(false);
  renderPoll();
  clearInterval(state.countdownTimer);
  state.countdownTimer = state.countdown ? setInterval(renderReadyCheck, 200) : null;
  renderReadyCheck();
  renderNowPlaying();
  if (state.nowPlaying) syncPlayer(true);
  else clearPlayer();
  renderSyncStatus();
  $('#editNameButton').textContent = initials(state.userName);
}

function setRoomUrl(code) {
  const url = new URL(location.href);
  url.searchParams.set('room', code);
  history.replaceState({}, '', url);
}

function clearRoomUrl() {
  const url = new URL(location.href);
  url.searchParams.delete('room');
  history.replaceState({}, '', url);
}

function initials(name) {
  return String(name || 'G').split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase();
}

function avatarClass(index) { return `avatar-${Math.max(index, 0) % 4}`; }

function renderPeople() {
  const people = state.participants;
  const admin = people.find((person) => person.id === state.adminId);
  $('#peopleCount').textContent = String(people.length);
  $('#viewerCount').textContent = `${people.length} watching`;
  $('#participantsButtonCount').textContent = String(people.length);
  $('#hostName').textContent = admin ? (admin.id === state.userId ? 'You’re in control' : `${admin.name} is admin`) : 'No admin yet';
  const list = $('#peopleList');
  list.replaceChildren();
  people.forEach((person, index) => {
    const row = document.createElement('li');
    row.className = 'person-row';
    const avatar = document.createElement('span');
    avatar.className = `person-avatar ${avatarClass(index)}`;
    avatar.textContent = initials(person.name);
    const details = document.createElement('span');
    details.className = 'person-details';
    const name = document.createElement('span');
    name.className = 'person-name';
    name.textContent = person.id === state.userId ? `${person.name} (you)` : person.name;
    const caption = document.createElement('span');
    caption.className = 'person-caption';
    const readyLabel = person.ready ? 'Ready' : 'Not ready';
    caption.textContent = person.id === state.adminId ? `Room admin · ${readyLabel}` : (person.ready ? 'Ready to watch' : 'Waiting to watch');
    details.append(name, caption);
    row.append(avatar, details);
    if (person.id === state.adminId) {
      const tag = document.createElement('span');
      tag.className = 'host-tag';
      tag.textContent = 'ADMIN';
      row.append(tag);
    } else if (isAdmin()) {
      const transfer = document.createElement('button');
      transfer.className = 'transfer-button';
      transfer.type = 'button';
      transfer.dataset.transferAdmin = person.id;
      transfer.textContent = 'Make admin';
      row.append(transfer);
    }
    list.append(row);
  });
  if (!people.length) {
    const item = document.createElement('li');
    item.className = 'person-caption';
    item.textContent = 'Waiting for friends to join';
    list.append(item);
  }

  const control = $('#adminControl');
  control.replaceChildren();
  const note = document.createElement('p');
  note.className = 'admin-control-note';
  const action = document.createElement('button');
  action.type = 'button';
  action.className = 'admin-claim-button';
  if (!admin) {
    note.textContent = 'No admin assigned. Claim control when your group is ready.';
    action.dataset.claimAdmin = 'true';
    action.textContent = 'Take admin control';
    control.append(note, action);
  } else if (isAdmin()) {
    note.textContent = 'You control playback and group polls.';
    control.append(note);
  } else {
    note.textContent = `${admin.name} controls playback and group polls.`;
    control.append(note);
  }
  video.controls = false;
  video.setAttribute('aria-label', isAdmin() ? 'Shared video player. Admin playback controls.' : 'Shared video player. Playback is controlled by the room admin.');
  renderYouTubeControls();
  renderJoinPlaybackButton();
}

function renderReadyCheck() {
  const readyCount = state.participants.filter((person) => person.ready).length;
  const total = state.participants.length;
  const everyoneReady = total > 0 && readyCount === total;
  const canJoinCheck = Boolean(state.nowPlaying && !state.playback.playing);
  const self = state.participants.find((person) => person.id === state.userId);
  const readyButton = $('#readyToggleButton');
  readyButton.disabled = !canJoinCheck || !self;
  readyButton.textContent = self?.ready ? 'Ready ✓ · tap to undo' : "I'm ready";

  const status = $('#readyCheckStatus');
  if (state.countdown) status.textContent = 'Stay here — playback is starting for everyone.';
  else if (!state.nowPlaying) status.textContent = 'Choose a video to start the ready check.';
  else if (state.playback.playing) status.textContent = 'Pause the video to start a fresh ready check.';
  else if (everyoneReady && isAdmin()) status.textContent = 'Everyone’s ready. Start the 5-second countdown when you are.';
  else if (everyoneReady) {
    const admin = state.participants.find((person) => person.id === state.adminId);
    status.textContent = admin ? `Everyone’s ready. ${admin.name} can start the 5-second countdown.` : 'Everyone’s ready. Someone can claim admin control to start the countdown.';
  }
  else status.textContent = `${readyCount} of ${total} ready · waiting for the rest of the room.`;

  const start = $('#countdownStartButton');
  start.hidden = !isAdmin() || Boolean(state.countdown);
  start.disabled = !canJoinCheck || !everyoneReady;
  const cancel = $('#countdownCancelButton');
  cancel.hidden = !state.countdown || !isAdmin();
  const display = $('#countdownDisplay');
  display.hidden = !state.countdown;
  if (state.countdown) {
    const remaining = Math.max(0, Math.ceil((state.countdown.startsAt - (Date.now() + state.syncOffsetMs)) / 1000));
    $('#countdownNumber').textContent = remaining > 0 ? String(remaining) : 'GO';
  }
}

function renderQueue() {
  const list = $('#queueList');
  list.replaceChildren();
  $('#queueCount').textContent = String(state.queue.length);
  $('#queueEmpty').hidden = state.queue.length > 0;
  state.queue.forEach((item, index) => {
    const row = document.createElement('li');
    row.className = `queue-item${state.nowPlaying?.id === item.id ? ' current' : ''}`;
    const number = document.createElement('span');
    number.className = 'queue-number';
    number.textContent = state.nowPlaying?.id === item.id ? '▶' : String(index + 1).padStart(2, '0');
    const copy = document.createElement('button');
    copy.className = 'queue-item-copy';
    copy.type = 'button';
    copy.dataset.queuePlay = item.id;
    copy.disabled = !isAdmin();
    copy.title = isAdmin() ? 'Play this title' : 'The room admin controls playback';
    const title = document.createElement('span');
    title.className = 'queue-item-title';
    title.textContent = item.title;
    const meta = document.createElement('span');
    meta.className = 'queue-item-meta';
    meta.textContent = `${item.genre || 'Shared link'} · ${item.voteCount || 0} ${(item.voteCount || 0) === 1 ? 'vote' : 'votes'}${state.nowPlaying?.id === item.id ? ' · Playing' : ''}`;
    copy.append(title, meta);
    const vote = document.createElement('button');
    vote.className = `queue-vote${item.myVote ? ' voted' : ''}`;
    vote.type = 'button';
    vote.dataset.queueVote = item.id;
    vote.disabled = state.nowPlaying?.id === item.id;
    vote.setAttribute('aria-label', item.myVote ? `Remove your vote from ${item.title}` : `Vote for ${item.title} to play next`);
    vote.title = item.myVote ? 'Remove your vote' : 'Vote to play next';
    vote.textContent = `▲ ${item.voteCount || 0}`;
    const remove = document.createElement('button');
    remove.className = 'queue-remove';
    remove.type = 'button';
    remove.dataset.queueRemove = item.id;
    remove.setAttribute('aria-label', `Remove ${item.title} from playlist`);
    remove.textContent = '×';
    remove.disabled = !isAdmin();
    row.append(number, copy, vote, remove);
    list.append(row);
  });
}

function renderNowPlaying() {
  $('#nowPlayingTitle').textContent = state.nowPlaying?.title || 'Nothing queued up yet';
  $('#emptyPlayer').hidden = Boolean(state.nowPlaying);
  $('#playerFrame').classList.toggle('is-empty', !state.nowPlaying);
}

function renderSyncStatus() {
  const text = $('#syncText');
  const icon = $('.sync-icon');
  if (!state.nowPlaying) {
    text.textContent = 'Waiting for a film';
    icon.textContent = '⟳';
    return;
  }
  text.textContent = state.playback.playing ? 'Playing in sync' : 'Paused for everyone';
  icon.textContent = state.playback.playing ? '◉' : 'Ⅱ';
}

function setRemoteSuppression() {
  state.suppressPlayerEvents = true;
  clearTimeout(state.suppressTimer);
  state.suppressTimer = setTimeout(() => { state.suppressPlayerEvents = false; }, 500);
}

function clearPlayerSuppression() {
  state.suppressPlayerEvents = false;
  clearTimeout(state.suppressTimer);
  state.youtubeRemoteCommandUntil = 0;
}

function targetPlaybackTime() {
  const elapsed = state.playback.playing
    ? ((Date.now() + state.syncOffsetMs - state.playback.updatedAt) / 1000) * (Number(state.playback.rate) || 1)
    : 0;
  return Math.max(0, state.playback.currentTime + elapsed);
}

function syncPlayer(force) {
  if (!state.nowPlaying) return;
  const item = state.nowPlaying;
  const src = item.src;
  const youtubeId = getYouTubeVideoId(src);
  if (!state.playback.playing) {
    state.localPlaybackGestureRequired = false;
    renderJoinPlaybackButton();
  }
  if (youtubeId) {
    state.currentSource = src;
    video.hidden = true;
    video.controls = false;
    if (!video.paused) {
      setRemoteSuppression();
      video.pause();
    }
    $('#youtubePlayerFrame').hidden = false;
    ensureYouTubePlayer(youtubeId);
    if (!state.youtubeReady || state.youtubeVideoId !== youtubeId) {
      renderNowPlaying();
      renderSyncStatus();
      return;
    }

    const player = state.youtubePlayer;
    const target = targetPlaybackTime();
    let current = 0;
    let duration = 0;
    let playerState = -1;
    try {
      current = player.getCurrentTime() || 0;
      duration = player.getDuration() || 0;
      playerState = player.getPlayerState();
    } catch { return; }

    const boundedTarget = duration > 0 ? Math.min(target, Math.max(0, duration - .25)) : target;
    const drift = boundedTarget - current;
    const shouldSeek = Math.abs(drift) > .5 || (force && Math.abs(drift) > .1);
    const shouldPlay = state.playback.playing;
    const isPlaying = playerState === window.YT.PlayerState.PLAYING || playerState === window.YT.PlayerState.BUFFERING;
    const isPaused = playerState === window.YT.PlayerState.PAUSED || playerState === window.YT.PlayerState.CUED || playerState === window.YT.PlayerState.UNSTARTED;
    if (shouldSeek || shouldPlay && isPaused || !shouldPlay && isPlaying) {
      state.youtubeRemoteCommandUntil = Date.now() + 1500;
      setRemoteSuppression();
      if (shouldSeek) player.seekTo(boundedTarget, true);
      if (shouldPlay && isPaused) player.playVideo();
      else if (!shouldPlay && isPlaying) player.pauseVideo();
    }
    try {
      const desiredRate = Number(state.playback.rate) || 1;
      const rates = player.getAvailablePlaybackRates();
      const targetRate = rates?.length
        ? rates.reduce((closest, rate) => Math.abs(rate - desiredRate) < Math.abs(closest - desiredRate) ? rate : closest, rates[0])
        : desiredRate;
      if (Math.abs((player.getPlaybackRate() || 1) - targetRate) > .01) {
        state.youtubeRemoteCommandUntil = Date.now() + 1800;
        player.setPlaybackRate(targetRate);
      }
    } catch { /* The player can be between cue and ready states. */ }
    renderYouTubeControls();
    renderSyncStatus();
    return;
  }

  $('#youtubePlayerFrame').hidden = true;
  $('#youtubeControls').hidden = true;
  if (state.youtubePlayer && state.youtubeReady) {
    try {
      if (state.youtubePlayer.getPlayerState() !== window.YT.PlayerState.PAUSED) {
        state.youtubeRemoteCommandUntil = Date.now() + 1000;
        state.youtubePlayer.pauseVideo();
      }
    } catch { /* Ignore an iframe while it is changing sources. */ }
  }
  video.hidden = false;
  video.controls = false;
  if (src && src !== state.currentSource) {
    state.currentSource = src;
    video.src = src;
    video.load();
    video.addEventListener('loadedmetadata', () => { applyLocalVolume(); syncPlayer(true); renderYouTubeControls(); }, { once: true });
    renderNowPlaying();
    return;
  }
  if (video.readyState < 1 || !Number.isFinite(video.duration) && video.duration !== Infinity) {
    renderSyncStatus();
    return;
  }

  const target = targetPlaybackTime();
  const current = Number.isFinite(video.currentTime) ? video.currentTime : 0;
  const drift = target - current;
  setRemoteSuppression();
  if (Math.abs(drift) > .5 || force && Math.abs(drift) > .1) {
    try { video.currentTime = target; } catch { /* The stream may not have seek data yet. */ }
    video.playbackRate = Number(state.playback.rate) || 1;
  } else if (state.playback.playing && Math.abs(drift) > .12) {
    video.playbackRate = (Number(state.playback.rate) || 1) * (drift > 0 ? 1.04 : .96);
    clearTimeout(state.playbackRateTimer);
    state.playbackRateTimer = setTimeout(() => { video.playbackRate = Number(state.playback.rate) || 1; }, 2200);
  } else {
    video.playbackRate = Number(state.playback.rate) || 1;
  }

  if (state.playback.playing) {
    if (video.paused) {
      video.play().catch(() => {
        $('#syncText').textContent = 'Tap play to join the stream';
        if (!isAdmin()) {
          state.localPlaybackGestureRequired = true;
          renderJoinPlaybackButton();
        }
      });
    }
  } else if (!video.paused) {
    video.pause();
  }
  renderSyncStatus();
  renderYouTubeControls();
}

function clearPlayer() {
  state.currentSource = '';
  setRemoteSuppression();
  $('#youtubePlayerFrame').hidden = true;
  $('#youtubeControls').hidden = true;
  if (state.youtubePlayer && state.youtubeReady) {
    try { state.youtubePlayer.pauseVideo(); } catch { /* Ignore an iframe still initializing. */ }
  }
  video.hidden = false;
  video.pause();
  video.removeAttribute('src');
  video.load();
  renderNowPlaying();
  renderSyncStatus();
}

video.addEventListener('play', () => {
  if (!state.suppressPlayerEvents && isAdmin() && state.nowPlaying && !getYouTubeVideoId(state.nowPlaying.src)) {
    send({ type: 'playback', playing: true, currentTime: video.currentTime, rate: video.playbackRate });
  }
});
video.addEventListener('pause', () => {
  if (!state.suppressPlayerEvents && isAdmin() && state.nowPlaying && !getYouTubeVideoId(state.nowPlaying.src) && !video.ended) {
    send({ type: 'playback', playing: false, currentTime: video.currentTime, rate: video.playbackRate });
  }
});
video.addEventListener('seeked', () => {
  if (!state.suppressPlayerEvents && isAdmin() && state.nowPlaying && !getYouTubeVideoId(state.nowPlaying.src)) {
    send({ type: 'playback', playing: !video.paused, currentTime: video.currentTime, rate: video.playbackRate });
  }
});
video.addEventListener('error', () => {
  if (state.nowPlaying) {
    $('#syncText').textContent = 'This video could not load';
    showToast('This video URL could not be played by the browser. Use a direct MP4/WebM URL or an embeddable YouTube link.');
  }
});

function renderFilters() {
  const root = $('#genreFilters');
  root.replaceChildren();
  genres.forEach((genre) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `filter-chip${state.selectedGenre === genre ? ' active' : ''}`;
    chip.dataset.genre = genre;
    chip.textContent = genre;
    root.append(chip);
  });
}

function editDistance(left, right) {
  if (Math.abs(left.length - right.length) > 3) return 99;
  let prior = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const next = [row];
    for (let column = 1; column <= right.length; column += 1) {
      next[column] = Math.min(next[column - 1] + 1, prior[column] + 1, prior[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1));
    }
    prior = next;
  }
  return prior[right.length];
}

function fuzzyMatch(movie, query) {
  const normalized = query.toLowerCase().trim().replace(/[^\p{L}\p{N}\s]/gu, ' ');
  if (!normalized) return 1;
  const haystack = `${movie.title} ${movie.genre} ${movie.description}`.toLowerCase();
  if (haystack.includes(normalized)) return 10;
  const words = haystack.split(/\s+/).filter(Boolean);
  const terms = normalized.split(/\s+/).filter(Boolean);
  let score = 0;
  for (const term of terms) {
    if (term.length < 3) {
      if (!words.some((word) => word.startsWith(term))) return 0;
      score += 1;
      continue;
    }
    const distance = Math.min(...words.map((word) => editDistance(term, word)));
    if (distance > Math.max(1, Math.floor(term.length * .25))) return 0;
    score += 3 - distance;
  }
  return score;
}

function makeMovieCard(movie) {
  const article = document.createElement('article');
  article.className = 'movie-card';
  const art = document.createElement('div');
  art.className = `movie-art art-${movie.theme || 'escape'}`;
  if (movie.poster) {
    const poster = document.createElement('img');
    poster.className = 'movie-thumbnail';
    poster.src = movie.poster;
    poster.alt = '';
    poster.loading = 'lazy';
    poster.referrerPolicy = 'no-referrer';
    art.append(poster);
  }
  const label = document.createElement('div');
  label.className = 'movie-art-label';
  const kicker = document.createElement('span');
  kicker.className = 'cover-kicker';
  kicker.textContent = `${movie.year || 'ROOM PICK'} · ${movie.genre || 'Shared link'}`;
  const title = document.createElement('span');
  title.className = 'cover-title';
  title.textContent = movie.title;
  label.append(kicker, title);
  art.append(label);
  const body = document.createElement('div');
  body.className = 'movie-card-body';
  const meta = document.createElement('div');
  meta.className = 'movie-meta';
  const genre = document.createElement('span');
  genre.textContent = movie.genre || 'Shared link';
  const category = document.createElement('span');
  category.textContent = 'VIDEO';
  meta.append(genre, category);
  const description = document.createElement('p');
  description.className = 'movie-description';
  description.textContent = movie.description || 'A new pick from your group.';
  const actions = document.createElement('div');
  actions.className = 'movie-card-actions';
  const watch = document.createElement('button');
  watch.type = 'button';
  watch.className = 'watch-button';
  watch.dataset.watch = movie.id;
  watch.textContent = '▶ Watch together';
  const openSource = document.createElement('a');
  openSource.className = 'open-source-link';
  openSource.href = movie.src;
  openSource.target = '_blank';
  openSource.rel = 'noopener noreferrer';
  openSource.textContent = getYouTubeVideoId(movie.src) ? 'Open on YouTube ↗' : 'Open video link ↗';
  openSource.setAttribute('aria-label', `Open ${movie.title} in a new tab`);
  const sourceRow = document.createElement('div');
  sourceRow.className = 'movie-source-row';
  sourceRow.append(openSource);
  const queue = document.createElement('button');
  queue.type = 'button';
  queue.dataset.addQueue = movie.id;
  queue.setAttribute('aria-label', `Add ${movie.title} to the playlist`);
  queue.title = 'Add to playlist';
  queue.textContent = '＋ Queue';
  const favorite = document.createElement('button');
  favorite.type = 'button';
  favorite.className = `favorite-button${state.favorites.has(movie.id) ? ' saved' : ''}`;
  favorite.dataset.favorite = movie.id;
  favorite.setAttribute('aria-label', `${state.favorites.has(movie.id) ? 'Remove' : 'Save'} ${movie.title} to favorites`);
  favorite.textContent = state.favorites.has(movie.id) ? '♥' : '♡';
  actions.append(watch, queue, favorite);
  body.append(meta, description, sourceRow, actions);
  article.append(art, body);
  return article;
}

function renderMovies() {
  const list = $('#movieGrid');
  list.replaceChildren();
  const picks = catalog.filter((movie) => {
    if (state.selectedGenre === 'Saved' && !state.favorites.has(movie.id)) return false;
    if (state.selectedGenre !== 'All picks' && state.selectedGenre !== 'Saved' && movie.genre !== state.selectedGenre) return false;
    return fuzzyMatch(movie, state.search) > 0;
  });
  if (!picks.length) {
    const empty = document.createElement('div');
    empty.className = 'no-results';
    empty.textContent = state.selectedGenre === 'Saved' ? 'Save a few picks and they’ll be waiting here.' : 'Nothing quite matches. Try another title, mood or genre.';
    list.append(empty);
    return;
  }
  picks.forEach((movie) => list.append(makeMovieCard(movie)));
}

function renderChat(scrollToBottom) {
  const list = $('#chatList');
  const wasAtBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 28;
  list.replaceChildren();
  if (!state.chat.length) {
    const empty = document.createElement('p');
    empty.className = 'chat-empty';
    empty.textContent = 'The best commentary happens here.';
    list.append(empty);
    return;
  }
  state.chat.slice(-45).forEach((entry) => {
    const row = document.createElement('div');
    row.className = `chat-message${entry.system ? ' system' : ''}`;
    if (!entry.system) {
      const avatar = document.createElement('span');
      avatar.className = `person-avatar ${avatarClass([...state.participants].findIndex((person) => person.id === entry.participantId))}`;
      avatar.textContent = initials(entry.name);
      row.append(avatar);
    }
    const body = document.createElement('div');
    body.className = 'chat-message-body';
    const head = document.createElement('div');
    head.className = 'chat-message-head';
    const name = document.createElement('strong');
    name.textContent = entry.name || 'Guest';
    const time = document.createElement('time');
    time.textContent = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(entry.at || Date.now());
    head.append(name, time);
    const text = document.createElement('p');
    text.className = 'chat-message-text';
    text.textContent = entry.text;
    body.append(head, text);
    row.append(body);
    list.append(row);
  });
  if (scrollToBottom || wasAtBottom) list.scrollTop = list.scrollHeight;
}

function renderPoll() {
  const root = $('#pollContent');
  root.replaceChildren();
  const form = $('#pollCreateForm');
  const button = $('#pollCreateButton');
  const canAdminister = isAdmin();
  if (!state.poll) {
    form.hidden = !state.pollFormOpen || !canAdminister;
    button.hidden = state.pollFormOpen && canAdminister;
    button.disabled = !canAdminister;
    button.textContent = canAdminister ? '＋ Create a group poll' : 'Admin control required for polls';
    return;
  }
  form.hidden = !state.pollFormOpen || !canAdminister;
  button.hidden = state.pollFormOpen && canAdminister;
  button.disabled = !canAdminister;
  button.textContent = canAdminister ? (state.poll.open ? '＋ New poll' : '＋ Create a group poll') : 'Admin control required for polls';
  const question = document.createElement('p');
  question.className = 'poll-question';
  question.textContent = state.poll.question;
  const choices = document.createElement('div');
  choices.className = 'poll-choice-list';
  const selected = state.poll.votes?.[state.userId];
  state.poll.options.forEach((option) => {
    const count = Object.values(state.poll.votes || {}).filter((vote) => vote === option.id).length;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `poll-choice${selected === option.id ? ' selected' : ''}`;
    item.dataset.pollVote = option.id;
    item.disabled = !state.poll.open;
    const label = document.createElement('span');
    label.className = 'poll-choice-label';
    label.textContent = option.label;
    const votes = document.createElement('span');
    votes.className = 'poll-choice-votes';
    votes.textContent = `${count} ${count === 1 ? 'vote' : 'votes'}`;
    item.append(label, votes);
    choices.append(item);
  });
  const meta = document.createElement('div');
  meta.className = 'poll-meta';
  const attribution = document.createElement('span');
  attribution.textContent = state.poll.open ? `${Object.keys(state.poll.votes || {}).length} votes · Started by ${state.poll.createdBy}` : `Poll closed · ${Object.keys(state.poll.votes || {}).length} votes`;
  meta.append(attribution);
  if (state.poll.open && canAdminister) {
    const close = document.createElement('button');
    close.type = 'button';
    close.dataset.pollClose = 'true';
    close.textContent = 'Close poll';
    meta.append(close);
  }
  root.append(question, choices, meta);
}

function showReaction(reaction) {
  if (!reaction) return;
  const pill = document.createElement('div');
  pill.className = 'floating-reaction';
  const emoji = document.createElement('span');
  emoji.textContent = reaction.emoji;
  const name = document.createElement('span');
  name.textContent = reaction.name;
  pill.append(emoji, name);
  const root = $('#reactionFloat');
  root.append(pill);
  while (root.children.length > 4) root.firstElementChild.remove();
  setTimeout(() => pill.remove(), 3500);
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  const region = $('#toastRegion');
  region.append(toast);
  setTimeout(() => toast.remove(), 3600);
}

function createNewRoom() {
  if (!state.connected) return showToast('Reconnecting to start a new room…');
  state.userId = null;
  state.roomCode = '';
  clearRoomUrl();
  send({ type: 'create', name: state.userName });
}

async function copyInvite() {
  if (!state.roomCode) return showToast('Your room is still getting ready.');
  const invite = new URL(location.href);
  invite.searchParams.set('room', state.roomCode);
  try {
    await navigator.clipboard.writeText(invite.toString());
    showToast('Invite link copied. Send it to your movie crew.');
  } catch {
    $('#inviteLinkInput').value = invite.toString();
    openDialog($('#inviteDialog'));
    $('#inviteLinkInput').focus();
    $('#inviteLinkInput').select();
  }
}

function openDialog(dialog) {
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function openRoomDialog(mode) {
  state.roomDialogMode = mode;
  const isName = mode === 'name';
  $('#roomDialogEyebrow').textContent = isName ? 'MAKE YOURSELF AT HOME' : 'COME ON IN';
  $('#roomDialogTitle').textContent = isName ? 'What should we call you?' : 'Join a watch room';
  $('#roomDialogCopy').textContent = isName ? 'Pick the name your friends will see in the room.' : 'Enter the room code your friend shared with you.';
  $('#roomInputLabel').textContent = isName ? 'Display name' : 'Room code';
  $('#roomInput').value = isName ? state.userName : '';
  $('#roomInput').maxLength = isName ? 32 : 8;
  $('#roomInput').placeholder = isName ? 'Your name' : 'ABC123';
  $('#roomInput').autocomplete = isName ? 'name' : 'off';
  $('#roomSubmitButton').innerHTML = isName ? 'Save name <span aria-hidden="true">↗</span>' : 'Join room <span aria-hidden="true">↗</span>';
  openDialog($('#roomDialog'));
  $('#roomInput').focus();
}

function pickById(id) { return catalog.find((movie) => movie.id === id) || state.queue.find((movie) => movie.id === id); }

function handleClick(event) {
  const target = event.target.closest('button, [data-scroll-discover]');
  if (!target) return;
  if (target.matches('[data-scroll-discover]')) {
    $('#discover').scrollIntoView({ behavior: 'smooth' });
    return;
  }
  if (target.dataset.genre) {
    state.selectedGenre = target.dataset.genre;
    renderFilters();
    renderMovies();
  } else if (target.dataset.watch) {
    const item = pickById(target.dataset.watch);
    if (item) send(isAdmin() ? { type: 'playMovie', item } : { type: 'queueAdd', item });
  } else if (target.dataset.addQueue) {
    const item = pickById(target.dataset.addQueue);
    if (item) send({ type: 'queueAdd', item });
  } else if (target.dataset.favorite) {
    const id = target.dataset.favorite;
    if (state.favorites.has(id)) state.favorites.delete(id); else state.favorites.add(id);
    local.set('vinnotube-favorites', JSON.stringify([...state.favorites]));
    renderMovies();
  } else if (target.dataset.queuePlay) {
    send({ type: 'queuePlay', id: target.dataset.queuePlay });
  } else if (target.dataset.queueRemove) {
    send({ type: 'queueRemove', id: target.dataset.queueRemove });
  } else if (target.dataset.queueVote) {
    send({ type: 'queueVote', id: target.dataset.queueVote });
  } else if (target.hasAttribute('data-ready-toggle')) {
    const self = state.participants.find((person) => person.id === state.userId);
    if (self) send({ type: 'readySet', ready: !self.ready });
  } else if (target.hasAttribute('data-countdown-start')) {
    send({ type: 'countdownStart' });
  } else if (target.hasAttribute('data-countdown-cancel')) {
    send({ type: 'countdownCancel' });
  } else if (target.dataset.reaction) {
    send({ type: 'reaction', emoji: target.dataset.reaction });
  } else if (target.dataset.claimAdmin) {
    send({ type: 'claimAdmin' });
  } else if (target.dataset.transferAdmin) {
    send({ type: 'transferAdmin', participantId: target.dataset.transferAdmin });
  } else if (target.dataset.pollVote) {
    send({ type: 'pollVote', optionId: target.dataset.pollVote });
  } else if (target.hasAttribute('data-poll-close')) {
    send({ type: 'pollClose' });
  }
}

document.addEventListener('click', handleClick);
$('#movieSearch').addEventListener('input', (event) => {
  state.search = event.target.value;
  renderMovies();
});
$('#chatForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = $('#chatInput');
  const text = input.value.trim();
  if (text && send({ type: 'chat', text })) input.value = '';
});
$('#inviteButton').addEventListener('click', copyInvite);
$('#inviteInlineButton').addEventListener('click', copyInvite);
$('#participantsButton').addEventListener('click', () => {
  const card = $('#peopleCard');
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.remove('is-highlighted');
  requestAnimationFrame(() => card.classList.add('is-highlighted'));
  setTimeout(() => card.classList.remove('is-highlighted'), 1400);
});
$('#newRoomButton').addEventListener('click', createNewRoom);
$('#joinRoomButton').addEventListener('click', () => openRoomDialog('join'));
$('#editNameButton').addEventListener('click', () => openRoomDialog('name'));
$('#roomForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const value = $('#roomInput').value.trim();
  if (state.roomDialogMode === 'name') {
    if (!value) return showToast('Enter a display name.');
    state.userName = value.slice(0, 32);
    local.set('vinnotube-name', state.userName);
    $('#editNameButton').textContent = initials(state.userName);
    if (state.connected) send({ type: 'rename', name: state.userName });
    $('#roomDialog').close?.();
    return;
  }
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  if (!normalized) return showToast('Enter a room code to join.');
  if (!state.connected) return showToast('Reconnecting to join that room…');
  state.pendingRoomCode = normalized;
  state.previousRoomCode = state.roomCode;
  if (send({ type: 'join', room: normalized, name: state.userName })) $('#roomDialog').close?.();
});
$('#inviteCopyButton').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('#inviteLinkInput').value);
    $('#inviteDialog').close?.();
    showToast('Invite link copied. Send it to your movie crew.');
  } catch {
    $('#inviteLinkInput').focus();
    $('#inviteLinkInput').select();
    showToast('The link is selected. Copy it and send it to your friends.');
  }
});

const videoDialog = $('#videoDialog');
function openVideoDialog() {
  openDialog(videoDialog);
  $('#videoTitleInput').focus();
}
$('#addVideoButton').addEventListener('click', openVideoDialog);
$('#queueAddButton').addEventListener('click', openVideoDialog);
$('#videoForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const title = $('#videoTitleInput').value.trim().slice(0, 100);
  const src = $('#videoUrlInput').value.trim();
  try {
    const parsed = new URL(src);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocol');
  } catch {
    return showToast('Use a valid http or https video link.');
  }
  const item = {
    id: `custom-${crypto.randomUUID()}`,
    title,
    src,
    genre: 'Shared link',
    year: 'ROOM PICK',
    description: 'A new pick from your group.',
    theme: 'escape',
  };
  const accepted = send(isAdmin() ? { type: 'playMovie', item } : { type: 'queueAdd', item });
  if (!accepted) return;
  videoDialog.close?.();
  $('#videoForm').reset();
  showToast(isAdmin()
    ? `“${title}” is loaded in the room player. Press play when everyone is ready.`
    : `“${title}” was added to the playlist. An admin can start it when ready.`);
});

$('#youtubePlayButton').addEventListener('click', () => {
  if (!isAdmin()) return;
  if (state.nowPlaying && getYouTubeVideoId(state.nowPlaying.src)) {
    if (!state.youtubeReady || !state.youtubePlayer) return;
    clearPlayerSuppression();
    if (state.youtubePlayer.getPlayerState() === window.YT.PlayerState.PLAYING) state.youtubePlayer.pauseVideo();
    else state.youtubePlayer.playVideo();
  } else if (video.paused) video.play().catch(() => showToast('The video could not start. Check that the link is playable.'));
  else video.pause();
});
$('#joinPlaybackButton').addEventListener('click', () => {
  if (!state.playback.playing) return;
  state.localPlaybackGestureRequired = false;
  renderJoinPlaybackButton();
  setRemoteSuppression();
  if (getYouTubeVideoId(state.nowPlaying?.src)) {
    if (!state.youtubePlayer || !state.youtubeReady) return;
    state.youtubeRemoteCommandUntil = Date.now() + 1500;
    state.youtubePlayer.seekTo(targetPlaybackTime(), true);
    state.youtubePlayer.playVideo();
    return;
  }
  try { video.currentTime = targetPlaybackTime(); } catch { /* Wait for the stream metadata. */ }
  video.play().catch(() => {
    state.localPlaybackGestureRequired = true;
    renderJoinPlaybackButton();
  });
});
$('#youtubeSeek').addEventListener('change', (event) => {
  if (!isAdmin() || !state.nowPlaying) return;
  const currentTime = Math.max(0, Number(event.currentTarget.value) || 0);
  if (getYouTubeVideoId(state.nowPlaying.src)) {
    if (!state.youtubeReady || !state.youtubePlayer) return;
    state.youtubeRemoteCommandUntil = Date.now() + 1500;
    setRemoteSuppression();
    state.youtubePlayer.seekTo(currentTime, true);
    send({ type: 'playback', playing: state.youtubePlayer.getPlayerState() === window.YT.PlayerState.PLAYING, currentTime, rate: Number(state.playback.rate) || 1 });
  } else {
    try { video.currentTime = currentTime; } catch { return; }
    send({ type: 'playback', playing: !video.paused, currentTime, rate: Number(state.playback.rate) || 1 });
  }
});

$('#playbackRateSelect').addEventListener('change', (event) => {
  if (!isAdmin() || !state.nowPlaying) return;
  const rate = Number(event.currentTarget.value);
  if (!PLAYBACK_RATES.includes(rate)) return;
  if (getYouTubeVideoId(state.nowPlaying.src)) {
    if (!state.youtubeReady || !state.youtubePlayer) return;
    state.youtubeRemoteCommandUntil = Date.now() + 1800;
    setRemoteSuppression();
    state.youtubePlayer.setPlaybackRate(rate);
    send({ type: 'playback', playing: state.youtubePlayer.getPlayerState() === window.YT.PlayerState.PLAYING, currentTime: state.youtubePlayer.getCurrentTime() || 0, rate });
  } else {
    video.playbackRate = rate;
    send({ type: 'playback', playing: !video.paused, currentTime: video.currentTime || 0, rate });
  }
});

$('#volumeRange').addEventListener('input', (event) => setLocalVolume(event.currentTarget.value));
$('#muteButton').addEventListener('click', () => {
  state.muted = !(state.muted || state.volume === 0);
  local.set('vinnotube-muted', String(state.muted));
  applyLocalVolume();
  renderYouTubeControls();
});

video.addEventListener('timeupdate', renderYouTubeControls);

$('#pollCreateButton').addEventListener('click', () => {
  state.pollFormOpen = true;
  renderPoll();
  $('#pollQuestion').focus();
});
$('#pollCreateForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const question = $('#pollQuestion').value.trim();
  const options = $$('.poll-option-input').map((input) => input.value.trim()).filter(Boolean);
  if (options.length < 2) return showToast('Add at least two poll choices.');
  if (send({ type: 'pollCreate', question, options })) {
    $('#pollCreateForm').reset();
    state.pollFormOpen = false;
  }
});

window.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    $('#movieSearch').focus();
    $('#discover').scrollIntoView({ behavior: 'smooth' });
  }
  if (event.key === 'Escape') {
    for (const dialog of [videoDialog, $('#roomDialog'), $('#inviteDialog')]) {
      if (dialog.open) dialog.close();
    }
  }
});

renderFilters();
renderMovies();
renderPeople();
renderQueue();
renderChat(false);
renderPoll();
renderReadyCheck();
$('#editNameButton').textContent = initials(state.userName);
connect();
