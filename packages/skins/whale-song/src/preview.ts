/**
 * 鲸吟的卡片封面 SVG（内联预览图）。
 *
 * 简洁 SVG：纯抽象海景——冰蓝天光、钴蓝辉光、层叠海面带、金色星点
 * （取原皮肤色板：#eaf2fa 天、#8fb8dd 青、#2a4a74 海、#4d8fd4 辉、#d8b45a 金；
 * R13 裁定后不内嵌任何位图资产，也不含具象人物/角色/剪影元素）。
 * 渐变 id 一律带 `skn-whale-song-` 前缀（T2.5 教训：SVG gradient id 是文档级
 * 作用域，多张卡同页渲染时同名 id 会互相覆盖）。输出确定性字符串，与
 * package.json `dsh.skin.preview` 保持同一份内容（同步说明见包 README）。
 */

import { CSS_PREFIX, SKIN_META } from "./identity.ts";

/** 封面 SVG：抽象海景（天光 + 辉光 + 海面带 + 金点；单行字符串，package.json 同文）。 */
export const WHALE_SONG_PREVIEW_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" role="img" aria-label="${SKIN_META.name}">`
  + `<defs>`
  + `<linearGradient id="${CSS_PREFIX}-preview-bg" x1="0" y1="0" x2="0" y2="1">`
  + `<stop offset="0" stop-color="#eaf2fa"/><stop offset="1" stop-color="#c9dcee"/>`
  + `</linearGradient>`
  + `<linearGradient id="${CSS_PREFIX}-preview-sea" x1="0" y1="0" x2="0" y2="1">`
  + `<stop offset="0" stop-color="#8fb8dd"/><stop offset="1" stop-color="#2a4a74"/>`
  + `</linearGradient>`
  + `<radialGradient id="${CSS_PREFIX}-preview-glow" cx=".26" cy=".38" r=".55">`
  + `<stop offset="0" stop-color="#4d8fd4" stop-opacity=".5"/><stop offset="1" stop-color="#4d8fd4" stop-opacity="0"/>`
  + `</radialGradient>`
  + `</defs>`
  + `<rect width="320" height="180" fill="url(#${CSS_PREFIX}-preview-bg)"/>`
  + `<ellipse cx="86" cy="64" rx="160" ry="86" fill="url(#${CSS_PREFIX}-preview-glow)"/>`
  + `<path d="M-10 116 C 60 104, 130 112, 200 104 S 300 100, 330 94 L 330 180 L -10 180 Z" fill="url(#${CSS_PREFIX}-preview-sea)" opacity=".82"/>`
  + `<path d="M-10 138 C 70 128, 150 136, 230 126 S 310 122, 330 118 L 330 180 L -10 180 Z" fill="#2a4a74" opacity=".38"/>`
  + `<path d="M-10 158 C 80 150, 170 156, 260 148 L 330 144 L 330 180 L -10 180 Z" fill="#14284a" opacity=".5"/>`
  + `<circle cx="60" cy="40" r="1.6" fill="#d8b45a"/>`
  + `<circle cx="118" cy="26" r="1.2" fill="#d8b45a"/>`
  + `<circle cx="232" cy="34" r="1.4" fill="#d8b45a"/>`
  + `<circle cx="284" cy="22" r="1.1" fill="#d8b45a"/>`
  + `<text x="160" y="164" text-anchor="middle" font-family="sans-serif" font-size="11" letter-spacing=".3em" fill="#dbe7f2">WHALE SONG</text>`
  + `</svg>`;
