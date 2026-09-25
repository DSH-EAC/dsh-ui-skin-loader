/**
 * @dsh-eac/skin-aurora 可安装产物构建（形态沿加载器包 T2.5 先例：esbuild-wasm，
 * 开发机与 CI 同一路径）。
 *
 * 产出（api-notes §1 骨架）：
 * - lib/index.js   host 半：ESM bundle（src/index.ts）。
 *     与外部开发者的唯一差异点：本仓库隔离纪律禁止源码 import `@deepseek-ai/*`，
 *     schemastery（Config schema 的构造库）由 banner 注入 import、footer 接上
 *     `export const Config = createConfigSchema(Schema)`——运行时形态与手写一致
 *     （dependencies 已声明，安装后由宿主 profile 树解析）。
 * - lib/client.js  client 半：CJS bundle 包在 DSH 契约外壳里（与加载器包同形）：
 *
 *        window.__ModuleLoader__.load({
 *          id: "@dsh-eac/skin-aurora",
 *          factory: (require) => { var module = { exports: {} }; … return module.exports; },
 *        });
 *
 *   external 全部是 baseline 模块表词（api-notes §3.3：react / react/jsx-runtime /
 *   @deepseek-ai/*），零 dsh.client.external 声明。
 */

import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import esbuild from "esbuild-wasm";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const libDir = path.join(packageDir, "lib");

/** client bundle 的 graph 行 id（== 包名，api-notes §1.4/§3.2）。 */
const CLIENT_BUNDLE_ID = "@dsh-eac/skin-aurora";

/** baseline 模块表词 + 上游包名（api-notes §3.3）：运行时由宿主模块表解析。 */
const CLIENT_EXTERNAL = [
  "react",
  "react/jsx-runtime",
  "react-dom",
  "react-dom/client",
  "@deepseek-ai/*",
];

const CLIENT_BANNER = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(CLIENT_BUNDLE_ID)},
  factory: (require) => {
    var module = { exports: {} };
`;

const CLIENT_FOOTER = `
    return module.exports;
  },
});
`;

// host 半的 schemastery 注入（见文件头说明）：源码零 @deepseek-ai 导入，
// 产物运行时形态与外部开发者手写完全一致。
const HOST_BANNER = `import Schema from "@deepseek-ai/schemastery";\n`;
const HOST_FOOTER = `\nexport const Config = createConfigSchema(Schema);\n`;

await rm(libDir, { recursive: true, force: true });
await mkdir(libDir, { recursive: true });

// ---- host 半（Node ESM；schemastery 是真实 dependency，保持 import 形态）
await esbuild.build({
  entryPoints: [path.join(packageDir, "src/index.ts")],
  outfile: path.join(libDir, "index.js"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node24",
  external: ["@deepseek-ai/*"],
  banner: { js: HOST_BANNER },
  footer: { js: HOST_FOOTER },
  sourcemap: false,
  logLevel: "warning",
});

// ---- client 半（浏览器 CJS in factory shell；JSX → react/jsx-runtime）
await esbuild.build({
  entryPoints: [path.join(packageDir, "src/client/index.tsx")],
  outfile: path.join(libDir, "client.js"),
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: "es2023",
  jsx: "automatic",
  external: CLIENT_EXTERNAL,
  define: { "process.env.NODE_ENV": '"production"' },
  banner: { js: CLIENT_BANNER },
  footer: { js: CLIENT_FOOTER },
  sourcemap: false,
  logLevel: "warning",
});

console.log("built lib/index.js + lib/client.js");
