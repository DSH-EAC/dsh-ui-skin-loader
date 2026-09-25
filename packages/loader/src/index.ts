/**
 * @dsh-eac/ui-skin-loader 的 host 半（T2.4）。
 *
 * 形态权威：docs/api-notes.md §1.2/§1.3/§8.1——
 * - cordis.patch.yml 行 id `dsh-ui-skin-loader` == settings 命名空间（公约保留面）；
 * - `apply(ctx)` 里 `ctx.inject(["settings"], …)` 调 `settings.configure({ auto: false })`
 *   （ui-theme 先例：自带控制台页面（T2.5），不自动生成设置页）；
 * - `Config` 导出带 volatile 字段的 schemastery schema——**这是 client 半经
 *   `configForms.get("dsh-ui-skin-loader").set(...)` 落盘 activeSkin/faultLog 的前提**
 *   （无 schema 的 entry 不生成 descriptor，host 侧表单写会拒绝，见
 *   adapter/dsh-0.1.7-host.ts 的依据说明）。
 *
 * host 半不参与切换逻辑：互斥裁决在 client 半单点进行（公约 §4.1），
 * host settings 只是激活事实的持久化事实来源（任何写入都来自加载器 client 半，
 * R6 的镜像义务——只有加载器写这个命名空间）。
 */

import {
  createLoaderConfigSchema,
  type Dsh017HostContext,
} from "./adapter/dsh-0.1.7-host.ts";
import { CONVENTION_ID, LOADER_SLOT_PREFIX, SERVICE_NAME, SETTINGS_NAMESPACE } from "./protocol.ts";

export { CONVENTION_ID, LOADER_SLOT_PREFIX, SERVICE_NAME, SETTINGS_NAMESPACE };
export { createLoaderConfigSchema };
export type { Dsh017HostContext } from "./adapter/dsh-0.1.7-host.ts";

/**
 * host 半 Config schema（settings 命名空间 dsh-ui-skin-loader）：
 * { activeSkin, faultLog, diagnosticsEnabled }，三字段全部 volatile（api-notes §8.2
 * 表单写只放行 volatile 路径）。默认值：activeSkin "default"、faultLog []、
 * diagnosticsEnabled false——与 protocol.ts 的 LoaderSettingsValue 语义一致。
 */
export const Config = createLoaderConfigSchema();

/**
 * host 半入口（api-notes §1.3 形态：`apply(ctx, config)`；config 本任务不消费——
 * 持久化值全部由 client 半经 configForms 表单写通道落盘）。
 */
export function apply(ctx: Dsh017HostContext): void {
  ctx.inject(["settings"], (child) => {
    child.effect(
      () => child.settings.configure({ auto: false }, ctx.fiber),
      "ui-skin-loader: settings page policy",
    );
  });
}
