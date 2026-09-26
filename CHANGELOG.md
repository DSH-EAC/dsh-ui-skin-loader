# Changelog

本项目的全部显著改动记录于此。版本遵循 [SemVer 2.0.0](https://semver.org/lang/zh-CN/)。

## 1.0.0 — 2026-09-26

首个发布版本：弱约束公约 [`dsh.ecosystem.ui-skin-loader/v1`](https://github.com/DSH-EAC/dsh-ui-skin-loader-convention) 的参考实现加载器与五款皮肤包（2 款内置示例 + 3 款公约化迁移）。

### 加载器（@dsh-eac/ui-skin-loader）

- **adapter 层**：对宿主 `@deepseek-ai/dsh@0.1.7-rc.2` 公开 API 的实机核对与适配（client bundle 注入、槽位、主题 token、configForms、locale、插件启停粒度），全部结论以 `docs/api-notes.md` 实测定案为准。
- **SkinRuntime**：皮肤发现登记、全局互斥切换状态机（激活前先彻底关闭旧皮肤）、提交后落盘的持久化与跨重启恢复重放、故障隔离（激活抛错回滚 / deactivate 超时标记疑似残留并如实呈现）、跨标签页同步收敛。
- **换肤控制台**：settings 分区 + 侧栏入口 + shell 浮层三席位，亮暗双案自适应（跟随宿主 token，皮肤覆盖时自动跟随其色板），主按钮前景色按 accent 实际亮度推导（WCAG AA）；故障与疑似残留徽标、行内错误原文呈现。

### 内置示例皮肤（参考实现）

- **@dsh-eac/skin-aurora「极光之夜」1.0.0**：深色玻璃拟态 + 极光渐变背景，带自定义设置面（背景图 / 透明度），含卡片封面 SVG 与预览。
- **@dsh-eac/skin-inkwash「水墨青烟」1.0.0**：浅色纸质感 + 水墨氛围，无设置面的最小示例（与 aurora 共同构成"有/无设置"两个先例）。

### 迁移皮肤（观感内容原样迁移，执行骨架公约化）

三款皮肤观感与行为内容**原样迁移**自第三方皮肤工程 dsh-web-ui（`@linxin666/dsh-client-ui-skin-*` 0.1.11，BSD-3-Clause © zhu1090093659），均经 DSH-Desktop-EAC@`26841f5` 取材；工程骨架（清单 / 公约接线 / 会话适配 / 构建 / 测试）为本仓原始代码。来源与许可全文随包落档于各包 `THIRD-PARTY-NOTICES.md`。

- **@dsh-eac/skin-trading「交易终端」1.0.0**：实时行情跑马灯 + 交易时段状态栏 + 红涨绿跌配色（取材 tree `f0d514e`）。
- **@dsh-eac/skin-dragon-heir「龙的传人」1.0.0**：不屈龙魂 / 万里长城双主题 + 朱砂龙印（取材 tree `ccbca11`）。
- **@dsh-eac/skin-whale-song「鲸吟」1.0.0**：深海氛围背景 + 冰蓝海洋调色板；原上游具象人物插画（蓝发女神与鲸群）已按 IP 处理裁定（R13）移除，替换为原色板派生的非具象水彩式 CSS 处理（取材 tree `6716abe`）。

### 验证战役中发现并修复的真实缺陷

- **跨标签页同步在真实镜像回源时序下永不收敛**（V7 首跑暴露）：宿主设置事件为异步回源，事件到达时本地快照尚为旧值，单一事件触发源会幂等跳过后永不重放。修复：设置存储暴露 `onChange`，运行时把本命名空间快照变更接为收敛检查的第二触发源。
- **迁移皮肤 activate 半途抛错泄漏半套副作用**（F11.1，Phase 3 故障抽查暴露）：激活改为事务化——apply 前快照皮肤自有锚点、注册差集清扫兜底 disposer、失败路径还原标题与裸定时器；三款迁移皮肤对称修复。

### 验证

- 验证矩阵 **V1-V11**（干净 boot / tarball 安装链 / 单元测试 / 控制台渲染 / 热切换零残留 / 持久化 / 跨标签页 / 故障隔离 / 卸载回归与路径审计 / 视觉验收 / 公约 §9 符合性）在 0.1.7-rc.2 隔离环境全量实跑通过，全过程与证据见 [`docs/verification.md`](./docs/verification.md)；五皮肤全景、互斥混切与公约 §9 六问自检（每款皮肤）全部通过。
