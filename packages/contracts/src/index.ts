import { z } from "zod";
export const Id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const HttpUrl = z
  .string()
  .url()
  .max(2048)
  .refine((s) => /^https?:\/\//.test(s), "HTTP(S) URL required");
export const Preferences = z.object({
  depth: z.enum(["brief", "balanced", "deep"]).default("balanced"),
  analogy: z.string().max(300).default("everyday examples"),
  activities: z
    .array(z.enum(["connection", "flashcard", "quiz", "matching"]))
    .min(1)
    .max(4)
    .default(["quiz", "matching"]),
  articleCapture: z.boolean().default(true),
  autoHighlights: z.boolean().default(false),
});
export const Capture = z.object({
  id: Id,
  sessionId: Id,
  sourceType: z.enum(["search", "article", "highlight", "google_ai_overview"]),
  url: HttpUrl,
  title: z.string().max(300),
  text: z.string().trim().min(1).max(12000),
  timestamp: z.string().datetime(),
  parentCaptureId: Id.optional(),
  tag: z.enum(["important", "confusing", "none"]).default("none"),
  references: z.array(HttpUrl).max(20).default([]),
});
const Evidence = z.array(Id).min(1).max(20);
const Excerpts = z
  .array(z.object({ captureId: Id, quote: z.string().trim().min(1).max(600) }))
  .max(3)
  .optional();
export const Concept = z.object({
  main: z.boolean().optional(),
  id: Id,
  label: z.string().min(1).max(90),
  explanation: z.string().min(1).max(1800),
  captureIds: Evidence,
  gap: z.string().max(500).optional(),
  parentId: Id.optional(),
  takeaways: z.array(z.string().min(1).max(400)).max(5).optional(),
  example: z.string().max(900).optional(),
  boundary: z.string().max(700).optional(),
  evidence: Excerpts,
});
export const Edge = z.object({
  id: Id,
  source: Id,
  target: Id,
  label: z.string().min(1).max(90),
  explanation: z.string().min(1).max(1800),
  captureIds: Evidence,
  evidenceKind: z.enum(["supported", "inference", "supplemental"]),
  example: z.string().max(900).optional(),
  evidence: Excerpts,
});
export const Study = z
  .object({
    id: Id,
    concept: Id.optional(),
    type: z.enum(["connection", "flashcard", "quiz", "matching"]),
    prompt: z.string().min(1).max(600),
    answer: z.string().min(1).max(1800),
    choices: z.array(z.string().min(1).max(300)).min(2).max(5).optional(),
    correctIndex: z.number().int().min(0).optional(),
    choiceExplanations: z
      .array(z.string().min(1).max(500))
      .min(2)
      .max(5)
      .optional(),
    level: z.enum(["understand", "apply", "transfer"]).optional(),
    pairs: z
      .array(
        z.object({
          concept: Id.optional(),
          left: z.string().min(1).max(180),
          right: z.string().min(1).max(400),
        }),
      )
      .min(2)
      .max(6)
      .optional(),
    evidence: Excerpts,
    conceptIds: z.array(Id).min(1).max(10),
    captureIds: Evidence,
  })
  .superRefine((v, c) => {
    if (
      v.choiceExplanations &&
      v.choiceExplanations.length !== v.choices?.length
    )
      c.addIssue({
        code: "custom",
        message: "Choice explanations must match choices",
      });
    if (
      v.type === "matching" &&
      (!v.pairs ||
        new Set(v.pairs.map((p) => p.left)).size !== v.pairs.length ||
        new Set(v.pairs.map((p) => p.right)).size !== v.pairs.length)
    )
      c.addIssue({
        code: "custom",
        message: "Matching requires distinct pairs",
      });
    if (
      v.type === "quiz" &&
      (!v.choices ||
        v.correctIndex === undefined ||
        v.correctIndex >= v.choices.length ||
        new Set(v.choices).size !== v.choices.length)
    )
      c.addIssue({
        code: "custom",
        message: "Quiz requires unique choices and valid correctIndex",
      });
  });
export const AnalysisInput = z.object({
  summary: z.string().max(1600).optional(),
  takeaways: z
    .array(z.object({ text: z.string().max(400), concept: Id.optional() }))
    .max(5)
    .optional(),
  route: z.array(Id).max(40).optional(),
  sessionId: Id,
  expectedVersion: z.number().int().min(0),
  title: z.string().min(1).max(140),
  intent: z.enum(["incremental", "rebuild"]).optional(),
  overview: z
    .object({
      rootConceptId: Id,
      summary: z.string().min(1).max(1600),
      takeaways: z.array(z.string().min(1).max(400)).min(1).max(5),
      route: z.array(Id).min(1).max(12),
    })
    .optional(),
  concepts: z.array(Concept).min(1).max(40),
  edges: z.array(Edge).max(70),
  studyItems: z.array(Study).max(40),
  processedCaptureIds: z.array(Id).max(100),
});
export type CaptureData = z.infer<typeof Capture>;
export type AnalysisData = z.infer<typeof AnalysisInput>;
export type Prefs = z.infer<typeof Preferences>;
export type Session = {
  id: string;
  title: string;
  short?: string;
  status: "active" | "paused" | "finished";
  createdAt: string;
  updatedAt: string;
  version: number;
  settings: Prefs;
  analysis: AnalysisData | null;
  analysisPreferences?: Prefs;
  analyzedAt?: string;
  processed: string[];
  captures: CaptureData[];
  attempts: Attempt[];
};
export const Review = z.object({
  id: Id,
  studyId: Id,
  analysisVersion: z.number().int().positive(),
  response: z.string().max(3000).default(""),
  rating: z.enum(["again", "partly", "understood"]),
  choice: z.number().int().min(0).optional(),
  matches: z.array(z.number().int().min(0)).min(2).max(6).optional(),
  timestamp: z.string().datetime(),
});
export type Attempt = z.infer<typeof Review>;
export const SessionCreate = z.object({
  id: Id,
  title: z.string().min(1).max(140),
  settings: Preferences.default(() => Preferences.parse({})),
});
export const SessionPatch = z.object({
  title: z.string().min(1).max(140).optional(),
  status: z.enum(["active", "paused", "finished"]).optional(),
  settings: Preferences.optional(),
});
