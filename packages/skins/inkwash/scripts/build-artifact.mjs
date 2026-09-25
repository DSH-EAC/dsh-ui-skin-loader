/**
 * @dsh-eac/skin-inkwash 可安装产物构建（形态沿加载器包 T2.5 先例：esbuild-wasm）。
 *
 * 与 aurora 的构建脚本同构，但更简单：inkwash 无 Config schema，host 半不需要
 * schemastery 注入（无 banner/footer）。client 半外壳与加载器/aurora 同形：
 *
 *        window.__ModuleLoader__.load({
 *          id: "@dsh-eac/skin-inkwash",
 *          factory: (require) => { var module = { exports: {} }; … return module.exports; },
 *        });
 */

import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import esbuild from "esbuild-wasm";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const libDir = path.join(packageDir, "lib");

/** client bundle 的 graph 行 id（== 包名，api-notes §1.4/§3.2）。 */
const CLIENT_BUNDLE_ID = "@dsh-eac/skin-inkwash";

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

await rm(libDir, { recursive: true, force: true });
await mkdir(libDir, { recursive: true });

// ---- host 半（Node ESM；no-op apply，无 Config schema）
await esbuild.build({
  entryPoints: [path.join(packageDir, "src/index.ts")],
  outfile: path.join(libDir, "index.js"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node24",
  external: ["@deepseek-ai/*"],
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
