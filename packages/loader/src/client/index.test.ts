/**
 * client 半接线单测（T2.4/T2.5）：service 提供（api-notes §4）、ctx.effect 生命周期
 * 登记（§2）、服务注入清单（R10 定案）、控制台控制台工厂接线——全部以语义形状 fakes
 * 驱动。bundle 注册形态（__ModuleLoader__ 外壳）由打包脚本产出，形态在 build 时校验。
 *
 * 本文件只 import 纯 .ts 的 wiring.ts（client/index.ts 是 bundle 打包入口，
 * 传递依赖 console/*.tsx——JSX 语法在 Node 24 type-stripping 下不可执行，
 * 组件本体以 Playwright 实测代替，见 task-7 报告的取舍说明）。
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Dsh017ClientContext } from "../adapter/dsh-0.1.7.ts";
import { SERVICE_NAME, type SkinLoaderService } from "../protocol.ts";
import { applyClient, CLIENT_INJECT, type ClientWiringDeps } from "./wiring.ts";

function createFakeClientCtx(settingsValue: Record<string, unknown>) {
  let snapshot = {
    status: "ready" as const,
    value: settingsValue,
    revision: 1,
    writable: true,
  };
  const upstreamFormSubscribers = new Set<() => void>();
  const upstreamForm = {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      upstreamFormSubscribers.add(listener);
      return () => {
        upstreamFormSubscribers.delete(listener);
      };
    },
    async set(field: string, value: unknown) {
      snapshot = { ...snapshot, value: { ...snapshot.value, [field]: value }, revision: snapshot.revision + 1 };
      for (const listener of upstreamFormSubscribers) {
        listener();
      }
      return true;
    },
  };
  const provided: Array<{ name: string; value: unknown }> = [];
  const effectBodies: Array<{ execute: () => (() => unknown) | void; label?: string }> = [];
  const remoteSubscriptions: Array<{ event: string; listener: (...args: unknown[]) => void }> = [];
  const eventSubscriptions: Array<{ event: string; listener: (...args: unknown[]) => void }> = [];
  const ctx: Dsh017ClientContext = {
    provide(name, value) {
      provided.push({ name, value });
      return () => undefined;
    },
    effect(execute, label) {
      effectBodies.push({ execute, label });
      return undefined;
    },
    slots: {
      register: () => () => undefined,
      inject: () => () => undefined,
    },
    theme: {
      register: () => () => undefined,
      overrideTokens: () => () => undefined,
      getTheme: () => ({ preference: "system", active: { colorScheme: "light" } }),
    },
    configForms: {
      get: () => upstreamForm,
    },
    locale: {
      register: () => () => undefined,
      bind: () => (key: string) => key,
    },
    remote: {
      $on(event, listener) {
        remoteSubscriptions.push({ event, listener });
        return () => undefined;
      },
    },
    on(event, listener) {
      eventSubscriptions.push({ event, listener });
      return () => undefined;
    },
  };
  return {
    ctx,
    provided,
    effectBodies,
    remoteSubscriptions,
    eventSubscriptions,
    persistedValue: () => snapshot.value,
  };
}

/** console 工厂 fake：记录被传入的 adapter/runtime，返回可观察的 start/dispose。 */
function createFakeConsoleDeps(): ClientWiringDeps & {
  receivedRuntimes: unknown[];
  receivedAdapters: unknown[];
  readonly starts: number;
  disposed: () => boolean;
} {
  const receivedRuntimes: unknown[] = [];
  const receivedAdapters: unknown[] = [];
  let starts = 0;
  let disposed = false;
  return {
    receivedRuntimes,
    receivedAdapters,
    get starts() {
      return starts;
    },
    disposed: () => disposed,
    createConsoleController(options) {
      receivedRuntimes.push(options.runtime);
      receivedAdapters.push(options.adapter);
      return {
        start() {
          starts++;
          return () => {
            disposed = true;
          };
        },
      };
    },
  };
}

test("client wiring exports the R10 service injection list including theme and locale", () => {
  assert.deepEqual(CLIENT_INJECT, ["slots", "configForms", "remote", "theme", "locale"]);
});

test("apply provides the frozen uiSkinLoader service and registers two lifecycle effects", async () => {
  const deps = createFakeConsoleDeps();
  const fake = createFakeClientCtx({
    activeSkin: "default",
    faultLog: [],
    diagnosticsEnabled: false,
  });
  applyClient(fake.ctx, deps);

  // 服务提供（api-notes §4：ctx.provide 是唯一形态）
  assert.equal(fake.provided.length, 1);
  assert.equal(fake.provided[0]?.name, SERVICE_NAME);
  const service = fake.provided[0]?.value as SkinLoaderService;
  assert.equal(Object.isFrozen(service), true);
  for (const key of ["registerSkin", "list", "current", "switchTo", "subscribe"]) {
    assert.equal(typeof (service as unknown as Record<string, unknown>)[key], "function");
  }

  // 生命周期经 ctx.effect 登记（api-notes §2）：runtime + 控制台两段
  assert.equal(fake.effectBodies.length, 2);
  assert.match(fake.effectBodies[0]?.label ?? "", /skin runtime/);
  assert.match(fake.effectBodies[1]?.label ?? "", /console/);

  // 控制台工厂收到冻结 runtime 面并尚未启动
  assert.equal(deps.receivedRuntimes.length, 1);
  assert.equal(Object.isFrozen(deps.receivedRuntimes[0]), true);
  assert.equal(deps.starts, 0);

  // 走一遍完整生命周期：登记 → 激活 → dispose（触发 3/4）
  const start = fake.effectBodies[0]?.execute;
  assert.ok(start, "runtime effect body must be captured");
  const off = start() as () => Promise<void>;
  assert.equal(fake.remoteSubscriptions.length, 1);
  assert.equal(fake.remoteSubscriptions[0]?.event, "settings/document-updated");
  assert.equal(service.current(), "default");

  const activated: string[] = [];
  service.registerSkin({
    apiVersion: "dsh.ecosystem.ui-skin-loader/v1",
    id: "alpha",
    name: "Alpha",
    version: "1.0.0",
    activate: () => {
      activated.push("activate");
    },
    deactivate: () => {
      activated.push("deactivate");
    },
  });
  const result = await service.switchTo("alpha");
  assert.deepEqual(result, { ok: true });
  assert.equal(service.current(), "alpha");

  await off();
  assert.deepEqual(activated, ["activate", "deactivate"]);
  assert.equal(service.current(), "default");
});

test("console mounting effect receives the adapter (theme/locale faces) and disposes on stop", () => {
  const deps = createFakeConsoleDeps();
  const fake = createFakeClientCtx({
    activeSkin: "default",
    faultLog: [],
    diagnosticsEnabled: false,
  });
  applyClient(fake.ctx, deps);
  const consoleEffect = fake.effectBodies[1]?.execute;
  assert.ok(consoleEffect, "console effect body must be captured");
  const off = consoleEffect() as () => void;
  // 控制台拿到与 runtime 同源的 adapter（含 theme.getTheme 与 events.on 订阅面，
  // 真实 mount 用它们订阅 theme/change 与 locale/change——见 console/mount.tsx；
  // 组件渲染语义由 Playwright 实测覆盖）。
  const receivedAdapter = deps.receivedAdapters[0] as {
    theme: { getTheme: unknown };
    events: { on: unknown };
  };
  assert.equal(typeof receivedAdapter?.theme?.getTheme, "function");
  assert.equal(typeof receivedAdapter?.events?.on, "function");
  assert.equal(deps.starts, 1);
  off();
  assert.equal(deps.disposed(), true);
});

test("apply-driven runtime persists activeSkin through the configForms channel", async () => {
  const deps = createFakeConsoleDeps();
  const fake = createFakeClientCtx({
    activeSkin: "default",
    faultLog: [],
    diagnosticsEnabled: false,
  });
  applyClient(fake.ctx, deps);
  const start = fake.effectBodies[0]?.execute;
  assert.ok(start, "effect body must be captured");
  const off = start() as () => Promise<void>;
  const service = fake.provided[0]?.value as SkinLoaderService;
  service.registerSkin({
    apiVersion: "dsh.ecosystem.ui-skin-loader/v1",
    id: "alpha",
    name: "Alpha",
    version: "1.0.0",
    activate: () => undefined,
    deactivate: () => undefined,
  });
  await service.switchTo("alpha");
  // 落盘经 adapter.settings.get(SETTINGS_NAMESPACE) → configForms 表单写（api-notes §8.2）
  assert.equal((fake.persistedValue() as { activeSkin: string }).activeSkin, "alpha");
  await off();
});
