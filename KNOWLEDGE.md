## Admin Settings Create Pattern

- Admin settings pages should open create forms in `Modal` components from the page header action.
- After a successful create, await the API call, refresh the local table data from the list endpoint, close the modal,
  then reset form state.
- Mock create helpers should mutate the same in-memory collections used by mock list helpers so table refresh behavior
  matches the real backend.
- Optional squad issue-tracker project keys use the client name `issueTrackerProjectKey`. Trim values before create or
  update, submit `null` to clear them, show `Global default` when unset, and explain that blank uses the global
  issue-tracker project key. Mock create, update, list, and detail calls must share the same mutable squad value.

## Chart Visual Pattern

- Keep chart styling centralized in `src/lib/components/chartTheme.ts` and the shared `LineChart` and `DonutChart`
  wrappers. Page-level datasets own semantic base colors and data; the shared layer derives canvas gradients, hover
  treatments, spacing, tooltips, legends, grids, and light/dark theme colors.
- Derive gradients from each dataset's existing color so status meaning remains stable. Do not add page-specific
  gradients or duplicate shared Chart.js presentation options in routes.
- Rebuild canvas gradients after data, size, or theme changes because `CanvasGradient` coordinates belong to the
  current chart area.
- Use the shared percent axis for percentage-only charts. Mixed quality charts use `yPercent` for bounded 0-100 lines
  and `yVolume` for count bars; never force scenario or execution volume onto a percentage scale.
- Build dashboard quality trends through `createQualityTrendData`: one subtle scenario-volume bar, then pass-rate and
  automation-coverage lines. Dataset labels include their unit so indexed tooltips stay clear without route options.
- Reuse mixed axes for other count-plus-percentage charts, including execution pass rate with failed-scenario volume.
  Percentage-only coverage and release charts stay on the default bounded percentage mode.
- Use a top-lit fade for charts: crisp and bright at the top, progressively transparent toward the bottom. Keep glow
  low-opacity and theme-aware so it improves hierarchy without reducing label or grid clarity.
- Shared cards keep a solid surface with one softly glowing gradient edge that fades across the top. Semantic cards use
  a narrow tinted side strip instead of a full-card color wash. Avoid ambient gradients across the whole card body.
- Project list entries use one `BentoCard` link per project. Put the key, name, and description in its header, keep
  metrics in a balanced grid, and end with a quiet directional action rather than nesting links or card containers.

## Navigation Pattern

- Keep the sidebar focused on route icon, label, active state, and contextual disabled state. Do not persist or render
  pinned shortcuts unless a validated workflow requires them; the command palette already handles fast navigation.
- Disabled project routes remain visible to explain the available structure, but use `aria-disabled`, muted styling,
  and clear guidance to open a project first.
- Use `static/setara.gif` as the Setara wordmark in the app shell and auth screens. Render it inside a fixed-size,
  overflow-hidden viewport so the square GIF is cropped to the layout instead of stretching or showing excess whitespace.
- Keep Light and Dark as explicit options through the shared `ThemeToggle` selector. In the app shell, place theme
  selection in the lower sidebar on desktop and mobile; do not duplicate it in the sidebar brand row.

## Auth Entry Pattern

- Login uses one responsive split screen: product-led hero and signals on desktop, simplified hero plus form on mobile.
  Preserve the existing client-side auth and demo quick-login behavior when improving the presentation.
- The login page owns its local hero motion and form layout, but reuses shared theme selection and global design tokens.
  Respect `prefers-reduced-motion`, keep inputs and primary actions at touch-friendly heights, and avoid separate or
  duplicate brand treatments.

## Metric Card Pattern

- Extend the shared `MetricCard` through independent optional regions rather than dashboard-only card variants. Keep
  existing `sub`, `variant`, icon, child snippet, and whole-card link behavior compatible across current call sites.
- Trend indicators pair direction symbols with semantic color. Progress uses progressbar semantics, status is always
  textual, and sparklines are decorative because the value and delta carry the accessible meaning.
- Show `No previous data` when history is unavailable and `No runs` when no finished outcomes exist. Never render a
  guessed zero or an invented trend merely to fill card space.
- Map quality status once through `QualityStatusBadge` and reuse the existing `AppBadge` primitive. Attention rows and
  project tables share the same Healthy, Needs review, High risk, Critical, and No runs language.
- Attention panels distinguish loading, unavailable evidence, no urgent issues, and populated risks. Use the shared
  animated `EmptyState` for unavailable and healthy-empty results. Each risk is a normal project link and communicates
  severity through icon labeling, status text, and color together.
- Projects overview uses semantic table markup inside horizontal overflow, with a stable 920px minimum table width.
  Keep `No runs`, zero pass rate, unavailable metrics, and no activity distinct; do not coerce them into one fallback.
- Reuse `InlineProgress` for compact coverage cells and `QualityStatusBadge` for health. Failure counts use explicit
  none, warning, and danger classes plus screen-reader text, while the project name remains a normal link.
- Load the dashboard through one aggregate `/api/dashboard` request. Date or grouping changes and completed live runs
  refresh that same contract so KPIs, trends, attention, and project rows cannot drift across separate responses.
- Mock mode implements the aggregate contract itself, including equal-length periods, deterministic trends, health,
  and attention. Loading skeletons match the KPI, chart, attention, and project-table regions to prevent layout jumps.

## Dashboard Copy Style

- Use sentence fragments where scannable and conversational. Page subtitles describe the purpose without
  restating the title ("Your test suite at a glance: coverage, pass rates, and what needs attention.").
- Keep metric labels concise and title-case: Quality health, Pass rate, Automation coverage, Test scenarios.
  Do not use jargon such as "aggregate statistic", "execution result", or "pass-fail ratio".
- Delta labels follow one pattern: `+N vs previous period` or `No previous data` (never `–`/`↓` in labels,
  those belong to the direction symbol). `No runs` replaces a zero pass rate when no finished executions exist.
- Section headings describe the decision context, not just the data: "Projects needing attention" over "Projects".
- Help text on clickable cards tells the user what they will learn, not just that a click is possible
  ("Click to see how this score is calculated" over "More info").
- Error states distinguish unavailable (data not yet collected) from failed (request error). Use "unavailable"
  for a healthy empty state and surface the actual error message for request failures.

## Project Listing Command Center Pattern

- Load the Projects page through one `/api/projects/overview` contract. Its summary, filter options, items, and page
  metadata must describe the same backend snapshot and health vocabulary used by the dashboard.
- Keep route code responsible for request coordination, debouncing, stale-response rejection, paging, retry, project
  creation refresh, and persisted view mode. Put status, progress, card, summary, toolbar, grid, list, and skeleton
  presentation under `src/lib/components/projects`.
- Preserve the last successful overview during background failures and label it as the latest available data. Use the
  shared animated `EmptyState` for genuine empty and filtered-empty results, and a region-matched skeleton before the
  first successful response.
- Cards use one keyboard-focusable project link with no nested interactive controls. Status combines text and an icon,
  progress bars expose value semantics, missing results say `No runs`, and projects without scenarios show `N/A`
  instead of a misleading zero percent.
- The grid is explicitly four, three, two, and one columns at desktop, laptop, tablet, and mobile breakpoints. The list
  view uses semantic table markup and horizontal overflow, and the grid/list toggle persists at
  `setara.projects.viewMode`.
- Reuse the shared `MetricCard` for project-listing summary KPIs. Load subsequent overview pages with one guarded
  `IntersectionObserver` sentinel, disconnect it while a request is active, and rely on request sequencing to reject
  stale pages after filters change. Do not add a parallel manual load-more control.

## Squad Quality Command Center Pattern

- Load Squad Detail through one `/api/squads/{squadId}/quality-overview` response. Summary, deltas, trend, attention,
  projects, thresholds, and squad identity must share the same selected and previous periods.
- Reuse `MetricCard`, `QualityStatusBadge`, `InlineProgress`, the chart theme, and animated `EmptyState`. Keep the route
  responsible only for preset/custom range state, grouping, request sequencing, stale-data preservation, and retry.
- Coverage is `N/A` when the scenario denominator is zero. Pass rate says `No runs` when execution evidence is absent.
  Attention categories explain no scenarios and stale runs without inventing competing health statuses.
- Use a 75 percent chart minimum only when every visible percentage is at least 80; otherwise retain the full 0 to 100
  scale. Trend insights state flat, improving, dropping, unavailable, or insufficient evidence in plain language.

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
- Apply `user_input_revision` only to the optimistic user message whose request ID matches the active stream, and
  reconcile the same value from `done.userInputRevision`. Ignore missing, blank, oversized, mismatched, and unknown
  events so old clients and servers remain compatible.
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

## Failed Execution Issue Creation Pattern

- Quick-create one aggregate external issue only for a failed execution with failed scenario results and an enabled issue
  tracker. Keep confirmation in the UI and call the existing bulk-create API with exactly one `Bug` issue and the
  execution ID; do not add a dedicated backend endpoint.
- Generate deterministic, bounded plain text ordered by scenario sequence, then key and name. Include project and
  execution metadata plus scenario key, name, feature, exception, and failed-step detail only when present; state how
  many failures were omitted beyond the bound.
- Refresh `TrackedIssuesTable` through an explicit refresh token after a created response. Total or partial failures
  stay visible as errors, and the confirmation closes automatically only after a complete success.

## Tracked Issues Presentation Pattern

- `TrackedIssuesTable` owns exactly one `BentoCard` across plan, build, and execution placements. Keep host routes to
  spacing only, put link and optional execution quick-create actions in the card header, and keep `DataTable` as the
  sole table primitive with its mobile-card behavior.
- Sortable headings are real `.sort-button` controls with `.sort-indicator` state. Unlink uses an accessible `Modal`
  confirmation that explicitly preserves the external ticket, then removes only the local row after success.

## ASA Transcript Normalization Pattern

- Preserve the exact STT output as `rawText` and produce a separate `normalizedText` plus ordered applied-rule IDs.
- Keep normalization deterministic, idempotent, and grammar-scoped. Spoken numbers are converted only in recognized
  contexts such as semantic versions and sprint labels.
- Do not correct product, project, plan, build, squad, or person names during normalization. Entity correction belongs
  to the contextual entity resolver, where ambiguity can be surfaced instead of silently guessed.

## ASA Voice Capture Pattern

- Keep STT WebSocket v2 wire types and boundary validation in
  `src/lib/voice/stt-stream/protocol.ts`. Start controls use protocol version `2`, PCM16 mono 16 kHz
  audio in fixed 20 ms frames, a bounded duration, and provider policy that defaults to `auto`.
  Only `provider_final` and `local_recovered_final` are authoritative; every degraded finality stays
  reviewable and must not be treated as an ordinary command final.
- Derive STT diagnostic context through the protocol correlation helper. It may contain request,
  session, and client IDs, but never transcript text, PCM, or other audio content.
- Sidecar voice sends structured `AsaVoiceInput` with `source: 'sidecar'`, `rawText`, `normalizedText`,
  `resolvedText`, and bounded entity matches. Push-to-talk and hands-free must pass this payload to
  `asa.send(text, voiceInput)` so `setara-core` can re-authorize and improve domain correction.
- Prepare a short-lived core voice session before streaming. Send its bounded prompt and hotwords in the validated v2
  `start` control, and do not deliver microphone audio until the sidecar's `ready` capability is accepted. Keep
  partials display-only; close, error, and timeout may expose a tagged degraded result for editing but must never
  promote interim text into an ordinary final.
- Keep one browser VAD session alive while ASA waits for a wake phrase and while it transitions to command capture.
  Ignored or empty transcripts update the listening mode without reopening the microphone.
- Hands-free arming must be idempotent. Guard async VAD setup with a single in-flight promise, let the component call
  `syncHandsFree(panelActive)`, and keep at most one streaming STT WebSocket active. Gate capture on v2 readiness;
  never retain PCM frames while the socket connects.
- `syncHandsFree(panelActive)` must remember panel activity separately from the user hands-free preference. If the user
  toggles hands-free on while ASA is already open, `setHandsFree(true)` must arm immediately instead of waiting for a
  component effect that might not re-run.
- Keep hands-free lightweight by default. Use energy VAD unless `localStorage.setItem('setara.asa.voice.mlVad','1')`
  opts into Silero, disconnect analyser/source nodes on each monitor stop, and do not reopen the mic for ignored
  noise or wake-only cycles.
- `SttSession` owns framing and transport state independently from microphone and suppression graphs. It retains less
  than one 20 ms frame, sends exact 640-byte PCM frames, applies high/low `bufferedAmount` hysteresis without a frame
  queue, reports every dropped millisecond, and stops with one degraded flush when congestion is sustained.
- A final result may auto-submit only when its finality is `provider_final` or `local_recovered_final` and neither
  client nor server reports dropped audio. Connection-lost and timeout partials remain reviewable, while cancelled
  results discard text. Stop, repeated flush, socket failure, and cleanup must settle at most one final result.
- Keep microphone mode policy in `stt-stream/mode-policy.ts`: command is 15 seconds with explicit stop, hands-free is
  30 seconds with VAD silence, and dictation is 300 seconds with explicit stop. All three modes use `SttSession` and
  the same v2 WebSocket path. The UI must not build a whole recording Blob/WAV or call compatibility batch STT.
- Keep manual voice mode explicit through the compact Command/Dictation selector beside each visible mic entry point.
  Command is the default and may auto-submit only an authoritative zero-drop final. Dictation always opens editable
  transcript review. Disable mode selection while capture or finalization is active and keep mic labels, titles, and
  status copy aligned with the selected mode.
- Dictation is always editable and never auto-executes. Command and hands-free may auto-submit only an authoritative,
  zero-drop final; degraded but non-empty finals enter the same editable transcript review, and cancelled or empty
  finals are discarded. A hands-free review pauses microphone capture until confirmation or discard.
- Open and accept the v2 `ready` capability before connecting the PCM capture node. An armed hands-free socket may be
  refreshed after Core's idle deadline, but it must not retain or replay audio across that readiness gap.
- Reject fragmented letter noise and stock near-silence hallucinations before either manual or hands-free transcripts
  can enter chat. A low-quality transcript must never inherit context and accidentally trigger a mutation.
- In hands-free mode, play the processing cue only after hallucination filtering and wake routing confirm a reviewable
  command. Noise, wake-only speech, and non-wake speech must rearm silently.
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
- Keep STT model ownership server-side behind Core and the sidecar provider contract. The browser owns capture,
  review, normalization, entity resolution, and provider diagnostics, but does not ship a Moonshine or RunAnywhere
  runtime. A future browser-local engine requires an explicit architecture decision, pinned assets, integrity checks,
  provenance, and the same authorization-aware final transcript path; do not leave dormant model manifests or checks.
- Treat `package.json` as the UI release-version source of truth. Vite injects that version and a build commit SHA into
  `$lib/app-metadata`; login and authenticated application footers must consume those shared values instead of
  hard-coding release strings. Docker publication must pass `github.sha` as `VITE_BUILD_SHA`; local builds may derive
  the current Git commit and fall back to `dev` only when neither source is available.
- Keep text chat on the main orb click and expose microphone activation as a distinct control attached to the orb.
  Voice capture can stay panel-free until a command needs review or entity clarification.
- STT capture (`src/lib/voice/audio/`) uses one AudioWorkletNode by default — no ScriptProcessorNode on that path.
  Preload the worklet module as soon as the shared `AudioContext` exists (`preloadSttWorklet` in `ensureAudioContext`)
  so the later per-utterance graph build (`AudioCaptureSession.prepare`) stays fast even on the VAD-onset
  hot path. `setara.asa.voice.legacyScriptProcessor`
  in localStorage is a reversible kill-switch back to the old `ScriptProcessorNode` path.
  **Vite gotcha:** never load a worklet with a bare `new URL('./file.ts', import.meta.url)` — Vite treats an
  unrecognized `.ts` asset reference as opaque static data and inlines the *raw, un-transpiled TypeScript source* as a
  `data:` URL with a nonsense MIME type (confirmed by inspecting the production build output). `audioWorklet.addModule()`
  then fails outright in a real browser. Use `import workletUrl from './worklets/foo.ts?worker&url'` instead — it runs
  the file (and its imports) through Vite's normal bundler and hands back the URL to the compiled chunk. Always verify
  a new worklet/worker asset by grepping the actual `.svelte-kit/output/client/**` bundle for its compiled contents,
  not just `npm run check`/`npm run build` exiting 0 — a bad asset reference builds and type-checks cleanly.
- Noise suppression (`src/lib/voice/audio/enhancer/`) hides the vendor package
  (`@sapphi-red/web-noise-suppressor`, exact-pinned) behind one `AudioEnhancer` interface
  (`audio-enhancer.ts`). Nothing outside `enhancer/` imports the vendor package directly — the factory
  (`enhancer-factory.ts`) resolves a requested mode (`auto|speex|rnnoise|browser|none`) against detected
  capabilities (`enhancer-capabilities.ts`: audioWorklet/wasm/wasmSimd) and always returns a working enhancer,
  falling back to a no-op `PassthroughEnhancer('browser')` on any construction/init error. `auto` resolves to
  browser-native by default (`preferredEnhancedMode: 'browser'` in `sidecar-voice.svelte.ts`) — it does NOT
  promote to Speex or RNNoise until real WER/CER corpus evidence justifies it (setara-ikmt). This was a real
  incident, not a design footnote: shipping `auto -> speex` measurably degraded STT accuracy for effectively
  every user, because Speex is a narrowband (8kHz-era) preprocessor run unconditionally on full wideband
  (48kHz) mic input, and the corpus validation that should have gated it never happened. Explicit `speex`/
  `rnnoise` requests still work and fall back to `browser` if unsupported, never throw — they're just no
  longer reachable through `auto`.
  `buildMicrophoneConstraints(mode)` in `audio-constraints.ts` turns off the browser's own `noiseSuppression`
  when an enhanced mode is active, so exactly one suppressor ever runs on the signal.
  The enhancer graph is a wet/dry bypass (`dryGain`/`wetGain`/`outputGain`), not a connect/disconnect toggle —
  `setBypass()` just flips gain values, so it's an instant, click-free switch. `AudioCaptureSession.prepare()`
  resolves the enhancer *before* building the mic→enhancer→worklet graph, and if the requested mode fell back,
  it reacquires the `MediaStream` with `buildMicrophoneConstraints('browser')` constraints (stopping the old
  track) since the original `getUserMedia` call may have requested the wrong native suppression setting.
  `@sapphi-red/web-noise-suppressor` subclasses the global `AudioWorkletNode` at import time, so it throws
  `ReferenceError` if imported outside a browser (e.g. Node test runner) — files that reach that import chain
  are covered by string-assertion tests (`tests/asa-audio-enhancer.test.mjs`) rather than real execution; only
  the DOM-free files (`enhancer-capabilities.ts`, `audio-constraints.ts`) get real-execution unit tests. Same
  `?url`/`?worker&url` bundling rule as the STT worklet applies to the vendor's `speexWorklet.js`/`speex.wasm`
  — verify by grepping the compiled bundle, not just a clean build exit code.
- RNNoise (`sapphi-red-rnnoise-enhancer.ts`, setara-f05x.11) is a second `AudioEnhancer` behind the same factory,
  structurally identical to the Speex one (wet/dry bypass graph, lazy-cached WASM+worklet, `?url` imports for
  `rnnoiseWorklet.js`/`rnnoise.wasm`/`rnnoise_simd.wasm`). It is reachable only through an explicit `rnnoise`
  request — same as Speex, `auto` does not resolve to it (see the browser-native-default note above); the
  gate is one hardcoded string in `sidecar-voice.svelte.ts`, not a feature flag. `loadRnnoise({ url, simdUrl })` lets the vendor package
  pick SIMD vs. non-SIMD internally — do not re-detect SIMD at this layer. In the pinned `0.3.5` version,
  `rnnoise.wasm` and `rnnoise_simd.wasm` are byte-identical (same SHA1), so Vite's content-hashing correctly
  dedupes them into one physical asset; that's expected, not a sign the SIMD import broke.
  The vendor RNNoise worklet computes but discards RNNoise's native per-frame VAD probability
  (`_rnnoise_process_frame`'s return value is thrown away, not `port.postMessage`'d) — there is no telemetry
  channel to source real `cpuLoad`/`overrunCount`/`quietSpeechRatio` diagnostics from, short of forking the
  vendor's bundled worklet. `AudioEnhancerDiagnostics` carries those three fields as `null`-always on every
  enhancer rather than inventing fake numbers; treat `null` as "not measurable," not "zero."
