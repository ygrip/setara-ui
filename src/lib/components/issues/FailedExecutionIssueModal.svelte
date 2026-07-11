<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { bulkCreateIssues, type BulkCreateIssuesResponse } from '$lib/api/issues';
  import type { AutomationRun, ScenarioRunResult, StepRunResult } from '$lib/api/runs';
  import { notify } from '$lib/ui/feedback/notify';

  const MAX_FAILED_SCENARIOS = 12;
  const MAX_DETAIL_LENGTH = 320;

  let {
    open,
    projectKey,
    executionId,
    run,
    failedResults,
    onclose,
    oncreated
  }: {
    open: boolean;
    projectKey: string;
    executionId: string;
    run: AutomationRun;
    failedResults: ScenarioRunResult[];
    onclose: () => void;
    oncreated: (response: BulkCreateIssuesResponse) => void;
  } = $props();

  let busy = $state(false);
  let error = $state('');
  let result = $state<BulkCreateIssuesResponse | null>(null);

  const orderedFailures = $derived([...failedResults].sort((left, right) => {
    const sequence = (left.sequenceNo ?? Number.MAX_SAFE_INTEGER) - (right.sequenceNo ?? Number.MAX_SAFE_INTEGER);
    if (sequence !== 0) return sequence;
    const key = (left.scenarioKey ?? '').localeCompare(right.scenarioKey ?? '');
    if (key !== 0) return key;
    return left.scenarioName.localeCompare(right.scenarioName);
  }));
  const visibleFailures = $derived(orderedFailures.slice(0, MAX_FAILED_SCENARIOS));
  const omittedCount = $derived(Math.max(0, orderedFailures.length - visibleFailures.length));
  const summary = $derived(`${projectKey}: execution ${executionId.slice(0, 8)} has ${orderedFailures.length} failed scenario${orderedFailures.length === 1 ? '' : 's'}`);
  const description = $derived(buildDescription(projectKey, executionId, run, visibleFailures, omittedCount));

  function concise(value: string | null | undefined): string | null {
    if (!value) return null;
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) return null;
    return normalized.length > MAX_DETAIL_LENGTH ? `${normalized.slice(0, MAX_DETAIL_LENGTH - 1)}…` : normalized;
  }

  function failedStep(result: ScenarioRunResult): StepRunResult | null {
    if (!result.stepsJson?.length) return null;
    if (result.failedStepIndex != null) return result.stepsJson[result.failedStepIndex] ?? null;
    return result.stepsJson.find(step => step.status?.toUpperCase() === 'FAILED') ?? null;
  }

  // Markdown-lite: headings (#), **bold**, [text](url) links, and pipe tables - parsed into
  // real Jira ADF (headings/marks/table nodes) server-side by AdfTextBuilder.
  function tableCell(value: string | null | undefined): string {
    return (value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ') || '-';
  }

  function executionLink(currentExecutionId: string): string {
    if (typeof window === 'undefined') return currentExecutionId;
    return `${window.location.origin}/projects/${projectKey}/executions/${currentExecutionId}`;
  }

  function buildDescription(
    currentProjectKey: string,
    currentExecutionId: string,
    currentRun: AutomationRun,
    failures: ScenarioRunResult[],
    omitted: number
  ): string {
    const environment = concise(currentRun.environment);
    const branch = concise(currentRun.branch);

    const blocks = [
      '# Setara execution failure summary',
      [
        `**Project:** ${currentProjectKey}`,
        `**Execution:** [${currentExecutionId.slice(0, 8)}](${executionLink(currentExecutionId)})`,
        `**Status:** ${currentRun.status}`,
        environment ? `**Environment:** ${environment}` : null,
        branch ? `**Branch:** ${branch}` : null
      ].filter(Boolean).join('\n')
    ];

    blocks.push(`## Failed scenarios (${failures.length + omitted})`);

    if (failures.length > 0) {
      const rows = failures.map((failure) => {
        const step = failedStep(failure);
        const exception = [concise(failure.exceptionType), concise(failure.exceptionMessage)]
          .filter(Boolean).join(': ');
        const stepError = concise(step?.errorMessage);
        return [
          tableCell(failure.scenarioKey ?? 'No scenario key'),
          tableCell(failure.scenarioName),
          tableCell(failure.featureName),
          tableCell(exception || null),
          tableCell(stepError)
        ];
      });
      blocks.push([
        '| Key | Scenario | Feature | Exception | Step error |',
        '| --- | --- | --- | --- | --- |',
        ...rows.map((cells) => `| ${cells.join(' | ')} |`)
      ].join('\n'));
    }

    if (omitted > 0) {
      blocks.push(`… ${omitted} additional failed scenario${omitted === 1 ? '' : 's'} omitted.`);
    }
    return blocks.join('\n\n');
  }

  async function confirmCreate() {
    if (busy) return;
    busy = true;
    error = '';
    result = null;
    try {
      const response = await bulkCreateIssues({
        executionId,
        issues: [{ issueType: 'Bug', summary, description, priority: null, scenarioKey: null }]
      });
      result = response;
      if (response.created.length > 0) {
        oncreated(response);
        notify.success(`Created issue ${response.created.map((c) => c.issueKey).join(', ')}`);
        if (response.failed.length === 0) onclose();
      }
      if (response.failed.length > 0) {
        notify.error(response.failed.map((f) => `${f.summary}: ${f.reason}`).join('; '));
      }
    } catch (cause) {
      error = (cause as Error).message;
      notify.error(error);
    } finally {
      busy = false;
    }
  }

  function handleClose() {
    if (busy) return;
    error = '';
    result = null;
    onclose();
  }
</script>

<Modal {open} title="Create issue from failed scenarios" size="lg" onclose={handleClose}>
  <div class="content">
    <p class="hint">One issue will summarize this execution's failed scenarios. Review the generated content before creating it.</p>
    <label class="field" for="failed-execution-issue-summary">
      <span>Summary</span>
      <input id="failed-execution-issue-summary" class="input" value={summary} readonly />
    </label>
    <label class="field" for="failed-execution-issue-description">
      <span>Description</span>
      <textarea id="failed-execution-issue-description" class="input description" value={description} rows="14" readonly></textarea>
    </label>
    {#if error}<p class="error" role="alert">Could not create issue: {error}</p>{/if}
    {#if result?.failed.length}
      <p class="error" role="alert">{result.failed.map(item => `${item.summary}: ${item.reason}`).join(' ')}</p>
    {/if}
    <div class="actions">
      <Button variant="secondary" size="sm" onclick={handleClose} disabled={busy}>Cancel</Button>
      <Button variant="primary" size="sm" onclick={confirmCreate} disabled={busy}>
        {busy ? 'Creating…' : 'Create issue'}
      </Button>
    </div>
  </div>
</Modal>

<style>
  .content { display: flex; flex-direction: column; gap: 12px; }
  .hint { margin: 0; color: var(--color-text-muted); font-size: .875rem; line-height: 1.45; }
  .field { display: flex; flex-direction: column; gap: 5px; color: var(--color-text-muted); font-size: .8rem; font-weight: 600; }
  .input { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-bg); color: var(--color-text); font: inherit; font-weight: 400; }
  .description { resize: vertical; white-space: pre-wrap; }
  .error { margin: 0; color: var(--color-danger); font-size: .8125rem; line-height: 1.4; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; }
</style>
