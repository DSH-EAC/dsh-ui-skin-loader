/**
 * 皮肤包本地的宿主 API 结构类型（零导入——公约形态；与 aurora/inkwash 先例的
 * context.ts 对称，只保留本皮肤实际用到的服务面）。
 *
 * dragon-heir 的观感全部由自有 DOM/CSS 承载（vendored 上游模块直接操作 document），
 * 不用 theme/slots/configForms/locale——这些服务面省略即「不提供也不被区别
 * 对待」（公约 §4.2）的最小实现。形状权威：docs/api-notes.md 与公约 §4.2。
 */

// ---------------------------------------------------------------------------
// host 半（Node 侧）——api-notes §1.3
// ---------------------------------------------------------------------------

/** host 半 `apply(ctx, config)` 收到的 ctx 的最小形态（本皮肤只声明不消费）。 */
export interface SkinHostContext {
  readonly fiber?: unknown;
  inject(
    services: readonly string[],
    callback: (child: SkinHostChildContext) => void,
  ): unknown;
}

/** host 子 fiber ctx 的最小形态。 */
export interface SkinHostChildContext {
  effect(execute: () => (() => unknown) | void, label?: string): unknown;
}

// ---------------------------------------------------------------------------
// client 半（浏览器侧）——api-notes §4
// ---------------------------------------------------------------------------

/** cordis effect 语义（登记即执行，返回值是 unload 时逆序调用的 disposer）。 */
export type EffectFn = (execute: () => (() => unknown) | void, label?: string) => unknown;

/** 公约 §4.2：皮肤 client apply 收到的 ctx 的最小形态（服务由 exports.inject 声明）。 */
export interface SkinClientContext {
  effect: EffectFn;
  /** 加载器服务（api-notes §4：皮肤侧唯一登记入口）。 */
  readonly uiSkinLoader: {
    registerSkin(registration: SkinRegistrationLike): () => void;
  };
}

/** 公约 §4.2：激活载荷 SkinContext 的最小形态（加载器下发的 skinCtx）。 */
export interface SkinActivationContext {
  readonly logger: {
    debug(message: string, details?: Record<string, unknown>): void;
    info(message: string, details?: Record<string, unknown>): void;
    warn(message: string, details?: Record<string, unknown>): void;
    error(message: string, details?: Record<string, unknown>): void;
  };
  readonly signal: AbortSignal;
}

/** 皮肤登记体的最小形态（公约 §3 + §4.2；冻结面权威见加载器 packages/loader/src/protocol.ts）。 */
export interface SkinRegistrationLike {
  apiVersion: string;
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  tags?: readonly string[];
  preview?: string;
  settingsHint?: string;
  activate: (skinCtx: SkinActivationContext) => void | Promise<void>;
  deactivate: () => void | Promise<void>;
}

/**
 * 被迁移上游 client `apply(ctx)` 消费的 ctx 面（vendored 模块的形参）。
 *
 * 上游形态：package.json `dsh.client.inject` 为空，运行时用 `ctx.effect`
 * 登记 disposer、用 `ctx.get(name)` 惰性定位可选服务（connection/workspaces，
 * 两者缺席即降级——上游调用点自带 try/catch）。本包把这两面适配到公约的
 * activate 会话上：effect 的 disposer 进会话账本（R8），get 尽力而为镜像。
 */
export interface VendoredSkinContext {
  effect(execute: () => (() => unknown) | void, label?: string): unknown;
  get(name: string): unknown;
}
