/**
 * 鲸吟的激活会话（公约 §4.2 语义事件的皮肤侧实现）。
 *
 * 迁移形态：观感与行为内容 = `../vendor/dsh-web-ui-client.js` 的上游 apply
 * （原样迁移：body 海洋背景画 + 亮暗遮罩跟随 + --dsw-skin-scrim 遮罩变量 +
 * favicon + 样式注入），本模块只做公约化适配——把上游 cordis 形态的副作用
 * 收进 activate：
 * - 上游 `ctx.effect(() => disposer)` 的 disposer 进本会话的 `disposers` 账本
 *   （含上游自己的 body 内联样式 round-trip 还原——激活前的值原样退回）；
 * - 上游的 MutationObserver（data-ds-dark-theme 主题跟随）由上游自身登记、
 *   自身 disposer 断开；
 * - teardown 逆序撤销且幂等——deactivate、`skinCtx.signal` abort、皮肤 fiber
 *   意外 dispose（ctx.effect 安全网）三条路汇入同一个 teardown（R8 样板）。
 */

import type {
  SkinActivationContext,
  SkinClientContext,
  VendoredSkinContext,
} from "../context.ts";
import { SKIN_ID } from "../identity.ts";
import { UPSTREAM_PACKAGE } from "../markers.ts";
import { apply as applyVendoredSkin } from "../vendor/dsh-web-ui-client.js";

/** 一次激活会话。唯一对外能力 = teardown（幂等，可被多条路径重复触发）。 */
export interface SkinSession {
  teardown(): void;
}

/**
 * 执行激活：调用上游 apply，其全部副作用（body 标记、body 内联背景、样式
 * 节点、favicon、主题观察器）自此发生；上游登记的 disposer 全部收进账本。
 * 抛错即激活失败（加载器回滚到无皮肤状态——公约 §4.4）。
 */
export function activateWhaleSongSession(
  ctx: SkinClientContext,
  skinCtx: SkinActivationContext,
): SkinSession {
  let tornDown = false;
  const disposers: Array<() => void> = [];

  skinCtx.logger.info("whale-song: activating (vendored dsh-web-ui client)", { skin: SKIN_ID });

  // ---- §4.3 补齐（公约化适配，唯一超出上游行为的清理）：上游 disposer 撤
  // body 内联样式/观察器/favicon，但不撤自己的 style 节点——上游形态里样式随
  // 插件常驻、从不卸载。公约要求「退出后不可观测」，适配层在 teardown 时按
  // 本皮肤自有的 data-plugin 标记清扫自产 style 节点（惰性收集：activate 期间
  // 注入的都算，activate 抛错时也参与回滚，不留半套皮肤）。
  disposers.push(() => {
    for (const node of collectOwnStyleNodes()) node.remove();
  });

  // 上游 apply 的 ctx 适配面：effect = cordis 语义（disposer 进账本），get = best-effort。
  const vendoredCtx: VendoredSkinContext = {
    effect(execute) {
      const disposer = execute();
      if (typeof disposer === "function") disposers.push(disposer);
      return disposer;
    },
    get(name) {
      return readHostService(ctx, name);
    },
  };

  applyVendoredSkin(vendoredCtx);

  // ---- teardown：逆序撤销全部副作用（幂等；deactivate / abort / fiber dispose 三路汇合）
  const onAbort = () => teardown();
  skinCtx.signal.addEventListener("abort", onAbort);

  function teardown(): void {
    if (tornDown) return;
    tornDown = true;
    skinCtx.signal.removeEventListener("abort", onAbort);
    for (let i = disposers.length - 1; i >= 0; i--) {
      try {
        disposers[i]!();
      } catch (error) {
        // 单项撤销失败不阻断其余撤销（尽力退净），但如实留痕
        skinCtx.logger.warn("whale-song: teardown step failed", { error: String(error) });
      }
    }
    skinCtx.logger.info("whale-song: deactivated — all side effects unwound");
  }

  return { teardown };
}

/**
 * 收集本皮肤自产的 style 节点（自有 `style[data-plugin="<上游包名>"]` 标记——
 * 上游自己的节点命名约定；只碰自有节点，不触达宿主或其它皮肤的 DOM，R3/R5）。
 */
function collectOwnStyleNodes(): Array<{ remove(): void }> {
  if (typeof document === "undefined") return [];
  return Array.from(
    document.querySelectorAll(`style[data-plugin="${UPSTREAM_PACKAGE}"]`),
  ) as unknown as Array<{ remove(): void }>;
}

/**
 * 上游 ctx.get 的 best-effort 镜像：宿主 client ctx 若带 get 定位器则透传，
 * 否则读同名属性；任何失败都归 undefined（上游调用点本就 try/catch 降级）。
 */
function readHostService(ctx: SkinClientContext, name: string): unknown {
  try {
    const host = ctx as SkinClientContext & { get?(name: string): unknown };
    if (typeof host.get === "function") return host.get(name);
    return (ctx as unknown as Record<string, unknown>)[name];
  } catch {
    return undefined;
  }
}

/**
 * activate/deactivate 句柄（client apply 交给 registerSkin 的那对回调）。
 * - 同一时刻至多一个会话（防御：重复 activate 先拆旧会话）；
 * - fiber-dispose 安全网只注册一次（R8：fiber 意外死亡时兜底拆会话）。
 */
export function createWhaleSongActivation(ctx: SkinClientContext) {
  let activeSession: SkinSession | null = null;
  let safetyNetRegistered = false;

  return {
    activate(skinCtx: SkinActivationContext): void {
      if (activeSession !== null) activeSession.teardown();
      activeSession = activateWhaleSongSession(ctx, skinCtx);
      if (!safetyNetRegistered) {
        safetyNetRegistered = true;
        ctx.effect(() => () => activeSession?.teardown(), "skn-whale-song: session safety net (fiber dispose, R8)");
      }
    },
    deactivate(): void {
      activeSession?.teardown();
      activeSession = null;
    },
  };
}
