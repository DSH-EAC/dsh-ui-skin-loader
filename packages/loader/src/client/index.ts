/**
 * @dsh-eac/ui-skin-loader 的 client 半（T2.3 最小壳；打包/实机接线在 T2.7 验证）。
 *
 * 形态权威：docs/api-notes.md §1.4/§4——
 * - bundle 顶层 `window.__ModuleLoader__.load({id, factory})`（经 adapter 投影调用，
 *   本文件不直接触碰上游私有全局——eslint 隔离规则强制）；
 * - factory 返回的 exports 顶层带 `inject`（cordis 服务名数组，fiber 等服务就绪才跑 apply）
 *   与 `apply(ctx)`（api-notes §4 R10 定案）；
 * - apply 内 `ctx.provide("uiSkinLoader", …)` 提供皮肤注册服务（服务提供的唯一形态，api-notes §4）。
 */

import { getModuleLoader, type Dsh017ClientContext } from "../adapter/dsh-0.1.7.ts";

/** graph 行 id == 包名（api-notes §1.4/§3.2）。 */
const CLIENT_BUNDLE_ID = "@dsh-eac/ui-skin-loader";

/** 公约保留面：service 名 `uiSkinLoader`（api-notes §4 落地方案）。 */
export const SERVICE_NAME = "uiSkinLoader";

/**
 * cordis 服务注入（api-notes §4）：最小壳的占位服务不消费上游服务，故为空数组；
 * T2.4 的真实 SkinRuntime 将声明 adapter 的四个 client 面
 * （`["slots", "theme", "configForms", "locale"]`）。
 */
const inject: string[] = [];

function apply(ctx: Dsh017ClientContext): void {
  // 空服务占位（T2.4 换成真实 SkinRuntime）。语义面见 adapter/types.ts。
  const placeholderService: unknown = Object.freeze({});
  ctx.provide(SERVICE_NAME, placeholderService);
}

getModuleLoader().load({
  id: CLIENT_BUNDLE_ID,
  factory: () => ({ inject, apply }),
});
