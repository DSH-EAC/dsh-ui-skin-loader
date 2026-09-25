/**
 * 水墨青烟的 CSS 组装（纯逻辑，node --test 直测）。
 *
 * 命名空间纪律与 aurora 一致（公约 R2/R3/R5）：全部选择器带自有前缀
 * `skn-inkwash`，不引用宿主任何 class；整表经自有 style 节点注入
 * （`data-skn-inkwash-style` 标记），deactivate 移除节点即整体撤销。
 *
 * 背景机制（无自定义设置——inkwash 证明「皮肤可以不提供设置」）：
 * body 背景由本皮肤绘制（宣纸底色 + 三片淡墨晕染，纯 CSS 渐变、零外部资产），
 * 宿主表面经主题 token 覆盖成半透明浅色（见 theme.ts）。
 */

import { CSS_PREFIX } from "./identity.ts";

/** style 节点与 body 激活标记的属性名（残留断言用：退出后必须归零）。 */
export const STYLE_ATTR = `data-${CSS_PREFIX}-style`;
export const ACTIVE_BODY_ATTR = `data-${CSS_PREFIX}-active`;

/** 宣纸底 + 淡墨晕染（纯 CSS 渐变；background-attachment 固定，滚动时墨色不动如印）。 */
function paperBackgroundCss(): string {
  return [
    "background-color:#f7f5ef",
    "background-image:"
      + "radial-gradient(900px 520px at 12% 6%, rgba(58, 69, 80, 0.10), transparent 62%),"
      + "radial-gradient(760px 460px at 88% 28%, rgba(58, 69, 80, 0.08), transparent 58%),"
      + "radial-gradient(1100px 640px at 42% 112%, rgba(58, 69, 80, 0.09), transparent 60%),"
      + "linear-gradient(180deg, #f8f6f0 0%, #f1eee4 100%)",
    "background-attachment:fixed",
  ].join(";");
}

/** 水墨氛围层（shell.overlay 席位）的根样式。 */
function backdropCss(): string {
  return [
    `[data-${CSS_PREFIX}-backdrop]{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:0;opacity:.5}`,
    `[data-${CSS_PREFIX}-backdrop] svg{width:100%;height:100%;display:block}`,
    // 与 aurora 同款双保险：只引用自有 data 属性，不碰宿主 class（R5）
    `body [data-${CSS_PREFIX}-backdrop]{pointer-events:none}`,
  ].join("");
}

/**
 * 组装皮肤的全部 CSS（activate 时写入自有 style 节点）。
 * inkwash 无设置，输入为空占位（与 aurora 的 buildAuroraCss 形态对称，便于对照）。
 *
 * @returns 完整样式表文本（确定性：恒同输出，单测锁定）
 */
export function buildInkwashCss(): string {
  return [
    `/* @dsh-eac/skin-inkwash — injected by activate, removed by deactivate (公约 R8) */`,
    `body[${ACTIVE_BODY_ATTR}]{${paperBackgroundCss()}}`,
    backdropCss(),
  ].join("\n");
}
