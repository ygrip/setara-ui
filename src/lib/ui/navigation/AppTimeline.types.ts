export type AppTimelineItem = {
  id: string;
  title: string;
  detail?: string;
  meta?: string;
  tone?: import('$lib/ui/types').AppTone;
};
