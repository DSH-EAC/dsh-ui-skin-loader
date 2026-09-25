# dsh-ui-skin-loader

[![CI](https://github.com/DSH-EAC/dsh-ui-skin-loader/actions/workflows/ci.yml/badge.svg)](https://github.com/DSH-EAC/dsh-ui-skin-loader/actions/workflows/ci.yml)

> **开发中** —— 加载器核心运行时（登记 / 互斥切换 / 持久化 / 恢复）已实现；控制台 GUI 与内置皮肤皮肤包在后续任务中。

DSH UI 皮肤加载器：弱约束公约 [`dsh.ecosystem.ui-skin-loader/v1`](https://github.com/DSH-EAC/dsh-ui-skin-loader-convention) 的参考实现加载器，并附带内置皮肤。

## 仓库结构

```text
packages/
  loader/           @dsh-eac/ui-skin-loader   加载器（骨架占位）
  skins/
    aurora/         @dsh-eac/skin-aurora      内置皮肤（骨架占位）
    inkwash/        @dsh-eac/skin-inkwash     内置皮肤（骨架占位）
```

## 开发

环境要求：Node >= 22（CI 使用 24）、pnpm 11。

```bash
pnpm install        # 安装依赖并生成 lockfile
pnpm lint           # ESLint（typescript-eslint flat config，递归全部包）
pnpm test           # node --test 直接运行各包 .test.ts（递归全部包）
pnpm build          # 当前为 tsc --noEmit 占位，待有打包需求再演进
pnpm typecheck      # tsc --noEmit 类型检查（递归全部包）
```

## 运行时策略

- TypeScript 源码由 **Node 24 原生 type-stripping** 直接执行：`.ts` 文件不经编译产物，`node --test` 直接运行测试。
- 因此源码只允许可擦除 TS 语法：**禁用 enum / namespace / 装饰器 / 参数属性**。
- `tsc --noEmit` 仅做类型检查，不参与运行。

## 皮肤开发者接线（T2.8 完善）

皮肤 client bundle 顶层导出 cordis 服务注入与 apply；在 `ctx.effect` 中向加载器登记
`SkinRegistration` 并返回其反登记（fiber 卸载自动撤销登记）：

```ts
// 皮肤 client bundle 顶层
export const inject = ["uiSkinLoader"]; // 还需要 slots/theme/locale 等服务时自行追加

export function apply(ctx) {
  return ctx.effect(() =>
    ctx.uiSkinLoader.registerSkin({
      apiVersion: "dsh.ecosystem.ui-skin-loader/v1",
      id: "example.aurora", // 公约 §3：[a-z0-9]+(?:[.-][a-z0-9]+)*
      name: "极光之夜",
      version: "1.0.0",
      activate(skinCtx) { /* 自此才允许可见副作用；经 skinCtx.slots 登记 */ },
      deactivate() { /* 撤销 activate 以来的全部副作用 */ },
    }),
  );
}
```

- **登记 ≠ 激活**：`registerSkin` 只入发现表，零副作用；激活只经加载器的
  `switchTo` 状态机（公约 §4）。
- 完整 `SkinRegistration` / `SkinContext` 契约见 `packages/loader/src/protocol.ts`
  （公约 §3/§4/§6 的冻结面）。

## 公约

- 公约仓库：<https://github.com/DSH-EAC/dsh-ui-skin-loader-convention>
- 本仓库是该公约的参考实现加载器；皮肤包与加载器的接缝以公约为准。

## License

[MIT](./LICENSE)
