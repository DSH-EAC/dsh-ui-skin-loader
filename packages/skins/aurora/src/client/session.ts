/**
 * 极光之夜的激活会话（公约 §4.2 语义事件的皮肤侧实现）。
 *
 * 生命周期纪律（本包最重要的示范点，对应公约 §4.3/R8）：
 * - activate 里产生的**每一项副作用都登记**进 `disposers`（主题、style 节点、
 *   设置订阅、两个槽位席位、locale 字典），teardown 逆序撤销——deactivate、
 *   `skinCtx.signal` abort、皮肤 fiber 意外 dispose（ctx.effect 安全网）三条路
 *   全部汇入同一个幂等 teardown；
 * - **deactivate 之后逐像素不可观测**：主题偏好恢复、注册 dispose、自有 style
 *   节点与 body 激活标记移除、席位与订阅撤除；
 * - 主题偏好的礼让规则：若激活期间用户自己换走了主题偏好，teardown 不再改写
 *   用户的最新选择（只在我们仍是当前偏好时才恢复激活前的值）。
 *
 * 本模块刻意保持纯 .ts（零 JSX、零 React）——node --test 可在 fake 环境直测；
 * React 组件经 `AuroraSessionDeps` 注入（wiring 在 client/index.tsx，T2.5 同款取舍）。
 */

import type {
  SkinActivationContext,
  SkinClientContext,
  SkinDom,
  SkinSettingsForm,
  Translate,
} from "../context.ts";
import { ACTIVE_BODY_ATTR, STYLE_ATTR, buildAuroraCss } from "../background.ts";
import { CSS_PREFIX, SETTINGS_NAMESPACE, SKIN_ID, SKIN_META } from "../identity.ts";
import { readBackgroundUrl } from "../settings.ts";
import { AURORA_OVERRIDE_SOURCE, AURORA_THEME, AURORA_TOKEN_OVERRIDES } from "../theme.ts";
import { AURORA_LOCALE_DICTS, AURORA_LOCALE_NS } from "./messages.ts";

/** list 槽位席位键（自有前缀；不与加载器 `dsh-ui-skin-loader` 或其它皮肤撞名，R3）。 */
export const SETTINGS_SEAT_ID = `${CSS_PREFIX}-settings`;
export const BACKDROP_SEAT_ID = `${CSS_PREFIX}-backdrop`;

/** 槽位排序：排在加载器控制台分区（order 90）之后。 */
const SETTINGS_SECTION_ORDER = 91;
/** 氛围层排在加载器浮层（order 90）之前，尽量贴底。 */
const BACKDROP_ORDER = 10;

/** 会话组件工厂（真实 React 实现由 client/index.tsx 注入；测试注入记账桩）。 */
export interface AuroraSessionDeps {
  /** 设置分区组件（bindings 携带 configForms 表单与翻译函数）。 */
  createSettingsSection(bindings: { form: SkinSettingsForm; t: Translate }): (props: never) => unknown;
  /** 极光氛围层组件（shell.overlay 席位）。 */
  createBackdrop(): (props: never) => unknown;
  /** DOM 最小面（生产用真实 document；测试注入桩）。 */
  dom?: SkinDom;
}

/** 一次激活会话。唯一对外能力 = teardown（幂等，可被多条路径重复触发）。 */
export interface SkinSession {
  teardown(): void;
}

/**
 * 执行激活：提交主题、注入样式、接通设置订阅、注册两个槽位席位。
 * 抛错即激活失败（加载器会回滚到无皮肤状态并如实展示——公约 §4.4）；
 * 主题切换失败时先撤掉已注册的主题再抛，不留半套皮肤（§4.3「不得残留半个新皮肤」）。
 */
export function activateAuroraSession(
  ctx: SkinClientContext,
  skinCtx: SkinActivationContext,
  deps: AuroraSessionDeps,
): SkinSession {
  const dom: SkinDom = deps.dom ?? document;
  let tornDown = false;
  const disposers: Array<() => void> = [];

  skinCtx.logger.info("aurora: activating", { skin: SKIN_ID });

  // ---- 0. 激活标记（残留断言锚点；teardown 移除）
  dom.body.setAttribute(ACTIVE_BODY_ATTR, "");

  // ---- 1. 主题：注册自有主题 + 叠 token 覆盖层（见 theme.ts 头注的双通道说明——
  // 观感由覆盖层承载；偏好轴（setTheme）对自定义主题 id 是会话级且会被宿主
  // adopt() 回拉，本皮肤**不写偏好轴**，激活/退出都不动用户的主题偏好）
  let disposeTheme: (() => void) | undefined;
  let disposeOverride: (() => void) | undefined;
  try {
    disposeTheme = ctx.theme.register(AURORA_THEME);
    disposeOverride = ctx.theme.overrideTokens(AURORA_OVERRIDE_SOURCE, AURORA_TOKEN_OVERRIDES);
  } catch (error) {
    // 激活失败：撤掉已提交的注册再抛，不留半套皮肤（公约 §4.4）
    disposeTheme?.();
    dom.body.removeAttribute(ACTIVE_BODY_ATTR);
    throw error;
  }
  disposers.push(disposeTheme);
  disposers.push(disposeOverride);

  // ---- 2. 自有 style 节点（背景 + 氛围层 + 设置分区样式）
  const styleNode = dom.createElement("style");
  styleNode.setAttribute(STYLE_ATTR, "");
  const form = ctx.configForms.get(SETTINGS_NAMESPACE);
  styleNode.textContent = buildAuroraCss(form.getSnapshot().value);
  dom.head.appendChild(styleNode);
  disposers.push(() => styleNode.remove());

  // ---- 3. 设置订阅：用户改背景 URL → 立即重算样式（观感即时变化）
  const offSettingsSubscription = form.subscribe(() => {
    if (tornDown) return;
    styleNode.textContent = buildAuroraCss(form.getSnapshot().value);
    skinCtx.logger.debug("aurora: background updated from skin settings", {
      background: describeBackground(form.getSnapshot().value),
    });
  });
  disposers.push(offSettingsSubscription);

  // ---- 4. locale 字典（分区文案；thunk label 在读取时求值、跟随 locale）
  const disposeLocale = ctx.locale.register(AURORA_LOCALE_NS, AURORA_LOCALE_DICTS);
  const t = ctx.locale.bind(AURORA_LOCALE_NS);
  disposers.push(disposeLocale);

  // ---- 5. 槽位席位（经皮肤自身 ctx.slots——disposer 归皮肤 fiber，公约 R8）
  const disposeSettingsSeat = ctx.slots.inject("settings.section", () =>
    ctx.slots.register(
      { name: "settings.section", id: SETTINGS_SEAT_ID, order: SETTINGS_SECTION_ORDER, label: () => t("nav.label") },
      deps.createSettingsSection({ form, t }),
    ),
  );
  disposers.push(disposeSettingsSeat);

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
        // 单项撤销失败不阻断其余撤销（尽力退净），但如实留痕
        skinCtx.logger.warn("aurora: teardown step failed", { error: String(error) });
      }
    }
    dom.body.removeAttribute(ACTIVE_BODY_ATTR);
    skinCtx.logger.info("aurora: deactivated — all side effects unwound");
  }

  return { teardown };
}

/**
 * activate/deactivate 句柄（client apply 交给 registerSkin 的那对回调）。
 * - 同一时刻至多一个会话（防御：重复 activate 先拆旧会话）；
 * - fiber-dispose 安全网只注册一次（R8：fiber 意外死亡时兜底拆会话）。
 */
export function createAuroraActivation(ctx: SkinClientContext, deps: AuroraSessionDeps) {
  let activeSession: SkinSession | null = null;
  let safetyNetRegistered = false;

  return {
    activate(skinCtx: SkinActivationContext): void {
      if (activeSession !== null) activeSession.teardown();
      activeSession = activateAuroraSession(ctx, skinCtx, deps);
      if (!safetyNetRegistered) {
        safetyNetRegistered = true;
        ctx.effect(() => () => activeSession?.teardown(), "skn-aurora: session safety net (fiber dispose, R8)");
      }
    },
    deactivate(): void {
      activeSession?.teardown();
      activeSession = null;
    },
  };
}

/** 供日志/诊断：当前设置的背景 URL（空串 = 内置渐变）。 */
export function describeBackground(settingsValue: unknown): string {
  const url = readBackgroundUrl(settingsValue);
  return url === "" ? "(built-in gradient)" : url;
}

/** re-export 便利面（client/index.tsx 与测试从这里一次性取齐）。 */
export { SKIN_META, SKIN_ID, SETTINGS_NAMESPACE };
