/**
 * host settings 持久化投影（命名空间 `dsh-ui-skin-loader`，api-notes §8）。
 *
 * client 侧写路径 = `configForms.get(SETTINGS_NAMESPACE).set(field, value)`：
 * 上游 ConfigForm 排队顺序写、自带最新 revision 栅栏、被拒时回读恢复并返回 false
 * （api-notes §8.2）。host 侧命名空间由加载器 host 半的 Config schema 提供
 * （adapter/dsh-0.1.7-host.ts）。**激活事实的持久化事实来源就是这个命名空间**
 * （公约 §4.4 的 R6 镜像：只有加载器写它）。
 */

import {
  SETTINGS_NAMESPACE,
  type FaultEntry,
  type LoaderSettingsValue,
} from "../../protocol.ts";
import type { DshAdapter, DshSettingsForm } from "../../adapter/types.ts";
import { raceTimeout, type Timers } from "./clock.ts";

/** faultLog 有界上限（task-6 brief §1）。 */
export const MAX_FAULT_LOG = 50;

/** 表单写的默认有界等待（ms）——configForms.set 挂死不得拖死切换状态机。 */
const DEFAULT_WRITE_TIMEOUT_MS = 10_000;

export type PersistedRead =
  | { status: "ready"; activeSkin: string; faultLog: FaultEntry[] }
  | { status: "unavailable" };

/**
 * 加载器持久化存储。一个 runtime 实例持有一个 form 投影
 * （adapter.settings.get 每次调用返回独立包装——T2.3 报告的告戒，故这里只 get 一次）。
 * 所有写入都有界（超时按拒绝处理——上游可能仍落盘，属可接受的最后写者噪声）。
 */
export class SettingsStore {
  private readonly form: DshSettingsForm<LoaderSettingsValue>;
  private readonly timers: Timers;
  private readonly writeTimeoutMs: number;
  private readonly log: (message: string, details?: Record<string, unknown>) => void;

  constructor(
    adapter: DshAdapter,
    timers: Timers,
    log: (message: string, details?: Record<string, unknown>) => void,
    writeTimeoutMs = DEFAULT_WRITE_TIMEOUT_MS,
  ) {
    this.form = adapter.settings.get<LoaderSettingsValue>(SETTINGS_NAMESPACE);
    this.timers = timers;
    this.writeTimeoutMs = writeTimeoutMs;
    this.log = log;
  }

  /** 等待命名空间就绪（有界）；unavailable/超时 → null。 */
  async waitForReady(timeoutMs: number): Promise<PersistedRead> {
    for (;;) {
      const snapshot = this.form.get();
      if (snapshot.status === "ready") {
        return this.readCurrent();
      }
      if (snapshot.status === "unavailable") {
        this.log("settings namespace is unavailable", {
          namespace: SETTINGS_NAMESPACE,
        });
        return { status: "unavailable" };
      }
      // status === "loading"：等快照变更或超时（快照标识更换时上游会通知订阅者）。
      const outcome = await new Promise<"changed" | "timeout">((resolve) => {
        let done = false;
        let off: () => void = () => undefined;
        const settle = (value: "changed" | "timeout") => {
          if (done) {
            return;
          }
          done = true;
          off();
          this.timers.clearTimeout(handle);
          resolve(value);
        };
        const handle = this.timers.setTimeout(() => settle("timeout"), timeoutMs);
        off = this.form.subscribe(() => settle("changed"));
      });
      if (outcome === "timeout") {
        this.log("settings namespace did not become ready in time", {
          namespace: SETTINGS_NAMESPACE,
          timeoutMs,
        });
        return { status: "unavailable" };
      }
    }
  }

  /** 读当前持久化值（ready 前提下）；非字符串/缺失的 activeSkin 防御性归一为 "default"。 */
  private readCurrent(): PersistedRead {
    const value = this.form.get().value as Partial<LoaderSettingsValue>;
    const raw = value.activeSkin;
    const activeSkin = typeof raw === "string" && raw.length > 0 ? raw : "default";
    const faultLog = Array.isArray(value.faultLog)
      ? (value.faultLog as FaultEntry[]).slice(-MAX_FAULT_LOG)
      : [];
    return { status: "ready", activeSkin, faultLog };
  }

  /** 读当前持久化值（不等 ready——同步检查用）。 */
  readSync(): PersistedRead {
    const snapshot = this.form.get();
    if (snapshot.status !== "ready") {
      return { status: "unavailable" };
    }
    return this.readCurrent();
  }

  /**
   * 订阅本命名空间快照变更（跨标签页收敛的第二通道）。
   *
   * 实机验证（T2.7 V7）发现：上游对 `settings/document-updated` 的消费是
   * `mirror.load()`（dsh-client-ui-settings/lib/client.js L1512）——**异步回源**。
   * 事件到达时本端快照还是旧值，只靠事件驱动的 syncCheck 会读旧值幂等跳过、永不重放。
   * 快照回源时上游会通知 form 订阅者（快照标识更换），把它作为 syncCheck 的第二触发源
   * 即可在「无第二个事件」的情况下收敛；自身写入的回声与在途切换由 syncCheck 既有语义幂等消化。
   */
  onChange(listener: () => void): () => void {
    return this.form.subscribe(listener);
  }

  /** 写 activeSkin；被拒/超时/抛错返回 false（调用方负责如实上报，不重试——上游已带恢复读）。 */
  async writeActiveSkin(id: string): Promise<boolean> {
    try {
      const outcome = await raceTimeout(this.form.set("activeSkin", id), this.writeTimeoutMs, this.timers);
      return outcome.kind === "resolved" && outcome.value === true;
    } catch (error) {
      this.log("activeSkin write threw", {
        namespace: SETTINGS_NAMESPACE,
        error: describeError(error),
      });
      return false;
    }
  }

  /**
   * 写整个 faultLog 列表（调用方维护有界内存镜像，见 MAX_FAULT_LOG）。
   * 被拒/超时/抛错返回 false（调用方负责降级记日志，不重试）。
   */
  async writeFaultLog(entries: FaultEntry[]): Promise<boolean> {
    try {
      const outcome = await raceTimeout(this.form.set("faultLog", entries), this.writeTimeoutMs, this.timers);
      const accepted = outcome.kind === "resolved" && outcome.value === true;
      if (!accepted) {
        this.log("faultLog write rejected by host", {
          namespace: SETTINGS_NAMESPACE,
          entries: entries.length,
        });
      }
      return accepted;
    } catch (error) {
      this.log("faultLog write threw", {
        namespace: SETTINGS_NAMESPACE,
        entries: entries.length,
        error: describeError(error),
      });
      return false;
    }
  }
}

/** 生成 faultLog 条目的时间戳（测试可注入 now）。 */
export function faultTimestamp(now?: () => number): string {
  return new Date(now?.() ?? Date.now()).toISOString();
}

/** 错误 → 可读消息（faultLog / logger 共用）。 */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
