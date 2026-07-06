<script lang="ts">
  import { AppSkeleton } from '$lib/ui/display';
</script>

<div class="summary-skeleton" aria-label="Loading project summary">
  {#each Array(5) as _}<AppSkeleton height="84px" />{/each}
</div>
<div class="toolbar-skeleton"><AppSkeleton height="64px" /></div>
<div class="card-skeletons" aria-label="Loading projects">
  {#each Array(8) as _}<AppSkeleton height="240px" />{/each}
</div>

<style>
  .summary-skeleton, .card-skeletons { display: grid; gap: 0.75rem; }
  .summary-skeleton { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .toolbar-skeleton { margin: 1rem 0; }
  .card-skeletons { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  @media (max-width: 1100px) { .summary-skeleton { grid-template-columns: repeat(3, 1fr); } .card-skeletons { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 800px) { .summary-skeleton, .card-skeletons { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 560px) { .summary-skeleton, .card-skeletons { grid-template-columns: 1fr; } }
</style>
