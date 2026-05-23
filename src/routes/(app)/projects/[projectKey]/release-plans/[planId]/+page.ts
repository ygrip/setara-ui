export async function load({ params }: { params: { projectKey: string; planId: string } }) {
  return { projectKey: params.projectKey, planId: params.planId };
}
