/**
 * 极光之夜的 React 组件（client 半）。
 *
 * 两个席位组件，都只渲染**自有命名空间**的 DOM（data-skn-aurora-* / .skn-aurora-*，
 * 样式来自皮肤自有 style 节点——见 background.ts）：
 * - `AuroraSettingsSection`：settings.section 席位——皮肤自定义设置 UI（背景图 URL），
 *   经宿主 configForms 机制读写皮肤自己的设置命名空间（公约 §4.2「皮肤设置自治」；
 *   快照读取用 useSyncExternalStore——上游 getSnapshot 稳定引用，uSES 安全）。
 * - `AuroraBackdrop`：shell.overlay 席位——极光氛围层（装饰性 SVG 飘带；
 *   click-through 由皮肤样式保证；SVG 渐变 id 全部带 skn-aurora 前缀防文档级冲突）。
 *
 * 错误处理形态：非法 URL 在**皮肤自己的 UI 里**给出行内错误（settings.ts 校验）；
 * 写入被宿主拒绝时如实显示，不谎报成功。
 */

import { useState, useSyncExternalStore, type ReactElement } from "react";

import type { SkinSettingsForm, Translate } from "../context.ts";
import { CSS_PREFIX } from "../identity.ts";
import { validateBackgroundUrl } from "../settings.ts";

/** 极光氛围层：宿主 shell.overlay 席位渲染的装饰层（aria-hidden，不承载交互）。 */
export function AuroraBackdrop(): ReactElement {
  return (
    <div data-skn-aurora-backdrop="" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1440 900">
        <defs>
          <linearGradient id={`${CSS_PREFIX}-ribbon-a`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#39d0a4" stopOpacity="0" />
            <stop offset=".45" stopColor="#4f8dff" stopOpacity=".55" />
            <stop offset="1" stopColor="#a06bff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${CSS_PREFIX}-ribbon-b`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#a06bff" stopOpacity="0" />
            <stop offset=".5" stopColor="#4f8dff" stopOpacity=".38" />
            <stop offset="1" stopColor="#39d0a4" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M-80 620 C 240 380, 520 700, 860 460 S 1340 380, 1560 520"
          fill="none"
          stroke={`url(#${CSS_PREFIX}-ribbon-a)`}
          strokeWidth="150"
          strokeLinecap="round"
        />
        <path
          d="M-80 760 C 300 560, 640 820, 1000 600 S 1400 540, 1560 640"
          fill="none"
          stroke={`url(#${CSS_PREFIX}-ribbon-b)`}
          strokeWidth="90"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/** 极光设置分区的 props（form/t 由 session 在席位注册时绑定）。 */
export interface AuroraSettingsSectionProps {
  form: SkinSettingsForm;
  t: Translate;
}

/** 校验失败原因 → 文案键。 */
function errorKey(reason: "not-url" | "unsupported-scheme"): string {
  return reason === "not-url" ? "settings.error.not-url" : "settings.error.unsupported-scheme";
}

/** 从快照安全读出当前背景 URL 字符串（快照 value 是 unknown）。 */
function currentUrl(form: SkinSettingsForm): string {
  const value = form.getSnapshot().value;
  if (typeof value !== "object" || value === null) return "";
  const raw = (value as { backgroundUrl?: unknown }).backgroundUrl;
  return typeof raw === "string" ? raw : "";
}

/**
 * 「极光之夜 · 背景」设置分区（settings.section 席位，激活后出现在宿主设置面板）。
 *
 * 流程：输入 URL → Apply 前本地校验（行内错误，不写入）→ 校验通过经
 * `form.set` 排队写宿主设置文档 → 皮肤 session 的订阅即时重算背景样式。
 * Reset = 写入空值（内置渐变）。
 */
export function AuroraSettingsSection(props: AuroraSettingsSectionProps): ReactElement {
  const { form, t } = props;
  // 上游 ConfigForm 的方法必须以方法调用形态触达（form.getSnapshot() / form.subscribe(cb)）——
  // 直接传方法引用会丢失 receiver（this undefined，实机报 "Cannot read properties of
  // undefined (reading 'store')"）。uSES 的两个实参都用箭头包装。
  const snapshot = useSyncExternalStore(
    (onStoreChange) => form.subscribe(onStoreChange),
    () => form.getSnapshot(),
  );
  const [input, setInput] = useState<string>(() => currentUrl(form));
  const [error, setError] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [pending, setPending] = useState<boolean>(false);

  const writable = snapshot.writable;

  const apply = async (raw: string): Promise<void> => {
    setStatus("");
    if (raw.trim() === "") {
      setError(t("settings.error.empty-input"));
      return;
    }
    const validated = validateBackgroundUrl(raw);
    if (!validated.ok) {
      setError(t(errorKey(validated.reason)));
      return;
    }
    setError("");
    setPending(true);
    try {
      const accepted = await form.set("backgroundUrl", validated.value);
      if (accepted) {
        setInput(validated.value);
        setStatus(t("settings.applied"));
      } else {
        setError(t("settings.write-refused"));
      }
    } finally {
      setPending(false);
    }
  };

  const reset = async (): Promise<void> => {
    setError("");
    setStatus("");
    setPending(true);
    try {
      const accepted = await form.set("backgroundUrl", "");
      if (accepted) {
        setInput("");
        setStatus(t("settings.applied"));
      } else {
        setError(t("settings.write-refused"));
      }
    } finally {
      setPending(false);
    }
  };

  if (snapshot.status !== "ready") {
    return (
      <div data-skn-aurora-settings="">
        <h3>{t("settings.title")}</h3>
        <p>{t("settings.unavailable", { status: snapshot.status })}</p>
      </div>
    );
  }

  return (
    <div data-skn-aurora-settings="">
      <h3>{t("settings.title")}</h3>
      <p>{t("settings.desc")}</p>
      <label className={`${CSS_PREFIX}-label`} htmlFor={`${CSS_PREFIX}-bg-input`}>
        {t("settings.label")}
        {!writable && ` (${t("settings.readonly")})`}
      </label>
      <div className={`${CSS_PREFIX}-row`}>
        <input
          id={`${CSS_PREFIX}-bg-input`}
          type="url"
          value={input}
          placeholder={t("settings.placeholder")}
          disabled={!writable || pending}
          onChange={(event) => {
            setInput(event.target.value);
            setError("");
            setStatus("");
          }}
        />
        <button type="button" disabled={!writable || pending} onClick={() => void apply(input)}>
          {t("settings.apply")}
        </button>
        <button type="button" disabled={!writable || pending} onClick={() => void reset()}>
          {t("settings.reset")}
        </button>
      </div>
      <div className={`${CSS_PREFIX}-error`} data-skn-aurora-error={error !== "" ? "true" : undefined} role="alert">
        {error}
      </div>
      <div className={`${CSS_PREFIX}-status`} data-skn-aurora-status={status !== "" ? "true" : undefined}>
        {status}
      </div>
    </div>
  );
}
