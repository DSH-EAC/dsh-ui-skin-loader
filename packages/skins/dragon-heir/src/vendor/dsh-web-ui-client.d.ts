/**
 * 被迁移上游 client 入口（vendored bundle）的本地声明面。
 *
 * 实现在同目录 `dsh-web-ui-client.js`（上游产物去壳 + S3 公约化改造，
 * 见该文件头注释与包根 THIRD-PARTY-NOTICES.md）。此 .d.ts 只声明本包实际
 * 消费的最小面：`apply(ctx)`——与上游 `exports.apply` 同名同义。
 */

export function apply(ctx: {
  /** cordis effect 语义：登记即执行，返回值是 dispose 时调用的 disposer。 */
  effect(execute: () => (() => unknown) | void, label?: string): unknown;
  /** best-effort 服务定位（上游 inject 为空、运行时 ctx.get；缺席返回 undefined）。 */
  get(name: string): unknown;
}): void;
