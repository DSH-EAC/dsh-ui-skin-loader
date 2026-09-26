# @dsh-eac/skin-whale-song 「鲸吟」

**深海氛围背景 · 冰蓝海洋调色板 · 金色细线点缀**——自
`DSH-Desktop-EAC` 迁移进本仓的公约化皮肤（Task 10 / Phase3A）。观感与行为
内容**原样迁移**自 dsh-web-ui 的预构建皮肤包（BSD-3-Clause © zhu1090093659，
经 DSH-Desktop-EAC@`26841f5` 分发），执行骨架重写为公约形态
（activate/deactivate）。来源与许可全文见 `THIRD-PARTY-NOTICES.md`。

## 原皮肤观感

无文字纯氛围背景：冰蓝水彩式天光与海面（R13 裁定后为**非具象**的渐变处理：
天光晕染 + 钴蓝辉光 + 深海军蓝海脚 + 金色细线点彩，取自原皮肤色板），垫在
半透明面板之下，遮罩随亮/暗主题实时切换（暗色变体为深海夜航调），冰蓝/浅青/
深海军蓝/钴蓝冷色体系重映射到全部 dsh token。原上游背景画为具象人物插画
（蓝发女神与鲸群），已按 controller R13 裁定移除替换（见下）。

## 包结构（与 aurora/inkwash 先例对称）

```text
packages/skins/whale-song/
  package.json            清单：dsh.skin（公约 §3 唯一声明）+ dsh.client + dsh.bundle.patch
  cordis.patch.yml        bundle 补丁层；行 id dsh-eac-skin-whale-song（仅 entry id，无设置命名空间）
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
      session.test.ts     会话单测（fake 环境：R1 登记/反登记、内联样式 round-trip 还原、
                          亮暗遮罩切换、deactivate 幂等、abort、fiber 安全网）
    index.test.ts         纯逻辑单测（身份/预览/vendored 内容不变量）
```

## 迁移（公约化改造）说明

上游形态是「常驻生效」的 cordis client 插件：模块加载即注入样式表、
`apply(ctx)` 立即改写 body 内联背景并常驻（`ctx.effect` 只登记 disposer，
插件卸载才撤销）。公约化改造（公约 §5 R1/R8）：

| 上游行为 | 公约形态 |
| --- | --- |
| 模块顶层执行 style 注入（未激活先执行） | 移入 `apply()` 顶部——import 本模块零副作用（R1） |
| `apply(ctx)` 立即改写 body 内联背景/挂 favicon/起观察器 | 全部收进 `activate`（session.ts 适配层调用 vendored apply） |
| `ctx.effect(disposer)` 由 cordis 卸载驱动 | disposer 进会话账本，`deactivate`/abort/fiber dispose 三路汇入幂等 teardown（R8）；上游自身的 body 内联样式 round-trip 还原语义原样保留 |
| 样式节点随插件常驻、从不移除 | teardown 按自有 `data-plugin` 标记清扫自产 style 节点（§4.3「退出后不可观测」的补齐） |
| 具象背景画（人物插画 data URI，R13 裁定） | **移除**，替换为原色板派生的非具象水彩式 CSS 处理（`BACKDROP_TREATMENT`）；favicon（宿主自有品牌）按同一裁定保留 |

vendored 文件的全部改动（去壳、上述 S3 移位、R13 素材替换、`export { apply }`）
逐条记录在 `src/vendor/dsh-web-ui-client.js` 文件头；除这些外与上游产物逐字节
一致（含 esbuild region 标记与原注释）。favicon 以 data URI 随 bundle 原样
携带。上游 CSS-module 哈希类名（如有）作为观感内容原样保留，CSS 文本与
类名映射表成对迁移、自洽封闭，不构成对上游构建产物的运行时依赖（R5）。

说明：上游背景层读取可选变量 `--dsw-skin-scrim`（原皮肤中心的背景遮罩控制
通道）；本皮肤不提供该控制面，变量缺席时其默认值 0 生效——行为与上游一致
（优雅降级）。

## 接线形态（同先例）

client 半顶层 `exports.inject = ["uiSkinLoader"]`；`apply` 只做 registerSkin
登记 + 反登记包进 `ctx.effect`（R1：登记 ≠ 激活）。本皮肤不提供自定义设置
（公约 §4.2：不提供也不被区别对待；inkwash 先例同款）。
S4 验收结论（Task 11 实机）：本皮肤无自定义设置项，S4 不适用——上游 apply 无任何设置类逻辑（--dsw-skin-scrim 是上游皮肤中心的遗留读通道，本皮肤只读且缺省 0，不构成设置面）；控制台卡片无 settingsHint，实机证据见 docs/verification.md「Phase 3 迁移皮肤验收」。


## 构建

```bash
pnpm --filter @dsh-eac/skin-whale-song build   # tsc --noEmit + esbuild-wasm → lib/
pnpm --filter @dsh-eac/skin-whale-song test    # node --test
```

## 预览图同步说明

`package.json` 的 `dsh.skin.preview` 与 `src/preview.ts` 的
`WHALE_SONG_PREVIEW_SVG` 是同一份 SVG（单行）。修改 `preview.ts` 后请同步
`package.json`。
