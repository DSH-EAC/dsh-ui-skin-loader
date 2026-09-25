/**
 * 极光之夜的双语文案（client 半设置分区 + settingsHint）。
 *
 * 命名空间带皮肤自有前缀（公约 R2：不与加载器的 `dsh-ui-skin-loader/console`
 * 或其它皮肤撞名）；zh/en 双语齐备（api-notes §10：typed 双语强制，缺键回退 en）。
 */

import type { Translate } from "../context.ts";
import { SKIN_META } from "../identity.ts";

/** locale 字典命名空间（自有前缀）。 */
export const AURORA_LOCALE_NS = "dsh-eac-skin-aurora/console";

/** settingsHint：展示在加载器控制台卡片上的「皮肤设置」入口线索（纯文本，加载器不导航不解释）。 */
export const AURORA_SETTINGS_HINT =
  "激活后在 设置 → 极光之夜 自定义背景图（Settings → Aurora Night, after activation）";

/** zh/en 双语字典（settings.section 的分区 UI 用；分区只在激活后注册）。 */
export const AURORA_LOCALE_DICTS = {
  en: {
    "nav.label": SKIN_META.name,
    "settings.title": "Aurora Night · Background",
    "settings.desc":
      "Choose the background behind the glass surfaces. Leave empty for the built-in aurora gradient. The setting is owned by this skin and survives deactivation.",
    "settings.label": "Background image URL (http/https)",
    "settings.placeholder": "https://example.com/aurora.jpg",
    "settings.apply": "Apply",
    "settings.reset": "Use built-in gradient",
    "settings.applied": "Applied.",
    "settings.write-refused": "The host refused the write — try again.",
    "settings.unavailable": "Settings channel unavailable (status: {status}).",
    "settings.readonly": "Read-only in this mode.",
    "settings.error.not-url": "Not a valid absolute URL.",
    "settings.error.unsupported-scheme": "Only http/https URLs are supported.",
    "settings.error.empty-input": "Type a URL, or use “Use built-in gradient”.",
  },
  zh: {
    "nav.label": SKIN_META.name,
    "settings.title": "极光之夜 · 背景",
    "settings.desc":
      "选择玻璃表面之后的背景图。留空即用内置极光渐变。该设置由皮肤自治持久化，停用皮肤不会丢失。",
    "settings.label": "背景图 URL（http/https）",
    "settings.placeholder": "https://example.com/aurora.jpg",
    "settings.apply": "应用",
    "settings.reset": "用回内置渐变",
    "settings.applied": "已应用。",
    "settings.write-refused": "宿主拒绝了这次写入，请重试。",
    "settings.unavailable": "设置通道不可用（状态：{status}）。",
    "settings.readonly": "当前模式只读。",
    "settings.error.not-url": "不是合法的绝对 URL。",
    "settings.error.unsupported-scheme": "只支持 http/https 地址。",
    "settings.error.empty-input": "请输入 URL，或点击「用回内置渐变」。",
  },
} as const;

/** 绑定好的翻译函数形态（session 在 activate 时 register + bind 后传入组件）。 */
export type AuroraTranslate = Translate;
