# Setara Card Family

Setara keeps cards as product-owned components. Do not replace these with generic Flowbite cards.

- `Card.svelte`: low-level surface shell for generic panels and links.
- `BentoCard.svelte`: larger dashboard and summary grouping surface.
- `MetricCard.svelte`: numeric analytics and quality indicators.
- `StatusCard.svelte`: domain state card for run, gate, release, import, and readiness status.
- `ActionCard.svelte`: clickable setup/navigation action surface.

All card-family components should use Setara design tokens, `var(--radius)`, `var(--shadow)`, coherent hover/focus states, and responsive sizing that works in one-column mobile layouts.

