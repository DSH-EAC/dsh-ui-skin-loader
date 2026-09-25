/**
 * DSH 0.1.7-rc.2 的 host 侧 adapter（T2.4）。
 *
 * host 半运行在 Node（`lib/index.js`，api-notes §1.3），可以正常依赖 npm 包——
 * 与 client 半的 bundle 纯度限制（§3.3）无关。本文件是仓库内唯一 import
 * `@deepseek-ai/schemastery` 的位置（eslint 隔离规则只放行 `src/adapter/**`）。
 *
 * 为什么必须有 Config schema（api-notes §8 实读结论，dsh-settings/lib/index.js）：
 * - `describe()` 只为「runtime.Config 存在且有 toJSON」的 entry 生成 descriptor；
 * - host 侧 `write()` 对无 schema 的 entry 抛 `No configurable plugin entry "ns"`，
 *   且表单写只放行 **volatile** 字段（`volatileForm` / `isVolatilePath`）；
 * - 因此 client 半经 `configForms.get("dsh-ui-skin-loader").set(...)` 落盘
 *   activeSkin / faultLog 的唯一正道 = host 半声明含 volatile 字段的 Config schema。
 *   上游先例：ui-theme 的 `Config = z.object({ preference: …volatile(), … })`。
 */

import z from "@deepseek-ai/schemastery";

import { DEFAULT_SKIN_ID } from "../protocol.ts";

/**
 * api-notes §1.3/§4：host cordis ctx 的 adapter 侧最小结构形态
 * （`ctx.inject(deps, cb)` 组子 fiber 等服务就绪后执行 cb——cb 是 Plugin.Function，
 * 首参即子 fiber 的 ctx；`ctx.fiber` 是 Context 上的 Fiber 引用）。
 */
export interface Dsh017HostContext {
  /** 当前 fiber（settings.configure 的 owner 实参，ui-theme 先例）。 */
  readonly fiber?: unknown;
  /** api-notes §4：创建子 fiber 等服务就绪后执行 callback。 */
  inject(
    services: readonly string[],
    callback: (child: Dsh017HostChildContext) => void,
  ): unknown;
}

/** host 子 fiber ctx 的最小形态（加载器只在其中登记 settings 页策略）。 */
export interface Dsh017HostChildContext {
  /** api-notes §2：effect 登记，unload 逆序释放。 */
  effect(execute: () => (() => unknown) | void, label?: string): unknown;
  /** api-notes §8.1：settings 服务（`SettingsForms`）的语义投影。 */
  readonly settings: {
    /**
     * api-notes §8.1：注册本插件实例的设置页策略；`auto: false` = 不自动生成设置页
     * （ui-theme 先例；控制台页面由 T2.5 经 settings.section 自带）。
     * 重复注册抛错——每次 fiber 装配只调一次。
     */
    configure(presentation: { auto?: boolean }, owner?: unknown): () => void;
  };
}

/**
 * 加载器 host 半的 Config schema（settings 命名空间 `dsh-ui-skin-loader`）。
 * 持久化 schema 见 protocol.ts 的 LoaderSettingsValue；三个字段全部 volatile
 * （client 侧 configForms 表单写只放行 volatile 路径，api-notes §8.2）。
 *
 * 默认值与 client 半的运行时假设一致：activeSkin 缺省 "default"（无皮肤），
 * faultLog 缺省空数组（有界 50，裁剪由运行时负责），diagnosticsEnabled 缺省 false。
 *
 * 返回类型由 schemastery 推断（带 toJSON 的 Schema 实例——dsh-settings 的
 * `schema(entry)` 门只认「存在且有 toJSON」的 runtime.Config）。
 */
export function createLoaderConfigSchema() {
  return z.object({
    activeSkin: z.string().default(DEFAULT_SKIN_ID).volatile(),
    faultLog: z
      .array(
        z.object({
          at: z.string(),
          skinId: z.string(),
          kind: z.string(),
          message: z.string(),
        }),
      )
      .default([])
      .volatile(),
    diagnosticsEnabled: z.boolean().default(false).volatile(),
  });
}
