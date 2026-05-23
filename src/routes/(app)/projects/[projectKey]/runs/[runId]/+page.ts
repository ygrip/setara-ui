export async function load({ params }: { params: { projectKey: string; runId: string } }) {
  return { projectKey: params.projectKey, runId: params.runId };
}
