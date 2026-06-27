# IMPORTANT Rules

- This is `setara-ui`, a SvelteKit frontend for Setara test management.
- This project allows AI-assisted changes, but edits must stay clean, maintainable, and reviewable.
- Always ask me for clarification when you have insufficient context
- Avoid creating something redundant, reuse or improve existing
  - An implementation should have pattern or structure behind it, store meaningful pattern or structure on `.KNOWLEDGE.md`
  - Use or improve whenever a similar pattern is found on `KNOWLEDGE.md` , when you made changes or improvement make sure to update the related `KNOWLEDGE.md`
- Use `rtk` to maintain low cost
- This project does not have `bd` directly, use `bd` on the parent directory
- Prioritize long-term correctness over quick patches. Avoid band-aid fixes. Prefer small, coherent changes that improve the design without rewriting unrelated code.

## PR instructions
- Title format: `[<project_name>] <Title>`
- Avoid adding agent-assisted commit message
- Make the commit message concise yet clear enough
- Always run `npm check` before committing.
- When import changes or adding, removing any library, dependencies, do `npm run install` and then do `npm ci`

## Code Style

Follow the committed formatter/linter configuration.

General rules:

* Use TypeScript.
* Prefer explicit types at API boundaries.
* Avoid `any` unless there is no practical alternative.
* Do not reformat unrelated files.
* Do not move files unless it clearly improves structure.
* Do not introduce wildcard-style barrel exports that make ownership unclear.
* Keep components readable over overly clever abstraction.
* Prefer semantic line breaks for long expressions.
* Keep markup readable and visually grouped.

Recommended formatting:

* 2 spaces indentation.
* Max line length around 100–120.
* One prop per line when a component call becomes dense.
* One class group per readable section.
* Prefer early returns in functions.
* Prefer derived constants over complex inline expressions.

## Component Design Rules

- Prefer small, reusable components for repeated UI structure.
- Avoid creating components for one-off markup unless it improves readability.
- Component files should have a clear purpose
- For reusable components, prefer simple props over large config objects unless the config object is stable and reused.

# Boilerplate Reduction Policy

Agents may reduce boilerplate using these approaches:

* Reusable layout components
* Reusable form components
* Reusable modal components
* Reusable table components
* Typed API client helpers
* Typed domain models
* Small utility functions
* Constants for routes, statuses, permissions, labels
* Feature-level stores when state is shared
* Local component state when state is not shared

Do not reduce boilerplate by hiding important UI behavior behind unclear abstractions.

## AI Feature Rules

For AI features:

* Do not show raw `data:` prefixes from SSE.
* Normalize streaming chunks before display.
* Avoid showing internal tool-call loading unless it is intentionally user-facing.
* Prefer enriched Markdown rendering for AI review output.
* Keep AI loading visuals consistent with semantic search and assistant patterns.
* Support cancellation when the existing API supports it.
* Preserve partial results when useful.
* Do not parse AI review output as JSON unless the backend contract explicitly requires JSON.

Streaming display should be stable and not flicker.

## Accessibility Rules

Agents should preserve basic accessibility:

* Buttons must be real `<button>` elements unless navigation requires `<a>`.
* Icon-only buttons need accessible labels.
* Inputs need labels or `aria-label`.
* Modals should be keyboard-friendly.
* Do not remove focus outlines without replacing them.
* Avoid color-only status indicators.
* Use semantic headings where practical.

## Styling Rules

Use the existing styling approach in the project.

Before adding new CSS:

1. Check existing utility classes/components.
2. Reuse tokens/classes where possible.
3. Keep styles scoped to the component.
4. Avoid global CSS unless it is a design token or app-wide primitive.

Do not introduce new color palettes unless asked.

## Error Handling

Do not swallow errors silently.

Show user-facing errors where appropriate.

For API errors:

* Normalize the error in the API client.
* Show useful user-facing messages.
* Avoid leaking raw stack traces.
* Preserve debugging information in console only when useful.

## Refactoring Rules

Before refactoring:

1. Understand the current behavior.
2. Identify the repeated pattern.
3. Extract the smallest useful abstraction.
4. Preserve user-visible behavior.
5. Avoid unrelated formatting changes.

Do not refactor across multiple modules unless requested.

Prefer incremental improvements.

## Dependency Rules

Before adding a dependency:

1. Check whether the project already has a solution.
2. Prefer small and maintained dependencies.
3. Avoid adding dependencies for trivial helpers.
4. Keep bundle size in mind.
5. Ensure the library works with SvelteKit.

Do not add a UI library just for one component unless it is already part of the project direction.

# Adhere my OPINION when it is relevant

Goal:
Create or update a repo-backed OPINIONS.md that captures my durable beliefs, changed views, recurring opinions, and meaningful refinements based on public sources I choose.

Before starting:
Collaborate with me to decide the input sources.

Ask me for any missing information, including:

1. Which public sources to use
   Examples: blog, newsletter, X/Twitter, Bluesky, Mastodon, LinkedIn, GitHub issues or comments, podcast transcripts, YouTube transcripts, RSS feeds, public talks, essays, or any other public archive.
2. How to access each source
   Examples: RSS feed URL, public profile URL, API access, export file, sitemap, transcript source, or local archive path.
3. Update OPINIONS.md with:
  - durable beliefs
  - changed views
  - recurring opinions
  - meaningful refinements to existing opinions
4. Ignore:
  - jokes
  - dunks
  - one-off reactions
  - weak or ambiguous signals
  - context-specific comments that should not become durable beliefs
  - content where the author is quoting, summarizing, or steelmanning someone else rather than expressing their own view
5. Preserve uncertainty. If a source item suggests a possible view but does not establish a durable opinion, do not add it as a belief.
   At most, mention it in the run summary as a weak signal.
