# Third-party notices — @dsh-eac/skin-trading「交易终端」

本包的观感与行为内容迁移自第三方皮肤工程，按其许可随包落档。本包的**工程
骨架**（package.json 清单、公约接线、session 适配层、构建脚本、测试）是本仓
的原始代码；**观感内容**（CSS、DOM 逻辑、文案、图标）来自下列上游。

## 上游来源（内容）

- 项目：dsh-web-ui（`@linxin666/dsh-client-ui-skin-trading`，version 0.1.11）
- 本包取材经：DSH-EAC/DSH-Desktop-EAC
  `dsh-desktop/assets/skins/trading/`（tree `f0d514eaca38ba943d2310291e973093a5511582`）
- 取材 commit：`26841f5ee83c154a9768cc0a9cec1d70078f0ddf`
  （规划 rev 一致；上游 main 当前已不含该目录，取材以该 rev 为准）
- 上游声明许可：BSD-3-Clause（随包附全文，见下；原文同时存于上游
  `dsh-desktop/assets/skins/dsh-skins-LICENSE.txt`）
- 上游版权声明：`Copyright (c) 2026, zhu1090093659`（BSD-3-Clause 第三条要求：
  本包不以上游名义背书）

## 本包改造说明（covenant-converted）

内容载体 `src/vendor/dsh-web-ui-client.js` = 上游 `lib/client.js` 的逐字节
迁移，唯一改动（公约化改造 S3，详见该文件头注释）：

1. 去除 `window.__ModuleLoader__.load({ id, factory })` 打包外壳与
   `exports.apply = apply` 粘合（上游打包机械，非皮肤内容）；
2. 模块顶层的 style 注入块移入 `apply()` 顶部（公约 R1：未激活零副作用）；
3. 追加 `export { apply };`（ESM 导出原入口）。

执行骨架（`src/client/session.ts`）为公约适配层：上游 apply 的全部副作用收进
activate，disposer 账本逆序幂等 teardown，并补齐上游没有的 style 节点清理
（公约 §4.3「退出后不可观测」）。

## 资产审查记录（IP 轻检）

本包 client bundle 不含任何内嵌位图/字体/第三方品牌素材（favicon 与 K 线
图标均为上游自绘的内联 SVG 数据 URI；行情数据来自运行时公共接口，不随包
分发）。未发现第三方商标/角色/品牌素材。

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
