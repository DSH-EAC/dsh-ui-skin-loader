import assert from "node:assert/strict";
import { test } from "node:test";

import { SKIN_ID } from "./index.ts";

test("aurora skin skeleton exports its skin id", () => {
  assert.equal(SKIN_ID, "aurora");
});
