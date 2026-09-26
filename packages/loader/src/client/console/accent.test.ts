/**
 * accent.ts 纯函数单测（对比度修复的**计算证据**）：
 * - 缺陷组合（aurora 亮案 accent #6f9bff + 写死白字 ≈2.7:1）修复后改取墨色前景 ≥4.5:1；
 * - 亮暗两案默认 accent 的推导结果与原固定值逐一相同（原生观感零变化）且 ≥4.5:1；
 * - 解析面（hex 各长度 / rgb() 逗号与空格形态 / 非颜色值 → null）。
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ACCENT_FG_DARK,
  ACCENT_FG_LIGHT,
  contrastRatio,
  deriveAccentFg,
  parseCssColor,
  relativeLuminance,
} from "./accent.ts";

/** WCAG AA 正文阈值。 */
const AA = 4.5;

test("reported bug: aurora brand-primary #6f9bff with fixed white fg fails AA (≈2.7:1)", () => {
  const aurora: [number, number, number, number] = [111, 155, 255, 1];
  const whiteOnAurora = contrastRatio(aurora, [255, 255, 255, 1]);
  assert.ok(whiteOnAurora < AA, `white on aurora must fail AA, got ${whiteOnAurora}`);
  assert.ok(whiteOnAurora > 2.5 && whiteOnAurora < 2.9, `ratio ≈2.7:1 expected, got ${whiteOnAurora}`);
});

test("deriveAccentFg picks ink for aurora brand-primary, ratio meets AA", () => {
  const fg = deriveAccentFg("#6f9bff");
  assert.equal(fg, ACCENT_FG_DARK);
  const ink = parseCssColor(ACCENT_FG_DARK) as [number, number, number, number];
  assert.ok(contrastRatio([111, 155, 255, 1], ink) >= AA);
});

test("deriveAccentFg keeps white for the light-scheme default accent (unchanged native look)", () => {
  assert.equal(deriveAccentFg("#3f6ae0"), ACCENT_FG_LIGHT);
  const accent = parseCssColor("#3f6ae0") as [number, number, number, number];
  const fg = parseCssColor(ACCENT_FG_LIGHT) as [number, number, number, number];
  assert.ok(contrastRatio(accent, fg) >= AA);
});

test("deriveAccentFg keeps ink for the dark-scheme default accent (unchanged native look)", () => {
  assert.equal(deriveAccentFg("#6d92ec"), ACCENT_FG_DARK);
  const accent = parseCssColor("#6d92ec") as [number, number, number, number];
  const fg = parseCssColor(ACCENT_FG_DARK) as [number, number, number, number];
  assert.ok(contrastRatio(accent, fg) >= AA);
});

test("deriveAccentFg is scheme-independent: same value as rgba() computed form resolves identically", () => {
  assert.equal(deriveAccentFg("rgb(111 155 255)"), ACCENT_FG_DARK);
  assert.equal(deriveAccentFg("rgba(111, 155, 255, 1)"), ACCENT_FG_DARK);
  assert.equal(deriveAccentFg("RGB(111, 155, 255)"), ACCENT_FG_DARK);
  assert.equal(deriveAccentFg("rgba(111, 155, 255, 0.32)"), ACCENT_FG_DARK);
  assert.equal(deriveAccentFg("#6f9bffff"), ACCENT_FG_DARK);
});

test("parseCssColor handles short hex and 3/4-digit expansion", () => {
  assert.deepEqual(parseCssColor("#fff"), [255, 255, 255, 1]);
  assert.deepEqual(parseCssColor("#6F9BFF"), [111, 155, 255, 1]);
  assert.deepEqual(parseCssColor("#6f9bfff"), null); // 7 位不是合法长度
  const short = parseCssColor("#6fb") as [number, number, number, number];
  assert.deepEqual(short.slice(0, 3), [102, 255, 187]);
});

test("deriveAccentFg returns null for non-color values (caller keeps CSS fallback)", () => {
  assert.equal(deriveAccentFg(""), null);
  assert.equal(deriveAccentFg("   "), null);
  assert.equal(deriveAccentFg("transparent"), null);
  assert.equal(deriveAccentFg("var(--x)"), null);
  assert.equal(deriveAccentFg("light-dark(#000, #fff)"), null);
});

test("relativeLuminance sanity: white=1, black=0", () => {
  assert.ok(Math.abs(relativeLuminance([255, 255, 255, 1]) - 1) < 1e-9);
  assert.ok(Math.abs(relativeLuminance([0, 0, 0, 1])) < 1e-9);
});
