import { test } from "node:test";
import assert from "node:assert/strict";
import { getUsers } from "../apps/server/src/config";
test("host-generated single-owner token works without a JSON credential upload", () => {
  assert.deepEqual(
    getUsers({ RABBITHOLE_TOKEN: "a".repeat(64), RABBITHOLE_OWNER: "anshul" }),
    [{ owner: "anshul", token: "a".repeat(64) }],
  );
  assert.deepEqual(
    getUsers({
      RABBITHOLE_USERS: JSON.stringify([
        { owner: "other", token: "b".repeat(64) },
      ]),
      RABBITHOLE_TOKEN: "a".repeat(64),
    }),
    [{ owner: "other", token: "b".repeat(64) }],
  );
});
test("missing or malformed credential configuration fails without leaking secrets", () => {
  for (const env of [
    {},
    { RABBITHOLE_TOKEN: "short" },
    { RABBITHOLE_USERS: "SENSITIVE_DO_NOT_LOG" },
  ]) {
    assert.throws(
      () => getUsers(env),
      (e) =>
        e instanceof Error &&
        !e.message.includes("SENSITIVE_DO_NOT_LOG") &&
        e.message.startsWith("Configure valid"),
    );
  }
});
