# 验证矩阵 V1-V11 实跑报告（T2.7 全量验证战役）

> 0.1.7-rc.2 隔离环境全量验证：V1-V11 作为一次完整战役实跑，全部结论以本战役实测为准（不引用旧结论代替实跑）。
> 日期：2026-09-26 ｜ 环境：`.verify/dsh-home-t9`（全新隔离 DSH_HOME）｜ 执行：T2.7
> 总判定：**V1-V11 全部通过**（V7 实跑暴露一处加载器跨标签页缺陷，已修复 + 补测试 + 复跑，见 §3.7 与 §4）。

---

## 0. 环境与安装形态

| 项 | 值 |
| --- | --- |
| 宿主 | `@deepseek-ai/dsh@0.1.7-rc.2`（`.verify/probe/` npm 安装树，钉死版本） |
| DSH_HOME | `D:\丰富履历专用文件夹\皮肤管理插件\loader\.verify\dsh-home-t9`（本战役新建，V1 由 boot 自动初始化；全程唯一 DSH_HOME） |
| Node / npm / pnpm | v24.11.1 / 11.6.2 / 11.7.0（`dsh plugin` 内部转发 pnpm） |
| 平台 / shell | Windows 10.0.22000 x64 ｜ Git Bash ｜ 浏览器 Playwright 1.55 + msedge headless |
| 端口 | 18601（战役全程复用；进程管理一律 `taskkill /F /PID <pid> /T`） |
| 仓库基线 | commit `02045ab`（main HEAD）+ 本战役修复 commit（§4） |

**安装形态（最接近发布的 tarball 链路）**：

```bash
# 三包各 npm pack（产物：.verify/pkgs-t9/*.tgz，files 只含 lib/ + cordis.patch.yml + package.json）
npm pack --pack-destination .verify/pkgs-t9        # 分别在 packages/loader、packages/skins/{aurora,inkwash} 执行
# 逐包 tarball 安装（pnpm 以 file: 复制安装——非 link:；bundle 自动追加进 profile）
DSH_HOME=.verify/dsh-home-t9 npx dsh plugin --profile web add <abs>/dsh-eac-ui-skin-loader-0.0.0.tgz
DSH_HOME=.verify/dsh-home-t9 npx dsh plugin --profile web add <abs>/dsh-eac-skin-aurora-1.0.0.tgz
DSH_HOME=.verify/dsh-home-t9 npx dsh plugin --profile web add <abs>/dsh-eac-skin-inkwash-1.0.0.tgz
```

tarball 安装实测要点：依赖随包装入（loader/aurora 的 `@deepseek-ai/schemastery` 落入 profile `node_modules/.pnpm`）；安装即启用（`dsh.profile.bundles` 自动追加）；**同路径同名重装需先 remove 再 add**（pnpm 对相同 `file:` 规格报 "Already up to date" 不重新解包——本战役修复后重装时实测，见 §4）。

boot 唯一形态（全程）：

```bash
cd .verify/probe && DSH_HOME=<loader>/.verify/dsh-home-t9 npx dsh --profile web --no-open --port 18601
```

---

## 1. 验证矩阵总表

| # | 验证项 | 判定 | 关键证据 |
| --- | --- | --- | --- |
| V1 | 干净内核 boot | ✅ | `boot-v1.log` 1 行零 error/warn；HTTP 401 fence / 303+cookie / 200 |
| V2 | 三包经安装链装入 | ✅ | tarball 安装成功；`boot-v2.log` 零 error/warn；两卡均 discovered 未激活 |
| V3 | 单元测试 node --test | ✅ | 基线本地 93 全绿；修复后本地 125 全绿（postfix 日志）；CI run 36191827871 双平台 success |
| V4 | 控制台渲染（亮/暗） | ✅ | 截图 19/19b/20/20b 卡片墙完整；console error/warning 均为 0 |
| V5 | 热切换 aurora→inkwash→default | ✅ | 16/16 断言；settled 截图 21/22/23；残留与 theme 覆盖全零；归一化 outerHTML 逐字节一致 |
| V6 | 持久化 | ✅ | 7/7 断言；aurora 跨重启恢复（恢复重放路径）+ default 同样持久；截图 24/25 |
| V7 | 跨标签页 | ✅（修复后） | 6/6 断言；A→B 延迟 1055ms、B→A 1186ms（<5s）；截图 26 |
| V8 | 故障隔离 | ✅ | 13/13 断言；fault 卡片 + suspect-residue 徽标 + warning 横幅如实呈现；截图 27/28 |
| V9 | 回归（卸载 + 路径审计） | ✅ | 五包卸载后 boot 与 V1 基线逐字节一致（仅 token 不同）；真实 `.dsh` 2547 条目零变化 |
| V10 | 视觉验收 | ✅ | 截图档案 01-28 完备（§3.10 清单），逐张目验无布局破损 |
| V11 | 公约符合性 | ✅ | 公约 §9 六问 × aurora/inkwash 逐条作答（§3.11），代码位置 + 实机断言双佐证 |

---

## 2. 证据归档位置

- boot 日志：`.verify/boot-v1.log`、`boot-v2-loader-only.log`、`boot-v2.log`、`boot-v2-fixed.log`、`boot-v6-{a,b,c}.log`、`boot-v7.log`、`boot-v8.log`、`boot-v9-after-remove.log`
- 截图：`.verify/shots/01-…28`（清单见 §3.10）
- 实机脚本（证据可重放）：`.verify/pw/t9-lib.mjs` + `t9-empty.mjs` / `t9-wall.mjs` / `t9-switch.mjs` / `t9-persist.mjs` / `t9-crosstab.mjs` / `t9-fault.mjs`
- 路径审计：`.verify/audit-t9/real-dsh-snapshot-{start,end}.txt`（起止两次全量清单 + diff 为空）
- 测试日志：`.verify/audit-t9/v3-local-test.log`（修复前基线）+ `v3-local-test-postfix.log`（修复后，145b1f0 构建）

---

## 3. 逐项结论

### 3.1 V1 干净内核 boot ✅

全新 `dsh-home-t9` 首次 boot：

```
dsh web: http://127.0.0.1:18601/?token=sAIVrMSKsXCk5SfDT4hP_nGzvoGGQaf9_GFCU68q7cI
```

- 日志恰 1 行，`grep -ci error` = 0、`grep -ci warn` = 0。
- HTTP：无 token → 303 → 401（browser-trust fence）；带 token → 303 + `set-cookie`；带 cookie → 200，根 HTML 内实见 `window.__ModuleLoader__`（2 处）。
- 该日志与 HTTP 行为作为 V9 的对照基线留档。

### 3.2 V2 三包经安装链装入 ✅

- 顺序：装 loader tarball → boot（空状态）→ 装 aurora + inkwash tarball → 杀进程重启 boot。
- `boot-v2.log`：1 行零 error/warn（安装后无新增 error）。
- 控制台：恰两张卡（`count=2`），均 `data-usl-skin-status="discovered"`，页面零皮肤副作用（marker/style/backdrop/席位全零）；hero = 默认观感。
- `settingsHint` 对照：aurora 卡有「设置 → 极光之夜」入口、inkwash 卡没有（无设置皮肤不被区别对待）。
- tarball 产物内容核验：`tar -tzf` 仅 `package/lib/{index,client}.js + package.json + cordis.patch.yml`（aurora 另含 README.md）。
- 空状态（V4 缺口项前移至此）：仅装 loader 未装皮肤时，控制台出现 `[data-usl-role="empty"]` 引导文案「还没有安装任何皮肤…」，卡数为 0（截图 18）。

### 3.3 V3 单元测试 ✅

本地复跑两次（`pnpm -r test`，Node 24 type-stripping，`node --test`），与战役的两个构建状态一一对应：

```
基线（修复前构建 02045ab，日志 .verify/audit-t9/v3-local-test.log，04:51）：
packages/loader        tests 93  pass 93  fail 0
packages/skins/aurora  tests 21  pass 21  fail 0
packages/skins/inkwash tests  9  pass  9  fail 0

修复后（提交 145b1f0 构建重跑，日志 .verify/audit-t9/v3-local-test-postfix.log，05:43）：
packages/loader        tests 95  pass 95  fail 0   （+2：V7 缺陷回归测试，见 §4）
packages/skins/aurora  tests 21  pass 21  fail 0
packages/skins/inkwash tests  9  pass  9  fail 0
```

覆盖切换/回滚/恢复/adapter/设置投影/故障隔离/跨标签页同步（含本战役新增回归测试，见 §4）。CI 佐证：战役起点 HEAD `02045ab` run [36186179771](https://github.com/DSH-EAC/dsh-ui-skin-loader/actions/runs/36186179771) success；**修复后推送** run [36191827871](https://github.com/DSH-EAC/dsh-ui-skin-loader/actions/runs/36191827871)（`145b1f0`+`fdef547`）ubuntu+windows 双平台 success——与上方修复后本地 95/21/9 一致。

### 3.4 V4 控制台渲染（亮/暗）✅

- 亮色：`data-usl-scheme="light"`，卡片墙完整（hero + 分组 + 双卡），截图 19 / 19b。
- 暗色：Playwright `emulateMedia({colorScheme:"dark"})` → 真实 `theme/change` 事件链 → `data-usl-scheme="dark"`，截图 20 / 20b。
- 浏览器 console error/warning 均为 0。
- （空状态证据见 §3.2，截图 18。）

### 3.5 V5 热切换 + 零残留 ✅（16/16 断言，同一页面加载内完成）

链路：默认 → aurora → inkwash → 恢复默认。**无刷新不变量**：切换前写入 `window.__t9_no_reload` 标记，链路结束仍在（`performance` 文档未更换）。

- **settled 截图**（缺口项）：每跳等待 switchTo 承诺落定的可见事实（卡片转 active + hero 更名 + 1.2s 余量）后拍摄——21（aurora settled）/ 22（inkwash settled）/ 23（back-to-default settled）。
- **切换后残留**（切走 aurora 后）：`data-skn-aurora-active` marker、`style[data-skn-aurora-style]` 节点、`[data-skn-aurora-backdrop]`、设置席位、styleSheets 归属全零；**token 层按值断言**：body 上 12 枚 `--dsw-alias-*` / 3 枚 `--dsw-specific-*` 中没有任何一枚仍携带 aurora 的值（此时 body 上 12 枚 token 全部属于 inkwash 的覆盖层——这是活性覆盖层，不是残留）。
- **恢复默认后**：双皮肤全部归零；body 内联 `--dsw-*` 计数 = 0；无 `data-ds-dark-theme`；`data-ds-theme-source` 恒为 "system"（偏好轴从未被写）；body background-image 与激活前逐字节相同。
- **DOM 快照比对**（缺口项）：激活前 vs 恢复后的 `documentElement.outerHTML`，归一化（剥离 script、token 查询值、空 `style=""`、标签内属性排序、空白折叠）后**逐字节一致**。归一化词汇经零激活校准测定：宿主自身 churn 仅 `hHd-Xa_quietBars` 一个装饰类与空 `style=""` 属性，且校准断言 churn 中不含任何 `skn-|usl-|dsw-|aurora|inkwash|skin` 归属 token。

### 3.6 V6 持久化 ✅（7/7 断言）

- aurora 激活（等待提交可见 + 1.5s 落盘余量）→ 杀进程 → 重启 → **加载器恢复重放**：无用户点击，hero=极光之夜、卡片 active、token 层恢复、偏好轴仍 system（截图 24）。
- 恢复默认 → 杀进程 → 重启 → 默认观感持久，无皮肤复活、零 token 层、双卡 discovered（截图 25）。
- **实测发现的环境特性（非缺陷）**：宿主 configForms 写通道的 API resolve 早于磁盘落盘；若在 API resolve 后立即硬杀进程（`taskkill /F /T`），最后一次写可能丢失（实测复现一次：mtime 证据 `cordis.patch.yml` 05:01:24.967 = 恢复重放把旧值 aurora 重新落盘，而非 default 写到达）。加载器侧契约（提交后落盘 + 失败如实 warning）不受影响；给 3s 余量后 4/4 重启场景全部通过。已记入 §5 特性清单。

### 3.7 V7 跨标签页 ✅（修复后 6/6 断言）

两个独立 Playwright context（独立 cookie/存储），同开控制台：

- A 激活 aurora → B 自动跟随（marker + token + hero），**延迟 1055ms**（<5s）；B 激活 inkwash → A 跟随，**延迟 1186ms**；双方收敛到同一唯一激活皮肤（截图 26）。
- A 恢复默认 → B 同样跟随（对称性）。

**本项实跑暴露并修复了一处真实缺陷**（首次实跑 B 永不跟随）：详见 §4。修复后以真实构建重跑本项与 V5/V6/V2/V4 复验通过。

### 3.8 V8 故障隔离 ✅（13/13 断言）

探针皮肤复用/扩自 `.verify/probe-skins/`（`probe-skin-fail` 激活即抛错；新增 `probe-skin-hang`：deactivate 返回永不 settle 的 promise）。

- **激活抛错**（probe-ignite）：错误原文如实呈现在该卡片行内（`activate of skin "probe-ignite" threw: probe-skin-fail: intentional activate failure…`），卡片标 **故障** 徽标；回滚落默认、零残留；inkwash 随即可正常激活（故障不传染）（截图 27）。
- **deactivate 挂起**（probe-hang，缺口项）：切往 aurora 时 deactivate 永不返回 → **10s 超时后切换继续**（实测 11.0s 提交，含超时窗口）；**warning 横幅**如实呈现全文 `deactivate of skin "probe-hang" timed out after 10000ms; marked suspect-residue (shutdown could not be verified)`；probe-hang 卡片标 **疑似残留** 徽标；挂起皮肤的 DOM 条确实还在（怀疑是事实，不谎报干净）；aurora 为提交后的当前皮肤（截图 28）。

### 3.9 V9 回归：卸载 + 路径审计 ✅

**卸载回归**：按 probe-hang → probe-fail → inkwash → aurora → loader 顺序 remove 五包 → bundles 复位 base 两项、profile dependencies 清空 → 残留剪除（两个 `link:` 探针的空 symlink 目录手动 `rmdir`；tarball 安装物已被 pnpm 自动剪净；`node_modules` 仅剩空 scope 目录与 pnpm 记账文件，零文件）→ 干净 boot：

```
V1 基线:  dsh web: http://127.0.0.1:18601/?token=sAIVrMSKsXCk5SfDT4hP_nGzvoGGQaf9_GFCU68q7cI
V9 卸载后: dsh web: http://127.0.0.1:18601/?token=N0V_V12_8Hpgk1cvJl911LE8w1mFeg2plizDBkoHzDw
```

token 归一化后 diff 为空；`grep -ci error` = 0；HTTP 行为与 V1 一致（401 fence / 303 / 200）。卸载后 `cordis.patch.yml` 保留 loader 的设置行（activeSkin + faultLog 历史）——宿主对用户设置数据的保留行为，对 boot 零影响（上方 boot 即证）。

**路径审计（用户日常 profile 零触碰）**：

1. **命令清单复核**：本战役全部 dsh 命令（8 次 boot、5 次 add、7 次 remove、0 次其他）均以 `DSH_HOME=D:\丰富履历专用文件夹\皮肤管理插件\loader\.verify\dsh-home-t9` 环境变量前缀执行（shell `export`/行内前缀两种形态，脚本内经 `t9-lib.mjs` 的 `env` 参数注入同一值）；无一次裸 `dsh` 运行。`C:/Users/HUAWEI/.dsh` 从未被任何命令读写。
2. **mtime 扫描（只读证据）**：战役起点与终点各对 `C:\Users\HUAWEI\.dsh` 做一次全量递归清单（`Get-ChildItem -Recurse -Force`，记录类型/全路径/UTC mtime/大小）：

```
起点：2547 条目（.verify/audit-t9/real-dsh-snapshot-start.txt）
终点：2547 条目（.verify/audit-t9/real-dsh-snapshot-end.txt）
diff（起点 vs 终点）：空 —— 零新增、零删除、零 mtime/大小变化
```

3. **写盘范围**：`loader/.verify/`（隔离 home、日志、截图、脚本、tarball、审计清单）+ 仓库内 `docs/verification.md` 与 §4 修复（唯一入库内容）。`.verify/` 在 .gitignore 中。

### 3.10 V10 视觉验收：截图档案 ✅

档案 `.verify/shots/` 共 31 张：01-09（T2.5 历史档案，探针皮肤时期）、10-17（T2.6 历史档案，双内置皮肤 + 对比度修复后重拍）、18-28（**本战役、修复后构建**）：

| 文件 | 内容 | 目验 |
| --- | --- | --- |
| 18-empty-state.png | 未装皮肤时的空状态引导 | 完整 |
| 19/19b-wall-*-light.png | 双卡卡片墙（亮） | 完整 |
| 20/20b-wall-*-dark.png | 卡片墙（暗，theme/change 真实链路） | 完整 |
| 21-aurora-active-settled.png | 极光之夜激活 settled（玻璃拟态+氛围层+当前徽标） | 完整 |
| 22-inkwash-active-settled.png | 水墨青烟激活 settled（纸质+水墨） | 完整 |
| 23-back-to-default-settled.png | 恢复默认 settled（宿主原生观感、零残留） | 完整 |
| 24-aurora-restored-after-restart.png | 重启后恢复重放（无用户点击） | 完整 |
| 25-default-restored-after-restart.png | default 持久化复验 | 完整 |
| 26-cross-tab-follow-aurora.png | 跨标签页跟随（B 页） | 完整 |
| 27-probe-fault-error.png | 激活抛错：行内错误原文 + 故障徽标 | 完整 |
| 28-warning-suspect-residue.png | warning 横幅全文 + 疑似残留徽标 + 真实挂起残影 | 完整 |

（另有 19b/20b 全页照与 t9-debug-1.png（onboarding 弹层发现记录）。亮暗下标题/分组/pill/卡片文字全部清晰可读；无布局破损。）

### 3.11 V11 公约 §9 自检表 ✅（六问 × aurora / inkwash）

> 公约 §9 发布前自检（每题必须答"是"）——`covenant/convention.md` L147-170。佐证 = 代码位置 + 本战役实机断言编号。

**① 未激活时，我的插件除了登记元数据什么都不做？（R1）— aurora ✅ / inkwash ✅**

- 代码：两包 `src/client/index.tsx` 的 `apply(ctx)` 只做 `ctx.uiSkinLoader.registerSkin({...})` + `ctx.effect(() => unregister)`；设置分区席位与氛围层席位全部在 `activate` 内（`src/client/session.ts`）注册。
- 实机：V2 断言「两卡均 discovered、页面零 marker/style/backdrop/席位」（§3.2）——安装后未激活期间页面零副作用；inkwash 无设置面也不注册任何额外内容。

**② `deactivate` 之后，宿主观感与我从未激活时逐像素一致？（§4.3）— aurora ✅ / inkwash ✅**

- 代码：两包 `src/client/session.ts` 登记纪律（disposers 逆序 + 幂等 teardown + abort/fiber 安全网）。
- 实机：V5 归一化 DOM 快照比对「激活前 vs 恢复后逐字节一致」（§3.5）——比"恢复原值"更强：偏好轴 `data-ds-theme-source` 全程 "system"（从未偏离）；body background-image 与激活前相同。

**③ 我没有碰加载器保留面、其他皮肤、宿主恢复面？（R2/R3/R4）— aurora ✅ / inkwash ✅**

- 代码：席位 id / CSS 类 / data 属性 / SVG 渐变 id / locale ns / 设置命名空间全部自有前缀（`skn-aurora-*`：`src/identity.ts`；`skn-inkwash-*` 同构）；不引用 `usl-`/`dsh-ui-skin-loader`/`io.github.dsh-eac.skin.loader.*`/宿主 class；两皮肤互不引用（aurora CSS 组装测试含「不含 skn-inkwash」断言，inkwash 反之）。
- 实机：V5 双向残留断言（切走 aurora 后零 aurora 归属 token 值；恢复默认后双皮肤全零，§3.5）——激活期间对方的层不被触碰。

**④ 我没有依赖任何 CSS-module hash / 私有 DOM / HMR 内部？（R5）— aurora ✅ / inkwash ✅**

- 代码：只触 `document.body/head`（标准 DOM）+ 宿主主题 API 公开 token（`ctx.theme.register/overrideTokens`）+ 公开槽位（`shell.overlay`/`settings.section`）；CSS 选择器全部自有命名空间。
- 实机：跨宿主升级稳定性由"只触公开 ABI"保证；V4/V5 的 Playwright 断言全部经公开 DOM 形态（`data-skn-*`/`data-dsw` token）定位，无需任何 hash/私有面。

**⑤ 我不会自己记住"激活"状态、不会自启？（R6）— aurora ✅ / inkwash ✅**

- 代码：激活唯一入口 = 加载器 switchTo 下发的 activate；无任何持久化"上次是我"逻辑（皮肤设置持久化是用户数据，非激活状态——aurora `src/settings.ts` 只写自己的 `dsh-eac-skin-aurora` 命名空间）。
- 实机：V6 恢复重放由**加载器**读 `dsh-ui-skin-loader.activeSkin` 完成（截图 24）；皮肤自身从不请求激活。

**⑥ 我没有启停或改写任何其他插件？（R7）— aurora ✅ / inkwash ✅**

- 代码：无插件清单/patch 配置写；不写 ui-theme 偏好轴（观感由 `overrideTokens` 层承载，`src/theme.ts` 头注记录定案依据）。
- 实机：V5 偏好轴断言（`data-ds-theme-source` 恒 system）；V8 故障注入（激活抛错/关闭挂起）下其余皮肤与宿主功能不受影响（§3.8）——反证皮肤侧无越权通道。

---

## 4. 验证中发现并修复（代码改动）

### 4.1 缺陷：跨标签页同步在真实镜像回源时序下永不收敛（V7 首跑失败）

- **现象**：A 激活 aurora 提交后，B 页 30s 内无任何跟随；B 的运行时日志无 `cross-tab sync: replaying` 行。
- **根因**（实机 + 上游发布树实读）：上游对 `settings/document-updated` 的唯一 client 消费是 `mirror.load()`（`dsh-client-ui-settings/lib/client.js` L1512）——**异步回源**。事件到达时本端设置快照还是旧值；加载器的 `syncCheck` 仅由该事件驱动，读旧快照 → `persisted === currentId` → 幂等跳过；此后无第二个事件，永不重放。单测未发现：fake 的 `setRemoteValue` 把「远端写入 + 快照变更 + 通知」坍缩成同步一步，隐藏了真实机器上「事件先到、快照后到」的窗口。此缺口即 T2.8 报告 §11.4 预警的"跨标签页设置同步未做多标签实机验证"。
- **修复**（加载器侧小缺陷，两文件）：设置存储暴露 `onChange(listener)`（`persistence.ts`，透传上游 form subscribe）；runtime `start()` 把**本命名空间快照变更**接为 `syncCheck` 的第二触发源（`runtime.ts`），`stop()` 同步撤除。事件当下快照未回源 → 回源时订阅者被通知 → 再查收敛；自身写入回声与在途切换由 syncCheck 既有语义幂等消化（inFlight 早退 + 落定后 finally 重查）。额外收益：`connection/reset` 后的 mirror 全量回源同样触发收敛。
- **测试**：新增回归锁定 `cross-tab: late mirror reload (no second event) still converges — real-machine race`（先红后绿：修复前 `'default' !== 'alpha'` 复现真实时序）；原「他人命名空间事件被忽略」按真实上游语义拆为两例（纯他人事件无事可做 / 他人事件引发的全量回源驱动收敛）。loader 95 tests 全绿（+2）。
- **复验**（修复构建重装后重跑）：V7 6/6（延迟 1055/1186ms）；V5 16/16、V6 7/7、V2/V4 墙面与渲染复验通过、V1/V9 boot 日志零 error——修复未破坏任何矩阵项。

### 4.2 探针脚本层的三个测量教训（非产品缺陷，已修正脚本）

1. **提交可见性**：皮肤 marker（activate 直接生效）早于 hero 更名（commit/notify/persist 之后）——读 hero 必须等卡片转 active（V6/V7/V8 各踩一次）。
2. **残留 token 断言要按值**：共享 token 词表下，切换后 body 上存在**新皮肤的活性覆盖层**，按"token 计数为零"断言会误报——正确断言是"无任何 token 携带旧皮肤的值"。
3. **DOM 归一化需经零激活校准**：宿主自身 churn（装饰类 `hHd-Xa_quietBars`、空 `style=""`、属性顺序）先在无激活状态测定并验证不含皮肤归属 token，再剥离。

---

## 5. 环境特性清单（T2.8 指引素材）

1. **设置落盘窗口**：configForms 写 API resolve ≠ 磁盘落盘；硬杀进程可丢最后一次写（V6 mtime 证据）。恢复重放因此可能恢复"上一次成功落盘"的选择——行为一致、无损坏。
2. **同规格 tarball 重装**：`pnpm add` 对相同 `file:` 规格跳过重装（"Already up to date"）——换包内容重装需 remove + add。
3. **link: 安装的残留形态**：remove 后空 symlink 目录留存（不参与 boot）；tarball（file:）安装物由 pnpm 自动剪净。
4. **全新 home 的 onboarding**：内测声明弹层（继续）会拦截 Playwright 点击，自动化需先关闭。
5. **宿主 DOM churn 词汇**：`hHd-Xa_quietBars`（装饰类）、空 `style=""`、标签内属性顺序——做 DOM 快照比对时先校准。

## 6. 结论

验证矩阵 V1-V11 在 0.1.7-rc.2 隔离环境作为一次完整战役实跑完成：**三包 tarball 安装链可用**、热切换零残留、持久化与恢复重放正确、跨标签页秒级收敛（暴露并修复一处真实缺陷后）、故障隔离与如实降级符合公约 §4.4、卸载回归与 V1 基线逐字节一致、用户真实 profile 零触碰（2547 条目起止零变化）、截图档案完备、两内置皮肤通过公约 §9 全部六问。`.verify` 结束态：五包已卸载、boot 复验通过、无遗留进程（战役全部 boot 已 `taskkill /F /T`；一台先于本战役存在的旧隔离 boot（端口 18777，9/25 19:03 启动）连同处置一并记录于 task-9 报告）。
