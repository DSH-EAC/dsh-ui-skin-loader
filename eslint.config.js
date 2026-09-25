import eslintJs from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/node_modules/", "**/dist/", "**/.verify/", "**/.superpowers/"],
  },
  {
    // Task 10（皮肤迁移）：vendored 上游皮肤产物是逐字节迁移的第三方构件
    // （ BSD-3-Clause，来源与改动记录在包内 THIRD-PARTY-NOTICES.md 与文件头），
    // 不是本仓作者代码——不作为 lint 对象；其内容不变量由各皮肤包的
    // src/index.test.ts 静态锁定。
    ignores: ["packages/skins/*/src/vendor/**"],
  },
  eslintJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // T2.3 DSH 上游隔离（机械强制）：
    // - `@deepseek-ai/*` 包导入只允许出现在 packages/loader/src/adapter/**（adapter 是唯一
    //   允许编码上游调用形态的隔离层，签名以 docs/api-notes.md 为唯一权威）。
    //   动态 import() 与静态导入共用同一份受限说明符清单（见下方 ImportExpression 选择器）。
    // - 上游私有全局 `__ModuleLoader__` / `__DSH_BOOT__` 同样只在 adapter 内可引用
    //   （Identifier 选择器同时覆盖裸全局、成员访问与属性键）。
    // - glob 含 .tsx：T2.5/T2.6 是 React 工作（api-notes §6.2 组件框架就是 React），
    //   隔离规则必须覆盖 .tsx。
    // - Controller R11 裁定：标准 Web 平台 API（document/window 浏览器全局/CSSOM/customElements）
    //   不算上游耦合，GUI 代码可自由使用——本规则刻意不限制它们；R5 红线约束的
    //   "上游私有 DOM 非 ABI" 由 adapter 的语义面承担，不在 lint 层重复。
    files: ["packages/**/src/**/*.{ts,tsx}"],
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
        // 动态 import() 向量（eslint 10 / ts-estree 的 ImportExpression 节点，含 await import）。
        // esquery 属性正则不支持转义 `\/`，子路径用「scope 后紧跟非包名字符」表达
        // `@deepseek-ai/` 前缀——`@deepseek-ai-evil` 等其它 scope 不会误伤（已用 esquery.match 验证）。
        {
          selector: "ImportExpression[source.value='@deepseek-ai']",
          message:
            "DSH 上游 API 只能在 packages/loader/src/adapter/ 内引用（T2.3 隔离层；签名权威：docs/api-notes.md）。",
        },
        {
          selector:
            "ImportExpression[source.value=/^@deepseek-ai[^A-Za-z0-9._-]/]",
          message:
            "DSH 上游 API 只能在 packages/loader/src/adapter/ 内引用（T2.3 隔离层；签名权威：docs/api-notes.md）。",
        },
      ],
    },
  },
);
