/**
 * 公约冻结协议面（T2.4）：皮肤 / 控制台 / 加载器三方共用的类型与保留名。
 *
 * 本模块是纯类型 + 字符串常量（零运行时副作用、零上游导入）——host 半、client 半
 * 与皮肤包（T2.6）都可安全导入。签名以 task-6 brief 的冻结接口为准；
 * 行为语义以公约（covenant/convention.md）§3/§4/§6 为准。
 */

import type { Disposer, SlotComponent, SlotOptions } from "./adapter/types.ts";

/** 释放句柄（adapter 语义面的基础形态；registerSkin 反登记 / subscribe 反订阅同形）。 */
export type { Disposer };

// ---------------------------------------------------------------------------
// 保留面（公约 R2：皮肤不得占用）
// ---------------------------------------------------------------------------

/** 公约协议 id（apiVersion 的唯一合法 major 轴）。 */
export const CONVENTION_ID = "dsh.ecosystem.ui-skin-loader/v1";

/** 公约保留面：cordis service 名（api-notes §4 落地方案）。 */
export const SERVICE_NAME = "uiSkinLoader";

/**
 * 公约保留面：settings 命名空间（== cordis.patch.yml 行 id，api-notes §8.1）。
 * 持久化 schema：{ activeSkin, faultLog, diagnosticsEnabled }（task-6 brief §1）。
 */
export const SETTINGS_NAMESPACE = "dsh-ui-skin-loader";

/** 公约保留面：加载器扩展槽位 id 前缀（公约 §6）。 */
export const LOADER_SLOT_PREFIX = "io.github.dsh-eac.skin.loader.";

/** 无皮肤状态（合法、可持久的选择，公约 §7）。 */
export const DEFAULT_SKIN_ID = "default";

// ---------------------------------------------------------------------------
// 皮肤登记协议（公约 §3 + §4.2；task-6 brief 冻结）
// ---------------------------------------------------------------------------

/** 公约 §6：皮肤自愿贡献的扩展槽位声明（加载器只登记展示，T2.4 不消费）。 */
export interface SkinSlotDeclaration {
  /** 反域名槽位 id（公约 §6 保留面前缀见 LOADER_SLOT_PREFIX）。 */
  id: string;
  kind: "single" | "list" | "keyed" | "chain";
  scope: "root" | "session";
  /** 展示用说明。 */
  description?: string;
  /** 公约 §6「自描述」的 fallback 观感描述。 */
  fallback?: string;
}

/**
 * 皮肤登记体（冻结，T2.6 皮肤按此实现）。声明 ≠ 激活：registerSkin 只入
 * discovered 表（公约 R1——激活前零可见副作用，登记本身除外）。
 */
export interface SkinRegistration {
  /** 必须精确匹配公约版本轴 `dsh.ecosystem.ui-skin-loader/v1`（major 匹配即兼容，公约 §8）。 */
  apiVersion: string;
  /** 公约 §3 正则 `[a-z0-9]+(?:[.-][a-z0-9]+)*`；不匹配 → 不兼容拒绝。 */
  id: string;
  name: string;
  /** SemVer，展示用。 */
  version: string;
  author?: string;
  description?: string;
  tags?: string[];
  /** 内联 SVG 或相对路径。 */
  preview?: string;
  /** 公约 §6 自愿槽位贡献声明。 */
  slots?: SkinSlotDeclaration[];
  /** 自此才允许产生可见副作用；全部副作用必须可逆且经皮肤自身 ctx.effect 登记（公约 R8）。 */
  activate: (ctx: SkinContext) => void | Promise<void>;
  /** 彻底关闭：撤销激活以来的全部副作用（公约 §4.3「退出后不可观测」）。 */
  deactivate: () => void | Promise<void>;
}

/** 结构化 logger（皮肤收到的实例以皮肤 id 为前缀）。 */
export interface Logger {
  debug(message: string, details?: Record<string, unknown>): void;
  info(message: string, details?: Record<string, unknown>): void;
  warn(message: string, details?: Record<string, unknown>): void;
  error(message: string, details?: Record<string, unknown>): void;
}

/**
 * 公约 §6：加载器侧扩展槽位句柄。经它登记的席位由加载器跟踪记账，
 * deactivate（含兜底）时逆序撤除——皮肤自身 fiber 意外死亡时不级联，
 * 因此皮肤自己的壳级副作用仍应优先用其自身 ctx 的 ctx.slots / ctx.effect（公约 R8）。
 */
export interface SkinSlotHandle {
  register(options: SlotOptions, component: SlotComponent): Disposer;
  inject(key: string, callback: () => Disposer | Iterable<Disposer> | void): Disposer;
}

/** 公约 §4.2 激活载荷（冻结）。 */
export interface SkinContext {
  /** 结构化 logger（前缀皮肤 id）。 */
  logger: Logger;
  /** 激活被中止（切换被更新的请求取代、激活超时、加载器停用）。 */
  signal: AbortSignal;
  /** 扩展槽位句柄（公约 §6；贡献受 adapter DshSlots 支持）。 */
  slots: SkinSlotHandle;
}

// ---------------------------------------------------------------------------
// 公共运行时面（冻结，T2.5 控制台按此消费）
// ---------------------------------------------------------------------------

/** 皮肤运行时状态（公约 §4.1 状态机 + 加载器侧隔离标记）。 */
export type SkinStatus = "discovered" | "active" | "fault" | "suspect-residue";

/** list() 条目：登记摘要字段 + 运行时状态。 */
export interface SkinInfo {
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  tags?: string[];
  preview?: string;
  /** 公约 §6 自愿槽位贡献声明（登记原文）。 */
  slots?: SkinSlotDeclaration[];
  status: SkinStatus;
  /** 不兼容原因（可读）；存在时加载器拒绝激活（公约 §3/§8）。 */
  incompatible?: string;
  /**
   * 诊断增强保留位：「已安装但未加载/未声明 dsh.skin」。T2.4 降级为不做
   * （api-notes 无 machine-verified 的 client 侧插件清单读取通道，§15）；
   * 加载器在找到已验证通道前永不置位。
   */
  installedButInactive?: true;
}

/** switchTo 结果（brief §3 扩展：warning 携带「如实告知」信息）。 */
export type SwitchResult =
  | { ok: true; warning?: string }
  | { ok: false; error: string; warning?: string; rolledBackTo: string };

/** 故障日志条目（持久化 schema 的一部分；有界，最多 50 条，见 MAX_FAULT_LOG）。 */
export interface FaultEntry {
  /** ISO 8601 时间戳。 */
  at: string;
  /** 关联皮肤 id（运行时级事件用 "(runtime)"）。 */
  skinId: string;
  kind:
    | "activate-failed"
    | "activate-timeout"
    | "deactivate-timeout"
    | "deactivate-failed"
    | "recovery-unregistered"
    | "recovery-failed"
    | "recovery-invalid-value"
    | "persist-failed"
    | "explicit-retry";
  message: string;
}

/** host settings 持久化值（命名空间 dsh-ui-skin-loader 的段落）。 */
export interface LoaderSettingsValue {
  /** 当前激活皮肤 id；"default" = 无皮肤。激活事实的持久化事实来源。 */
  activeSkin: string;
  /** 精简诊断事件（有界）。 */
  faultLog: FaultEntry[];
  /** 诊断开关（默认 false；T2.5 控制台消费）。 */
  diagnosticsEnabled: boolean;
}

/**
 * 加载器对皮肤暴露的完整 service 面（ctx.provide("uiSkinLoader", …) 的值，冻结）：
 * registerSkin 是皮肤侧登记入口（api-notes §4），其余四位是 SkinRuntime 公共面
 * （T2.5 控制台消费）。
 */
export type SkinLoaderService = {
  registerSkin: (reg: SkinRegistration) => Disposer;
} & SkinRuntime;

/** SkinRuntime 公共面（冻结，T2.5 控制台按此消费）。 */
export interface SkinRuntime {
  /** 已发现皮肤列表快照（登记摘要 + 状态）。 */
  list(): SkinInfo[];
  /** 当前激活皮肤 id；"default" = 无皮肤。 */
  current(): string | "default";
  /**
   * 全局互斥切换（公约 §4.3/§4.4；五触发统一入口）。幂等性：目标 == 当前 → ok:false。
   * fault / suspect-residue 皮肤被显式 switchTo = 清除隔离标记重试一次（brief §3 授权）。
   */
  switchTo(id: string | "default"): Promise<SwitchResult>;
  /** 状态变更通知（登记/反登记/标记/切换落定），返回移除监听的 disposer。 */
  subscribe(cb: () => void): () => void;
}
