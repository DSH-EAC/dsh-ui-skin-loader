import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  SkinActivationContext,
  SkinClientContext,
  SkinDom,
  SkinSlotFace,
} from "../context.ts";
import { ACTIVE_BODY_ATTR } from "../background.ts";
import { CSS_PREFIX, THEME_ID } from "../identity.ts";
import type { InkwashSessionDeps } from "./session.ts";
import { activateInkwashSession, createInkwashActivation, BACKDROP_SEAT_ID } from "./session.ts";

// ---------------------------------------------------------------------------
// Fake 环境（与 aurora 包 session.test.ts 同一套记账桩，裁剪到 inkwash 的服务面）
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

interface FakeEnv {
  ctx: SkinClientContext;
  skinCtx: SkinActivationContext;
  deps: InkwashSessionDeps;
  unloadFiber(): void;
  abort(): void;
  setUserPreference(id: string): void;
  log: {
    themeRegistered: Array<{ id: string; colorScheme: string }>;
    themeDisposed: number;
    overrideSource: string;
    overrideTokenCount: number;
    overrideDisposed: boolean;
    setThemeCalls: string[];
    seats: Array<{ key: string; id: string }>;
    seatDisposed: number;
    styles: FakeStyleNode[];
    bodyAttrs: Record<string, string>;
    effectsRegistered: number;
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
    styles: [],
    bodyAttrs: {},
    effectsRegistered: 0,
    backdropCreated: 0,
  };
  let preference = options?.initialPreference ?? "light";

  const theme = {
    register(definition: { id: string; colorScheme: "light" | "dark"; tokens: Record<string, string> }) {
      log.themeRegistered.push({ id: definition.id, colorScheme: definition.colorScheme });
      return () => {
        log.themeDisposed += 1;
        if (preference === definition.id) preference = "system";
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
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    signal: abortController.signal,
    slots,
  };

  const deps: InkwashSessionDeps = {
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
    unloadFiber: () => {
      for (const disposer of [...effects].reverse()) disposer();
      effects.length = 0;
    },
    abort: () => abortController.abort(),
    setUserPreference: (id) => {
      preference = id;
    },
    log,
  };
}

// ---------------------------------------------------------------------------

test("inkwash activate registers theme, injects CSS and opens the backdrop seat", () => {
  const env = createFakeEnv({ initialPreference: "light" });
  activateInkwashSession(env.ctx, env.skinCtx, env.deps);

  assert.deepEqual(env.log.themeRegistered, [{ id: THEME_ID, colorScheme: "light" }]);
  assert.deepEqual(env.log.setThemeCalls, [], "no preference writes (adopt-revert discipline)");
  assert.equal(env.log.overrideSource, "dsh-eac.skin.inkwash", "override layer keyed by the skin id");
  assert.ok(env.log.overrideTokenCount >= 12, "override layer carries the alias token set");
  assert.equal(env.log.styles.length, 1);
  assert.equal(env.log.styles[0]!.attributes.get(`data-${CSS_PREFIX}-style`), "");
  assert.equal(env.log.bodyAttrs[ACTIVE_BODY_ATTR], "");
  assert.deepEqual(
    env.log.seats.map((s) => `${s.key}/${s.id}`),
    [`shell.overlay/${BACKDROP_SEAT_ID}`],
  );
  assert.equal(env.log.backdropCreated, 1);
});

test("inkwash teardown unwinds everything and is idempotent (§4.3)", () => {
  const env = createFakeEnv({ initialPreference: "dark" });
  const session = activateInkwashSession(env.ctx, env.skinCtx, env.deps);

  session.teardown();

  assert.deepEqual(env.log.setThemeCalls, [], "no preference writes to unwind");
  assert.equal(env.log.themeDisposed, 1);
  assert.equal(env.log.overrideDisposed, true, "token override layer disposed");
  assert.equal(env.log.seatDisposed, 1);
  assert.ok(env.log.styles[0]!.removed);
  assert.ok(!(ACTIVE_BODY_ATTR in env.log.bodyAttrs));

  const snapshot = JSON.stringify(env.log);
  session.teardown();
  assert.equal(JSON.stringify(env.log), snapshot, "second teardown changes nothing");
});

test("inkwash activation abort tears the session down", () => {
  const env = createFakeEnv({ initialPreference: "dark" });
  activateInkwashSession(env.ctx, env.skinCtx, env.deps);
  env.abort();

  assert.equal(env.log.themeDisposed, 1);
  assert.equal(env.log.overrideDisposed, true);
  assert.ok(env.log.styles[0]!.removed);
});

test("inkwash fiber dispose safety net tears the session down (R8)", () => {
  const env = createFakeEnv({ initialPreference: "light" });
  const activation = createInkwashActivation(env.ctx, env.deps);
  activation.activate(env.skinCtx);
  assert.equal(env.log.effectsRegistered, 1);

  env.unloadFiber();

  assert.equal(env.log.themeDisposed, 1);
  assert.ok(env.log.styles[0]!.removed);
  assert.ok(!(ACTIVE_BODY_ATTR in env.log.bodyAttrs));
});

test("inkwash teardown respects a theme the user chose mid-activation", () => {
  const env = createFakeEnv({ initialPreference: "light" });
  const session = activateInkwashSession(env.ctx, env.skinCtx, env.deps);
  env.setUserPreference("system");
  env.log.setThemeCalls.length = 0;

  session.teardown();
  assert.deepEqual(env.log.setThemeCalls, []);
  assert.equal(env.log.themeDisposed, 1);
});
