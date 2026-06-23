export type RunSessionEvent = {
  id?: string;
  type: string;
  message?: string | null;
  status?: string | null;
  occurredAt: string;
};
