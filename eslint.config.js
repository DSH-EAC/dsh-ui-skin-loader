import eslintJs from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/node_modules/", "**/dist/", "**/.verify/", "**/.superpowers/"],
  },
  eslintJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // T2.3 DSH 上游隔离（机械强制）：
    // - `@deepseek-ai/*` 包导入只允许出现在 packages/loader/src/adapter/**（adapter 是唯一
    //   允许编码上游调用形态的隔离层，签名以 docs/api-notes.md 为唯一权威）。
    // - 上游私有全局 `__ModuleLoader__` / `__DSH_BOOT__` 同样只在 adapter 内可引用
    //   （Identifier 选择器同时覆盖裸全局、成员访问与属性键）。
    // - Controller R11 裁定：标准 Web 平台 API（document/window 浏览器全局/CSSOM/customElements）
    //   不算上游耦合，GUI 代码可自由使用——本规则刻意不限制它们；R5 红线约束的
    //   "上游私有 DOM 非 ABI" 由 adapter 的语义面承担，不在 lint 层重复。
    files: ["packages/**/src/**/*.ts"],
    ignores: ["packages/loader/src/adapter/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@deepseek-ai", "@deepseek-ai/**"],
              message:
                "DSH 上游 API 只能在 packages/loader/src/adapter/ 内引用（T2.3 隔离层；签名权威：docs/api-notes.md）。",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "Identifier[name='__ModuleLoader__']",
          message:
            "上游私有全局 __ModuleLoader__ 只能在 packages/loader/src/adapter/ 内引用（T2.3 隔离层）。",
        },
        {
          selector: "Identifier[name='__DSH_BOOT__']",
          message:
            "上游私有全局 __DSH_BOOT__ 只能在 packages/loader/src/adapter/ 内引用（T2.3 隔离层）。",
        },
      ],
    },
  },
);
