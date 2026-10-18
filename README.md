# VinnoTube

A real-time watch-party app. VinnoTube includes room invites, synchronized playback, playback speed controls, personal volume controls, a vote-ranked shared playlist, movie discovery, chat, reactions, ready checks with a shared countdown, admin-run polls, participant presence and admin transfer.

## Run it

Requires Node.js 18 or newer.

```sh
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). The app creates a room when it connects. Use **Invite friends** to copy a room URL, or share the room code shown beside the room name.

## Test with multiple viewers

For a quick server-side room check, keep the server running in one terminal and run this in a second terminal:

```sh
npm run simulate
```

It creates 10 temporary WebSocket participants, claims the room admin, selects a YouTube clip, changes playback to 1.5× and checks that every participant receives the update. Use `npm run simulate -- --clients=15` to change the simulated count (the server limit is 25). This tests room and control propagation; it does not open 10 video players.

To test real playback, open the room invite in two or more browser tabs. The first viewer can claim admin control; only that viewer can change shared playback, while each viewer controls their own volume. To use phones or other computers on your Wi-Fi, start VinnoTube on the host computer, find its IPv4 address with `ipconfig`, open `http://<host-ip>:3000` there, then send the room invite to the other devices. Keep them on the same network and allow Node.js through the host firewall for private networks if Windows prompts.

For friends on the same local network, open the app using the host computer's LAN address (for example, `http://192.168.1.20:3000`) before copying the invite. A link copied from `localhost` only points back to the recipient's own computer. The host firewall must allow connections to the chosen port.

The built-in picks use public W3C and MDN sample video files for demonstration. Replace them with media you have permission to share before deploying. **Add a video link** accepts direct, browser-playable HTTP or HTTPS video URLs (such as MP4/WebM) and YouTube watch, share, Shorts, and embed links. YouTube playback is embedded through YouTube's player API and requires that embedding is allowed for the video. YouTube automatically chooses video quality; manual quality selection is not available through its embedded player API. The quality control indicates Auto for YouTube and Source for a single direct video URL. A regular page link from Netflix, Prime Video, or another DRM streaming service cannot be played inside this app; those services block third-party playback. All participants' browsers must be able to reach the video URL, and direct URLs must use browser-supported codecs.

Each discovery card has two separate actions: **Watch together** loads the clip into the synchronized room player, while **Open on YouTube** (or **Open video link**) opens its source page in a new browser tab. The red watch button has a short press/ripple animation and respects reduced-motion settings.

When an admin adds a link, it loads into the shared player, ready for the admin to press Play. Other participants can add links to the shared playlist for the admin to select. Rooms start without an admin; any participant can claim control, and the admin can transfer it to a participant. Only the admin can play, pause, seek (including double-tap the left/right third of the video to skip back/forward 5 s; keep tapping the same side to skip further), choose/remove playlist entries, or create/close polls. Chat, reactions, suggestions, and poll voting are open to all participants.

## Ready check and next-pick voting

Once a video is selected and paused, each participant can mark themselves ready under the player. The participant list shows who is ready. When everyone is ready, the room admin can start a five-second countdown; the server then starts shared playback for the room. An admin can cancel it, and a new arrival or a participant becoming unready cancels the countdown. Changing the selected video resets readiness. A browser may still require a participant to tap **Tap to join playback** once to allow playback under its autoplay policy.

Everyone can vote for one upcoming playlist title at a time. Voting for another title moves your vote; pressing your selected vote again removes it. Upcoming titles are ordered by votes, with earlier additions winning ties. The current title stays pinned at the top, and only the admin can select or remove playlist entries.

## Intro screen

Every time the page is opened, a branded intro plays for about 5 seconds (4.4 s of loading plus a 0.6 s iris-out reveal) while the room connects behind it. It is plain HTML/CSS/canvas with no extra files. To change the length, edit `SPLASH_MS` at the top of `public/app.js`; the look lives under "Intro splash" in `public/styles.css` and the markup is the `#splash` block at the top of `public/index.html`. Visitors can press **Skip intro** or Esc. With the system "reduce motion" setting on, the movement is switched off and only the loading fill, percentage and status text animate.

## How synchronization works

The Node server relays room events over WebSockets and serializes state changes in the order it receives them. Each room has one shared playback state and a server timestamp. New arrivals and reconnecting clients receive a snapshot, estimate server clock offset with periodic ping/pong messages, then seek to the current room position.

Each client estimates the server clock from a burst of pings on connect and then every 4 s, trusting the lowest round-trip samples. The admin stamps every playback update with the server time at which the position was sampled (the server clamps that stamp to at most 3 s in the past), so the admin-to-server delay is not counted as lag. Listeners check drift every 250 ms. For direct video URLs, drift between 30 ms and 500 ms is corrected with a proportional, capped (±8%) speed change and anything larger with a seek. YouTube embeds only support fixed speeds, so drift above ~120 ms is corrected by running one speed step (usually ±0.25×) faster or slower until the gap closes, and drift above ~1 s (0.4 s when no speed step is available) with a seek. The admin's player is the reference and is only moved if it falls more than 1.5 s off. Playback speed is shared from the room admin; volume and mute are saved locally per participant. Browser autoplay rules may require a participant to press Play once before a remote start can play on that device.

## Performance target and measurement

The brief sets these targets: at least 10 concurrent participants per room; playback-control propagation at or below 250 ms at p95 on a local network; and playback drift at or below 500 ms after correction. The server accepts up to 25 active participants in one room.

Smoke run recorded on 2026-10-16: Windows 10.0.26300, Node.js v24.15.0, server and 10 simulated WebSocket clients on the same development machine using loopback. One playback update at 1.5× reached all 10 clients; the script's recipient-based relay estimate was 1 ms p95. This is a short smoke check with 10 delivery samples, not a controlled LAN benchmark. It did not run 10 video decoders and did not measure playback drift. The 250 ms LAN and 500 ms drift targets remain unverified.

The room UI estimates playback-control delivery from the server's receive timestamp and the client's ping/pong clock-offset estimate. It shows a rolling p95 after three playback events and retains up to 100 recent samples. This is a diagnostic estimate, not a substitute for a controlled benchmark.

To record comparable results:

1. Run the server on one computer and connect 10 browser clients over the same local network. Use the same video URL on each device and wait for it to load.
2. Let the room settle for two minutes, then generate at least 100 play, pause and seek actions from different clients over several minutes.
3. Record the rolling p95 shown in each receiving client's room UI. Also compare player timestamps across clients after each correction; record the largest observed residual drift.
4. Note the server and client device models, browser versions, network type, client count, video source, run length and any reconnects. Repeat after a server restart and with one client briefly disconnecting.

Performance record: **not measured**. Fill in actual results, conditions and date after running the procedure; the target should only be marked met when measured.

## Room state and failure handling

- A room invite is a six-character code in the URL. Late joiners receive current playback and the shared playlist.
- Clients reconnect with exponential backoff. When an admin disconnects, the room has no admin until someone claims control; an active admin can transfer the role at any time.
- An empty room stays in server memory for 30 minutes so participants can reconnect. A server restart clears rooms, polls, chat and playlists; a stale invite starts a fresh room.
- Chat is limited to 500 characters per message and the server retains the most recent 80 messages per room. The playlist holds up to 50 videos and the room allows up to 25 active participants.
- Room state is in memory and there is no sign-in, database, cross-process pub/sub or persistent history. Run one server process for this version. A production deployment needs shared storage and a pub/sub layer before using multiple server instances.
- Media playback depends on a URL being reachable from every participant's browser and supported by that browser. The app cannot bypass a provider's access controls or codec limitations.

## Project layout

- `server.mjs` — HTTP static server and room WebSocket relay.
- `public/index.html` — accessible room and discovery interface.
- `public/styles.css` — responsive visual design.
- `public/app.js` — room client, synchronization, discovery and collaboration features.
