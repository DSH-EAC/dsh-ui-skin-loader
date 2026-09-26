/**
 * 交易终端的激活会话（公约 §4.2 语义事件的皮肤侧实现）。
 *
 * 迁移形态：观感与行为内容 = `../vendor/dsh-web-ui-client.js` 的上游 apply
 * （原样迁移：标题栏/跑马灯/状态栏 DOM、行情轮询、favicon、样式注入），本模块
 * 只做公约化适配——把上游 cordis 形态的副作用收进 activate：
 * - 上游 `ctx.effect(() => disposer)` 的 disposer 进本会话的 `disposers` 账本；
 * - 上游 `ctx.get(name)` 以 best-effort 镜像（上游 inject 为空、调用点自带
 *   try/catch 降级，connection/workspaces 缺席不影响观感）；
 * - teardown 逆序撤销且幂等——deactivate、`skinCtx.signal` abort、皮肤 fiber
 *   意外 dispose（ctx.effect 安全网）、apply 半途抛错（激活失败回滚）四条路
 *   汇入同一个 teardown（R8 样板）。
 */

import type {
  SkinActivationContext,
  SkinClientContext,
  VendoredSkinContext,
} from "../context.ts";
import { SKIN_ID } from "../identity.ts";
import { ACTIVE_BODY_MARKER, UPSTREAM_PACKAGE } from "../markers.ts";
import { apply as applyVendoredSkin } from "../vendor/dsh-web-ui-client.js";

/** 一次激活会话。唯一对外能力 = teardown（幂等，可被多条路径重复触发）。 */
export interface SkinSession {
  teardown(): void;
}

/** 上游 chrome DOM 自有的 data 标记（titlebar/tape/statusbar；激活期间新增者会被差集清扫）。 */
const CHROME_SELECTOR = "[data-skin-chrome]";

/** 上游 favicon 的自有形态：rel=icon 且 href 为 data URI（激活期间新增者会被差集清扫）。 */
const FAVICON_SELECTOR = 'link[rel~="icon"]';

function isDataUriFavicon(node: Element): boolean {
  const href = (node as HTMLLinkElement).href || node.getAttribute("href") || "";
  return href.startsWith("data:");
}

/**
 * data 属性名 → dataset 键（`data-dsh-trading` → `dshTrading`）。
 * 上游以 body.dataset 写激活标记，残留清扫按同一键位读写。
 */
function datasetKey(attribute: string): string {
  return attribute.replace(/^data-/, "").replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}

function collectOwnChromeNodes(): Array<{ remove(): void }> {
  if (typeof document === "undefined") return [];
  return [...document.querySelectorAll(CHROME_SELECTOR)] as unknown as Array<{ remove(): void }>;
}

function collectOwnFaviconNodes(): Array<{ remove(): void }> {
  if (typeof document === "undefined") return [];
  return [...document.querySelectorAll(FAVICON_SELECTOR)].filter(isDataUriFavicon) as unknown as Array<{
    remove(): void;
  }>;
}

/**
 * 执行激活：调用上游 apply，其全部副作用（body 标记、chrome DOM、style 节点、
 * favicon、轮询定时器）自此发生；上游登记的 disposer 全部收进账本。
 * 抛错即激活失败（加载器回滚到无皮肤状态——公约 §4.4）；本适配层保证抛错前
 * 已发生的半套副作用也被一并撤净（partial-apply 快照，见下）。
 */
export function activateTradingSession(
  ctx: SkinClientContext,
  skinCtx: SkinActivationContext,
  applyImpl: (vendoredCtx: VendoredSkinContext) => void = applyVendoredSkin,
): SkinSession {
  let tornDown = false;
  const disposers: Array<() => void> = [];

  skinCtx.logger.info("trading: activating (vendored dsh-web-ui client)", { skin: SKIN_ID });

  // ---- §4.3 补齐 1（公约化适配）：上游 disposer 撤 DOM/定时器/favicon/标题，
  // 但不撤自己的 style 节点——上游形态里样式随插件常驻、从不卸载。公约要求
  // 「退出后不可观测」，适配层在 teardown 时按本皮肤自有的 data-plugin 标记
  // 清扫自产 style 节点（惰性收集：activate 期间注入的都算，apply 抛错时也
  // 参与回滚，不留半套皮肤）。
  disposers.push(() => {
    for (const node of collectOwnStyleNodes()) node.remove();
  });

  // ---- §4.3 补齐 2（partial-apply 快照）：上游 apply 的行为契约是「副作用全部
  // 挂好 → 最后一步 ctx.effect 注册 disposer」。若 apply 中途抛错，已发生的副
  // 作用没有任何 disposer 覆盖。适配层在 apply 前快照本皮肤自有命名空间的锚点
  // （上游自有的 chrome 标记 / data-URI favicon / body 激活标记），注册一个按
  // **差集**清扫的兜底 disposer——只撤激活期间新出现的东西，宿主与其它皮肤的
  // 节点永不触碰（R2/R3）。成功路径下它与上游 disposer 语义重叠，幂等无副作用
  // （双保险）；失败路径下它是唯一的清理者。
  const chromeBefore = new Set(collectOwnChromeNodes());
  const faviconBefore = new Set(collectOwnFaviconNodes());
  const markerBefore =
    typeof document !== "undefined" && datasetKey(ACTIVE_BODY_MARKER) in document.body.dataset;
  const pollHandles: Array<ReturnType<typeof setInterval>> = [];
  disposers.push(() => {
    for (const node of collectOwnChromeNodes()) if (!chromeBefore.has(node)) node.remove();
    for (const node of collectOwnFaviconNodes()) if (!faviconBefore.has(node)) node.remove();
    if (!markerBefore && datasetKey(ACTIVE_BODY_MARKER) in document.body.dataset) {
      delete document.body.dataset[datasetKey(ACTIVE_BODY_MARKER)];
    }
    for (const handle of pollHandles) clearInterval(handle);
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

  // ---- 定时器捕获：apply 是同步窗口，期间新建的 setInterval 只可能是上游的
  // 轮询定时器。临时替换全局 setInterval 记录句柄（finally 恢复原函数），差集
  // disposer 据此在失败路径清掉尚未登记 disposer 的裸定时器；成功路径上游
  // disposer 自己清（重复 clearInterval 无害）。
  const globalRef = globalThis as {
    setInterval?: typeof setInterval;
    clearInterval?: typeof clearInterval;
  };
  const originalSetInterval = globalRef.setInterval;
  if (typeof originalSetInterval === "function" && typeof globalRef.clearInterval === "function") {
    globalRef.setInterval = ((handler: Parameters<typeof setInterval>[0], timeout?: number, ...args: unknown[]) => {
      const handle = originalSetInterval.call(globalThis, handler, timeout, ...(args as unknown as []));
      pollHandles.push(handle);
      return handle;
    }) as typeof setInterval;
  }

  // 激活前标题快照（apply 前取值才是「激活前」；仅失败路径用它恢复标题）。
  const originalTitle = typeof document !== "undefined" ? document.title : "";

  // abort 监听先于 apply 注册：abort 路径也能撤掉半途状态（R8 样板）。
  const onAbort = () => teardown();
  skinCtx.signal.addEventListener("abort", onAbort);

  try {
    applyImpl(vendoredCtx);
  } catch (error) {
    // ---- 激活失败（公约 §4.4 皮肤侧义务）：先撤净半套副作用再原样上抛。
    // 标题恢复只在此同步失败窗口内做（宿主不可能在同步窗口改标题）——正常
    // teardown 路径不碰标题，上游 disposer 的条件恢复语义原样保留。
    teardown();
    if (typeof document !== "undefined" && document.title !== originalTitle) {
      document.title = originalTitle;
    }
    throw error;
  } finally {
    if (typeof originalSetInterval === "function") globalRef.setInterval = originalSetInterval;
  }

  // ---- teardown：逆序撤销全部副作用（幂等；deactivate / abort / fiber dispose /
  // apply 半途抛错 四路汇合）
  function teardown(): void {
    if (tornDown) return;
    tornDown = true;
    skinCtx.signal.removeEventListener("abort", onAbort);
    for (let i = disposers.length - 1; i >= 0; i--) {
      try {
        disposers[i]!();
      } catch (error) {
        // 单项撤销失败不阻断其余撤销（尽力退净），但如实留痕
        skinCtx.logger.warn("trading: teardown step failed", { error: String(error) });
      }
    }
    skinCtx.logger.info("trading: deactivated — all side effects unwound");
  }

  return { teardown };
}

/**
 * 收集本皮肤自产的 style 节点（自有 `style[data-plugin="<上游包名>"]` 标记——
 * 上游自己的节点命名约定；只碰自有节点，不触达宿主或其它皮肤的 DOM，R2/R5）。
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
 * - activate 半途抛错：会话自回滚后抛错穿透，activeSession 保持 null，
 *   加载器随后的兜底 deactivate 是无害空操作（残留已由本函数撤净）；
 * - fiber-dispose 安全网只注册一次（R8：fiber 意外死亡时兜底拆会话）。
 */
export function createTradingActivation(ctx: SkinClientContext) {
  let activeSession: SkinSession | null = null;
  let safetyNetRegistered = false;

  return {
    activate(skinCtx: SkinActivationContext): void {
      if (activeSession !== null) activeSession.teardown();
      activeSession = activateTradingSession(ctx, skinCtx);
      if (!safetyNetRegistered) {
        safetyNetRegistered = true;
        ctx.effect(() => () => activeSession?.teardown(), "skn-trading: session safety net (fiber dispose, R8)");
      }
    },
    deactivate(): void {
      activeSession?.teardown();
      activeSession = null;
    },
  };
}
