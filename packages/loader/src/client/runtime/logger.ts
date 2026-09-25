/**
 * 结构化 logger（protocol.ts 的 Logger 实现）。
 *
 * client bundle 里不依赖任何未在 api-notes 核实过的上游 logger 服务——
 * 以 console 为底，消息带 `[前缀]` 前缀 + 结构化 details。
 * 测试可注入收集 sink（Logger 形态自身即可充当 sink）。
 */

import type { Logger } from "../../protocol.ts";

type ConsoleSink = Pick<Console, "debug" | "info" | "warn" | "error">;

function createPrefixed(prefix: string, sink: ConsoleSink): Logger {
  return {
    debug(message, details) {
      sink.debug(`[${prefix}] ${message}`, details ?? {});
    },
    info(message, details) {
      sink.info(`[${prefix}] ${message}`, details ?? {});
    },
    warn(message, details) {
      sink.warn(`[${prefix}] ${message}`, details ?? {});
    },
    error(message, details) {
      sink.error(`[${prefix}] ${message}`, details ?? {});
    },
  };
}

/** 生产 logger：console 输出，前缀形如 `ui-skin-loader` / `ui-skin-loader:<skin-id>`。 */
export function createConsoleLogger(prefix: string): Logger {
  return createPrefixed(prefix, console);
}

/** 皮肤侧 logger：以加载器为根前缀、皮肤 id 为子前缀（公约 §4.2 载荷）。 */
export function createSkinLogger(skinId: string): Logger {
  return createConsoleLogger(`ui-skin-loader:${skinId}`);
}
