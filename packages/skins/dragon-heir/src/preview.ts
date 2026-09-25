/**
 * 龙的传人的卡片封面 SVG（内联预览图）。
 *
 * 简洁 SVG：宣纸底 + 墨龙一抹 + 长城城沿线 + 朱砂龙印（取原皮肤色板：
 * #f4efe4 纸、#262319 墨、#c3272b 朱砂——不内嵌任何位图资产）。渐变 id 一律
 * 带 `skn-dragon-heir-` 前缀（T2.5 教训：SVG gradient id 是文档级作用域，
 * 多张卡同页渲染时同名 id 会互相覆盖）。输出确定性字符串，与 package.json
 * `dsh.skin.preview` 保持同一份内容（同步说明见包 README）。
 */

import { CSS_PREFIX, SKIN_META } from "./identity.ts";

/** 封面 SVG：纸底 + 墨龙 + 长城 + 龙印（单行字符串，package.json 同文）。 */
export const DRAGON_HEIR_PREVIEW_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" role="img" aria-label="${SKIN_META.name}">`
  + `<defs>`
  + `<linearGradient id="${CSS_PREFIX}-preview-bg" x1="0" y1="0" x2="0" y2="1">`
  + `<stop offset="0" stop-color="#f4efe4"/><stop offset="1" stop-color="#e5dcc8"/>`
  + `</linearGradient>`
  + `<linearGradient id="${CSS_PREFIX}-preview-wall" x1="0" y1="0" x2="0" y2="1">`
  + `<stop offset="0" stop-color="#ccc0a6"/><stop offset="1" stop-color="#a89c82"/>`
  + `</linearGradient>`
  + `</defs>`
  + `<rect width="320" height="180" fill="url(#${CSS_PREFIX}-preview-bg)"/>`
  + `<path d="M-8 150 C 60 108, 130 128, 190 96 S 300 92, 328 74 L 328 180 L -8 180 Z" fill="url(#${CSS_PREFIX}-preview-wall)" opacity=".75"/>`
  + `<path d="M-8 162 C 80 128, 170 150, 260 118 S 316 116, 328 110" fill="none" stroke="#544c3c" stroke-width="3" opacity=".5"/>`
  + `<path d="M30 60 C 80 30, 150 34, 210 52 S 290 50, 312 36" fill="none" stroke="#262319" stroke-width="7" stroke-linecap="round" opacity=".62"/>`
  + `<path d="M58 74 C 108 52, 168 58, 224 68" fill="none" stroke="#262319" stroke-width="3" stroke-linecap="round" opacity=".4"/>`
  + `<rect x="258" y="18" width="36" height="36" rx="5" fill="#c3272b"/>`
  + `<text x="276" y="44" text-anchor="middle" font-family="serif" font-size="22" font-weight="600" fill="#fdf8ee">龙</text>`
  + `<text x="160" y="164" text-anchor="middle" font-family="sans-serif" font-size="11" letter-spacing=".2em" fill="#544c3c">DRAGON HEIR</text>`
  + `</svg>`;
