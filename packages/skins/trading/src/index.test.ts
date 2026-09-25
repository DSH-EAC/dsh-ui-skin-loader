import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { CSS_PREFIX, ENTRY_ID, SKIN_ID, SKIN_META } from "./identity.ts";
import { ACTIVE_BODY_MARKER, UPSTREAM_PACKAGE } from "./markers.ts";
import { TRADING_PREVIEW_SVG } from "./preview.ts";

// ---------------------------------------------------------------------------
// 身份常量（公约 §3 形态）
// ---------------------------------------------------------------------------

test("skin id matches the covenant §3 pattern and metadata is complete", () => {
  assert.match(SKIN_ID, /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/);
  assert.notEqual(SKIN_ID, "default");
  assert.equal(SKIN_META.apiVersion, "dsh.ecosystem.ui-skin-loader/v1");
  assert.equal(SKIN_META.id, "dsh-eac.skin.trading");
  assert.equal(SKIN_META.name, "交易终端");
  assert.equal(ENTRY_ID, "dsh-eac-skin-trading");
});

// ---------------------------------------------------------------------------
// 预览 SVG（T2.5 教训：gradient id 必须带皮肤命名空间）
// ---------------------------------------------------------------------------

test("trading preview SVG is deterministic and namespaced", () => {
  const first = TRADING_PREVIEW_SVG;
  assert.equal(first, TRADING_PREVIEW_SVG, "preview generation must be deterministic");
  assert.ok(first.startsWith("<svg"), "must be an inline SVG");
  assert.ok(first.includes(`id="${CSS_PREFIX}-preview-bg"`), "gradient ids carry the skin prefix");
  assert.ok(first.includes(`url(#${CSS_PREFIX}-preview-bg)`), "gradient is referenced");
  assert.ok(first.includes(SKIN_META.name), "preview shows the display name");
  assert.ok(!/\sid="(?!skn-trading)[^"]*"/.test(first), "no un-namespaced id attribute");
  assert.ok(!first.includes("data:image"), "preview embeds no bitmap asset");
});

// ---------------------------------------------------------------------------
// vendored 上游模块的内容不变量（迁移完整性锁）
// ---------------------------------------------------------------------------

const vendoredSource = readFileSync(
  fileURLToPath(new URL("./vendor/dsh-web-ui-client.js", import.meta.url)),
  "utf8",
);

test("vendored module keeps the upstream skin namespace and drops the bundling shell", () => {
  assert.ok(vendoredSource.includes(`body[${ACTIVE_BODY_MARKER}]`), "upstream CSS stays scoped to its own body marker");
  assert.ok(vendoredSource.includes(`data-plugin-css`), "upstream style-node marker kept");
  assert.ok(vendoredSource.includes("export { apply };"), "ESM export appended");
  for (const forbidden of [
    "window.__ModuleLoader__",
    "sourceMappingURL",
    "uiSkinLoader",
    "dsh-ui-skin-loader",
    "data-usl-",
  ]) {
    assert.ok(!vendoredSource.includes(forbidden), `vendored module must not contain ${forbidden}`);
  }
});

test("vendored module has no module-scope DOM side effects (S3: nothing runs before activation)", () => {
  // 上游在模块顶层执行 style 注入（"未激活先执行"）；公约化改造把它移进 apply。
  // 内容锁：模块顶层不得出现 `document.` 的执行语句（注释与 apply 体内除外）。
  const topLevelDocumentStatements = vendoredSource
    .split("\n")
    .filter((line) => /^\t\tif \(typeof document !== "undefined"/.test(line));
  assert.equal(
    topLevelDocumentStatements.length,
    0,
    "the style injection must live inside apply(), not at module scope",
  );
  assert.ok(
    /function apply\(ctx\) \{\n\t\t\tconst tagId = /.test(vendoredSource),
    "the relocated injection block is the first statement of apply()",
  );
});

test("upstream body marker does not collide with the loader or other skins", () => {
  assert.ok(ACTIVE_BODY_MARKER.startsWith("data-dsh-"), "upstream marker namespace");
  assert.ok(!ACTIVE_BODY_MARKER.startsWith("data-usl-"), "not the loader namespace (R2)");
  assert.ok(!["data-dsh-aurora", "data-dsh-inkwash"].includes(ACTIVE_BODY_MARKER), "not another skin's marker (R3)");
  assert.equal(UPSTREAM_PACKAGE, "@linxin666/dsh-client-ui-skin-trading");
});
