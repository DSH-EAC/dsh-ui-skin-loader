import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  SkinActivationContext,
  SkinClientContext,
  SkinDom,
  SkinSettingsForm,
  SkinSlotFace,
} from "../context.ts";
import { ACTIVE_BODY_ATTR } from "../background.ts";
import { CSS_PREFIX, SKIN_ID, SKIN_META, THEME_ID } from "../identity.ts";
import type { AuroraSessionDeps } from "./session.ts";
import { activateAuroraSession, createAuroraActivation, BACKDROP_SEAT_ID, SETTINGS_SEAT_ID } from "./session.ts";

// ---------------------------------------------------------------------------
// Fake 环境（宿主服务的最小记账实现；形状依据 src/context.ts 的结构类型）
// ---------------------------------------------------------------------------

class FakeStyleNode {
  textContent = "";
  removed = false;
  attributes = new Map<string, string>();
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  remove(): void {
    this.removed = true;
  }
}

class FakeForm implements SkinSettingsForm {
  revision = 1;
  writable = true;
  status: "loading" | "ready" | "unavailable" = "ready";
  value: unknown = { backgroundUrl: "" };
  private listeners = new Set<() => void>();
  getSnapshot(): { status: "loading" | "ready" | "unavailable"; value: unknown; revision: number; writable: boolean } {
    return { status: this.status, value: this.value, revision: this.revision, writable: this.writable };
  }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
      this.subscribeDisposed += 1;
    };
  }
  set(field: string, value: unknown): Promise<boolean> {
    this.value = { ...(this.value as Record<string, unknown>), [field]: value };
    this.revision += 1;
    for (const listener of [...this.listeners]) listener();
    return Promise.resolve(true);
  }
  /** 测试驱动：模拟宿主设置文档变更（如跨端写入后的回推）。 */
  emit(backgroundUrl: string): void {
    this.value = { backgroundUrl };
    this.revision += 1;
    for (const listener of [...this.listeners]) listener();
  }
  subscribeDisposed = 0;
}

interface FakeEnv {
  ctx: SkinClientContext;
  skinCtx: SkinActivationContext;
  deps: AuroraSessionDeps;
  form: FakeForm;
  /** 模拟皮肤 fiber dispose（ctx.effect 登记的 disposer 逆序执行）。 */
  unloadFiber(): void;
  abort(): void;
  setUserPreference(id: string): void;
  setFormValue(backgroundUrl: string): void;
  log: {
    themeRegistered: Array<{ id: string; colorScheme: string }>;
    themeDisposed: number;
    overrideSource: string;
    overrideTokenCount: number;
    overrideDisposed: boolean;
    setThemeCalls: string[];
    seats: Array<{ key: string; id: string; component: unknown }>;
    seatDisposed: number;
    localeRegistered: string[];
    localeDisposed: number;
    styles: FakeStyleNode[];
    bodyAttrs: Record<string, string>;
    effectsRegistered: number;
    sectionBindings: Array<{ form: unknown; t: unknown }>;
    backdropCreated: number;
  };
}

function createFakeEnv(options?: { initialPreference?: string }): FakeEnv {
  const log: FakeEnv["log"] = {
    themeRegistered: [],
    themeDisposed: 0,
    overrideSource: "",
    overrideTokenCount: 0,
    overrideDisposed: true,
    setThemeCalls: [],
    seats: [],
    seatDisposed: 0,
    localeRegistered: [],
    localeDisposed: 0,
    styles: [],
    bodyAttrs: {},
    effectsRegistered: 0,
    sectionBindings: [],
    backdropCreated: 0,
  };
  let preference = options?.initialPreference ?? "system";

  const theme = {
    register(definition: { id: string; colorScheme: "light" | "dark"; tokens: Record<string, string> }) {
      log.themeRegistered.push({ id: definition.id, colorScheme: definition.colorScheme });
      return () => {
        log.themeDisposed += 1;
        if (preference === definition.id) preference = "system"; // 上游语义：dispose 激活主题重置偏好
      };
    },
    setTheme(id: string): void {
      if (id !== "system" && id !== "light" && id !== "dark" && !log.themeRegistered.some((t) => t.id === id)) {
        throw new Error(`theme "${id}" is not registered`);
      }
      log.setThemeCalls.push(id);
      preference = id;
    },
    getTheme() {
      return { preference };
    },
    overrideTokens(source: string, tokens: Record<string, { light: string; dark: string }>) {
      log.overrideSource = source;
      log.overrideTokenCount = Object.keys(tokens).length;
      log.overrideDisposed = false;
      return () => {
        log.overrideDisposed = true;
      };
    },
  };

  const form = new FakeForm();
  const seats: Array<{ key: string; id: string; component: unknown }> = [];
  const slots: SkinSlotFace = {
    register(options, component) {
      seats.push({ key: options.name, id: options.id, component });
      log.seats = seats;
      return () => {
        log.seatDisposed += 1;
      };
    },
    inject(key, callback) {
      const ret = callback();
      return () => {
        if (typeof ret === "function") ret();
      };
    },
  };

  const effects: Array<() => void> = [];
  const ctx: SkinClientContext = {
    effect(execute) {
      log.effectsRegistered += 1;
      const disposer = execute();
      if (typeof disposer === "function") effects.push(disposer);
      return disposer;
    },
    slots,
    theme,
    configForms: { get: () => form },
    locale: {
      register(ns) {
        log.localeRegistered.push(ns);
        return () => {
          log.localeDisposed += 1;
        };
      },
      bind: () => (key: string) => key,
    },
    uiSkinLoader: { registerSkin: () => () => {} },
  };

  const dom: SkinDom = {
    createElement: () => {
      const node = new FakeStyleNode();
      log.styles.push(node);
      return node;
    },
    head: {
      appendChild(node: unknown) {
        (node as FakeStyleNode).removed = false;
      },
    },
    body: {
      setAttribute: (name, value) => {
        log.bodyAttrs[name] = value;
      },
      removeAttribute: (name) => {
        delete log.bodyAttrs[name];
      },
    },
  };

  const abortController = new AbortController();
  const skinCtx: SkinActivationContext = {
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
    signal: abortController.signal,
    slots,
  };

  const deps: AuroraSessionDeps = {
    createSettingsSection: (bindings) => {
      log.sectionBindings.push({ form: bindings.form, t: bindings.t });
      return () => null;
    },
    createBackdrop: () => {
      log.backdropCreated += 1;
      return () => null;
    },
    dom,
  };

  return {
    ctx,
    skinCtx,
    deps,
    form,
    unloadFiber: () => {
      for (const disposer of [...effects].reverse()) disposer();
      effects.length = 0;
    },
    abort: () => abortController.abort(),
    setUserPreference: (id) => {
      preference = id;
    },
    setFormValue: (backgroundUrl) => form.emit(backgroundUrl),
    log,
  };
}

// ---------------------------------------------------------------------------
// activate：主题 + 样式 + 席位 + 设置订阅一次到位（全部登记）
// ---------------------------------------------------------------------------

test("aurora activate registers theme, switches preference and injects namespaced CSS", () => {
  const env = createFakeEnv({ initialPreference: "light" });
  activateAuroraSession(env.ctx, env.skinCtx, env.deps);

  assert.deepEqual(env.log.themeRegistered, [{ id: THEME_ID, colorScheme: "dark" }]);
  assert.deepEqual(env.log.setThemeCalls, [], "the skin never writes the preference axis (adoot-revert discipline)");
  assert.equal(env.log.overrideSource, SKIN_ID, "override layer keyed by the skin id");
  assert.ok(env.log.overrideTokenCount >= 12, "override layer carries the alias token set");
  assert.equal(env.log.styles.length, 1);
  assert.equal(env.log.styles[0]!.attributes.get(`data-${CSS_PREFIX}-style`), "");
  assert.match(env.log.styles[0]!.textContent, new RegExp(`body\\[${ACTIVE_BODY_ATTR}\\]`));
  assert.equal(env.log.bodyAttrs[ACTIVE_BODY_ATTR], "");
});

test("aurora activate registers both slot seats, the locale dict and binds the settings form", () => {
  const env = createFakeEnv();
  activateAuroraSession(env.ctx, env.skinCtx, env.deps);

  const seatIds = env.log.seats.map((s) => `${s.key}/${s.id}`).sort();
  assert.deepEqual(seatIds, [
    `settings.section/${SETTINGS_SEAT_ID}`,
    `shell.overlay/${BACKDROP_SEAT_ID}`,
  ]);
  assert.equal(env.log.backdropCreated, 1);
  assert.equal(env.log.sectionBindings.length, 1);
  assert.equal(env.log.sectionBindings[0]!.form, env.form, "settings section receives the configForms handle");
  assert.ok(env.log.localeRegistered.includes("dsh-eac-skin-aurora/console"));
});

test("aurora activate reads the persisted background URL into the initial CSS", () => {
  const env = createFakeEnv();
  env.form.value = { backgroundUrl: "https://example.com/kept.png" };
  activateAuroraSession(env.ctx, env.skinCtx, env.deps);
  assert.match(env.log.styles[0]!.textContent, /url\("https:\/\/example\.com\/kept\.png"\)/);
});

// ---------------------------------------------------------------------------
// deactivate：逆序退净 + 幂等（公约 §4.3「退出后不可观测」）
// ---------------------------------------------------------------------------

test("aurora teardown unwinds everything and is idempotent", () => {
  const env = createFakeEnv({ initialPreference: "light" });
  const session = activateAuroraSession(env.ctx, env.skinCtx, env.deps);

  // 激活期间用户改了背景设置（皮肤自治持久化——不因停用而清除）
  env.setFormValue("https://example.com/kept.png");

  session.teardown();

  assert.deepEqual(env.log.setThemeCalls, [], "no preference writes to unwind");
  assert.equal(env.log.themeDisposed, 1, "theme registration disposed exactly once");
  assert.equal(env.log.overrideDisposed, true, "token override layer disposed");
  assert.equal(env.log.seatDisposed, 2, "both seats unwound");
  assert.equal(env.log.localeDisposed, 1, "locale dict disposed");
  assert.equal(env.form.subscribeDisposed, 1, "settings subscription disposed");
  assert.equal(env.log.styles.length, 1);
  assert.ok(env.log.styles[0]!.removed, "own style node removed");
  assert.ok(!(ACTIVE_BODY_ATTR in env.log.bodyAttrs), "body marker removed");

  // 幂等：第二次 teardown 是 no-op
  const snapshot = JSON.stringify(env.log);
  session.teardown();
  assert.equal(JSON.stringify(env.log), snapshot, "second teardown changes nothing");
});

// ---------------------------------------------------------------------------
// abort 与 fiber 安全网（§4.3 五触发中的加载器侧路径）
// ---------------------------------------------------------------------------

test("activation signal abort tears the session down (loader-side isolation path)", () => {
  const env = createFakeEnv({ initialPreference: "light" });
  activateAuroraSession(env.ctx, env.skinCtx, env.deps);
  env.abort();

  assert.equal(env.log.themeDisposed, 1);
  assert.equal(env.log.overrideDisposed, true);
  assert.ok(env.log.styles[0]!.removed);
  assert.ok(!(ACTIVE_BODY_ATTR in env.log.bodyAttrs));
});

test("fiber dispose safety net tears the session down (R8)", () => {
  const env = createFakeEnv({ initialPreference: "system" });
  const activation = createAuroraActivation(env.ctx, env.deps);
  activation.activate(env.skinCtx);
  assert.equal(env.log.effectsRegistered, 1, "safety-net effect registered once");

  env.unloadFiber();

  assert.equal(env.log.themeDisposed, 1);
  assert.ok(env.log.styles[0]!.removed);
  assert.ok(!(ACTIVE_BODY_ATTR in env.log.bodyAttrs));
});

test("theme.register failure during activate leaves no half-applied skin", () => {
  const env = createFakeEnv({ initialPreference: "system" });
  env.ctx.theme.register = () => {
    throw new Error("upstream boom");
  };

  assert.throws(() => activateAuroraSession(env.ctx, env.skinCtx, env.deps), /upstream boom/);
  assert.equal(env.log.styles.length, 0, "no style node injected");
  assert.ok(!(ACTIVE_BODY_ATTR in env.log.bodyAttrs), "no activation marker left");
  assert.equal(env.log.seats.length, 0, "no seats registered");
});

test("overrideTokens failure during activate rolls the theme registration back", () => {
  const env = createFakeEnv({ initialPreference: "system" });
  env.ctx.theme.overrideTokens = () => {
    throw new Error("override boom");
  };

  assert.throws(() => activateAuroraSession(env.ctx, env.skinCtx, env.deps), /override boom/);
  assert.equal(env.log.themeDisposed, 1, "registration rolled back (no half-applied skin)");
  assert.equal(env.log.styles.length, 0);
  assert.ok(!(ACTIVE_BODY_ATTR in env.log.bodyAttrs));
});

// ---------------------------------------------------------------------------
// 设置订阅：改 URL → CSS 即时重算（观感即时变化）
// ---------------------------------------------------------------------------

test("background settings change recomputes the injected CSS immediately", () => {
  const env = createFakeEnv();
  activateAuroraSession(env.ctx, env.skinCtx, env.deps);
  const style = env.log.styles[0]!;
  assert.ok(!style.textContent.includes("url("));

  env.setFormValue("https://example.com/aurora.png");
  assert.match(style.textContent, /url\("https:\/\/example\.com\/aurora\.png"\)/);

  env.setFormValue("");
  assert.ok(!style.textContent.includes("url("), "back to builtin gradient");
});

test("settings snapshot unavailable still activates with the builtin gradient", () => {
  const env = createFakeEnv();
  env.form.status = "unavailable";
  env.form.value = undefined;
  activateAuroraSession(env.ctx, env.skinCtx, env.deps);
  assert.ok(!env.log.styles[0]!.textContent.includes("url("));
});

// ---------------------------------------------------------------------------
// 登记元数据（公约 §3 声明同源）
// ---------------------------------------------------------------------------

test("registration metadata carries the covenant id and display name", () => {
  assert.equal(SKIN_META.apiVersion, "dsh.ecosystem.ui-skin-loader/v1");
  assert.equal(SKIN_META.id, "dsh-eac.skin.aurora");
  assert.equal(SKIN_META.name, "极光之夜");
});
