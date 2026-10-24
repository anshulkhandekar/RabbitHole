import { Store } from "../apps/server/src/store";
export function capture(
  id = "c1",
  text = "A GPU uses parallel execution to process many operations at once.",
) {
  return {
    id,
    sessionId: "s1",
    sourceType: "article" as const,
    url: "https://example.org/gpu",
    title: "Public example — synthetic test fixture",
    text,
    timestamp: new Date().toISOString(),
  };
}
export function analysis() {
  return {
    sessionId: "s1",
    expectedVersion: 0,
    title: "How parallel computing fits together",
    concepts: [
      {
        id: "n1",
        label: "GPU",
        explanation: "A processor designed for parallel workloads.",
        captureIds: ["c1"],
      },
      {
        id: "n2",
        label: "Parallel execution",
        explanation: "Multiple operations proceed at once.",
        captureIds: ["c1"],
      },
    ],
    edges: [
      {
        id: "e1",
        source: "n1",
        target: "n2",
        label: "uses",
        explanation:
          "The supplied fixture states that a GPU uses parallel execution.",
        captureIds: ["c1"],
        evidenceKind: "supported" as const,
      },
    ],
    studyItems: [
      {
        id: "q1",
        type: "quiz" as const,
        prompt: "Which execution model is described?",
        answer: "Parallel execution.",
        choices: ["Sequential only", "Parallel execution"],
        correctIndex: 1,
        conceptIds: ["n1", "n2"],
        captureIds: ["c1"],
      },
      {
        id: "r1",
        type: "connection" as const,
        prompt: "Explain how a GPU uses parallel execution.",
        answer: "Many operations proceed at once in the supplied example.",
        conceptIds: ["n1", "n2"],
        captureIds: ["c1"],
      },
      {
        id: "f1",
        type: "flashcard" as const,
        prompt: "What execution model does the example GPU use?",
        answer: "Parallel execution.",
        conceptIds: ["n1"],
        captureIds: ["c1"],
      },
    ],
    processedCaptureIds: ["c1"],
  };
}
export function setup() {
  const db = new Store(":memory:");
  db.create("alice", { id: "s1", title: "Research" });
  db.capture("alice", "s1", capture());
  return db;
}
