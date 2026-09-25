/**
 * 鲸吟的卡片封面 SVG（内联预览图）。
 *
 * 简洁 SVG：冰蓝天光 + 海面 + 鲸影两抹 + 金色星点（取原皮肤色板：#eaf2fa 天、
 * #2a4a74 海、#4d8fd4 辉、#d8b45a 金线——不内嵌任何位图资产）。渐变 id 一律
 * 带 `skn-whale-song-` 前缀（T2.5 教训：SVG gradient id 是文档级作用域，
 * 多张卡同页渲染时同名 id 会互相覆盖）。输出确定性字符串，与 package.json
 * `dsh.skin.preview` 保持同一份内容（同步说明见包 README）。
 */

import { CSS_PREFIX, SKIN_META } from "./identity.ts";

/** 封面 SVG：天光 + 海面 + 鲸影 + 金点（单行字符串，package.json 同文）。 */
export const WHALE_SONG_PREVIEW_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" role="img" aria-label="${SKIN_META.name}">`
  + `<defs>`
  + `<linearGradient id="${CSS_PREFIX}-preview-bg" x1="0" y1="0" x2="0" y2="1">`
  + `<stop offset="0" stop-color="#eaf2fa"/><stop offset="1" stop-color="#c9dcee"/>`
  + `</linearGradient>`
  + `<linearGradient id="${CSS_PREFIX}-preview-sea" x1="0" y1="0" x2="0" y2="1">`
  + `<stop offset="0" stop-color="#8fb8dd"/><stop offset="1" stop-color="#2a4a74"/>`
  + `</linearGradient>`
  + `<radialGradient id="${CSS_PREFIX}-preview-glow" cx=".28" cy=".4" r=".55">`
  + `<stop offset="0" stop-color="#4d8fd4" stop-opacity=".5"/><stop offset="1" stop-color="#4d8fd4" stop-opacity="0"/>`
  + `</radialGradient>`
  + `</defs>`
  + `<rect width="320" height="180" fill="url(#${CSS_PREFIX}-preview-bg)"/>`
  + `<ellipse cx="92" cy="70" rx="150" ry="80" fill="url(#${CSS_PREFIX}-preview-glow)"/>`
  + `<path d="M-10 128 C 50 108, 110 122, 170 110 S 280 108, 330 96 L 330 180 L -10 180 Z" fill="url(#${CSS_PREFIX}-preview-sea)" opacity=".8"/>`
  + `<path d="M28 118 C 68 96, 118 100, 158 88" fill="none" stroke="#2a4a74" stroke-width="10" stroke-linecap="round" opacity=".55"/>`
  + `<path d="M196 92 C 214 78, 238 76, 252 62" fill="none" stroke="#4d8fd4" stroke-width="7" stroke-linecap="round" opacity=".6"/>`
  + `<circle cx="60" cy="46" r="1.6" fill="#d8b45a"/>`
  + `<circle cx="120" cy="30" r="1.2" fill="#d8b45a"/>`
  + `<circle cx="236" cy="38" r="1.4" fill="#d8b45a"/>`
  + `<text x="160" y="164" text-anchor="middle" font-family="sans-serif" font-size="11" letter-spacing=".3em" fill="#2a4a74">WHALE SONG</text>`
  + `</svg>`;
