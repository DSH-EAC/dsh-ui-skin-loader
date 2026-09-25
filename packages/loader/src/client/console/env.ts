/**
 * 控制台运行环境（T2.5）：亮暗配色与 locale 的「挂载期订阅 → 自建广播」桥。
 *
 * 上游 `ctx.on("theme/change" / "locale/change")` 把监听登记为「当前 fiber」的 effect
 * （cordis events.d.ts L191-197）；React 渲染/effect 回调不在 cordis fiber 语境里，
 * 从组件里直接调 ctx.on 有 INACTIVE_EFFECT 风险。宿主 ui-layout 的先例也是在
 * ctx.effect 内订阅一次、再分发给 presenter。本模块采用同款形态：
 * mount 期（ctx.effect 体内）订阅上游事件各一次，自建轻量 store 广播给 React
 * （useSyncExternalStore 消费；getSnapshot 稳定，符合 uSES 契约）。
 *
 * 纯 TS、零 React、零 DOM——node --test 可驱动（行为语义：订阅/退订/通知/快照稳定）。
 */

import type { Disposer } from "../../protocol.ts";

/** 可快照订阅的最小外部 store 面（React useSyncExternalStore 形态）。 */
export interface SnapshotStore<T> {
  /** 当前快照（变更前返回稳定引用）。 */
  get(): T;
  /** 订阅变更；返回移除监听的 disposer（幂等语义由调用方保证）。 */
  subscribe(listener: () => void): Disposer;
}

/** 挂载方持有的可写 store 面（组件只读消费 SnapshotStore）。 */
export interface WritableSnapshotStore<T> extends SnapshotStore<T> {
  set(next: T): void;
}

function createStore<T>(initial: T, equals: (a: T, b: T) => boolean): SnapshotStore<T> & {
  set(next: T): void;
} {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) {
      if (equals(value, next)) {
        return;
      }
      value = next;
      for (const listener of [...listeners]) {
        try {
          listener();
        } catch {
          // 单个订阅者异常不阻断广播（React 渲染异常自有边界）。
        }
      }
    },
    subscribe(listener: () => void): Disposer {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type ColorScheme = "light" | "dark";

/**
 * 配色 store：mount 期从 adapter.theme.getTheme() 取初值，
 * theme/change 回调里 set（adapter 投影已解析 system → light/dark）。
 */
export function createSchemeStore(initial: ColorScheme): WritableSnapshotStore<ColorScheme> {
  return createStore(initial, (a, b) => a === b);
}

/** locale store：值是单调递增 revision（语言切换时 bump，触发订阅组件重渲染）。 */
export interface LocaleRevisionStore extends SnapshotStore<number> {
  /** bump revision（locale/change 回调调用）。 */
  bump(): void;
}

export function createLocaleRevisionStore(): LocaleRevisionStore {
  const store = createStore(0, (a, b) => a === b);
  return {
    get: store.get,
    subscribe: store.subscribe,
    bump() {
      store.set(store.get() + 1);
    },
  };
}

/** 布尔旗标 store（控制台浮层展开状态：侧栏入口与 shell.overlay 席位共享）。 */
export function createFlagStore(initial: boolean): WritableSnapshotStore<boolean> {
  return createStore(initial, (a, b) => a === b);
}
