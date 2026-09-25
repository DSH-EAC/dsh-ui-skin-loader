/**
 * 皮肤包本地的宿主 API 结构类型（零导入——公约形态；与 aurora 包的 context.ts
 * 对称，但只保留 inkwash 实际用到的服务面：inkwash 不提供自定义设置，
 * 因此没有 configForms / locale——「不提供设置也不被区别对待」的最小实现）。
 * 形状权威：docs/api-notes.md（§4/§5/§7）与公约 §4.2。
 */

// ---------------------------------------------------------------------------
// host 半（Node 侧）——api-notes §1.3
// ---------------------------------------------------------------------------

/** host 半 `apply(ctx, config)` 收到的 ctx 的最小形态（inkwash 只声明不消费）。 */
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
// client 半（浏览器侧）——api-notes §4/§5/§7
// ---------------------------------------------------------------------------

/** cordis effect 语义（登记即执行，返回值是 unload 时逆序调用的 disposer）。 */
export type EffectFn = (execute: () => (() => unknown) | void, label?: string) => unknown;

/** api-notes §7：主题注册/切换面的最小形态。 */
export interface SkinThemeFace {
  register(definition: {
    id: string;
    colorScheme: "light" | "dark";
    tokens: Record<string, string>;
  }): () => void;
  setTheme(id: string): void;
  getTheme(): { preference: string };
  /** 叠一层 token 覆盖（亮暗两值都必填；同 source 再调 = 替换该层；与偏好无关）。 */
  overrideTokens(source: string, tokens: Record<string, { light: string; dark: string }>): () => void;
}

/** api-notes §5：槽位注册/等待面的最小形态（选项不含 kind——上游由 SlotMap 决定）。 */
export interface SkinSlotFace {
  register(
    options: {
      name: string;
      id: string;
      order?: number;
      label?: string | (() => string);
    },
    component: (props: never) => unknown,
  ): () => void;
  inject(key: string, callback: () => (() => void) | Iterable<() => void> | void): () => void;
}

/** 公约 §4.2：皮肤 client apply 收到的 ctx 的最小形态。 */
export interface SkinClientContext {
  effect: EffectFn;
  readonly slots: SkinSlotFace;
  readonly theme: SkinThemeFace;
  readonly uiSkinLoader: {
    registerSkin(registration: SkinRegistrationLike): () => void;
  };
}

/** 公约 §4.2：激活载荷 SkinContext 的最小形态。 */
export interface SkinActivationContext {
  readonly logger: {
    debug(message: string, details?: Record<string, unknown>): void;
    info(message: string, details?: Record<string, unknown>): void;
    warn(message: string, details?: Record<string, unknown>): void;
    error(message: string, details?: Record<string, unknown>): void;
  };
  readonly signal: AbortSignal;
  readonly slots: SkinSlotFace;
}

/** 皮肤登记体的最小形态（公约 §3 + §4.2；inkwash 无 settingsHint——合法省略）。 */
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

/** 皮肤会话可触达的 DOM 最小面（生产用真实 document；测试注入桩）。 */
export interface SkinDom {
  createElement(tag: "style"): {
    textContent: string;
    setAttribute(name: string, value: string): void;
    remove(): void;
  };
  head: { appendChild(node: unknown): unknown };
  body: {
    setAttribute(name: string, value: string): void;
    removeAttribute(name: string): void;
  };
}
