/**
 * @dsh-eac/ui-skin-loader 的 client 半 bundle 入口（T2.4 接线 + T2.5 控制台）。
 *
 * 本文件是打包入口，导出 DSH client bundle 契约的两件东西（api-notes §1.4/§4）：
 * - `inject`：cordis 服务名数组（vendored Loader 等服务就绪才跑 apply）；
 * - `apply(ctx)`：provide 皮肤注册服务 + 登记生命周期 + 挂载控制台。
 *
 * DSH 契约的 bundle 外壳
 *   window.__ModuleLoader__.load({ id, factory: (require) => … return module.exports })
 * 由打包脚本（scripts/build-artifact.mjs）以 banner/footer 形态包在本模块产物外——
 * 仓库源码内不直接引用上游私有全局 `__ModuleLoader__`（adapter 隔离纪律；
 * `getModuleLoader` 投影保留给需要手工装配的场合）。
 */

import type { Dsh017ClientContext } from "../adapter/dsh-0.1.7.ts";
import { createConsoleController } from "./console/mount.tsx";
import { applyClient, CLIENT_INJECT } from "./wiring.ts";

/** cordis 服务注入（wiring.ts 维护；bundle exports 顶层透出）。 */
export const inject: string[] = CLIENT_INJECT;

/** client apply（api-notes §1.4：Loader 材料化本 bundle 后以 entry fiber 调用）。 */
export function apply(ctx: Dsh017ClientContext): void {
  applyClient(ctx, { createConsoleController });
}
