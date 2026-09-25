/**
 * 控制台纯逻辑单测（T2.5，brief §3 清单）：状态徽标映射、SwitchResult → 用户消息映射、
 * 卡片排序稳定性；附封面确定性（preview.ts）与环境 store 语义（env.ts）。
 * React 组件本体以 Playwright 实测代替（brief §3 授权的取舍——JSX 在 Node 24
 * type-stripping 下不可执行，见 task-7 报告）。
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { SkinInfo } from "../../protocol.ts";
import { createFlagStore, createLocaleRevisionStore, createSchemeStore } from "./env.ts";
import {
  formatTemplate,
  MESSAGES,
  sortSkins,
  statusBadgeKey,
  switchResultMessage,
} from "./messages.ts";
import { generatedPreviewSvg, isInlineSvg, resolvePreviewSvg } from "./preview.ts";

// ---------------------------------------------------------------------------
// 状态徽标映射（brief §3 点 1）
// ---------------------------------------------------------------------------

test("statusBadgeKey maps every runtime status to its message key", () => {
  assert.equal(statusBadgeKey("discovered"), "badge.discovered");
  assert.equal(statusBadgeKey("active"), "badge.active");
  assert.equal(statusBadgeKey("fault"), "badge.fault");
  assert.equal(statusBadgeKey("suspect-residue"), "badge.suspectResidue");
});

test("statusBadgeKey shows incompatible ahead of any runtime status", () => {
  assert.equal(statusBadgeKey("discovered", "apiVersion declares major v9"), "badge.incompatible");
  assert.equal(statusBadgeKey("fault", "bad id"), "badge.incompatible");
});

test("every badge key resolves in both zh and en dictionaries", () => {
  for (const status of ["discovered", "active", "fault", "suspect-residue"] as const) {
    const key = statusBadgeKey(status);
    assert.ok(MESSAGES.en[key]?.length > 0, `en missing ${key}`);
    assert.ok(MESSAGES.zh[key]?.length > 0, `zh missing ${key}`);
  }
});

// ---------------------------------------------------------------------------
// SwitchResult → 用户消息映射（brief §3 点 2）
// ---------------------------------------------------------------------------

test("switchResultMessage: clean success maps to null (no noise, no false claims)", () => {
  assert.equal(switchResultMessage({ ok: true }), null);
});

test("switchResultMessage: success with warning surfaces the warning verbatim", () => {
  const message = switchResultMessage({
    ok: true,
    warning: 'skin "a" shutdown could not be verified',
  });
  assert.deepEqual(message, {
    severity: "warning",
    key: "warning.raw",
    params: { warning: 'skin "a" shutdown could not be verified' },
  });
});

test("switchResultMessage: failure carries the error text for inline display", () => {
  const message = switchResultMessage({
    ok: false,
    error: 'activate of skin "x" threw: boom',
    rolledBackTo: "default",
  });
  assert.equal(message?.severity, "error");
  assert.equal(message?.key, "error.switch");
  assert.equal(message?.params.error, 'activate of skin "x" threw: boom');
});

test("error.switch template exists in both languages and accepts the error param", () => {
  assert.match(MESSAGES.en["error.switch"], /\{error\}/);
  assert.match(MESSAGES.zh["error.switch"], /\{error\}/);
});

// ---------------------------------------------------------------------------
// 卡片排序稳定性（brief §3 点 3）
// ---------------------------------------------------------------------------

function skin(id: string, name: string, overrides: Partial<SkinInfo> = {}): SkinInfo {
  return {
    id,
    name,
    version: "1.0.0",
    status: "discovered",
    ...overrides,
  };
}

test("sortSkins orders by casefolded display name then id", () => {
  const sorted = sortSkins([
    skin("c", "Zebra"),
    skin("a", "aurora"),
    skin("b", "Aurora"),
    skin("d", "inkwash"),
  ]);
  assert.deepEqual(
    sorted.map((s) => s.id),
    ["a", "b", "d", "c"],
  );
});

test("sortSkins is stable for identical name+id pairs (registration order kept)", () => {
  const first = skin("x", "Same");
  const second = skin("x", "Same"); // 同 id 同名的重复登记形态（理论上不出现，防御性验证稳定性）
  const sorted = sortSkins([first, second]);
  assert.equal(sorted[0], first);
  assert.equal(sorted[1], second);
});

test("sortSkins does not mutate its input", () => {
  const input = [skin("b", "B"), skin("a", "A")];
  const copy = [...input];
  sortSkins(input);
  assert.deepEqual(input, copy);
});

// ---------------------------------------------------------------------------
// 封面解析（preview.ts）
// ---------------------------------------------------------------------------

test("inline svg preview is used verbatim; relative paths fall back to generation", () => {
  const declared = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>';
  assert.equal(resolvePreviewSvg({ id: "a", name: "A", preview: declared }), declared);
  assert.equal(isInlineSvg("assets/preview.svg"), false);
  assert.equal(isInlineSvg(undefined), false);
  assert.ok(resolvePreviewSvg({ id: "a", name: "A", preview: "assets/preview.svg" }).startsWith("<svg"));
});

test("generated preview is deterministic per id and distinguishes skins", () => {
  const a1 = generatedPreviewSvg("aurora", "Aurora");
  const a2 = generatedPreviewSvg("aurora", "Aurora");
  const b = generatedPreviewSvg("inkwash", "Inkwash");
  assert.equal(a1, a2);
  assert.notEqual(a1, b);
  assert.ok(a1.includes("linearGradient"));
});

test("formatTemplate substitutes known keys and leaves unknown placeholders", () => {
  assert.equal(formatTemplate("{a} and {b}", { a: 1, b: "x" }), "1 and x");
  assert.equal(formatTemplate("{missing}", {}), "{missing}");
  assert.equal(formatTemplate("plain"), "plain");
});

// ---------------------------------------------------------------------------
// 环境 store（env.ts）——useSyncExternalStore 契约形态
// ---------------------------------------------------------------------------

test("scheme store notifies subscribers on change and keeps snapshot identity between changes", () => {
  const store = createSchemeStore("light");
  const seen: string[] = [];
  const off = store.subscribe(() => seen.push(store.get()));
  const before = store.get();
  store.set("dark");
  store.set("dark"); // 同值重复 set 不通知（React 渲染节流语义）
  assert.equal(store.get(), "dark");
  assert.notEqual(before, "dark");
  assert.deepEqual(seen, ["dark"]);
  off();
  store.set("light");
  assert.deepEqual(seen, ["dark"]);
});

test("locale revision store bumps monotonically", () => {
  const store = createLocaleRevisionStore();
  assert.equal(store.get(), 0);
  store.bump();
  store.bump();
  assert.equal(store.get(), 2);
});

test("flag store toggles and unsubscribes", () => {
  const store = createFlagStore(false);
  const seen: boolean[] = [];
  const off = store.subscribe(() => seen.push(store.get()));
  store.set(true);
  off();
  store.set(false);
  assert.deepEqual(seen, [true]);
});
