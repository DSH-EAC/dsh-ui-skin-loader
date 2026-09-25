/**
 * 水墨青烟的主题注册定义（api-notes §7 形态）。
 *
 * 与 aurora 对称的玻璃化手法，但方向相反：把宿主表面覆盖成**半透明浅色**，
 * 透出 body 上的宣纸底色与水墨晕染——"纸上有烟"的浅色纸质感。
 * token 名即 CSS 变量名（`--dsw-alias-*` 别名层是主题 API 的公开面，api-notes §7）。
 */

import { SKIN_ID, THEME_ID } from "./identity.ts";

/** 水墨青烟的别名 token 覆盖（单值表；基底配色由 colorScheme: "light" 声明）。 */
export const INKWASH_THEME_TOKENS: Record<string, string> = {
  // 表面层：宣纸白，半透明透出底纹
  "--dsw-alias-bg-base": "rgba(250, 248, 242, 0.86)",
  "--dsw-alias-bg-layer-1": "rgba(252, 250, 245, 0.9)",
  "--dsw-alias-bg-layer-2": "rgba(246, 243, 234, 0.92)",
  "--dsw-alias-bg-overlay": "rgba(253, 252, 248, 0.96)",
  "--dsw-specific-sidebar-fill": "rgba(243, 240, 231, 0.85)",
  // 边界：淡墨线
  "--dsw-alias-border-l1": "rgba(90, 100, 110, 0.14)",
  "--dsw-alias-border-l2": "rgba(90, 100, 110, 0.2)",
  "--dsw-alias-border-l3": "rgba(90, 100, 110, 0.28)",
  // 文字与品牌：墨色 + 黛青
  "--dsw-alias-label-primary": "#2f3a44",
  "--dsw-alias-label-secondary": "#5a6672",
  "--dsw-alias-label-dimmed": "#8a939c",
  "--dsw-alias-brand-primary": "#3a6ea5",
};

/** 主题注册定义（activate 时提交，deactivate 时 dispose 并恢复用户原偏好）。 */
export const INKWASH_THEME = {
  id: THEME_ID,
  colorScheme: "light",
  tokens: INKWASH_THEME_TOKENS,
} as const;

/**
 * token 覆盖层（theme.overrideTokens 的实参）：观感的实际承载通道——与偏好
 * 无关（宿主 adopt() 不触碰覆盖层；机制说明见 aurora 包 theme.ts 头注）。
 * 亮暗两值相同——纸色板刻意与配色无关。
 */
export const INKWASH_OVERRIDE_SOURCE = SKIN_ID;
export const INKWASH_TOKEN_OVERRIDES: Record<string, { light: string; dark: string }> =
  Object.fromEntries(
    Object.entries(INKWASH_THEME_TOKENS).map(([name, value]) => [name, { light: value, dark: value }]),
  );
