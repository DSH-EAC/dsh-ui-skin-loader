/**
 * @dsh-eac/skin-aurora 的 client 半 bundle 入口。
 *
 * DSH client bundle 契约（api-notes §1.4/§4 R10 定案）：顶层导出
 * - `inject`：cordis 服务名数组——vendored Loader 等这些服务就绪才调 apply；
 * - `apply(ctx)`：向加载器登记皮肤（registerSkin），并把反登记包进 ctx.effect。
 *
 * `window.__ModuleLoader__.load({ id, factory })` 外壳由打包脚本
 * （scripts/build-artifact.mjs）以 banner/footer 形态包在本模块产物外——
 * 源码不触碰上游私有全局（与加载器包 T2.5 起的同一纪律）。
 *
 * R1 纪律：apply 只做「登记皮肤」这一件事（公约 §5：未激活零副作用，
 * 唯一允许的行为是向加载器登记自身元数据）。activate/deactivate 的全部
 * 实现在 session.ts；React 组件在 components.tsx。
 */

import type { SkinClientContext } from "../context.ts";
import { SKIN_META } from "../identity.ts";
import { AURORA_PREVIEW_SVG } from "../preview.ts";
import { AURORA_SETTINGS_HINT } from "./messages.ts";
import { AuroraBackdrop, AuroraSettingsSection } from "./components.tsx";
import { createAuroraActivation } from "./session.ts";

/**
 * cordis 服务注入：
 * - `uiSkinLoader`：皮肤登记服务（加载器提供，公约唯一接缝）；
 * - `theme`：注册/切换自有主题（api-notes §7）；
 * - `slots`：设置分区与氛围层的席位（api-notes §5）；
 * - `configForms`：皮肤设置命名空间的读写（api-notes §8.2）；
 * - `locale`：分区文案双语（api-notes §10）。
 */
export const inject: string[] = ["uiSkinLoader", "theme", "slots", "configForms", "locale"];

/** client apply（Loader 材料化本 bundle 后以 entry fiber 调用）。 */
export function apply(ctx: SkinClientContext): void {
  const activation = createAuroraActivation(ctx, {
    createSettingsSection: (bindings) => () => (
      <AuroraSettingsSection form={bindings.form} t={bindings.t} />
    ),
    createBackdrop: () => AuroraBackdrop,
  });

  // 登记皮肤；登记 ≠ 激活——registerSkin 只入发现表（R1）。
  const unregister = ctx.uiSkinLoader.registerSkin({
    ...SKIN_META,
    preview: AURORA_PREVIEW_SVG,
    settingsHint: AURORA_SETTINGS_HINT,
    activate: (skinCtx) => activation.activate(skinCtx),
    deactivate: () => activation.deactivate(),
  });

  // 反登记随皮肤 fiber 卸载自动执行（宿主在插件管理器里停用本包时的正道，公约 §4.3-3）。
  ctx.effect(() => unregister, "skn-aurora: unregister on fiber dispose");
}
