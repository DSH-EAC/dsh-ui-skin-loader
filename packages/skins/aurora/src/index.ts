/**
 * @dsh-eac/skin-aurora 的 host 半（Node 侧，api-notes §1.3 形态）。
 *
 * 职责只有两件：
 * 1. `apply(ctx, config)`——声明设置页策略 `{ auto: false }`：本皮肤自带设置 UI
 *    （client 半经 `settings.section` 槽位提供「极光之夜」分区），不使用宿主
 *    自动生成的设置页（ui-theme 先例）。
 * 2. `Config` 导出——**这是 client 半设置能落盘的前提**（api-notes §8 实读结论：
 *    无 schema 的 entry 不生成 descriptor，host 侧表单写会抛
 *    "No configurable plugin entry"；表单写只放行 volatile 字段）。
 *    字段与 client 半 `BACKGROUND_URL_FIELD` 对齐：`backgroundUrl: string`。
 *
 * 关于 schemastery 的导入形态（与外部开发者的唯一差异）：本仓库的隔离纪律
 * （eslint no-restricted-imports，对皮肤包同样生效）禁止源码 import
 * `@deepseek-ai/*`，因此源码只把 schemastery 经 `createConfigSchema(s)` 的参数面
 * 引入；真实的 `import Schema from "@deepseek-ai/schemastery"` 由构建脚本以
 * banner 注入产物 `lib/index.js`，并以 footer 接上
 * `export const Config = createConfigSchema(Schema)`。运行时形态与外部开发者
 * 手写的完全一致（依赖声明在 package.json dependencies，安装后由宿主解析）。
 */

import type { SchemaFactory, SkinHostContext } from "./context.ts";
import { BACKGROUND_URL_DEFAULT, BACKGROUND_URL_FIELD } from "./settings.ts";

/**
 * 皮肤设置命名空间的 Config schema（volatile 字段才能被 client 表单写放行）。
 * 由构建脚本的 footer 以真实 schemastery 调用：`export const Config = createConfigSchema(Schema)`。
 */
export function createConfigSchema(s: SchemaFactory): unknown {
  return s.object({
    [BACKGROUND_URL_FIELD]: s.string().default(BACKGROUND_URL_DEFAULT).volatile(),
  });
}

/**
 * host 半入口：等 settings 服务就绪后声明「不自动生成设置页」
 * （自带 UI 的插件先例：ui-theme 的 `settings.configure({ auto: false }, ctx.fiber)`）。
 * 设置页策略随子 fiber 生命周期自动撤销（ctx.effect 登记）。
 */
export function apply(ctx: SkinHostContext): void {
  ctx.inject(["settings"], (child) => {
    child.effect(
      () => child.settings.configure({ auto: false }, ctx.fiber),
      "skn-aurora: settings page policy",
    );
  });
}
