export type Handoff = {
  sessionId: string;
  prompt: string;
  copied: boolean;
  opened: boolean;
  version: number;
  captureIds: string[];
  startedAt: string;
  status: "waiting" | "stalled";
};
