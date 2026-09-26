import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  SkinActivationContext,
  SkinClientContext,
} from "../context.ts";
import { SKIN_META } from "../identity.ts";
import { UPSTREAM_PACKAGE } from "../markers.ts";
import { createWhaleSongActivation, activateWhaleSongSession } from "./session.ts";

// ---------------------------------------------------------------------------
// Fake 环境：上游 apply 直接操作 document/window/MutationObserver（原样迁移的
// 形态），测试以全局桩承接；记账面：body dataset、body 内联样式、head/body
// 子节点、观察器。每个测试经 t.after(env.restore) 恢复全局，互不串扰。
// ---------------------------------------------------------------------------

class FakeStyle {
  [property: string]: string | ((name: string, value: string) => void) | ((name: string) => string);
  setProperty(name: string, value: string): void {
    this[name] = value;
  }
  getPropertyValue(name: string): string {
    const value = this[name];
    return typeof value === "string" ? value : "";
  }
}

class FakeElement {
  className = "";
  dataset: Record<string, string | undefined> = {};
  style = new FakeStyle();
  innerHTML = "";
  textContent = "";
  rel = "";
  type = "";
  href = "";
  removed = false;
  readonly children: FakeElement[] = [];
  append(...nodes: FakeElement[]): void {
    this.children.push(...nodes);
  }
  prepend(...nodes: FakeElement[]): void {
    this.children.unshift(...nodes);
  }
  setAttribute(name: string, value: string): void {
    (this as unknown as Record<string, string>)[name] = value;
  }
  remove(): void {
    this.removed = true;
  }
}

class FakeMutationObserver {
  static instances: FakeMutationObserver[] = [];
  readonly observed: Array<{ target: unknown; options: unknown }> = [];
  private readonly callback: () => void;
  private disconnected = false;
  constructor(callback: () => void) {
    this.callback = callback;
    FakeMutationObserver.instances.push(this);
  }
  observe(target: unknown, options: unknown): void {
    this.observed.push({ target, options });
  }
  disconnect(): void {
    this.disconnected = true;
  }
  get isDisconnected(): boolean {
    return this.disconnected;
  }
  trigger(): void {
    this.callback();
  }
}

interface FakeEnv {
  ctx: SkinClientContext;
  skinCtx: SkinActivationContext;
  body: FakeElement;
  headChildren: FakeElement[];
  lastObserver(): FakeMutationObserver | undefined;
  unloadFiber(): void;
  abort(): void;
  restore(): void;
}

function createFakeEnv(): FakeEnv {
  const body = new FakeElement();
  const headChildren: FakeElement[] = [];
  const effects: Array<() => void> = [];

  const documentStub = {
    body,
    createElement(tag: string): FakeElement {
      void tag;
      return new FakeElement();
    },
    querySelector(): null {
      return null;
    },
    head: {
      appendChild(node: FakeElement): void {
        headChildren.push(node);
      },
      append(...nodes: FakeElement[]): void {
        headChildren.push(...nodes);
      },
      querySelector(): null {
        return null;
      },
    },
    querySelectorAll(selector: string): FakeElement[] {
      if (selector === `style[data-plugin="${UPSTREAM_PACKAGE}"]`) {
        return headChildren.filter((n) => n.dataset.plugin === UPSTREAM_PACKAGE && !n.removed);
      }
      if (selector === "[data-skin-chrome]") {
        return [];
      }
      if (selector === 'link[rel~="icon"]') {
        return headChildren.filter((n) => n.rel.split(" ").includes("icon") && !n.removed);
      }
      return [];
    },
  };

  const saved = {
    document: (globalThis as { document?: unknown }).document,
    MutationObserver: (globalThis as { MutationObserver?: unknown }).MutationObserver,
  };
  (globalThis as { document: unknown }).document = documentStub;
  (globalThis as { MutationObserver: unknown }).MutationObserver = FakeMutationObserver;

  const ctx: SkinClientContext = {
    effect(execute) {
      const disposer = execute();
      if (typeof disposer === "function") effects.push(disposer);
      return disposer;
    },
    uiSkinLoader: { registerSkin: () => () => {} },
  };

  const abortController = new AbortController();

  return {
    ctx,
    skinCtx: {
      logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
      signal: abortController.signal,
    } satisfies SkinActivationContext,
    body,
    headChildren,
    lastObserver: () => FakeMutationObserver.instances.at(-1),
    unloadFiber: () => {
      for (const disposer of [...effects].reverse()) disposer();
      effects.length = 0;
    },
    abort: () => abortController.abort(),
    restore: () => {
      (globalThis as { document?: unknown }).document = saved.document;
      (globalThis as { MutationObserver?: unknown }).MutationObserver = saved.MutationObserver;
      FakeMutationObserver.instances = [];
    },
  };
}

function everythingRemoved(env: FakeEnv): boolean {
  return [...env.headChildren].every((node) => node.removed);
}

function snapshotOf(env: FakeEnv): string {
  return JSON.stringify({
    headChildren: env.headChildren.map((n) => [n.dataset.pluginCss, n.removed]),
    style: { ...env.body.style },
  });
}

// ---------------------------------------------------------------------------
// R1：bundle 模块加载与 client apply 只登记、零副作用——本测试刻意不装
// document 桩：模块顶层或 apply 若触碰 DOM 会直接 ReferenceError。
// ---------------------------------------------------------------------------

test("client apply only registers the skin — zero side effects before activation (R1)", async () => {
  const registrations: Array<{ id: string; name: string; preview?: string }> = [];
  let unregistered = 0;
  const effects: Array<() => void> = [];
  const ctx: SkinClientContext = {
    effect(execute) {
      const disposer = execute();
      if (typeof disposer === "function") effects.push(disposer);
      return disposer;
    },
    uiSkinLoader: {
      registerSkin: (registration) => {
        registrations.push({ id: registration.id, name: registration.name, preview: registration.preview });
        return () => {
          unregistered += 1;
        };
      },
    },
  };

  const { apply, inject } = await import("./index.ts");
  assert.deepEqual(inject, ["uiSkinLoader"]);
  apply(ctx);

  assert.equal(registrations.length, 1, "exactly one skin registered");
  assert.equal(registrations[0]!.id, SKIN_META.id);
  assert.equal(registrations[0]!.name, SKIN_META.name);
  assert.ok(registrations[0]!.preview!.startsWith("<svg"), "preview is an inline SVG");
  assert.equal(unregistered, 0, "register ≠ activate; nothing to unwind yet");
  for (const disposer of [...effects].reverse()) disposer();
  assert.equal(unregistered, 1, "fiber dispose unregisters the skin (covenant §4.3-3)");
});

// ---------------------------------------------------------------------------

test("whale-song activate paints the body backdrop and deactivate restores everything (§4.3)", (t) => {
  const env = createFakeEnv();
  t.after(() => env.restore());

  // 激活前 body 已有的内联背景值（上游 round-trip 还原语义的验证锚点）
  env.body.style.setProperty("background-image", "old-gradient");
  env.body.style.setProperty("background-position", "top");

  const session = activateWhaleSongSession(env.ctx, env.skinCtx);

  assert.equal(env.body.dataset.dshWhaleSong, "", "body activation marker set");
  const image = String(env.body.style.getPropertyValue("background-image"));
  assert.ok(image.includes("radial-gradient"), "non-figurative watercolor treatment applied (R13)");
  assert.ok(image.includes("linear-gradient"), "theme scrim layered over the treatment");
  assert.ok(!image.includes("data:image"), "no bitmap asset in the backdrop (figurative art removed, R13)");
  assert.equal(env.body.style.getPropertyValue("background-position"), "center");
  assert.ok(env.headChildren.length >= 2, "style node + favicon mounted");
  const favicon = env.headChildren.find((n) => n.rel === "icon");
  assert.ok(favicon, "favicon mounted");
  assert.ok(String(favicon!.href).startsWith("data:image/png"), "whale favicon is the upstream png data uri");
  const observer = env.lastObserver();
  assert.ok(observer, "theme observer registered");
  assert.deepEqual(observer!.observed[0]!.options, {
    attributes: true,
    attributeFilter: ["data-ds-dark-theme"],
  });

  session.teardown();

  assert.ok(!("dshWhaleSong" in env.body.dataset), "body marker retracted");
  assert.equal(env.body.style.getPropertyValue("background-image"), "old-gradient", "prior inline background restored verbatim");
  assert.equal(env.body.style.getPropertyValue("background-position"), "top", "prior inline position restored verbatim");
  assert.ok(everythingRemoved(env), "every mounted node removed");
  assert.ok(observer!.isDisconnected, "theme observer disconnected");
  assert.equal(
    env.headChildren.filter((n) => n.dataset.plugin === UPSTREAM_PACKAGE && !n.removed).length,
    0,
    "own style nodes swept (§4.3 completion)",
  );

  const snapshot = snapshotOf(env);
  session.teardown();
  assert.equal(snapshotOf(env), snapshot, "second teardown changes nothing (idempotent)");
});

test("whale-song theme flip re-renders the scrim through the observer", (t) => {
  const env = createFakeEnv();
  t.after(() => env.restore());

  activateWhaleSongSession(env.ctx, env.skinCtx);
  const lightImage = String(env.body.style.getPropertyValue("background-image"));

  env.body.dataset.dsDarkTheme = "";
  env.lastObserver()!.trigger();
  const darkImage = String(env.body.style.getPropertyValue("background-image"));
  assert.notEqual(darkImage, lightImage, "dark scrim swapped in");
  assert.ok(darkImage.includes("radial-gradient"));
  assert.ok(!darkImage.includes("data:image"), "no bitmap asset in the backdrop (R13)");
});

test("whale-song teardown is idempotent when driven through deactivate", (t) => {
  const env = createFakeEnv();
  t.after(() => env.restore());

  const activation = createWhaleSongActivation(env.ctx);
  activation.activate(env.skinCtx);
  assert.equal(env.body.dataset.dshWhaleSong, "");

  activation.deactivate();
  assert.ok(!("dshWhaleSong" in env.body.dataset));
  assert.ok(everythingRemoved(env));
  const snapshot = snapshotOf(env);

  activation.deactivate();
  assert.equal(snapshotOf(env), snapshot, "deactivate is idempotent (§4.3)");
});

test("whale-song activation abort tears the session down", (t) => {
  const env = createFakeEnv();
  t.after(() => env.restore());

  activateWhaleSongSession(env.ctx, env.skinCtx);
  assert.equal(env.body.dataset.dshWhaleSong, "");

  env.abort();

  assert.ok(!("dshWhaleSong" in env.body.dataset));
  assert.ok(everythingRemoved(env));
});

test("whale-song fiber dispose safety net tears the session down (R8)", (t) => {
  const env = createFakeEnv();
  t.after(() => env.restore());

  const activation = createWhaleSongActivation(env.ctx);
  activation.activate(env.skinCtx);
  assert.equal(env.body.dataset.dshWhaleSong, "");

  env.unloadFiber();

  assert.ok(!("dshWhaleSong" in env.body.dataset));
  assert.ok(everythingRemoved(env));
});

// ---------------------------------------------------------------------------
// 激活失败回滚（§4.4 皮肤侧义务）：上游 apply 的契约是「副作用全挂好 → 最后一步
// ctx.effect 注册 disposer」。中途抛错时已发生的副作用没有 disposer 覆盖——适配层
// 的 partial-apply 快照（差集清扫 + body 内联背景还原）必须把半套皮肤撤净。
// ---------------------------------------------------------------------------

test("whale-song mid-apply failure rolls the partial activation back — zero residue (§4.4)", (t) => {
  const env = createFakeEnv();
  t.after(() => env.restore());
  env.body.style.setProperty("background-image", "host-original");

  const style = new FakeElement();
  style.dataset.plugin = UPSTREAM_PACKAGE;
  style.dataset.pluginCss = `${UPSTREAM_PACKAGE}/whale-song.module.css`;
  const favicon = new FakeElement();
  favicon.rel = "icon";
  favicon.type = "image/png";
  favicon.href = "data:image/png;base64,whale";

  const partialApply = (): never => {
    env.body.dataset.dshWhaleSong = "";
    env.headChildren.push(style, favicon);
    env.body.style.setProperty("background-image", "scrim+treatment");
    env.body.style.setProperty("background-position", "center");
    throw new Error("intentional mid-apply failure (task-11 fault drill)");
  };

  assert.throws(
    () => activateWhaleSongSession(env.ctx, env.skinCtx, partialApply),
    /intentional mid-apply failure/,
  );

  assert.ok(!("dshWhaleSong" in env.body.dataset), "body marker rolled back");
  assert.ok(style.removed && favicon.removed, "style/favicon rolled back");
  assert.equal(env.body.style.getPropertyValue("background-image"), "host-original", "inline background restored verbatim");
  assert.equal(env.body.style.getPropertyValue("background-position"), "", "touched inline position cleared back to prior value");
});

test("whale-song stays activatable after a failed activation (fault is not poisonous)", (t) => {
  const env = createFakeEnv();
  t.after(() => env.restore());

  assert.throws(
    () =>
      activateWhaleSongSession(env.ctx, env.skinCtx, () => {
        throw new Error("boom");
      }),
    /boom/,
  );

  const activation = createWhaleSongActivation(env.ctx);
  activation.activate(env.skinCtx);
  assert.equal(env.body.dataset.dshWhaleSong, "");
  activation.deactivate();
  assert.ok(!("dshWhaleSong" in env.body.dataset));
  assert.ok(everythingRemoved(env));
});
