/**
 * 皮肤卡片封面解析（T2.5）。
 *
 * 公约 §3：preview 是「内联 SVG 或相对路径」。控制台策略（brief §1）：
 * - 皮肤 preview 有值且形如内联 SVG（`<svg` 开头）→ 原样使用（皮肤自治，加载器不解释）；
 * - 其余情形（无 preview / 相对路径）→ 用皮肤 id 确定性生成的内联 SVG 渐变封面
 *   （无大图资产；同 id 恒同图，纯函数可单测）。
 *
 * 渲染经 React dangerouslySetInnerHTML 限定在固定尺寸、overflow hidden 的封面容器内。
 * 安全面与公约一致：皮肤代码本身就是在宿主页面执行的脚本（activate），预览注入不构成
 * 额外越权面；加载器不对其内容做任何处理（如实呈现皮肤自治产物）。
 */

import type { SkinInfo } from "../../protocol.ts";

/** FNV-1a 32 位散列——封面色相的确定性来源。 */
function hash32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** 由 id 推导一对确定性 HSL 色相（相距 40°-80° 的邻近色，观感稳定且不刺眼）。 */
export function gradientHues(id: string): { from: number; to: number } {
  const hash = hash32(id);
  const from = hash % 360;
  const span = 40 + ((hash >>> 9) % 41); // 40..80
  const to = (from + span) % 360;
  return { from, to };
}

/** 生成的封面 SVG：对角线性渐变 + 一枚居中的首字母徽标。 */
export function generatedPreviewSvg(id: string, name: string): string {
  const { from, to } = gradientHues(id);
  const initial = (name.trim()[0] ?? id.trim()[0] ?? "?").toUpperCase();
  const gid = `usl-g-${hash32(id).toString(36)}`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" role="img" aria-label="${escapeAttr(name)}">` +
    `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${from} 62% 58%)"/>` +
    `<stop offset="1" stop-color="hsl(${to} 58% 38%)"/>` +
    `</linearGradient></defs>` +
    `<rect width="320" height="180" fill="url(#${gid})"/>` +
    `<circle cx="160" cy="90" r="34" fill="rgba(255,255,255,.22)"/>` +
    `<text x="160" y="90" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="sans-serif" font-size="30" font-weight="600" fill="rgba(255,255,255,.95)">${escapeText(initial)}</text>` +
    `</svg>`
  );
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 判定 preview 是否是可直接内联的 SVG（公约 §3 的首选形态）。 */
export function isInlineSvg(preview: string | undefined): preview is string {
  return typeof preview === "string" && /^<svg[\s>]/i.test(preview.trimStart());
}

/**
 * 卡片封面 SVG 解析：皮肤声明的内联 SVG 优先，否则按 id 确定性生成（brief §1 定案）。
 */
export function resolvePreviewSvg(skin: Pick<SkinInfo, "id" | "name" | "preview">): string {
  if (isInlineSvg(skin.preview)) {
    return skin.preview;
  }
  return generatedPreviewSvg(skin.id, skin.name);
}
