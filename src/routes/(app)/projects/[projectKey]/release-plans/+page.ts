export async function load({ params }: { params: { projectKey: string } }) {
  return { projectKey: params.projectKey, plans: [], error: null };
}
