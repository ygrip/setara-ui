export function load({ params }: { params: { projectKey: string } }) {
  return { projectKey: params.projectKey };
}
