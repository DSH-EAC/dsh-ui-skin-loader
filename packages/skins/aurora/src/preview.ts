/**
 * 极光之夜的卡片封面 SVG（内联预览图）。
 *
 * T2.5 实机教训：多张皮肤卡同页渲染时，SVG 的 gradient id 是**文档级作用域**——
 * 两张卡用同名 id 会互相覆盖。因此本皮肤的预览 SVG 一律使用 `skn-aurora-` 前缀 id
 * （CSS_PREFIX 命名空间化），这也是给外部开发者的示范。
 *
 * 纯逻辑模块：输出确定性字符串（node --test 锁定），与 package.json `dsh.skin.preview`
 * 保持同一份内容（同步说明见包 README）。
 */

import { CSS_PREFIX, SKIN_META } from "./identity.ts";

/**
 * 封面 SVG：深色夜空 + 三道极光飘带 + 标题。单行字符串（package.json JSON 内
 * 只能是一行；这里保持同一份文本，避免两处漂移）。
 */
export const AURORA_PREVIEW_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" role="img" aria-label="${SKIN_META.name}">`
  + `<defs>`
  + `<linearGradient id="${CSS_PREFIX}-preview-bg" x1="0" y1="0" x2="0" y2="1">`
  + `<stop offset="0" stop-color="#0b1026"/><stop offset="1" stop-color="#1b2148"/>`
  + `</linearGradient>`
  + `<linearGradient id="${CSS_PREFIX}-preview-ribbon" x1="0" y1="0" x2="1" y2="0">`
  + `<stop offset="0" stop-color="#39d0a4"/><stop offset=".5" stop-color="#4f8dff"/><stop offset="1" stop-color="#a06bff"/>`
  + `</linearGradient>`
  + `</defs>`
  + `<rect width="320" height="180" fill="url(#${CSS_PREFIX}-preview-bg)"/>`
  + `<path d="M-20 118 C 60 58, 120 150, 200 80 S 320 58, 340 88" fill="none" stroke="url(#${CSS_PREFIX}-preview-ribbon)" stroke-width="26" stroke-linecap="round" opacity=".55"/>`
  + `<path d="M-20 142 C 80 92, 150 172, 240 102 S 330 92, 340 112" fill="none" stroke="url(#${CSS_PREFIX}-preview-ribbon)" stroke-width="13" stroke-linecap="round" opacity=".33"/>`
  + `<text x="160" y="42" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="600" fill="#e8ecff">${SKIN_META.name}</text>`
  + `<text x="160" y="166" text-anchor="middle" font-family="sans-serif" font-size="11" letter-spacing=".2em" fill="#9fb0e8">AURORA NIGHT</text>`
  + `</svg>`;
