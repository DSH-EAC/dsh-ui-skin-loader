import assert from "node:assert/strict";
import { test } from "node:test";

import {
  apply,
  Config,
  CONVENTION_ID,
  LOADER_SLOT_PREFIX,
  SERVICE_NAME,
  SETTINGS_NAMESPACE,
} from "./index.ts";

test("host half exports the convention id and reserved names", () => {
  assert.equal(CONVENTION_ID, "dsh.ecosystem.ui-skin-loader/v1");
  assert.equal(SERVICE_NAME, "uiSkinLoader");
  assert.equal(SETTINGS_NAMESPACE, "dsh-ui-skin-loader");
  assert.equal(LOADER_SLOT_PREFIX, "io.github.dsh-eac.skin.loader.");
});

test("host half exports a Config schema (settings namespace) and the apply entry", () => {
  assert.equal(typeof apply, "function");
  assert.equal(typeof Config, "function");
  assert.equal(typeof Config.toJSON, "function");
  // 行 id == settings 命名空间（api-notes §8.1），cordis.patch.yml 与此一致
  const dict = Config.dict ?? {};
  for (const field of ["activeSkin", "faultLog", "diagnosticsEnabled"]) {
    assert.ok(dict[field], `Config.${field} must be declared`);
  }
});
