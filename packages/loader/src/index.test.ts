import assert from "node:assert/strict";
import { test } from "node:test";

import { CONVENTION_ID } from "./index.ts";

test("loader skeleton exports the convention id", () => {
  assert.equal(CONVENTION_ID, "dsh.ecosystem.ui-skin-loader/v1");
});
