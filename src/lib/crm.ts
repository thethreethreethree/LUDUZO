export const LEAD_STAGES = ["new", "contacted", "toured", "trial", "won", "lost"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];
