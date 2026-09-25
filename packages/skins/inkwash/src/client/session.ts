/**
 * 水墨青烟的激活会话（公约 §4.2 语义事件的皮肤侧实现）。
 *
 * 与 aurora 的 session.ts 同一套纪律（R8 的实现样板，逐条注释见彼处）：
 * - activate 的每一项副作用都登记进 `disposers`，teardown 逆序撤销且幂等；
 * - deactivate、`skinCtx.signal` abort、fiber dispose（ctx.effect 安全网）三路汇合；
 * - 主题偏好礼让：激活期间用户自己换走了偏好，teardown 不改写用户最新选择。
 *
 * 与 aurora 的差异（同为外部开发者的两种合法形态）：
 * - 无 configForms/locale——inkwash 不提供设置与设置 UI；
 * - 只有一个 shell.overlay 氛围层席位 + 主题 + 自有 style 节点。
 *
 * 纯 .ts（零 JSX）：node --test 在 fake 环境直测；组件由 client/index.tsx 注入。
 */

import type {
  SkinActivationContext,
  SkinClientContext,
  SkinDom,
} from "../context.ts";
import { ACTIVE_BODY_ATTR, STYLE_ATTR, buildInkwashCss } from "../background.ts";
import { CSS_PREFIX, SKIN_ID } from "../identity.ts";
import { INKWASH_OVERRIDE_SOURCE, INKWASH_THEME, INKWASH_TOKEN_OVERRIDES } from "../theme.ts";

/** list 槽位席位键（自有前缀，不与加载器/aurora 撞名，R3）。 */
export const BACKDROP_SEAT_ID = `${CSS_PREFIX}-backdrop`;

/** 氛围层排在加载器浮层（order 90）之前，尽量贴底。 */
const BACKDROP_ORDER = 10;

/** 会话组件工厂（真实 React 实现由 client/index.tsx 注入；测试注入记账桩）。 */
export interface InkwashSessionDeps {
  /** 水墨氛围层组件（shell.overlay 席位）。 */
  createBackdrop(): (props: never) => unknown;
  /** DOM 最小面（生产用真实 document；测试注入桩）。 */
  dom?: SkinDom;
}

/** 一次激活会话。唯一对外能力 = teardown（幂等，可被多条路径重复触发）。 */
export interface SkinSession {
  teardown(): void;
}

/**
 * 执行激活：提交主题、注入样式、注册氛围层席位。
 * 抛错即激活失败（加载器回滚到无皮肤状态——公约 §4.4）；
 * 主题切换失败时先撤掉已注册的主题再抛，不留半套皮肤。
 */
export function activateInkwashSession(
  ctx: SkinClientContext,
  skinCtx: SkinActivationContext,
  deps: InkwashSessionDeps,
): SkinSession {
  const dom: SkinDom = deps.dom ?? document;
  let tornDown = false;
  const disposers: Array<() => void> = [];

  skinCtx.logger.info("inkwash: activating", { skin: SKIN_ID });

  // ---- 0. 激活标记（残留断言锚点；teardown 移除）
  dom.body.setAttribute(ACTIVE_BODY_ATTR, "");

  // ---- 1. 主题：注册自有主题 + 叠 token 覆盖层（观感由覆盖层承载；本皮肤不写
  // 偏好轴——自定义主题 id 是会话级偏好且会被宿主 adopt() 回拉，机制见 theme.ts）
  let disposeTheme: (() => void) | undefined;
  let disposeOverride: (() => void) | undefined;
  try {
    disposeTheme = ctx.theme.register(INKWASH_THEME);
    disposeOverride = ctx.theme.overrideTokens(INKWASH_OVERRIDE_SOURCE, INKWASH_TOKEN_OVERRIDES);
  } catch (error) {
    disposeTheme?.();
    dom.body.removeAttribute(ACTIVE_BODY_ATTR);
    throw error;
  }
  disposers.push(disposeTheme);
  disposers.push(disposeOverride);

  // ---- 2. 自有 style 节点（宣纸背景 + 氛围层样式）
  const styleNode = dom.createElement("style");
  styleNode.setAttribute(STYLE_ATTR, "");
  styleNode.textContent = buildInkwashCss();
  dom.head.appendChild(styleNode);
  disposers.push(() => styleNode.remove());

  // ---- 3. 氛围层席位（经皮肤自身 ctx.slots——disposer 归皮肤 fiber，公约 R8）
  const disposeBackdropSeat = ctx.slots.inject("shell.overlay", () =>
    ctx.slots.register(
      { name: "shell.overlay", id: BACKDROP_SEAT_ID, order: BACKDROP_ORDER },
      deps.createBackdrop(),
    ),
  );
  disposers.push(disposeBackdropSeat);

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
        skinCtx.logger.warn("inkwash: teardown step failed", { error: String(error) });
      }
    }
    dom.body.removeAttribute(ACTIVE_BODY_ATTR);
    skinCtx.logger.info("inkwash: deactivated — all side effects unwound");
  }

  return { teardown };
}

/** activate/deactivate 句柄（client apply 交给 registerSkin 的那对回调）。 */
export function createInkwashActivation(ctx: SkinClientContext, deps: InkwashSessionDeps) {
  let activeSession: SkinSession | null = null;
  let safetyNetRegistered = false;

  return {
    activate(skinCtx: SkinActivationContext): void {
      if (activeSession !== null) activeSession.teardown();
      activeSession = activateInkwashSession(ctx, skinCtx, deps);
      if (!safetyNetRegistered) {
        safetyNetRegistered = true;
        ctx.effect(() => () => activeSession?.teardown(), "skn-inkwash: session safety net (fiber dispose, R8)");
      }
    },
    deactivate(): void {
      activeSession?.teardown();
      activeSession = null;
    },
  };
}
