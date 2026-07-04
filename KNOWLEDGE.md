## Admin Settings Create Pattern

- Admin settings pages should open create forms in `Modal` components from the page header action.
- After a successful create, await the API call, refresh the local table data from the list endpoint, close the modal,
  then reset form state.
- Mock create helpers should mutate the same in-memory collections used by mock list helpers so table refresh behavior
  matches the real backend.

## ASA Interaction Pattern

- Handle `reload_page:v1` with SvelteKit `invalidateAll()`, never `location.reload()`. This refreshes current route data
  while preserving the long-lived ASA store, panel state, and conversation.

- Keep the ASA panel anchored to the orb. Closing the panel cancels the active stream and returns the orb to idle.
- Load session messages newest-first from the cursor API, reverse each page for display, and prepend older pages while
  preserving the scroll offset. Backend agent context remains independently bounded.
- Render `thinking` protocol events in the pending assistant message and replace them as response tokens arrive.
- Accept `timing` protocol events as development diagnostics. Log them through ASA debug plumbing without updating
  assistant message content, speech playback, actions, or session state.
- Batch streamed ASA token chunks before updating Svelte state. Flush the buffer on a short interval and immediately on
  `done`, `error`, clarification/action boundaries, cancel, and stream completion so the final text stays exact while
  long answers do not trigger one render per provider token.
- Wrap browser timer functions when storing them on the stream batcher. Calling an unbound `window.setTimeout` as a
  class property throws Firefox `TypeError: Illegal invocation` on the first token, aborts the consumer loop, and leaves
  a blank assistant bubble even though the network continues receiving the complete SSE response.
- Treat token events as the live fast path and the `done.payload.content` completion snapshot as authoritative. Reconcile
  the in-flight bubble to that snapshot so a proxy-dropped or truncated SSE chunk cannot leave a blank or partial reply.
- Route every ASA protocol event through one turn accumulator. Timing/action events do not alter text, thinking and
  speech update transient state, token events append exact chunks, and `done.content` atomically replaces partial text.
- Give the token batch flush sole ownership of appending token chunks to the turn accumulator and projecting them into
  the assistant message. Never append once on receipt and again on flush; delayed duplicate writes can corrupt or hide
  the live bubble before the authoritative `done.content` snapshot arrives.
- Treat standalone `===` and `===BODY===` lines as transport protocol, not assistant text. The turn accumulator strips
  them from both live chunks and the authoritative completion snapshot, while preserving the body that follows.
- Render in-flight assistant token content as plain pre-wrapped text and switch to markdown only after stream
  completion. Partial markdown such as headings, emphasis, or table scaffolds can otherwise produce blank live bubbles
  even though the persisted message renders correctly after refresh.
- Keep voice playback side effects isolated from the chat stream loop. A TTS, cue, or Web Audio exception must log as a
  voice issue without converting a healthy ASA chat response into a connection error or cancelling the rendered reply.
- If ASA has already streamed content or received `done`, a late transport read failure is diagnostic only. Keep the
  answer visible and let queued speech finish instead of showing `Connection error. Try again.` or playing the sorry cue.
- ASA API calls must include browser credentials. Local UI sessions can point at a cross-origin ngrok/core URL, and
  tunnel auth cookies are otherwise withheld from `/api/asa/chat`, TTS, cue, and model requests, causing connection
  errors before audio can play.
- Voice is opt-in and local-first: request microphone access from a user gesture, download only pinned permissively
  licensed Sherpa-ONNX models, review the transcript before sending, and persist speech speed, volume, and auto-speak
  preferences locally.
- Keep Sherpa runtime assets behind the Vite asset plugin and validate model revisions, checksums, sizes, and licenses
  with `npm run check:voice-models`.
- Render `confirm_required` actions as explicit Approve and Cancel controls. A follow-up request returns only the opaque
  confirmation token and decision; the browser must never reconstruct or edit protected tool arguments.

## Execution WebSocket Pattern

- Execution WebSockets require an explicit `VITE_SETARA_WS_TOKEN` because the backend authorizes these feeds with a
  project API key carrying `execution:read`. When no token is configured, every socket entry point must remain idle and
  use persisted API data instead of opening an unauthenticated socket or starting a reconnect loop.
- Keep the missing-token guard in the shared WebSocket manager even when individual pages also guard direct sockets.
  Project execution pages connect through the manager, while the aggregate dashboard owns several sockets directly.

## ASA Transcript Normalization Pattern

- Preserve the exact STT output as `rawText` and produce a separate `normalizedText` plus ordered applied-rule IDs.
- Keep normalization deterministic, idempotent, and grammar-scoped. Spoken numbers are converted only in recognized
  contexts such as semantic versions and sprint labels.
- Do not correct product, project, plan, build, squad, or person names during normalization. Entity correction belongs
  to the contextual entity resolver, where ambiguity can be surfaced instead of silently guessed.

## ASA Voice Capture Pattern

- Sidecar voice sends structured `AsaVoiceInput` with `source: 'sidecar'`, `rawText`, `normalizedText`,
  `resolvedText`, and bounded entity matches. Push-to-talk and hands-free must pass this payload to
  `asa.send(text, voiceInput)` so `setara-core` can re-authorize and improve domain correction.
- Prepare a short-lived core voice session before streaming. Send its bounded STT prompt/hotwords as the first
  WebSocket control frame, keep partials display-only, and send retained PCM to the session final endpoint so only
  core-normalized, permission-scoped final transcripts enter chat. Promote the latest partial only when finalization
  is unavailable.
- Keep one browser VAD session alive while ASA waits for a wake phrase and while it transitions to command capture.
  Ignored or empty transcripts update the listening mode without reopening the microphone.
- Hands-free arming must be idempotent. Guard async VAD setup with a single in-flight promise, let the component call
  `syncHandsFree(panelActive)`, and keep at most one streaming STT WebSocket active. Cap buffered PCM frames while the
  socket is connecting.
- `syncHandsFree(panelActive)` must remember panel activity separately from the user hands-free preference. If the user
  toggles hands-free on while ASA is already open, `setHandsFree(true)` must arm immediately instead of waiting for a
  component effect that might not re-run.
- Keep hands-free lightweight by default. Use energy VAD unless `localStorage.setItem('setara.asa.voice.mlVad','1')`
  opts into Silero, disconnect analyser/source nodes on each monitor stop, and do not reopen the mic for ignored
  noise or wake-only cycles.
- Streaming STT finalization must resolve through one helper from `final`, socket `close`, socket `error`, and timeout
  paths. When the sidecar or relay dies after partials, promote the latest partial transcript instead of leaving
  hands-free stuck in finalizing state.
- Hands-free is wake-once per toggle/session: start in `wake` mode, unlock into `command` mode after "Hi ASA",
  then keep accepting commands until the user toggles hands-free off or closes ASA. Rearm only after queued speech
  playback finishes so ASA does not capture its own TTS.
- Streamed TTS stays raw PCM but schedules browser playback through Web Audio with merged frames, a small preroll
  jitter buffer, underrun recovery, and logged playback stats. Barge-in must stop sources without clearing `onended`
  handlers so in-flight playback promises can settle.
- Firefox may reject the final read of a successfully delivered streaming response with `NS_BASE_STREAM_CLOSED`.
  Treat it as end-of-stream only after PCM arrived, flush the pending tail, and fall back to batch TTS only when the
  stream failed before delivering audio.
- Decode streamed PCM with byte-safe little-endian reads rather than constructing `Int16Array` views over fetch chunks.
  Browser chunk byte offsets are not guaranteed to be 16-bit aligned, and an alignment exception can silently kill TTS.
- Stop and destroy microphone resources before transcript review, speech output, pause, or component teardown. This
  prevents live callbacks from racing review state and ensures media tracks are released.
- Treat wake matching as deterministic command grammar. Support punctuation and letter-spelled `A.S.A.`, but do not
  use fuzzy entity matching for the wake phrase.
- The chat panel keeps a theme-aware glass surface with sufficient opacity for text contrast. Resize handling must keep
  both the panel and orb inside the viewport.
- Persist Moonshine model binaries in a versioned Cache Storage namespace only after byte-size and SHA-256
  verification. Route model initialization through cached responses and delete stale Setara model caches on upgrade.
- Keep text chat on the main orb click and expose microphone activation as a distinct control attached to the orb.
  Voice capture can stay panel-free until a command needs review or entity clarification.
