/**
 * 换肤控制台 React 组件（T2.5）。
 *
 * 组件树（PLAN §2.5 定案）：
 *   ConsoleEnvProvider（scheme/locale 订阅面）
 *     └─ SkinConsole（hero 当前观感卡 + 恢复默认 + 警告横幅）
 *          └─ 皮肤卡片墙（每皮肤一卡：封面/名称/作者/版本/状态徽标/settingsHint；
 *              点击卡片 = switchTo；进行态互斥防重复提交；失败行内呈现）
 *   OverlayHost（shell.overlay 席位：侧栏入口展开的控制台浮层）
 *   FooterAction（sidebar.footer.action 席位：亮/窄两态入口按钮）
 *   SettingsSection（settings.section 席位：设置页分区）
 *
 * 组件只消费 SkinRuntime 冻结公共面（list/current/switchTo/subscribe），
 * 不接触 runtime 内部（公约：控制台与状态机解耦）。React 组件本体以 Playwright
 * 实测代替 node 单测（brief §3 授权的取舍）；纯逻辑（文案映射/排序/封面）在
 * messages.ts / preview.ts，有 node --test 单测。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import type { Translate } from "../../adapter/types.ts";
import {
  DEFAULT_SKIN_ID,
  type SkinInfo,
  type SkinRuntime,
  type SwitchResult,
} from "../../protocol.ts";
import { describeError } from "../runtime/persistence.ts";
import type { SnapshotStore, WritableSnapshotStore } from "./env.ts";
import {
  findSkin,
  formatTemplate,
  sortSkins,
  statusBadgeKey,
  switchResultMessage,
} from "./messages.ts";
import { generatedPreviewSvg, resolvePreviewSvg } from "./preview.ts";

/** 控制台共享环境（mount 期构造；React 组件经 context 消费）。 */
export interface ConsoleEnv {
  /** SkinRuntime 冻结公共面。 */
  runtime: SkinRuntime;
  /** 控制台 ns 的翻译函数（DshLocale.bind，语言跟随宿主）。 */
  t: Translate;
  /** 配色快照 store（theme/change 驱动；mount 方可写）。 */
  scheme: WritableSnapshotStore<"light" | "dark">;
  /** locale revision store（locale/change 驱动；bump 触发重渲染）。 */
  localeRevision: SnapshotStore<number>;
  /** 浮层展开状态 store（侧栏入口 ↔ shell.overlay 共享；双方可写）。 */
  overlayOpen: WritableSnapshotStore<boolean>;
}

interface ConsoleContextValue {
  env: ConsoleEnv;
  scheme: "light" | "dark";
  /** 控制台翻译函数（context 便捷面，= env.t）。 */
  t: Translate;
  /** locale revision（仅作依赖参与重渲染）。 */
  localeRev: number;
}

const ConsoleContext = createContext<ConsoleContextValue | null>(null);

function useConsole(): ConsoleContextValue {
  const value = useContext(ConsoleContext);
  if (!value) {
    throw new Error("console components must render inside ConsoleEnvProvider");
  }
  return value;
}

export function ConsoleEnvProvider({
  env,
  children,
}: {
  env: ConsoleEnv;
  children: ReactNode;
}) {
  const scheme = useSyncExternalStore(env.scheme.subscribe, env.scheme.get);
  const localeRev = useSyncExternalStore(
    env.localeRevision.subscribe,
    env.localeRevision.get,
  );
  const value = useMemo<ConsoleContextValue>(
    () => ({ env, scheme, t: env.t, localeRev }),
    [env, scheme, localeRev],
  );
  return <ConsoleContext.Provider value={value}>{children}</ConsoleContext.Provider>;
}

// ---------------------------------------------------------------------------
// runtime 状态订阅
// ---------------------------------------------------------------------------

interface RuntimeState {
  list: SkinInfo[];
  current: string;
}

function useRuntimeState(runtime: SkinRuntime): RuntimeState {
  const read = useCallback(
    (): RuntimeState => ({ list: runtime.list(), current: runtime.current() }),
    [runtime],
  );
  const [state, setState] = useState<RuntimeState>(read);
  useEffect(() => {
    setState(read());
    return runtime.subscribe(() => setState(read()));
  }, [runtime, read]);
  return state;
}

/** 挂载标记（异步 switchTo 落定后组件可能已卸载）。 */
function useMounted(): RefObject<boolean> {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}

// ---------------------------------------------------------------------------
// 主控制台
// ---------------------------------------------------------------------------

/** 「默认观感」封面：中性渐变（区别于皮肤的确定性彩色渐变）。 */
const DEFAULT_PREVIEW_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" role="img">' +
  '<defs><linearGradient id="usl-default-g" x1="0" y1="0" x2="1" y2="1">' +
  '<stop offset="0" stop-color="#9aa2b1"/><stop offset="1" stop-color="#5b6472"/>' +
  "</linearGradient></defs>" +
  '<rect width="320" height="180" fill="url(#usl-default-g)"/>' +
  '<circle cx="160" cy="90" r="34" fill="rgba(255,255,255,.2)"/>' +
  '<path d="M146 104V76l14-8 14 8v28l-14 8z" fill="rgba(255,255,255,.92)"/>' +
  "</svg>";

export function SkinConsole({ hideHeader = false }: { hideHeader?: boolean }): ReactNode {
  const { env, t } = useConsole();
  const { runtime } = env;
  const { list, current } = useRuntimeState(runtime);
  const mounted = useMounted();

  /** 进行态互斥：值为切换目标（皮肤 id 或 "default"），null = 空闲。 */
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ target: string; message: string } | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const busy = switchingId !== null;
  const sorted = useMemo(() => sortSkins(list), [list]);
  const currentSkin = current === DEFAULT_SKIN_ID ? null : findSkin(list, current);

  const handleSwitch = useCallback(
    async (target: string) => {
      if (switchingId !== null) {
        return; // 进行态互斥（brief §1：切换中显示进行态、防重复点击）
      }
      setSwitchingId(target);
      setFailure(null);
      setWarning(null);
      let result: SwitchResult;
      try {
        result = await runtime.switchTo(target);
      } catch (error) {
        // runtime.switchTo 契约永不 reject（状态机内部兜底）；防御兜底仍如实呈现。
        result = { ok: false, error: describeError(error), rolledBackTo: DEFAULT_SKIN_ID };
      }
      if (!mounted.current) {
        return;
      }
      setSwitchingId(null);
      const message = switchResultMessage(result);
      if (message === null) {
        return;
      }
      if (message.severity === "error") {
        setFailure({ target, message: formatTemplate(t(message.key), message.params) });
      } else {
        setWarning(formatTemplate(t(message.key), message.params));
      }
    },
    [runtime, switchingId, t, mounted],
  );

  const heroPreview = currentSkin ? resolvePreviewSvg(currentSkin) : DEFAULT_PREVIEW_SVG;
  const heroName =
    current === DEFAULT_SKIN_ID ? t("hero.defaultName") : currentSkin?.name ?? current;
  const heroDesc =
    current === DEFAULT_SKIN_ID ? t("hero.defaultDesc") : currentSkin?.description ?? null;

  return (
    <div className="usl-console-body">
      {warning !== null && (
        <div className="usl-banner usl-banner-warning" data-usl-role="warning">
          <span>{warning}</span>
          <button
            type="button"
            className="usl-banner-close"
            aria-label={t("overlay.close")}
            onClick={() => setWarning(null)}
          >
            ×
          </button>
        </div>
      )}

      {!hideHeader && (
        <header className="usl-header">
          <h3 className="usl-title">{t("console.title")}</h3>
          <p className="usl-subtitle">{t("console.subtitle")}</p>
        </header>
      )}

      <div className="usl-hero" data-usl-role="hero" data-usl-current={current}>
        <div className="usl-hero-preview" dangerouslySetInnerHTML={{ __html: heroPreview }} />
        <div className="usl-hero-body">
          <span className="usl-hero-label">{t("hero.currentLabel")}</span>
          <span className="usl-hero-name" data-usl-role="hero-name">
            {heroName}
          </span>
          {heroDesc !== null && <span className="usl-hero-desc">{heroDesc}</span>}
          <div className="usl-hero-actions">
            <button
              type="button"
              className="usl-btn usl-btn-primary"
              disabled={busy || current === DEFAULT_SKIN_ID}
              onClick={() => void handleSwitch(DEFAULT_SKIN_ID)}
              data-usl-role="reset-button"
            >
              {switchingId === DEFAULT_SKIN_ID ? t("action.resetting") : t("action.reset")}
            </button>
          </div>
        </div>
      </div>

      {failure !== null && failure.target === DEFAULT_SKIN_ID && (
        <div className="usl-banner usl-banner-error" data-usl-role="reset-error">
          <span>{failure.message}</span>
          <button
            type="button"
            className="usl-banner-close"
            aria-label={t("overlay.close")}
            onClick={() => setFailure(null)}
          >
            ×
          </button>
        </div>
      )}

      <h4 className="usl-section-title">
        {t("wall.title")}
        <span className="usl-count">{formatTemplate(t("wall.count"), { count: sorted.length })}</span>
      </h4>

      {sorted.length === 0 ? (
        <div className="usl-empty" data-usl-role="empty">
          <p className="usl-empty-title">{t("empty.title")}</p>
          <p>{t("empty.hint")}</p>
        </div>
      ) : (
        <div className="usl-wall" data-usl-role="wall">
          {sorted.map((skin) => (
            <SkinCard
              key={skin.id}
              skin={skin}
              isCurrent={skin.id === current}
              isSwitching={switchingId === skin.id}
              busy={busy}
              failure={failure !== null && failure.target === skin.id ? failure.message : null}
              onSwitch={() => void handleSwitch(skin.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SkinCard({
  skin,
  isCurrent,
  isSwitching,
  busy,
  failure,
  onSwitch,
}: {
  skin: SkinInfo;
  isCurrent: boolean;
  isSwitching: boolean;
  busy: boolean;
  failure: string | null;
  onSwitch: () => void;
}): ReactNode {
  const { t } = useConsole();
  const badgeKey = statusBadgeKey(skin.status, skin.incompatible);
  const badgeClass = `usl-badge is-${badgeKey.replace("badge.", "")}`;
  return (
    <button
      type="button"
      className={`usl-card${isCurrent ? " is-active" : ""}${busy ? " is-busy" : ""}`}
      disabled={busy}
      onClick={onSwitch}
      aria-label={formatTemplate(t("card.switchAria"), { name: skin.name })}
      data-usl-role="skin-card"
      data-usl-skin-id={skin.id}
      data-usl-skin-status={skin.status}
    >
      <span className="usl-card-preview" dangerouslySetInnerHTML={{ __html: resolvePreviewSvg(skin) }} />
      <span className="usl-card-top">
        <span className="usl-card-name">{skin.name}</span>
        <span className={badgeClass} data-usl-role="badge">
          {t(badgeKey)}
        </span>
      </span>
      <span className="usl-card-meta">
        <span>v{skin.version}</span>
        {skin.author !== undefined && (
          <span>{formatTemplate(t("card.by"), { author: skin.author })}</span>
        )}
      </span>
      {isSwitching && (
        <span className="usl-card-meta" data-usl-role="switching">
          <span className="usl-spinner" /> {t("card.switching")}
        </span>
      )}
      {failure !== null && (
        <span className="usl-card-error" data-usl-role="card-error">
          {failure}
        </span>
      )}
      {skin.settingsHint !== undefined && (
        <span className="usl-hint" data-usl-role="settings-hint">
          {formatTemplate(t("hint.settings"), { hint: skin.settingsHint })}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// 槽位组件：设置页分区 / 侧栏入口 / shell.overlay 浮层
// ---------------------------------------------------------------------------

/** settings.section 席位组件。owner props = { close }（本控制台用不到关闭面板语义，忽略）。 */
export function SettingsSection(): ReactNode {
  const { scheme } = useConsole();
  return (
    <div className="usl-console" data-usl-scheme={scheme} data-usl-section="dsh-ui-skin-loader">
      <SkinConsole />
    </div>
  );
}

/** sidebar.footer.action 席位组件。owner props = { wide }（api-notes §6.3）。 */
export function FooterAction({ wide }: { wide?: boolean }): ReactNode {
  const { env, t } = useConsole();
  const open = useSyncExternalStore(env.overlayOpen.subscribe, env.overlayOpen.get);
  return (
    <button
      type="button"
      className="usl-footer-action"
      onClick={() => {
        env.overlayOpen.set(!open);
      }}
      aria-label={t("footer.open")}
      title={t("footer.open")}
      data-usl-role="footer-action"
      data-usl-open={open ? "true" : "false"}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M3 9h18" />
        <path d="M7 14h6" />
      </svg>
      {wide ? t("footer.open") : <span className="usl-visually-hidden">{t("footer.open")}</span>}
    </button>
  );
}

/** shell.overlay 席位组件：展开时渲染控制台浮层（自带遮罩，pointer-events 自持）。 */
export function OverlayHost(): ReactNode {
  const { env, scheme, t } = useConsole();
  const open = useSyncExternalStore(env.overlayOpen.subscribe, env.overlayOpen.get);
  if (!open) {
    return null;
  }
  const close = () => env.overlayOpen.set(false);
  return (
    <div className="usl-overlay-root" data-usl-role="overlay-root">
      <button
        type="button"
        className="usl-overlay-backdrop"
        onClick={close}
        tabIndex={-1}
        aria-hidden="true"
      />
      <div
        className="usl-overlay-panel usl-console"
        data-usl-scheme={scheme}
        role="dialog"
        aria-label={t("console.title")}
        data-usl-role="overlay-panel"
      >
        <div className="usl-overlay-header">
          <h3 className="usl-title">{t("console.title")}</h3>
          <button type="button" className="usl-btn" onClick={close} data-usl-role="overlay-close">
            {t("overlay.close")}
          </button>
        </div>
        <SkinConsole hideHeader />
      </div>
    </div>
  );
}

/** 测试/文档辅助：由 id 生成确定性封面（与卡片生成同源）。 */
export { generatedPreviewSvg };
