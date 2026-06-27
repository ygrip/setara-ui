## Admin Settings Create Pattern

- Admin settings pages should open create forms in `Modal` components from the page header action.
- After a successful create, await the API call, refresh the local table data from the list endpoint, close the modal,
  then reset form state.
- Mock create helpers should mutate the same in-memory collections used by mock list helpers so table refresh behavior
  matches the real backend.

## ASA Interaction Pattern

- Keep the ASA panel anchored to the orb. Closing the panel cancels the active stream and returns the orb to idle.
- Load session messages newest-first from the cursor API, reverse each page for display, and prepend older pages while
  preserving the scroll offset. Backend agent context remains independently bounded.
- Render `thinking` protocol events in the pending assistant message and replace them as response tokens arrive.
- Voice is opt-in and local-first: request microphone access from a user gesture, download only pinned permissively
  licensed Sherpa-ONNX models, review the transcript before sending, and persist speech speed, volume, and auto-speak
  preferences locally.
- Keep Sherpa runtime assets behind the Vite asset plugin and validate model revisions, checksums, sizes, and licenses
  with `npm run check:voice-models`.

## ASA Transcript Normalization Pattern

- Preserve the exact STT output as `rawText` and produce a separate `normalizedText` plus ordered applied-rule IDs.
- Keep normalization deterministic, idempotent, and grammar-scoped. Spoken numbers are converted only in recognized
  contexts such as semantic versions and sprint labels.
- Do not correct product, project, plan, build, squad, or person names during normalization. Entity correction belongs
  to the contextual entity resolver, where ambiguity can be surfaced instead of silently guessed.
