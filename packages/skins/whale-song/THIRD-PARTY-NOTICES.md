# Third-party notices — @dsh-eac/skin-whale-song「鲸吟」

本包的观感与行为内容迁移自第三方皮肤工程，按其许可随包落档。本包的**工程
骨架**（package.json 清单、公约接线、session 适配层、构建脚本、测试）是本仓
的原始代码；**观感内容**（CSS、海洋背景画、favicon、DOM 逻辑）来自下列上游。

## 上游来源（内容）

- 项目：dsh-web-ui（`@linxin666/dsh-client-ui-skin-whale-song`，version 0.1.11）
- 本包取材经：DSH-EAC/DSH-Desktop-EAC
  `dsh-desktop/assets/skins/whale-song/`（tree `6716abe5d4884f8d722a65b9ef36e535cb41835e`）
- 取材 commit：`26841f5ee83c154a9768cc0a9cec1d70078f0ddf`
  （规划 rev 一致；上游 main 当前已不含该目录，取材以该 rev 为准）
- 上游声明许可：BSD-3-Clause（随包附全文，见下；原文同时存于上游
  `dsh-desktop/assets/skins/dsh-skins-LICENSE.txt`）
- 上游版权声明：`Copyright (c) 2026, zhu1090093659`（BSD-3-Clause 第三条要求：
  本包不以上游名义背书）

## 本包改造说明（covenant-converted）

内容载体 `src/vendor/dsh-web-ui-client.js` = 上游 `lib/client.js` 的逐字节
迁移，唯一改动（公约化改造 S3，详见该文件头注释）：

1. 去除 DSH module-loader 打包外壳与 `exports.apply = apply` 粘合（上游打包
   机械，非皮肤内容）；
2. 模块顶层的 style 注入块移入 `apply()` 顶部（公约 R1：未激活零副作用）；
3. 追加 `export { apply };`（ESM 导出原入口）。

执行骨架（`src/client/session.ts`）为公约适配层：上游 apply 的全部副作用收进
activate，disposer 账本逆序幂等 teardown，并补齐上游没有的 style 节点清理
（公约 §4.3「退出后不可观测」；上游自有的 body 内联样式 round-trip 还原
语义原样保留）。

## 资产审查记录（IP 轻检）

逐项核对本包内嵌资产（client bundle 数据 URI 与预览图）：

- **背景画（已移除，R13 裁定）**：上游 art.ts 注释自述为「《鲸吟》概念画的
  氛围重制版」（1920x1080 WebP，蓝发女神与鲸群）。controller 复核（R13）认定
  其为完整人物插画、与 maid-atelier 被停的同源鲸鱼娘角色链同一视觉宇宙
  （注释级自述不足以支撑权属），**已从本包移除**，替换为皮肤原色板派生的
  **非具象水彩式 CSS 处理**（`BACKDROP_TREATMENT`：冰蓝天光晕染 + 钴蓝辉光 +
  深海军蓝海面 + 金色细线点缀的抽象化点彩——figurative artwork removed for
  IP caution（unknown provenance, same visual universe as maid-atelier
  CC BY-NC-SA chain）, replaced with original gradient）。移除记录见
  `src/vendor/dsh-web-ui-client.js` 文件头第 4 条；预览图同步改为非具象 SVG。
- favicon（**保留，R13 裁定**）：上游注释自述为 deepseek.com 官方蓝鲸标记
  （`#4d6bfe`，取自 deepseek.com/favicon.ico 的 PNG 转制）——这是**宿主产品
  自身的品牌标记**（与本仓生态桌面端应用图标同源），作为宿主自己客户端内的
  favicon 使用，非对第三方品牌的挪用。R13 明确保留，记录不变。

移除后本包**不含任何具象人物/角色/剪影素材**；`data:image/webp` 位图资产为零
（index.test.ts 内容锁断言）。

## BSD 3-Clause License（上游原文）

BSD 3-Clause License

Copyright (c) 2026, zhu1090093659
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
