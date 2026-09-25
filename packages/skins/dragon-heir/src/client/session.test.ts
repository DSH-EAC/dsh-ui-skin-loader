import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  SkinActivationContext,
  SkinClientContext,
} from "../context.ts";
import { SKIN_META } from "../identity.ts";
import { UPSTREAM_PACKAGE } from "../markers.ts";
import { createDragonHeirActivation, activateDragonHeirSession } from "./session.ts";

// ---------------------------------------------------------------------------
// Fake 环境：上游 apply 直接操作 document/window/MutationObserver（原样迁移的
// 形态），测试以全局桩承接；记账面：body dataset、head/body 子节点、观察器。
// 每个测试经 t.after(env.restore) 恢复全局，互不串扰。
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
  bodyChildren: FakeElement[];
  lastObserver(): FakeMutationObserver | undefined;
  unloadFiber(): void;
  abort(): void;
  restore(): void;
}

function createFakeEnv(): FakeEnv {
  const body = new FakeElement();
  const bodyAppend = body.append.bind(body);
  const bodyChildren: FakeElement[] = [];
  body.append = (...nodes: FakeElement[]) => {
    bodyAppend(...nodes);
    bodyChildren.push(...nodes);
  };
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
    bodyChildren,
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
  return [...env.bodyChildren, ...env.headChildren].every((node) => node.removed);
}

function snapshotOf(env: FakeEnv): string {
  return JSON.stringify({
    bodyChildren: env.bodyChildren.map((n) => [n.dataset.skinChrome, n.removed]),
    headChildren: env.headChildren.map((n) => [n.dataset.pluginCss, n.removed]),
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

test("dragon-heir activate mounts the backdrop and deactivate unwinds everything (§4.3)", (t) => {
  const env = createFakeEnv();
  t.after(() => env.restore());

  const session = activateDragonHeirSession(env.ctx, env.skinCtx);

  assert.equal(env.body.dataset.dshDragonHeir, "", "body activation marker set");
  assert.equal(env.bodyChildren.length, 1, "one backdrop layer mounted");
  const artLayer = env.bodyChildren[0]!;
  assert.equal(artLayer.dataset.skinChrome, "backdrop");
  assert.ok(
    String(artLayer.style.getPropertyValue("background-image")).includes("data:image/webp"),
    "light artwork applied from the vendored art constants",
  );
  assert.ok(env.headChildren.length >= 2, "style node + favicon mounted");
  const observer = env.lastObserver();
  assert.ok(observer, "theme observer registered");
  assert.equal(observer!.observed.length, 1);
  assert.deepEqual(observer!.observed[0]!.options, {
    attributes: true,
    attributeFilter: ["data-ds-dark-theme"],
  });

  session.teardown();

  assert.ok(!("dshDragonHeir" in env.body.dataset), "body marker retracted");
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

test("dragon-heir theme flip swaps artwork live through the observer, teardown still unwinds", (t) => {
  const env = createFakeEnv();
  t.after(() => env.restore());

  const session = activateDragonHeirSession(env.ctx, env.skinCtx);
  const artLayer = env.bodyChildren[0]!;
  const lightImage = String(artLayer.style.getPropertyValue("background-image"));

  env.body.dataset.dsDarkTheme = "";
  env.lastObserver()!.trigger();
  const darkImage = String(artLayer.style.getPropertyValue("background-image"));
  assert.notEqual(darkImage, lightImage, "dark artwork swapped in");
  assert.ok(darkImage.includes("data:image/webp"));

  session.teardown();
  assert.ok(!("dshDragonHeir" in env.body.dataset));
  assert.ok(everythingRemoved(env));
});

test("dragon-heir teardown is idempotent when driven through deactivate", (t) => {
  const env = createFakeEnv();
  t.after(() => env.restore());

  const activation = createDragonHeirActivation(env.ctx);
  activation.activate(env.skinCtx);
  assert.equal(env.body.dataset.dshDragonHeir, "");

  activation.deactivate();
  assert.ok(!("dshDragonHeir" in env.body.dataset));
  assert.ok(everythingRemoved(env));
  const snapshot = snapshotOf(env);

  activation.deactivate();
  assert.equal(snapshotOf(env), snapshot, "deactivate is idempotent (§4.3)");
});

test("dragon-heir activation abort tears the session down", (t) => {
  const env = createFakeEnv();
  t.after(() => env.restore());

  activateDragonHeirSession(env.ctx, env.skinCtx);
  assert.equal(env.body.dataset.dshDragonHeir, "");

  env.abort();

  assert.ok(!("dshDragonHeir" in env.body.dataset));
  assert.ok(everythingRemoved(env));
  assert.ok(env.lastObserver()!.isDisconnected);
});

test("dragon-heir fiber dispose safety net tears the session down (R8)", (t) => {
  const env = createFakeEnv();
  t.after(() => env.restore());

  const activation = createDragonHeirActivation(env.ctx);
  activation.activate(env.skinCtx);
  assert.equal(env.body.dataset.dshDragonHeir, "");

  env.unloadFiber();

  assert.ok(!("dshDragonHeir" in env.body.dataset));
  assert.ok(everythingRemoved(env));
});
