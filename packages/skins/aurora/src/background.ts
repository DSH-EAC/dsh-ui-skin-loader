/**
 * 极光之夜的 CSS 组装（纯逻辑，node --test 直测）。
 *
 * 命名空间纪律（公约 R2/R3/R5）：
 * - 所有选择器都带自有前缀 `skn-aurora`（data 属性或类名），不引用宿主任何
 *   class（CSS-module hash 是上游私有物，不是 ABI）；
 * - 整个样式表经**自有 style 节点**注入（`data-skn-aurora-style` 标记），
 *   deactivate 移除节点即整体撤销；
 * - body 上的激活标记属性同样是自有命名空间，供残留断言与调试。
 *
 * 背景机制：body 背景由本皮肤绘制（默认极光渐变 / 用户自定义图片 + 暗色遮罩），
 * 宿主表面经主题 token 覆盖成半透明（见 theme.ts）→ 玻璃拟态。
 */

import { CSS_PREFIX } from "./identity.ts";
import { readBackgroundUrl, validateBackgroundUrl } from "./settings.ts";

/** style 节点与 body 激活标记的属性名（残留断言用：退出后必须归零）。 */
export const STYLE_ATTR = `data-${CSS_PREFIX}-style`;
export const ACTIVE_BODY_ATTR = `data-${CSS_PREFIX}-active`;

/** 内置极光背景（用户未设置自定义图片时的默认观感）。 */
function builtinAuroraBackgroundCss(): string {
  return [
    "background-color:#0b1026",
    "background-image:"
      + "radial-gradient(1200px 700px at 18% -10%, rgba(79, 141, 255, 0.42), transparent 60%),"
      + "radial-gradient(1000px 620px at 85% 12%, rgba(160, 107, 255, 0.34), transparent 55%),"
      + "radial-gradient(1100px 700px at 55% 115%, rgba(57, 208, 164, 0.26), transparent 60%),"
      + "linear-gradient(180deg, #0b1026 0%, #121a3e 55%, #090d20 100%)",
    "background-attachment:fixed",
  ].join(";");
}

/** 自定义背景图：暗色遮罩打底（保证任何图上文字可读）+ cover 铺满。 */
function imageAuroraBackgroundCss(imageUrl: string): string {
  return [
    "background-color:#0b1026",
    "background-image:"
      + "linear-gradient(180deg, rgba(7, 11, 28, 0.78), rgba(7, 11, 28, 0.84)),"
      + `url("${escapeCssUrl(imageUrl)}")`,
    "background-size:auto,cover",
    "background-position:center",
    "background-repeat:no-repeat",
    "background-attachment:fixed",
  ].join(";");
}

/** CSS url("…") 字符串转义：反斜杠/双引号是仅有的两个可破坏字符串的字符。 */
function escapeCssUrl(url: string): string {
  return url.replace(/[\\"]/g, "\\$&");
}

/** 极光装饰层（shell.overlay 席位）的根样式。 */
function backdropCss(): string {
  return [
    `[data-${CSS_PREFIX}-backdrop]{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:0;opacity:.55}`,
    `[data-${CSS_PREFIX}-backdrop] svg{width:100%;height:100%;display:block}`,
    // 双保险：宿主 overlay 层给直接子元素 pointer-events:auto，这里以更高特异性的
    // body 前缀压回 none——选择器只引用自己的 data 属性，不碰宿主 class（R5）。
    `body [data-${CSS_PREFIX}-backdrop]{pointer-events:none}`,
  ].join("");
}

/** 「极光之夜」设置分区的玻璃面板样式（分区只在皮肤激活时存在，随激活配色走深色）。 */
function settingsSectionCss(): string {
  return [
    `[data-${CSS_PREFIX}-settings]{display:flex;flex-direction:column;gap:12px;max-width:560px;padding:18px;`
      + "border:1px solid rgba(148,176,255,.22);border-radius:14px;color:#e8ecff;"
      + "background:linear-gradient(160deg, rgba(24,32,66,.72), rgba(14,20,44,.6));"
      + "backdrop-filter:blur(18px) saturate(1.25);-webkit-backdrop-filter:blur(18px) saturate(1.25);"
      + "box-shadow:0 10px 36px rgba(3,6,18,.4)}",
    `[data-${CSS_PREFIX}-settings] h3{margin:0;font-size:15px;font-weight:600;letter-spacing:.02em}`,
    `[data-${CSS_PREFIX}-settings] p{margin:0;font-size:12px;line-height:1.6;color:#a8b6e6}`,
    `[data-${CSS_PREFIX}-settings] .${CSS_PREFIX}-row{display:flex;gap:8px}`,
    `[data-${CSS_PREFIX}-settings] input{flex:1;min-width:0;padding:7px 10px;border-radius:8px;font-size:13px;`
      + "color:#e8ecff;background:rgba(8,12,30,.6);border:1px solid rgba(148,176,255,.28);outline:none}",
    `[data-${CSS_PREFIX}-settings] input:focus{border-color:rgba(111,155,255,.75)}`,
    `[data-${CSS_PREFIX}-settings] input:disabled{opacity:.5}`,
    `[data-${CSS_PREFIX}-settings] button{padding:7px 14px;border-radius:8px;font-size:13px;cursor:pointer;`
      + "border:1px solid rgba(148,176,255,.35);color:#e8ecff;background:rgba(35,46,92,.55)}",
    `[data-${CSS_PREFIX}-settings] button:hover:not(:disabled){background:rgba(52,66,126,.7)}`,
    `[data-${CSS_PREFIX}-settings] button:disabled{opacity:.45;cursor:default}`,
    `[data-${CSS_PREFIX}-settings] .${CSS_PREFIX}-status{font-size:12px;color:#8fe3c0;min-height:1em}`,
    `[data-${CSS_PREFIX}-settings] .${CSS_PREFIX}-error{font-size:12px;color:#ff9db1;min-height:1em;white-space:pre-wrap}`,
  ].join("");
}

/**
 * 组装皮肤的全部 CSS（activate 时写入自有 style 节点；设置变更时整体重算重写）。
 *
 * @param settingsValue 设置快照的 value（unknown——内部经 readBackgroundUrl 安全读取）
 * @returns 完整样式表文本（确定性：同输入恒同输出，单测锁定）
 */
export function buildAuroraCss(settingsValue: unknown): string {
  const imageUrl = readBackgroundUrl(settingsValue);
  const background = imageUrl === ""
    ? builtinAuroraBackgroundCss()
    : imageAuroraBackgroundCss(imageUrl);
  return [
    `/* @dsh-eac/skin-aurora — injected by activate, removed by deactivate (公约 R8) */`,
    `body[${ACTIVE_BODY_ATTR}]{${background}}`,
    backdropCss(),
    settingsSectionCss(),
  ].join("\n");
}

/**
 * 「写入 CSS 前」的最终防线：validateBackgroundUrl 已在设置入口把关，
 * 这里对将要进入 url() 的值再做一次同样的校验（纵深防御；校验不过 = 回退内置渐变）。
 */
export function safeBackgroundUrl(input: string): string {
  const validated = validateBackgroundUrl(input);
  return validated.ok ? validated.value : "";
}

/** 供测试与调试：判断某个未知设置值最终会走内置渐变（true）还是自定义图片（false）。 */
export function usesBuiltinGradient(settingsValue: unknown): boolean {
  return readBackgroundUrl(settingsValue) === "";
}
