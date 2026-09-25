/**
 * 交易终端的卡片封面 SVG（内联预览图）。
 *
 * 简洁 SVG：交易终端深色底 + 红涨绿跌跑马灯意象（取原皮肤色板：#f23645 红、
 * #089981 绿、#10151d 深底——不内嵌任何位图资产）。渐变 id 一律带
 * `skn-trading-` 前缀（T2.5 教训：SVG gradient id 是文档级作用域，多张卡同页
 * 渲染时同名 id 会互相覆盖）。输出确定性字符串，与 package.json
 * `dsh.skin.preview` 保持同一份内容（同步说明见包 README）。
 */

import { CSS_PREFIX, SKIN_META } from "./identity.ts";

/** 封面 SVG：终端深底 + 跑马灯条 + 行情行（单行字符串，package.json 同文）。 */
export const TRADING_PREVIEW_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" role="img" aria-label="${SKIN_META.name}">`
  + `<defs>`
  + `<linearGradient id="${CSS_PREFIX}-preview-bg" x1="0" y1="0" x2="0" y2="1">`
  + `<stop offset="0" stop-color="#10151d"/><stop offset="1" stop-color="#1a222e"/>`
  + `</linearGradient>`
  + `<linearGradient id="${CSS_PREFIX}-preview-tape" x1="0" y1="0" x2="1" y2="0">`
  + `<stop offset="0" stop-color="#f23645"/><stop offset=".5" stop-color="#7c8897"/><stop offset="1" stop-color="#089981"/>`
  + `</linearGradient>`
  + `</defs>`
  + `<rect width="320" height="180" fill="url(#${CSS_PREFIX}-preview-bg)"/>`
  + `<rect x="0" y="26" width="320" height="22" fill="#151b25"/>`
  + `<rect x="14" y="33" width="292" height="8" rx="4" fill="url(#${CSS_PREFIX}-preview-tape)" opacity=".8"/>`
  + `<rect x="14" y="62" width="130" height="10" rx="3" fill="#dbe2ec" opacity=".85"/>`
  + `<rect x="14" y="80" width="88" height="7" rx="3" fill="#48566c"/>`
  + `<rect x="14" y="104" width="292" height="1" fill="#242e3d"/>`
  + `<rect x="14" y="112" width="292" height="1" fill="#242e3d"/>`
  + `<rect x="14" y="120" width="292" height="1" fill="#242e3d"/>`
  + `<text x="252" y="86" font-family="monospace" font-size="13" font-weight="600" fill="#f23645">+2.41%</text>`
  + `<text x="252" y="102" font-family="monospace" font-size="13" font-weight="600" fill="#089981">-1.08%</text>`
  + `<rect x="0" y="158" width="320" height="22" fill="#0e131b"/>`
  + `<text x="160" y="173" text-anchor="middle" font-family="monospace" font-size="10" letter-spacing=".2em" fill="#7c8897">TRADING TERMINAL</text>`
  + `</svg>`;
