/**
 * 水墨青烟的卡片封面 SVG（内联预览图）。
 *
 * 渐变 id 一律带 `skn-inkwash-` 前缀（T2.5 教训：SVG gradient id 是文档级作用域，
 * 多张卡同页渲染时同名 id 会互相覆盖）。输出确定性字符串，与 package.json
 * `dsh.skin.preview` 保持同一份内容（同步说明见包 README）。
 */

import { CSS_PREFIX, SKIN_META } from "./identity.ts";

/** 封面 SVG：宣纸底 + 淡墨山影 + 远烟 + 标题（单行字符串，package.json 同文）。 */
export const INKWASH_PREVIEW_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" role="img" aria-label="${SKIN_META.name}">`
  + `<defs>`
  + `<linearGradient id="${CSS_PREFIX}-preview-bg" x1="0" y1="0" x2="0" y2="1">`
  + `<stop offset="0" stop-color="#f7f5ef"/><stop offset="1" stop-color="#eceade"/>`
  + `</linearGradient>`
  + `<radialGradient id="${CSS_PREFIX}-preview-mist" cx=".35" cy=".42" r=".65">`
  + `<stop offset="0" stop-color="#3a4550" stop-opacity=".38"/><stop offset="1" stop-color="#3a4550" stop-opacity="0"/>`
  + `</radialGradient>`
  + `</defs>`
  + `<rect width="320" height="180" fill="url(#${CSS_PREFIX}-preview-bg)"/>`
  + `<ellipse cx="112" cy="76" rx="128" ry="72" fill="url(#${CSS_PREFIX}-preview-mist)"/>`
  + `<path d="M28 132 C 74 108, 118 126, 158 112 S 246 122, 292 106" fill="none" stroke="#4a5560" stroke-width="3.5" opacity=".55" stroke-linecap="round"/>`
  + `<path d="M52 148 C 108 136, 170 150, 268 132" fill="none" stroke="#4a5560" stroke-width="1.6" opacity=".32" stroke-linecap="round"/>`
  + `<text x="160" y="46" text-anchor="middle" font-family="serif" font-size="22" font-weight="600" fill="#2f3a44">${SKIN_META.name}</text>`
  + `<text x="160" y="168" text-anchor="middle" font-family="sans-serif" font-size="11" letter-spacing=".2em" fill="#7a8288">INKWASH MIST</text>`
  + `</svg>`;
