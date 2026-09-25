/**
 * DSH adapter 语义接口（T2.3）。
 *
 * 本文件是 loader / SkinRuntime（T2.4）/ 控制台（T2.5）/ 皮肤（T2.6）接触 DSH 上游能力的
 * 唯一类型面。刻意保持「最小语义面」：不照抄上游的泛型、声明合并（SlotMap / LocaleNamespaceMap）
 * 与类型体操，只暴露皮肤生态实际需要的原语。
 *
 * 每个成员的注释都标注其在 `docs/api-notes.md` 的来源章节（machine-verified，唯一权威）；
 * 针对 0.1.7-rc.2 的调用形态封装见同目录 `dsh-0.1.7.ts`。
 *
 * 隔离纪律（eslint 机械强制）：`@deepseek-ai/*` 包导入与上游私有全局
 * `__ModuleLoader__` / `__DSH_BOOT__` 只允许出现在 `packages/loader/src/adapter/**`。
 * 标准 Web 平台 API（document / window 浏览器全局 / CSSOM / customElements）不算上游耦合
 * （controller R11 裁定），不受该纪律限制。
 */

/**
 * 释放句柄。上游各 register/inject 返回的 disposer 均为幂等形态（api-notes §5/§7/§10）；
 * adapter 自己组合出的 disposer 额外保证「只释放一次 + 逆序」（见 dsh-0.1.7.ts 的 composeDisposers）。
 */
export type Disposer = () => void;

/**
 * api-notes §5：槽位 kind。上游由 SlotMap 声明决定（注册者不传）；
 * adapter 以显式字段透传该概念，用于早校验（list→id、keyed→key、chain→select），
 * 转发上游前剥掉（上游 kind 由槽位键的 SlotMap 声明决定，传了也是多余字段）。
 */
export type SlotKind = "single" | "list" | "keyed" | "chain";

/**
 * api-notes §5：槽位 scope。上游实值为 `'root' | 'session-maybe' | 'session'`
 * （PLAN 时代写作 root/session，以实测为准，缺的是 session-maybe）。
 * 加载器与皮肤只注册 root 槽位；session/session-maybe 的会话绑定细节 api-notes §15 未覆盖。
 */
export type SlotScope = "root" | "session-maybe" | "session";

interface SlotOptionsBase {
  /** api-notes §5：目标槽位键（SlotMap key，必填），如 `settings.section`。 */
  name: string;
  /** api-notes §5/§13.6：list/keyed 槽位显示文案；thunk 形态在读取时求值、随 locale 变化（无需重新注册）。 */
  label?: string | (() => string);
  /** api-notes §5：诊断标签（上游 Service 包装还会自动盖调用方 fiber 名）。 */
  registrant?: string;
}

export interface SingleSlotOptions extends SlotOptionsBase {
  kind: "single";
  /** api-notes §5：single 的 priority 是 cell shadowing rank（同 key 同 priority 上游抛错）。 */
  priority?: number;
}

export interface ListSlotOptions extends SlotOptionsBase {
  kind: "list";
  /** api-notes §5/§6：list 槽位必填 id（分区内席位键，如设置分区的 nav 键）。 */
  id: string;
  /** api-notes §5/§6.2：list 槽位排序（nav 位置等）。 */
  order?: number;
}

export interface KeyedSlotOptions extends SlotOptionsBase {
  kind: "keyed";
  /** api-notes §5：keyed 槽位的分发键。 */
  key: string;
  priority?: number;
}

export interface ChainSlotOptions extends SlotOptionsBase {
  kind: "chain";
  /** api-notes §5：chain 槽位的路由选择器（必填）。 */
  select: (owner: unknown) => unknown;
  priority?: number;
}

/** api-notes §5：槽位注册选项，按 kind 判别（形态字段见各接口；校验规则在 dsh-0.1.7.ts）。 */
export type SlotOptions =
  | SingleSlotOptions
  | ListSlotOptions
  | KeyedSlotOptions
  | ChainSlotOptions;

/**
 * api-notes §5：槽位组件即 React 函数组件。adapter 不依赖 React 类型，
 * 以「接收 props 的函数」这一最小形态透传（组件的 props/renderSlot 面由各槽位 owner 决定，如 §6.2）。
 */
export type SlotComponent = (props: never) => unknown;

/** api-notes §5：槽位注册/等待面（cordis 服务 `ctx.slots` 的语义投影）。 */
export interface DshSlots {
  /**
   * api-notes §5：注册进槽位，返回幂等 disposer（随调用方 fiber 卸载级联撤除）。
   * adapter 先按 kind 校验必填形态字段，再剥掉 kind 透传上游。
   */
  register(options: SlotOptions, component: SlotComponent): Disposer;
  /**
   * api-notes §5：等槽位「声明」出现后执行 callback（已存在则同步执行）。
   * callback 可返回 disposer 或 disposer 迭代（adapter 聚合为单个 disposer，逆序释放）。
   * 控制权归调用方 fiber：插件卸载自动取消等待并撤除已登记内容。
   */
  inject(
    key: string,
    callback: () => Disposer | Iterable<Disposer> | void,
  ): Disposer;
}

/** api-notes §7：主题注册定义（tokens 是 `--dsw-alias-*` 别名层覆盖的单值表）。 */
export interface ThemeDefinition {
  /** api-notes §7：主题 id（具体主题的 setTheme 实参；重复注册上游抛错）。 */
  id: string;
  /** api-notes §7：基于哪套基础配色（presender 只看它切 `body[data-ds-dark-theme]`）。 */
  colorScheme: "light" | "dark";
  /** api-notes §7：别名层 token 覆盖，单值表。 */
  tokens: Record<string, string>;
}

/**
 * api-notes §7：override 层的 token 值——亮暗两值都必填（值不随 scheme 变化也要重复填），
 * 否则换到另一套配色时会不可读。裸字符串值上游抛教学错误；adapter 提前校验。
 */
export interface ThemeTokenModes {
  light: string;
  dark: string;
}

/** api-notes §7：主题注册/覆盖面（cordis 服务 `ctx.theme` 的语义投影）。 */
export interface DshTheme {
  /**
   * api-notes §7：注册主题（重复 id 上游抛错——内置 light/dark 占位；`system` 是偏好值不是可注册 id）。
   * dispose 掉当前激活主题会把偏好重置回默认。
   */
  register(definition: ThemeDefinition): Disposer;
  /**
   * api-notes §7：叠一层 token 覆盖（同 source 再调 = 替换该层并重新置顶；移除该层恢复被盖住的值）。
   */
  overrideTokens(
    source: string,
    tokens: Record<string, ThemeTokenModes>,
  ): Disposer;
}

/** api-notes §8.2：configForms 快照的语义投影（status/value/revision/writable；上游另有 base/user/mode，adapter 面省略）。 */
export interface SettingsSnapshot<T = unknown> {
  status: "loading" | "ready" | "unavailable";
  value: T;
  revision: number;
  /** api-notes §8.2/§13.7：memory 模式（非 loopback 页面）只读。 */
  writable: boolean;
}

/** api-notes §8.2：一个 settings 命名空间的 client 投影（写队列 + revision 栅栏由上游维护）。 */
export interface DshSettingsForm<T = Record<string, unknown>> {
  /**
   * api-notes §8.2：当前快照（稳定引用，uSES 友好）。投影按上游快照标识 memoize：
   * 同一上游快照标识返回同一投影对象，可安全用作 useSyncExternalStore 的 getSnapshot；
   * 上游快照更换（新标识）时返回新投影。
   */
  get(): SettingsSnapshot<T>;
  /** api-notes §8.2：排队写一个字段，返回 Host 是否接受（被拒时上游回读恢复）。 */
  set(field: string, value: unknown): Promise<boolean>;
  /** api-notes §8.2：订阅快照变更，返回移除该监听的 disposer。 */
  subscribe(listener: () => void): Disposer;
}

/** api-notes §8.1/§8.2：client 侧设置读取面（host 侧 `ctx.settings.configure` 属 T2.4，不在本面）。 */
export interface DshSettings {
  /**
   * api-notes §8.1/§8.2：entryId == cordis.patch.yml 行 id == settings 命名空间
   * （加载器自身命名空间为公约保留面 `dsh-ui-skin-loader`；皮肤用各自命名空间）。
   */
  get<T = Record<string, unknown>>(entryId: string): DshSettingsForm<T>;
}

/** api-notes §10：双语字典（缺键回退 en；双语齐备强制——adapter 固定为 zh/en 双语形态）。 */
export interface LocaleDictionaries {
  en: Record<string, string>;
  zh: Record<string, string>;
}

/**
 * api-notes §10：翻译函数 `(key, params?) => string`，`{name}` 模板；
 * 查键链：active ns → `common` ns → key 本身。
 */
export type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/** api-notes §10：i18n 注册/绑定面（cordis 服务 `ctx.locale` 的语义投影）。 */
export interface DshLocale {
  /** api-notes §10：typed 双语 register（重复 (ns, locale) 上游抛错）。 */
  register(ns: string, dicts: LocaleDictionaries): Disposer;
  /** api-notes §10：bind——同一 ns 重复 bind 返回同一函数（上游 memoization，可安全 ride inject 面）。 */
  bind(ns: string): Translate;
}

/**
 * api-notes §1.4/§3.1：client bundle 注册体。factory 惰性执行（首次材料化才跑），
 * 返回 exports；exports 顶层的 `inject`（cordis 服务名数组）与 `apply(ctx)` 是
 * 跨插件协作的正道（api-notes §4 R10 定案）。
 */
export interface ClientBundleRegistration {
  /** api-notes §3.1：插件 id（== 包名 == graph 行 id），如 `@dsh-eac/ui-skin-loader`。 */
  id: string;
  /** api-notes §1.4/§3.1：factory 收模块表 require（只能要模块表词/graph 行包名，§3.3/§13.3）。 */
  factory: (require: (specifier: string) => unknown) => Record<string, unknown>;
}

/** api-notes §3.1：client 模块注册面（`window.__ModuleLoader__` facade 的语义投影）。 */
export interface DshModuleLoader {
  /** api-notes §3.1：queue 模式先入队，live 模式直接注册。 */
  load(registration: ClientBundleRegistration): void;
}

/**
 * api-notes §12.2：兼容性闸门是安装期 peerDependencies 的 `@deepseek-ai/dsh*` semver 检查
 * （includePrerelease），运行期只提供版本读取面即可。
 */
export interface HostInfo {
  /**
   * DSH 运行时版本。api-notes 未覆盖 client 侧运行期版本读取面（§15 未列任何版本全局；
   * boot wire 的 `rev` 是内容修订非 semver）——当前实现返回 null，待 T2.4/T2.7 找到已验证读取面再接。
   */
  readonly dshVersion: string | null;
  /** api-notes §3.2：boot wire 顶层 `rev`（内容修订，用于 HMR cache busting/诊断）；非 semver。 */
  readonly bootRev: string | null;
}

/**
 * adapter 聚合面——T2.4 SkinRuntimeContext 的地基（本任务不定稿 SkinRuntimeContext）。
 * 注意：应基于「调用方自己的 client ctx」构造（见 dsh-0.1.7.ts 的 createDsh017Adapter 注释），
 * 不要跨 fiber 共享单例，否则上游按调用时 context 路由的 dispose 会进错 fiber。
 */
export interface DshAdapter {
  readonly slots: DshSlots;
  readonly theme: DshTheme;
  readonly settings: DshSettings;
  readonly locale: DshLocale;
  readonly hostInfo: HostInfo;
}
