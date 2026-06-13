# Setara Domain UI Wrappers

Domain wrappers map Setara business states into the generic UI wrapper layer. Pages should prefer these components over hand-picked colors.

- `ScenarioStatusBadge`: scenario, build, run, and import status badge mapping.
- `QualityGateAlert`: quality gate readiness as persistent alert state.
- `RunSessionTimeline`: automation run events rendered through `AppTimeline`.
- `ImportProgressPanel`: import status plus row progress.
- `ApiKeyRotateModal`: API key rotate/revoke confirmation copy and actions.
- `ReleaseGateStatusCard`: release readiness state card.

Fallback rule: unknown or missing statuses render as `neutral`/`Unknown`.

