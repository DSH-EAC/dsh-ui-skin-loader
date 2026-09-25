/**
 * @dsh-eac/skin-dragon-heir 的 host 半（Node 侧，api-notes §1.3 形态；inkwash 先例同款）。
 *
 * dragon-heir 不提供自定义设置（公约 §4.2），因此：
 * - 不导出 `Config` schema——设置命名空间不存在，宿主不会为它生成设置页；
 * - `apply` 为 no-op（皮肤的一切行为都在 client 半的激活会话里）。
 */

import type { SkinHostContext } from "./context.ts";

/** host 半入口（no-op：dragon-heir 的 host 半无任何需要登记的生命周期）。 */
export function apply(ctx: SkinHostContext): void {
  void ctx;
}
