/**
 * @dsh-eac/skin-whale-song 的 client 半 bundle 入口。
 *
 * 契约与纪律同 inkwash 先例（api-notes §1.4/§4；R1：apply 只登记皮肤）；
 * `window.__ModuleLoader__.load` 外壳由 scripts/build-artifact.mjs 以
 * banner/footer 产出，源码不触碰上游私有全局。
 *
 * 与 inkwash 的差异：activate 的实现是 vendored 上游 apply（观感原样迁移），
 * 经 session.ts 的公约适配层接线；无 React 组件（上游皮肤直接操作 DOM）。
 */

import type { SkinClientContext } from "../context.ts";
import { SKIN_META } from "../identity.ts";
import { WHALE_SONG_PREVIEW_SVG } from "../preview.ts";
import { createWhaleSongActivation } from "./session.ts";

/** cordis 服务注入：只需 uiSkinLoader（登记）；观感不依赖其它服务。 */
export const inject: string[] = ["uiSkinLoader"];

/** client apply（Loader 材料化本 bundle 后以 entry fiber 调用）。 */
export function apply(ctx: SkinClientContext): void {
  const activation = createWhaleSongActivation(ctx);

  // 登记皮肤；登记 ≠ 激活——registerSkin 只入发现表（R1）。
  const unregister = ctx.uiSkinLoader.registerSkin({
    ...SKIN_META,
    preview: WHALE_SONG_PREVIEW_SVG,
    activate: (skinCtx) => activation.activate(skinCtx),
    deactivate: () => activation.deactivate(),
  });

  // 反登记随皮肤 fiber 卸载自动执行（公约 §4.3-3：加载器被停用/卸载时）。
  ctx.effect(() => unregister, "skn-whale-song: unregister on fiber dispose");
}
