/**
 * @dsh-eac/ui-skin-loader 的 client 半（T2.4：真实 SkinRuntime；打包/实机接线在 T2.7 验证）。
 *
 * 形态权威：docs/api-notes.md §1.4/§4——
 * - bundle 顶层 `window.__ModuleLoader__.load({id, factory})`（经 adapter 投影调用，
 *   本文件不直接触碰上游私有全局——eslint 隔离规则强制）；
 * - factory 返回的 exports 顶层带 `inject`（cordis 服务名数组，fiber 等服务就绪才跑 apply）
 *   与 `apply(ctx)`（api-notes §4 R10 定案）；
 * - apply 内 `ctx.provide(SERVICE_NAME, …)` 提供皮肤注册服务（服务提供的唯一形态，api-notes §4）。
 *
 * 生命周期：`ctx.effect(() => runtime.start())` 登记——unload（加载器停用/宿主退出，
 * 公约 §4.3 触发 3/4）时逆序释放：先撤跨标签页监听，再 deactivate 当前皮肤（async disposer，
 * cordis unload 会等待）。
 */

import { createDsh017Adapter, getModuleLoader, type Dsh017ClientContext } from "../adapter/dsh-0.1.7.ts";
import { SERVICE_NAME } from "../protocol.ts";
import { createSkinRuntime } from "./runtime/runtime.ts";
import { createConsoleLogger } from "./runtime/logger.ts";

/** graph 行 id == 包名（api-notes §1.4/§3.2）。 */
const CLIENT_BUNDLE_ID = "@dsh-eac/ui-skin-loader";

/**
 * cordis 服务注入（api-notes §4）：本插件 client 半运行需要的三个服务——
 * - `slots`：SkinSlotHandle 背后的槽位注册面（SkinContext.slots 的承载）；
 * - `configForms`：host settings 持久化读写（命名空间 dsh-ui-skin-loader）；
 * - `remote`：跨标签页 SSE（settings/document-updated，api-notes §8.3）。
 * theme/locale 由皮肤（T2.6）按需自行 inject，加载器不代收。
 */
const inject: string[] = ["slots", "configForms", "remote"];

function apply(ctx: Dsh017ClientContext): void {
  const adapter = createDsh017Adapter(ctx);
  const runtime = createSkinRuntime({
    adapter,
    logger: createConsoleLogger("ui-skin-loader"),
  });
  ctx.provide(SERVICE_NAME, runtime.expose());
  ctx.effect(() => runtime.start(), "ui-skin-loader: skin runtime lifecycle");
}

getModuleLoader().load({
  id: CLIENT_BUNDLE_ID,
  factory: () => ({ inject, apply }),
});