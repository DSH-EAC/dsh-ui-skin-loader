/**
 * client 半的 apply 接线（T2.4 引入、T2.5 扩展 console 挂载）。
 *
 * 本文件刻意保持纯 .ts（零 React/零 JSX）——node --test 可直接驱动接线单测
 * （console 控制台工厂以依赖注入形态传入，测试用 fake 顶替）。
 * bundle 入口 `client/index.ts` 把真实控制台工厂接进来并作为 ESM exports
 * （inject + apply）；打包时由 build 脚本包上
 * `window.__ModuleLoader__.load({id, factory})` 外壳（api-notes §1.4 形态）。
 *
 * 服务注入（api-notes §4 R10 定案）：exports.inject = 服务名数组，vendored Loader
 * 等这些服务就绪才跑 apply——
 * - `slots`：SkinSlotHandle 背后的槽位注册面（SkinContext.slots）+ 控制台三槽位；
 * - `configForms`：host settings 持久化读写（命名空间 dsh-ui-skin-loader）；
 * - `remote`：跨标签页 SSE（settings/document-updated，api-notes §8.3）；
 * - `theme` / `locale`：控制台亮暗自适应与双语跟随（api-notes §7/§10）。
 */

import { createDsh017Adapter, type Dsh017ClientContext } from "../adapter/dsh-0.1.7.ts";
import type { DshAdapter, Disposer } from "../adapter/types.ts";
import { SERVICE_NAME, type SkinLoaderService, type SkinRuntime } from "../protocol.ts";
import { createConsoleLogger } from "./runtime/logger.ts";
import { createSkinRuntime, type SkinRuntimeController } from "./runtime/runtime.ts";

/** cordis 服务注入清单（bundle exports 顶层原样透出）。 */
export const CLIENT_INJECT: string[] = ["slots", "configForms", "remote", "theme", "locale"];

/** 控制台控制台工厂的最小结构面（真实实现见 console/mount.tsx）。 */
export interface ConsoleControllerFace {
  start(): Disposer;
}

export interface ClientWiringDeps {
  createConsoleController(options: {
    adapter: DshAdapter;
    runtime: SkinRuntime;
  }): ConsoleControllerFace;
}

/**
 * client apply 体：构造 adapter 与 SkinRuntime → provide 冻结服务 →
 * ctx.effect 登记两段生命周期（runtime 状态机 + 控制台挂载）。
 * unload 时 cordis 逆序释放：先撤控制台挂载，再停 runtime（deactivate 当前皮肤）。
 */
export function applyClient(ctx: Dsh017ClientContext, deps: ClientWiringDeps): void {
  const adapter = createDsh017Adapter(ctx);
  const runtime: SkinRuntimeController = createSkinRuntime({
    adapter,
    logger: createConsoleLogger("ui-skin-loader"),
  });
  const service: SkinLoaderService = runtime.expose();
  ctx.provide(SERVICE_NAME, service);
  ctx.effect(() => runtime.start(), "ui-skin-loader: skin runtime lifecycle");
  const consoleController = deps.createConsoleController({ adapter, runtime: service });
  ctx.effect(() => consoleController.start(), "ui-skin-loader: console mounting");
}
