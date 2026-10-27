export type Handoff = {
  sessionId: string;
  prompt: string;
  copied: boolean;
  opened: boolean;
  version: number;
  captureIds: string[];
  startedAt: string;
  status: "waiting" | "stalled" | "saved" | "failed";
  reason?: string;
  savedAt?: string;
  savedVersion?: number;
  ideas?: number;
  questions?: number;
  finds?: number;
};
