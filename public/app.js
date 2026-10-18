/* ---- Intro splash: ~5 s branded loading screen on every page open ----
   Runs first, before the rest of the app starts up. The room connection keeps loading behind it.
   Timeline: SPLASH_MS in total = loading (fills the logo) then a short iris-out reveal. */
(() => {
  const SPLASH_MS = 5000;
  const EXIT_MS = 600;
  const LOAD_MS = SPLASH_MS - EXIT_MS;
  const root = document.getElementById('splash');
  if (!root) return;
  const ring = document.getElementById('splashRing');
  const percent = document.getElementById('splashPercent');
  const tagline = document.getElementById('splashTagline');
  const canvas = document.getElementById('splashCanvas');
  const lines = ['Dimming the lights', 'Gathering your crew', 'Syncing the room', 'Rolling the film'];
  const RING_LENGTH = 339.3;
  const startedAt = performance.now();
  let frame = 0;
  let leaving = false;
  let lineIndex = 0;
  let lastPercent = -1;
  let stopEmbers = () => {};

  // Floating embers: small glowing sparks drifting upward and swaying.
  function startEmbers() {
    const ctx = canvas?.getContext?.('2d');
    if (!ctx || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
    const colors = ['255,61,74', '255,138,31', '255,45,111', '255,255,255'];
    let width = 0;
    let height = 0;
    let running = true;
    let raf = 0;
    let last = performance.now();
    const embers = [];
    const spawn = (anywhere) => ({
      x: Math.random() * width,
      y: anywhere ? Math.random() * height : height + 10,
      r: 0.8 + Math.random() * 2.4,
      speed: 18 + Math.random() * 46,
      sway: 0.6 + Math.random() * 1.6,
      phase: Math.random() * Math.PI * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 0.35 + Math.random() * 0.55,
    });
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = width < 700 ? 36 : 72;
      while (embers.length < target) embers.push(spawn(true));
      embers.length = target;
    };
    const tick = (now) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < embers.length; i += 1) {
        const e = embers[i];
        e.y -= e.speed * dt;
        e.phase += e.sway * dt;
        e.x += Math.sin(e.phase) * 14 * dt;
        if (e.y < -10) embers[i] = spawn(false);
        const fade = Math.min(1, Math.max(0, e.y / (height * 0.35)));
        ctx.fillStyle = `rgba(${e.color},${(e.alpha * 0.16 * fade).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 3.2, 0, 6.2832); ctx.fill();
        ctx.fillStyle = `rgba(${e.color},${(e.alpha * fade).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 6.2832); ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }

  function paint(t) {
    // Gentle ease: a little slower at the very start and end, never stalls.
    const p = 0.3 * t + 0.7 * (0.5 - 0.5 * Math.cos(Math.PI * t));
    root.style.setProperty('--p', p.toFixed(4));
    root.style.setProperty('--scan', p > 0.015 && p < 0.995 ? '1' : '0');
    ring.style.strokeDashoffset = String(RING_LENGTH * (1 - p));
    const shown = Math.round(p * 100);
    if (shown !== lastPercent) { lastPercent = shown; percent.textContent = String(shown); }
    const nextLine = Math.min(lines.length - 1, Math.floor(t * lines.length));
    if (nextLine !== lineIndex) {
      lineIndex = nextLine;
      tagline.textContent = lines[lineIndex];
      tagline.classList.remove('swap');
      void tagline.offsetWidth; // restart the little fade-up
      tagline.classList.add('swap');
    }
  }

  function loop(now) {
    const t = Math.min(1, (now - startedAt) / LOAD_MS);
    paint(t);
    if (t < 1 && !leaving) frame = requestAnimationFrame(loop);
    else leave();
  }

  function leave(skipped) {
    if (leaving) return;
    leaving = true;
    cancelAnimationFrame(frame);
    if (!skipped) paint(1);
    root.classList.add('is-leaving');
    document.documentElement.classList.remove('intro-hold');
    document.documentElement.classList.add('intro-play');
    setTimeout(() => { stopEmbers(); root.remove(); }, EXIT_MS + 60);
  }

  stopEmbers = startEmbers();
  frame = requestAnimationFrame(loop);
  // Browsers pause animation frames in background tabs, so a plain timer guarantees the intro ends.
  setTimeout(() => leave(), SPLASH_MS);
  document.getElementById('splashSkip')?.addEventListener('click', () => leave(true));
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !leaving) leave(true); });
})();

const catalog = [
  {
    id: 'sintel', title: 'Sintel', year: '2010', genre: 'Fantasy',
    description: 'A lone warrior searches the wilds for the dragon she lost.',
    src: 'https://www.youtube.com/watch?v=eRsGyueVLvQ', poster: 'https://i.ytimg.com/vi/eRsGyueVLvQ/hqdefault.jpg', theme: 'tears',
  },
  {
    id: 'tears-of-steel', title: 'Tears of Steel', year: '2012', genre: 'Sci-Fi',
    description: 'Amsterdam, robots, and one last chance to fix the past.',
    src: 'https://www.youtube.com/watch?v=R6MlUcmOul8', poster: 'https://i.ytimg.com/vi/R6MlUcmOul8/hqdefault.jpg', theme: 'escape',
  },
  {
    id: 'big-buck-bunny', title: 'Big Buck Bunny', year: '2008', genre: 'Animation',
    description: 'A gentle giant rabbit gets even with three troublemaking rodents.',
    src: 'https://www.youtube.com/watch?v=YE7VzlLtp-4', poster: 'https://i.ytimg.com/vi/YE7VzlLtp-4/hqdefault.jpg', theme: 'joyride',
  },
  {
    id: 'elephants-dream', title: 'Elephants Dream', year: '2006', genre: 'Sci-Fi',
    description: 'Two strangers wander a surreal machine world.',
    src: 'https://www.youtube.com/watch?v=4eJVGqJhp40', poster: 'https://i.ytimg.com/vi/4eJVGqJhp40/hqdefault.jpg', theme: 'fun',
  },
  {
    id: 'spring', title: 'Spring', year: '2019', genre: 'Fantasy',
    description: 'A shepherd girl and her dog face the spirits of the seasons.',
    src: 'https://www.youtube.com/watch?v=WhWc3b3KhnY', poster: 'https://i.ytimg.com/vi/WhWc3b3KhnY/hqdefault.jpg', theme: 'tears',
  },
  {
    id: 'coffee-run', title: 'Coffee Run', year: '2020', genre: 'Animation',
    description: 'A wild, funny dash back through one morning’s memories.',
    src: 'https://www.youtube.com/watch?v=PVGeM40dABA', poster: 'https://i.ytimg.com/vi/PVGeM40dABA/hqdefault.jpg', theme: 'escape',
  },
  {
    id: 'sprite-fright', title: 'Sprite Fright', year: '2021', genre: 'Comedy',
    description: 'An 80s-style horror comedy with very angry mushrooms.',
    src: 'https://www.youtube.com/watch?v=_cMxraX_5RE', poster: 'https://i.ytimg.com/vi/_cMxraX_5RE/hqdefault.jpg', theme: 'joyride',
  },
  {
    id: 'cosmos-laundromat', title: 'Cosmos Laundromat', year: '2015', genre: 'Animation',
    description: 'A sheep on a quiet island meets a salesman with a strange offer.',
    src: 'https://www.youtube.com/watch?v=Y-rmzh0PI3c', poster: 'https://i.ytimg.com/vi/Y-rmzh0PI3c/hqdefault.jpg', theme: 'fun',
  },
  {
    id: 'caminandes-llamigos', title: 'Caminandes: Llamigos', year: '2016', genre: 'Animation',
    description: 'Koro the llama and a rival penguin-loving pal team up.',
    src: 'https://www.youtube.com/watch?v=SkVqJ1SGeL0', poster: 'https://i.ytimg.com/vi/SkVqJ1SGeL0/hqdefault.jpg', theme: 'tears',
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

const tabStore = {
  get(key) { try { return sessionStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { sessionStorage.setItem(key, value); } catch { /* Storage can be disabled by the browser. */ } },
};
// Secret per-tab token: lets the server recognise this tab after a refresh (works on plain-http LAN addresses too).
const clientToken = (() => {
  let token = tabStore.get('vinnotube-token');
  if (!token) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    token = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    tabStore.set('vinnotube-token', token);
  }
  return token;
})();
// The room in the address bar wins; otherwise fall back to the room this tab was last in.
const queryRoom = (new URLSearchParams(location.search).get('room') || tabStore.get('vinnotube-room') || '').trim().toUpperCase();
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
  clockSamples: [],
  nudgeDir: 0,
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
  // Tell the server when (in server time) this position was sampled, so network delay on the way
  // to the server is not counted as lag by everyone else.
  if (payload.type === 'playback' && payload.at === undefined) {
    payload.at = Date.now() + state.syncOffsetMs;
    // The admin's own change is the truth: apply it locally right away so the next drift check
    // doesn't compare the player against the previous position while the server echo is in flight.
    if (isAdmin()) state.playback = { ...state.playback, playing: Boolean(payload.playing), currentTime: payload.currentTime, rate: Number(payload.rate) || 1, updatedAt: payload.at };
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
    if (state.roomCode) send({ type: 'join', room: state.roomCode, name: state.userName, token: clientToken });
    else send({ type: 'create', name: state.userName, token: clientToken });
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

// Closing the tab/browser: say goodbye right away so the others see us leave immediately
// instead of waiting for the server to notice a dead connection.
window.addEventListener('pagehide', () => {
  try { state.socket?.close(1000, 'page closed'); } catch { /* already closed */ }
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted && state.socket?.readyState !== WebSocket.OPEN) connect();
});

function beginClockPings() {
  clearInterval(state.pingTimer);
  clearInterval(state.syncTimer);
  const ping = () => {
    if (state.socket?.readyState === WebSocket.OPEN) send({ type: 'ping', clientSentAt: Date.now() });
  };
  // A quick burst right after connecting gives a good clock estimate before the first play.
  for (let index = 0; index < 8; index += 1) setTimeout(ping, index * 120);
  state.pingTimer = setInterval(ping, 4000);
  // Check drift often and correct gently; large jumps are only for big errors.
  state.syncTimer = setInterval(() => {
    if (state.nowPlaying && state.playback.playing) syncPlayer(false);
  }, 250);
}

// Estimates (server clock - local clock). A ping that came back fast was delayed the same amount in
// both directions, so its offset is the most trustworthy. Averaging the few fastest recent pings
// removes the jitter that made the old single-sample estimate wander by tens of milliseconds.
function updateClockOffset(sentAt, receivedAt, serverNow) {
  const rtt = receivedAt - sentAt;
  if (!Number.isFinite(serverNow) || rtt < 0 || rtt > 5000) return;
  state.clockSamples.push({ rtt, offset: serverNow - (sentAt + receivedAt) / 2, at: receivedAt });
  state.clockSamples = state.clockSamples.filter((sample) => receivedAt - sample.at < 60_000).slice(-24);
  const best = [...state.clockSamples].sort((a, b) => a.rtt - b.rtt).slice(0, 4);
  state.syncOffsetMs = best.reduce((sum, sample) => sum + sample.offset, 0) / best.length;
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
    updateClockOffset(sentAt, receivedAt, Number(message.serverNow));
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
      showChatFloat(message.message);
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
          tabStore.set('vinnotube-room', '');
          send({ type: 'create', name: state.userName, token: clientToken });
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
  if (Number.isFinite(serverNow) && !state.clockSamples.length) state.syncOffsetMs = serverNow - Date.now();
  setRoomUrl(room.code);
  tabStore.set('vinnotube-room', room.code);
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
    const absDrift = Math.abs(drift);
    const admin = isAdmin();
    const shouldPlay = state.playback.playing;
    const isPlaying = playerState === window.YT.PlayerState.PLAYING || playerState === window.YT.PlayerState.BUFFERING;
    const isPaused = playerState === window.YT.PlayerState.PAUSED || playerState === window.YT.PlayerState.CUED || playerState === window.YT.PlayerState.UNSTARTED;

    // Work out the playback rate the room wants, and the next step above/below it that this video
    // supports. YouTube only offers fixed speeds (usually 0.25 apart), so a catch-up nudge is one step.
    const desiredRate = Number(state.playback.rate) || 1;
    let rates = [];
    try { rates = [...(player.getAvailablePlaybackRates() || [])].sort((a, b) => a - b); } catch { /* Not ready yet. */ }
    const baseIndex = rates.length
      ? rates.reduce((best, rate, index) => Math.abs(rate - desiredRate) < Math.abs(rates[best] - desiredRate) ? index : best, 0)
      : -1;
    const baseRate = baseIndex >= 0 ? rates[baseIndex] : desiredRate;
    const stepFor = (direction) => (baseIndex >= 0 && rates[baseIndex + direction] !== undefined ? rates[baseIndex + direction] : null);

    // Listeners smooth small drift by speeding up or slowing down briefly instead of seeking (a seek
    // stalls the picture and sound). The admin is the reference clock, so the admin never nudges.
    const nudgeable = !admin && shouldPlay && playerState === window.YT.PlayerState.PLAYING;
    if (!nudgeable) state.nudgeDir = 0;
    else if (state.nudgeDir && drift * state.nudgeDir <= .05) state.nudgeDir = 0;
    else if (!state.nudgeDir && absDrift > .12) state.nudgeDir = drift > 0 ? 1 : -1;
    if (state.nudgeDir && stepFor(state.nudgeDir) === null) state.nudgeDir = 0;

    // While a nudge is running, allow more drift before giving up and seeking.
    const seekThreshold = admin ? 1.5 : (state.nudgeDir ? 1 : .4);
    const shouldSeek = absDrift > seekThreshold || (force && absDrift > .1);
    if (shouldSeek || shouldPlay && isPaused || !shouldPlay && isPlaying) {
      state.youtubeRemoteCommandUntil = Date.now() + 1500;
      setRemoteSuppression();
      if (shouldSeek) { player.seekTo(boundedTarget, true); state.nudgeDir = 0; }
      if (shouldPlay && isPaused) player.playVideo();
      else if (!shouldPlay && isPlaying) player.pauseVideo();
    }
    try {
      const nudged = state.nudgeDir ? stepFor(state.nudgeDir) : null;
      const targetRate = nudged ?? baseRate;
      if (Math.abs((player.getPlaybackRate() || 1) - targetRate) > .01) {
        state.youtubeRemoteCommandUntil = Date.now() + (nudged ? 600 : 1800);
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
  const absDrift = Math.abs(drift);
  const admin = isAdmin();
  const baseRate = Number(state.playback.rate) || 1;
  // Only mute the player's own events while WE are changing something; the old code did it on every
  // tick, which would also have swallowed the admin's genuine play/pause/seek clicks.
  if (absDrift > (admin ? 1.5 : .5) || force && absDrift > .1) {
    setRemoteSuppression();
    try { video.currentTime = target; } catch { /* The stream may not have seek data yet. */ }
    video.playbackRate = baseRate;
  } else if (state.playback.playing && !admin && absDrift > .03) {
    // Proportional catch-up: bigger drift, bigger (but capped) speed change. Pitch is preserved.
    video.playbackRate = baseRate * (1 + Math.max(-.08, Math.min(.08, drift * .6)));
  } else {
    video.playbackRate = baseRate;
  }

  if (state.playback.playing) {
    if (video.paused) {
      setRemoteSuppression();
      video.play().catch(() => {
        $('#syncText').textContent = 'Tap play to join the stream';
        if (!isAdmin()) {
          state.localPlaybackGestureRequired = true;
          renderJoinPlaybackButton();
        }
      });
    }
  } else if (!video.paused) {
    setRemoteSuppression();
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
  art.addEventListener('click', () => art.closest('.movie-card')?.querySelector('.watch-button')?.click());
  const body = document.createElement('div');
  body.className = 'movie-card-body';
  const title = document.createElement('h3');
  title.className = 'movie-title';
  title.textContent = movie.title;
  title.title = movie.title;
  // One quiet line: type and year on the left, the source link on the right.
  const meta = document.createElement('div');
  meta.className = 'movie-meta';
  const genre = document.createElement('span');
  genre.className = 'movie-genre';
  genre.textContent = movie.genre || 'Shared link';
  meta.append(genre);
  if (movie.year) {
    const year = document.createElement('span');
    year.className = 'movie-year';
    year.textContent = movie.year;
    meta.append(year);
  }
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
  openSource.textContent = getYouTubeVideoId(movie.src) ? 'YouTube ↗' : 'Open link ↗';
  openSource.title = getYouTubeVideoId(movie.src) ? 'Open on YouTube in a new tab' : 'Open the video link in a new tab';
  openSource.setAttribute('aria-label', `Open ${movie.title} in a new tab`);
  meta.append(openSource);
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
  body.append(title, meta, description, actions);
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
  if (canAdminister) {
    const actions = document.createElement('span');
    actions.style.cssText = 'display:flex;gap:14px';
    if (state.poll.open) {
      const close = document.createElement('button');
      close.type = 'button';
      close.dataset.pollClose = 'true';
      close.textContent = 'Close poll';
      actions.append(close);
    }
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.dataset.pollClear = 'true';
    clear.textContent = 'Clear poll';
    actions.append(clear);
    meta.append(actions);
  }
  root.append(question, choices, meta);
}

// Full-screen alerts: while the player is full screen the page (and chat) is hidden, so other people's
// messages and reactions float over the video for a few seconds. The viewer can switch this off.
const fullscreenAlerts = { enabled: local.get('vinnotube-fs-alerts', 'on') !== 'off' };

function applyFullscreenAlerts() {
  const frame = document.getElementById('playerFrame');
  frame?.classList.toggle('alerts-off', !fullscreenAlerts.enabled);
  const button = document.getElementById('alertsButton');
  if (button) {
    button.setAttribute('aria-pressed', String(fullscreenAlerts.enabled));
    button.setAttribute('aria-label', fullscreenAlerts.enabled ? 'Turn off full-screen chat alerts' : 'Turn on full-screen chat alerts');
    button.title = fullscreenAlerts.enabled ? 'Chat alerts: on' : 'Chat alerts: off';
    button.classList.toggle('is-off', !fullscreenAlerts.enabled);
  }
}

function toggleFullscreenAlerts() {
  fullscreenAlerts.enabled = !fullscreenAlerts.enabled;
  local.set('vinnotube-fs-alerts', fullscreenAlerts.enabled ? 'on' : 'off');
  if (!fullscreenAlerts.enabled) $('#chatFloat')?.replaceChildren();
  applyFullscreenAlerts();
}

function showChatFloat(entry) {
  if (!entry || !fullscreenAlerts.enabled) return;
  if (entry.participantId && entry.participantId === state.userId) return;
  const frame = document.getElementById('playerFrame');
  const root = $('#chatFloat');
  if (!frame || !root || !frame.classList.contains('is-fullscreen')) return;
  const bubble = document.createElement('div');
  bubble.className = 'floating-chat';
  const name = document.createElement('strong');
  name.textContent = entry.name || 'Someone';
  const text = document.createElement('span');
  const full = String(entry.text || '');
  text.textContent = full.length > 110 ? `${full.slice(0, 107)}…` : full;
  bubble.append(name, text);
  root.append(bubble);
  while (root.children.length > 3) root.firstElementChild.remove();
  setTimeout(() => bubble.remove(), 5000);
}

function showReaction(reaction) {
  if (!reaction) return;
  if (!fullscreenAlerts.enabled && document.getElementById('playerFrame')?.classList.contains('is-fullscreen')) return;
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
  tabStore.set('vinnotube-room', '');
  clearRoomUrl();
  send({ type: 'create', name: state.userName, token: clientToken });
}

// The circular-arrow button refreshes the room you are already in: same code, same people, same admin.
function refreshRoom() {
  if (!state.connected) return showToast('Reconnecting to your room…');
  if (!state.roomCode) return;
  const button = $('#newRoomButton');
  button.classList.remove('is-spinning');
  void button.offsetWidth;
  button.classList.add('is-spinning');
  send({ type: 'join', room: state.roomCode, name: state.userName, token: clientToken });
  showToast('Room refreshed — you’re still in the same room.');
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
  } else if (target.hasAttribute('data-poll-clear')) {
    send({ type: 'pollClear' });
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
$('#newRoomButton').addEventListener('click', refreshRoom);
$('#newRoomInlineButton').addEventListener('click', () => {
  if (window.confirm('Start a brand-new room? You will leave this one. Friends can still return to it with its code.')) createNewRoom();
});
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
  if (send({ type: 'join', room: normalized, name: state.userName, token: clientToken })) $('#roomDialog').close?.();
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

// Skip forward/back by `delta` seconds (admin only). Rapid repeated skips build on the position
// we just asked for, because the player can still be reporting the old time for a moment.
let pendingSeek = { target: 0, until: 0 };
function adminSeekBy(delta) {
  if (!isAdmin() || !state.nowPlaying) return false;
  const youtube = Boolean(getYouTubeVideoId(state.nowPlaying.src));
  let current = 0;
  let duration = 0;
  let playing = false;
  try {
    if (youtube) {
      if (!state.youtubeReady || !state.youtubePlayer) return false;
      const playerState = state.youtubePlayer.getPlayerState();
      current = state.youtubePlayer.getCurrentTime() || 0;
      duration = state.youtubePlayer.getDuration() || 0;
      playing = playerState === window.YT.PlayerState.PLAYING || playerState === window.YT.PlayerState.BUFFERING;
    } else {
      if (video.readyState < 1) return false;
      current = video.currentTime || 0;
      duration = Number.isFinite(video.duration) ? video.duration : 0;
      playing = !video.paused;
    }
  } catch { return false; }
  const base = performance.now() < pendingSeek.until ? pendingSeek.target : current;
  const target = Math.max(0, Math.min(base + delta, duration > 0 ? Math.max(0, duration - .25) : Infinity));
  pendingSeek = { target, until: performance.now() + 1200 };
  const rate = Number(state.playback.rate) || 1;
  state.youtubeRemoteCommandUntil = Date.now() + 1500;
  setRemoteSuppression();
  if (youtube) state.youtubePlayer.seekTo(target, true);
  else { try { video.currentTime = target; } catch { return false; } }
  send({ type: 'playback', playing, currentTime: target, rate });
  return true;
}

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

/* ---- Player chrome: full screen, auto-hiding controls, click-to-pause ----
   Additive UI layer. It only toggles classes, adds one button and forwards clicks to the existing
   play button, so room sync and admin rules in the code above are unchanged. */
(() => {
  const frame = document.getElementById('playerFrame');
  const controls = document.getElementById('youtubeControls');
  const playButton = document.getElementById('youtubePlayButton');
  const volumeGroup = document.querySelector('.player-volume');
  if (!frame || !controls || !playButton || !volumeGroup) return;

  const IDLE_MS = 2800;
  const canFullscreen = Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  let lastActivity = Date.now();
  let lastPointerType = 'mouse';
  let clickTimer = 0;

  // Catches pointer events that would otherwise land inside the YouTube iframe, which is what
  // kept YouTube's own title bar, logo and "More videos" panel appearing over our controls.
  const shield = document.createElement('div');
  shield.className = 'player-shield';
  shield.id = 'playerShield';
  frame.insertBefore(shield, controls);

  const isPlaying = () => playButton.textContent.trim() === 'Ⅱ';
  const wake = () => { lastActivity = Date.now(); frame.classList.remove('controls-idle'); };
  // Mouse clicks leave focus on whichever control was clicked (the full-screen button, the play button),
  // so focus alone must not keep the bar open. Only keyboard focus, or an open speed dropdown, does.
  let keyboardNav = false;
  window.addEventListener('keydown', (event) => { if (event.key === 'Tab') keyboardNav = true; }, true);
  window.addEventListener('pointerdown', () => { keyboardNav = false; }, true);
  controls.addEventListener('change', (event) => { if (event.target.tagName === 'SELECT') event.target.blur(); });
  const evaluate = () => {
    const active = document.activeElement;
    const inControls = Boolean(active && controls.contains(active));
    const busy = !isPlaying() || (inControls && (keyboardNav || active.tagName === 'SELECT'));
    frame.classList.toggle('controls-idle', !busy && Date.now() - lastActivity > IDLE_MS);
  };
  setInterval(evaluate, 400);

  frame.addEventListener('pointermove', wake);
  frame.addEventListener('pointerdown', (event) => { lastPointerType = event.pointerType || 'mouse'; wake(); });
  frame.addEventListener('keydown', wake);
  frame.addEventListener('focusin', wake);
  frame.addEventListener('pointerleave', () => { lastActivity = Date.now() - IDLE_MS + 700; });

  async function toggleFullscreen() {
    try {
      if (fullscreenElement()) await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else await (frame.requestFullscreen || frame.webkitRequestFullscreen).call(frame);
    } catch { /* The browser refused full screen (for example, no user gesture). */ }
  }

  const alertsButton = document.createElement('button');
  alertsButton.type = 'button';
  alertsButton.id = 'alertsButton';
  alertsButton.className = 'alerts-toggle';
  alertsButton.innerHTML = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path class="alerts-slash" d="M4 4l16 16"/></svg>';
  alertsButton.addEventListener('click', toggleFullscreenAlerts);
  volumeGroup.append(alertsButton);
  applyFullscreenAlerts();

  let fullscreenButton = null;
  if (canFullscreen) {
    fullscreenButton = document.createElement('button');
    fullscreenButton.type = 'button';
    fullscreenButton.id = 'fullscreenButton';
    fullscreenButton.addEventListener('click', toggleFullscreen);
    volumeGroup.append(fullscreenButton);
  }
  const ICON_ENTER = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
  const ICON_EXIT = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
  function syncFullscreenState() {
    const active = fullscreenElement() === frame;
    frame.classList.toggle('is-fullscreen', active);
    if (fullscreenButton) {
      fullscreenButton.innerHTML = active ? ICON_EXIT : ICON_ENTER;
      fullscreenButton.setAttribute('aria-label', active ? 'Exit full screen' : 'Full screen');
      fullscreenButton.title = active ? 'Exit full screen (F)' : 'Full screen (F)';
    }
    if (fullscreenButton && !keyboardNav) fullscreenButton.blur();
    wake();
  }
  document.addEventListener('fullscreenchange', syncFullscreenState);
  document.addEventListener('webkitfullscreenchange', syncFullscreenState);
  syncFullscreenState();

  // Taps on the video:
  //   single tap            = play/pause (admin only, via the existing button)
  //   admin double-tap left/right third = back/forward 5 s; keep tapping the same side to keep skipping
  //   double-tap elsewhere (or any double-tap for non-admins) = full screen
  // Double taps are detected from the clicks themselves because mobile browsers don't reliably fire dblclick.
  const SKIP_SECONDS = 5;
  const DOUBLE_TAP_MS = 300;
  const STREAK_MS = 900;
  let lastTapAt = 0;
  let lastTapX = 0;
  let streak = { side: 0, until: 0, total: 0 };
  let feedbackTimer = 0;

  const feedback = [-1, 1].map((side) => {
    const element = document.createElement('div');
    element.className = `skip-feedback ${side < 0 ? 'skip-back' : 'skip-forward'}`;
    element.setAttribute('aria-hidden', 'true');
    element.innerHTML = `<span class="skip-arrows">${side < 0 ? '◀◀' : '▶▶'}</span><span class="skip-text"></span>`;
    frame.insertBefore(element, controls);
    return element;
  });
  function showSkipFeedback(side, total) {
    const [back, forward] = feedback;
    const element = side < 0 ? back : forward;
    (side < 0 ? forward : back).classList.remove('show');
    element.querySelector('.skip-text').textContent = `${side < 0 ? '−' : '+'}${total} seconds`;
    element.classList.remove('show');
    void element.offsetWidth; // restart the pulse animation on every tap
    element.classList.add('show');
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => element.classList.remove('show'), STREAK_MS);
  }
  function skip(side) {
    const now = performance.now();
    const total = streak.side === side && now < streak.until ? streak.total + SKIP_SECONDS : SKIP_SECONDS;
    if (!adminSeekBy(side * SKIP_SECONDS)) return;
    streak = { side, until: now + STREAK_MS, total };
    showSkipFeedback(side, total);
  }

  shield.addEventListener('click', (event) => {
    const wasIdle = frame.classList.contains('controls-idle');
    wake();
    const now = performance.now();
    const rect = shield.getBoundingClientRect();
    const ratio = rect.width ? (event.clientX - rect.left) / rect.width : .5;
    const side = ratio < .35 ? -1 : ratio > .65 ? 1 : 0;
    const doubleTap = now - lastTapAt < DOUBLE_TAP_MS && Math.abs(ratio - lastTapX) < .2;
    const continuingStreak = side !== 0 && streak.side === side && now < streak.until;
    lastTapAt = now;
    lastTapX = ratio;

    if (isAdmin() && side !== 0 && (doubleTap || continuingStreak)) {
      clearTimeout(clickTimer);
      lastTapAt = 0;
      skip(side);
      return;
    }
    if (doubleTap) {
      clearTimeout(clickTimer);
      lastTapAt = 0;
      if (canFullscreen) toggleFullscreen();
      return;
    }
    // The first tap on a touch screen only brings the controls back (but still counts toward a double tap).
    if (lastPointerType === 'touch' && wasIdle) return;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => playButton.click(), DOUBLE_TAP_MS);
  });

  window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 'f' || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target.closest?.('input, textarea, select, [contenteditable], dialog')) return;
    if (!canFullscreen || controls.hidden) return;
    toggleFullscreen();
  });
})();

/* ---- Premium polish: scroll-aware top bar, nav highlighting, reveal-on-scroll, slider fill ----
   Purely cosmetic. It only toggles classes / CSS variables and forwards clicks to existing controls. */
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Top bar turns from transparent to frosted glass once the page scrolls.
  const onScroll = () => document.body.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Nav underline follows whichever section is on screen.
  const links = [...document.querySelectorAll('.nav-link')];
  const sections = links.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window && sections.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((section) => spy.observe(section));
  }

  // Gentle fade-up as sections arrive.
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const reveal = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in-view');
        reveal.unobserve(entry.target);
      });
    }, { threshold: 0.08 });
    document.querySelectorAll('.discover-section, .page-footer').forEach((el) => {
      el.classList.add('reveal');
      reveal.observe(el);
    });
  }

  // Search icon in the top bar, plus the hero's invite button, reuse existing behaviour.
  document.getElementById('navSearchButton')?.addEventListener('click', () => {
    document.getElementById('discover')?.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => document.getElementById('movieSearch')?.focus({ preventScroll: true }), 450);
  });
  document.getElementById('heroInviteButton')?.addEventListener('click', () => document.getElementById('inviteButton')?.click());

  // Colour the filled part of the seek and volume sliders.
  const sliders = ['youtubeSeek', 'volumeRange'].map((id) => document.getElementById(id)).filter(Boolean);
  const paint = () => sliders.forEach((input) => {
    const min = Number(input.min) || 0;
    const max = Number(input.max) || 100;
    const pct = max > min ? ((Number(input.value) - min) / (max - min)) * 100 : 0;
    input.style.setProperty('--fill', `${Math.min(100, Math.max(0, pct))}%`);
  });
  sliders.forEach((input) => input.addEventListener('input', paint));
  setInterval(paint, 250);
  paint();
})();
