import { test } from "node:test";
import assert from "node:assert/strict";
import * as sdk from "@codahq/packs-sdk";
import { pack } from "../integrations/superhuman/pack";
// Removing per-user bearer auth would make this private MCP endpoint unusable in Go.
test("the MCP connector requires per-user bearer authentication without a shared system credential", () => {
  assert.equal(
    pack.defaultAuthentication?.type,
    sdk.AuthenticationType.HeaderBearerToken,
  );
  assert.equal(pack.systemConnectionAuthentication, undefined);
  assert.deepEqual(pack.networkDomains, ["rabbithole-1c5e.onrender.com"]);
  assert.equal(
    pack.mcpServers[0].endpointUrl,
    "https://rabbithole-1c5e.onrender.com/mcp?schema=8",
  );
});
