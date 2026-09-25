import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ACTIVE_BODY_ATTR,
  buildAuroraCss,
  usesBuiltinGradient,
} from "./background.ts";
import { CSS_PREFIX, SKIN_ID, SKIN_META, THEME_ID } from "./identity.ts";
import { AURORA_PREVIEW_SVG } from "./preview.ts";
import { readBackgroundUrl, validateBackgroundUrl } from "./settings.ts";
import { AURORA_THEME } from "./theme.ts";

// ---------------------------------------------------------------------------
// preview SVG（T2.5 教训：gradient id 必须带皮肤命名空间）
// ---------------------------------------------------------------------------

test("aurora preview SVG is deterministic and namespaced", () => {
  const first = AURORA_PREVIEW_SVG;
  assert.equal(first, AURORA_PREVIEW_SVG, "preview generation must be deterministic");
  assert.ok(first.startsWith("<svg"), "must be an inline SVG");
  assert.ok(first.includes(`id="${CSS_PREFIX}-preview-bg"`), "gradient ids carry the skin prefix");
  assert.ok(first.includes(`url(#${CSS_PREFIX}-preview-bg)`), "gradient is referenced");
  assert.ok(first.includes(SKIN_META.name), "preview shows the display name");
  assert.ok(!/\sid="(?!skn-aurora)[^"]*"/.test(first), "no un-namespaced id attribute");
});

// ---------------------------------------------------------------------------
// 主题定义（api-notes §7 形态）
// ---------------------------------------------------------------------------

test("aurora theme registers a dark palette with alias tokens only", () => {
  assert.equal(AURORA_THEME.id, THEME_ID);
  assert.equal(AURORA_THEME.colorScheme, "dark");
  const keys = Object.keys(AURORA_THEME.tokens);
  assert.ok(keys.length > 0, "tokens must not be empty");
  for (const key of keys) {
    assert.ok(key.startsWith("--dsw-"), `token key must be a documented alias variable: ${key}`);
  }
  // 玻璃拟态的关键：表面 token 是半透明的
  assert.match(AURORA_THEME.tokens["--dsw-alias-bg-base"]!, /rgba\(/);
});

// ---------------------------------------------------------------------------
// 背景设置校验（皮肤自治设置的输入闸门）
// ---------------------------------------------------------------------------

test("background URL validation accepts empty and http(s) URLs", () => {
  assert.deepEqual(validateBackgroundUrl(""), { ok: true, value: "" });
  assert.deepEqual(validateBackgroundUrl("   "), { ok: true, value: "" }, "whitespace counts as empty");
  const ok = validateBackgroundUrl("https://example.com/aurora.png");
  assert.equal(ok.ok, true);
  assert.equal(ok.ok && ok.value, "https://example.com/aurora.png");
  const localhost = validateBackgroundUrl("http://localhost:18540/bg.png");
  assert.equal(localhost.ok, true, "http (incl. localhost) is accepted for real-machine verification");
});

test("background URL validation rejects non-URLs and non-web schemes", () => {
  assert.deepEqual(validateBackgroundUrl("not a url"), { ok: false, reason: "not-url" });
  assert.deepEqual(validateBackgroundUrl("/relative/path.png"), { ok: false, reason: "not-url" });
  assert.deepEqual(validateBackgroundUrl("javascript:alert(1)"), { ok: false, reason: "unsupported-scheme" });
  assert.deepEqual(validateBackgroundUrl("ftp://host/x.png"), { ok: false, reason: "unsupported-scheme" });
  assert.deepEqual(validateBackgroundUrl("data:image/png;base64,AAAA"), { ok: false, reason: "unsupported-scheme" });
});

test("readBackgroundUrl falls back to default on malformed snapshot values", () => {
  assert.equal(readBackgroundUrl(undefined), "");
  assert.equal(readBackgroundUrl(null), "");
  assert.equal(readBackgroundUrl(42), "");
  assert.equal(readBackgroundUrl({}), "");
  assert.equal(readBackgroundUrl({ backgroundUrl: 7 }), "");
  assert.equal(readBackgroundUrl({ backgroundUrl: "javascript:x" }), "", "invalid stored value never reaches CSS");
  assert.equal(readBackgroundUrl({ backgroundUrl: "https://ok.example/x.png" }), "https://ok.example/x.png");
});

// ---------------------------------------------------------------------------
// CSS 组装（确定性 + 命名空间 + 默认/自定义两分支）
// ---------------------------------------------------------------------------

test("aurora CSS is deterministic and fully namespaced", () => {
  const css = buildAuroraCss({ backgroundUrl: "" });
  assert.equal(css, buildAuroraCss({ backgroundUrl: "" }), "same input → same stylesheet");
  assert.ok(css.includes(`body[${ACTIVE_BODY_ATTR}]`), "background rule is scoped to the own body marker");
  assert.ok(css.includes(`data-${CSS_PREFIX}-backdrop`), "backdrop layer styled under own namespace");
  assert.ok(css.includes("pointer-events:none"), "decorative layer stays click-through");
  assert.ok(!css.includes("url("), "builtin branch embeds no external url");
  for (const marker of ["data-usl-", "dsh-ui-skin-loader", "data-ds-"]) {
    assert.ok(!css.includes(marker), `no loader/host reserved names in css: ${marker}`);
  }
});

test("aurora CSS switches to a scrimmed custom image when a URL is set", () => {
  const css = buildAuroraCss({ backgroundUrl: "https://example.com/aurora.png" });
  assert.ok(css.includes('url("https://example.com/aurora.png")'), "custom URL lands in url()");
  assert.ok(css.includes("background-size:auto,cover"), "image layer covers the viewport");
  assert.ok(css.includes("linear-gradient(180deg, rgba(7, 11, 28"), "dark scrim keeps text readable");
});

test("usesBuiltinGradient classifies snapshot values", () => {
  assert.equal(usesBuiltinGradient({ backgroundUrl: "" }), true);
  assert.equal(usesBuiltinGradient({ backgroundUrl: "https://x.example/a.png" }), false);
  assert.equal(usesBuiltinGradient({ backgroundUrl: "javascript:x" }), true, "invalid value → builtin");
});

// ---------------------------------------------------------------------------
// 身份常量（公约 §3 形态）
// ---------------------------------------------------------------------------

test("skin id matches the covenant §3 pattern", () => {
  assert.match(SKIN_ID, /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/);
  assert.notEqual(SKIN_ID, "default");
});
