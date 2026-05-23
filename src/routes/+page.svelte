<script lang="ts">
  import { getApiBaseUrl } from '$lib/api/config';

  const apiBaseUrl = getApiBaseUrl();
</script>

<svelte:head>
  <title>Setara</title>
</svelte:head>

<main class="shell">
  <section class="masthead">
    <div>
      <p class="eyebrow">Setara</p>
      <h1>Test case management</h1>
      <p class="lede">Project, execution, release plan, and automation reporting foundations are ready to connect.</p>
    </div>
    <div class="status-panel" aria-label="Runtime configuration">
      <span>Backend API</span>
      <strong>{apiBaseUrl}</strong>
    </div>
  </section>

  <section class="grid" aria-label="Primary work areas">
    <article>
      <h2>Projects</h2>
      <p>Tribe, squad, project, users, roles, and API keys.</p>
    </article>
    <article>
      <h2>Scenarios</h2>
      <p>Tree-structured manual and automated test case management.</p>
    </article>
    <article>
      <h2>Executions</h2>
      <p>Automation run status, scenario results, and live updates.</p>
    </article>
    <article>
      <h2>Plans</h2>
      <p>Release quality gates, selected executions, and coverage metrics.</p>
    </article>
  </section>
</main>
