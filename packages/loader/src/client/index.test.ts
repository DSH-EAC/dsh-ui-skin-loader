/**
 * client 半接线单测（T2.4）：bundle 注册形态（api-notes §1.4/§3.1）、
 * service 提供（§4）、ctx.effect 生命周期登记（§2）——全部以语义形状 fakes 驱动。
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Dsh017ClientContext } from "../adapter/dsh-0.1.7.ts";
import { installTestModuleLoader } from "../adapter/test-module-loader.ts";
import { SERVICE_NAME, type SkinLoaderService } from "../protocol.ts";

interface ClientExports {
  inject: string[];
  apply: (ctx: Dsh017ClientContext) => void;
}

let cachedExports: ClientExports | null = null;

/**
 * 安装 facade fake 并动态 import client 半
 * （模块顶层执行 load；ESM 缓存使后续调用复用同一份 registration/exports）。
 */
async function loadClientExports(): Promise<ClientExports> {
  if (cachedExports) {
    return cachedExports;
  }
  const facade = installTestModuleLoader();
  await import("./index.ts");
  const registration = facade.registrations[0];
  if (!registration) {
    throw new Error("client bundle never registered via the module loader facade");
  }
  cachedExports = registration.factory(undefined) as unknown as ClientExports;
  return cachedExports;
}

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
  const effectBodies: Array<() => (() => unknown) | void> = [];
  const remoteSubscriptions: Array<{ event: string; listener: (...args: unknown[]) => void }> = [];
  const ctx: Dsh017ClientContext = {
    provide(name, value) {
      provided.push({ name, value });
      return () => undefined;
    },
    effect(execute) {
      effectBodies.push(execute);
      return undefined;
    },
    slots: {
      register: () => () => undefined,
      inject: () => () => undefined,
    },
    theme: {
      register: () => () => undefined,
      overrideTokens: () => () => undefined,
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
  };
  return {
    ctx,
    provided,
    effectBodies,
    remoteSubscriptions,
    persistedValue: () => snapshot.value,
  };
}

test("client bundle registers via __ModuleLoader__ with the package id and inject list", async () => {
  const exports = await loadClientExports();
  assert.deepEqual(exports.inject, ["slots", "configForms", "remote"]);
  assert.equal(typeof exports.apply, "function");
});

test("apply provides the frozen uiSkinLoader service and registers lifecycle via ctx.effect", async () => {
  const exports = await loadClientExports();
  const fake = createFakeClientCtx({
    activeSkin: "default",
    faultLog: [],
    diagnosticsEnabled: false,
  });
  exports.apply(fake.ctx);

  // 服务提供（api-notes §4：ctx.provide 是唯一形态）
  assert.equal(fake.provided.length, 1);
  assert.equal(fake.provided[0]?.name, SERVICE_NAME);
  const service = fake.provided[0]?.value as SkinLoaderService;
  assert.equal(Object.isFrozen(service), true);
  for (const key of ["registerSkin", "list", "current", "switchTo", "subscribe"]) {
    assert.equal(typeof (service as unknown as Record<string, unknown>)[key], "function");
  }

  // 生命周期经 ctx.effect 登记（api-notes §2：unload 逆序释放）
  assert.equal(fake.effectBodies.length, 1);

  // 走一遍完整生命周期：登记 → 激活 → dispose（触发 3/4）
  const start = fake.effectBodies[0];
  assert.ok(start, "effect body must be captured");
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

test("apply-driven runtime persists activeSkin through the configForms channel", async () => {
  const exports = await loadClientExports();
  const fake = createFakeClientCtx({
    activeSkin: "default",
    faultLog: [],
    diagnosticsEnabled: false,
  });
  exports.apply(fake.ctx);
  const start = fake.effectBodies[0];
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
