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

/** 上游 chrome DOM 自有的 data 标记（本皮肤不产 chrome 节点；差集清扫为其兜底）。 */
const CHROME_SELECTOR = "[data-skin-chrome]";

/** 上游 favicon 的自有形态：rel=icon 且 href 为 data URI（激活期间新增者会被差集清扫）。 */
const FAVICON_SELECTOR = 'link[rel~="icon"]';

/**
 * 上游 apply 触碰的 body 内联样式属性集合（上游模块 BACKDROP_PROPERTIES 的
 * 回滚镜像——激活前快照、失败路径原样退回；成功路径由上游自己的 round-trip
 * 还原，本差集为幂等双保险）。
 */
const BACKDROP_PROPERTIES = [
  "background-image",
  "background-position",
  "background-size",
  "background-attachment",
  "background-repeat",
] as const;

function isDataUriFavicon(node: Element): boolean {
  const href = (node as HTMLLinkElement).href || node.getAttribute("href") || "";
  return href.startsWith("data:");
}

/**
 * data 属性名 → dataset 键（`data-dsh-whale-song` → `dshWhaleSong`）。
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
 * 执行激活：调用上游 apply，其全部副作用（body 标记、body 内联背景、样式
 * 节点、favicon、主题观察器）自此发生；上游登记的 disposer 全部收进账本。
 * 抛错即激活失败（加载器回滚到无皮肤状态——公约 §4.4）；本适配层保证抛错前
 * 已发生的半套副作用也被一并撤净（partial-apply 快照，见下）。
 */
export function activateWhaleSongSession(
  ctx: SkinClientContext,
  skinCtx: SkinActivationContext,
  applyImpl: (vendoredCtx: VendoredSkinContext) => void = applyVendoredSkin,
): SkinSession {
  let tornDown = false;
  const disposers: Array<() => void> = [];

  skinCtx.logger.info("whale-song: activating (vendored dsh-web-ui client)", { skin: SKIN_ID });

  // ---- §4.3 补齐 1（公约化适配）：上游 disposer 撤 body 内联样式/观察器/favicon，
  // 但不撤自己的 style 节点——上游形态里样式随插件常驻、从不卸载。公约要求
  // 「退出后不可观测」，适配层在 teardown 时按本皮肤自有的 data-plugin 标记
  // 清扫自产 style 节点（惰性收集：activate 期间注入的都算，apply 抛错时也
  // 参与回滚，不留半套皮肤）。
  disposers.push(() => {
    for (const node of collectOwnStyleNodes()) node.remove();
  });

  // ---- §4.3 补齐 2（partial-apply 快照）：上游 apply 的行为契约是「副作用全部
  // 挂好 → 最后一步 ctx.effect 注册 disposer」。若 apply 中途抛错，已发生的副
  // 作用（body 内联背景、favicon、body 标记）没有任何 disposer 覆盖。适配层在
  // apply 前快照本皮肤自有命名空间的锚点，注册一个按**差集**清扫/还原的兜底
  // disposer——只碰激活期间新出现/被改写的东西，宿主与其它皮肤永不触碰
  // （R2/R3）。成功路径下它与上游 disposer 的 round-trip 语义重叠，幂等无副
  // 作用（双保险）；失败路径下它是唯一的清理者。
  const chromeBefore = new Set(collectOwnChromeNodes());
  const faviconBefore = new Set(collectOwnFaviconNodes());
  const markerBefore =
    typeof document !== "undefined" && datasetKey(ACTIVE_BODY_MARKER) in document.body.dataset;
  const backdropBefore = new Map<string, string>(
    BACKDROP_PROPERTIES.map((prop) => [prop, document.body.style.getPropertyValue(prop)]),
  );
  disposers.push(() => {
    for (const node of collectOwnChromeNodes()) if (!chromeBefore.has(node)) node.remove();
    for (const node of collectOwnFaviconNodes()) if (!faviconBefore.has(node)) node.remove();
    if (!markerBefore && datasetKey(ACTIVE_BODY_MARKER) in document.body.dataset) {
      delete document.body.dataset[datasetKey(ACTIVE_BODY_MARKER)];
    }
    for (const [prop, value] of backdropBefore) {
      if (document.body.style.getPropertyValue(prop) !== value) document.body.style.setProperty(prop, value);
    }
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

  // abort 监听先于 apply 注册：abort 路径也能撤掉半途状态（R8 样板）。
  const onAbort = () => teardown();
  skinCtx.signal.addEventListener("abort", onAbort);

  try {
    applyImpl(vendoredCtx);
  } catch (error) {
    // ---- 激活失败（公约 §4.4 皮肤侧义务）：先撤净半套副作用再原样上抛。
    teardown();
    throw error;
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
