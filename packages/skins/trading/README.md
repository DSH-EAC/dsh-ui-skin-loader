# @dsh-eac/skin-trading 「交易终端」

**实时行情跑马灯 · 交易时段状态栏 · 红涨绿跌配色**——自 `DSH-Desktop-EAC`
迁移进本仓的公约化皮肤（Task 10 / Phase3A）。观感与行为内容**原样迁移**
自 dsh-web-ui 的预构建皮肤包（BSD-3-Clause © zhu1090093659，经
DSH-Desktop-EAC@`26841f5` 分发），执行骨架重写为公约形态（activate/deactivate）。
来源与许可全文见 `THIRD-PARTY-NOTICES.md`。

## 原皮肤观感

顶栏滚动 A股/港股/美股/指数/加密/外汇报价（装 fun-ticker 后跟随自选列表），
状态栏展示长桥行情快照与 A股/港股/美股交易时段，红涨绿跌、等宽字体行情——
写代码也像盯盘。行情缺席时优雅降级为短横占位。

## 包结构（与 aurora/inkwash 先例对称）

```text
packages/skins/trading/
  package.json            清单：dsh.skin（公约 §3 唯一声明）+ dsh.client + dsh.bundle.patch
  cordis.patch.yml        bundle 补丁层；行 id dsh-eac-skin-trading（仅 entry id，无设置命名空间）
  scripts/build-artifact.mjs  可安装产物构建（esbuild-wasm → lib/index.js + lib/client.js）
  src/
    identity.ts           身份常量（公约 §3 id/名称/版本 + CSS 前缀）
    markers.ts            被迁移上游的自有标记（body 激活标记 / style 节点标记；清扫与测试共用）
    context.ts            宿主 API 的本地结构类型（零导入；含 vendored ctx 的适配面）
    index.ts              host 半：no-op apply（inkwash 先例同款，无设置）
    preview.ts            卡片封面 SVG（原皮肤色板取色，零位图资产）
    vendor/
      dsh-web-ui-client.js    上游 client bundle 原样迁移（去壳 + S3 改造，见文件头）
      dsh-web-ui-client.d.ts  vendored 入口的最小声明面
    client/
      index.ts            bundle 入口：exports.inject + exports.apply（只做登记，R1）
      session.ts          激活会话：公约适配层（上游 apply 的副作用全部收进 activate；
                          disposer 账本逆序幂等 teardown + §4.3 样式清扫补齐）
      session.test.ts     会话单测（fake 环境：R1 登记/反登记、deactivate 幂等、abort、fiber 安全网）
    index.test.ts         纯逻辑单测（身份/预览/vendored 内容不变量）
```

## 迁移（公约化改造）说明

上游形态是「常驻生效」的 cordis client 插件：模块加载即注入样式表、
`apply(ctx)` 立即挂载全部 chrome 并常驻（`ctx.effect` 只登记 disposer，
插件卸载才撤销）。公约化改造（公约 §5 R1/R8）：

| 上游行为 | 公约形态 |
| --- | --- |
| 模块顶层执行 style 注入（未激活先执行） | 移入 `apply()` 顶部——import 本模块零副作用（R1） |
| `apply(ctx)` 立即挂载 DOM/定时器/favicon | 全部收进 `activate`（session.ts 适配层调用 vendored apply） |
| `ctx.effect(disposer)` 由 cordis 卸载驱动 | disposer 进会话账本，`deactivate`/abort/fiber dispose 三路汇入幂等 teardown（R8） |
| 样式节点随插件常驻、从不移除 | teardown 按自有 `data-plugin` 标记清扫自产 style 节点（§4.3「退出后不可观测」的补齐） |
| `ctx.get("connection"/"workspaces")` 惰性定位 | best-effort 镜像（缺席即上游自带的降级路径） |

vendored 文件的全部改动（去壳、上述 S3 移位、`export { apply }`）逐条记录在
`src/vendor/dsh-web-ui-client.js` 文件头；除这些外与上游产物逐字节一致
（含 esbuild region 标记与原注释）。上游 CSS-module 哈希类名（`Ra1MMG_*`）
作为观感内容原样保留——CSS 文本与类名映射表成对迁移、自洽封闭，不构成对
上游构建产物的运行时依赖（R5）。

已知上游行为（保持迁移保真，未改）：行情 JSONP script 标签在 deactivate 后
由其自身 8s 超时自清理；`disposed` 标志保证不再写任何状态。实机验收（S4）
时关注此项。

## 接线形态（同先例）

client 半顶层 `exports.inject = ["uiSkinLoader"]`；`apply` 只做 registerSkin
登记 + 反登记包进 `ctx.effect`（R1：登记 ≠ 激活）。本皮肤不提供自定义设置
（公约 §4.2：不提供也不被区别对待；inkwash 先例同款）。

## 构建

```bash
pnpm --filter @dsh-eac/skin-trading build   # tsc --noEmit + esbuild-wasm → lib/
pnpm --filter @dsh-eac/skin-trading test    # node --test
```

## 预览图同步说明

`package.json` 的 `dsh.skin.preview` 与 `src/preview.ts` 的 `TRADING_PREVIEW_SVG`
是同一份 SVG（单行）。修改 `preview.ts` 后请同步 `package.json`。
