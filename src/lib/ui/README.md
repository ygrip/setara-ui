# Setara UI Wrapper Layer

This folder is the integration boundary for generic UI primitives. Feature pages should import these Setara wrappers instead of importing Flowbite or any future UI library directly.

Flowbite is treated as infrastructure, not Setara identity. Setara-owned product surfaces such as `Card`, bento cards, `MetricCard`, scenario grids, suite trees, quality panels, and the custom loader remain custom.

## Wrapper Groups

- `feedback`: transient and persistent feedback such as `AppToast`, `AppAlert`, and `AppProgress`.
- `overlay`: generic overlays such as `AppModal`, `AppDrawer`, `AppDropdown`, and `AppPopover`.
- `navigation`: workflow navigation such as `AppTabs`, `AppStepper`, and `AppPagination`.
- `display`: small display primitives such as `AppBadge`, `AppTooltip`, and `AppSkeleton`.
- `loading`: Setara-branded loading wrappers built on the custom loader.

## Rules

- Use toast only for short-lived feedback.
- Use alert/banner components for persistent page state.
- Use modal for destructive confirmation.
- Use drawer for side details that should not navigate away.
- Keep the custom Setara loader for branded loading states.
- Keep Setara custom cards for dashboard, summary, and domain UI.

