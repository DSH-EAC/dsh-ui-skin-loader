import assert from "node:assert/strict";
import { test } from "node:test";

import { ACTIVE_BODY_ATTR, buildInkwashCss } from "./background.ts";
import { CSS_PREFIX, SKIN_ID, SKIN_META } from "./identity.ts";
import { INKWASH_PREVIEW_SVG } from "./preview.ts";
import { INKWASH_THEME } from "./theme.ts";

test("inkwash preview SVG is deterministic and namespaced", () => {
  const first = INKWASH_PREVIEW_SVG;
  assert.equal(first, INKWASH_PREVIEW_SVG, "preview generation must be deterministic");
  assert.ok(first.startsWith("<svg"), "must be an inline SVG");
  assert.ok(first.includes(`id="${CSS_PREFIX}-preview-bg"`), "gradient ids carry the skin prefix");
  assert.ok(first.includes(SKIN_META.name), "preview shows the display name");
  assert.ok(!/\sid="(?!skn-inkwash)[^"]*"/.test(first), "no un-namespaced id attribute");
});

test("inkwash theme registers a light palette with alias tokens only", () => {
  assert.equal(INKWASH_THEME.id, "dsh-eac-skin-inkwash-paper");
  assert.equal(INKWASH_THEME.colorScheme, "light");
  const keys = Object.keys(INKWASH_THEME.tokens);
  assert.ok(keys.length > 0);
  for (const key of keys) {
    assert.ok(key.startsWith("--dsw-"), `token key must be a documented alias variable: ${key}`);
  }
  assert.match(INKWASH_THEME.tokens["--dsw-alias-bg-base"]!, /rgba\(/);
});

test("inkwash CSS is deterministic, namespaced and asset-free", () => {
  const css = buildInkwashCss();
  assert.equal(css, buildInkwashCss(), "same call → same stylesheet");
  assert.ok(css.includes(`body[${ACTIVE_BODY_ATTR}]`), "background rule is scoped to the own body marker");
  assert.ok(css.includes(`data-${CSS_PREFIX}-backdrop`), "backdrop layer styled under own namespace");
  assert.ok(css.includes("pointer-events:none"), "decorative layer stays click-through");
  assert.ok(!css.includes("url("), "inkwash embeds no external assets (pure CSS gradients)");
  for (const marker of ["data-usl-", "dsh-ui-skin-loader", "data-ds-", "skn-aurora"]) {
    assert.ok(!css.includes(marker), `no loader/host/other-skin reserved names in css: ${marker}`);
  }
});

test("skin id matches the covenant §3 pattern and metadata is complete", () => {
  assert.match(SKIN_ID, /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/);
  assert.equal(SKIN_META.apiVersion, "dsh.ecosystem.ui-skin-loader/v1");
  assert.equal(SKIN_META.id, "dsh-eac.skin.inkwash");
  assert.equal(SKIN_META.name, "水墨青烟");
});
