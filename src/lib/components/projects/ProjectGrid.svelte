<script lang="ts">
  import type { ProjectOverviewItem } from '$lib/api/projects';
  import ProjectCard from './ProjectCard.svelte';
  let { projects }: { projects: ProjectOverviewItem[] } = $props();
</script>

<div class="project-grid">
  {#each projects as project (project.id)}<ProjectCard {project} />{/each}
</div>

<style>
  .project-grid { display: grid; grid-template-columns: 1fr; gap: 1rem; }
  @media (min-width: 768px) { .project-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (min-width: 1024px) { .project-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (min-width: 1280px) { .project-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
</style>
