/**
 * 测试专用（T2.4）：api-notes §3.1 形态的 `__ModuleLoader__` facade fake。
 *
 * 仅供单测模拟上游 boot 环境（queue 模式：load 收集 registration，不执行 factory）。
 * 放在 adapter/ 内是因为「上游私有全局」的形态知识只允许存在于本层
 * （eslint 隔离规则）——生产代码一律经 getModuleLoader()（dsh-0.1.7.ts）。
 */

export interface TestBundleRegistration {
  id: string;
  factory: (require: unknown) => Record<string, unknown>;
}

export interface InstalledTestModuleLoader {
  registrations: TestBundleRegistration[];
  /** 恢复先前的全局值（测试清理用）。 */
  uninstall(): void;
}

export function installTestModuleLoader(): InstalledTestModuleLoader {
  const registrations: TestBundleRegistration[] = [];
  const scope = globalThis as { __ModuleLoader__?: unknown };
  const previous = scope.__ModuleLoader__;
  scope.__ModuleLoader__ = {
    load(registration: TestBundleRegistration): void {
      registrations.push(registration);
    },
  };
  return {
    registrations,
    uninstall() {
      scope.__ModuleLoader__ = previous;
    },
  };
}
