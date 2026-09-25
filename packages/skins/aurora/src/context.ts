/**
 * 皮肤包本地的宿主 API 结构类型（零导入——公约形态）。
 *
 * 皮肤**不 import 加载器 / adapter 源码**，也不 import `@deepseek-ai/*`：
 * 与外部开发者完全一致，宿主 API 只以「client apply 收到的 ctx 上的服务」这一
 * 运行时形态访问（api-notes §4 R10 定案：exports.inject 声明服务名，vendored
 * Loader 等服务就绪后才调 apply）。本文件只对这些服务的**实际用到的成员**做
 * 最小结构描述——形状权威是 docs/api-notes.md（§5/§7/§8/§10）与公约 §4.2。
 *
 * 结构化类型的好处：多描述一个不存在的成员会在实机立刻暴露，而 import 一个
 * 编译期类型则什么都保证不了（运行时形状仍需自己对齐 api-notes）。
 */

// ---------------------------------------------------------------------------
// host 半（Node 侧）——api-notes §1.3 / §8.1
// ---------------------------------------------------------------------------

/** host 半 `apply(ctx, config)` 收到的 ctx 的最小形态。 */
export interface SkinHostContext {
  /** 当前 fiber（settings.configure 的 owner 实参，ui-theme 先例）。 */
  readonly fiber?: unknown;
  /** 创建子 fiber 等服务就绪后执行 callback（api-notes §1.3）。 */
  inject(
    services: readonly string[],
    callback: (child: SkinHostChildContext) => void,
  ): unknown;
}

/** host 子 fiber ctx 的最小形态。 */
export interface SkinHostChildContext {
  /** api-notes §2：effect 登记，unload 逆序释放。 */
  effect(execute: () => (() => unknown) | void, label?: string): unknown;
  /** api-notes §8.1：本 entry 的设置页策略（auto: false = 自带 UI，不自动生成）。 */
  readonly settings: {
    configure(presentation: { auto?: boolean }, owner?: unknown): () => void;
  };
}

/**
 * schemastery 的最小结构面（api-notes §1.3：host 半 `Config` 导出须是「存在且有
 * toJSON」的 schema 实例）。皮肤源码不 import schemastery（仓库隔离纪律对皮肤
 * 同样生效）——构建脚本把真实 import 以 banner 注入产物，源码只经此参数面触碰它。
 * （外部开发者可以正常 import；本仓库的约束只是本仓库的隔离纪律，见包 README。）
 */
export interface SchemaFactory {
  object(fields: Record<string, unknown>): unknown;
  string(): { default(value: string): { volatile(): unknown } };
}

// ---------------------------------------------------------------------------
// client 半（浏览器侧）——api-notes §4/§5/§7/§8.2/§10
// ---------------------------------------------------------------------------

/** cordis effect 语义（api-notes §2：登记即执行，返回值是 unload 时逆序调用的 disposer）。 */
export type EffectFn = (execute: () => (() => unknown) | void, label?: string) => unknown;

/** api-notes §7：主题注册/切换面的最小形态（皮肤用到的成员）。 */
export interface SkinThemeFace {
  /** 注册主题（重复 id 上游抛错；dispose 掉当前激活主题会把偏好重置回默认）。 */
  register(definition: {
    id: string;
    colorScheme: "light" | "dark";
    tokens: Record<string, string>;
  }): () => void;
  /** 唯一偏好写入口；未知 id 抛错；接受 "system"。注意：自定义主题 id 是会话级偏好（不持久化）。 */
  setTheme(id: string): void;
  /** 读取快照（皮肤只用 preference 字段）。 */
  getTheme(): { preference: string };
  /**
   * 叠一层 token 覆盖（亮暗两值都必填；同 source 再调 = 替换该层）。
   * 覆盖层与偏好无关（宿主 adopt 不触碰），是偏好竞态下保住观感的正道。
   */
  overrideTokens(source: string, tokens: Record<string, { light: string; dark: string }>): () => void;
}

/** api-notes §8.2：configForms 表单面的最小形态（稳定快照 + 排队写）。 */
export interface SkinSettingsForm {
  getSnapshot(): {
    status: "loading" | "ready" | "unavailable";
    value: unknown;
    revision: number;
    writable: boolean;
  };
  subscribe(listener: () => void): () => void;
  set(field: string, value: unknown): Promise<boolean>;
}

/** api-notes §5：槽位注册/等待面的最小形态（上游由 SlotMap 决定 kind，选项不含 kind）。 */
export interface SkinSlotFace {
  register(
    options: {
      name: string;
      /** list 槽位席位键（皮肤自有前缀，公约 R2/R3：不与其它皮肤/加载器撞名）。 */
      id: string;
      order?: number;
      /** list 槽位文案；thunk 形态在读取时求值、跟随 locale（api-notes §13.6）。 */
      label?: string | (() => string);
    },
    component: (props: never) => unknown,
  ): () => void;
  /** 等槽位声明出现后执行 callback；控制权归调用方 fiber（卸载自动撤除）。 */
  inject(key: string, callback: () => (() => void) | Iterable<() => void> | void): () => void;
}

/** api-notes §10：i18n 注册/绑定面的最小形态（typed 双语，缺键回退 en）。 */
export interface SkinLocaleFace {
  register(ns: string, dicts: { en: Record<string, string>; zh: Record<string, string> }): () => void;
  bind(ns: string): Translate;
}

/** api-notes §10：翻译函数（`{name}` 模板；查键链 active ns → common → key）。 */
export type Translate = (key: string, params?: Record<string, string | number>) => string;

/** 公约 §4.2：皮肤 client apply 收到的 ctx 的最小形态（服务由 exports.inject 声明）。 */
export interface SkinClientContext {
  effect: EffectFn;
  readonly slots: SkinSlotFace;
  readonly theme: SkinThemeFace;
  readonly configForms: { get(entryId: string): SkinSettingsForm };
  readonly locale: SkinLocaleFace;
  /** 加载器服务（api-notes §4：皮肤侧唯一登记入口）。 */
  readonly uiSkinLoader: {
    registerSkin(registration: SkinRegistrationLike): () => void;
  };
}

/** 公约 §4.2：激活载荷 SkinContext 的最小形态（加载器下发的 skinCtx）。 */
export interface SkinActivationContext {
  /** 结构化 logger（前缀皮肤 id；皮肤用它如实留痕，不静默吞错）。 */
  readonly logger: {
    debug(message: string, details?: Record<string, unknown>): void;
    info(message: string, details?: Record<string, unknown>): void;
    warn(message: string, details?: Record<string, unknown>): void;
    error(message: string, details?: Record<string, unknown>): void;
  };
  /** 激活被中止（切换被取代/超时/加载器停用/皮肤被宿主停用）。 */
  readonly signal: AbortSignal;
  /** 扩展槽位句柄（公约 §6）。壳级副作用优先走皮肤自身 ctx.slots（R8）。 */
  readonly slots: SkinSlotFace;
}

/**
 * 皮肤登记体的最小形态（公约 §3 + §4.2；冻结面权威见加载器 packages/loader/src/protocol.ts——
 * 皮肤按公约实现，不 import 加载器代码，故本地镜像同形结构）。
 */
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
 * 皮肤会话可触达的 DOM 最小面（仅为可测试性显式化；生产代码用真实 `document`）。
 * 皮肤只创建/移除**自有**节点（公约 R5：不读不写上游私有 DOM）。
 */
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
