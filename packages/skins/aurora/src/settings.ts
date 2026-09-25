/**
 * 极光之夜的自定义设置：背景图 URL（皮肤设置自治，公约 §4.2——设置不是公约事件，
 * 加载器不代管，皮肤自己经宿主 configForms 机制持久化在自己的命名空间里）。
 *
 * 纯逻辑模块（node --test 直测）：默认值、归一化与 URL 校验。
 * 校验原则：只接受 http/https 绝对地址（含 localhost——实机验证即用它）；
 * 空值 = 回到内置渐变。`javascript:` 等危险 scheme 一律拒绝（背景图 URL 会被
 * 写进 CSS `url()`， scheme 白名单是最便宜的一道闸）。
 */

/** 设置字段名（host 半 Config schema 与 client 写入共用）。 */
export const BACKGROUND_URL_FIELD = "backgroundUrl";

/** 背景设置的默认值：空 = 内置极光渐变（buildAuroraBackgroundCss 的默认分支）。 */
export const BACKGROUND_URL_DEFAULT = "";

export type BackgroundUrlValidation =
  | { ok: true; value: string }
  | { ok: false; reason: "not-url" | "unsupported-scheme" };

/**
 * 归一化 + 校验用户输入的背景图 URL。
 *
 * - 空串 / 纯空白 → ok（值为 ""，语义 = 用回内置渐变）；
 * - 必须能被 `new URL` 解析为绝对地址（相对路径、纯文本 → not-url）；
 * - 协议必须是 http/https（大小写不敏感；其余一律 unsupported-scheme）。
 */
export function validateBackgroundUrl(input: string): BackgroundUrlValidation {
  const value = input.trim();
  if (value === "") return { ok: true, value: BACKGROUND_URL_DEFAULT };
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, reason: "not-url" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "unsupported-scheme" };
  }
  return { ok: true, value: parsed.href };
}

/**
 * 从设置快照的 value 里安全读出背景 URL（快照 value 是 unknown——设置段落可能
 * 缺字段或还没 ready）。任何非字符串都回落到默认值。
 */
export function readBackgroundUrl(value: unknown): string {
  if (typeof value !== "object" || value === null) return BACKGROUND_URL_DEFAULT;
  const raw = (value as { backgroundUrl?: unknown }).backgroundUrl;
  if (typeof raw !== "string") return BACKGROUND_URL_DEFAULT;
  const validated = validateBackgroundUrl(raw);
  return validated.ok ? validated.value : BACKGROUND_URL_DEFAULT;
}
