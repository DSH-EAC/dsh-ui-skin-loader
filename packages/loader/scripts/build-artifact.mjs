/**
 * 可安装产物构建脚本（T2.5）。
 *
 * 产出（api-notes §1 骨架：lib/ 产物 + dsh 字段核对——包 manifest 已就位）：
 * - lib/index.js   host 半：ESM bundle（src/index.ts；@deepseek-ai/schemastery 保持
 *                  external——真实 dependency，安装后由 profile 树解析）；
 * - lib/client.js  client 半：CJS bundle 包在 DSH 契约外壳里——
 *
 *        window.__ModuleLoader__.load({
 *          id: "@dsh-eac/ui-skin-loader",
 *          factory: (require) => {
 *            var module = { exports: {} };
 *            <bundle 体；exports.inject / exports.apply 经 module.exports 透出>
 *            return module.exports;
 *          },
 *        });
 *
 *   外壳与 shipped 官方 bundle（$NM/dsh-cordis-client-runner/lib/client.js）逐字段同形；
 *   factory 形参 require 是模块系统注入的模块表 require（baseline 词 react /
 *   react/jsx-runtime / react-dom 可直接要，api-notes §3.3），bundle 体内对 external
 *   的引用都编译为该形参的调用。
 *
 * 打包器：esbuild-wasm（纯 wasm，无平台二进制/无构建脚本——开发机与 CI 同一路径）。
 * 注：外壳字符串是「打包边界」的产出物，不是源码运行期调用；运行期 facade 投影
 * （getModuleLoader）仍在 adapter，隔离纪律不被破坏。
 */

import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import esbuild from "esbuild-wasm";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const libDir = path.join(packageDir, "lib");

/** client bundle 的 graph 行 id（== 包名，api-notes §1.4/§3.2）。 */
const CLIENT_BUNDLE_ID = "@dsh-eac/ui-skin-loader";

/** baseline 模块表词 + 上游包名（api-notes §3.3）：全部 external，运行时由宿主模块表解析。 */
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

// ---- host 半（Node ESM；schemastery 是真实 dependency，保持 import 形态）
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
  entryPoints: [path.join(packageDir, "src/client/index.ts")],
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
