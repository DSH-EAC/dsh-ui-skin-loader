/**
 * 控制台主按钮前景色推导（对比度修复，T2.12-final）。
 *
 * 背景：控制台的核心观感变量消费宿主公开 token（`--usl-accent` =
 * `var(--dsw-alias-brand-primary, <原值>)`，styles.ts T2.6-fix 形态），皮肤覆盖
 * brand-primary 时主按钮（.usl-btn-primary）底色随之变化，而前景色原本按亮暗
 * 方案写死（light=#ffffff / dark=#0e1116）——对内置浅色 accent（亮色 fallback
 * #3f6ae0、暗色 fallback #6d92ec）成立，但对「亮色方案 + 浅色皮肤 accent」组合
 * 失效：aurora 把 brand-primary 覆盖为 #6f9bff（亮暗两值相同，玻璃色板钉死任意
 * 配色），白字对比度 ≈2.7:1（WCAG AA fail）。
 *
 * 修复策略：**按 accent 解析值的 WCAG 2.x 相对亮度推导前景色**——在白
 * （#ffffff）与墨（#0e1116，与暗色方案原固定值一致）两个候选中取对比度更高者。
 * 深色前景 on 浅色 accent、浅色前景 on 深色 accent，对任意皮肤的 accent 覆盖
 * 都取数学上最优解；两套 CSS 固定值退化为推导失败时的 fallback（无皮肤覆盖时
 * 推导结果与原固定值逐一相同，原生观感零变化）。
 *
 * 纯函数 + 零 DOM：解析/亮度/对比度在此处，DOM 读取与回写在 components.tsx
 * 的 useAccentFgRef（挂载时与 body 内联 token 变化时重算）。
 */

/** 白色前景（深色 accent 下对比度更优的原亮色方案固定值）。 */
export const ACCENT_FG_LIGHT = "#ffffff";

/** 墨色前景（浅色 accent 下对比度更优的原暗色方案固定值）。 */
export const ACCENT_FG_DARK = "#0e1116";

/**
 * 解析 CSS 颜色为 [r, g, b, a]（0-255 / 0-1）。支持 #rgb/#rgba/#rrggbb/#rrggbbaa
 * 与 rgb()/rgba()（逗号与空格两种参数形态，计算值两种都会出现）。不认识的值
 * （transparent、颜色函数、空串等）返回 null，调用方保留 CSS fallback。
 */
export function parseCssColor(value: string): [number, number, number, number] | null {
  const text = value.trim().toLowerCase();
  if (text.length === 0) {
    return null;
  }
  if (text.startsWith("#")) {
    const hex = text.slice(1);
    if (![3, 4, 6, 8].includes(hex.length) || /[^0-9a-f]/.test(hex)) {
      return null;
    }
    const step = hex.length <= 4 ? 1 : 2;
    const channel = (i: number): number => {
      const part = hex.slice(i * step, i * step + step);
      return Number.parseInt(step === 1 ? part + part : part, 16);
    };
    const alphaPart = hex.slice(3 * step);
    const alpha = alphaPart.length > 0 ? Number.parseInt(step === 1 ? alphaPart + alphaPart : alphaPart, 16) / 255 : 1;
    return [channel(0), channel(1), channel(2), alpha];
  }
  const functional = /^rgba?\(([^)]+)\)$/.exec(text);
  if (functional === null || functional[1] === undefined) {
    return null;
  }
  const parts = functional[1].replace(/\//g, " ").split(/[\s,]+/).filter((p) => p.length > 0);
  if (parts.length < 3 || parts.length > 4) {
    return null;
  }
  const channel = (i: number): number => Number.parseFloat(parts[i] ?? "");
  const alpha = parts.length === 4 ? Number.parseFloat(parts[3] ?? "") : 1;
  if (![channel(0), channel(1), channel(2), alpha].every(Number.isFinite)) {
    return null;
  }
  return [channel(0), channel(1), channel(2), alpha];
}

/** WCAG 2.x 相对亮度（E0.2126/0.7152/0.0722 系数，sRGB 线性化）。 */
export function relativeLuminance([r, g, b]: [number, number, number, number]): number {
  const linearize = (v: number): number => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** WCAG 2.x 对比度：(L亮 + 0.05) / (L暗 + 0.05)。 */
export function contrastRatio(a: [number, number, number, number], b: [number, number, number, number]): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE: [number, number, number, number] = [255, 255, 255, 1];
const INK: [number, number, number, number] = [14, 17, 22, 1];

/**
 * 由 accent 解析值推导主按钮前景色：白 / 墨两候选中取对比度更高者。
 * accent 带透明度时按通道值推导（合成底不可知，通道值是可用信息的最优近似；
 * 透明 accent 上两候选都不保证 4.5:1，取更优者仍优于写死）。
 * 解析失败返回 null——调用方移除内联覆盖，回落到 styles.ts 的方案默认值。
 */
export function deriveAccentFg(resolvedAccent: string): string | null {
  const accent = parseCssColor(resolvedAccent);
  if (accent === null) {
    return null;
  }
  return contrastRatio(accent, WHITE) >= contrastRatio(accent, INK) ? ACCENT_FG_LIGHT : ACCENT_FG_DARK;
}
