/**
 * 极光之夜的主题注册定义（api-notes §7 形态：{ id, colorScheme, tokens }）。
 *
 * tokens 是宿主主题 API 明文支持的 token 覆盖（键 = 完整 CSS 变量名，presenter 把
 * 它们写成 body 内联样式——api-notes §7 / dsh-client-ui-theme 的 BUILTIN_INSPECT_TOKENS
 * 与 ThemePresenter 实读核对）。这是**宿主公开的主题 ABI**，不是私有 DOM/类名（公约
 * R5 合规）。覆盖表以 `--dsw-alias-*` 别名层为主；`--dsw-specific-sidebar-nav-item-*`
 * 是宿主导航面消费的 specific 层变量（同样经 presenter 内联生效），皮肤按同一机制覆盖。
 *
 * 玻璃拟态的实现机制：把宿主各层表面 token 覆盖成**半透明**深色——宿主框架
 * （frame/侧栏/中央列）随即透出 body 背景（本皮肤经自有 style 节点绘制的极光
 * 渐变 / 用户自定义背景图），形成"玻璃后面有光"的观感。
 *
 * ⚠️ 覆盖面纪律（T2.6-fix 教训）：token 覆盖表必须"表面与前景成对覆盖"。只覆盖
 * 文字色不覆盖其所在表面（或反之），就会出现对比度反转——本皮肤初版漏了导航
 * 选中 pill 的表面 token，激活态下选中项文字不可见（实机截图定位后补齐）。
 *
 * 双通道策略（activate 同时提交，见 client/session.ts）：
 * 1. `theme.register`——把自有主题（id/colorScheme/tokens）注册进宿主主题注册表
 *    （公约/brief 指名的主题通道）。**刻意不调 setTheme**：实读上游
 *    THEME_PREFERENCES = ["light","dark","system"]，自定义主题 id 只是**会话级**
 *    偏好，宿主外观文档任何变更（包括加载器每次切换后的 activeSkin 落盘）都会
 *    触发 adopt() 把偏好拉回持久值——setTheme 的效果约 1-2 秒后被打回并造成
 *    明暗闪烁。皮肤**不写偏好轴**，激活/退出都不动用户的主题偏好；
 * 2. `theme.overrideTokens`——token 覆盖层与偏好**无关**（上游："token-level
 *    analogue of slot shading"，adopt 不触碰覆盖层），亮暗两值相同（本皮肤刻意
 *    把玻璃色板钉在任意配色之上）。这是观感的实际承载通道。
 * deactivate 两条通道各自 dispose，退出即净（公约 §4.3）。
 */

import { SKIN_ID, THEME_ID } from "./identity.ts";

/** 极光色板（别名层覆盖值；键为完整 CSS 变量名）。 */
export const AURORA_TOKEN_VALUES: Record<string, string> = {
  // 表面层：半透明是玻璃拟态的关键（透出 body 的极光背景）
  "--dsw-alias-bg-base": "rgba(11, 16, 38, 0.78)",
  "--dsw-alias-bg-layer-1": "rgba(19, 26, 54, 0.72)",
  "--dsw-alias-bg-layer-2": "rgba(27, 35, 70, 0.66)",
  "--dsw-alias-bg-overlay": "rgba(15, 21, 46, 0.88)",
  "--dsw-specific-sidebar-fill": "rgba(13, 19, 44, 0.62)",
  // 边界：冷色发丝线
  "--dsw-alias-border-l1": "rgba(148, 176, 255, 0.16)",
  "--dsw-alias-border-l2": "rgba(148, 176, 255, 0.24)",
  "--dsw-alias-border-l3": "rgba(148, 176, 255, 0.32)",
  // 文字与品牌
  "--dsw-alias-label-primary": "#e8ecff",
  "--dsw-alias-label-secondary": "#a8b6e6",
  "--dsw-alias-label-dimmed": "#7c8ac0",
  "--dsw-alias-brand-primary": "#6f9bff",
  // 导航选中/悬停 pill（T2.6-fix 补充；实机定位：设置面板与侧栏的导航项选中态用
  // --dsw-specific-sidebar-nav-item-active，基础色板里是近白实体色）——不覆盖会出现
  // "浅色 pill + 亮色文字"的对比度反转（修复前截图 14 的选中项文字不可见）。
  // 覆盖为半透明冷蓝后，label-primary 的亮色文字在 pill 上保持可读：
  "--dsw-specific-sidebar-nav-item-active": "rgba(111, 155, 255, 0.32)",
  "--dsw-specific-sidebar-nav-item-hover": "rgba(148, 176, 255, 0.14)",
  "--dsw-specific-sidebar-nav-item-active-accent": "rgba(79, 141, 255, 0.45)",
};

/** 主题注册定义（theme.register 的实参；activate 时提交，deactivate 时 dispose）。 */
export const AURORA_THEME = {
  id: THEME_ID,
  colorScheme: "dark",
  tokens: AURORA_TOKEN_VALUES,
} as const;

/**
 * token 覆盖层（theme.overrideTokens 的实参）：source 用皮肤 id（上游按 source
 * 记账一层，重复调用 = 替换该层），亮暗两值相同——玻璃色板刻意与配色无关。
 */
export const AURORA_OVERRIDE_SOURCE = SKIN_ID;
export const AURORA_TOKEN_OVERRIDES: Record<string, { light: string; dark: string }> =
  Object.fromEntries(
    Object.entries(AURORA_TOKEN_VALUES).map(([name, value]) => [name, { light: value, dark: value }]),
  );
