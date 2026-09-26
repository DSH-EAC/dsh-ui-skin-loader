import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  SkinActivationContext,
  SkinClientContext,
} from "../context.ts";
import { SKIN_META } from "../identity.ts";
import { UPSTREAM_PACKAGE } from "../markers.ts";
import { createTradingActivation, activateTradingSession } from "./session.ts";

// ---------------------------------------------------------------------------
// Fake 环境：上游 apply 直接操作 document/window/定时器（原样迁移的形态），
// 测试以全局桩承接；记账面：body dataset、head/body 子节点、interval、title。
// 每个测试经 t.after(env.restore) 恢复全局，互不串扰。
// ---------------------------------------------------------------------------

class FakeElement {
  className = "";
  dataset: Record<string, string | undefined> = {};
  style: Record<string, string> = {};
  innerHTML = "";
  textContent = "";
  src = "";
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
  getAttribute(name: string): string | null {
    return (this as unknown as Record<string, string | undefined>)[name] ?? null;
  }
  remove(): void {
    this.removed = true;
  }
}

interface FakeEnv {
  ctx: SkinClientContext;
  skinCtx: SkinActivationContext;
  body: FakeElement;
  headChildren: FakeElement[];
  bodyChildren: FakeElement[];
  intervalsSet: number[];
  intervalsCleared: number[];
  title(): string;
  unloadFiber(): void;
  abort(): void;
  restore(): void;
}

function createFakeEnv(): FakeEnv {
  const body = new FakeElement();
  const bodyAppend = body.append.bind(body);
  body.append = (...nodes: FakeElement[]) => {
    bodyAppend(...nodes);
    bodyChildren.push(...nodes);
  };
  const headChildren: FakeElement[] = [];
  const bodyChildren: FakeElement[] = [];
  const intervalsSet: number[] = [];
  const intervalsCleared: number[] = [];
  const effects: Array<() => void> = [];
  let title = "DeepSeek";

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
        return bodyChildren.filter((n) => n.dataset.skinChrome !== undefined && !n.removed);
      }
      if (selector === 'link[rel~="icon"]') {
        return headChildren.filter((n) => (n.rel.split(" ").includes("icon")) && !n.removed);
      }
      return [];
    },
    get title(): string {
      return title;
    },
    set title(value: string) {
      title = value;
    },
  };

  const saved = {
    document: (globalThis as { document?: unknown }).document,
    window: (globalThis as { window?: unknown }).window,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
    fetch: globalThis.fetch,
  };
  (globalThis as { document: unknown }).document = documentStub;
  (globalThis as { window: unknown }).window = { setTimeout: () => 0, clearTimeout: () => {} };
  let intervalId = 0;
  globalThis.setInterval = ((): number => {
    intervalId += 1;
    intervalsSet.push(intervalId);
    return intervalId;
  }) as unknown as typeof setInterval;
  globalThis.clearInterval = ((id: number) => {
    intervalsCleared.push(id);
  }) as unknown as typeof clearInterval;
  // 行情拉取一律 ok:false（上游对失败降级为空行情，不渲染不抛错）；零网络。
  globalThis.fetch = (async () => ({ ok: false })) as unknown as typeof fetch;

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
    intervalsSet,
    intervalsCleared,
    title: () => title,
    unloadFiber: () => {
      for (const disposer of [...effects].reverse()) disposer();
      effects.length = 0;
    },
    abort: () => abortController.abort(),
    restore: () => {
      (globalThis as { document?: unknown }).document = saved.document;
      (globalThis as { window?: unknown }).window = saved.window;
      globalThis.setInterval = saved.setInterval;
      globalThis.clearInterval = saved.clearInterval;
      globalThis.fetch = saved.fetch;
    },
  };
}

function everythingRemoved(env: FakeEnv): boolean {
  return [...env.bodyChildren, ...env.headChildren].every((node) => node.removed);
}

function snapshotOf(env: FakeEnv): string {
  return JSON.stringify({
    bodyChildren: env.bodyChildren.map((n) => [n.className, n.removed]),
    headChildren: env.headChildren.map((n) => [n.dataset.pluginCss, n.removed]),
    cleared: [...new Set(env.intervalsCleared)].sort((a, b) => a - b),
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

test("trading activate mounts the chrome and deactivate unwinds everything (§4.3)", (t) => {
  const env = createFakeEnv();
  t.after(() => env.restore());

  const session = activateTradingSession(env.ctx, env.skinCtx);

  assert.equal(env.body.dataset.dshTrading, "", "body activation marker set");
  assert.deepEqual(
    env.bodyChildren.map((n) => n.dataset.skinChrome).sort(),
    ["statusbar", "tape", "titlebar"],
    "three chrome bars mounted",
  );
  assert.ok(env.headChildren.length >= 2, "style node + favicon mounted");
  assert.ok(
    env.headChildren.some((n) => n.dataset.pluginCss === `${UPSTREAM_PACKAGE}/trading.module.css`),
    "own stylesheet node present",
  );
  assert.equal(env.intervalsSet.length, 3, "three pollers running");
  assert.equal(env.title(), "交易终端 · DeepSeek 在线", "skin title pinned");

  session.teardown();

  assert.ok(!("dshTrading" in env.body.dataset), "body marker retracted");
  assert.ok(everythingRemoved(env), "every mounted node removed");
  assert.deepEqual(
    [...new Set(env.intervalsCleared)].sort((a, b) => a - b),
    [...env.intervalsSet].sort((a, b) => a - b),
    "all three pollers cleared",
  );
  assert.equal(env.title(), "DeepSeek", "document title restored");

  const snapshot = snapshotOf(env);
  session.teardown();
  assert.equal(snapshotOf(env), snapshot, "second teardown changes nothing (idempotent)");
});

test("trading teardown is idempotent when driven through deactivate", (t) => {
  const env = createFakeEnv();
  t.after(() => env.restore());

  const activation = createTradingActivation(env.ctx);
  activation.activate(env.skinCtx);
  assert.equal(env.body.dataset.dshTrading, "");

  activation.deactivate();
  assert.ok(!("dshTrading" in env.body.dataset));
  assert.ok(everythingRemoved(env));
  const snapshot = snapshotOf(env);

  activation.deactivate();
  assert.equal(snapshotOf(env), snapshot, "deactivate is idempotent (§4.3)");
});

test("trading activation abort tears the session down", (t) => {
  const env = createFakeEnv();
  t.after(() => env.restore());

  activateTradingSession(env.ctx, env.skinCtx);
  assert.equal(env.body.dataset.dshTrading, "");

  env.abort();

  assert.ok(!("dshTrading" in env.body.dataset));
  assert.ok(everythingRemoved(env));
});

test("trading fiber dispose safety net tears the session down (R8)", (t) => {
  const env = createFakeEnv();
  t.after(() => env.restore());

  const activation = createTradingActivation(env.ctx);
  activation.activate(env.skinCtx);
  assert.equal(env.body.dataset.dshTrading, "");

  env.unloadFiber();

  assert.ok(!("dshTrading" in env.body.dataset));
  assert.ok(everythingRemoved(env));
});

// ---------------------------------------------------------------------------
// 激活失败回滚（§4.4 皮肤侧义务）：上游 apply 的契约是「副作用全挂好 → 最后一步
// ctx.effect 注册 disposer」。中途抛错时已发生的副作用没有 disposer 覆盖——适配层
// 的 partial-apply 快照（差集清扫 + 定时器捕获 + 标题还原）必须把半套皮肤撤净。
// ---------------------------------------------------------------------------

test("trading mid-apply failure rolls the partial activation back — zero residue (§4.4)", (t) => {
  const env = createFakeEnv();
  t.after(() => env.restore());

  // 半途 apply 会挂上的自产节点（局部变量以便回滚断言）
  const style = new FakeElement();
  style.dataset.plugin = UPSTREAM_PACKAGE;
  style.dataset.pluginCss = `${UPSTREAM_PACKAGE}/trading.module.css`;
  const titlebar = new FakeElement();
  titlebar.dataset.skinChrome = "titlebar";
  const favicon = new FakeElement();
  favicon.rel = "icon";
  favicon.href = "data:image/svg+xml;utf8,candle";

  // 半途 apply：挂上 body 标记 + style 节点 + chrome 条 + data-URI favicon +
  // 钉标题 + 起轮询定时器，然后在注册 disposer 之前抛错（上游最坏的失败形态）。
  const partialApply = (): never => {
    env.body.dataset.dshTrading = "";
    env.headChildren.push(style, favicon);
    env.bodyChildren.push(titlebar);
    (globalThis as { document: { title: string } }).document.title = "交易终端 · DeepSeek 在线";
    globalThis.setInterval(() => {}, 30_000);
    throw new Error("intentional mid-apply failure (task-11 fault drill)");
  };

  assert.throws(
    () => activateTradingSession(env.ctx, env.skinCtx, partialApply),
    /intentional mid-apply failure/,
  );

  assert.ok(!("dshTrading" in env.body.dataset), "body marker rolled back");
  assert.ok(style.removed && titlebar.removed && favicon.removed, "style/chrome/favicon rolled back");
  assert.equal(env.title(), "DeepSeek", "document title restored to pre-activation value");
  assert.deepEqual(
    [...new Set(env.intervalsCleared)].sort((a, b) => a - b),
    [...env.intervalsSet].sort((a, b) => a - b),
    "poll timers created before the throw are all cleared",
  );
});

test("trading stays activatable after a failed activation (fault is not poisonous)", (t) => {
  const env = createFakeEnv();
  t.after(() => env.restore());

  const failingCtx: SkinActivationContext = {
    logger: env.skinCtx.logger,
    signal: new AbortController().signal,
  };
  assert.throws(
    () =>
      activateTradingSession(env.ctx, failingCtx, () => {
        throw new Error("boom");
      }),
    /boom/,
  );

  // 失败后正常激活照常成功、teardown 完整（故障不残留任何状态机层面的问题）。
  const activation = createTradingActivation(env.ctx);
  activation.activate(env.skinCtx);
  assert.equal(env.body.dataset.dshTrading, "");
  activation.deactivate();
  assert.ok(!("dshTrading" in env.body.dataset));
  assert.ok(everythingRemoved(env));
});
