import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SourceQuote } from "../apps/extension/src/Trail";
import { capture } from "./support";
import type { Session } from "../packages/contracts/src/index";

test("uncited page openings are not presented as evidence; cited highlights remain visible", () => {
  const source = capture("c1", "Buy the author's unrelated course.");
  const session = {
    captures: [source],
    hidden: [],
    removed: [],
  } as unknown as Session;
  const html = renderToStaticMarkup(
    React.createElement(SourceQuote, { session, id: "c1" }),
  );
  assert.doesNotMatch(html, /unrelated course/);
  assert.match(html, /No excerpt saved/);
  assert.match(html, /https:\/\/example.org\/gpu/);
  assert.match(html, /Public example/);
  source.sourceType = "highlight" as any;
  const highlight = renderToStaticMarkup(
    React.createElement(SourceQuote, { session, id: "c1" }),
  );
  assert.match(highlight, /unrelated course/);
  assert.doesNotMatch(highlight, /No excerpt saved/);
});
