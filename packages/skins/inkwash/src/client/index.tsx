/**
 * @dsh-eac/skin-inkwash 的 client 半 bundle 入口。
 *
 * 契约与纪律同 aurora 包（api-notes §1.4/§4；R1：apply 只登记皮肤）；
 * `window.__ModuleLoader__.load` 外壳由 scripts/build-artifact.mjs 以
 * banner/footer 产出，源码不触碰上游私有全局。
 *
 * 与 aurora 的差异：inject 不含 configForms/locale（不提供设置与设置 UI）；
 * 登记体没有 settingsHint（可选字段，合法省略——加载器对无 hint 的皮肤
 * 不展示「皮肤设置」入口，也不做任何区别对待）。
 */

import type { SkinClientContext } from "../context.ts";
import { SKIN_META } from "../identity.ts";
import { INKWASH_PREVIEW_SVG } from "../preview.ts";
import { InkwashBackdrop } from "./components.tsx";
import { createInkwashActivation } from "./session.ts";

/** cordis 服务注入：uiSkinLoader（登记）+ theme（主题）+ slots（氛围层席位）。 */
export const inject: string[] = ["uiSkinLoader", "theme", "slots"];

/** client apply（Loader 材料化本 bundle 后以 entry fiber 调用）。 */
export function apply(ctx: SkinClientContext): void {
  const activation = createInkwashActivation(ctx, {
    createBackdrop: () => InkwashBackdrop,
  });

  // 登记皮肤；登记 ≠ 激活——registerSkin 只入发现表（R1）。
  const unregister = ctx.uiSkinLoader.registerSkin({
    ...SKIN_META,
    preview: INKWASH_PREVIEW_SVG,
    activate: (skinCtx) => activation.activate(skinCtx),
    deactivate: () => activation.deactivate(),
  });

  // 反登记随皮肤 fiber 卸载自动执行（公约 §4.3-3：加载器被停用/卸载时）。
  ctx.effect(() => unregister, "skn-inkwash: unregister on fiber dispose");
}
