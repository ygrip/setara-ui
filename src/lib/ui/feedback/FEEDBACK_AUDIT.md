# Feedback Visual Audit

Canonical primitives:

- `notify.success|error|info|warning(...)` for short-lived feedback.
- `AppToastViewport` mounted once in `src/routes/+layout.svelte`.
- `AppToast` for transient notification rendering.
- `AppAlert` for persistent page state, validation summaries, backend connectivity, blocked release/import states, and non-transient errors.

Migrated in this pass:

- Repository copy feedback now uses `notify.success`.
- API key revoke/rotate action feedback now uses `notify`.
- Report export errors now render through `AppAlert`.
- AI review request errors now render through `AppAlert`.
- Repository and API key page load/action errors now render through `AppAlert`.

Remaining local classes:

- `error-banner` remains on page-level backend/load failures that should be migrated gradually to `AppAlert` as those pages are touched.
- `form-error`, `cf-error`, `footer-error`, and similar inline field/action errors remain local until a dedicated form-field wrapper is introduced.
- `chart-error`, `suggest-error`, `flags-error`, and other narrow inline states remain local because they are embedded inside specialized panels.

Rules for future migrations:

- Do not add new `class="toast"` usage. Use `notify`.
- Do not add new browser `alert(...)` usage. Use `notify` or `AppAlert`.
- Use `AppAlert` for page-level and persistent state.
- Use inline form errors only next to the field or action they describe.
- Keep error text short and sanitized before display.

